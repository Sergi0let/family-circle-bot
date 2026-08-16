# Family Circle Bot

Stateless Telegram bot for one family group. It reads a family Google Calendar and, optionally, a separate public-holidays calendar; it accepts updates through a Telegram webhook and sends calendar greetings through Northflank cron jobs. It has no database, migrations, or persistent application state.

## Architecture

```text
Telegram ── HTTPS webhook ──> Northflank service ──> grammY handlers
                                             └──> Google Calendar API (read-only)
                                                  ├── family: PCU + birthdays
                                                  └── optional: public holidays

Northflank cron ──> one-shot Nest application context ──> Telegram Bot API
```

- `TELEGRAM_CHAT_ID` and `GOOGLE_CALENDAR_ID` define the only supported family group and its calendar. `GOOGLE_PUBLIC_HOLIDAYS_CALENDAR_ID` adds a read-only source for Ukrainian public holidays.
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

## Deployment

See the platform-specific setup guides:

- [Easypanel](deploy/easypanel/README.md)
- [Northflank](deploy/northflank/README.md)

Production variables:

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
GOOGLE_PUBLIC_HOLIDAYS_CALENDAR_ID="<optional Ukrainian public-holidays calendar ID>"
GOOGLE_SERVICE_ACCOUNT_JSON_BASE64="<base64 service account JSON>"
GOOGLE_CALENDAR_TIME_ZONE="Europe/Kyiv"
ANTHROPIC_API_KEY="<optional Anthropic API key>"
ANTHROPIC_MODEL="claude-haiku-4-5"
```

`ANTHROPIC_API_KEY` is optional: without it the scheduled greeting uses its deterministic fallback. All Google and Telegram variables above are required in production.

Generate the webhook secret with:

```bash
openssl rand -base64 48 | tr '+/' '-_' | tr -d '='
```

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

## Limits of the database-free design

This version deliberately cannot support multiple groups, self-service calendar connection, delivery history, retries after a process crash, or user-specific settings. Add PostgreSQL only when one of those requirements becomes real.
