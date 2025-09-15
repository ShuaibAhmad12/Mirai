-- First User Auto Super Admin & Invitation System
-- This script should be run after 007_rbac_user_management.sql and 008_rbac_initialization.sql
-- It implements:
-- 1. First user automatically becomes Super Admin
-- 2. Invitation-only system for subsequent users
-- 3. Manual Super Admin assignment function

-- ============================================================================
-- SYSTEM CONFIGURATION TABLE
-- ============================================================================

-- Table to store system-wide configuration
CREATE TABLE IF NOT EXISTS system_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value JSONB,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Insert configuration for first user setup
INSERT INTO system_config (key, value, description) VALUES
('first_user_created', 'false', 'Flag to track if first super admin has been created'),
('invitation_only_mode', 'false', 'Whether new users require invitation to register')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- USER INVITATIONS TABLE
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_invitations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Invitation details
    email TEXT NOT NULL CHECK (email ~* '^[A-Za-z0-9._%-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,4}$'),
    invitation_token UUID NOT NULL DEFAULT gen_random_uuid(),
    
    -- Invitation metadata
    invited_by UUID NOT NULL REFERENCES users(id),
    invited_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (CURRENT_TIMESTAMP + INTERVAL '7 days'),
    
    -- Pre-assigned role (optional)
    pre_assigned_role_id UUID REFERENCES roles(id),
    
    -- Invitation status
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'EXPIRED', 'REVOKED')),
    used_at TIMESTAMPTZ,
    used_by UUID REFERENCES users(id),
    
    -- Constraints
    CONSTRAINT uk_user_invitations_email_pending UNIQUE(email) DEFERRABLE INITIALLY DEFERRED
);

-- Remove unique constraint when invitation is not pending
CREATE UNIQUE INDEX ix_user_invitations_email_pending 
ON user_invitations(email) 
WHERE status = 'PENDING';

-- ============================================================================
-- FIRST USER AUTO SUPER ADMIN FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION assign_first_user_as_super_admin()
RETURNS TRIGGER AS $$
DECLARE
    first_user_created BOOLEAN;
    super_admin_role_id UUID;
    user_count INTEGER;
BEGIN
    -- Check if this is truly the first user
    SELECT COUNT(*) INTO user_count FROM users WHERE deleted_at IS NULL;
    
    -- Get the first_user_created flag
    SELECT (value::text)::boolean INTO first_user_created 
    FROM system_config 
    WHERE key = 'first_user_created';
    
    -- If this is the first user and flag is false
    IF user_count <= 1 AND (first_user_created IS NULL OR first_user_created = FALSE) THEN
        
        -- Get the SUPER_ADMIN role ID
        SELECT id INTO super_admin_role_id 
        FROM roles 
        WHERE name = 'SUPER_ADMIN' 
        AND is_active = TRUE;
        
        IF super_admin_role_id IS NOT NULL THEN
            -- Make user system admin
            UPDATE users 
            SET is_system_admin = TRUE,
                status = 'ACTIVE',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = NEW.id;
            
            -- Assign SUPER_ADMIN role
            INSERT INTO user_roles (
                user_id, 
                role_id, 
                assigned_by, 
                assigned_at,
                is_active
            ) VALUES (
                NEW.id, 
                super_admin_role_id, 
                NEW.id, -- Self-assigned for first user
                CURRENT_TIMESTAMP,
                TRUE
            );
            
            -- Update the flag to prevent future auto-assignments
            UPDATE system_config 
            SET value = 'true', 
                updated_at = CURRENT_TIMESTAMP 
            WHERE key = 'first_user_created';
            
            -- Enable invitation-only mode
            UPDATE system_config 
            SET value = 'true', 
                updated_at = CURRENT_TIMESTAMP 
            WHERE key = 'invitation_only_mode';
            
            RAISE NOTICE 'First user % automatically assigned as Super Admin', NEW.email;
        ELSE
            RAISE WARNING 'SUPER_ADMIN role not found. Cannot auto-assign first user.';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- INVITATION VALIDATION FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION validate_user_invitation()
RETURNS TRIGGER AS $$
DECLARE
    invitation_only BOOLEAN;
    valid_invitation_count INTEGER;
    invitation_record RECORD;
