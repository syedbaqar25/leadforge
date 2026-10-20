# Architecture Decision Records

## ADR-001: Monorepo with pnpm workspaces

**Decision:** Use pnpm workspaces instead of Turborepo or Nx.
**Rationale:** Simpler setup, native workspace protocol, no additional build tool dependency for MVP. Can add Turborepo later if build times become an issue.
**Status:** Accepted, 2026-10-19

## ADR-002: NestJS modular monolith

**Decision:** Single NestJS application with domain modules, not microservices.
**Rationale:** MVP scope doesn't justify service boundaries, shared DB, simpler deployment. Modules can be extracted later.
**Status:** Accepted, 2026-10-19

## ADR-003: Editorial Paper UI direction

**Decision:** Chose Direction 1 (Editorial Paper) for the design system.
**Rationale:** Warm, professional, calm aesthetic suitable for sales teams. Vermilion accent passes WCAG AA. Serif display font differentiates from generic SaaS look.
**Status:** Accepted, 2026-10-19

## ADR-004: Prisma over raw SQL

**Decision:** Use Prisma ORM with parameterized queries. Raw SQL only for pgvector operations using tagged templates.
**Rationale:** Type safety, migration tooling, injection prevention by default. pgvector requires raw SQL for similarity search.
**Status:** Accepted, 2026-10-19

## ADR-005: BullMQ over agenda/bee-queue

**Decision:** Use BullMQ for background jobs with a separate worker process.
**Rationale:** Active maintenance, Redis-backed, built-in rate limiting, delayed jobs, dead-letter queues, and good NestJS integration.
**Status:** Accepted, 2026-10-19

## ADR-006: Cookie-based auth over localStorage tokens

**Decision:** JWT access tokens in memory, refresh tokens as HttpOnly Secure SameSite cookies.
**Rationale:** Prevents XSS token theft. Rotating refresh tokens with reuse detection for session security.
**Status:** Accepted, 2026-10-19
