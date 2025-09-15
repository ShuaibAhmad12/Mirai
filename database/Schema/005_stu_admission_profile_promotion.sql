-- Migration: Normalized student domain (admission + profile + promotion)
-- Run after 004_agents.sql

-- Core students
CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legacy_student_id integer UNIQUE,
  full_name text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','withdrawn','transferred','deleted')),
  current_enrollment_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

-- 1:1 profile
CREATE TABLE IF NOT EXISTS student_profiles (
  student_id uuid PRIMARY KEY REFERENCES students(id) ON DELETE CASCADE,
  mother_name text,
  father_name text,
  dob date,
  gender text,
  category text,
  nationality text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

-- Addresses
CREATE TABLE IF NOT EXISTS student_addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  addr_type text NOT NULL CHECK (addr_type IN ('permanent','correspondence')),
  address_text text,
  state text,
  country text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE(student_id, addr_type)
);

-- Identity documents
CREATE TABLE IF NOT EXISTS student_identity_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  doc_type text NOT NULL,
  doc_number text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

-- Contacts
CREATE TABLE IF NOT EXISTS student_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  contact_type text NOT NULL CHECK (contact_type IN ('phone','parent_phone','guardian_phone','email','other')),
  value_raw text,
  value_norm text,
  is_primary boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE(student_id, contact_type, value_norm)
);

-- Prior education
CREATE TABLE IF NOT EXISTS student_prior_education (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  level text,
  board_university text,
  year_of_passing text,
  marks_percentage text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

-- Enrollments
CREATE TABLE IF NOT EXISTS student_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  course_id uuid NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
  session_id uuid REFERENCES academic_sessions(id) ON DELETE SET NULL,
  enrollment_code text,
  enrollment_date date NOT NULL,
  joining_date date,
  entry_year smallint,
  entry_type text NOT NULL DEFAULT 'regular' CHECK (entry_type IN ('regular','lateral')),
  agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  fee_plan_id uuid REFERENCES fee_plans(id) ON DELETE SET NULL,
  agent_commission_paid boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','withdrawn','transferred','deleted','completed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid,
  UNIQUE(student_id, course_id, session_id)
);

-- Progressions
CREATE TABLE IF NOT EXISTS student_progressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES student_enrollments(id) ON DELETE CASCADE,
  from_year smallint,
  to_year smallint NOT NULL,
  course_duration smallint,
  effective_date date NOT NULL,
  status text NOT NULL CHECK (status IN ('new_admission','promoted','repeated','withdrawn')),
  legacy_promotion_id integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Internal refs (card / eno slots)
CREATE TABLE IF NOT EXISTS student_internal_refs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  ref_group text NOT NULL CHECK (ref_group IN ('card','eno')),
  slot_number smallint NOT NULL CHECK (slot_number > 0),
  raw_value text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(student_id, ref_group, slot_number)
);

-- Fee overrides (student-specific base amounts)
CREATE TABLE IF NOT EXISTS student_fee_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES student_enrollments(id) ON DELETE CASCADE,
  fee_plan_item_id uuid REFERENCES fee_plan_items(id) ON DELETE CASCADE,
  year_number smallint,
  component_code text,
  override_amount numeric(12,2),
  discount_amount numeric(12,2),
  reason text,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  UNIQUE(enrollment_id, fee_plan_item_id)
);

-- Adjustments (discount / penalty / scholarship events)
CREATE TABLE IF NOT EXISTS student_fee_adjustments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES student_enrollments(id) ON DELETE CASCADE,
  fee_plan_item_id uuid REFERENCES fee_plan_items(id) ON DELETE SET NULL,
  adjustment_type text NOT NULL CHECK (adjustment_type IN ('discount','penalty','scholarship','waiver','other')),
  amount numeric(12,2) NOT NULL CHECK (amount >= 0),
  reason text,
  source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

-- Notes
CREATE TABLE IF NOT EXISTS student_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

-- Indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_legacy ON students(legacy_student_id);
CREATE INDEX IF NOT EXISTS idx_student_identity_docs_student ON student_identity_documents(student_id);
CREATE INDEX IF NOT EXISTS idx_student_contacts_student ON student_contacts(student_id);
CREATE INDEX IF NOT EXISTS idx_student_prior_ed_student ON student_prior_education(student_id);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_student ON student_enrollments(student_id);
CREATE INDEX IF NOT EXISTS idx_student_enrollments_agent ON student_enrollments(agent_id);
CREATE INDEX IF NOT EXISTS idx_student_progressions_enrollment ON student_progressions(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_student_fee_overrides_enrollment ON student_fee_overrides(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_student_fee_adjustments_enrollment ON student_fee_adjustments(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_student_fee_overrides_created_by ON student_fee_overrides(created_by);
CREATE INDEX IF NOT EXISTS idx_student_fee_overrides_updated_by ON student_fee_overrides(updated_by);
-- Triggers (requires touch_updated_at from earlier migration)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_students_touch') THEN
    CREATE TRIGGER trg_students_touch BEFORE UPDATE ON students
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_student_profiles_touch') THEN
    CREATE TRIGGER trg_student_profiles_touch BEFORE UPDATE ON student_profiles
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_student_enrollments_touch') THEN
    CREATE TRIGGER trg_student_enrollments_touch BEFORE UPDATE ON student_enrollments
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_student_fee_overrides_touch') THEN
    CREATE TRIGGER trg_student_fee_overrides_touch BEFORE UPDATE ON student_fee_overrides
    FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
  END IF;
END $$;

-- END 005 migration
