-- Helper objects for legacy CSV import. Run after 001_core_schema.sql
-- Adjust file paths for actual import steps executed via psql or Supabase SQL editor.

-- STAGING TABLES (raw import mirrors legacy columns exactly). Drop after migration if desired.
CREATE TABLE IF NOT EXISTS staging_colleges (
  legacy_id    integer PRIMARY KEY,
  code         text,
  name         text,
  address      text,
  website      text,
  email        text,
  phone        text,
  affiliation  text,
  approved_by  text,
  status       smallint
);

CREATE TABLE IF NOT EXISTS staging_academic_sessions (
  legacy_id   integer PRIMARY KEY,
  title       text,
  start_date  date,
  end_date    date,
  is_current  boolean
);

CREATE TABLE IF NOT EXISTS staging_courses (
  legacy_id    integer PRIMARY KEY,
  college_code text, -- used to map to colleges.code
  name         text,
  duration     integer
);

-- IMPORT EXAMPLES (uncomment and adapt path when running via psql shell):
-- \copy staging_colleges FROM '/import/colleges.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');
-- \copy staging_academic_sessions FROM '/import/sessions.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');
-- \copy staging_courses FROM '/import/courses.csv' WITH (FORMAT csv, HEADER true, ENCODING 'UTF8');

-- MIGRATION / UPSERT SCRIPTS
-- Colleges
INSERT INTO colleges (legacy_id, code, name, address, website, email, phone, affiliation, approved_by, status)
SELECT s.legacy_id, s.code, s.name, s.address, s.website, s.email, s.phone, s.affiliation, s.approved_by,
       COALESCE(NULLIF(s.status,0),1) -- default 1 if legacy 0 means missing
FROM staging_colleges s
ON CONFLICT (legacy_id) DO UPDATE SET
  code = EXCLUDED.code,
  name = EXCLUDED.name,
  address = EXCLUDED.address,
  website = EXCLUDED.website,
  email = EXCLUDED.email,
  phone = EXCLUDED.phone,
  affiliation = EXCLUDED.affiliation,
  approved_by = EXCLUDED.approved_by,
  status = EXCLUDED.status;

-- Academic Sessions
INSERT INTO academic_sessions (legacy_id, title, start_date, end_date, is_current)
SELECT s.legacy_id, s.title,
       COALESCE(s.start_date, DATE '2000-01-01'),
       COALESCE(s.end_date,   COALESCE(s.start_date, DATE '2000-12-31')),
       COALESCE(s.is_current,false)
FROM staging_academic_sessions s
ON CONFLICT (legacy_id) DO UPDATE SET
  title = EXCLUDED.title,
  start_date = EXCLUDED.start_date,
  end_date = EXCLUDED.end_date,
  is_current = EXCLUDED.is_current;

-- Courses (map college_code -> colleges.code)
INSERT INTO courses (legacy_id, college_id, name, duration)
SELECT sc.legacy_id, c.id, sc.name, NULLIF(sc.duration,0)
FROM staging_courses sc
JOIN colleges c ON c.code = sc.college_code
ON CONFLICT (legacy_id) DO UPDATE SET
  college_id = EXCLUDED.college_id,
  name = EXCLUDED.name,
  duration = EXCLUDED.duration;

-- OPTIONAL: After verifying data, you may drop staging tables
-- DROP TABLE IF EXISTS staging_courses; 
-- DROP TABLE IF EXISTS staging_academic_sessions; 
-- DROP TABLE IF EXISTS staging_colleges; 

-- POST-MIGRATION CLEANUP: set a single current session if multiples exist
-- WITH ranked AS (
--   SELECT id, is_current, start_date,
--          ROW_NUMBER() OVER (ORDER BY CASE WHEN is_current THEN 0 ELSE 1 END, start_date DESC) AS rn
--   FROM academic_sessions
-- )
-- UPDATE academic_sessions SET is_current = (rn = 1)
-- FROM ranked r WHERE academic_sessions.id = r.id;

