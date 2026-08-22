# Family Circle Bot — Product Context and Delivery Roadmap

> **Status:** agreed product direction; implementation starts with Phase 1.  
> **Last updated:** 2026-08-22.  
> **Purpose:** this is the living source of truth for product decisions and the delivery order. Read it before starting a new task; update the status and decision log when a product decision or a phase changes.

## 1. Product goal

Family Circle Bot is a private Telegram bot for **one family group**. It should make important dates visible and warm, while keeping the group free from spam and protecting family data.

It has two distinct spaces:

- **Family group:** publishes an approved greeting and exposes a small set of group-safe commands.
- **Private chat with the bot:** access request, personal menu, birthdays, today’s holidays, help, and moderator tools.

The bot is not a general-purpose public calendar bot. A person must be approved before receiving family information in a private chat.

## 2. Non-negotiable product rules

1. The configured `TELEGRAM_CHAT_ID` is the only group where family announcements are sent.
2. Private access is denied by default. A Telegram numeric user ID identifies the account; an ID missing from the database creates a **pending access request**, not access.
3. Only an authorised administrator or moderator can approve or reject an access request through Telegram buttons.
4. Every operation that changes access, roles, birthday data, settings, or publishes a greeting requires an explicit confirmation action. In particular, an AI-generated greeting is always a draft until a moderator publishes it.
5. Calendar integrations are read-only. Claude/Anthropic receives only minimal, validated event data and never accesses the database.
6. Birthday dates and family relationships are private. Never expose full birth dates or user IDs in the group; show only the name and optional relationship necessary for a greeting.
7. Telegram handlers stay thin. Nest application services own authorisation, state transitions, validation, and side effects.

## 3. Roles and permissions

| Role            | Private functions                         | Can approve members | Can publish greetings | Can manage roles/settings |
| --------------- | ----------------------------------------- | ------------------- | --------------------- | ------------------------- |
| `PENDING` user  | Sees only request status and `/start`     | No                  | No                    | No                        |
| `ACTIVE` member | Today, birthdays, info                    | No                  | No                    | No                        |
| `MODERATOR`     | All member functions + moderation queue   | Yes                 | Yes                   | No                        |
| `ADMIN`         | All functions                             | Yes                 | Yes                   | Yes                       |
| `BLOCKED` user  | Receives a neutral access-denied response | No                  | No                    | No                        |

`ADMIN` is a role, not a Telegram group-admin check. At least one initial admin must be bootstrapped from a trusted environment variable or a one-off protected script; the first administrator cannot approve themselves through an empty system.

**Decision:** moderators manage daily operations; admins manage who may moderate, greeting settings, and data sources. A moderator must never be able to grant themselves admin rights.

## 4. Private-chat user journeys

### 4.1 `/start` and access request

1. A person opens a private chat and uses `/start`.
2. The bot reads `context.from.id` and looks up `TelegramUser.telegramUserId`.
3. If the record is `ACTIVE`, `MODERATOR`, or `ADMIN`, show the member menu.
4. If the record is `PENDING`, show “Заявка очікує на підтвердження” and a **Cancel request** button. Do not create duplicate moderator notifications.
5. If there is no record, show a short request preview with the person’s Telegram name and an **Send access request** button. Only after this confirmation create the `PENDING` record and notify moderators.
6. If the record is `BLOCKED`, show a neutral denial; do not reveal who blocked them or the family group details.

This extra confirmation before creating `PENDING` satisfies the project rule that a user-data write must be explicit. Telegram profile fields are only refreshed after the user confirms an access request or an authorised moderator performs an action.

### 4.2 Moderator request card

Every active moderator and admin receives a private card:

```text
Новий запит на доступ
Ім’я: Олена Петренко
Username: @olena (якщо є)
Telegram ID: 123456789

[✅ Прийняти] [❌ Відхилити]
```

- `Прийняти` opens a confirmation card: **Confirm approval** / **Back**.
- `Відхилити` opens a confirmation card: **Confirm rejection** / **Back**.
- The callback re-checks the actor’s role and current request state in the database. A stale or repeated tap is safe and reports that the request has already been handled.
- After approval, the requester receives a message that access is active and can press `/start` for the menu.
- After rejection, do not send a reason by default. The requester may submit a new request only after an admin resets the decision.

Use an opaque request ID in callback data, not a raw Telegram ID. All callback payloads must be length-limited and validated with Zod.

### 4.3 Member menu

The initial, useful private menu is intentionally small:

```text
[📅 Сьогодні] [🎂 Дні народження]
[ℹ️ Як користуватися]
```

For moderators and admins, add:

```text
[📝 Чернетки привітань] [👥 Запити на доступ]
```

Use commands as a reliable fallback for clients where keyboards are hidden:

