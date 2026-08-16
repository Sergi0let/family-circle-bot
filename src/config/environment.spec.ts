import { validateEnvironment } from './environment';

describe('validateEnvironment', () => {
  it('uses safe local defaults', () => {
    expect(validateEnvironment({})).toMatchObject({
      ANTHROPIC_MODEL: 'claude-haiku-4-5',
      HOST: '0.0.0.0',
      NODE_ENV: 'development',
      PORT: 3000,
      TELEGRAM_TRANSPORT: 'polling',
    });
  });

  it('treats blank optional environment variables as unset', () => {
    expect(
      validateEnvironment({
        GOOGLE_CALENDAR_ID: '',
        GOOGLE_PUBLIC_HOLIDAYS_CALENDAR_ID: '   ',
        TELEGRAM_WEBHOOK_SECRET: '   ',
        TELEGRAM_WEBHOOK_URL: '',
      }),
    ).toMatchObject({
      GOOGLE_CALENDAR_ID: undefined,
      GOOGLE_PUBLIC_HOLIDAYS_CALENDAR_ID: undefined,
      TELEGRAM_WEBHOOK_SECRET: undefined,
      TELEGRAM_WEBHOOK_URL: undefined,
    });
  });

  it('rejects a production configuration without static bot settings', () => {
    expect(() => validateEnvironment({ NODE_ENV: 'production' })).toThrow(
      'GOOGLE_CALENDAR_ID must be set in production.',
    );
  });

  it('accepts the complete webhook production configuration', () => {
    expect(
      validateEnvironment({
        NODE_ENV: 'production',
        GOOGLE_CALENDAR_ID: 'family@example.com',
        GOOGLE_SERVICE_ACCOUNT_JSON_BASE64: 'encoded-credentials',
        TELEGRAM_BOT_TOKEN: 'token',
        TELEGRAM_CHAT_ID: '-1001234567890',
        TELEGRAM_TRANSPORT: 'webhook',
        TELEGRAM_WEBHOOK_URL: 'https://family.example.com',
        TELEGRAM_WEBHOOK_SECRET: 'a-secure-webhook-secret_123456789',
        PORT: '3000',
      }),
    ).toMatchObject({
      NODE_ENV: 'production',
      PORT: 3000,
      TELEGRAM_TRANSPORT: 'webhook',
    });
  });
});
