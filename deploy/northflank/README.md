# Northflank setup

## 1. Create the public service

1. Create a Northflank project and connect the GitHub repository.
2. Create a combined/build service from the `main` branch with CI/CD enabled.
3. Use the Node.js buildpack with these commands:

   ```text
   Build: pnpm install --frozen-lockfile && pnpm build
   Run:   pnpm start:prod
   ```

4. Expose port `3000` over HTTP and configure the readiness health check as `GET /health` on port `3000`.
5. Enable a Northflank public domain. Set `TELEGRAM_WEBHOOK_URL` to its HTTPS origin, without `/telegram/webhook`; the application appends that path itself.
6. Add all variables listed in the root [README](../../README.md) via a Northflank Secrets group. Never place the token or Google credentials in the repository.
7. Deploy. On a successful start the application calls Telegram `setWebhook` with the public endpoint and configured secret.

After deployment, verify:

```text
GET https://<public-northflank-domain>/health -> 200 {"status":"ok"}
POST https://<public-northflank-domain>/telegram/webhook without the secret -> 401
```

## 2. Create the calendar broadcast cron job

Create a cron job from the same Git repository, reuse the same secrets group, and configure:

```text
Build:              pnpm install --frozen-lockfile && pnpm build
Run:                pnpm cron:publish-calendar
Schedule (UTC):     0 5,6 * * *
Concurrency policy: Forbid
Retry limit:        1
Time limit:         120 seconds
```

Northflank cron schedules are UTC. The job runs at both candidate UTC times for Kyiv 08:00; the application sends messages only when the current Kyiv hour is 08. This avoids changing the schedule between winter and summer time.

Run it manually once after deployment and inspect the Northflank job log before activating the schedule.

## 3. Create the calendar verification cron job

This job provides a daily signal that Google credentials and calendar sharing remain valid. It sends no Telegram messages.

```text
Build:              pnpm install --frozen-lockfile && pnpm build
Run:                pnpm cron:verify-calendar
Schedule (UTC):     0 9 * * *
Concurrency policy: Forbid
Retry limit:        1
Time limit:         120 seconds
```

## Operational notes

- Use Northflank deployment and job logs as the source of truth for failures.
- Rotate `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, and the Google service-account key immediately if exposed.
- The Sandbox tier is appropriate for hobby/testing. It has no production SLA; use a paid plan and a monitored operational process for a service with availability requirements.
