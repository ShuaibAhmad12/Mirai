-- RBAC System Initialization Script
-- Run this script after applying 007_rbac_user_management.sql
-- This will create additional configuration and setup initial data

-- ============================================================================
-- VERIFY RBAC TABLES EXIST
-- ============================================================================

DO $$ 
BEGIN
    -- Check if main tables exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
        RAISE EXCEPTION 'RBAC tables not found. Please run 007_rbac_user_management.sql first';
    END IF;
    
    RAISE NOTICE 'RBAC tables found. Proceeding with initialization...';
END $$;

-- ============================================================================
-- CREATE RBAC HELPER VIEWS
-- ============================================================================

-- View for user permissions summary
CREATE OR REPLACE VIEW user_permissions_summary AS
SELECT 
    u.id as user_id,
    u.email,
    u.full_name,
    u.status as user_status,
    array_agg(DISTINCT r.name) as roles,
    array_agg(DISTINCT p.name) as permissions,
    array_agg(DISTINCT p.resource_type::text) as resources,
    max(r.level) as max_role_level,
    u.is_system_admin
FROM users u
LEFT JOIN user_roles ur ON u.id = ur.user_id AND ur.is_active = true
LEFT JOIN roles r ON ur.role_id = r.id AND r.is_active = true
LEFT JOIN role_permissions rp ON r.id = rp.role_id AND rp.is_active = true
LEFT JOIN permissions p ON rp.permission_id = p.id AND p.is_active = true
WHERE u.deleted_at IS NULL
GROUP BY u.id, u.email, u.full_name, u.status, u.is_system_admin;

-- View for role hierarchy
CREATE OR REPLACE VIEW role_hierarchy AS
SELECT 
    r.id,
    r.name,
    r.display_name,
    r.level,
    r.description,
    count(ur.user_id) as user_count,
    count(rp.permission_id) as permission_count,
    array_agg(DISTINCT p.resource_type::text) as resources
FROM roles r
LEFT JOIN user_roles ur ON r.id = ur.role_id AND ur.is_active = true
LEFT JOIN role_permissions rp ON r.id = rp.role_id AND rp.is_active = true
LEFT JOIN permissions p ON rp.permission_id = p.id AND p.is_active = true
WHERE r.is_active = true
GROUP BY r.id, r.name, r.display_name, r.level, r.description
ORDER BY r.level DESC;

-- View for permission matrix
CREATE OR REPLACE VIEW permission_matrix AS
SELECT 
    r.name as role_name,
    r.level as role_level,
    p.resource_type::text as resource,
    p.operation::text as operation,
    p.scope_level as scope,
    count(ur.user_id) as users_with_permission
FROM roles r
JOIN role_permissions rp ON r.id = rp.role_id AND rp.is_active = true
JOIN permissions p ON rp.permission_id = p.id AND p.is_active = true
LEFT JOIN user_roles ur ON r.id = ur.role_id AND ur.is_active = true
WHERE r.is_active = true AND p.is_active = true
GROUP BY r.name, r.level, p.resource_type, p.operation, p.scope_level
ORDER BY r.level DESC, p.resource_type, p.operation;

-- ============================================================================
-- CREATE ADDITIONAL PERMISSIONS FOR COMMON SCENARIOS
-- ============================================================================

-- Self-access permissions for students and staff
INSERT INTO permissions (name, display_name, description, resource_type, operation, scope_level, is_system_permission) VALUES
('STUDENTS_READ_SELF', 'View Own Student Record', 'View own student information and academic records', 'STUDENTS', 'READ', 'SELF', TRUE),
('FEES_READ_SELF', 'View Own Fee Records', 'View own fee payments and outstanding amounts', 'FEES', 'READ', 'SELF', TRUE),
('STAFF_READ_SELF', 'View Own Staff Profile', 'View own staff profile and employment details', 'STAFF', 'READ', 'SELF', TRUE),
('REPORTS_READ_SELF', 'View Own Reports', 'View reports related to own activities', 'REPORTS', 'READ', 'SELF', TRUE)
ON CONFLICT (name) DO NOTHING;

-- Department-level permissions
INSERT INTO permissions (name, display_name, description, resource_type, operation, scope_level, is_system_permission) VALUES
('STUDENTS_READ_DEPARTMENT', 'View Department Students', 'View students within own department', 'STUDENTS', 'READ', 'DEPARTMENT', TRUE),
('STAFF_READ_DEPARTMENT', 'View Department Staff', 'View staff within own department', 'STAFF', 'READ', 'DEPARTMENT', TRUE),
('COURSES_MANAGE_DEPARTMENT', 'Manage Department Courses', 'Manage courses within own department', 'COURSES', 'UPDATE', 'DEPARTMENT', TRUE)
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- ASSIGN SELF-ACCESS PERMISSIONS TO STUDENT ROLE
-- ============================================================================

INSERT INTO role_permissions (role_id, permission_id, granted_at)
SELECT r.id, p.id, CURRENT_TIMESTAMP
FROM roles r, permissions p
WHERE r.name = 'STUDENT'
  AND p.name IN ('STUDENTS_READ_SELF', 'FEES_READ_SELF', 'REPORTS_READ_SELF')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================================================
-- ASSIGN DEPARTMENT PERMISSIONS TO ACADEMIC ROLES
-- ============================================================================

