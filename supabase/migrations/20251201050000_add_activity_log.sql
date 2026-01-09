-- Activity Log table for tracking all actions
CREATE TABLE IF NOT EXISTS public.activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email TEXT,
  action TEXT NOT NULL, -- 'create_mss', 'delete_mss', 'create_account', 'transfer', 'connect_google', etc.
  entity_type TEXT, -- 'mss_account', 'google_ads_account', 'manager', etc.
  entity_id UUID,
  entity_name TEXT,
  details JSONB, -- Additional details about the action
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;

-- Policies - all authenticated users can view, only system can insert
CREATE POLICY "activity_log_select" ON public.activity_log FOR SELECT TO authenticated USING (true);
CREATE POLICY "activity_log_insert" ON public.activity_log FOR INSERT TO authenticated WITH CHECK (true);

-- Index for faster queries
CREATE INDEX idx_activity_log_created_at ON public.activity_log(created_at DESC);
CREATE INDEX idx_activity_log_user_id ON public.activity_log(user_id);
CREATE INDEX idx_activity_log_action ON public.activity_log(action);





















