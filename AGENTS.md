# Family Circle Bot

## Stack

- Node.js 22+ with pnpm, TypeScript strict mode, and a standard NestJS application.
- Add grammY, Prisma with SQLite, Anthropic SDK, Zod, and NestJS Scheduler only in their dedicated implementation stages.

## Architecture

- Keep Telegram handlers thin; application services own business logic.
- Keep Claude isolated behind an application-facing interface. It never accesses the database directly.
- Validate all tool inputs and AI outputs with Zod.
- Require explicit user confirmation before every write operation. AI greetings remain drafts until confirmation.
- Do not commit secrets, Telegram tokens, API keys, or local SQLite data.

## Delivery

- Work in small vertical slices; avoid Redis, Docker, PostgreSQL, microservices, and monorepos unless requirements change.
- Before handoff, run lint, tests, and build. Do not create git commits unless explicitly requested.
