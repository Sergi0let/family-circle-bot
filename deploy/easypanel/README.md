# Easypanel deployment

The deployment uses two Easypanel **App** services from the same repository:

- `family-circle-bot` receives Telegram webhooks.
- `family-circle-bot-cron` runs the daily calendar jobs inside a dedicated cron container.

No volume or database is needed. The bot is stateless.

## Prerequisites

1. Easypanel must have a public HTTPS domain. Telegram will not deliver webhooks to an untrusted HTTP endpoint.
2. The service account must have the **Reader** role on `GOOGLE_CALENDAR_ID` and, when used, `GOOGLE_PUBLIC_HOLIDAYS_CALENDAR_ID`.
3. Add the bot to the configured Telegram group. Set `TELEGRAM_CHAT_ID` to that group ID.

Generate the two secret values locally:

```bash
base64 -w0 service-account.json
openssl rand -base64 48 | tr '+/' '-_' | tr -d '='
```

## 1. Web service

Create an **App** service named `family-circle-bot`.

- **Source:** GitHub or Git repository, branch `master`, Build Path `/`.
- **Build:** Dockerfile, path `Dockerfile`.
- **Domain:** HTTPS, target port `3000`.
- **Deploy:** one replica; enable Easypanel's Tini option when it is available.

Set the following Environment values in Easypanel. Keep the actual values in its secret environment UI; never create an `.env` file in the repository.

```dotenv
NODE_ENV=production
HOST=0.0.0.0
PORT=3000
TELEGRAM_TRANSPORT=webhook
TELEGRAM_BOT_TOKEN=<BotFather token>
TELEGRAM_WEBHOOK_URL=https://<public-domain>
TELEGRAM_WEBHOOK_SECRET=<random URL-safe secret>
TELEGRAM_CHAT_ID=-1001234567890
GOOGLE_CALENDAR_ID=<family calendar ID>
GOOGLE_PUBLIC_HOLIDAYS_CALENDAR_ID=<optional holidays calendar ID>
GOOGLE_SERVICE_ACCOUNT_JSON_BASE64=<base64 service-account JSON>
GOOGLE_CALENDAR_TIME_ZONE=Europe/Kyiv
ANTHROPIC_API_KEY=<optional Anthropic key>
ANTHROPIC_MODEL=claude-haiku-4-5
```

Deploy the service. Its startup calls Telegram `setWebhook`, using the configured domain and secret.

Verify without exposing a secret:

```bash
curl --fail https://<public-domain>/health
curl --fail --request POST https://<public-domain>/telegram/webhook
```

The first command must return `{"status":"ok"}`. The second must return HTTP `401`.

## 2. Cron service

Create another **App** service named `family-circle-bot-cron` from the same repository.

- **Source:** same repository, branch, and Build Path `/`.
- **Build:** Dockerfile, path `Dockerfile.cron`.
- **No domain or exposed port.**
- **Deploy:** one replica. Do not use multiple replicas: they would send duplicate greetings.
- **Environment:** copy the complete environment from the web service, including `TELEGRAM_TRANSPORT=webhook`, `TELEGRAM_WEBHOOK_URL`, and `TELEGRAM_WEBHOOK_SECRET`. The worker does not activate a transport, but its production configuration validation requires these values.

The cron container uses UTC and runs:

- `06:30` and `07:30` UTC — publish greeting candidates. Application code permits the run only in Kyiv's 09:00 hour, which covers daylight-saving changes.
- `09:00` UTC — verify Google Calendar access; it sends no message.

Read the cron service logs after deployment. You can test the commands from the Easypanel Shell before relying on the schedule:

```bash
node dist/cron/verify-calendar.js
node dist/cron/publish-calendar.js
```

The broadcast command can send a Telegram message when run during the Kyiv 09:00 hour.

## Operations

- Enable GitHub auto-deploy only after the first manual deployment is healthy.
- Monitor both services: a healthy web service does not prove that the cron worker is running.
- Rotate the Telegram token, webhook secret, Google service-account key, and Anthropic key if they are exposed.
- The database-free design has no delivery ledger. A manually restarted or duplicated cron worker may re-send a greeting; keep exactly one cron replica.
