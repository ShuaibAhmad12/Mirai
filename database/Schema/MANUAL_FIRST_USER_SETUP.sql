-- MANUAL_FIRST_USER_SETUP.sql
-- One-time script to handle existing auth.users without public.users records
-- Run this AFTER applying 010_auth_user_sync.sql

-- ============================================================================
-- SYNC EXISTING AUTH USERS TO PUBLIC USERS
-- ============================================================================

DO $$
DECLARE
    auth_user RECORD;
    new_user_id UUID;
    user_count INTEGER;
BEGIN
    -- Check how many users are already in public.users
    SELECT COUNT(*) INTO user_count FROM public.users WHERE deleted_at IS NULL;
    
    RAISE NOTICE 'Found % existing users in public.users', user_count;
    
    -- Sync any auth.users that don't have corresponding public.users
    FOR auth_user IN 
        SELECT au.* 
        FROM auth.users au 
        LEFT JOIN public.users pu ON pu.supabase_auth_id = au.id 
        WHERE pu.id IS NULL
    LOOP
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
            auth_user.id,
            auth_user.email,
            COALESCE(auth_user.raw_user_meta_data->>'first_name', split_part(auth_user.email, '@', 1)),
            COALESCE(auth_user.raw_user_meta_data->>'last_name', ''),
            COALESCE(
                CONCAT(auth_user.raw_user_meta_data->>'first_name', ' ', auth_user.raw_user_meta_data->>'last_name'),
                split_part(auth_user.email, '@', 1)
            ),
            CASE 
                WHEN auth_user.email_confirmed_at IS NOT NULL THEN 'ACTIVE'
                ELSE 'PENDING_VERIFICATION'
            END,
            auth_user.email_confirmed_at,
            auth_user.created_at,
            auth_user.updated_at
        ) RETURNING id INTO new_user_id;
        
        RAISE NOTICE 'Synced auth user % (%) to public user %', 
                     auth_user.email, auth_user.id, new_user_id;
    END LOOP;
    
    -- Check final counts
    SELECT COUNT(*) INTO user_count FROM public.users WHERE deleted_at IS NULL;
    RAISE NOTICE 'Total users in public.users after sync: %', user_count;
END $$;

-- ============================================================================
-- MANUALLY ASSIGN FIRST USER AS SUPER ADMIN
-- ============================================================================

DO $$
DECLARE
    first_user_email TEXT;
    result JSONB;
BEGIN
    -- Get the first user by creation date
    SELECT email INTO first_user_email 
    FROM public.users 
    WHERE deleted_at IS NULL 
    ORDER BY created_at ASC 
    LIMIT 1;
    
    IF first_user_email IS NOT NULL THEN
        RAISE NOTICE 'Making user % the Super Admin...', first_user_email;
        
        -- Use our existing function to make them super admin
        SELECT make_user_super_admin(first_user_email) INTO result;
        
        RAISE NOTICE 'Result: %', result;
    ELSE
        RAISE NOTICE 'No users found to make Super Admin';
    END IF;
END $$;

-- ============================================================================
-- VERIFY SYSTEM STATUS
-- ============================================================================

DO $$
DECLARE
    status JSONB;
BEGIN
    SELECT get_system_status() INTO status;
    RAISE NOTICE 'System Status: %', status;
END $$;
