import fs from 'node:fs/promises';
import path from 'node:path';
import mysql from 'mysql2/promise';
import { hashPassword } from '../../server/utils/passwords.js';

const LOCAL_TEST_HOSTS = new Set(['127.0.0.1', 'localhost', '::1']);
const MIGRATION_PATH = path.resolve(process.cwd(), 'server/db/migrations/0001_core.sql');

function buildAdminConfig() {
  return {
    host: process.env.TEST_DB_HOST || '127.0.0.1',
    port: Number(process.env.TEST_DB_PORT || 3306),
    user: process.env.TEST_DB_USER || 'root',
    password: process.env.TEST_DB_PASSWORD || ''
  };
}

function isLocalHost(host) {
  return LOCAL_TEST_HOSTS.has(String(host || '').toLowerCase());
}

function splitStatements(sql) {
  return sql
    .split(/;\s*\n/g)
    .map((statement) => statement.trim())
    .filter(Boolean);
}

async function runMigrations(connection) {
  const migrationSql = await fs.readFile(MIGRATION_PATH, 'utf8');
  const statements = splitStatements(migrationSql);

  for (const statement of statements) {
    await connection.query(statement);
  }
}

async function seedAuthFixtures(connection) {
  await connection.query(
    `INSERT INTO centers (id, slug, name, timezone, locale, status)
     VALUES (1, 'luna-it', 'Luna IT', 'America/La_Paz', 'es-BO', 'active')`
  );

  await connection.query(
    `INSERT INTO center_settings
      (center_id, brand_name, support_whatsapp_text, whatsapp_number)
     VALUES (1, 'Luna IT', 'Ayuda por WhatsApp', '59170000000')`
  );

  await connection.query(
    `INSERT INTO admin_users
      (center_id, full_name, email, password_hash, role, is_active)
     VALUES
      (1, 'Owner Test', 'owner@test.local', ?, 'owner', 1),
      (1, 'Inactive Test', 'inactive@test.local', ?, 'operator', 0)`,
    [hashPassword('demo-password-123'), hashPassword('inactive-password-123')]
  );
}

export async function setupIntegrationTestDb() {
  const adminConfig = buildAdminConfig();

  if (!isLocalHost(adminConfig.host) && process.env.ALLOW_NON_LOCAL_TEST_DB !== 'true') {
    return {
      ok: false,
      reason: `DB de integración bloqueada por seguridad: TEST_DB_HOST=${adminConfig.host}.`
    };
  }

  let adminConnection;
  try {
    adminConnection = await mysql.createConnection({
      host: adminConfig.host,
      port: adminConfig.port,
      user: adminConfig.user,
      password: adminConfig.password,
      multipleStatements: false
    });
  } catch (error) {
    return {
      ok: false,
      reason: `No se pudo conectar a MySQL local de pruebas (${adminConfig.host}:${adminConfig.port}): ${error.message}`
    };
  }

  const dbName = `agenda_luna_it_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  try {
    await adminConnection.query(`CREATE DATABASE \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await adminConnection.changeUser({ database: dbName });
    await runMigrations(adminConnection);
    await seedAuthFixtures(adminConnection);
  } catch (error) {
    try {
      await adminConnection.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
    } catch {
      // Ignore cleanup failures on setup errors.
    }
    await adminConnection.end();
    throw error;
  }

  const assertionPool = mysql.createPool({
    host: adminConfig.host,
    port: adminConfig.port,
    user: adminConfig.user,
    password: adminConfig.password,
    database: dbName,
    waitForConnections: true,
    connectionLimit: 4,
    queueLimit: 0,
    timezone: '-04:00',
    namedPlaceholders: true,
    dateStrings: true
  });

  const appEnv = {
    NODE_ENV: 'test',
    PORT: '0',
    DB_HOST: adminConfig.host,
    DB_PORT: String(adminConfig.port),
    DB_USER: adminConfig.user,
    DB_PASSWORD: adminConfig.password,
    DB_NAME: dbName,
    DB_CONNECTION_LIMIT: '10',
    DB_TIMEZONE: '-04:00',
    APP_TIMEZONE: 'America/La_Paz',
    JWT_SECRET: process.env.TEST_JWT_SECRET || 'agenda-luna-test-secret-12345',
    MESSAGING_PROVIDER: 'test_outbox',
    ENABLE_MOCK_FALLBACK: 'false',
    ENABLE_DEMO_SCHEDULE_FALLBACK: 'false'
  };

  const cleanup = async () => {
    await assertionPool.end();
    await adminConnection.changeUser({ database: 'information_schema' });
    await adminConnection.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
    await adminConnection.end();
  };

  return {
    ok: true,
    appEnv,
    assertionPool,
    credentials: {
      centerId: 1,
      email: 'owner@test.local',
      password: 'demo-password-123',
      inactiveEmail: 'inactive@test.local',
      inactivePassword: 'inactive-password-123'
    },
    cleanup
  };
}
