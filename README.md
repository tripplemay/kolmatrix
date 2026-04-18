# KOLMatrix

AI-driven KOL campaign command center — discover, evaluate, contact, and track KOLs across YouTube / Twitch / TikTok / Instagram with pixel-perfect Neural Velocity design.

Stack: **Next.js 16 · React 19.2 · Tailwind v4 · Prisma 7 · PostgreSQL 16 (+ RLS) · NextAuth v5 · next-intl · recharts**

## Quickstart (5 commands)

```bash
docker compose up -d                                  # PG 16 + Redis 7
cp .env.example .env                                  # fill secrets
npm ci && npm run postinstall                         # deps + prisma generate
npx prisma migrate deploy && npm run db:seed          # schema + demo data
npm run dev                                           # → http://localhost:3000
```

Login: `marketer@kolmatrix.local` / `KOLM@2026!` — opens the Dashboard with 12 KOLs / 3 campaigns / 300 email logs pre-seeded.

## Docs

- **[docs/dev/setup.md](docs/dev/setup.md)** — full local environment walkthrough (Node 20 / Docker / envs / Prisma)
- **[docs/dev/architecture.md](docs/dev/architecture.md)** — system overview
- **[docs/dev/infrastructure.md](docs/dev/infrastructure.md)** — deployment + ops
- **[docs/dev/testing.md](docs/dev/testing.md)** — test strategy
- **[docs/specs/](docs/specs/)** — B0 foundation + B1+ batch specifications
- **[design-draft/design-system.md](design-draft/design-system.md)** — Neural Velocity design tokens + component rules
- **[CONTRIBUTING.md](CONTRIBUTING.md)** — workflow conventions (multi-agent harness-driven)

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run db:up` / `db:down` | Toggle Docker PG + Redis |
| `npm run db:migrate` | `prisma migrate deploy` |
| `npm run db:seed` | `prisma db seed` (idempotent demo data) |
| `npm run db:studio` | `prisma studio` GUI |

## License

Proprietary — internal project.