INSERT INTO role_permissions (role_id, permission_id, granted_at)
SELECT r.id, p.id, CURRENT_TIMESTAMP
FROM roles r, permissions p
WHERE r.name IN ('HOD', 'DEAN')
  AND p.name IN ('STUDENTS_READ_DEPARTMENT', 'STAFF_READ_DEPARTMENT', 'COURSES_MANAGE_DEPARTMENT')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- ============================================================================
-- CREATE RBAC AUDIT FUNCTIONS
-- ============================================================================

-- Function to log role assignments
CREATE OR REPLACE FUNCTION log_role_assignment()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO audit_logs (
            table_name,
            operation,
            record_id,
            old_values,
            new_values,
            user_id,
            timestamp
        ) VALUES (
            'user_roles',
            'ROLE_ASSIGNED',
            NEW.id,
            NULL,
            row_to_json(NEW),
            NEW.assigned_by,
            CURRENT_TIMESTAMP
        );
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        INSERT INTO audit_logs (
            table_name,
            operation,
            record_id,
            old_values,
            new_values,
            user_id,
            timestamp
        ) VALUES (
            'user_roles',
            'ROLE_MODIFIED',
            NEW.id,
            row_to_json(OLD),
            row_to_json(NEW),
            NEW.assigned_by,
            CURRENT_TIMESTAMP
        );
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create audit_logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    operation TEXT NOT NULL,
    record_id UUID,
    old_values JSONB,
    new_values JSONB,
    user_id UUID,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Create trigger for role assignment auditing
DROP TRIGGER IF EXISTS trigger_audit_user_roles ON user_roles;
CREATE TRIGGER trigger_audit_user_roles
    AFTER INSERT OR UPDATE ON user_roles
    FOR EACH ROW
    EXECUTE FUNCTION log_role_assignment();

-- ============================================================================
-- CREATE RBAC MAINTENANCE FUNCTIONS
-- ============================================================================

-- Function to clean up expired role assignments
CREATE OR REPLACE FUNCTION cleanup_expired_roles()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE user_roles 
    SET is_active = FALSE,
        updated_at = CURRENT_TIMESTAMP
    WHERE expires_at IS NOT NULL 
      AND expires_at < CURRENT_TIMESTAMP 
      AND is_active = TRUE;
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    INSERT INTO audit_logs (
        table_name,
        operation,
        record_id,
        old_values,
        new_values,
        user_id,
        timestamp
    ) VALUES (
        'user_roles',
        'BULK_EXPIRE',
        NULL,
        jsonb_build_object('expired_count', expired_count),
        NULL,
        NULL,
        CURRENT_TIMESTAMP
    );
    
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- Function to get user role summary
CREATE OR REPLACE FUNCTION get_user_role_summary(p_user_id UUID)
RETURNS TABLE(
    role_name TEXT,
    role_level INTEGER,
    assigned_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    scope_college_id UUID,
    scope_department TEXT,
    is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.name,
        r.level,
        ur.assigned_at,
        ur.expires_at,
        ur.scope_college_id,
        ur.scope_department,
        ur.is_active
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = p_user_id
    ORDER BY r.level DESC, ur.assigned_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CREATE INDEXES FOR RBAC PERFORMANCE
-- ============================================================================

-- Additional indexes for better performance
CREATE INDEX IF NOT EXISTS ix_user_roles_expires_at_active 
ON user_roles(expires_at) WHERE is_active = TRUE AND expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_user_roles_scope_college 
ON user_roles(scope_college_id) WHERE scope_college_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_user_roles_scope_department 
ON user_roles(scope_department) WHERE scope_department IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_permissions_resource_operation_scope 
ON permissions(resource_type, operation, scope_level) WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS ix_role_permissions_active 
ON role_permissions(role_id, permission_id) WHERE is_active = TRUE;

-- ============================================================================
-- GRANT NECESSARY PERMISSIONS
-- ============================================================================

-- Grant permissions for authenticated users to use RBAC functions
GRANT EXECUTE ON FUNCTION get_user_permissions(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION user_has_permission(UUID, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_role_summary(UUID) TO authenticated;

-- Grant permissions for service role to use maintenance functions
GRANT EXECUTE ON FUNCTION cleanup_expired_roles() TO service_role;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify installation
DO $$
DECLARE
    role_count INTEGER;
    permission_count INTEGER;
    user_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO role_count FROM roles WHERE is_active = TRUE;
    SELECT COUNT(*) INTO permission_count FROM permissions WHERE is_active = TRUE;
    SELECT COUNT(*) INTO user_count FROM users WHERE deleted_at IS NULL;
    
    RAISE NOTICE 'RBAC System Initialization Complete!';
    RAISE NOTICE 'Active Roles: %', role_count;
    RAISE NOTICE 'Active Permissions: %', permission_count;
    RAISE NOTICE 'Users: %', user_count;
    
    IF role_count = 0 THEN
        RAISE WARNING 'No roles found. Please run 007_rbac_user_management.sql first.';
    END IF;
    
    IF permission_count = 0 THEN
        RAISE WARNING 'No permissions found. Please run 007_rbac_user_management.sql first.';
    END IF;
END $$;

-- ============================================================================
-- EXAMPLE QUERIES FOR TESTING
-- ============================================================================

-- Example: View all roles and their permissions
-- SELECT * FROM role_hierarchy;

-- Example: View user permissions summary
-- SELECT * FROM user_permissions_summary;

-- Example: View permission matrix
-- SELECT * FROM permission_matrix WHERE role_level >= 50;

-- Example: Clean up expired roles
-- SELECT cleanup_expired_roles();

-- Example: Get specific user's roles
-- SELECT * FROM get_user_role_summary('user-uuid-here');
