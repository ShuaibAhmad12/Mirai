-- 007_rbac_user_management.sql
-- Comprehensive Role-Based Access Control (RBAC) System
-- Author: Alpine Education System
-- Purpose: User management, roles, permissions, and profiles for all system users

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- ENUM TYPES FOR RBAC SYSTEM
-- ============================================================================

-- User account status
CREATE TYPE user_status_type AS ENUM (
    'ACTIVE',
    'INACTIVE', 
    'SUSPENDED',
    'PENDING_VERIFICATION',
    'LOCKED',
    'EXPIRED'
);

-- Permission operation types
CREATE TYPE permission_operation_type AS ENUM (
    'CREATE',
    'READ',
    'UPDATE',
    'DELETE',
    'APPROVE',
    'REJECT',
    'EXPORT',
    'IMPORT',
    'BULK_UPDATE',
    'REPORT_VIEW',
    'ADMIN_ACCESS'
);

-- Resource/module types in the system
CREATE TYPE resource_type AS ENUM (
    'STUDENTS',
    'STAFF',
    'COURSES',
    'FEES',
    'ADMISSIONS',
    'ACADEMIC_SESSIONS',
    'REPORTS',
    'USER_MANAGEMENT',
    'SYSTEM_SETTINGS',
    'AUDIT_LOGS',
    'NOTIFICATIONS',
    'ASSESSMENTS',
    'ATTENDANCE',
    'LIBRARY',
    'HOSTELS',
    'TRANSPORT',
    'INVENTORY'
);

-- Employment types for staff
CREATE TYPE employment_type AS ENUM (
    'FULL_TIME',
    'PART_TIME',
    'CONTRACT',
    'VISITING',
    'EMERITUS',
    'INTERN'
);

-- Department types
CREATE TYPE department_type AS ENUM (
    'ACADEMIC',
    'ADMINISTRATION',
    'FINANCE',
    'HR',
    'IT',
    'LIBRARY',
    'HOSTELS',
    'TRANSPORT',
    'MAINTENANCE',
    'SECURITY'
);

-- ============================================================================
-- CORE RBAC TABLES
-- ============================================================================

-- Core users table (all system users)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Authentication fields
    email TEXT NOT NULL UNIQUE CHECK (email ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,4}$'),
    phone TEXT CHECK (length(phone) <= 15),
    username TEXT UNIQUE CHECK (length(username) <= 50),
    
    -- Supabase auth integration
    supabase_auth_id UUID UNIQUE, -- Links to auth.users.id in Supabase
    
    -- Profile basics
    first_name TEXT NOT NULL CHECK (length(first_name) <= 100),
    last_name TEXT NOT NULL CHECK (length(last_name) <= 100),
    full_name TEXT GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
    
    -- Account management
    status user_status_type NOT NULL DEFAULT 'PENDING_VERIFICATION',
    is_system_admin BOOLEAN NOT NULL DEFAULT FALSE,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMPTZ,
    email_verified_at TIMESTAMPTZ,
    
    -- Soft delete
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    
    -- Metadata
    created_by UUID,
    updated_by UUID,
    
    CONSTRAINT chk_users_name_length CHECK (length(first_name) >= 2 AND length(last_name) >= 2)
);

-- Roles table (predefined system roles)
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Role identification
    name TEXT NOT NULL UNIQUE CHECK (length(name) <= 50),
    display_name TEXT NOT NULL CHECK (length(display_name) <= 100),
    description TEXT,
    
    -- Role hierarchy and constraints
    level INTEGER NOT NULL DEFAULT 0, -- Higher number = higher privilege
    is_system_role BOOLEAN NOT NULL DEFAULT FALSE, -- Cannot be deleted
    max_users INTEGER, -- NULL = unlimited
    
    -- Role status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Metadata
    created_by UUID,
    updated_by UUID,
    
    CONSTRAINT chk_roles_level CHECK (level >= 0 AND level <= 100)
);

