import { z } from 'zod';

const optionalText = z.preprocess(
  (value) =>
    typeof value === 'string' && value.trim().length === 0 ? undefined : value,
  z.string().trim().min(1).optional(),
);

const environmentSchema = z.object({
  ADMIN_API_TOKEN: optionalText,
  ANTHROPIC_API_KEY: optionalText,
  ANTHROPIC_MODEL: z.string().trim().min(1).default('claude-haiku-4-5'),
  DATABASE_URL: z.string().url().optional(),
  GOOGLE_CALENDAR_ID: optionalText,
  GOOGLE_PUBLIC_HOLIDAYS_CALENDAR_ID: optionalText,
  GOOGLE_CALENDAR_TIME_ZONE: z.string().trim().min(1).default('Europe/Kyiv'),
  GOOGLE_SERVICE_ACCOUNT_JSON_BASE64: optionalText,
  HOST: z.string().trim().min(1).default('0.0.0.0'),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  TELEGRAM_CHAT_ID: z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim().length === 0
        ? undefined
        : value,
    z
      .string()
      .trim()
      .regex(/^-?\d+$/u)
      .optional(),
  ),
  TELEGRAM_BOT_TOKEN: optionalText,
  TELEGRAM_TRANSPORT: z.enum(['polling', 'webhook']).default('polling'),
  TELEGRAM_WEBHOOK_SECRET: z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim().length === 0
        ? undefined
        : value,
    z
      .string()
      .regex(/^[A-Za-z0-9_-]{1,256}$/u)
      .optional(),
  ),
  TELEGRAM_WEBHOOK_URL: z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim().length === 0
        ? undefined
        : value,
    z.string().url().optional(),
  ),
});

export function validateEnvironment(config: Record<string, unknown>) {
  const environment = environmentSchema.parse(config);

  if (environment.NODE_ENV !== 'production') {
    return environment;
  }

  const requiredKeys = [
    'DATABASE_URL',
    'GOOGLE_CALENDAR_ID',
    'GOOGLE_SERVICE_ACCOUNT_JSON_BASE64',
    'TELEGRAM_BOT_TOKEN',
    'TELEGRAM_CHAT_ID',
  ] as const;

  for (const key of requiredKeys) {
    if (environment[key] === undefined) {
      throw new Error(`${key} must be set in production.`);
    }
  }

  if (environment.TELEGRAM_TRANSPORT !== 'webhook') {
    throw new Error('TELEGRAM_TRANSPORT must be webhook in production.');
  }

  if (
    environment.TELEGRAM_WEBHOOK_URL === undefined ||
    environment.TELEGRAM_WEBHOOK_SECRET === undefined
  ) {
    throw new Error(
      'TELEGRAM_WEBHOOK_URL and TELEGRAM_WEBHOOK_SECRET must be set in production.',
    );
  }

  return environment;
}
