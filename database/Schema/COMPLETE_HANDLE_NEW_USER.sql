-- COMPLETE_HANDLE_NEW_USER.sql
-- Complete implementation with all features
-- Includes: first user logic, invitation system, system config, proper error handling

-- ============================================================================
-- CREATE REQUIRED TABLES (if they don't exist)
-- ============================================================================

-- System configuration table
CREATE TABLE IF NOT EXISTS system_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key TEXT NOT NULL UNIQUE,
    value JSONB,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- User invitations table
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
    used_by UUID REFERENCES users(id)
);

-- Insert initial system configuration
INSERT INTO system_config (key, value, description) VALUES
('first_user_created', 'false', 'Flag to track if first super admin has been created'),
('invitation_only_mode', 'false', 'Whether new users require invitation to register')
ON CONFLICT (key) DO NOTHING;

-- ============================================================================
-- COMPLETE HANDLE NEW USER FUNCTION
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_user_id UUID;
    user_count INTEGER;
    super_admin_role_id UUID;
    invitation_record RECORD;
    is_first_user BOOLEAN DEFAULT FALSE;
    invitation_only BOOLEAN DEFAULT FALSE;
    valid_invitation_count INTEGER;
BEGIN
    -- Check current user count in public.users (excluding deleted users)
    SELECT COUNT(*) INTO user_count 
    FROM public.users 
    WHERE deleted_at IS NULL;
    
    -- Determine if this is the first user
    is_first_user := (user_count = 0);
    
    -- Check if invitation-only mode is enabled
    BEGIN
        SELECT (value::text)::boolean INTO invitation_only 
        FROM system_config 
        WHERE key = 'invitation_only_mode';
    EXCEPTION
        WHEN OTHERS THEN 
            invitation_only := FALSE;
    END;
    
    RAISE NOTICE 'Processing new user: %, Current user count: %, Is first user: %, Invitation only: %', 
                 NEW.email, user_count, is_first_user, invitation_only;
    
    -- If NOT first user and invitation-only mode is enabled, check for invitation
    IF NOT is_first_user AND invitation_only = TRUE THEN
        BEGIN
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
            
            RAISE NOTICE 'Found valid invitation for % from user %', NEW.email, invitation_record.invited_by;
        EXCEPTION
            WHEN OTHERS THEN
                -- If invitation check fails but not first user, block registration
                IF NOT is_first_user THEN
                    RAISE EXCEPTION 'Registration blocked: %', SQLERRM;
                END IF;
        END;
    END IF;
    
    -- Create the user record in public.users
    INSERT INTO public.users (
        supabase_auth_id,
        email,
        first_name,
        last_name,
        status,
        email_verified_at,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(
            CASE 
                WHEN length(TRIM(NEW.raw_user_meta_data->>'first_name')) >= 2 
                THEN TRIM(NEW.raw_user_meta_data->>'first_name')
                ELSE NULL
            END,
            CASE 
                WHEN length(split_part(NEW.email, '@', 1)) >= 2 
                THEN split_part(NEW.email, '@', 1)
                ELSE 'User'
            END
        ),
        COALESCE(
            CASE 
                WHEN length(TRIM(NEW.raw_user_meta_data->>'last_name')) >= 2 
                THEN TRIM(NEW.raw_user_meta_data->>'last_name')
                ELSE NULL
            END,
            'Account'
        ),
        CASE 
            WHEN NEW.email_confirmed_at IS NOT NULL THEN 'ACTIVE'
            ELSE 'PENDING_VERIFICATION'
        END,
        NEW.email_confirmed_at,
        NEW.created_at,
        NEW.updated_at
    ) RETURNING id INTO new_user_id;
    
    RAISE NOTICE 'Created public.users record % for %', new_user_id, NEW.email;
    
    -- Handle role assignment based on user type
    IF is_first_user THEN
        -- FIRST USER: Make them Super Admin
        BEGIN
            SELECT id INTO super_admin_role_id 
            FROM public.roles 
            WHERE name = 'SUPER_ADMIN' 
              AND is_active = TRUE;
            
            IF super_admin_role_id IS NOT NULL THEN
                -- Make user system admin
                UPDATE public.users 
                SET is_system_admin = TRUE,
                    status = 'ACTIVE',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = new_user_id;
                
                -- Assign SUPER_ADMIN role
                INSERT INTO public.user_roles (
                    user_id, 
                    role_id, 
                    assigned_by, 
                    assigned_at,
                    is_active
                ) VALUES (
                    new_user_id, 
                    super_admin_role_id, 
                    new_user_id, -- Self-assigned for first user
                    CURRENT_TIMESTAMP,
                    TRUE
                );
                
                -- Update system configuration
                UPDATE system_config 
                SET value = 'true', updated_at = CURRENT_TIMESTAMP 
                WHERE key = 'first_user_created';
                
                UPDATE system_config 
                SET value = 'true', updated_at = CURRENT_TIMESTAMP 
                WHERE key = 'invitation_only_mode';
                
                RAISE NOTICE 'First user % automatically assigned as Super Admin and invitation-only mode enabled', NEW.email;
            ELSE
                -- Just make them system admin if role doesn't exist
                UPDATE public.users 
                SET is_system_admin = TRUE,
                    status = 'ACTIVE',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = new_user_id;
                
                -- Still update system flags
                UPDATE system_config 
                SET value = 'true', updated_at = CURRENT_TIMESTAMP 
                WHERE key = 'first_user_created';
                
                UPDATE system_config 
                SET value = 'true', updated_at = CURRENT_TIMESTAMP 
                WHERE key = 'invitation_only_mode';
                
                RAISE NOTICE 'First user % made system admin (SUPER_ADMIN role not found)', NEW.email;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                -- If any error, just make them system admin
                UPDATE public.users 
                SET is_system_admin = TRUE,
                    status = 'ACTIVE',
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = new_user_id;
                
                RAISE NOTICE 'First user % made system admin (role assignment failed: %)', NEW.email, SQLERRM;
        END;
        
    ELSE
        -- INVITED USER: Process invitation
        IF invitation_record.id IS NOT NULL THEN
            BEGIN
                -- Mark invitation as accepted
                UPDATE user_invitations
                SET status = 'ACCEPTED',
                    used_at = CURRENT_TIMESTAMP,
                    used_by = new_user_id
                WHERE id = invitation_record.id;
                
                -- Assign pre-assigned role if specified
                IF invitation_record.pre_assigned_role_id IS NOT NULL THEN
                    INSERT INTO public.user_roles (
                        user_id,
                        role_id,
                        assigned_by,
                        assigned_at,
                        is_active
                    ) VALUES (
                        new_user_id,
                        invitation_record.pre_assigned_role_id,
                        invitation_record.invited_by,
                        CURRENT_TIMESTAMP,
                        TRUE
                    );
                    
                    RAISE NOTICE 'Assigned pre-assigned role % to invited user %', 
                                 invitation_record.pre_assigned_role_id, NEW.email;
                ELSE
                    RAISE NOTICE 'No pre-assigned role for invited user %', NEW.email;
                END IF;
                
                RAISE NOTICE 'Processed invitation for user %', NEW.email;
            EXCEPTION
                WHEN OTHERS THEN
                    RAISE NOTICE 'Invitation processing failed for user %: %', NEW.email, SQLERRM;
            END;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- UTILITY FUNCTIONS
