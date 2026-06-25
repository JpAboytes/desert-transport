import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import webpush from 'web-push';

const S3_BUCKET = process.env.S3_BUCKET || 'dessert-trucking-fotos';
const S3_REGION = process.env.AWS_REGION || 'us-east-2';
const s3 = new S3Client({ region: S3_REGION });

// Web Push (VAPID). Las claves viven en env vars del Lambda; si faltan, se omite el canal.
const VAPID_PUBLIC = process.env.VAPID_PUBLIC;
const VAPID_PRIVATE = process.env.VAPID_PRIVATE;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@deserttransport.com';
const webPushReady = !!(VAPID_PUBLIC && VAPID_PRIVATE);
if (webPushReady) webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

const MAX_FOTOS = 7;

// Hora de pared "ahora" en zona México NW (America/Tijuana, DST-aware), formato MySQL DATETIME.
// El Lambda corre en UTC; NOW() guardaría UTC y rompería el modelo de hora de pared.
function ahoraLocalMysql() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Tijuana', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(new Date());
  const g = (t) => parts.find((p) => p.type === t).value;
  return `${g('year')}-${g('month')}-${g('day')} ${g('hour')}:${g('minute')}:${g('second')}`;
}

// Inserta hasta 7 URLs de fotos en serviciomovil_fotos (tipo 'Apertura' | 'Cierre').
async function guardarFotos(connection, idserviciomovil, tipo, urls) {
  const lista = (Array.isArray(urls) ? urls : [])
    .filter((u) => typeof u === 'string' && u.trim())
    .slice(0, MAX_FOTOS)
    .map((u) => u.slice(0, 500));
  if (lista.length === 0) return;
  const placeholders = lista.map(() => '(?, ?, ?, NOW())').join(', ');
  const values = lista.flatMap((u) => [idserviciomovil, tipo, u]);
  await connection.execute(
    `INSERT INTO serviciomovil_fotos (idserviciomovil, tipo, url, fechacarga) VALUES ${placeholders}`,
    values
  );
}

// Adjunta a cada solicitud su arreglo `fotos: [{ tipo, url }]` (una sola query).
async function adjuntarFotos(connection, rows) {
  if (rows.length === 0) return rows;
  const ids = rows.map((r) => r.idserviciomovil);
  const placeholders = ids.map(() => '?').join(', ');
  const [fotos] = await connection.execute(
    `SELECT idserviciomovil, tipo, url FROM serviciomovil_fotos
      WHERE idserviciomovil IN (${placeholders}) ORDER BY idfoto`,
    ids
  );
  const porId = new Map();
  for (const f of fotos) {
    if (!porId.has(f.idserviciomovil)) porId.set(f.idserviciomovil, []);
    porId.get(f.idserviciomovil).push({ tipo: f.tipo, url: f.url });
  }
  for (const r of rows) r.fotos = porId.get(r.idserviciomovil) ?? [];
  return rows;
}

// Notifica a todos los administradores por Expo (app nativa) y Web Push (PWA).
// No lanza; los errores se loguean. Recibe una conexión MySQL ya abierta.
async function notificarAdmins(connection, { titulo, cuerpo, solicitudId, estatus, url = '/home' }) {
  // ── Expo Push (app nativa) ──
  try {
    const [admins] = await connection.execute(
      `SELECT push_token FROM usuario
        WHERE tusuario = 'Administrador' AND push_token LIKE 'ExponentPushToken%'`
    );
    const mensajes = admins.map((a) => ({
      to: a.push_token,
      sound: 'default',
      channelId: 'solicitudes',
      priority: 'high',
      title: titulo,
      body: cuerpo,
      data: { solicitudId: String(solicitudId), estatus, url },
    }));
    if (mensajes.length > 0) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(mensajes),
      });
    }
  } catch (e) {
    console.error('[push] error al notificar a admins:', e?.message ?? e);
  }

  // ── Web Push (PWA) ──
  if (webPushReady) {
    try {
      const [subs] = await connection.execute(
        `SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth
           FROM push_subscriptions ps
           JOIN usuario u ON u.idusuario = ps.idusuario
          WHERE u.tusuario = 'Administrador'`
      );
      console.log('[webpush] subs encontradas=', subs.length);
      const payload = JSON.stringify({ title: titulo, body: cuerpo, url });
      await Promise.all(subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            payload
          );
          console.log('[webpush] enviado OK a sub', s.id);
        } catch (err) {
          console.error('[webpush] fallo sub', s.id, '| status=', err?.statusCode, '| body=', err?.body);
          // 404/410 = suscripción expirada. 403 / 400 VapidPkHashMismatch = creada con OTRA clave
          // VAPID (p. ej. quedó una vieja antes de rotar dev→prod): nunca se le podrá entregar con
          // las claves actuales, así que también se borra.
          const cuerpo = String(err?.body ?? '');
          const claveIncompatible =
            err?.statusCode === 403 || (err?.statusCode === 400 && /vapid/i.test(cuerpo));
          if (err?.statusCode === 404 || err?.statusCode === 410 || claveIncompatible) {
            await connection.execute('DELETE FROM push_subscriptions WHERE id = ?', [s.id]).catch(() => {});
          }
        }
      }));
    } catch (e) {
      console.error('[webpush] error al notificar a admins:', e?.message ?? e);
    }
  }
}

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,PATCH,OPTIONS',
};