-- Permissions table (granular permissions)
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Permission identification
    name TEXT NOT NULL UNIQUE CHECK (length(name) <= 100),
    display_name TEXT NOT NULL CHECK (length(display_name) <= 150),
    description TEXT,
    
    -- Permission categorization
    resource_type resource_type NOT NULL,
    operation permission_operation_type NOT NULL,
    
    -- Permission constraints
    scope_level TEXT DEFAULT 'GLOBAL', -- GLOBAL, COLLEGE, DEPARTMENT, COURSE, SELF
    conditions JSONB, -- Additional conditions/filters
    
    -- System flags
    is_system_permission BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT uk_permissions_resource_operation UNIQUE(resource_type, operation, scope_level),
    CONSTRAINT chk_permissions_scope CHECK (scope_level IN ('GLOBAL', 'COLLEGE', 'DEPARTMENT', 'COURSE', 'SELF'))
);

-- Role-Permission mapping (many-to-many)
CREATE TABLE role_permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    
    -- Permission constraints for this role
    granted_by UUID REFERENCES users(id),
    granted_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Conditions/restrictions
    conditions JSONB, -- Additional role-specific conditions
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    CONSTRAINT uk_role_permissions_role_permission UNIQUE(role_id, permission_id)
);

-- User-Role assignments (many-to-many)
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    
    -- Assignment details
    assigned_by UUID REFERENCES users(id),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ, -- NULL = no expiration
    
    -- Scope constraints (for department-specific roles, etc.)
    scope_college_id UUID, -- REFERENCES colleges(id) when applicable
    scope_department TEXT,
    scope_conditions JSONB,
    
    -- Status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    
    CONSTRAINT uk_user_roles_user_role_scope UNIQUE(user_id, role_id, scope_college_id, scope_department)
);

-- ============================================================================
-- PROFILE TABLES (Type-specific user profiles)
-- ============================================================================

-- Staff profiles
CREATE TABLE staff_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Link to user
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    
    -- Employment details
    employee_id TEXT UNIQUE CHECK (length(employee_id) <= 20),
    employment_type employment_type NOT NULL,
    department department_type NOT NULL,
    designation TEXT NOT NULL CHECK (length(designation) <= 100),
    
    -- Employment dates
    joining_date DATE NOT NULL,
    confirmation_date DATE,
    retirement_date DATE,
    
    -- Reporting structure
    reports_to_user_id UUID REFERENCES users(id), -- Manager/supervisor
    
    -- Contact and personal details
    official_email TEXT CHECK (official_email ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,4}$'),
    office_phone TEXT CHECK (length(office_phone) <= 15),
    office_location TEXT CHECK (length(office_location) <= 200),
    
    -- Personal information
    date_of_birth DATE,
    gender TEXT CHECK (gender IN ('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY')),
    nationality TEXT CHECK (length(nationality) <= 50),
    
    -- Emergency contact
    emergency_contact_name TEXT CHECK (length(emergency_contact_name) <= 100),
    emergency_contact_phone TEXT CHECK (length(emergency_contact_phone) <= 15),
    emergency_contact_relation TEXT CHECK (length(emergency_contact_relation) <= 50),
    
    -- Employment status
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    termination_date DATE,
    termination_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Metadata
    created_by UUID,
    updated_by UUID,
    
    -- Soft delete
    deleted_at TIMESTAMPTZ,
    deleted_by UUID,
    
    CONSTRAINT chk_staff_profiles_employment_dates CHECK (
        joining_date <= COALESCE(confirmation_date, CURRENT_DATE) AND
        joining_date <= COALESCE(retirement_date, CURRENT_DATE) AND
        joining_date <= COALESCE(termination_date, CURRENT_DATE)
    )
);

