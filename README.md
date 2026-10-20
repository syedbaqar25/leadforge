# Leadforge

Leadforge is an AI-augmented, multi-tenant B2B sales acceleration and lead intelligence platform designed for high-performing go-to-market teams. Built on an **Editorial Paper** design system, Leadforge balances tactile typography, clarity of information hierarchy, and autonomous background automation to streamline prospecting, enrichment, outreach, and pipeline execution.

> **Notice Regarding Branding & Trademarks:**
> The source code of this software is licensed under the [MIT License](LICENSE). However, the **Leadforge** name, trademarks, logos, branding assets, and distinctive visual design elements are NOT covered by the MIT License and remain the exclusive intellectual property of **Sayed Baqar Abbas**. You may not use the Leadforge trademark or brand assets in derivative products without prior written permission.

---

## Tech Stack Overview

| Tier                | Technology                                    | Purpose                                                              |
| :------------------ | :-------------------------------------------- | :------------------------------------------------------------------- |
| **Monorepo**        | pnpm workspaces                               | Package management and workspace isolation                           |
| **Frontend**        | Next.js 14+ (App Router), React, Tailwind CSS | Editorial Paper interface, SSR & static generation                   |
| **Backend API**     | NestJS                                        | Modular monolith application architecture                            |
| **Worker Engine**   | BullMQ & Redis 7                              | Distributed job execution, delayed processing, rate limits           |
| **Database**        | PostgreSQL 16 + `pgvector`                    | Relational persistence and high-dimensional vector embeddings        |
| **ORM**             | Prisma ORM                                    | Strongly-typed schema modeling and migration tooling                 |
| **Workflow Engine** | n8n                                           | Orchestration and webhook integration workflows                      |
| **Design System**   | Editorial Paper                               | `Playfair Display` + `Source Sans 3` + Lucide Icons (`1.5px` stroke) |
| **Email Testing**   | Mailpit                                       | Local SMTP capture and web UI inbox inspector                        |

---

## Prerequisites

Before setting up Leadforge locally, verify your machine meets these requirements:

- **Node.js**: `v20.0.0` or higher (LTS recommended)
- **pnpm**: `v9.15.4` or higher (`corepack enable && corepack prepare pnpm@9.15.4 --activate`)
- **Docker & Docker Compose**: Docker Engine 24+ or Docker Desktop with Compose v2+
- **Git**: 2.30+

---

## Zero Default Credentials Policy

Leadforge follows a strict **Zero Default Credentials** security model:

- **No hardcoded secrets or production credentials exist in this repository.**
- All sensitive configurations are managed through external environment variables.
- The `.env.example` file contains strictly dummy placeholder values (`CHANGE_ME_...`).
- Any pre-configured local development credentials (such as those in `docker/docker-compose.dev.yml`) are restricted to localhost loopback interfaces (`127.0.0.1`) and are strictly intended for offline local development and testing. **Never use local dev credentials in staging or production environments.**

### Third-Party Provider Credentials

Self-hosters and deploying organizations must supply their own operational API keys and OAuth client credentials:

- **OpenAI**: API key for embeddings (`text-embedding-3-small`) and reasoning (`gpt-4o`)
- **Google Cloud Console**: OAuth credentials for Gmail integration
- **Meta for Developers**: App secrets and tokens for WhatsApp Business API
- **Amazon Web Services (AWS)**: IAM credentials and S3 bucket if opting for cloud object storage
- **Razorpay / Stripe**: Payment gateway keys (feature-flagged)

---

## Quick Start (Local Development)

