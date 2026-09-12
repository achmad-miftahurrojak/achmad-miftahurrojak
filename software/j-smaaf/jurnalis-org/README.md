# J-SMAAF Jurnalis Organization

A centralized management and collaboration platform tailored for journalistic organizations and editorial workflows.

![Next.js](https://img.shields.io/badge/Next.js-14-000000?logo=nextdotjs&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Turborepo](https://img.shields.io/badge/Turborepo-2-EF4444?logo=turborepo&logoColor=white)

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

- Editorial Workflow Management: Track article pitches, drafts, and final publications.
- Organizational Tools: Built-in calendar, attendance tracking, and task delegation.
- Monorepo Architecture: Clean separation of web applications and shared packages using Turborepo.
- Type Safety: End-to-end TypeScript enforcement across all modules.

## Screenshot

![J-SMAAF Demo](https://via.placeholder.com/800x450?text=J-SMAAF+Demo)

## Getting Started

### Prerequisites

- Node.js 20 or higher
- npm package manager

### Installation Steps

```bash
git clone https://github.com/hamin-baek/hamin-baek.git
cd software/j-smaaf/jurnalis-org
npm install
```

### Configuration

Copy the `.env.example` files located in the respective `apps/` directories to `.env` and configure the necessary environmental variables.

## Usage

Start the development servers for all internal applications:
```bash
npm run dev
```

Build the applications for production deployment:
```bash
npm run build
```

## Directory Structure

- `apps/`: User-facing applications.
  - `web/`: Next.js frontend platform.
  - `api/`: Backend API services.
- `packages/`: Shared libraries and configurations.
  - `shared/`: Common constants, validation schemas, and types.

## API Reference

The `apps/api` directory provides RESTful endpoints for the web client. Detailed endpoint specifications are located within the `docs/` folder or available via the running API server interface.

## Contributing

Maintain strict typing standards. Verify that `npm run typecheck` and `npm run lint` execute successfully before initiating a pull request.

## License

This project is licensed under the MIT License.

## Contact

Created by Achmad Miftahurrojak.
[GitHub](https://github.com/hamin-baek)
