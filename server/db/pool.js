import dns from 'node:dns';
import mysql from 'mysql2/promise';
import { env } from '../utils/env.js';

dns.setDefaultResultOrder('ipv4first');

let pool;

function applyConnectionTimezone(connection) {
  return connection.query('SET time_zone = ?', [env.DB_TIMEZONE]);
}

export function getPool() {
  if (pool) {
    return pool;
  }

  pool = mysql.createPool({
    host: env.DB_HOST,
    port: env.DB_PORT,
    user: env.DB_USER,
    password: env.DB_PASSWORD,
    database: env.DB_NAME,
    waitForConnections: true,
    connectionLimit: env.DB_CONNECTION_LIMIT,
    queueLimit: 0,
    timezone: env.DB_TIMEZONE,
    namedPlaceholders: true,
    dateStrings: true
  });

  pool.on('connection', (connection) => {
    connection.query('SET time_zone = ?', [env.DB_TIMEZONE], () => {
      // Ignore init failures; next query will return an explicit DB error.
    });
  });

  return pool;
}

export async function closePool() {
  if (!pool) {
    return;
  }

  await pool.end();
  pool = undefined;
}

export async function withTransaction(callback) {
  const poolInstance = getPool();
  const connection = await poolInstance.getConnection();

  try {
    await applyConnectionTimezone(connection);
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
