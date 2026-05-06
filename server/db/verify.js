import 'dotenv/config';
import { getPool } from './pool.js';
import { env } from '../utils/env.js';

const expectedTables = new Set([
  'schema_migrations',
  'centers',
  'center_settings',
  'files',
  'admin_users',
  'services',
  'therapists',
  'therapist_services',
  'rooms',
  'service_rooms',
  'resource_schedules',
  'resource_blocks',
  'clients',
  'appointments',
  'appointment_resource_claims',
  'payments',
  'wa_messages',
  'scheduled_jobs',
  'round_robin_state',
  'telegram_links',
  'audit_logs',
  'idempotency_keys'
]);

async function verify() {
  const pool = getPool();

  try {
    console.log('ENV_SAFE', JSON.stringify({
      DB_HOST: env.DB_HOST,
      DB_NAME: env.DB_NAME,
      NODE_ENV: env.NODE_ENV,
      MESSAGING_PROVIDER: env.MESSAGING_PROVIDER
    }, null, 2));

    const [pingRows] = await pool.query('SELECT 1 AS ok');
    console.log('DB_PING_OK', pingRows?.[0]?.ok === 1);

    const [tableRows] = await pool.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = ?
       ORDER BY table_name`,
      [env.DB_NAME]
    );

    const tables = tableRows.map((row) => row.table_name);
    const hasSchemaMigrations = tables.includes('schema_migrations');
    const unexpected = tables.filter((name) => !expectedTables.has(name));

    console.log('HAS_SCHEMA_MIGRATIONS', hasSchemaMigrations);
    console.log('TABLE_COUNT', tables.length);
    console.log('TABLES', JSON.stringify(tables));
    console.log('UNEXPECTED_TABLES', JSON.stringify(unexpected));

    if (unexpected.length > 0) {
      console.log('DB_SAFE_TO_MODIFY false');
      process.exitCode = 2;
      return;
    }

    console.log('DB_SAFE_TO_MODIFY true');
  } finally {
    await pool.end();
  }
}

verify().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
