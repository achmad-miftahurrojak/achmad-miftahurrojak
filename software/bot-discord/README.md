# Multi-Bot Discord System

![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![discord.js](https://img.shields.io/badge/discord.js-14-5865F2?logo=discord&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=nodedotjs&logoColor=white)
![License](https://img.shields.io/badge/license-private-lightgrey)

A comprehensive multi-bot Discord ecosystem built with TypeScript in a monorepo architecture. Six specialized Discord bots operate as independent applications, sharing a centralized PostgreSQL database through Prisma ORM for seamless inter-bot coordination.

## Table of Contents

- [Bot Ecosystem](#bot-ecosystem)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Quick Start](#quick-start)
- [Running Bots](#running-bots)
- [Project Structure](#project-structure)
- [Inter-Bot Coordination](#inter-bot-coordination)
- [Contributing](#contributing)
- [License](#license)

## Bot Ecosystem

| Bot           | Primary Function                                                             | Application Path |
| ------------- | ---------------------------------------------------------------------------- | ---------------- |
| **Julian**    | Moderation, anti-nuke protection, ticketing, verification, starboard         | `apps/julian`    |
| **Dirga**     | AI companion powered by Gemini, conversational chat, voice channel revival   | `apps/dirga`     |
| **Arka**      | XP & leveling system, virtual economy, quest system, mini-games, tournaments | `apps/arka`      |
| **Kevin**     | 24/7 lofi radio streaming service                                            | `apps/kevin`     |
| **TideTunes** | Music streaming (SoundCloud/Spotify) with AI-powered auto-DJ                 | `apps/tidetunes` |
| **WaveFlix**  | Movie discovery (TMDB integration), watch party scheduling, daily trending   | `apps/waveflix`  |

## Features

- **Unified Database Architecture**: Shared PostgreSQL database with Prisma ORM
- **Event-Driven Coordination**: Cross-bot communication via PostgreSQL LISTEN/NOTIFY
- **Monorepo Development**: Efficient development with Turborepo and pnpm workspaces
- **Voice Processing**: Advanced audio handling with ffmpeg and yt-dlp integration
- **AI Integration**: Gemini AI for conversational interactions and auto-DJ functionality
- **Real-time Entertainment**: Movie discovery, music streaming, and gaming features

## Tech Stack

- **Runtime**: Node.js 18+, TypeScript 5
- **Discord Integration**: discord.js 14, @discordjs/voice
- **Database**: PostgreSQL with Prisma ORM
- **Build System**: Turborepo, pnpm workspaces
- **Audio Processing**: ffmpeg, yt-dlp
- **AI Services**: Google Gemini API
- **External APIs**: TMDB (movies), SoundCloud, Spotify

## Prerequisites

- **Node.js 18+** and **pnpm 9+**
- **PostgreSQL** database (local or remote)
- **ffmpeg** in system PATH (required for voice bots: Kevin, TideTunes, Dirga)
- **yt-dlp** (required for music bots: Kevin, TideTunes)
- **API Keys**: Discord bot tokens, [Gemini AI](https://aistudio.google.com/), [TMDB](https://www.themoviedb.org/settings/api)

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Configure environment
cp .env.example .env
# Edit .env with your bot tokens and API keys

# 3. Initialize database
pnpm turbo run db:push

# 4. Build all applications
pnpm turbo run build
```

## Running Bots

Each bot operates as an independent process:

```bash
# Production mode
node apps/julian/dist/index.js
node apps/dirga/dist/index.js
node apps/arka/dist/index.js
node apps/kevin/dist/index.js
node apps/tidetunes/dist/index.js
node apps/waveflix/dist/index.js
```

```bash
# Development mode with auto-reload
pnpm --filter julian dev
pnpm --filter dirga dev
pnpm --filter arka dev
# etc.
```

## Project Structure

```
├── apps/                  # Bot applications (one per bot)
│   └── <bot>/src/
│       ├── index.ts       # Application entry point
│       ├── handler.ts     # Command loader and router
│       ├── commands/      # Slash command definitions
│       └── modules/       # Feature modules (automod, voice, etc.)
├── packages/
│   ├── database/          # Shared Prisma schema (@hamin/database)
│   └── utils/             # Common utilities (@hamin/utils)
└── data/                  # Static data (trivia questions, song databases)
```

## Inter-Bot Coordination

Bots communicate through PostgreSQL outbox pattern with LISTEN/NOTIFY for real-time events:

```env
BOT_EVENTS_ENABLED=true
```

The system implements:

- **Event Bus**: Reliable cross-bot message delivery
- **Retry Logic**: Automatic failure recovery with exponential backoff
- **Database Cursor**: Ensures message processing continuity across restarts
- **Delivery Isolation**: Separate processing queues per consumer bot

Deploy the outbox schema using `pnpm --filter @hamin/database db:push` before enabling the event system.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Ensure `pnpm turbo run build` passes
4. Submit a pull request

## License

Private project - all rights reserved. Not licensed for public use.
