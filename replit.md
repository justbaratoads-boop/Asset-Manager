# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

### Accounting & Business Management (`artifacts/accounting-app`)
React + Vite + Tailwind SPA. Full-featured Indian SMB accounting suite.

**Features:**
- Dashboard, Sales (Invoices, Order Booking, Walk-in), Purchase (Invoices, Orders)
- Accounts: Parties (with GST type, interstate flag, GSTIN/phone validation), Journal, Payments, Receipts, Credit/Debit Notes
- Inventory: Stock Items (with GST applicable/rate, batch assignment), Categories, Current Stock, **Batches** (CRUD)
- Reports: Day Book, Trial Balance, P&L, Balance Sheet, Registers, Cash Book
- GST Reports: GSTR-3B, GSTR-2B, HSN Summary
- Delivery management, Company Settings, Users & Roles
- Orders: Dispatch Details section (driver, vehicle, dispatch notes), party auto-fill (phone + address)

**Auth:** JWT stored in localStorage. Login: admin@example.com / password

### API Server (`artifacts/api-server`)
Express 5 + Drizzle ORM. Handles all CRUD + business logic.

**Key routes:**
- `/api/parties` — CRUD, unique name check, GST type, interstate flag; `/:id/orders`, `/:id/ledger`
- `/api/stock-batches` — CRUD
- `/api/stock-items` — CRUD with GST applicable/rate and batchId fields
- `/api/orders` — CRUD with dispatch fields; required validation (party, date, items)

**DB:** PostgreSQL (Supabase, transaction pooler). Schema in `lib/db/src/schema/`.

**Important notes:**
- Never use `app.get("*")` in Express 5 — use `app.use()` for SPA fallback
- `brand` column kept in `stockItemsTable` schema to avoid Drizzle rename prompts (hidden from UI)
- `customFetch` is exported from `@workspace/api-client-react` for direct API calls
- `useFetch` hook at `src/hooks/use-fetch.ts` wraps React Query + customFetch
- GST rates array: `[0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28]`
- Party phone: 10 digits exactly; GSTIN: `^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$`