-- Student profiles (linking to existing students table)
CREATE TABLE student_user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Links
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    student_id UUID NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
    
    -- Student-specific access details
    parent_email TEXT CHECK (parent_email ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,4}$'),
    parent_phone TEXT CHECK (length(parent_phone) <= 15),
    
    -- Access permissions for parents/guardians
    allow_parent_access BOOLEAN NOT NULL DEFAULT TRUE,
    parent_access_level TEXT DEFAULT 'VIEW_ONLY' CHECK (parent_access_level IN ('VIEW_ONLY', 'LIMITED', 'FULL')),
    
    -- Student portal preferences
    preferred_language TEXT DEFAULT 'EN' CHECK (length(preferred_language) <= 5),
    notification_preferences JSONB DEFAULT '{"email": true, "sms": false, "push": true}',
    
    -- Academic year and status
    current_academic_year TEXT CHECK (current_academic_year ~ '^\d{4}-\d{2}$'),
    is_alumni BOOLEAN NOT NULL DEFAULT FALSE,
    graduation_year INTEGER,
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Metadata
    created_by UUID,
    updated_by UUID
);

-- External user profiles (for third-party integrations)
CREATE TABLE external_user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Link to user
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    
    -- External system details
    external_system TEXT NOT NULL CHECK (length(external_system) <= 50), -- 'GOVERNMENT', 'PARTNER_INSTITUTION', etc.
    external_user_id TEXT CHECK (length(external_user_id) <= 100),
    
    -- Organization details
    organization_name TEXT NOT NULL CHECK (length(organization_name) <= 200),
    organization_type TEXT CHECK (length(organization_type) <= 50),
    
    -- Contact person details
    contact_person_name TEXT CHECK (length(contact_person_name) <= 100),
    contact_person_email TEXT CHECK (contact_person_email ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,4}$'),
    contact_person_phone TEXT CHECK (length(contact_person_phone) <= 15),
    
    -- Access details
    access_purpose TEXT CHECK (length(access_purpose) <= 500),
    access_start_date DATE NOT NULL,
    access_end_date DATE,
    
    -- Status
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    verification_date TIMESTAMPTZ,
    verified_by UUID REFERENCES users(id),
    
    -- Timestamps
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    -- Metadata
    created_by UUID,
    updated_by UUID,
    
    CONSTRAINT chk_external_user_profiles_access_dates CHECK (access_start_date <= COALESCE(access_end_date, CURRENT_DATE))
);

-- ============================================================================
-- PREDEFINED ROLES AND PERMISSIONS SETUP
-- ============================================================================

-- Insert system roles
INSERT INTO roles (name, display_name, description, level, is_system_role) VALUES
-- Administrative Roles
('SUPER_ADMIN', 'Super Administrator', 'Full system access with all permissions', 100, TRUE),
('SYSTEM_ADMIN', 'System Administrator', 'System configuration and user management', 90, TRUE),
('COLLEGE_ADMIN', 'College Administrator', 'College-level administration and oversight', 80, TRUE),

-- Academic Roles
('PRINCIPAL', 'Principal', 'Overall academic and administrative leadership', 75, TRUE),
('VICE_PRINCIPAL', 'Vice Principal', 'Academic administration and student affairs', 70, TRUE),
('DEAN', 'Dean', 'Faculty and departmental oversight', 65, TRUE),
('HOD', 'Head of Department', 'Department-level academic leadership', 60, TRUE),
('PROFESSOR', 'Professor', 'Senior faculty with administrative responsibilities', 50, TRUE),
('ASSOCIATE_PROFESSOR', 'Associate Professor', 'Mid-level faculty member', 45, TRUE),
('ASSISTANT_PROFESSOR', 'Assistant Professor', 'Junior faculty member', 40, TRUE),
('LECTURER', 'Lecturer', 'Teaching staff', 35, TRUE),

