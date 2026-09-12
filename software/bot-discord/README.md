# Multi-Bot Discord System

A comprehensive multi-bot Discord ecosystem built with TypeScript in a monorepo architecture for community moderation, entertainment, and utility.

![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![discord.js](https://img.shields.io/badge/discord.js-14-5865F2?logo=discord&logoColor=white)
![Prisma](https://img.shields.io/badge/Prisma-ORM-2D3748?logo=prisma&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-339933?logo=nodedotjs&logoColor=white)
![License](https://img.shields.io/badge/license-private-lightgrey)

## Table of Contents

1. [Features](#features)
2. [Screenshot](#screenshot)
3. [Getting Started](#getting-started)
4. [Usage](#usage)
5. [Directory Structure](#directory-structure)
6. [API Reference](#api-reference)
7. [Contributing](#contributing)
8. [License](#license)
9. [Contact](#contact)

## Features

- Unified Database Architecture: Shared PostgreSQL database with Prisma ORM.
- Event-Driven Coordination: Cross-bot communication via PostgreSQL LISTEN/NOTIFY.
- Monorepo Development: Efficient development with Turborepo and pnpm workspaces.
- Voice Processing: Advanced audio handling with ffmpeg and yt-dlp integration.
- AI Integration: Gemini AI for conversational interactions and auto-DJ functionality.
- Real-time Entertainment: Movie discovery, music streaming, and gaming features.

## Screenshot

![Discord Bot Ecosystem Demo](https://via.placeholder.com/800x450?text=Discord+Bot+Ecosystem+Demo)

## Getting Started

### Prerequisites

- Node.js 18 or higher
- PostgreSQL database
- pnpm package manager
- Discord Developer Portal application tokens

### Installation Steps

```bash
git clone https://github.com/hamin-baek/hamin-baek.git
cd software/bot-discord
pnpm install
pnpm run dev
```

### Configuration

Create a `.env` file in the root directory and configure the necessary credentials:
```env
DATABASE_URL=postgresql://user:password@localhost:5432/botdb
DISCORD_TOKEN_JULIAN=your_token_here
DISCORD_TOKEN_DIRGA=your_token_here
GEMINI_API_KEY=your_key_here
```

## Usage

Start the entire ecosystem in development mode:
```bash
pnpm run dev
```

To run a specific bot:
```bash
pnpm --filter julian dev
```

## Directory Structure

- `apps/`
  - `julian/`: Moderation and ticketing bot.
  - `dirga/`: AI companion bot.
  - `arka/`: Economy and leveling bot.
  - `kevin/`: Radio streaming bot.
  - `tidetunes/`: Music streaming bot.
  - `waveflix/`: Movie discovery bot.
- `packages/`
  - `database/`: Shared Prisma ORM models and client.
  - `eslint-config/`: Shared ESLint configurations.
  - `tsconfig/`: Shared TypeScript configurations.

## API Reference

This project interacts directly with the Discord API via discord.js. Internal database queries are handled through the shared Prisma client exported from `packages/database`.

## Contributing

Contributions are strictly managed. Please ensure all pull requests pass the internal linting and type checking processes before submission.

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Contact

Created by Achmad Miftahurrojak.
[GitHub](https://github.com/hamin-baek)
