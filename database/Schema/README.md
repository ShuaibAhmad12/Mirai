# Database Schema & Legacy Import

## Files

- `001_core_schema.sql` – Creates minimal production tables (`colleges`, `academic_sessions`, `courses`) with UUID `id`, `legacy_id`, timestamps, and lightweight constraints.
- `002_legacy_import_helpers.sql` – Staging tables + upsert scripts to migrate legacy CSV exports into new core tables.

## Usage Order

1. Run `001_core_schema.sql` once.
2. Load legacy CSVs into the three `staging_` tables (edit COPY paths or use the SQL editor upload in Supabase).
3. Run the INSERT/UPSERT blocks contained in `002_legacy_import_helpers.sql`.
4. Verify row counts match expectations.
5. (Optional) Enforce single current session by enabling the unique index or running the cleanup block at the bottom of helper file.
6. (Optional) Drop the `staging_` tables after validation.

## Notes

- `legacy_id` is UNIQUE on each core table to ensure idempotent re-imports.
- `updated_at` auto-updates via triggers defined once; safe on re-run.
- Duration in courses stored as integer; zero/blank converted to NULL.
- Session date gaps: missing `end_date` defaults to same or a fallback; adjust if stricter logic needed.

## Next Suggestions

- Add RLS policies (Supabase) after roles model is finalized.
- Create a materialized view later if you need aggregated academic stats.
- Introduce a junction table if courses become session-specific offerings.
