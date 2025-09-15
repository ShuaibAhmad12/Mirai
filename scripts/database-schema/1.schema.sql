-- Supabase Database Schema Export
-- Generated on: Mon Sep 15 08:02:02 IST 2025
-- Tables ordered to avoid foreign key constraint issues

-- Drop existing tables (in reverse dependency order)
DROP TABLE IF EXISTS public.student_progressions CASCADE;
DROP TABLE IF EXISTS public.student_fee_overrides CASCADE;
DROP TABLE IF EXISTS public.fee_current_balances CASCADE;
DROP TABLE IF EXISTS public.fee_adjustments CASCADE;
DROP TABLE IF EXISTS public.student_enrollments CASCADE;
DROP TABLE IF EXISTS public.fee_plan_items CASCADE;
DROP TABLE IF EXISTS public.fee_plans CASCADE;
DROP TABLE IF EXISTS public.fee_receipt_allocations CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.user_invitations CASCADE;
DROP TABLE IF EXISTS public.student_user_profiles CASCADE;
DROP TABLE IF EXISTS public.staff_profiles CASCADE;
DROP TABLE IF EXISTS public.role_permissions CASCADE;
DROP TABLE IF EXISTS public.external_user_profiles CASCADE;
DROP TABLE IF EXISTS public.agent_tags CASCADE;
DROP TABLE IF EXISTS public.agent_notes CASCADE;
DROP TABLE IF EXISTS public.agent_contacts CASCADE;
DROP TABLE IF EXISTS public.courses CASCADE;
DROP TABLE IF EXISTS public.fee_receipt_balance_records CASCADE;
DROP TABLE IF EXISTS public.student_profiles CASCADE;
DROP TABLE IF EXISTS public.student_prior_education CASCADE;
DROP TABLE IF EXISTS public.student_notes CASCADE;
DROP TABLE IF EXISTS public.student_internal_refs CASCADE;
DROP TABLE IF EXISTS public.student_identity_documents CASCADE;
DROP TABLE IF EXISTS public.student_contacts CASCADE;
DROP TABLE IF EXISTS public.student_addresses CASCADE;
DROP TABLE IF EXISTS public.fee_ledger_events CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;
DROP TABLE IF EXISTS public.agents CASCADE;
DROP TABLE IF EXISTS public.report_templates CASCADE;
DROP TABLE IF EXISTS public.permissions CASCADE;
DROP TABLE IF EXISTS public.colleges CASCADE;
DROP TABLE IF EXISTS public.system_config CASCADE;
DROP TABLE IF EXISTS public.fee_receipts CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.academic_sessions CASCADE;
DROP TABLE IF EXISTS public.roles CASCADE;
DROP TABLE IF EXISTS public.students CASCADE;
DROP TABLE IF EXISTS public.fee_components CASCADE;

-- Create tables (in dependency order)
-- Table: fee_components
CREATE TABLE public.fee_components (,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    code text NOT NULL,
    label text NOT NULL,
    frequency text NOT NULL,
    description text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_by uuid,
    PRIMARY KEY (id)
);

-- Table: students
CREATE TABLE public.students (,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    legacy_student_id integer,
    full_name text NOT NULL,
    status text NOT NULL DEFAULT 'active'::text,
    current_enrollment_id uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_by uuid,
    PRIMARY KEY (id),
    CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text, 'withdrawn'::text, 'transferred'::text, 'deleted'::text])))
);

-- Table: roles
CREATE TABLE public.roles (,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    display_name text NOT NULL,
    description text,
    level integer NOT NULL DEFAULT 0,
    is_system_role boolean NOT NULL DEFAULT false,
    max_users integer,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by uuid,
    updated_by uuid,
    PRIMARY KEY (id),
    CHECK ((length(display_name) <= 100)),
    CHECK ((length(name) <= 50)),
    CHECK (((level >= 0) AND (level <= 100)))
);

-- Table: academic_sessions
CREATE TABLE public.academic_sessions (,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    legacy_id integer NOT NULL,
    title text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    is_current boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_by uuid,
    PRIMARY KEY (id),
    CHECK ((start_date < end_date)),
    CHECK ((start_date < end_date))
);

-- Table: audit_logs
CREATE TABLE public.audit_logs (,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    table_name text NOT NULL,
    operation text NOT NULL,
    record_id uuid,
    old_values jsonb,
    new_values jsonb,
    user_id uuid,
    timestamp timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

-- Table: fee_receipts
CREATE TABLE public.fee_receipts (,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    receipt_number text NOT NULL,
    receipt_date date NOT NULL,
    enrollment_id uuid NOT NULL,
    academic_year text NOT NULL,
    total_amount numeric(12,2) NOT NULL,
    paid_amount numeric(12,2) NOT NULL,
    balance_amount numeric(12,2) NOT NULL,
    payment_method USER-DEFINED NOT NULL,
    payment_reference text,
    payment_date date,
    bank_name text,
    legacy_reg_fee numeric(12,2),
    legacy_sec_fee numeric(12,2),
    legacy_tut_fee numeric(12,2),
    legacy_other_fee numeric(12,2),
    legacy_pre_bal numeric(12,2),
    legacy_rebate numeric(12,2),
    status USER-DEFINED NOT NULL DEFAULT 'ACTIVE'::receipt_status_type,
    comments text,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    legacy_receipt_id text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    remarks text,
    is_edited boolean NOT NULL DEFAULT false,
    PRIMARY KEY (id),
    CHECK ((balance_amount = (total_amount - paid_amount))),
    CHECK ((balance_amount = (total_amount - paid_amount))),
    CHECK ((balance_amount = (total_amount - paid_amount))),
    CHECK ((payment_date <= CURRENT_DATE)),
    CHECK (((total_amount = round(total_amount, 2)) AND (paid_amount = round(paid_amount, 2)) AND (balance_amount = round(balance_amount, 2)))),
    CHECK (((total_amount = round(total_amount, 2)) AND (paid_amount = round(paid_amount, 2)) AND (balance_amount = round(balance_amount, 2)))),
    CHECK (((total_amount = round(total_amount, 2)) AND (paid_amount = round(paid_amount, 2)) AND (balance_amount = round(balance_amount, 2)))),
    CHECK ((length(payment_reference) <= 100)),
    CHECK ((receipt_date <= CURRENT_DATE)),
    CHECK ((length(receipt_number) <= 50)),
    CHECK ((length(academic_year) <= 10)),
    CHECK ((academic_year ~ '^\d{4}-\d{2}$'::text)),
    CHECK ((total_amount >= (0)::numeric)),
    CHECK ((length(bank_name) <= 100)),
    CHECK ((paid_amount >= (0)::numeric))
);

-- Table: system_config
CREATE TABLE public.system_config (,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    key text NOT NULL,
    value jsonb,
    description text,
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id)
);

-- Table: colleges
CREATE TABLE public.colleges (,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    legacy_id integer,
    code text,
    name text NOT NULL,
    address text,
    website text,
    email text,
    phone text,
    affiliation text,
    approved_by text,
    status smallint DEFAULT 1,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_by uuid,
    admission_number integer NOT NULL DEFAULT 10000,
    PRIMARY KEY (id),
    CHECK ((status = ANY (ARRAY[0, 1])))
);

