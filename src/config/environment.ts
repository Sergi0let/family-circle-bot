import { z } from 'zod';

const environmentSchema = z.object({
  DATABASE_URL: z.string().trim().min(1).optional(),
  GOOGLE_CALENDAR_TIME_ZONE: z.string().trim().min(1).default('Europe/Kyiv'),
  GOOGLE_SERVICE_ACCOUNT_JSON_BASE64: z.string().trim().min(1).optional(),
  HOST: z.string().trim().min(1).default('0.0.0.0'),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  TELEGRAM_BOT_TOKEN: z.string().trim().min(1).optional(),
});

export function validateEnvironment(config: Record<string, unknown>) {
  return environmentSchema.parse(config);
}
