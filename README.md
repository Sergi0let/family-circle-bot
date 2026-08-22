# Family Circle Bot

Telegram bot for one family group. It reads a family Google Calendar and, optionally, a separate public-holidays calendar; it accepts updates through a Telegram webhook, stores private-chat registration requests in PostgreSQL, and sends calendar greetings through Northflank cron jobs.

## Product direction and roadmap

The agreed functionality, roles, Telegram flows, greeting policy, data-model direction, and phased implementation order are maintained in [docs/PRODUCT-ROADMAP.md](docs/PRODUCT-ROADMAP.md). Read it before taking the next feature task. It also records the intentional upcoming change from direct scheduled greeting publication to a moderator-approved draft workflow.

## Architecture

```text
Telegram ── HTTPS webhook ──> Northflank service ──> grammY handlers
                                             ├──> PostgreSQL (users)
                                             └──> Google Calendar API (read-only)
                                                  ├── family: PCU + birthdays
                                                  └── optional: public holidays

Northflank cron ──> one-shot Nest application context ──> Telegram Bot API
```

- `TELEGRAM_CHAT_ID` and `GOOGLE_CALENDAR_ID` define the only supported family group and its calendar. `GOOGLE_PUBLIC_HOLIDAYS_CALENDAR_ID` adds a read-only source for Ukrainian public holidays.
- `/calendar_today` only returns data in that configured Telegram group.
- Google credentials stay in environment secrets. The service account has only `calendar.events.readonly` and the calendar must be shared with it as **Reader**.
- The bot validates Telegram's webhook secret with a timing-safe comparison.
- `POST /api/users` is protected by `ADMIN_API_TOKEN`; it activates a private-chat user without exposing calendar data publicly.
- Northflank's `forbid` concurrency policy prevents overlapping scheduled runs.

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

## Deployment

See the platform-specific setup guides:

- [Easypanel](deploy/easypanel/README.md)
- [Northflank](deploy/northflank/README.md)

Production variables:

```dotenv
NODE_ENV="production"
HOST="0.0.0.0"
PORT="3000"
DATABASE_URL="postgresql://<Northflank-user>:<password>@<private-host>:5432/<database>"
ADMIN_API_TOKEN="<random secret for the user-management API>"
TELEGRAM_TRANSPORT="webhook"
TELEGRAM_BOT_TOKEN="<BotFather token>"
TELEGRAM_WEBHOOK_URL="https://<public-northflank-domain>"
TELEGRAM_WEBHOOK_SECRET="<32+ random URL-safe characters>"
TELEGRAM_CHAT_ID="-1001234567890"
GOOGLE_CALENDAR_ID="family-calendar-id@group.calendar.google.com"
GOOGLE_PUBLIC_HOLIDAYS_CALENDAR_ID="<optional Ukrainian public-holidays calendar ID>"
GOOGLE_SERVICE_ACCOUNT_JSON_BASE64="<base64 service account JSON>"
GOOGLE_CALENDAR_TIME_ZONE="Europe/Kyiv"
ANTHROPIC_API_KEY="<optional Anthropic API key>"
ANTHROPIC_MODEL="claude-haiku-4-5"
```

`ANTHROPIC_API_KEY` is optional: without it the scheduled greeting uses its deterministic fallback. All Google and Telegram variables above are required in production.

`DATABASE_URL` is also required in production. Link the Northflank PostgreSQL `POSTGRES_URI` into a runtime Secret group with the alias `DATABASE_URL`; do not manually paste a database password into the repository.

Generate the webhook secret with:

```bash
openssl rand -base64 48 | tr '+/' '-_' | tr -d '='
```

Generate a separate `ADMIN_API_TOKEN` with the same command and add it as a runtime secret available to the public service only.

## PostgreSQL migrations

The first migration creates `telegram_users` with `PENDING`, `ACTIVE`, and `BLOCKED` states. The production Docker image runs `prisma migrate deploy` before NestJS starts, so deploy the **service first** after merging a migration. The cron jobs reuse the image but their custom commands do not run migrations.

Local commands:

```bash
pnpm prisma:generate
pnpm prisma:migrate:deploy
```

For local migration authoring, point `DATABASE_URL` to a disposable local PostgreSQL database and use `pnpm prisma migrate dev --name <migration-name>`. Do not run `migrate dev` against Northflank production data.

## Private-user registration and admin API

1. A person opens a private chat with the bot and sends `/start`.
2. The bot stores their profile as `PENDING` and replies with their Telegram numeric ID. A pending record has no access to family calendar data.
3. An administrator activates the record with the protected API:

```bash
curl --fail --request POST 'https://<public-northflank-domain>/api/users' \
  --header 'Authorization: Bearer <ADMIN_API_TOKEN>' \
  --header 'Content-Type: application/json' \
  --data '{"telegramUserId":"123456789","firstName":"Іван"}'
```

The request is idempotent: it creates the user if absent or changes an existing `PENDING` record to `ACTIVE`. The API accepts `telegramUserId`, and optionally `privateChatId`, `firstName`, `lastName`, and `username`. After activation the person sends `/start` again and receives the active-profile response.

## Greeting sources and formats

Every day at 09:30 Kyiv the cron reads the calendars and sends one message for each recognized all-day event:

- PCU church holiday — imported event with an `iCalUID` beginning with `pcu-`.
- Birthday in the family calendar — use `🎂 День народження: Ім’я | ким доводиться`. The `| ким доводиться` part is optional. The legacy forms `день Ім’я` and `день народження Ім’я` are still accepted.
- Public holiday — an all-day event from `GOOGLE_PUBLIC_HOLIDAYS_CALENDAR_ID`.

Google's visible **Holidays** overlay is a separate calendar, not an event inside the family calendar. Set `GOOGLE_PUBLIC_HOLIDAYS_CALENDAR_ID` to a calendar the service account can read; otherwise the bot cannot see those displayed state holidays. The daily verification job checks both configured calendars.

Claude receives only a validated event type, title, birthday name, and optional relationship. Its structured output is validated with Zod and limited to 500 characters. If Claude is temporarily unavailable, the job uses a short deterministic fallback so the greeting is still sent.

## Commands

```bash
pnpm check
pnpm cron:publish-calendar
pnpm cron:verify-calendar


```

`cron:publish-calendar` is scheduled for 09:30 Kyiv time and only sends when it executes in the Kyiv 09:00 hour. Schedule it for both 06:30 and 07:30 UTC so it remains correct across daylight-saving changes; one of those two runs becomes a no-op. `cron:verify-calendar` only checks Google Calendar access and is safe to run daily.

## Current limits

The first database slice stores user access state only. It does not yet implement private calendar views, an allowlisted birthday list, delivery history, or the one-per-day LLM forecast cache. Those features should use `ACTIVE` users as the authorization boundary.

## DB migration local

```
pnpm prisma:generate
pnpm prisma:migrate:deploy
pnpm start:dev
```