-- Administrative Staff Roles
('REGISTRAR', 'Registrar', 'Academic records and student administration', 55, TRUE),
('FINANCE_MANAGER', 'Finance Manager', 'Financial operations and fee management', 55, TRUE),
('HR_MANAGER', 'HR Manager', 'Human resources and staff management', 55, TRUE),
('IT_ADMIN', 'IT Administrator', 'Technical support and system maintenance', 50, TRUE),
('ACCOUNTANT', 'Accountant', 'Financial transactions and accounting', 40, TRUE),
('CLERK', 'Administrative Clerk', 'General administrative support', 30, TRUE),

-- Student Support Roles
('ADMISSION_OFFICER', 'Admission Officer', 'Student admissions and enrollment', 45, TRUE),
('STUDENT_COUNSELOR', 'Student Counselor', 'Student guidance and support services', 40, TRUE),
('LIBRARIAN', 'Librarian', 'Library management and resources', 40, TRUE),
('HOSTEL_WARDEN', 'Hostel Warden', 'Student accommodation management', 40, TRUE),

-- Specialized Roles
('EXAM_CONTROLLER', 'Examination Controller', 'Examination management and conduct', 50, TRUE),
('PLACEMENT_OFFICER', 'Placement Officer', 'Career services and placements', 40, TRUE),
('TRANSPORT_MANAGER', 'Transport Manager', 'Transportation services management', 35, TRUE),

-- Student Role
('STUDENT', 'Student', 'Enrolled student with academic access', 10, TRUE),

-- External Roles
('PARENT_GUARDIAN', 'Parent/Guardian', 'Parent or guardian access to student information', 5, TRUE),
('EXTERNAL_AUDITOR', 'External Auditor', 'External auditing and compliance review', 20, TRUE),
('GUEST_USER', 'Guest User', 'Limited access for external users', 1, TRUE);

-- Insert system permissions
INSERT INTO permissions (name, display_name, description, resource_type, operation, scope_level, is_system_permission) VALUES
-- User Management Permissions
('USER_MANAGEMENT_CREATE', 'Create Users', 'Create new user accounts', 'USER_MANAGEMENT', 'CREATE', 'GLOBAL', TRUE),
('USER_MANAGEMENT_READ', 'View Users', 'View user information and profiles', 'USER_MANAGEMENT', 'READ', 'GLOBAL', TRUE),
('USER_MANAGEMENT_UPDATE', 'Update Users', 'Modify user accounts and profiles', 'USER_MANAGEMENT', 'UPDATE', 'GLOBAL', TRUE),
('USER_MANAGEMENT_DELETE', 'Delete Users', 'Delete or deactivate user accounts', 'USER_MANAGEMENT', 'DELETE', 'GLOBAL', TRUE),

-- Student Management Permissions
('STUDENTS_CREATE', 'Add Students', 'Register new students', 'STUDENTS', 'CREATE', 'COLLEGE', TRUE),
('STUDENTS_READ', 'View Students', 'View student information', 'STUDENTS', 'READ', 'COLLEGE', TRUE),
('STUDENTS_UPDATE', 'Update Students', 'Modify student records', 'STUDENTS', 'UPDATE', 'COLLEGE', TRUE),
('STUDENTS_DELETE', 'Remove Students', 'Remove or transfer students', 'STUDENTS', 'DELETE', 'COLLEGE', TRUE),
('STUDENTS_BULK_UPDATE', 'Bulk Update Students', 'Perform bulk operations on student data', 'STUDENTS', 'BULK_UPDATE', 'COLLEGE', TRUE),

-- Staff Management Permissions
('STAFF_CREATE', 'Add Staff', 'Register new staff members', 'STAFF', 'CREATE', 'COLLEGE', TRUE),
('STAFF_READ', 'View Staff', 'View staff information', 'STAFF', 'READ', 'COLLEGE', TRUE),
('STAFF_UPDATE', 'Update Staff', 'Modify staff records', 'STAFF', 'UPDATE', 'COLLEGE', TRUE),
('STAFF_DELETE', 'Remove Staff', 'Remove or transfer staff', 'STAFF', 'DELETE', 'COLLEGE', TRUE),

