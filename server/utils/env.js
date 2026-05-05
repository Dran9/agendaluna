import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DB_HOST: z.string().min(1).default('127.0.0.1'),
  DB_PORT: z.coerce.number().int().min(1).max(65535).default(3306),
  DB_USER: z.string().min(1).default('root'),
  DB_PASSWORD: z.string().default(''),
  DB_NAME: z.string().min(1).default('agenda_luna'),
  DB_CONNECTION_LIMIT: z.coerce.number().int().min(1).max(50).default(10),
  DB_TIMEZONE: z.string().default('-04:00'),
  JWT_SECRET: z.string().min(16).default('agenda-luna-dev-secret-change-me'),
  MESSAGING_PROVIDER: z.string().default('test_outbox'),
  WA_TOKEN: z.string().optional().default(''),
  WA_PHONE_ID: z.string().optional().default(''),
  WA_VERIFY_TOKEN: z.string().optional().default(''),
  META_APP_SECRET: z.string().optional().default(''),
  GOOGLE_VISION_API_KEY: z.string().optional().default(''),
  TELEGRAM_BOT_TOKEN: z.string().optional().default('')
});

const parsed = EnvSchema.safeParse(process.env);

if (!parsed.success) {
  const issues = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('\n');
  throw new Error(`Invalid environment configuration:\n${issues}`);
}

function normalizeNodeEnv(rawValue) {
  const normalized = String(rawValue || 'development').toLowerCase();
  if (['development', 'test', 'production'].includes(normalized)) {
    return normalized;
  }
  return 'development';
}

function normalizeMessagingProvider(rawValue) {
  const normalized = String(rawValue || 'test_outbox').toLowerCase();
  if (['test_outbox', 'whatsapp_live', 'log_only'].includes(normalized)) {
    return normalized;
  }
  return 'test_outbox';
}

export const env = {
  ...parsed.data,
  NODE_ENV: normalizeNodeEnv(parsed.data.NODE_ENV),
  MESSAGING_PROVIDER: normalizeMessagingProvider(parsed.data.MESSAGING_PROVIDER)
};
