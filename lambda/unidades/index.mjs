import mysql from 'mysql2/promise';
import jwt from 'jsonwebtoken';

const HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization,X-Amz-Date,X-Api-Key,X-Amz-Security-Token',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
};

const QUERIES = {
  camion:   'SELECT NombreC AS nombre FROM camion ORDER BY NombreC',
  remolque: 'SELECT CAST(Numero AS CHAR) AS nombre FROM cajas ORDER BY Numero',
};

export const handler = async (event) => {
  const method = event.requestContext?.http?.method ?? event.httpMethod;

  if (method === 'OPTIONS') {
    return { statusCode: 200, headers: HEADERS, body: '' };
  }

  // Verificar JWT
  const authHeader = event.headers?.Authorization ?? event.headers?.authorization ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return {
      statusCode: 401,
      headers: HEADERS,
      body: JSON.stringify({ success: false, message: 'No autorizado' }),
    };
  }

  try {
    jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return {
      statusCode: 401,
      headers: HEADERS,
      body: JSON.stringify({ success: false, message: 'Token inválido o expirado' }),
    };
  }

  const tipo = (event.queryStringParameters?.tipo ?? '').toLowerCase();
  const query = QUERIES[tipo];

  if (!query) {
    return {
      statusCode: 400,
      headers: HEADERS,
      body: JSON.stringify({ success: false, message: 'Parámetro tipo inválido. Use: camion | remolque' }),
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

    const [rows] = await connection.execute(query);

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({
        success: true,
        data: rows.map((r) => r.nombre),
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