-- Fee Management Permissions
('FEES_CREATE', 'Create Fee Records', 'Create fee structures and receipts', 'FEES', 'CREATE', 'COLLEGE', TRUE),
('FEES_READ', 'View Fees', 'View fee information and reports', 'FEES', 'READ', 'COLLEGE', TRUE),
('FEES_UPDATE', 'Update Fees', 'Modify fee records and structures', 'FEES', 'UPDATE', 'COLLEGE', TRUE),
('FEES_DELETE', 'Delete Fee Records', 'Remove fee records', 'FEES', 'DELETE', 'COLLEGE', TRUE),
('FEES_APPROVE', 'Approve Fee Transactions', 'Approve fee payments and adjustments', 'FEES', 'APPROVE', 'COLLEGE', TRUE),

-- Academic Management Permissions
('COURSES_CREATE', 'Create Courses', 'Create new courses and programs', 'COURSES', 'CREATE', 'COLLEGE', TRUE),
('COURSES_READ', 'View Courses', 'View course information', 'COURSES', 'READ', 'COLLEGE', TRUE),
('COURSES_UPDATE', 'Update Courses', 'Modify course details', 'COURSES', 'UPDATE', 'COLLEGE', TRUE),
('COURSES_DELETE', 'Delete Courses', 'Remove courses', 'COURSES', 'DELETE', 'COLLEGE', TRUE),

-- Reporting Permissions
('REPORTS_VIEW', 'View Reports', 'Access system reports and analytics', 'REPORTS', 'REPORT_VIEW', 'COLLEGE', TRUE),
('REPORTS_EXPORT', 'Export Reports', 'Export reports and data', 'REPORTS', 'EXPORT', 'COLLEGE', TRUE),

-- System Administration Permissions
('SYSTEM_ADMIN_ACCESS', 'System Administration', 'Access system configuration and settings', 'SYSTEM_SETTINGS', 'ADMIN_ACCESS', 'GLOBAL', TRUE),
('AUDIT_LOGS_READ', 'View Audit Logs', 'View system audit trails', 'AUDIT_LOGS', 'READ', 'GLOBAL', TRUE);

-- ============================================================================
-- ROLE-PERMISSION ASSIGNMENTS (Basic Setup)
-- ============================================================================

-- Super Admin gets all permissions
INSERT INTO role_permissions (role_id, permission_id, granted_at)
SELECT r.id, p.id, CURRENT_TIMESTAMP
FROM roles r, permissions p
WHERE r.name = 'SUPER_ADMIN';

-- System Admin gets most permissions except super admin functions
INSERT INTO role_permissions (role_id, permission_id, granted_at)
SELECT r.id, p.id, CURRENT_TIMESTAMP
FROM roles r, permissions p
WHERE r.name = 'SYSTEM_ADMIN'
  AND p.name NOT IN ('USER_MANAGEMENT_DELETE', 'SYSTEM_ADMIN_ACCESS');

-- College Admin gets college-level permissions
INSERT INTO role_permissions (role_id, permission_id, granted_at)
SELECT r.id, p.id, CURRENT_TIMESTAMP
FROM roles r, permissions p
WHERE r.name = 'COLLEGE_ADMIN'
  AND p.scope_level IN ('COLLEGE', 'DEPARTMENT', 'COURSE');

-- Finance Manager gets fee-related permissions
INSERT INTO role_permissions (role_id, permission_id, granted_at)
SELECT r.id, p.id, CURRENT_TIMESTAMP
FROM roles r, permissions p
WHERE r.name = 'FINANCE_MANAGER'
  AND p.resource_type = 'FEES';