BEGIN
    -- Check if invitation-only mode is enabled
    SELECT (value::text)::boolean INTO invitation_only 
    FROM system_config 
    WHERE key = 'invitation_only_mode';
    
    -- If invitation-only mode is enabled
    IF invitation_only = TRUE THEN
        -- Check for valid invitation
        SELECT COUNT(*) INTO valid_invitation_count
        FROM user_invitations
        WHERE email = NEW.email
          AND status = 'PENDING'
          AND expires_at > CURRENT_TIMESTAMP;
        
        IF valid_invitation_count = 0 THEN
            RAISE EXCEPTION 'Registration requires a valid invitation. Email: %', NEW.email;
        END IF;
        
        -- Get the invitation record
        SELECT * INTO invitation_record
        FROM user_invitations
        WHERE email = NEW.email
          AND status = 'PENDING'
          AND expires_at > CURRENT_TIMESTAMP
        ORDER BY invited_at DESC
        LIMIT 1;
        
        -- Mark invitation as accepted
        UPDATE user_invitations
        SET status = 'ACCEPTED',
            used_at = CURRENT_TIMESTAMP,
            used_by = NEW.id
        WHERE id = invitation_record.id;
        
        -- If invitation has pre-assigned role, assign it
        IF invitation_record.pre_assigned_role_id IS NOT NULL THEN
            INSERT INTO user_roles (
                user_id,
                role_id,
                assigned_by,
                assigned_at,
                is_active
            ) VALUES (
                NEW.id,
                invitation_record.pre_assigned_role_id,
                invitation_record.invited_by,
                CURRENT_TIMESTAMP,
                TRUE
            );
        END IF;
        
        RAISE NOTICE 'User % registered via invitation from %', NEW.email, 
                     (SELECT email FROM users WHERE id = invitation_record.invited_by);
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- MANUAL SUPER ADMIN ASSIGNMENT FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION make_user_super_admin(
    p_user_email TEXT,
    p_assigned_by UUID DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
    target_user_id UUID;
    super_admin_role_id UUID;
    existing_role_count INTEGER;
    result JSONB;
BEGIN
    -- Find the user by email
    SELECT id INTO target_user_id 
    FROM users 
    WHERE email = p_user_email 
      AND deleted_at IS NULL;
    
    IF target_user_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User not found with email: ' || p_user_email
        );
    END IF;
    
    -- Get SUPER_ADMIN role
    SELECT id INTO super_admin_role_id 
    FROM roles 
    WHERE name = 'SUPER_ADMIN' 
      AND is_active = TRUE;
    
    IF super_admin_role_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'SUPER_ADMIN role not found'
        );
    END IF;
    
    -- Check if user already has SUPER_ADMIN role
    SELECT COUNT(*) INTO existing_role_count
    FROM user_roles ur
    JOIN roles r ON ur.role_id = r.id
    WHERE ur.user_id = target_user_id
      AND r.name = 'SUPER_ADMIN'
      AND ur.is_active = TRUE;
    
    IF existing_role_count > 0 THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User already has Super Admin role'
        );
    END IF;
    
    -- Make user system admin
    UPDATE users 
    SET is_system_admin = TRUE,
        status = 'ACTIVE',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = target_user_id;
    
    -- Assign SUPER_ADMIN role
    INSERT INTO user_roles (
        user_id,
        role_id,
        assigned_by,
        assigned_at,
        is_active
    ) VALUES (
        target_user_id,
        super_admin_role_id,
        COALESCE(p_assigned_by, target_user_id),
        CURRENT_TIMESTAMP,
        TRUE
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'message', 'User successfully assigned as Super Admin',
        'user_id', target_user_id,
        'email', p_user_email
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- USER INVITATION FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION create_user_invitation(
    p_email TEXT,
    p_invited_by UUID,
    p_role_name TEXT DEFAULT NULL,
    p_expires_days INTEGER DEFAULT 7
)
RETURNS JSONB AS $$
DECLARE
    role_id UUID;
    invitation_id UUID;
    invitation_token UUID;
BEGIN
    -- Validate inviter has permission
    IF NOT EXISTS (
        SELECT 1 FROM users 
        WHERE id = p_invited_by 
          AND (is_system_admin = TRUE OR id IN (
              SELECT ur.user_id 
              FROM user_roles ur 
              JOIN roles r ON ur.role_id = r.id 
              WHERE r.name IN ('SUPER_ADMIN', 'SYSTEM_ADMIN', 'COLLEGE_ADMIN')
                AND ur.is_active = TRUE
          ))
    ) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'Insufficient permissions to invite users'
        );
    END IF;
    
    -- Check if user already exists
    IF EXISTS (SELECT 1 FROM users WHERE email = p_email AND deleted_at IS NULL) THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', 'User already exists with this email'
        );
    END IF;
    
    -- Get role ID if role name provided
    IF p_role_name IS NOT NULL THEN
        SELECT id INTO role_id 
        FROM roles 
        WHERE name = p_role_name 
          AND is_active = TRUE;
        
        IF role_id IS NULL THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Role not found: ' || p_role_name
            );
        END IF;
    END IF;
    
    -- Revoke any existing pending invitations for this email
    UPDATE user_invitations 
    SET status = 'REVOKED',
        updated_at = CURRENT_TIMESTAMP
    WHERE email = p_email 
      AND status = 'PENDING';
    
    -- Create new invitation
    invitation_token := gen_random_uuid();
    
    INSERT INTO user_invitations (
        email,
        invitation_token,
        invited_by,
        expires_at,
        pre_assigned_role_id
    ) VALUES (
        p_email,
        invitation_token,
        p_invited_by,
        CURRENT_TIMESTAMP + (p_expires_days || ' days')::INTERVAL,
        role_id
    ) RETURNING id INTO invitation_id;
    
    RETURN jsonb_build_object(
        'success', true,
        'invitation_id', invitation_id,
        'invitation_token', invitation_token,
        'email', p_email,
        'expires_in_days', p_expires_days
    );
    
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CREATE TRIGGERS
-- ============================================================================

