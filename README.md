# Family Circle Bot

Telegram bot for family-group calendar announcements. It reads a dedicated Google Calendar and posts each event scheduled for the current Kyiv day at 08:00; it never writes to Google Calendar.

## Runtime architecture

```text
Telegram group ──> grammY handlers ──> application services ──> Prisma / SQLite
                                      └──────────────────────> Google Calendar API (read-only)

Nest Scheduler ──> delivery claim in SQLite ──> Telegram Bot API
```

- Telegram handlers only parse commands and render replies.
- Any write requires an explicit confirmation callback before reaching an application service.
- Calendar credentials are decoded and validated in the Google adapter; that adapter has no database access.
- A unique SQLite constraint atomically claims a notification, preventing duplicate broadcasts from concurrent runs. A failed Telegram call releases the claim for retry.

## Prerequisites

- Node.js 22+ and Corepack
- pnpm 9.15.9+
- A Telegram bot token from BotFather
- A Google Cloud service account with Google Calendar API enabled

Create a dedicated family calendar and share it with the service-account email using the **Reader** role. The bot uses only `calendar.events.readonly` and cannot alter the calendar.

## Configuration

```bash
cp .env.example .env
base64 -w0 service-account.json
```

Set `GOOGLE_SERVICE_ACCOUNT_JSON_BASE64` to the generated one-line value, and never put the original JSON key in the repository. The minimum production configuration is:

```dotenv
NODE_ENV="production"
HOST="127.0.0.1"
PORT="3000"
DATABASE_URL="file:/var/lib/family-circle-bot/family-circle.db"
TELEGRAM_BOT_TOKEN="<token>"
GOOGLE_SERVICE_ACCOUNT_JSON_BASE64="<base64 JSON>"
GOOGLE_CALENDAR_TIME_ZONE="Europe/Kyiv"
```

`DATABASE_URL` must point to durable storage. Do not use a database inside an ephemeral deployment directory. Keep `.env` owner-readable only (`chmod 600 .env`).

## Local development

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm prisma:migrate
pnpm start:dev
```

In a Telegram group:

```text
/start
/calendar_connect family-calendar-id@group.calendar.google.com
/calendar_today
```

Only a group administrator can activate the bot or create and confirm `/calendar_connect` drafts. A connection draft lasts five minutes and the same administrator must confirm it before the calendar ID is saved.

## Production release

```bash
pnpm install --frozen-lockfile
pnpm check
pnpm prisma:migrate:deploy
pnpm build
NODE_ENV=production pnpm start:prod
```

`GET /health` is a readiness endpoint: it returns `200` only after the Telegram long-polling process is running. Bind the HTTP listener to loopback unless a reverse proxy needs access. Run a single application instance with SQLite; horizontal scaling needs a shared database and a proper outbox/worker design.

For Ubuntu, use the [systemd unit template](deploy/systemd/family-circle-bot.service.example). Create a dedicated `family-circle` system user, keep the environment file at `/etc/family-circle-bot/environment` with mode `0600`, and make `/var/lib/family-circle-bot` owned by that user before enabling the service.

## Quality gates

```bash
pnpm check
pnpm audit --prod --audit-level=high
```

`pnpm check` runs formatting verification, lint, unit tests, e2e tests, Prisma client generation, and the Nest build.