-- Student gets limited read access
INSERT INTO role_permissions (role_id, permission_id, granted_at)
SELECT r.id, p.id, CURRENT_TIMESTAMP
FROM roles r, permissions p
WHERE r.name = 'STUDENT'
  AND p.operation = 'READ'
  AND p.resource_type IN ('STUDENTS', 'FEES', 'COURSES')
  AND p.scope_level = 'SELF';

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Users table indexes
CREATE INDEX ix_users_email ON users(email) WHERE deleted_at IS NULL;
CREATE INDEX ix_users_supabase_auth_id ON users(supabase_auth_id) WHERE supabase_auth_id IS NOT NULL;
CREATE INDEX ix_users_status ON users(status) WHERE deleted_at IS NULL;
CREATE INDEX ix_users_last_login ON users(last_login_at DESC) WHERE deleted_at IS NULL;

-- Roles table indexes
CREATE INDEX ix_roles_name ON roles(name) WHERE is_active = TRUE;
CREATE INDEX ix_roles_level ON roles(level DESC) WHERE is_active = TRUE;

-- Permissions table indexes
CREATE INDEX ix_permissions_resource_operation ON permissions(resource_type, operation) WHERE is_active = TRUE;
CREATE INDEX ix_permissions_scope ON permissions(scope_level) WHERE is_active = TRUE;

-- User roles indexes
CREATE INDEX ix_user_roles_user_id ON user_roles(user_id) WHERE is_active = TRUE;
CREATE INDEX ix_user_roles_role_id ON user_roles(role_id) WHERE is_active = TRUE;
CREATE INDEX ix_user_roles_expires_at ON user_roles(expires_at) WHERE expires_at IS NOT NULL;

-- Staff profiles indexes
CREATE INDEX ix_staff_profiles_employee_id ON staff_profiles(employee_id) WHERE deleted_at IS NULL;
CREATE INDEX ix_staff_profiles_department ON staff_profiles(department) WHERE deleted_at IS NULL;
CREATE INDEX ix_staff_profiles_reports_to ON staff_profiles(reports_to_user_id) WHERE deleted_at IS NULL;

-- ============================================================================
-- AUDIT TRIGGERS
-- ============================================================================

-- Generic audit trigger function (if not already defined)
CREATE OR REPLACE FUNCTION audit_trigger_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply audit triggers
CREATE TRIGGER trigger_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION audit_trigger_updated_at();
CREATE TRIGGER trigger_roles_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION audit_trigger_updated_at();
CREATE TRIGGER trigger_staff_profiles_updated_at BEFORE UPDATE ON staff_profiles FOR EACH ROW EXECUTE FUNCTION audit_trigger_updated_at();
CREATE TRIGGER trigger_student_user_profiles_updated_at BEFORE UPDATE ON student_user_profiles FOR EACH ROW EXECUTE FUNCTION audit_trigger_updated_at();

-- ============================================================================
-- HELPER FUNCTIONS
-- ============================================================================

-- Function to get user permissions
CREATE OR REPLACE FUNCTION get_user_permissions(p_user_id UUID)
RETURNS TABLE(
    permission_name TEXT,
    resource_type TEXT,
    operation TEXT,
    scope_level TEXT
) 
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        p.name,
        p.resource_type::TEXT,
        p.operation::TEXT,
        p.scope_level
    FROM user_roles ur
    JOIN role_permissions rp ON ur.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = p_user_id
      AND ur.is_active = TRUE
      AND rp.is_active = TRUE
      AND p.is_active = TRUE
      AND (ur.expires_at IS NULL OR ur.expires_at > CURRENT_TIMESTAMP);
END;
$$;

-- Function to check if user has specific permission
CREATE OR REPLACE FUNCTION user_has_permission(
    p_user_id UUID,
    p_resource_type TEXT,
    p_operation TEXT,
    p_scope_level TEXT DEFAULT 'GLOBAL'
)
RETURNS BOOLEAN 
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
AS $$
DECLARE
    has_permission BOOLEAN := FALSE;
