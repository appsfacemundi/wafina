# WAFINA

WAFINA is a nonprofit donation-matching platform connecting donors with verified institutions.

## Apps

This is an npm workspaces monorepo:

| App | Path | Stack |
| --- | --- | --- |
| Donor (web) | `apps/web` | Next.js |
| Donor (mobile) | `apps/mobile-donor` | React Native / Expo |
| Institution (web) | `apps/institution` | Next.js |
| Institution (mobile) | `apps/mobile-institution` | React Native / Expo |
| API | `apps/api` | Node.js, reads/writes Google Sheets |

Shared code lives in `packages/shared` (types, enums) and `packages/ui` (shared UI components).

Admin is handled separately via AppSheet — it is not part of this repo (see `DEVELOPMENT_RULES.md`).

## Getting started

```bash
npm install
```

Then run any app with its workspace script, e.g.:

```bash
npm run dev:api
npm run dev:web
npm run dev:institution
npm run dev:mobile-donor
npm run dev:mobile-institution
```

Other useful scripts:

```bash
npm run build       # build all workspaces
npm run lint         # lint all workspaces
npm run typecheck    # typecheck all workspaces
```

## Documentation

- `MASTER_SPECIFICATION.md` — source of truth for business logic, roles, permissions, and workflows.
- `DEVELOPMENT_RULES.md` — architectural rules and constraints that govern implementation.
