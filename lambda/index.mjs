import mysql from 'mysql2/promise';

export const handler = async (event) => {
  let connection;
  
  try {
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '3306'),
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: 'desert2018',
      ssl: { rejectUnauthorized: false },
      connectTimeout: 10000
    });

    const [rows] = await connection.execute('SELECT * FROM usuario LIMIT 10');

    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        total: rows.length,
        data: rows
      })
    };

  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        message: 'Error',
        error: error.message,
        code: error.code
      })
    };
  } finally {
    if (connection) await connection.end().catch(() => {});
  }
};