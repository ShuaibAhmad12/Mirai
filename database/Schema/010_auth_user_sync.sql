-- 010_auth_user_sync.sql
-- Sync auth.users with public.users and trigger first user logic
-- This should be run after all other RBAC schemas

-- ============================================================================
-- FUNCTION TO HANDLE NEW USER REGISTRATION
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_user_id UUID;
    user_count INTEGER;
    invitation_only BOOLEAN;
    valid_invitation_count INTEGER;
    invitation_record RECORD;
BEGIN
    -- Check current user count in public.users
    SELECT COUNT(*) INTO user_count FROM public.users WHERE deleted_at IS NULL;
    
    -- Check if invitation-only mode is enabled
    SELECT (value::text)::boolean INTO invitation_only 
    FROM system_config 
    WHERE key = 'invitation_only_mode';
    
    -- If this is NOT the first user and invitation-only mode is enabled
    IF user_count > 0 AND invitation_only = TRUE THEN
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
    END IF;
    
    -- Create the user record
    INSERT INTO public.users (
        supabase_auth_id,
        email,
        first_name,
        last_name,
        full_name,
        status,
        email_verified_at,
        created_at,
        updated_at
    ) VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'first_name', split_part(NEW.email, '@', 1)),
        COALESCE(NEW.raw_user_meta_data->>'last_name', ''),
        COALESCE(
            CONCAT(NEW.raw_user_meta_data->>'first_name', ' ', NEW.raw_user_meta_data->>'last_name'),
            split_part(NEW.email, '@', 1)
        ),
        CASE 
            WHEN NEW.email_confirmed_at IS NOT NULL THEN 'ACTIVE'
            ELSE 'PENDING_VERIFICATION'
        END,
        NEW.email_confirmed_at,
        NEW.created_at,
        NEW.updated_at
    ) RETURNING id INTO new_user_id;

    -- If this was an invited user, process the invitation
    IF invitation_record.id IS NOT NULL THEN
        -- Mark invitation as accepted
        UPDATE user_invitations
        SET status = 'ACCEPTED',
            used_at = CURRENT_TIMESTAMP,
            used_by = new_user_id
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
                new_user_id,
                invitation_record.pre_assigned_role_id,
                invitation_record.invited_by,
                CURRENT_TIMESTAMP,
                TRUE
            );
        END IF;
        
        RAISE NOTICE 'User % registered via invitation and assigned role', NEW.email;
    ELSE
        RAISE NOTICE 'First user % created - will be processed by first user trigger', NEW.email;
    END IF;

    RAISE NOTICE 'Created public.users record % for auth.users %', new_user_id, NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- FUNCTION TO HANDLE USER EMAIL CONFIRMATION
-- ============================================================================

CREATE OR REPLACE FUNCTION handle_user_confirmation()
RETURNS TRIGGER AS $$
BEGIN
    -- Update user status when email is confirmed
    IF OLD.email_confirmed_at IS NULL AND NEW.email_confirmed_at IS NOT NULL THEN
        UPDATE public.users 
        SET 
            status = 'ACTIVE',
            email_verified_at = NEW.email_confirmed_at,
            updated_at = CURRENT_TIMESTAMP
        WHERE supabase_auth_id = NEW.id;
        
        RAISE NOTICE 'User % activated after email confirmation', NEW.email;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- CREATE TRIGGERS ON AUTH.USERS
-- ============================================================================

-- Trigger for new user creation
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

-- Trigger for email confirmation
DROP TRIGGER IF EXISTS on_auth_user_confirmed ON auth.users;
CREATE TRIGGER on_auth_user_confirmed
    AFTER UPDATE ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_user_confirmation();

-- ============================================================================
-- GRANT PERMISSIONS
-- ============================================================================

-- Grant necessary permissions
GRANT EXECUTE ON FUNCTION handle_new_user() TO service_role;
GRANT EXECUTE ON FUNCTION handle_user_confirmation() TO service_role;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE 'Auth-User Sync System installed successfully!';
    RAISE NOTICE 'Features:';
    RAISE NOTICE '- Auto-creates public.users when auth.users is inserted';
    RAISE NOTICE '- Activates users when email is confirmed';
    RAISE NOTICE '- Triggers first user Super Admin logic automatically';
END $$;
