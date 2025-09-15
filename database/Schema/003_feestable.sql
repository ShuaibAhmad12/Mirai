-- Scalable fee schema (fees only for now; agents deferred)
-- Run after 001_core_schema.sql (depends on courses, academic_sessions)
-- Replaces prior wide fee_structures design with normalized model.

-- MASTER: fee_components
-- Defines reusable fee component types (e.g. TUITION, ADMISSION, SECURITY, HOSTEL, LIBRARY, OTHER)
CREATE TABLE IF NOT EXISTS fee_components (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,          -- short identifier (UPPER_SNAKE)
  label       text NOT NULL,                 -- human friendly name
  frequency   text NOT NULL,                 -- e.g. one_time|annual|semester|monthly|on_admission
  description text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid
);

-- PARENT: fee_plans
-- One plan per course (+ optional session) per version.
CREATE TABLE IF NOT EXISTS fee_plans (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_id      integer UNIQUE,                  -- from legacy fee_id (nullable for new-only plans)
  course_id      uuid NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  session_id     uuid REFERENCES academic_sessions(id) ON DELETE SET NULL,
  name           text NOT NULL,                   -- e.g. BSC FORESTRY 2024 Standard
  currency       text NOT NULL DEFAULT 'INR',
  status         smallint NOT NULL DEFAULT 1 CHECK (status IN (0,1)),
  effective_start date NOT NULL DEFAULT CURRENT_DATE,
  effective_end   date,                           -- NULL = open ended
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  updated_by     uuid,
  CHECK (effective_end IS NULL OR effective_end > effective_start)
);

CREATE INDEX IF NOT EXISTS idx_fee_plans_course ON fee_plans(course_id);
CREATE INDEX IF NOT EXISTS idx_fee_plans_session ON fee_plans(session_id);

-- CHILD: fee_plan_items
-- Individual monetary lines tied to a plan & component.
CREATE TABLE IF NOT EXISTS fee_plan_items (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fee_plan_id       uuid NOT NULL REFERENCES fee_plans(id) ON DELETE CASCADE,
  component_id      uuid NOT NULL REFERENCES fee_components(id) ON DELETE RESTRICT,
  year_number       smallint,                   -- NULL if not year specific
  amount            numeric(12,2) NOT NULL CHECK (amount >= 0),
  is_admission_phase boolean NOT NULL DEFAULT false, -- true for admission_year_X legacy values
  notes             text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now(),
  updated_by        uuid,
  UNIQUE(fee_plan_id, component_id, year_number, is_admission_phase)
);

CREATE INDEX IF NOT EXISTS idx_fee_plan_items_plan ON fee_plan_items(fee_plan_id);
CREATE INDEX IF NOT EXISTS idx_fee_plan_items_component ON fee_plan_items(component_id);
CREATE INDEX IF NOT EXISTS idx_fee_plan_items_year ON fee_plan_items(year_number);


-- Update timestamp triggers (reuse touch_updated_at if defined earlier)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_fee_components_touch') THEN
    CREATE TRIGGER trg_fee_components_touch BEFORE UPDATE ON fee_components
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_fee_plans_touch') THEN
    CREATE TRIGGER trg_fee_plans_touch BEFORE UPDATE ON fee_plans
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_fee_plan_items_touch') THEN
    CREATE TRIGGER trg_fee_plan_items_touch BEFORE UPDATE ON fee_plan_items
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
END $$;

-- SEED core components (idempotent)
INSERT INTO fee_components (code,label,frequency,description)
SELECT * FROM (VALUES
  ('TUITION','Tuition Fee','annual','Standard annual tuition'),
  ('ADMISSION','Admission Fee','on_admission','One-time admission / enrollment charge'),
  ('SECURITY','Security Deposit','one_time','Refundable / non-recurring security deposit'),
  ('OTHER','Other Charges','one_time','Miscellaneous one-time charges')
) AS v(code,label,frequency,description)
ON CONFLICT (code) DO NOTHING;
