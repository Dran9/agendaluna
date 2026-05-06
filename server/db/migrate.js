import 'dotenv/config';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getPool } from './pool.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.join(__dirname, 'migrations');

function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let escaped = false;

  for (let i = 0; i < sql.length; i += 1) {
    const char = sql[i];

    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      current += char;
      escaped = true;
      continue;
    }

    if (!inDouble && !inBacktick && char === "'") {
      inSingle = !inSingle;
      current += char;
      continue;
    }

    if (!inSingle && !inBacktick && char === '"') {
      inDouble = !inDouble;
      current += char;
      continue;
    }

    if (!inSingle && !inDouble && char === '`') {
      inBacktick = !inBacktick;
      current += char;
      continue;
    }

    if (!inSingle && !inDouble && !inBacktick && char === ';') {
      const statement = current.trim();
      if (statement) {
        statements.push(statement);
      }
      current = '';
      continue;
    }

    current += char;
  }

  const trailing = current.trim();
  if (trailing) {
    statements.push(trailing);
  }

  return statements;
}

async function ensureMigrationsTable(connection) {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      file_name VARCHAR(255) NOT NULL UNIQUE,
      executed_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
}

async function getPendingMigrations(connection) {
  const files = (await fs.readdir(migrationsDir))
    .filter((file) => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b));

  const [rows] = await connection.query('SELECT file_name FROM schema_migrations');
  const executed = new Set(rows.map((row) => row.file_name));

  return files.filter((file) => !executed.has(file));
}

async function run() {
  const pool = getPool();
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    await ensureMigrationsTable(connection);
    const pending = await getPendingMigrations(connection);

    for (const fileName of pending) {
      const filePath = path.join(migrationsDir, fileName);
      const sql = await fs.readFile(filePath, 'utf8');
      const statements = splitSqlStatements(sql);

      for (const statement of statements) {
        await connection.query(statement);
      }

      await connection.query('INSERT INTO schema_migrations (file_name) VALUES (?)', [fileName]);
      // eslint-disable-next-line no-console
      console.log(`Applied migration: ${fileName}`);
    }

    await connection.commit();

    if (pending.length === 0) {
      // eslint-disable-next-line no-console
      console.log('No pending migrations.');
    }
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exitCode = 1;
});