| Command      | Access                   | Behaviour                                                                                          |
| ------------ | ------------------------ | -------------------------------------------------------------------------------------------------- |
| `/start`     | everyone in private chat | Identifies user and shows the appropriate screen                                                   |
| `/today`     | active members           | Today’s church, state and birthday occasions                                                       |
| `/birthdays` | active members           | Upcoming birthdays, paginated by month; no birth year/date unless a future privacy rule permits it |
| `/info`      | active members           | Brief use instructions and privacy notice                                                          |
| `/requests`  | moderators/admins        | Pending access requests                                                                            |
| `/drafts`    | moderators/admins        | Greeting drafts waiting for review                                                                 |

`/calendar_today` remains a temporary technical group command during migration. Its member-facing replacement is `/today` in private chat. A later decision may retain a group-safe `/today` that lists public occasions only.

## 5. Greetings in the family group

### 5.1 Recognised categories and visual language

| Category                       | Calendar recognition                                       | Default visual style                        | Example opening                                          |
| ------------------------------ | ---------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------- |
| Church holiday                 | All-day event whose `iCalUID` starts with `pcu-`           | `🕊️ 🙏 ✨` — dove is the leading symbol     | `🕊️ Зі світлим святом…`                                  |
| Birthday                       | All-day family event titled `День народження: Ім’я         | ким доводиться`                             | `🎂 🌷 🎉 🥂` — flowers, celebration, optional champagne | `🎂 Вітаємо [ім’я] з Днем народження!` |
| Ukrainian state/public holiday | All-day event from the configured public-holidays calendar | `🇺🇦` plus a holiday-specific thematic emoji | `🇺🇦 З Днем Незалежності України!`                        |

The emoji set is a **default template**, not a random mandatory list. Use one to three relevant emoji per greeting, avoid emoji walls, and use the Ukrainian flag only for Ukrainian state/public occasions. Church greetings should not mix in champagne or fireworks.

### 5.2 Greeting lifecycle

```text
Read configured calendars (read-only)
  → classify and validate event
  → moderator asks for /drafts or taps “Create draft”
  → template or Claude generates a validated draft
  → moderator previews it privately
  → [Publish to group] → [Confirm publish]
  → send exactly one message to the configured group
  → record delivery to prevent duplicates
```

- Daily automation may **detect** occasions, but it must not directly post to the family group.
- The first release should create deterministic template drafts. Claude is an optional enhancement for a warmer text, not a dependency for delivery.
- Claude output is limited to 500 characters, must pass Zod validation, and must not invent facts, prayers, personal history, or a birth date.
- A moderator can skip a draft. Regeneration is a separate explicit action and creates a new revision.
- Before publishing, verify that the event date, configured group, draft status, and moderator permission are still valid. Record an idempotency key based on event/date/category to prevent double sends.

**Important implementation correction:** the current cron service sends greetings immediately. Replace that direct send with draft discovery/review before enabling the new workflow; it conflicts with the explicit-confirmation rule.

### 5.3 Calendar source of truth

- Church holidays: current PCU import in the family Google Calendar.
- Birthdays: initially the family Google Calendar, using the existing title pattern. Later move to a dedicated `BirthdayProfile` model only if private editing and consent are needed.
- State holidays: a separate configured Ukrainian public-holidays Google Calendar, shared read-only with the service account.

When two sources create the same occasion, render a single draft per category/event identifier. Do not infer a church holiday from its visible title: use the imported PCU event identifier.

## 6. Data model direction

Keep the existing `TelegramUser` identity data, but evolve access and authorisation explicitly.

```text
TelegramUser
  id, telegramUserId, privateChatId, profile fields
  status: PENDING | ACTIVE | BLOCKED
  role: MEMBER | MODERATOR | ADMIN

AccessRequest
  id, applicantUserId, status: PENDING | APPROVED | REJECTED | CANCELLED
  requestedAt, decidedAt, decidedByUserId

GreetingDraft
  id, sourceEventId, occurrenceDate, kind, text, revision
  status: DRAFT | PUBLISHED | SKIPPED | EXPIRED
  createdByType, reviewedByUserId, publishedAt

GreetingDelivery
  id, greetingDraftId, targetChatId, telegramMessageId, publishedByUserId
  unique(targetChatId, sourceEventId, occurrenceDate)

AuditLog
  id, actorUserId, action, targetType, targetId, metadata, createdAt
```

Do not create all tables in one migration. Add them with the phase that uses them. `AccessRequest` is useful even though `TelegramUser.status` exists: it gives audit history and makes callback actions idempotent.

Birthday data should stay in Google Calendar for the MVP; it avoids duplicate data entry. If a future `BirthdayProfile` is added, store day/month and an optional relation, omit the year by default, and obtain the person’s consent before a moderator adds or edits it.

## 7. Delivery plan — small vertical slices

