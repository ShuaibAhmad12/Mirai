-- Core minimal schema with UUID PKs and legacy_id mapping.
-- Safe to run multiple times with IF NOT EXISTS for types/extensions.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- TABLE: colleges
CREATE TABLE IF NOT EXISTS colleges (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id  integer UNIQUE NOT NULL,
  code       text,
  name       text NOT NULL,
  address    text,
  website    text,
  email      text,
  phone      text,
  affiliation text,
  approved_by text,
  status     smallint DEFAULT 1 CHECK (status IN (0,1)),
  admission_number integer NOT NULL DEFAULT 10000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_colleges_code_unique ON colleges(code) WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_colleges_status ON colleges(status);

-- TABLE: academic_sessions
CREATE TABLE IF NOT EXISTS academic_sessions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id   integer UNIQUE NOT NULL,
  title       text NOT NULL,
  start_date  date NOT NULL,
  end_date    date NOT NULL,
  is_current  boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid,
  CHECK (start_date < end_date)
);

-- Unique current session (disabled until data cleaned)
-- CREATE UNIQUE INDEX uq_session_current ON academic_sessions(is_current) WHERE is_current;

CREATE INDEX IF NOT EXISTS idx_sessions_start ON academic_sessions(start_date);

-- TABLE: courses
CREATE TABLE IF NOT EXISTS courses (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- change legacey_id to course_identity after al migrations
  legacy_id   integer UNIQUE NOT NULL, 
  college_id  uuid NOT NULL REFERENCES colleges(id) ON DELETE CASCADE,
  college_code text NOT NULL,
  name        text NOT NULL,
  duration    integer,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid,
  CHECK (duration IS NULL OR duration > 0)
);

CREATE INDEX IF NOT EXISTS idx_courses_college ON courses(college_id);

-- OPTIONAL: automatic updated_at triggers
CREATE OR REPLACE FUNCTION touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END$$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_colleges_touch') THEN
    CREATE TRIGGER trg_colleges_touch BEFORE UPDATE ON colleges
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sessions_touch') THEN
    CREATE TRIGGER trg_sessions_touch BEFORE UPDATE ON academic_sessions
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_courses_touch') THEN
    CREATE TRIGGER trg_courses_touch BEFORE UPDATE ON courses
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
END $$;
