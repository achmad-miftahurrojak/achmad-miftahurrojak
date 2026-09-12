# Bot Coordination Design

**Status:** Approved for implementation

## Goal

Allow Julian, Dirga, Arka, Kevin, TideTunes, and WaveFlix to coordinate through shared events while each bot keeps ownership of its own Discord features.

## Architecture

PostgreSQL remains the source of truth. Important state changes are written with an outbox record in the same database transaction. PostgreSQL `NOTIFY` wakes subscribers quickly, while the outbox allows polling and retry when a process is offline. A dedicated `pg` connection is used for `LISTEN`; Prisma remains the database query client.

Every event includes `id`, `type`, `guildId`, `entityId`, `version`, `payload`, and `createdAt`. `guildId` is required for server-scoped behavior. Each consumer has its own outbox delivery record, so one bot cannot acknowledge an event for another bot. Consumers must be idempotent using the event id and must not call another bot's internal functions.

## Ownership

- Julian owns moderation, automod, tickets, verification, logs, and member safety.
- Dirga owns AI chat, history, profiles, and revive.
- Arka owns XP, economy, games, quests, and leaderboards.
- Kevin and TideTunes own audio and voice sessions.
- WaveFlix owns film search and watch-party scheduling.

## Scale Requirements

- Do not fetch all 80k members for routine commands.
- Use database pagination for leaderboards and reports.
- Use shared rate limits for cross-process actions.
- Use bounded retries and record failed deliveries.
- Keep event payloads small and exclude tokens, message content, and sensitive profile data.

## Rollout and Compatibility

The first rollout is additive: create the outbox table and shared event module without changing current bot behavior. Existing bots can continue operating while only one pilot producer and consumer are enabled. Later migrations add `guildId` to server-scoped records before consumers depend on those records.

`NOTIFY` is a wake-up signal, not the durable delivery mechanism. A consumer that misses a notification must recover by polling pending outbox rows and creating its own delivery record. No destructive schema change is part of the first rollout.

## Failure Handling

Publishing and the state mutation must share one transaction. Delivery failures increment an attempt counter and retain the event for retry. Consumers acknowledge only after successful handling. Poison events are marked failed after the retry limit and logged with event id and type, never with secrets or full user content.

## Security

The event channel is local to the configured PostgreSQL connection. Payloads are validated before publication and bounded in size. Consumers authorize actions using the event's `guildId` and never treat a user-supplied payload as permission data.

## Verification

The implementation must provide unit tests for event serialization, payload limits, retry selection, and idempotency. Each slice must pass a fresh TypeScript build and Prisma schema validation. A database integration test is required before enabling durable consumers in production.