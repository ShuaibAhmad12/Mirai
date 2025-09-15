# MiraiSetu — Developer Guide

This document helps new developers understand the project quickly and become productive. It explains the architecture, how to run the app, where core logic lives, and the conventions we follow.

## Overview

- Framework: Next.js App Router (Next 15) with React 19
- UI: Tailwind CSS v4 + shadcn/radix primitives
- Data: Supabase (Postgres) with RLS; SSR client for server actions and API routes
- State: Minimal client state, some features use Zustand stores
- Validation: zod
- Auth/RBAC: Supabase Auth + custom RBAC layer enforced in both DB (RLS) and app

The app targets an academic/fees domain: admissions, students, agents, fees/receipts, and reporting.

## Getting started

1. Prerequisites
   - Node 20+
   - A Supabase project (URL + anon key)
   - A Postgres-compatible database (Supabase provides one)

2. Environment variables (create `.env.local`)

```bash
NEXT_PUBLIC_SUPABASE_URL=... 
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY=...
# Optional – used by specific services if present
# SITE_URL=http://localhost:3000
```

3. Install and run

```bash
pm install
npm run dev
```

- Dev server uses Turbopack. Production build: `npm run build` then `npm start`.

## Project layout

- `app/` — Next.js App Router pages and API routes
  - `(protected)/` — authenticated area (RBAC-gated)
    - `reports/` — Reporting UI (ReportBuilder)
  - `api/` — server endpoints; thin wrappers around services
- `components/` — UI and feature components (shadcn-style)
- `lib/` — core libraries and domain services
  - `supabase/` — SSR client factory, client helpers, middleware
  - `rbac/` — RBAC types and helpers
  - `reports/` — reporting types, registry whitelist, services
  - `services/` — domain services (students, fees, admissions, etc.)
  - `types/`, `stores/`, `providers/` — shared types/state/providers
- `database/Schema/` — SQL migrations and documentation for the data model
- `scripts/` — one-off scripts (e.g., migration helpers)

## Supabase integration

All server-side data access goes through the SSR client:

- `lib/supabase/server.ts` — `createClient()` reads/writes cookies via Next headers. Only create clients inside server functions; do not cache globally.
- Auth: Sessions are handled via Supabase cookies and middleware. DB access is subject to RLS policies.

## RBAC model

- RBAC is implemented in the database and reflected in app helpers (`lib/rbac`).
- UI gating is done in `(protected)` routes and layout/sidebar.
- Keep business-logic authorization in services; UI should not make auth decisions alone.

## Reporting system

Goal: safe, flexible reporting without ad‑hoc SQL.

- Registry whitelist: `lib/reports/registry.ts` defines allowed sources, fields, and safe relations.
- Types: `lib/reports/types.ts` defines QuerySpec (columns, sort, filters, joins, pagination).
- Run service: `lib/reports/reporting.service.ts` builds a PostgREST select string with embedded relations and applies filters/sort/pagination server-side.
- Templates: CRUD in `lib/reports/templates.service.ts`; table and RLS in `database/Schema/010_report_templates.sql`.
- API routes: `app/api/reports/*` expose capabilities, run, and templates endpoints.
- UI: `components/reports/ReportBuilder.tsx` builds queries, saves/loads templates, CSV export.

Important:
- The registry must reflect actual DB column names. Verify with SQL in `database/Schema/`.
- Dotted fields (relation.field) are supported for sorting and filtering; joins default to left to avoid dropping rows.
- Avoid array-heavy relations (like receipts under students) in common reports to keep payloads small.

## Database model (high level)

- Core student domain: see `005_stu_admission_profile_promotion.sql` for `students`, `student_profiles`, and `student_enrollments`.
- Fees and receipts: see `006_fee_ledger_system.sql` and `006.1_fee_current_balances.sql`.
- RBAC: seeds and roles in `007_rbac_user_management.sql` and `008_rbac_initialization.sql`.
- Report templates: `010_report_templates.sql`.

Run order suggestion for a fresh environment:

1. `001_core_schema.sql` … up to `011_admissions.sql`
2. Ensure RLS policies are active (see respective files)

## Coding conventions

- Server modules exporting actions should export individual async functions only (avoid object exports). Do not export TypeScript types as runtime values.
- Use zod to validate request payloads at API boundaries.
- Keep services thin and reusable; API routes should delegate to services.
- Prefer controlled components and shadcn primitives for UI.

## Development workflows

- Linting: `npm run lint`
- Build: `npm run build`
- Running scripts: `npm run migrate:fee-payment`

### Feature areas

- Admissions/students: `lib/services/*` (admissions, student, enrollment).
- Fees: `lib/services/fee-payment.service.ts`, `fees.service.ts`.
- Agents: `lib/services/agents.service.ts`.
- Reporting: `lib/reports/*` and `(protected)/reports` page.

## Troubleshooting

- 500s in reports often indicate a registry vs. schema mismatch. Cross-check `lib/reports/registry.ts` with SQL in `database/Schema`.
- Turbopack errors like “A ‘use server’ file can only export async functions” mean a module exported objects or types at runtime — switch to named async function exports only.
- If SSR Supabase calls fail, confirm `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY` are set and cookies are available in server context.

## Roadmap / Notes for contributors

- Reporting: add joined-field filters ‘in’ operator, XLSX export, and long-running job support for large reports.
- Expand registry sources cautiously — whitelist only RLS-safe columns and relations.
- Add tests for services and schema guards where practical.

## Support scripts and docs

- `database/Schema/README.md` and other SQL files include inline docs.
- `RBAC_Implementation_Plan.md` explains roles and permissions strategy.

---

Welcome aboard! Skim the schema docs to get domain context, then start from `(protected)/reports` and `lib/reports/*` to understand the reporting pipeline.