| Phase                          | Outcome                                         | Main work                                                                                                    | Acceptance criteria                                                                                   | Status       |
| ------------------------------ | ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ------------ |
| 0. Baseline                    | Safe shared direction                           | Add this document; reconcile runtime/database documentation                                                  | No code change; open decisions are recorded                                                           | **Complete** |
| 1. Access via Telegram         | No manual API approval required                 | Roles, `AccessRequest`, `/start`, request and approve/reject confirmation buttons, bootstrap admin           | Unknown user cannot access data; a moderator can approve safely from Telegram                         | Pending      |
| 2. Private member menu         | Members can get useful information              | `/today`, `/birthdays`, `/info`, inline keyboard, private authorisation guard                                | Pending/blocked users receive no family events; active member sees correct data                       | Pending      |
| 3. Moderated greeting workflow | Greetings are reviewed before group publication | `GreetingDraft`, `GreetingDelivery`, `/drafts`, preview/publish/confirm/skip; convert cron to discovery only | No greeting reaches group without explicit moderator confirmation; duplicate publishing is impossible | Pending      |
| 4. Greeting quality            | Consistent localised tone                       | Category templates, emoji policy, optional Claude revisions, validation and fallback                         | Each category has the agreed visual style; invalid AI output never publishes                          | Pending      |
| 5. Administration              | Sustainable operation                           | Role management, calendar/settings view, audit log, block/unblock                                            | Only admins change roles/settings; key actions are auditable                                          | Pending      |
| 6. Hardening                   | Reliable deployment                             | Tests, error UX, rate limits, Telegram callback protection, operational runbook                              | `pnpm check` passes; retries do not duplicate effects                                                 | Pending      |

For every phase: write/update tests first or alongside code, run `pnpm check` before handoff, and do not commit secrets, Telegram tokens, API keys, or database files.

## 8. Technical implementation rules

- Nest application services own: `AccessRequestService`, `MemberAccessService`, `GreetingDraftService`, `GreetingPublicationService`, and authorisation policies. grammY handlers only map updates to these services and render replies.
- Use Prisma transactions for a decision/publish state transition plus its audit entry. Telegram sending happens after a state is reserved; recover from an API failure with a retry-safe status rather than a second publication.
- Do not trust callback data, Telegram username, or client-side keyboard visibility for authorisation. Look up the actor by `context.from.id` every time.
- Add a rate limit for new access requests and callback actions. Avoid logging full profile data or tokens.
- Prefer a single database provider per deployment. **Current repository reality:** Prisma is configured for PostgreSQL even though the project-level stack note mentions SQLite. Do not switch providers inside a feature phase; make one explicit deployment decision first and update README, schema, Docker/deployment guides, and migrations together.
- Keep the Google service account `Reader` only. It must never write, delete, or edit calendar entries.

## 9. Tests required by the roadmap

| Area                 | Examples                                                                                                                                                        |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Access               | unknown → request confirmation → pending; pending re-start has no duplicate request; approval/rejection only by staff; stale callback safe; blocked user denied |
| Authorisation        | member cannot open `/requests` or `/drafts`; moderator cannot assign admin; configured group is the only publish target                                         |
| Calendar and display | correct category/classification; no birthdays leaks a year; empty today state; pagination is stable                                                             |
| Drafts               | invalid Claude response falls back to template; publish requires a second confirmation; skip works; duplicate click/event cannot send twice                     |
| Integration          | grammY callback and command wiring; Prisma transaction behavior; Telegram API failure/retry behavior                                                            |

## 10. Decisions still needed before implementation

1. **Initial admins:** which Telegram user IDs should be bootstrapped as the first `ADMIN` users?
2. **Moderation SLA:** should the bot send a reminder if an access request or greeting draft has waited, for example, 24 hours?
3. **Birthdays view:** show the next 30 days, the next 12 months, or both? Recommended MVP: the next 30 days plus a month selector.
4. **Greeting timing:** when should the bot make a day’s candidate available to moderators? Recommended: 09:00 Kyiv, with manual publishing at any time.
5. **State holidays:** which Ukrainian public-holidays calendar is trusted and shared with the Google service account?
6. **Database provider:** retain the existing PostgreSQL deployment, or deliberately migrate the project to SQLite for a single-instance deployment? Recommended: retain PostgreSQL until a separate, tested migration is planned.

## 11. Decision log

| Date       | Decision                                                                                             | Reason                                                                                        |
| ---------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| 2026-08-22 | Group publications require moderator confirmation; scheduled jobs only discover candidate occasions. | Protects against wrong AI text and meets the explicit-confirmation requirement.               |
| 2026-08-22 | The MVP reads birthdays from the existing family Google Calendar.                                    | Avoids duplicate data sources and a private-data migration before the member value is proven. |
| 2026-08-22 | Separate `ADMIN` and `MODERATOR` roles.                                                              | Delegates routine requests without giving away role and settings control.                     |
