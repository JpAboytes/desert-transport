# CLAUDE.md — Desert Transport

> Contexto raíz del proyecto. Claude Code carga este archivo al inicio de cada sesión.
> Mantenlo **conciso y estable**: arquitectura, convenciones y "gotchas". No es un changelog
> (para eso está `git log`). Si algo aquí contradice al código, **el código manda** — corrige este archivo.

## Qué es

Sistema de **gestión de solicitudes de reparación** para una flota de transporte (camiones y
remolques/cajas). Un mecánico levanta una solicitud; el administrador la autoriza o rechaza; al
autorizar se genera un **PO** (purchase order) correlativo y se registra el servicio en las tablas
detalladas. La reparación pasa a estar **en proceso**; el mecánico la **cierra** (con costo real)
y el administrador finalmente **autoriza o rechaza el pago**. Las transiciones notifican por push.

### Máquina de estados (`serviciomovil.estatus` + `autorizacionpago`)

```
Pendiente
  ├─ Rechazado            [fin]                    (admin declina la solicitud)
  └─ En proceso           (admin autoriza → +PO +inserts servicioc/cajas)
       └─ Reparado        (mecánico cierra: costoreal, fechacierre)
            · autorizacionpago = NULL  → esperando decisión de pago
            · autorizacionpago = 1     → pago AUTORIZADO  [fin]
            · autorizacionpago = 0     → pago RECHAZADO   [fin]
```

El pago **no** es un `estatus` aparte: el ticket se queda en `Reparado` y el booleano
`autorizacionpago` separa el desenlace. Las UIs derivan la etiqueta visible con un helper
`displayEstatus()` (Reparado + 1 → "Pagado"; + 0 → "Pago rechazado").

## Arquitectura (monorepo, 3 frentes)

```
dessert/
├── expo-app/   App móvil React Native + Expo (expo-router). Cliente principal.
├── pwa/        App web Vite + React + Tailwind. Cliente alterno (mismo backend).
└── lambda/     Backend AWS Lambda (Node 18+, ESM). Una función por dominio.
```

- **Backend**: AWS API Gateway **HTTP API** → Lambdas. Región **us-east-2**.
  - Base URL: `https://ui7sns7rxj.execute-api.us-east-2.amazonaws.com`
- **Base de datos**: MySQL, schema **`movil`** (RDS). Conexión por `mysql2/promise` con
  `ssl: { rejectUnauthorized: false }`. Credenciales por env vars (`DB_HOST`, `DB_PORT`,
  `DB_USER`, `DB_PASSWORD`).
- **Auth**: JWT (`jsonwebtoken`), secret en env `JWT_SECRET`, expira en 8h. El payload lleva
  `{ idusuario, nombre, usuario, tusuario }`.

## Roles (`usuario.tusuario`)

- **`Mantenimiento`** → mecánico. Crea solicitudes, cierra reparaciones en proceso, ve "mis
  solicitudes", recibe push (autorización y decisión de pago).
- **`Administrador`** → autoriza/rechaza solicitudes (asigna PO), autoriza/rechaza el pago de
  reparaciones cerradas, ve todas las solicitudes, recibe push cuando un mecánico cierra un ticket.

La UI bifurca por rol en `expo-app/app/home.jsx`. El lambda `admin` rechaza (403) si
`tusuario !== 'Administrador'`.

## Endpoints (API Gateway → Lambda)

| Método | Ruta | Lambda | Auth | Notas |
|---|---|---|---|---|
| POST | `/login` | `lambda/login` | — | Devuelve `{ token, user }`. |
| GET | `/unidades?tipo=camion\|remolque` | `lambda/unidades` | JWT | Lista de nombres de unidades. |
| POST | `/solicitudes` | `lambda/solicitudes` | JWT | Crea solicitud (estatus `Pendiente`). |
| GET | `/mis-solicitudes` | `lambda/solicitudes` | JWT | Solicitudes del usuario actual. |
| PATCH | `/mis-solicitudes/{id}` | `lambda/solicitudes` | JWT (dueño) | Cierra reparación: `{ costoReal, urlCierre? }` → `Reparado`. |
| PUT | `/push-token` | `lambda/solicitudes` | JWT | Guarda `usuario.push_token`. |
| POST | `/uploads/presign` | `lambda/solicitudes` | JWT | Devuelve `{ uploadUrl, fileUrl }` para subir una foto a S3 (presigned PUT). |
| GET | `/admin/solicitudes` | `lambda/admin` | JWT admin | Todas las solicitudes. |
| PATCH | `/admin/solicitudes/{id}` | `lambda/admin` | JWT admin | Solicitud: `{ estatus: Autorizado\|Rechazado }`. Pago: `{ autorizacionPago: true\|false }` (sobre ticket `Reparado`). |

`lambda/index.mjs` (raíz) es el **monolito original** previo a la separación por dominio; las rutas
vivas son las de las subcarpetas. Confirmar en API Gateway antes de tocarlo.

## Modelo de datos (inferido de las queries — verificar contra la BD real)

- **`usuario`**: `idusuario`, `nombre`, `usuario`, `password` (⚠️ texto plano), `tusuario`, `push_token`.
- **`serviciomovil`** (la solicitud): `idserviciomovil`, `idsolicitante`→usuario, `idaprobador`→usuario,
  `estatus` (`Pendiente`/`Rechazado`/`En proceso`/`Reparado`), `tunidad` (`Camión`/otro=remolque),
  `odometro`, `numeconomico`, `descripcion`, `costo` (estimado), `urlfoto`, `fechahora`,
  `PO` (UNIQUE, se asigna al autorizar). Columnas del flujo extendido:
  `costoreal` DECIMAL, `urlcierre` VARCHAR (foto del cierre en S3), `fechacierre` DATETIME
  (las llena el mecánico al cerrar), y `autorizacionpago` TINYINT(1) NULL (decisión de pago del admin:
  NULL=pendiente, 1=autorizado, 0=rechazado). `urlfoto` guarda la foto de la solicitud (en S3).
