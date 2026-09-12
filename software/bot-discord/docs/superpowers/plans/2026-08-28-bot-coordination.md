# Bot Coordination Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add reliable, guild-scoped coordination between the six Discord bot processes using PostgreSQL outbox events and `LISTEN/NOTIFY`.

**Architecture:** PostgreSQL is the source of truth. State mutations and outbox rows are committed together; `NOTIFY` wakes consumers, and pending outbox polling recovers missed notifications. Each consumer has independent delivery state so fan-out acknowledgements do not interfere. A shared package exposes typed event contracts, publishing, subscription, retry, and idempotency helpers.

**Tech Stack:** TypeScript, pnpm workspaces, Prisma 5, PostgreSQL, `pg`, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-28-bot-coordination-design.md`

## Global Constraints

- Every event requires `guildId`.
- Event payloads are bounded and contain no secrets or full message/profile content.
- `NOTIFY` is never treated as durable delivery.
- Existing bot behavior remains unchanged until a pilot consumer is verified.
- Existing unrelated worktree changes must not be staged.

---

### Task 1: Add the outbox schema

**Files:**
- Modify: `packages/database/prisma/schema.prisma`
- Test: Prisma validation command

**Interfaces:**
- Produces immutable `OutboxEvent` with unique `id`, `type`, `guildId`, optional `entityId`, JSON `payload`, `version`, and timestamps.
- Produces `OutboxDelivery` with unique `(eventId, consumer)` and independent retry/processed state.

- [ ] **Step 1: Add the model without changing existing models.**
- [ ] **Step 2: Run `pnpm --filter @hamin/database exec prisma validate`.**
- [ ] **Step 3: Run `pnpm turbo run build --force`.**
- [ ] **Step 4: Commit only the schema change.**

### Task 2: Implement the typed event contract

**Files:**
- Create: `packages/database/events.ts`
- Modify: `packages/database/package.json`
- Modify: `pnpm-lock.yaml`
- Test: `packages/database/events.test.ts`

**Interfaces:**
- Produces `BotEvent`, `BotEventType`, `createEvent`, `serializeEvent`, and `parseEvent`.
- `serializeEvent` rejects payloads over 32 KiB and events without `guildId`.

- [ ] **Step 1: Add the failing contract tests.**
- [ ] **Step 2: Run the focused test and verify the expected failure.**
- [ ] **Step 3: Implement the minimal typed contract and size validation.**
- [ ] **Step 4: Run the focused test and the full build.**
- [ ] **Step 5: Commit the contract and dependency changes.**

### Task 3: Implement publish, listen, and retry recovery

**Files:**
- Create: `packages/database/eventBus.ts`
- Modify: `packages/database/package.json`
- Modify: `pnpm-lock.yaml`
- Test: `packages/database/eventBus.test.ts`

**Interfaces:**
- `publishEvent(prisma, event): Promise<void>` inserts an outbox row and issues `pg_notify` in the caller's transaction boundary.
- `startEventSubscriber(options): Promise<() => Promise<void>>` listens, drains pending events, retries connection failures, and returns shutdown.
- `markEventProcessed` and `markEventFailed` are idempotent.

- [ ] **Step 1: Add failing tests for duplicate processing and retry selection.**
- [ ] **Step 2: Run focused tests and verify expected failures.**
- [ ] **Step 3: Implement the dedicated listener connection and bounded pending-row drain.**
- [ ] **Step 4: Run focused tests, Prisma validation, and a fresh build.**
- [ ] **Step 5: Commit the event bus slice.**

### Task 4: Add one cross-bot pilot

**Files:**
- Modify: `apps/julian/src/index.ts`
- Modify: `apps/dirga/src/index.ts`
- Create: `packages/database/events/pilot.ts`
- Test: pilot handler unit test

**Interfaces:**
- Julian publishes `member.joined` with only `guildId` and member id.
- Dirga consumes `member.joined` to trigger its existing welcome behavior through a deduplicated handler.

- [ ] **Step 1: Add failing test proving duplicate `member.joined` is handled once.**
- [ ] **Step 2: Implement producer and consumer behind `BOT_EVENTS_ENABLED=false` default.**
- [ ] **Step 3: Run the focused test and fresh build.**
- [ ] **Step 4: Enable only in an integration environment after database verification.**
- [ ] **Step 5: Commit the pilot separately.**

### Task 5: Add operational checks and documentation

**Files:**
- Modify: `README.md`
- Modify: `.env.example`
- Create: `packages/database/events/health.ts`
- Test: health/reconnect unit tests

- [ ] **Step 1: Add reconnect, pending-count, and failed-count tests.**
- [ ] **Step 2: Implement health reporting without logging payloads.**
- [ ] **Step 3: Document `BOT_EVENTS_ENABLED`, rollout, retry limits, and recovery.**
- [ ] **Step 4: Run all tests, `pnpm turbo run build --force`, and Prisma validation.**
- [ ] **Step 5: Commit documentation and operational checks.**