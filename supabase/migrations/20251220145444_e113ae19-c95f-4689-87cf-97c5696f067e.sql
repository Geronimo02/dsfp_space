-- Fix: Restrict profiles visibility to same-company users
-- Issue: profiles_public_read - User Profiles Accessible Across All Companies

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Profiles are viewable by everyone authenticated" ON profiles;

-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- Users can view profiles from their own company (via company_users table)
CREATE POLICY "Users can view profiles from their company"
  ON profiles FOR SELECT
  USING (
    id IN (
      SELECT cu.user_id 
      FROM company_users cu
      WHERE cu.company_id IN (
        SELECT company_id 
        FROM company_users 
        WHERE user_id = auth.uid() AND active = true
      )
      AND cu.active = true
    )
  );