- **`camion`**: `IdCamion`, `NombreC`. — **`cajas`** (remolques): `idcaja`, `Numero`.
- **`servicioc`** / **`serviciocajas`**: servicio detallado creado en la **primera** autorización;
  guardan `PO_camiones` / `PO_remolques` con formato `"{idServicio}-{PO}-{numeconomico}"`.

## Flujo crítico: autorización + PO (`lambda/admin/index.mjs`)

El PATCH admin con `{ estatus: 'Autorizado' }` (alias de `'En proceso'`) corre dentro de una **transacción**:
1. `SELECT ... FOR UPDATE` la solicitud. Es **idempotente**: si ya tenía `PO`, lo conserva.
2. Si no tenía PO: `MAX(PO)+1` con **reintento ante `ER_DUP_ENTRY`** (5 intentos) — el UNIQUE + retry
   evita colisiones concurrentes.
3. Solo en la primera aprobación inserta la fila en `servicioc` (camión) o `serviciocajas` (remolque).
4. Tras el commit, dispara **Expo Push** al solicitante (no bloquea la respuesta; falla en silencio).

No rompas la idempotencia ni saques el envío de push fuera del try/catch que lo aísla.
La decisión de pago (`{ autorizacionPago }`) es una rama aparte: valida que el ticket esté en
`Reparado` y sin decisión previa (`autorizacionpago IS NULL`), luego solo actualiza el booleano.

## Fotos (S3)

- **Bucket** `dessert-trucking-fotos` (us-east-2). Prefijo `fotos/` es **lectura pública** (bucket
  policy); el resto no. Keys aleatorias `fotos/<uuid>.jpg`. CORS abierto para PUT desde el navegador.
- **Subida = presigned URL**: el cliente pide `POST /uploads/presign` (con JWT) → el lambda firma un
  PUT (expira 120s) y devuelve `{ uploadUrl, fileUrl }`. El cliente **comprime** la imagen (~1280px,
  JPEG) y hace `PUT` directo a S3; luego manda `fileUrl` en `crearSolicitud` (`urlFoto`) o
  `cerrarReparacion` (`urlCierre`). El backend nunca recibe el binario.
- El rol Lambda `dessert-trucking-role-npsy60tt` tiene `s3:PutObject` sobre `fotos/*` (policy inline
  `dessert-trucking-s3-fotos`). El lambda solicitudes bundlea `@aws-sdk/client-s3` y
  `@aws-sdk/s3-request-presigner`; el bucket por env `S3_BUCKET` con fallback en código.
- **Display**: componente `FotoThumb` (móvil `expo-app/components`, web `pwa/src/components`):
  miniatura con lazy-load que abre la foto completa en modal. Captura con `FotoPicker`
  (móvil: expo-image-picker/manipulator; web: `<input type=file>` + browser-image-compression).

## Notificaciones push

- Expo Push. Canal Android `solicitudes`. Token registrado vía `PUT /push-token`.
- EAS `projectId`: `24ceda7b-3d14-49c6-938c-a3f2d74e46e9` (en `expo-app/app.json`).
- Se registran notificaciones para `Mantenimiento` **y** `Administrador` (ver `home.jsx`): el admin
  necesita push_token para recibir el aviso de cierre del mecánico. La **PWA no registra push**.

## Convenciones

- **Idioma**: todo en español (código, comentarios, UI, identificadores de dominio). Mantenerlo.
- **Lambdas**: cada handler maneja `OPTIONS` (CORS `*`), valida JWT, usa helper `resp()` y cierra
  la conexión en `finally`. CORS abierto a `*` (revisar antes de producción seria).
- **Estética móvil**: estilo editorial/periódico (serif + mono, negro `#0a0a0a` sobre papel
  `#ffffff`, reglas finas, mayúsculas con tracking). Respetar esa paleta al añadir pantallas.
- **Fechas**: el front manda ISO 8601; el lambda lo convierte a `DATETIME` MySQL
  (`.slice(0,19).replace('T',' ')`). MySQL no acepta el `T`/ms/`Z`.

## Cómo correr / desplegar

- **Móvil**: `cd expo-app && npm start` (Expo). Build con EAS (`eas.json`). Owner `jpdessens`.
- **PWA**: `cd pwa && npm run dev` (Vite). Config por `pwa/.env` → `VITE_API_URL`.
- **Lambda**: empaquetar `index.mjs` + `package.json` + `node_modules` en zip y
  `aws lambda update-function-code` (us-east-2). Hay zips ya generados por carpeta.

## Deuda técnica / TODOs conocidos

- ⚠️ **Passwords en texto plano** en `usuario.password` y en el `SELECT` del login → migrar a bcrypt.
- `JWT_SECRET` y credenciales de BD viven en env vars de Lambda (no en repo). No commitear secretos.
- `expo-app/constants/api.js`: URL hardcodeada; TODO mover a `extra.apiUrl` vía `app.config.js`.
- CORS `*` en todos los lambdas.
- `pwa/.env.example` quedó con una URL placeholder de `us-east-1/prod`; la real es `us-east-2` (ver `.env`).

## Archivos clave (fuente de verdad)

- `lambda/admin/index.mjs` — lógica de PO y servicio detallado (lo más delicado del sistema).
- `lambda/solicitudes/index.mjs` — alta de solicitud, mis-solicitudes, push-token.
- `expo-app/app/home.jsx` — bifurcación por rol.
- `expo-app/services/` y `pwa/src/services/api.js` — capa cliente del API (deben ir alineadas).