BEGIN
    SELECT TRUE INTO has_permission
    FROM user_roles ur
    JOIN role_permissions rp ON ur.role_id = rp.role_id
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = p_user_id
      AND p.resource_type::TEXT = p_resource_type
      AND p.operation::TEXT = p_operation
      AND (p.scope_level = p_scope_level OR p.scope_level = 'GLOBAL')
      AND ur.is_active = TRUE
      AND rp.is_active = TRUE
      AND p.is_active = TRUE
      AND (ur.expires_at IS NULL OR ur.expires_at > CURRENT_TIMESTAMP)
    LIMIT 1;
    
    RETURN COALESCE(has_permission, FALSE);
END;
$$;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE external_user_profiles ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies (customize based on your requirements)

-- Users table policies
CREATE POLICY "users_select_policy" ON users
    FOR SELECT USING (
        id = auth.uid() OR
        user_has_permission(auth.uid()::UUID, 'USER_MANAGEMENT', 'READ')
    );

CREATE POLICY "users_insert_policy" ON users
    FOR INSERT WITH CHECK (
        user_has_permission(auth.uid()::UUID, 'USER_MANAGEMENT', 'CREATE')
    );

CREATE POLICY "users_update_policy" ON users
    FOR UPDATE USING (
        id = auth.uid() OR
        user_has_permission(auth.uid()::UUID, 'USER_MANAGEMENT', 'UPDATE')
    );

-- Staff profiles policies
CREATE POLICY "staff_profiles_select_policy" ON staff_profiles
    FOR SELECT USING (
        user_id = auth.uid() OR
        user_has_permission(auth.uid()::UUID, 'STAFF', 'READ')
    );

-- Student user profiles policies
CREATE POLICY "student_user_profiles_select_policy" ON student_user_profiles
    FOR SELECT USING (
        user_id = auth.uid() OR
        user_has_permission(auth.uid()::UUID, 'STUDENTS', 'READ')
    );

-- ============================================================================
-- COMMENTS AND DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE users IS 'Core users table for all system users with Supabase auth integration';
COMMENT ON TABLE roles IS 'System roles with hierarchical levels and constraints';
COMMENT ON TABLE permissions IS 'Granular permissions with resource-operation mapping';
COMMENT ON TABLE staff_profiles IS 'Extended profiles for staff members with employment details';
COMMENT ON TABLE student_user_profiles IS 'Links student records to user accounts for portal access';

COMMENT ON COLUMN users.supabase_auth_id IS 'Links to auth.users.id in Supabase authentication system';
COMMENT ON COLUMN roles.level IS 'Hierarchical level - higher numbers indicate higher privileges (0-100)';
COMMENT ON COLUMN permissions.scope_level IS 'Permission scope: GLOBAL, COLLEGE, DEPARTMENT, COURSE, or SELF';
COMMENT ON COLUMN user_roles.expires_at IS 'Role assignment expiration - NULL means no expiration';

-- ============================================================================
-- GRANTS FOR SUPABASE
-- ============================================================================

GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- ============================================================================
-- INITIAL SYSTEM ADMIN SETUP (Run after deployment)
-- ============================================================================

/*
-- Example: Create initial system admin user
-- Run this after setting up your first authenticated user in Supabase

INSERT INTO users (
    supabase_auth_id,
    email,
    first_name,
    last_name,
    status,
    is_system_admin,
    email_verified_at
) VALUES (
    'YOUR_SUPABASE_AUTH_UUID', -- Replace with actual Supabase auth UUID
    'admin@yourdomain.com',
    'System',
    'Administrator',
    'ACTIVE',
    TRUE,
    CURRENT_TIMESTAMP
);

-- Assign super admin role
INSERT INTO user_roles (user_id, role_id, assigned_at)
SELECT u.id, r.id, CURRENT_TIMESTAMP
FROM users u, roles r
WHERE u.email = 'admin@yourdomain.com'
  AND r.name = 'SUPER_ADMIN';
*/
