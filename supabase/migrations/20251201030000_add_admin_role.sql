-- Add 'admin' to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'admin';

-- Update RLS policies for user_roles to allow admins to manage roles
DROP POLICY IF EXISTS "Users can view their own roles" ON public.user_roles;

CREATE POLICY "Users can view roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (true);

-- Allow admins to update roles
CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Allow managers to view all profiles
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;

CREATE POLICY "Users can view profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

-- Function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  )
$$;

-- Function to check if user is manager or admin
CREATE OR REPLACE FUNCTION public.is_manager_or_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'manager')
  )
$$;

-- Update managers table policies
DROP POLICY IF EXISTS "Authenticated users can view managers" ON public.managers;

CREATE POLICY "Authenticated users can view managers"
  ON public.managers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage managers"
  ON public.managers FOR ALL
  TO authenticated
  USING (public.is_admin(auth.uid()))
  WITH CHECK (public.is_admin(auth.uid()));





