const resp = (statusCode, body) => ({
  statusCode,
  headers: HEADERS,
  body: JSON.stringify(body),
});

const dbConfig = () => ({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: 'desert2018',
  ssl: { rejectUnauthorized: false },
  connectTimeout: 10000,
});

export const handler = async (event) => {
  const method = event.requestContext?.http?.method ?? event.httpMethod;

  if (method === 'OPTIONS') {
    return { statusCode: 200, headers: HEADERS, body: '' };
  }

  // Verificar JWT
  const authHeader = event.headers?.Authorization ?? event.headers?.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return resp(401, { success: false, message: 'No autorizado' });

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return resp(401, { success: false, message: 'Token inválido o expirado' });
  }

  const path = event.requestContext?.http?.path ?? event.rawPath ?? '';

  // ── POST /uploads/presign ─────────────────────────────────
  // Devuelve una URL firmada (PUT) para subir una foto directo a S3,
  // y la URL pública final que el cliente guardará luego en la solicitud.
  if (method === 'POST' && path.endsWith('/uploads/presign')) {
    let body;
    try {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } catch {
      body = {};
    }
    const contentType = /^image\/(jpeg|png|webp)$/.test(body?.contentType) ? body.contentType : 'image/jpeg';
    const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
    const key = `fotos/${randomUUID()}.${ext}`;
    try {
      const uploadUrl = await getSignedUrl(
        s3,
        new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, ContentType: contentType }),
        { expiresIn: 120 }
      );
      const fileUrl = `https://${S3_BUCKET}.s3.${S3_REGION}.amazonaws.com/${key}`;
      return resp(200, { success: true, uploadUrl, fileUrl });
    } catch (error) {
      console.error('[presign] error:', error?.message ?? error);
      return resp(500, { success: false, message: error.message });
    }
  }

  // ── POST /push/subscribe ──────────────────────────────────
  // Guarda (upsert) la suscripción Web Push del usuario para mandarle notificaciones al PWA.
  if (method === 'POST' && path.endsWith('/push/subscribe')) {
    let body;
    try {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } catch {
      return resp(400, { success: false, message: 'Body JSON inválido' });
    }
    const { endpoint, keys } = body ?? {};
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return resp(400, { success: false, message: 'Suscripción inválida' });
    }
    let connection;
    try {
      connection = await mysql.createConnection(dbConfig());
      await connection.execute(
        `INSERT INTO push_subscriptions (idusuario, endpoint, p256dh, auth)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE idusuario = VALUES(idusuario), p256dh = VALUES(p256dh), auth = VALUES(auth)`,
        [decoded.idusuario, endpoint, keys.p256dh, keys.auth]
      );
      console.log('[push/subscribe] guardada para idusuario', decoded.idusuario);
      return resp(200, { success: true });
    } catch (error) {
      console.error('[push/subscribe] error:', error?.sqlMessage ?? error?.message);
      return resp(500, { success: false, message: error.message });
    } finally {
      if (connection) await connection.end().catch(() => {});
    }
  }

  // ── GET /mis-solicitudes ──────────────────────────────────
  if (method === 'GET') {
    let connection;
    try {
      connection = await mysql.createConnection(dbConfig());
      const [rows] = await connection.execute(
        `SELECT s.idserviciomovil, s.estatus, s.tunidad, s.odometro,
                s.numeconomico, s.descripcion, s.costo, s.costoreal,
                s.fechahora, s.fechacierre, s.autorizacionpago, s.PO,
                us.nombre AS nombresolicitante,
                ua.nombre AS nombreaprobador
         FROM serviciomovil s
         JOIN  usuario us ON us.idusuario = s.idsolicitante
         LEFT JOIN usuario ua ON ua.idusuario = s.idaprobador
         WHERE s.idsolicitante = ?
         ORDER BY s.fechahora DESC`,
        [decoded.idusuario]
      );
      await adjuntarFotos(connection, rows);
      return resp(200, { success: true, data: rows });
    } catch (error) {
      return resp(500, { success: false, message: error.message });
    } finally {
      if (connection) await connection.end().catch(() => {});
    }
  }

  // ── POST /solicitudes ─────────────────────────────────────
  if (method === 'POST') {
    let body;
    try {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } catch {
      return resp(400, { success: false, message: 'Body JSON inválido' });
    }

    const { fechaHora, tipoUnidad, numeroEconomico, descripcionServicio, costoEstimado, odometro, fotos } = body ?? {};

    if (!fechaHora || !tipoUnidad || !numeroEconomico || !descripcionServicio || !costoEstimado) {
      return resp(400, { success: false, message: 'Faltan campos requeridos' });
    }

    const costo = parseFloat(costoEstimado);
    if (isNaN(costo) || costo < 0) return resp(400, { success: false, message: 'costoEstimado inválido' });

    const odometroVal = tipoUnidad === 'Camión' && odometro !== undefined ? parseInt(odometro) : null;

    // Hora de pared: se guarda tal cual la mandó el cliente, SIN reinterpretar zona horaria
    // (nada de new Date()/toISOString, que desplazaría a UTC). Toma los componentes literales.
    // Acepta "2026-06-22T11:36", "...:11:36:00" o el ISO con 'Z'.
    const m = String(fechaHora).match(/(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?/);
    if (!m) {
      return resp(400, { success: false, message: 'fechaHora inválida' });
    }
    const fechaMysql = `${m[1]}-${m[2]}-${m[3]} ${m[4]}:${m[5]}:${m[6] ?? '00'}`;

    let connection;
    try {
      connection = await mysql.createConnection(dbConfig());
      const [result] = await connection.execute(
        `INSERT INTO serviciomovil
           (idsolicitante, estatus, tunidad, odometro, numeconomico, descripcion, costo, fechahora)
         VALUES (?, 'Pendiente', ?, ?, ?, ?, ?, ?)`,
        [decoded.idusuario, tipoUnidad, odometroVal, numeroEconomico, descripcionServicio, costo, fechaMysql]
      );

      await guardarFotos(connection, result.insertId, 'Apertura', fotos);

      // Avisar a los administradores de la nueva solicitud pendiente.
      await notificarAdmins(connection, {
        titulo: `Nueva solicitud #${String(result.insertId)}`,
        cuerpo: `${decoded.nombre} registró una solicitud para ${tipoUnidad} ${numeroEconomico}.`,
        solicitudId: result.insertId,
        estatus: 'Pendiente',
      });

      return resp(201, { success: true, idserviciomovil: result.insertId, message: 'Solicitud registrada correctamente' });
    } catch (error) {
      return resp(500, { success: false, message: error.message });
    } finally {
      if (connection) await connection.end().catch(() => {});
    }
  }

  // ── PUT /push-token ───────────────────────────────────────
  if (method === 'PUT') {
    let body;
    try {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } catch {
      return resp(400, { success: false, message: 'Body JSON inválido' });
    }

    const { expoPushToken } = body ?? {};
    if (!expoPushToken) return resp(400, { success: false, message: 'Falta expoPushToken' });

    let connection;
    try {
      connection = await mysql.createConnection(dbConfig());
      await connection.execute(
        'UPDATE usuario SET push_token = ? WHERE idusuario = ?',
        [expoPushToken, decoded.idusuario]
      );
      return resp(200, { success: true, message: 'Token registrado' });
    } catch (error) {
      return resp(500, { success: false, message: error.message });
    } finally {
      if (connection) await connection.end().catch(() => {});
    }
  }

  // ── PATCH /mis-solicitudes/{id} ───────────────────────────
  // El mecánico cierra su reparación en proceso: captura costo real + notas.
  if (method === 'PATCH') {
    const id = event.pathParameters?.id;
    if (!id) return resp(400, { success: false, message: 'Falta el id de la solicitud' });

    let body;
    try {
      body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
    } catch {
      return resp(400, { success: false, message: 'Body JSON inválido' });
    }

    const { costoReal, fotos } = body ?? {};
    const costo = parseFloat(costoReal);
    if (isNaN(costo) || costo < 0) {
      return resp(400, { success: false, message: 'costoReal inválido' });
    }

    let connection;
    try {
      connection = await mysql.createConnection(dbConfig());

      // Solo el dueño puede cerrar, y solo si está En proceso.
      const [cur] = await connection.execute(
        'SELECT idsolicitante, estatus FROM serviciomovil WHERE idserviciomovil = ?',
        [id]
      );
      if (cur.length === 0) return resp(404, { success: false, message: 'Solicitud no encontrada' });
      if (cur[0].idsolicitante !== decoded.idusuario) {
        return resp(403, { success: false, message: 'No puedes cerrar una solicitud que no es tuya' });
      }
      if (cur[0].estatus !== 'En proceso') {
        return resp(409, { success: false, message: `Solo se puede cerrar una reparación En proceso (actual: ${cur[0].estatus})` });
      }

      await connection.execute(
        `UPDATE serviciomovil
            SET estatus = 'Reparado', costoreal = ?, fechacierre = ?
          WHERE idserviciomovil = ?`,
        [costo, ahoraLocalMysql(), id]
      );

      await guardarFotos(connection, id, 'Cierre', fotos);

      // Notificar a los administradores: ticket listo para autorizar pago.
      await notificarAdmins(connection, {
        titulo: `Reparación #${String(id)} terminada`,
        cuerpo: 'Un ticket está listo para autorizar el pago.',
        solicitudId: id,
        estatus: 'Reparado',
      });

      return resp(200, { success: true, message: 'Reparación cerrada — pendiente de autorización de pago' });
    } catch (error) {
      console.error('[solicitudes] error:', error?.code, '|', error?.sqlMessage ?? error?.message);
      return resp(500, { success: false, message: error.message });
    } finally {
      if (connection) await connection.end().catch(() => {});
    }
  }

  return resp(405, { success: false, message: 'Método no permitido' });
};
