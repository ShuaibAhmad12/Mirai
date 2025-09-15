-- SIMPLE_HANDLE_NEW_USER.sql
-- Simplified version that should work with existing enum

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_user_id UUID;
    user_count INTEGER;
    super_admin_role_id UUID;
    is_first_user BOOLEAN DEFAULT FALSE;
BEGIN
    -- Check current user count in public.users (excluding deleted users)
    SELECT COUNT(*) INTO user_count 
    FROM public.users 
    WHERE deleted_at IS NULL;
    
    -- Determine if this is the first user
    is_first_user := (user_count = 0);
    
    RAISE NOTICE 'Processing new user: %, Current user count: %, Is first user: %', 
                 NEW.email, user_count, is_first_user;
    
    -- For now, just create the user (we'll add invitation logic later)
    INSERT INTO public.users (
        supabase_auth_id,
        email,
        first_name,
        last_name,
        status
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
        'ACTIVE'
    ) RETURNING id INTO new_user_id;
    
    RAISE NOTICE 'Created public.users record % for %', new_user_id, NEW.email;
    
    -- If first user, make them super admin
    IF is_first_user THEN
        BEGIN
            SELECT id INTO super_admin_role_id 
            FROM public.roles 
            WHERE name = 'SUPER_ADMIN' 
              AND is_active = TRUE;
            
            IF super_admin_role_id IS NOT NULL THEN
                -- Make user system admin
                UPDATE public.users 
                SET is_system_admin = TRUE
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
                    new_user_id,
                    CURRENT_TIMESTAMP,
                    TRUE
                );
                
                RAISE NOTICE 'First user % automatically assigned as Super Admin', NEW.email;
            ELSE
                -- Just make them system admin if role doesn't exist
                UPDATE public.users 
                SET is_system_admin = TRUE
                WHERE id = new_user_id;
                
                RAISE NOTICE 'First user % made system admin (SUPER_ADMIN role not found)', NEW.email;
            END IF;
        EXCEPTION
            WHEN OTHERS THEN
                -- If any error, just make them system admin
                UPDATE public.users 
                SET is_system_admin = TRUE
                WHERE id = new_user_id;
                
                RAISE NOTICE 'First user % made system admin (role assignment failed: %)', NEW.email, SQLERRM;
        END;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION handle_new_user();

GRANT EXECUTE ON FUNCTION handle_new_user() TO service_role;
