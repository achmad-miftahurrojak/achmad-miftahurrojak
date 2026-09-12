# Hamin Bot Discord — Monorepo

## Tech Stack
- TypeScript (main), Python (legacy `bot-discord-python/`)
- Discord.js v14, Prisma ORM, PostgreSQL
- pnpm workspaces, nx-style monorepo
- @hamin/utils, @hamin/database — shared packages

## Structure
```
apps/              — Discord bot apps (each = 1 bot user)
  arka/            — Game/minigame bot (XP, absen, misi, toko, hunt, quiz)
  dirga/           — AI chat bot (Gemini API, obrolan, revive, profil)
  julian/          — Moderation bot (warn, ban, automod, tiket, voice)
  kevin/           — LoFi music 24/7
  tidetunes/       — Music request bot (/play)
  waveflix/        — Movie watch party bot
packages/
  utils/           — Shared utilities (logger, channels, config)
  database/        — Prisma schema, event bus, DB helpers
bot-discord-python/ — Legacy Python version (reference only)
docs/              — Superpowers specs & plans
data/              — Runtime JSON files (warns, locks, etc)
```

## Commands
- `pnpm install` — install all
- `pnpm dev` — run all in dev
- `pnpm build` — build all
- `cd apps/julian && pnpm dev` — run one bot
- `cd apps/julian && pnpm tsx src/index.ts` — run single TS

## Code Conventions
- One command per file in `apps/*/src/commands/`
- Modules (event handlers) in `apps/*/src/modules/`
- Handler pattern: export `{ name, data, executeSlash, executePrefix }`
- Event bus via `@hamin/database` for cross-bot events (`publishEvent`)
- Prisma for persistent data; JSON file fallback for legacy
- `logger` from `@hamin/utils` for all logging
- `CHANNELS` constant for channel ID references
- `isCommandAllowed(commandName, channelId, CHANNEL_RULES)` for channel gating

## Database (Prisma)
- Schema: `packages/database/prisma/schema.prisma`
- Models: User, Warn, Starboard, DirgaProfile, DirgaSettings, Ticket
- `prisma.$transaction` for multi-step writes
- `publishEvent(trx, event)` for cross-bot coordination

## Bot Communication
- `@hamin/database` event bus: bots publish events to DB, others poll
- `createEvent()` → `publishEvent()` → subscriber in each bot
- Event types: member.joined, level_up, timeout, untimeout, raid_on, afk_dipindah, voice_aktif

## Key IDs
- `CHANNELS.general`, `CHANNELS.moderator`, `CHANNELS.rules`, `CHANNELS.welcome`, `CHANNELS.logServer`, `CHANNELS.resources`
- See `packages/utils/src/index.ts` for channel/category map
- All IDs from .env or shared constants

## Boundaries
- Don't modify Python files unless porting to TS
- Don't touch `prisma.schema` without checking all apps
- Don't add npm deps without checking if `@hamin/*` has it
- Always run `pnpm build` after changing shared packages
- Voice channel IDs are locked per app (kevin=lofi, tidetunes=music)

## Fitur Status (Python→TS Migration)
| # | Fitur | Status |
|---|-------|--------|
| 1 | Raid detection auto-lockdown | Code exists but trigger not wired |
| 2 | Anti-nuke detection | Code exists but not wired |
| 3 | Warning expiry 30-day | Missing filter |
| 4 | Mute awareness Dirga | Missing event listener |
| 5 | Comeback bonus (Arka) | Pending |
| 6 | /tempban command | Pending |
| 7 | Context menu commands | Pending |
| 8 | Voice session persistence | Missing |
| 9 | Dirga read Arka server context | Missing |
| 10 | Welcome card animated GIF | Pending |

## Patterns
- `/absen` di Arka: call `getArkaGlobal()`, modify user data, call `setArkaGlobal()`
- Event listener: `eventBus.on('type', handler)` in module file
- Channel gating: `CHANNEL_RULES` const map in each bot's `index.ts`
- AFK voice: voice module tracks silent members → confirm button → move