-- Table: permissions
CREATE TABLE public.permissions (,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    display_name text NOT NULL,
    description text,
    resource_type USER-DEFINED NOT NULL,
    operation USER-DEFINED NOT NULL,
    scope_level text DEFAULT 'GLOBAL'::text,
    conditions jsonb,
    is_system_permission boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    CHECK ((length(display_name) <= 150)),
    CHECK ((scope_level = ANY (ARRAY['GLOBAL'::text, 'COLLEGE'::text, 'DEPARTMENT'::text, 'COURSE'::text, 'SELF'::text]))),
    CHECK ((length(name) <= 100))
);

-- Table: report_templates
CREATE TABLE public.report_templates (,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    name text NOT NULL,
    description text,
    source_key text NOT NULL,
    columns jsonb NOT NULL DEFAULT '[]'::jsonb,
    filters jsonb NOT NULL DEFAULT '[]'::jsonb,
    sort jsonb NOT NULL DEFAULT '[]'::jsonb,
    page_size integer NOT NULL DEFAULT 25,
    visibility text NOT NULL DEFAULT 'private'::text,
    created_by uuid,
    updated_by uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

-- Table: agents
CREATE TABLE public.agents (,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    legacy_id integer,
    name text NOT NULL,
    email_raw text,
    email text,
    phone_raw text,
    phone_e164 text,
    status smallint NOT NULL DEFAULT 1,
    source_channel text,
    notes text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_by uuid,
    PRIMARY KEY (id),
    CHECK ((status = ANY (ARRAY[0, 1])))
);

-- Table: users
CREATE TABLE public.users (,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    email text NOT NULL,
    phone text,
    username text,
    supabase_auth_id uuid,
    first_name text NOT NULL,
    last_name text NOT NULL,
    full_name text,
    status USER-DEFINED NOT NULL DEFAULT 'PENDING_VERIFICATION'::user_status_type,
    is_system_admin boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at timestamp with time zone,
    email_verified_at timestamp with time zone,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    created_by uuid,
    updated_by uuid,
    PRIMARY KEY (id),
    CHECK ((length(last_name) <= 100)),
    CHECK ((length(username) <= 50)),
    CHECK (((length(first_name) >= 2) AND (length(last_name) >= 2))),
    CHECK (((length(first_name) >= 2) AND (length(last_name) >= 2))),
    CHECK ((email ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,4}$'::text)),
    CHECK ((length(first_name) <= 100)),
    CHECK ((length(phone) <= 15))
);

-- Table: fee_ledger_events
CREATE TABLE public.fee_ledger_events (,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    event_type USER-DEFINED NOT NULL,
    event_date timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    enrollment_id uuid NOT NULL,
    academic_year text NOT NULL,
    fee_component_id uuid NOT NULL,
    amount numeric(12,2) NOT NULL,
    running_balance numeric(12,2) NOT NULL,
    receipt_id uuid,
    fee_plan_id uuid,
    reference_event_id uuid,
    description text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    legacy_receipt_id text,
    legacy_balance_id text,
    legacy_record_id text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    PRIMARY KEY (id),
    CHECK ((academic_year ~ '^\d{4}-\d{2}$'::text)),
    CHECK ((running_balance = round(running_balance, 2))),
    CHECK ((amount = round(amount, 2))),
    CHECK ((length(academic_year) <= 10))
);

-- Table: student_addresses
CREATE TABLE public.student_addresses (,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL,
    addr_type text NOT NULL,
    address_text text,
    state text,
    country text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_by uuid,
    PRIMARY KEY (id),
    CHECK ((addr_type = ANY (ARRAY['permanent'::text, 'correspondence'::text])))
);

-- Table: student_contacts
CREATE TABLE public.student_contacts (,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL,
    contact_type text NOT NULL,
    value_raw text,
    value_norm text,
    is_primary boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_by uuid,
    PRIMARY KEY (id),
    CHECK ((contact_type = ANY (ARRAY['phone'::text, 'parent_phone'::text, 'guardian_phone'::text, 'email'::text, 'other'::text])))
);

-- Table: student_identity_documents
CREATE TABLE public.student_identity_documents (,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL,
    doc_type text NOT NULL,
    doc_number text,
    is_primary boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_by uuid,
    PRIMARY KEY (id)
);

-- Table: student_internal_refs
CREATE TABLE public.student_internal_refs (,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL,
    ref_group text NOT NULL,
    slot_number smallint NOT NULL,
    raw_value text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    CHECK ((ref_group = ANY (ARRAY['card'::text, 'eno'::text]))),
    CHECK ((slot_number > 0))
);

-- Table: student_notes
CREATE TABLE public.student_notes (,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL,
    note text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    PRIMARY KEY (id)
);

-- Table: student_prior_education
CREATE TABLE public.student_prior_education (,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL,
    level text,
    board_university text,
    year_of_passing text,
    marks_percentage text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_by uuid,
    PRIMARY KEY (id)
);

-- Table: student_profiles
CREATE TABLE public.student_profiles (,
    student_id uuid NOT NULL,
    mother_name text,
    father_name text,
    dob date,
    gender text,
    category text,
    nationality text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_by uuid,
    PRIMARY KEY (student_id)
);

-- Table: fee_receipt_balance_records
CREATE TABLE public.fee_receipt_balance_records (,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    receipt_id uuid NOT NULL,
    fee_component_id uuid NOT NULL,
    charge_amount numeric(12,2) NOT NULL DEFAULT 0,
    paid_amount numeric(12,2) NOT NULL DEFAULT 0,
    balance_amount numeric(12,2) NOT NULL DEFAULT 0,
    enrollment_id uuid NOT NULL,
    academic_year text NOT NULL,
    receipt_date date NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    legacy_record_id text,
    PRIMARY KEY (id),
    CHECK ((academic_year ~ '^\d{4}-\d{2}$'::text)),
    CHECK ((receipt_date <= CURRENT_DATE)),
    CHECK (((charge_amount = round(charge_amount, 2)) AND (paid_amount = round(paid_amount, 2)) AND (balance_amount = round(balance_amount, 2)))),
    CHECK (((charge_amount = round(charge_amount, 2)) AND (paid_amount = round(paid_amount, 2)) AND (balance_amount = round(balance_amount, 2)))),
    CHECK (((charge_amount = round(charge_amount, 2)) AND (paid_amount = round(paid_amount, 2)) AND (balance_amount = round(balance_amount, 2)))),
    CHECK ((length(academic_year) <= 10)),
    CHECK ((balance_amount = (charge_amount - paid_amount))),
    CHECK ((balance_amount = (charge_amount - paid_amount))),
    CHECK ((balance_amount = (charge_amount - paid_amount)))
);

-- Table: courses
CREATE TABLE public.courses (,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    course_identity integer NOT NULL,
    college_id uuid NOT NULL,
    name text NOT NULL,
    duration integer,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_by uuid,
    college_code text,
    PRIMARY KEY (id),
    CHECK (((duration IS NULL) OR (duration > 0)))
);

-- Table: agent_contacts
CREATE TABLE public.agent_contacts (,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    agent_id uuid NOT NULL,
    contact_type text NOT NULL,
    value_raw text,
    value_norm text,
    is_primary boolean NOT NULL DEFAULT false,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_by uuid,
    PRIMARY KEY (id),
    CHECK ((contact_type = ANY (ARRAY['email'::text, 'phone'::text, 'whatsapp'::text, 'telegram'::text, 'other'::text])))
);

-- Table: agent_notes
CREATE TABLE public.agent_notes (,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    agent_id uuid NOT NULL,
    remarks text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    student_id uuid,
    is_paid boolean NOT NULL DEFAULT false,
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_by uuid,
    PRIMARY KEY (id)
);

-- Table: agent_tags
CREATE TABLE public.agent_tags (,
    agent_id uuid NOT NULL,
    tag text NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (agent_id, tag)
);

-- Table: external_user_profiles
CREATE TABLE public.external_user_profiles (,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    external_system text NOT NULL,
    external_user_id text,
    organization_name text NOT NULL,
    organization_type text,
    contact_person_name text,
    contact_person_email text,
    contact_person_phone text,
    access_purpose text,
    access_start_date date NOT NULL,
    access_end_date date,
    is_verified boolean NOT NULL DEFAULT false,
    verification_date timestamp with time zone,
    verified_by uuid,
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by uuid,
    updated_by uuid,
    PRIMARY KEY (id),
    CHECK ((length(access_purpose) <= 500)),
    CHECK ((contact_person_email ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,4}$'::text)),
    CHECK ((length(contact_person_name) <= 100)),
    CHECK ((length(contact_person_phone) <= 15)),
    CHECK ((length(organization_name) <= 200)),
    CHECK ((access_start_date <= COALESCE(access_end_date, CURRENT_DATE))),
    CHECK ((access_start_date <= COALESCE(access_end_date, CURRENT_DATE))),
    CHECK ((length(organization_type) <= 50)),
    CHECK ((length(external_system) <= 50)),
    CHECK ((length(external_user_id) <= 100))
);

-- Table: role_permissions
CREATE TABLE public.role_permissions (,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    role_id uuid NOT NULL,
    permission_id uuid NOT NULL,
    granted_by uuid,
    granted_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    conditions jsonb,
    is_active boolean NOT NULL DEFAULT true,
    PRIMARY KEY (id)
);

-- Table: staff_profiles
CREATE TABLE public.staff_profiles (,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    employee_id text,
    employment_type USER-DEFINED NOT NULL,
    department USER-DEFINED NOT NULL,
    designation text NOT NULL,
    joining_date date NOT NULL,
    confirmation_date date,
    retirement_date date,
    reports_to_user_id uuid,
    official_email text,
    office_phone text,
    office_location text,
    date_of_birth date,
    gender text,
    nationality text,
    emergency_contact_name text,
    emergency_contact_phone text,
    emergency_contact_relation text,
    is_active boolean NOT NULL DEFAULT true,
    termination_date date,
    termination_reason text,
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by uuid,
    updated_by uuid,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    PRIMARY KEY (id),
    CHECK ((length(employee_id) <= 20)),
    CHECK ((length(designation) <= 100)),
    CHECK ((official_email ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,4}$'::text)),
    CHECK ((length(emergency_contact_name) <= 100)),
    CHECK (((joining_date <= COALESCE(confirmation_date, CURRENT_DATE)) AND (joining_date <= COALESCE(retirement_date, CURRENT_DATE)) AND (joining_date <= COALESCE(termination_date, CURRENT_DATE)))),
    CHECK (((joining_date <= COALESCE(confirmation_date, CURRENT_DATE)) AND (joining_date <= COALESCE(retirement_date, CURRENT_DATE)) AND (joining_date <= COALESCE(termination_date, CURRENT_DATE)))),
    CHECK (((joining_date <= COALESCE(confirmation_date, CURRENT_DATE)) AND (joining_date <= COALESCE(retirement_date, CURRENT_DATE)) AND (joining_date <= COALESCE(termination_date, CURRENT_DATE)))),
    CHECK (((joining_date <= COALESCE(confirmation_date, CURRENT_DATE)) AND (joining_date <= COALESCE(retirement_date, CURRENT_DATE)) AND (joining_date <= COALESCE(termination_date, CURRENT_DATE)))),
    CHECK ((length(office_phone) <= 15)),
    CHECK ((length(emergency_contact_phone) <= 15)),
    CHECK ((length(office_location) <= 200)),
    CHECK ((gender = ANY (ARRAY['MALE'::text, 'FEMALE'::text, 'OTHER'::text, 'PREFER_NOT_TO_SAY'::text]))),
    CHECK ((length(emergency_contact_relation) <= 50)),
    CHECK ((length(nationality) <= 50))
);

-- Table: student_user_profiles
CREATE TABLE public.student_user_profiles (,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    student_id uuid NOT NULL,
    parent_email text,
    parent_phone text,
    allow_parent_access boolean NOT NULL DEFAULT true,
    parent_access_level text DEFAULT 'VIEW_ONLY'::text,
    preferred_language text DEFAULT 'EN'::text,
    notification_preferences jsonb DEFAULT '{"sms": false, "push": true, "email": true}'::jsonb,
    current_academic_year text,
    is_alumni boolean NOT NULL DEFAULT false,
    graduation_year integer,
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by uuid,
    updated_by uuid,
    PRIMARY KEY (id),
    CHECK ((parent_email ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,4}$'::text)),
    CHECK ((parent_access_level = ANY (ARRAY['VIEW_ONLY'::text, 'LIMITED'::text, 'FULL'::text]))),
    CHECK ((length(parent_phone) <= 15)),
    CHECK ((length(preferred_language) <= 5)),
    CHECK ((current_academic_year ~ '^\d{4}-\d{2}$'::text))
);

-- Table: user_invitations
CREATE TABLE public.user_invitations (,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    email text NOT NULL,
    invitation_token uuid NOT NULL DEFAULT gen_random_uuid(),
    invited_by uuid NOT NULL,
    invited_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp with time zone NOT NULL DEFAULT (CURRENT_TIMESTAMP + '7 days'::interval),
    pre_assigned_role_id uuid,
    status text NOT NULL DEFAULT 'PENDING'::text,
    used_at timestamp with time zone,
    used_by uuid,
    PRIMARY KEY (id),
    CHECK ((status = ANY (ARRAY['PENDING'::text, 'ACCEPTED'::text, 'EXPIRED'::text, 'REVOKED'::text]))),
    CHECK ((email ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,4}$'::text))
);

-- Table: user_roles
CREATE TABLE public.user_roles (,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    role_id uuid NOT NULL,
    assigned_by uuid,
    assigned_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at timestamp with time zone,
    scope_college_id uuid,
    scope_department text,
    scope_conditions jsonb,
    is_active boolean NOT NULL DEFAULT true,
    PRIMARY KEY (id)
);

-- Table: fee_receipt_allocations
CREATE TABLE public.fee_receipt_allocations (,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    receipt_id uuid NOT NULL,
    ledger_event_id uuid NOT NULL,
    fee_component_id uuid NOT NULL,
    allocated_amount numeric(12,2) NOT NULL,
    enrollment_id uuid NOT NULL,
    academic_year text NOT NULL,
    receipt_date date NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    legacy_record_id text,
    PRIMARY KEY (id),
    CHECK ((receipt_date <= CURRENT_DATE)),
    CHECK ((allocated_amount > (0)::numeric)),
    CHECK ((academic_year ~ '^\d{4}-\d{2}$'::text)),
    CHECK ((allocated_amount = round(allocated_amount, 2))),
    CHECK ((length(academic_year) <= 10))
);

-- Table: fee_plans
CREATE TABLE public.fee_plans (,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    legacy_id integer,
    course_id uuid NOT NULL,
    session_id uuid,
    name text NOT NULL,
    currency text NOT NULL DEFAULT 'INR'::text,
    status smallint NOT NULL DEFAULT 1,
    effective_start date NOT NULL DEFAULT CURRENT_DATE,
    effective_end date,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_by uuid,
    PRIMARY KEY (id),
    CHECK (((effective_end IS NULL) OR (effective_end > effective_start))),
    CHECK (((effective_end IS NULL) OR (effective_end > effective_start))),
    CHECK ((status = ANY (ARRAY[0, 1])))
);

-- Table: fee_plan_items
CREATE TABLE public.fee_plan_items (,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    fee_plan_id uuid NOT NULL,
    year_number smallint,
    amount numeric(12,2) NOT NULL,
    is_admission_phase boolean NOT NULL DEFAULT false,
    notes text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_by uuid,
    component_code text,
    component_id uuid NOT NULL,
    PRIMARY KEY (id),
    CHECK ((amount >= (0)::numeric))
);

-- Table: student_enrollments
CREATE TABLE public.student_enrollments (,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL,
    course_id uuid,
    session_id uuid,
    enrollment_code text,
    enrollment_date date NOT NULL,
    joining_date date,
    entry_year smallint,
    entry_type text NOT NULL DEFAULT 'regular'::text,
    agent_id uuid,
    fee_plan_id uuid,
    agent_commission_paid boolean NOT NULL DEFAULT false,
    status text NOT NULL DEFAULT 'active'::text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_by uuid,
    PRIMARY KEY (id),
    CHECK ((status = ANY (ARRAY['active'::text, 'suspended'::text, 'withdrawn'::text, 'transferred'::text, 'deleted'::text, 'completed'::text]))),
    CHECK ((entry_type = ANY (ARRAY['regular'::text, 'lateral'::text])))
);

-- Table: fee_adjustments
CREATE TABLE public.fee_adjustments (,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    enrollment_id uuid NOT NULL,
    academic_year text NOT NULL,
    fee_component_id uuid,
    adjustment_type USER-DEFINED NOT NULL,
    amount numeric(12,2) NOT NULL,
    title text NOT NULL,
    reason text NOT NULL,
    status USER-DEFINED NOT NULL DEFAULT 'ACTIVE'::fee_adjustment_status,
    effective_date date NOT NULL DEFAULT CURRENT_DATE,
    created_by uuid NOT NULL,
    created_at timestamp with time zone NOT NULL DEFAULT CURRENT_TIMESTAMP,
    cancelled_by uuid,
    cancelled_at timestamp with time zone,
    cancellation_reason text,
    legacy_adjustment_id text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    updated_at timestamp with time zone,
    updated_by uuid,
    PRIMARY KEY (id),
    CHECK ((length(title) <= 200)),
    CHECK ((amount > (0)::numeric)),
    CHECK ((((status = 'CANCELLED'::fee_adjustment_status) AND (cancelled_by IS NOT NULL) AND (cancelled_at IS NOT NULL)) OR (status <> 'CANCELLED'::fee_adjustment_status))),
    CHECK ((((status = 'CANCELLED'::fee_adjustment_status) AND (cancelled_by IS NOT NULL) AND (cancelled_at IS NOT NULL)) OR (status <> 'CANCELLED'::fee_adjustment_status))),
    CHECK ((((status = 'CANCELLED'::fee_adjustment_status) AND (cancelled_by IS NOT NULL) AND (cancelled_at IS NOT NULL)) OR (status <> 'CANCELLED'::fee_adjustment_status))),
    CHECK ((academic_year ~ '^\d{4}-\d{2}$'::text))
);

-- Table: fee_current_balances
CREATE TABLE public.fee_current_balances (,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    enrollment_id uuid NOT NULL,
    academic_year text,
    fee_component_id uuid,
    component_code text,
    component_name text,
    year_number integer,
    original_amount numeric(12,2) DEFAULT 0,
    override_amount numeric(12,2) DEFAULT 0,
    discount_amount numeric(12,2) DEFAULT 0,
    charged_amount numeric(12,2) DEFAULT 0,
    paid_amount numeric(12,2) DEFAULT 0,
    outstanding_amount numeric(12,2) DEFAULT 0,
    last_updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    last_updated_by uuid,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP,
    legacy_student_id integer,
    legacy_balance_id text,
    legacy_course_id integer,
    legacy_session_id integer,
    legacy_component_name text,
    source_system text DEFAULT 'manual'::text,
    import_batch_id uuid,
    migration_notes text,
    deleted_at timestamp with time zone,
    deleted_by uuid,
    PRIMARY KEY (id)
);

-- Table: student_fee_overrides
CREATE TABLE public.student_fee_overrides (,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    enrollment_id uuid NOT NULL,
    fee_plan_item_id uuid,
    year_number smallint,
    component_code text,
    override_amount numeric(12,2),
    discount_amount numeric(12,2),
    reason text,
    source text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    created_by uuid,
    updated_by uuid,
    PRIMARY KEY (id)
);

-- Table: student_progressions
CREATE TABLE public.student_progressions (,
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    enrollment_id uuid NOT NULL,
    from_year smallint,
    to_year smallint NOT NULL,
    course_duration smallint,
    effective_date date,
    status text NOT NULL,
    legacy_promotion_id integer,
    notes text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now(),
    PRIMARY KEY (id),
    CHECK ((status = ANY (ARRAY['new_admission'::text, 'promoted'::text, 'repeated'::text, 'withdrawn'::text])))
);

-- Add foreign key constraints
-- Foreign keys for fee_ledger_events
ALTER TABLE public.fee_ledger_events 
    ADD CONSTRAINT fee_ledger_events_fee_component_id_fkey 
    FOREIGN KEY (fee_component_id) 
    REFERENCES public.fee_components(id);
ALTER TABLE public.fee_ledger_events 
    ADD CONSTRAINT fk_fee_ledger_events_reference 
    FOREIGN KEY (reference_event_id) 
    REFERENCES public.fee_ledger_events(id);

-- Foreign keys for student_addresses
ALTER TABLE public.student_addresses 
    ADD CONSTRAINT student_addresses_student_id_fkey 
    FOREIGN KEY (student_id) 
    REFERENCES public.students(id)
    ON DELETE CASCADE;

-- Foreign keys for student_contacts
ALTER TABLE public.student_contacts 
    ADD CONSTRAINT student_contacts_student_id_fkey 
    FOREIGN KEY (student_id) 
    REFERENCES public.students(id)
    ON DELETE CASCADE;

-- Foreign keys for student_identity_documents
ALTER TABLE public.student_identity_documents 
    ADD CONSTRAINT student_identity_documents_student_id_fkey 
    FOREIGN KEY (student_id) 
    REFERENCES public.students(id)
    ON DELETE CASCADE;

-- Foreign keys for student_internal_refs
ALTER TABLE public.student_internal_refs 
    ADD CONSTRAINT student_internal_refs_student_id_fkey 
    FOREIGN KEY (student_id) 
    REFERENCES public.students(id)
    ON DELETE CASCADE;

-- Foreign keys for student_notes
ALTER TABLE public.student_notes 
    ADD CONSTRAINT student_notes_student_id_fkey 
    FOREIGN KEY (student_id) 
    REFERENCES public.students(id)
    ON DELETE CASCADE;

-- Foreign keys for student_prior_education
ALTER TABLE public.student_prior_education 
    ADD CONSTRAINT student_prior_education_student_id_fkey 
    FOREIGN KEY (student_id) 
    REFERENCES public.students(id)
    ON DELETE CASCADE;

-- Foreign keys for student_profiles
ALTER TABLE public.student_profiles 
    ADD CONSTRAINT student_profiles_student_id_fkey 
    FOREIGN KEY (student_id) 
    REFERENCES public.students(id)
    ON DELETE CASCADE;

-- Foreign keys for fee_receipt_balance_records
ALTER TABLE public.fee_receipt_balance_records 
    ADD CONSTRAINT fee_receipt_balance_records_fee_component_id_fkey 
    FOREIGN KEY (fee_component_id) 
    REFERENCES public.fee_components(id);
ALTER TABLE public.fee_receipt_balance_records 
    ADD CONSTRAINT fee_receipt_balance_records_receipt_id_fkey 
    FOREIGN KEY (receipt_id) 
    REFERENCES public.fee_receipts(id)
    ON DELETE CASCADE;

-- Foreign keys for courses
ALTER TABLE public.courses 
    ADD CONSTRAINT courses_college_id_fkey 
    FOREIGN KEY (college_id) 
    REFERENCES public.colleges(id)
    ON DELETE CASCADE;

-- Foreign keys for agent_contacts
ALTER TABLE public.agent_contacts 
    ADD CONSTRAINT agent_contacts_agent_id_fkey 
    FOREIGN KEY (agent_id) 
    REFERENCES public.agents(id)
    ON DELETE CASCADE;

-- Foreign keys for agent_notes
ALTER TABLE public.agent_notes 
    ADD CONSTRAINT agent_notes_agent_id_fkey 
    FOREIGN KEY (agent_id) 
    REFERENCES public.agents(id)
    ON DELETE CASCADE;
ALTER TABLE public.agent_notes 
    ADD CONSTRAINT agent_notes_student_id_fkey 
    FOREIGN KEY (student_id) 
    REFERENCES public.students(id);

-- Foreign keys for agent_tags
ALTER TABLE public.agent_tags 
    ADD CONSTRAINT agent_tags_agent_id_fkey 
    FOREIGN KEY (agent_id) 
    REFERENCES public.agents(id)
    ON DELETE CASCADE;

-- Foreign keys for external_user_profiles
ALTER TABLE public.external_user_profiles 
    ADD CONSTRAINT external_user_profiles_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES public.users(id)
    ON DELETE CASCADE;
ALTER TABLE public.external_user_profiles 
    ADD CONSTRAINT external_user_profiles_verified_by_fkey 
    FOREIGN KEY (verified_by) 
    REFERENCES public.users(id);

-- Foreign keys for role_permissions
ALTER TABLE public.role_permissions 
    ADD CONSTRAINT role_permissions_granted_by_fkey 
    FOREIGN KEY (granted_by) 
    REFERENCES public.users(id);
ALTER TABLE public.role_permissions 
    ADD CONSTRAINT role_permissions_permission_id_fkey 
    FOREIGN KEY (permission_id) 
    REFERENCES public.permissions(id)
    ON DELETE CASCADE;
ALTER TABLE public.role_permissions 
    ADD CONSTRAINT role_permissions_role_id_fkey 
    FOREIGN KEY (role_id) 
    REFERENCES public.roles(id)
    ON DELETE CASCADE;

-- Foreign keys for staff_profiles
ALTER TABLE public.staff_profiles 
    ADD CONSTRAINT staff_profiles_reports_to_user_id_fkey 
    FOREIGN KEY (reports_to_user_id) 
    REFERENCES public.users(id);
ALTER TABLE public.staff_profiles 
    ADD CONSTRAINT staff_profiles_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES public.users(id)
    ON DELETE CASCADE;

-- Foreign keys for student_user_profiles
ALTER TABLE public.student_user_profiles 
    ADD CONSTRAINT student_user_profiles_student_id_fkey 
    FOREIGN KEY (student_id) 
    REFERENCES public.students(id)
    ON DELETE CASCADE;
ALTER TABLE public.student_user_profiles 
    ADD CONSTRAINT student_user_profiles_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES public.users(id)
    ON DELETE CASCADE;

-- Foreign keys for user_invitations
ALTER TABLE public.user_invitations 
    ADD CONSTRAINT user_invitations_invited_by_fkey 
    FOREIGN KEY (invited_by) 
    REFERENCES public.users(id);
ALTER TABLE public.user_invitations 
    ADD CONSTRAINT user_invitations_pre_assigned_role_id_fkey 
    FOREIGN KEY (pre_assigned_role_id) 
    REFERENCES public.roles(id);
ALTER TABLE public.user_invitations 
    ADD CONSTRAINT user_invitations_used_by_fkey 
    FOREIGN KEY (used_by) 
    REFERENCES public.users(id);

-- Foreign keys for user_roles
ALTER TABLE public.user_roles 
    ADD CONSTRAINT user_roles_assigned_by_fkey 
    FOREIGN KEY (assigned_by) 
    REFERENCES public.users(id);
ALTER TABLE public.user_roles 
    ADD CONSTRAINT user_roles_role_id_fkey 
    FOREIGN KEY (role_id) 
    REFERENCES public.roles(id)
    ON DELETE CASCADE;
ALTER TABLE public.user_roles 
    ADD CONSTRAINT user_roles_user_id_fkey 
    FOREIGN KEY (user_id) 
    REFERENCES public.users(id)
    ON DELETE CASCADE;

-- Foreign keys for fee_receipt_allocations
ALTER TABLE public.fee_receipt_allocations 
    ADD CONSTRAINT fee_receipt_allocations_fee_component_id_fkey 
    FOREIGN KEY (fee_component_id) 
    REFERENCES public.fee_components(id);
ALTER TABLE public.fee_receipt_allocations 
    ADD CONSTRAINT fee_receipt_allocations_ledger_event_id_fkey 
    FOREIGN KEY (ledger_event_id) 
    REFERENCES public.fee_ledger_events(id);
ALTER TABLE public.fee_receipt_allocations 
    ADD CONSTRAINT fee_receipt_allocations_receipt_id_fkey 
    FOREIGN KEY (receipt_id) 
    REFERENCES public.fee_receipts(id)
    ON DELETE CASCADE;

-- Foreign keys for fee_plans
ALTER TABLE public.fee_plans 
    ADD CONSTRAINT fee_plans_course_id_fkey 
    FOREIGN KEY (course_id) 
    REFERENCES public.courses(id)
    ON DELETE CASCADE;
ALTER TABLE public.fee_plans 
    ADD CONSTRAINT fee_plans_session_id_fkey 
    FOREIGN KEY (session_id) 
    REFERENCES public.academic_sessions(id)
    ON DELETE SET NULL;

-- Foreign keys for fee_plan_items
ALTER TABLE public.fee_plan_items 
    ADD CONSTRAINT fee_plan_items_component_id_fkey 
    FOREIGN KEY (component_id) 
    REFERENCES public.fee_components(id)
    ON DELETE RESTRICT
    ON UPDATE CASCADE;
ALTER TABLE public.fee_plan_items 
    ADD CONSTRAINT fee_plan_items_fee_plan_id_fkey 
    FOREIGN KEY (fee_plan_id) 
    REFERENCES public.fee_plans(id)
    ON DELETE CASCADE;

-- Foreign keys for student_enrollments
ALTER TABLE public.student_enrollments 
    ADD CONSTRAINT student_enrollments_agent_id_fkey 
    FOREIGN KEY (agent_id) 
    REFERENCES public.agents(id)
    ON DELETE SET NULL;
ALTER TABLE public.student_enrollments 
    ADD CONSTRAINT student_enrollments_course_id_fkey 
    FOREIGN KEY (course_id) 
    REFERENCES public.courses(id)
    ON DELETE RESTRICT;
ALTER TABLE public.student_enrollments 
    ADD CONSTRAINT student_enrollments_fee_plan_id_fkey 
    FOREIGN KEY (fee_plan_id) 
    REFERENCES public.fee_plans(id)
    ON DELETE SET NULL;
ALTER TABLE public.student_enrollments 
    ADD CONSTRAINT student_enrollments_session_id_fkey 
    FOREIGN KEY (session_id) 
    REFERENCES public.academic_sessions(id)
    ON DELETE SET NULL;
ALTER TABLE public.student_enrollments 
    ADD CONSTRAINT student_enrollments_student_id_fkey 
    FOREIGN KEY (student_id) 
    REFERENCES public.students(id)
    ON DELETE CASCADE;

-- Foreign keys for fee_adjustments
ALTER TABLE public.fee_adjustments 
    ADD CONSTRAINT fee_adjustments_enrollment_id_fkey 
    FOREIGN KEY (enrollment_id) 
    REFERENCES public.student_enrollments(id)
    ON DELETE CASCADE;
ALTER TABLE public.fee_adjustments 
    ADD CONSTRAINT fee_adjustments_fee_component_id_fkey 
    FOREIGN KEY (fee_component_id) 
    REFERENCES public.fee_components(id)
    ON DELETE SET NULL;

-- Foreign keys for fee_current_balances
ALTER TABLE public.fee_current_balances 
    ADD CONSTRAINT fk_fee_current_balances_enrollment 
    FOREIGN KEY (enrollment_id) 
    REFERENCES public.student_enrollments(id);
ALTER TABLE public.fee_current_balances 
    ADD CONSTRAINT fk_fee_current_balances_fee_component 
    FOREIGN KEY (fee_component_id) 
    REFERENCES public.fee_components(id);

-- Foreign keys for student_fee_overrides
ALTER TABLE public.student_fee_overrides 
    ADD CONSTRAINT student_fee_overrides_enrollment_id_fkey 
    FOREIGN KEY (enrollment_id) 
    REFERENCES public.student_enrollments(id)
    ON DELETE CASCADE;
ALTER TABLE public.student_fee_overrides 
    ADD CONSTRAINT student_fee_overrides_fee_plan_item_id_fkey 
    FOREIGN KEY (fee_plan_item_id) 
    REFERENCES public.fee_plan_items(id)
    ON DELETE CASCADE;

-- Foreign keys for student_progressions
ALTER TABLE public.student_progressions 
    ADD CONSTRAINT student_progressions_enrollment_id_fkey 
    FOREIGN KEY (enrollment_id) 
    REFERENCES public.student_enrollments(id)
    ON DELETE CASCADE;

-- Create indexes
-- Indexes for fee_components
CREATE UNIQUE INDEX fee_components_code_key ON public.fee_components (code);

-- Indexes for students
CREATE UNIQUE INDEX students_legacy_student_id_key ON public.students (legacy_student_id);
CREATE UNIQUE INDEX idx_students_legacy ON public.students (legacy_student_id);
CREATE INDEX ix_students_full_name_trgm ON public.students (full_name gin_trgm_ops);

-- Indexes for roles
CREATE UNIQUE INDEX roles_name_key ON public.roles (name);
CREATE INDEX ix_roles_name ON public.roles (name) WHERE (is_active = true);
CREATE INDEX ix_roles_level ON public.roles (level DESC) WHERE (is_active = true);

-- Indexes for academic_sessions
CREATE UNIQUE INDEX academic_sessions_legacy_id_key ON public.academic_sessions (legacy_id);
CREATE INDEX idx_sessions_start ON public.academic_sessions (start_date);

-- Indexes for fee_receipts
CREATE INDEX ix_fee_receipts_enrollment_year ON public.fee_receipts (enrollment_id, academic_year) WHERE (deleted_at IS NULL);
CREATE INDEX ix_fee_receipts_receipt_date ON public.fee_receipts (receipt_date DESC) WHERE (deleted_at IS NULL);
CREATE INDEX ix_fee_receipts_status ON public.fee_receipts (status) WHERE (deleted_at IS NULL);
CREATE INDEX ix_fee_receipts_payment_method ON public.fee_receipts (payment_method) WHERE (deleted_at IS NULL);
CREATE INDEX ix_fee_receipts_legacy_receipt_id ON public.fee_receipts (legacy_receipt_id) WHERE (legacy_receipt_id IS NOT NULL);
CREATE INDEX ix_fee_receipts_receipt_number ON public.fee_receipts (receipt_number) WHERE (deleted_at IS NULL);
CREATE INDEX ix_fee_receipts_total_amount ON public.fee_receipts (total_amount) WHERE ((deleted_at IS NULL) AND (total_amount > (0)::numeric));
CREATE INDEX ix_fee_receipts_enrollment_date ON public.fee_receipts (enrollment_id, receipt_date DESC);
CREATE INDEX ix_fee_receipts_recent_active ON public.fee_receipts (enrollment_id, receipt_date DESC) WHERE ((deleted_at IS NULL) AND (status = 'ACTIVE'::receipt_status_type));
CREATE INDEX ix_fee_receipts_is_edited ON public.fee_receipts (is_edited) WHERE (deleted_at IS NULL);

-- Indexes for system_config
CREATE UNIQUE INDEX system_config_key_key ON public.system_config (key);

-- Indexes for colleges
CREATE UNIQUE INDEX colleges_legacy_id_key ON public.colleges (legacy_id);
CREATE UNIQUE INDEX idx_colleges_code_unique ON public.colleges (code) WHERE (code IS NOT NULL);
CREATE INDEX idx_colleges_status ON public.colleges (status);

-- Indexes for permissions
CREATE UNIQUE INDEX permissions_name_key ON public.permissions (name);
CREATE UNIQUE INDEX uk_permissions_resource_operation ON public.permissions (resource_type, operation, scope_level);
CREATE INDEX ix_permissions_resource_operation ON public.permissions (resource_type, operation) WHERE (is_active = true);
CREATE INDEX ix_permissions_scope ON public.permissions (scope_level) WHERE (is_active = true);
CREATE INDEX ix_permissions_resource_operation_scope ON public.permissions (resource_type, operation, scope_level) WHERE (is_active = true);

-- Indexes for report_templates
CREATE INDEX ix_report_templates_owner ON public.report_templates (created_by, visibility);

-- Indexes for agents
CREATE UNIQUE INDEX agents_legacy_id_key ON public.agents (legacy_id);
CREATE INDEX idx_agents_status ON public.agents (status);
CREATE INDEX idx_agents_email ON public.agents (email);
CREATE INDEX idx_agents_phone_e164 ON public.agents (phone_e164);

-- Indexes for users
CREATE UNIQUE INDEX users_email_key ON public.users (email);
CREATE UNIQUE INDEX users_username_key ON public.users (username);
CREATE UNIQUE INDEX users_supabase_auth_id_key ON public.users (supabase_auth_id);
CREATE INDEX ix_users_email ON public.users (email) WHERE (deleted_at IS NULL);
CREATE INDEX ix_users_supabase_auth_id ON public.users (supabase_auth_id) WHERE (supabase_auth_id IS NOT NULL);
CREATE INDEX ix_users_status ON public.users (status) WHERE (deleted_at IS NULL);
CREATE INDEX ix_users_last_login ON public.users (last_login_at DESC) WHERE (deleted_at IS NULL);

-- Indexes for fee_ledger_events
CREATE INDEX ix_fee_ledger_events_enrollment_year ON public.fee_ledger_events (enrollment_id, academic_year) WHERE (deleted_at IS NULL);
CREATE INDEX ix_fee_ledger_events_component_date ON public.fee_ledger_events (fee_component_id, event_date DESC) WHERE (deleted_at IS NULL);
CREATE INDEX ix_fee_ledger_events_receipt_id ON public.fee_ledger_events (receipt_id) WHERE ((receipt_id IS NOT NULL) AND (deleted_at IS NULL));
CREATE INDEX ix_fee_ledger_events_legacy_receipt_id ON public.fee_ledger_events (legacy_receipt_id) WHERE (legacy_receipt_id IS NOT NULL);
CREATE INDEX ix_fee_ledger_events_event_type ON public.fee_ledger_events (event_type) WHERE (deleted_at IS NULL);
CREATE INDEX ix_fee_ledger_events_event_date ON public.fee_ledger_events (event_date DESC) WHERE (deleted_at IS NULL);
CREATE INDEX ix_fee_ledger_events_amount ON public.fee_ledger_events (amount) WHERE ((deleted_at IS NULL) AND (amount <> (0)::numeric));

-- Indexes for student_addresses
CREATE UNIQUE INDEX student_addresses_student_id_addr_type_key ON public.student_addresses (student_id, addr_type);

-- Indexes for student_contacts
CREATE UNIQUE INDEX student_contacts_student_id_contact_type_value_norm_key ON public.student_contacts (student_id, contact_type, value_norm);
CREATE INDEX idx_student_contacts_student ON public.student_contacts (student_id);

-- Indexes for student_identity_documents
CREATE INDEX idx_student_identity_docs_student ON public.student_identity_documents (student_id);

-- Indexes for student_internal_refs
CREATE UNIQUE INDEX student_internal_refs_student_id_ref_group_slot_number_key ON public.student_internal_refs (student_id, ref_group, slot_number);

-- Indexes for student_prior_education
CREATE INDEX idx_student_prior_ed_student ON public.student_prior_education (student_id);

-- Indexes for fee_receipt_balance_records
CREATE UNIQUE INDEX uk_fee_receipt_balance_records_receipt_component ON public.fee_receipt_balance_records (receipt_id, fee_component_id);
CREATE INDEX ix_fee_receipt_balance_records_receipt_id ON public.fee_receipt_balance_records (receipt_id);
CREATE INDEX ix_fee_receipt_balance_records_component_id ON public.fee_receipt_balance_records (fee_component_id);
CREATE INDEX ix_fee_receipt_balance_records_enrollment_year ON public.fee_receipt_balance_records (enrollment_id, academic_year);
CREATE INDEX ix_fee_receipt_balance_records_component_year ON public.fee_receipt_balance_records (fee_component_id, academic_year);
CREATE INDEX ix_fee_receipt_balance_records_receipt_date ON public.fee_receipt_balance_records (receipt_date DESC);
CREATE INDEX ix_fee_receipt_balance_records_balance_amount ON public.fee_receipt_balance_records (balance_amount) WHERE (balance_amount > (0)::numeric);

-- Indexes for courses
CREATE UNIQUE INDEX courses_legacy_id_key ON public.courses (course_identity);
CREATE INDEX idx_courses_college ON public.courses (college_id);
CREATE INDEX ix_courses_college_id ON public.courses (college_id);

-- Indexes for agent_contacts
CREATE UNIQUE INDEX agent_contacts_agent_id_contact_type_value_norm_key ON public.agent_contacts (agent_id, contact_type, value_norm);
CREATE INDEX idx_agent_contacts_type ON public.agent_contacts (contact_type);

-- Indexes for external_user_profiles
CREATE UNIQUE INDEX external_user_profiles_user_id_key ON public.external_user_profiles (user_id);

-- Indexes for role_permissions
CREATE UNIQUE INDEX uk_role_permissions_role_permission ON public.role_permissions (role_id, permission_id);
CREATE INDEX ix_role_permissions_active ON public.role_permissions (role_id, permission_id) WHERE (is_active = true);

-- Indexes for staff_profiles
CREATE UNIQUE INDEX staff_profiles_user_id_key ON public.staff_profiles (user_id);
CREATE UNIQUE INDEX staff_profiles_employee_id_key ON public.staff_profiles (employee_id);
CREATE INDEX ix_staff_profiles_employee_id ON public.staff_profiles (employee_id) WHERE (deleted_at IS NULL);
CREATE INDEX ix_staff_profiles_department ON public.staff_profiles (department) WHERE (deleted_at IS NULL);
CREATE INDEX ix_staff_profiles_reports_to ON public.staff_profiles (reports_to_user_id) WHERE (deleted_at IS NULL);

-- Indexes for student_user_profiles
CREATE UNIQUE INDEX student_user_profiles_user_id_key ON public.student_user_profiles (user_id);
CREATE UNIQUE INDEX student_user_profiles_student_id_key ON public.student_user_profiles (student_id);

-- Indexes for user_invitations
CREATE UNIQUE INDEX uk_user_invitations_email_pending ON public.user_invitations (email);
CREATE UNIQUE INDEX ix_user_invitations_email_pending ON public.user_invitations (email) WHERE (status = 'PENDING'::text);

-- Indexes for user_roles
CREATE UNIQUE INDEX uk_user_roles_user_role_scope ON public.user_roles (user_id, role_id, scope_college_id, scope_department);
CREATE INDEX ix_user_roles_user_id ON public.user_roles (user_id) WHERE (is_active = true);
CREATE INDEX ix_user_roles_role_id ON public.user_roles (role_id) WHERE (is_active = true);
CREATE INDEX ix_user_roles_expires_at ON public.user_roles (expires_at) WHERE (expires_at IS NOT NULL);
CREATE INDEX ix_user_roles_expires_at_active ON public.user_roles (expires_at) WHERE ((is_active = true) AND (expires_at IS NOT NULL));
CREATE INDEX ix_user_roles_scope_college ON public.user_roles (scope_college_id) WHERE (scope_college_id IS NOT NULL);
CREATE INDEX ix_user_roles_scope_department ON public.user_roles (scope_department) WHERE (scope_department IS NOT NULL);

-- Indexes for fee_receipt_allocations
CREATE UNIQUE INDEX uk_fee_receipt_allocations_receipt_component ON public.fee_receipt_allocations (receipt_id, fee_component_id);
CREATE INDEX ix_fee_receipt_allocations_receipt_id ON public.fee_receipt_allocations (receipt_id);
CREATE INDEX ix_fee_receipt_allocations_component_id ON public.fee_receipt_allocations (fee_component_id);
CREATE INDEX ix_fee_receipt_allocations_enrollment_year ON public.fee_receipt_allocations (enrollment_id, academic_year);
CREATE INDEX ix_fee_receipt_allocations_component_year ON public.fee_receipt_allocations (fee_component_id, academic_year);
CREATE INDEX ix_fee_receipt_allocations_receipt_date ON public.fee_receipt_allocations (receipt_date DESC);
CREATE INDEX ix_fee_receipt_allocations_allocated_amount ON public.fee_receipt_allocations (allocated_amount) WHERE (allocated_amount > (0)::numeric);
CREATE INDEX ix_fee_receipt_allocations_legacy_record_id ON public.fee_receipt_allocations (legacy_record_id) WHERE (legacy_record_id IS NOT NULL);

-- Indexes for fee_plans
CREATE UNIQUE INDEX fee_plans_legacy_id_key ON public.fee_plans (legacy_id);
CREATE INDEX idx_fee_plans_course ON public.fee_plans (course_id);
CREATE INDEX idx_fee_plans_session ON public.fee_plans (session_id);

-- Indexes for fee_plan_items
CREATE INDEX idx_fee_plan_items_plan ON public.fee_plan_items (fee_plan_id);
CREATE INDEX idx_fee_plan_items_year ON public.fee_plan_items (year_number);
CREATE INDEX idx_fee_plan_items_component_id ON public.fee_plan_items (component_id);

-- Indexes for student_enrollments
CREATE UNIQUE INDEX student_enrollments_student_id_course_id_session_id_key ON public.student_enrollments (student_id, course_id, session_id);
CREATE INDEX idx_student_enrollments_student ON public.student_enrollments (student_id);
CREATE INDEX idx_student_enrollments_agent ON public.student_enrollments (agent_id);
CREATE INDEX ix_student_enrollments_session ON public.student_enrollments (session_id);
CREATE INDEX ix_student_enrollments_course ON public.student_enrollments (course_id);
CREATE INDEX ix_student_enrollments_code ON public.student_enrollments (enrollment_code);
CREATE INDEX ix_student_enrollments_code_trgm ON public.student_enrollments (enrollment_code gin_trgm_ops);
CREATE INDEX ix_student_enrollments_course_session ON public.student_enrollments (course_id, session_id);

-- Indexes for fee_adjustments
CREATE INDEX ix_fee_adjustments_enrollment_year ON public.fee_adjustments (enrollment_id, academic_year) WHERE (deleted_at IS NULL);
CREATE INDEX ix_fee_adjustments_component_type ON public.fee_adjustments (fee_component_id, adjustment_type) WHERE (deleted_at IS NULL);
CREATE INDEX ix_fee_adjustments_status_date ON public.fee_adjustments (status, created_at DESC) WHERE (deleted_at IS NULL);
CREATE INDEX ix_fee_adjustments_effective_date ON public.fee_adjustments (effective_date) WHERE (deleted_at IS NULL);
CREATE INDEX ix_fee_adjustments_created_by ON public.fee_adjustments (created_by, created_at DESC) WHERE (deleted_at IS NULL);
CREATE INDEX ix_fee_adjustments_legacy_id ON public.fee_adjustments (legacy_adjustment_id) WHERE (legacy_adjustment_id IS NOT NULL);
CREATE INDEX ix_fee_adjustments_updated_at ON public.fee_adjustments (updated_at DESC) WHERE (deleted_at IS NULL);
CREATE INDEX ix_fee_adjustments_updated_by ON public.fee_adjustments (updated_by) WHERE (deleted_at IS NULL);

-- Indexes for fee_current_balances
CREATE INDEX ix_fee_current_balances_enrollment_id ON public.fee_current_balances (enrollment_id);
CREATE INDEX ix_fee_current_balances_component_code ON public.fee_current_balances (component_code);
CREATE INDEX ix_fee_current_balances_legacy_student_id ON public.fee_current_balances (legacy_student_id);
CREATE INDEX ix_fee_current_balances_source_system ON public.fee_current_balances (source_system) WHERE (deleted_at IS NULL);
CREATE INDEX ix_fee_current_balances_import_batch ON public.fee_current_balances (import_batch_id) WHERE (import_batch_id IS NOT NULL);
CREATE INDEX ix_fee_current_balances_student_outstanding ON public.fee_current_balances (enrollment_id, outstanding_amount) WHERE ((outstanding_amount > (0)::numeric) AND (deleted_at IS NULL));
CREATE INDEX ix_fee_current_balances_year_component ON public.fee_current_balances (academic_year, component_code) WHERE (deleted_at IS NULL);
CREATE INDEX idx_fee_current_balances_fee_component_id ON public.fee_current_balances (fee_component_id);
CREATE INDEX idx_fee_current_balances_enrollment_id ON public.fee_current_balances (enrollment_id);
CREATE INDEX idx_fee_current_balances_academic_year ON public.fee_current_balances (academic_year);
CREATE INDEX idx_fee_current_balances_year_number ON public.fee_current_balances (year_number);
CREATE INDEX idx_fee_current_balances_enrollment_year ON public.fee_current_balances (enrollment_id, academic_year, year_number);

-- Indexes for student_fee_overrides
CREATE UNIQUE INDEX student_fee_overrides_enrollment_id_fee_plan_item_id_key ON public.student_fee_overrides (enrollment_id, fee_plan_item_id);
CREATE INDEX idx_student_fee_overrides_enrollment ON public.student_fee_overrides (enrollment_id);
CREATE INDEX idx_student_fee_overrides_created_by ON public.student_fee_overrides (created_by);
CREATE INDEX idx_student_fee_overrides_updated_by ON public.student_fee_overrides (updated_by);

-- Indexes for student_progressions
CREATE INDEX idx_student_progressions_enrollment ON public.student_progressions (enrollment_id);
CREATE INDEX ix_student_progressions_enrollment_effdate_desc ON public.student_progressions (enrollment_id, effective_date DESC);
CREATE INDEX ix_student_progressions_enrollment_eff_created_desc ON public.student_progressions (enrollment_id, effective_date DESC, created_at DESC);