-- Trigger for first user auto Super Admin assignment
DROP TRIGGER IF EXISTS trigger_first_user_super_admin ON users;
CREATE TRIGGER trigger_first_user_super_admin
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION assign_first_user_as_super_admin();

-- Note: Invitation validation is now handled in 010_auth_user_sync.sql
-- This keeps the logic in one place and avoids conflicts

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- Function to check system status
CREATE OR REPLACE FUNCTION get_system_status()
RETURNS JSONB AS $$
DECLARE
    result JSONB;
    first_user_created BOOLEAN;
    invitation_only BOOLEAN;
    super_admin_count INTEGER;
    total_users INTEGER;
    pending_invitations INTEGER;
BEGIN
    -- Get configuration flags
    SELECT (value::text)::boolean INTO first_user_created 
    FROM system_config WHERE key = 'first_user_created';
    
    SELECT (value::text)::boolean INTO invitation_only 
    FROM system_config WHERE key = 'invitation_only_mode';
    
    -- Get user counts
    SELECT COUNT(*) INTO total_users FROM users WHERE deleted_at IS NULL;
    SELECT COUNT(*) INTO pending_invitations FROM user_invitations WHERE status = 'PENDING';
    
    -- Get super admin count
    SELECT COUNT(DISTINCT u.id) INTO super_admin_count
    FROM users u
    JOIN user_roles ur ON u.id = ur.user_id
    JOIN roles r ON ur.role_id = r.id
    WHERE r.name = 'SUPER_ADMIN'
      AND ur.is_active = TRUE
      AND u.deleted_at IS NULL;
    
    RETURN jsonb_build_object(
        'first_user_created', COALESCE(first_user_created, false),
        'invitation_only_mode', COALESCE(invitation_only, false),
        'total_users', total_users,
        'super_admin_count', super_admin_count,
        'pending_invitations', pending_invitations,
        'system_ready', (super_admin_count > 0)
    );
END;
$$ LANGUAGE plpgsql;

-- Function to cleanup expired invitations
CREATE OR REPLACE FUNCTION cleanup_expired_invitations()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE user_invitations
    SET status = 'EXPIRED'
    WHERE status = 'PENDING'
      AND expires_at < CURRENT_TIMESTAMP;
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant permissions to authenticated users
GRANT SELECT ON system_config TO authenticated;
GRANT SELECT ON user_invitations TO authenticated;
GRANT EXECUTE ON FUNCTION get_system_status() TO authenticated;

-- Grant permissions to service role
GRANT ALL ON system_config TO service_role;
GRANT ALL ON user_invitations TO service_role;
GRANT EXECUTE ON FUNCTION make_user_super_admin(TEXT, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION create_user_invitation(TEXT, UUID, TEXT, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION cleanup_expired_invitations() TO service_role;

-- ============================================================================
-- EXAMPLE USAGE QUERIES
-- ============================================================================

-- Check system status
-- SELECT get_system_status();

-- Make existing user super admin
-- SELECT make_user_super_admin('user@example.com');

-- Create invitation for new user
-- SELECT create_user_invitation('newuser@example.com', (SELECT id FROM users WHERE email = 'admin@example.com'), 'STAFF');

-- Cleanup expired invitations
-- SELECT cleanup_expired_invitations();

-- View all pending invitations
-- SELECT 
--     ui.*,
--     u.email as invited_by_email,
--     r.name as pre_assigned_role
-- FROM user_invitations ui
-- JOIN users u ON ui.invited_by = u.id
-- LEFT JOIN roles r ON ui.pre_assigned_role_id = r.id
-- WHERE ui.status = 'PENDING'
-- ORDER BY ui.invited_at DESC;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'First User Auto Super Admin & Invitation System installed successfully!';
    RAISE NOTICE 'Features:';
    RAISE NOTICE '- First user automatically becomes Super Admin';
    RAISE NOTICE '- Invitation-only mode enabled after first user';
    RAISE NOTICE '- Manual Super Admin assignment: make_user_super_admin(email)';
    RAISE NOTICE '- User invitation system: create_user_invitation(email, invited_by, role)';
    RAISE NOTICE '- System status: get_system_status()';
END $$;
