-- 04_grants_students_page.sql
-- Purpose: Minimal grants for Students page RPC (adjust to your roles/policies).

-- Example: allow authenticated to execute the live RPC
-- GRANT EXECUTE ON FUNCTION rpc_students_grid_live(
--   text, uuid, uuid, uuid, int, text, text, int, int
-- ) TO authenticated;

-- If using service_role in Edge Functions/cron, grant accordingly
-- GRANT EXECUTE ON FUNCTION rpc_students_grid_live(
--   text, uuid, uuid, uuid, int, text, text, int, int
-- ) TO service_role;