Follow these steps to run Leadforge in local development mode:

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/leadforge.git
cd leadforge
```

### 2. Configure environment variables

Copy the sample environment file:

```bash
cp .env.example .env
```

Update `.env` with your specific local configuration if needed.

### 3. Start local development infrastructure

Launch PostgreSQL (with pgvector), Redis, Mailpit, and n8n via Docker Compose:

```bash
docker compose -f docker/docker-compose.dev.yml up -d
```

Verify container status:

```bash
docker compose -f docker/docker-compose.dev.yml ps
```

Local services will be available on loopback:

- **PostgreSQL**: `127.0.0.1:5432`
- **Redis**: `127.0.0.1:6379`
- **Mailpit Web UI**: [http://127.0.0.1:8025](http://127.0.0.1:8025) (SMTP on `127.0.0.1:1025`)
- **n8n Web UI**: [http://127.0.0.1:5678](http://127.0.0.1:5678) (Credentials: `admin` / `leadforge_dev_only`)

### 4. Install dependencies

```bash
pnpm install
```

### 5. Generate database client and run migrations

```bash
pnpm run db:generate
pnpm run db:migrate
```

### 6. Seed development data (Development Only)

> **Note:** Demo/seed mode is strictly for local development and demonstration. Seed scripts populate synthetic demo accounts and sample lead records. Never run seed scripts against production databases.

```bash
pnpm run db:seed
```

### 7. Run development servers

Start the API, Web, and Worker apps concurrently:

```bash
pnpm run dev
```

- **Web Application**: [http://localhost:3000](http://localhost:3000)
- **API Server**: [http://localhost:4000](http://localhost:4000)
- **API Health Check**: [http://localhost:4000/api/v1/health](http://localhost:4000/api/v1/health)

---

## Project Structure Overview

```text
leadforge/
├── .github/
│   ├── workflows/
│   │   ├── ci.yml               # Automated CI pipeline (lint, typecheck, test, build)
│   │   └── security.yml         # Gitleaks secret scanning & dependency vulnerability audit
│   └── CODEOWNERS               # Primary repository codeowners
├── apps/
│   ├── api/                     # NestJS modular monolith API application
│   ├── web/                     # Next.js 14+ App Router frontend
│   └── worker/                  # BullMQ background job worker
├── docker/
│   ├── docker-compose.dev.yml   # Local development infrastructure (Postgres, Redis, Mailpit, n8n)
│   ├── Dockerfile.api           # Multi-stage production build for API service
│   ├── Dockerfile.web           # Multi-stage production build for Next.js web application
│   └── Dockerfile.worker        # Multi-stage production build for BullMQ worker
├── docs/
│   ├── DECISIONS.md             # Architecture Decision Records (ADRs)
│   ├── DESIGN_SYSTEM.md         # Editorial Paper design tokens and UI architecture
│   ├── PROGRESS.md              # Project milestone tracking and implementation progress
│   ├── KNOWN_GAPS.md            # Deferred features, gaps, and feature flags
│   └── GITHUB_SETUP.md          # Security hardening and GitHub public release guide
├── packages/
│   ├── db/                      # Prisma schema, migrations, and database client
│   └── shared/                  # Common TypeScript interfaces, DTOs, and utility functions
├── .env.example                 # Sanitized environment template with zero hardcoded secrets
├── CONTRIBUTING.md              # Contribution standards and pull request workflows
├── LICENSE                      # MIT Open Source License (Sayed Baqar Abbas)
├── package.json                 # Monorepo root manifest
├── pnpm-workspace.yaml          # pnpm workspace definition
└── SECURITY.md                  # Vulnerability disclosure and key rotation procedures
```

---

## Documentation & Architecture

- **Architecture Decisions**: See [docs/DECISIONS.md](docs/DECISIONS.md) for rationale on monorepo structure, NestJS modular monolith, Prisma + pgvector, BullMQ, and cookie auth.
- **Design Guidelines**: See [docs/DESIGN_SYSTEM.md](docs/DESIGN_SYSTEM.md) for the Editorial Paper design tokens, typography rules (`Playfair Display` + `Source Sans 3`), geometry (`rounded-[6px]`), and prohibited SaaS tropes.
- **Deferred Items & Flags**: See [docs/KNOWN_GAPS.md](docs/KNOWN_GAPS.md) for intentionally deferred features (WhatsApp, Billing, Dark Mode, RAG).
- **Milestones**: See [docs/PROGRESS.md](docs/PROGRESS.md) for current implementation progress across phases.
- **Release Preparation**: See [docs/GITHUB_SETUP.md](docs/GITHUB_SETUP.md) for repository security hardening, secret scanning, and branch protection setup.

---

## Contributing

We welcome community contributions, bug fixes, and improvements. Please read our [CONTRIBUTING.md](CONTRIBUTING.md) guide and [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) before submitting pull requests.

---

## Security & Vulnerability Reporting

Security is our top priority. Please review our [SECURITY.md](SECURITY.md) policy for responsible disclosure guidelines, key rotation procedures, and zero-default credential enforcement.

To report a vulnerability privately, email [security@example.com](mailto:security@example.com) or use GitHub Private Vulnerability Reporting.

---

## License

Leadforge code is licensed under the [MIT License](LICENSE).

Copyright (c) 2026 **Sayed Baqar Abbas**. All rights reserved.
