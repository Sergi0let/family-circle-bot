# Family Circle Bot

Stateless Telegram bot for one family group. It reads a single Google Calendar, accepts updates through a Telegram webhook, and sends calendar announcements through Northflank cron jobs. It has no database, migrations, or persistent application state.

## Architecture

```text
Telegram ── HTTPS webhook ──> Northflank service ──> grammY handlers
                                             └──> Google Calendar API (read-only)

Northflank cron ──> one-shot Nest application context ──> Telegram Bot API
```

- `TELEGRAM_CHAT_ID` and `GOOGLE_CALENDAR_ID` define the only supported family group and calendar.
- `/calendar_today` only returns data in that configured Telegram group.
- Google credentials stay in environment secrets. The service account has only `calendar.events.readonly` and the calendar must be shared with it as **Reader**.
- The bot validates Telegram's webhook secret with a timing-safe comparison.
- Scheduled jobs are stateless. Northflank's `forbid` concurrency policy prevents overlapping runs.

## Local development

```bash
corepack enable
pnpm install --frozen-lockfile
cp .env.example .env
pnpm start:dev
```

Use `TELEGRAM_TRANSPORT=polling` locally. For webhook testing, expose the local server through a trusted HTTPS tunnel, set `TELEGRAM_TRANSPORT=webhook`, then set `TELEGRAM_WEBHOOK_URL` to the public tunnel URL.

Generate the Google secret value without creating a JSON key in the repository:

```bash
base64 -w0 service-account.json
```

## Northflank deployment

See [the exact Northflank setup](deploy/northflank/README.md). In short, create one public Git service and two cron jobs from this repository; do not create a database addon.

Required production variables:

```dotenv
NODE_ENV="production"
HOST="0.0.0.0"
PORT="3000"
TELEGRAM_TRANSPORT="webhook"
TELEGRAM_BOT_TOKEN="<BotFather token>"
TELEGRAM_WEBHOOK_URL="https://<public-northflank-domain>"
TELEGRAM_WEBHOOK_SECRET="<32+ random URL-safe characters>"
TELEGRAM_CHAT_ID="-1001234567890"
GOOGLE_CALENDAR_ID="family-calendar-id@group.calendar.google.com"
GOOGLE_SERVICE_ACCOUNT_JSON_BASE64="<base64 service account JSON>"
GOOGLE_CALENDAR_TIME_ZONE="Europe/Kyiv"
```

Generate the webhook secret with:

```bash
openssl rand -base64 48 | tr '+/' '-_' | tr -d '='
```

## Commands

```bash
pnpm check
pnpm cron:publish-calendar
pnpm cron:verify-calendar
```

`cron:publish-calendar` sends only when the job executes in the Kyiv 08:00 hour. Schedule it for both 05:00 and 06:00 UTC so it remains correct across daylight-saving changes; one of those two runs becomes a no-op. `cron:verify-calendar` only checks Google Calendar access and is safe to run daily.

## Limits of the database-free design

This version deliberately cannot support multiple groups, self-service calendar connection, delivery history, retries after a process crash, birthdays, or user-specific settings. Add PostgreSQL only when one of those requirements becomes real.
