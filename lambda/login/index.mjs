import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'POST,OPTIONS',
};

export const handler = async (event) => {
  // HTTP API usa requestContext.http.method; REST API usa httpMethod
  const method = event.requestContext?.http?.method ?? event.httpMethod;

  if (method === 'OPTIONS') {
    return { statusCode: 200, headers: HEADERS, body: '' };
  }

  let body;
  try {
    body = typeof event.body === 'string' ? JSON.parse(event.body) : event.body;
  } catch {
    return {
      statusCode: 400,
      headers: HEADERS,
      body: JSON.stringify({ success: false, message: 'Body JSON inválido' }),
    };
  }

  const { usuario, password } = body || {};

  if (!usuario || !password) {
    return {
      statusCode: 400,
      headers: HEADERS,
      body: JSON.stringify({ success: false, message: 'Usuario y password son requeridos' }),
    };
  }

  let connection;
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: 'desert2018',
      ssl: { rejectUnauthorized: false },
      connectTimeout: 10000,
    });

    const [rows] = await connection.execute(
      'SELECT idusuario, nombre, usuario, tusuario FROM usuario WHERE usuario = ? AND password = ?',
      [usuario, password]
    );

    if (rows.length === 0) {
      return {
        statusCode: 401,
        headers: HEADERS,
        body: JSON.stringify({ success: false, message: 'Credenciales incorrectas' }),
      };
    }

    const { idusuario, nombre, tusuario, usuario: usr } = rows[0];

    // TODO: Fase 2 — migrar password a bcrypt
    const token = jwt.sign(
      { idusuario, nombre, usuario: usr, tusuario },
      process.env.JWT_SECRET,
      { expiresIn: '8h' }
    );

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({
        success: true,
        token,
        user: { idusuario, nombre, usuario: usr, tusuario },
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ success: false, message: error.message }),
    };
  } finally {
    if (connection) await connection.end().catch(() => {});
  }
};