-- ============================================================================

-- Function to get system status
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
    -- Get configuration flags with defaults
    SELECT COALESCE((value::text)::boolean, false) INTO first_user_created 
    FROM system_config WHERE key = 'first_user_created';
    
    SELECT COALESCE((value::text)::boolean, false) INTO invitation_only 
    FROM system_config WHERE key = 'invitation_only_mode';
    
    -- Get user counts
    SELECT COUNT(*) INTO total_users FROM users WHERE deleted_at IS NULL;
    
    -- Get pending invitations count
    SELECT COUNT(*) INTO pending_invitations 
    FROM user_invitations 
    WHERE status = 'PENDING' AND expires_at > CURRENT_TIMESTAMP;
    
    -- Get super admin count
    BEGIN
        SELECT COUNT(DISTINCT u.id) INTO super_admin_count
        FROM users u
        JOIN user_roles ur ON u.id = ur.user_id
        JOIN roles r ON ur.role_id = r.id
        WHERE r.name = 'SUPER_ADMIN'
          AND ur.is_active = TRUE
          AND u.deleted_at IS NULL;
    EXCEPTION
        WHEN OTHERS THEN 
            super_admin_count := 0;
    END;
    
    RETURN jsonb_build_object(
        'first_user_created', COALESCE(first_user_created, false),
        'invitation_only_mode', COALESCE(invitation_only, false),
        'total_users', total_users,
        'super_admin_count', super_admin_count,
        'pending_invitations', pending_invitations,
        'system_ready', (total_users > 0)
    );
END;
$$ LANGUAGE plpgsql;

-- Function to create user invitation
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
    -- Get role ID if role name is provided
    IF p_role_name IS NOT NULL THEN
        SELECT id INTO role_id 
        FROM roles 
        WHERE name = p_role_name AND is_active = TRUE;
        
        IF role_id IS NULL THEN
            RETURN jsonb_build_object(
                'success', false,
                'error', 'Role not found: ' || p_role_name
            );
        END IF;
    END IF;
    
    -- Create invitation
    INSERT INTO user_invitations (
        email,
        invited_by,
        pre_assigned_role_id,
        expires_at
    ) VALUES (
        p_email,
        p_invited_by,
        role_id,
        CURRENT_TIMESTAMP + (p_expires_days || ' days')::INTERVAL
    ) RETURNING id, invitation_token INTO invitation_id, invitation_token;
    
    RETURN jsonb_build_object(
        'success', true,
        'invitation_id', invitation_id,
        'invitation_token', invitation_token,
        'email', p_email,
        'expires_in_days', p_expires_days
    );
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- CREATE TRIGGER ON AUTH.USERS
-- ============================================================================

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

GRANT EXECUTE ON FUNCTION handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION get_system_status() TO authenticated;
GRANT EXECUTE ON FUNCTION get_system_status() TO service_role;
GRANT EXECUTE ON FUNCTION create_user_invitation(TEXT, UUID, TEXT, INTEGER) TO service_role;

-- Grant table permissions
GRANT SELECT ON system_config TO authenticated;
GRANT SELECT ON user_invitations TO authenticated;
GRANT ALL ON system_config TO service_role;
GRANT ALL ON user_invitations TO service_role;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '=== COMPLETE handle_new_user function created successfully! ===';
    RAISE NOTICE 'Features:';
    RAISE NOTICE '- First user automatically becomes Super Admin';
    RAISE NOTICE '- Invitation-only mode enabled after first user';
    RAISE NOTICE '- Complete invitation system with role assignment';
    RAISE NOTICE '- System configuration management';
    RAISE NOTICE '- Proper error handling and graceful fallbacks';
    RAISE NOTICE '- Utility functions: get_system_status(), create_user_invitation()';
END $$;
