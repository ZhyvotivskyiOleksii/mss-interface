-- Add Google Ads OAuth fields to mss_accounts table
ALTER TABLE public.mss_accounts 
ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS google_connected_email TEXT,
ADD COLUMN IF NOT EXISTS google_connected_at TIMESTAMP WITH TIME ZONE;

-- Comment on columns
COMMENT ON COLUMN public.mss_accounts.google_refresh_token IS 'Google OAuth refresh token for Google Ads API';
COMMENT ON COLUMN public.mss_accounts.google_connected_email IS 'Email of the Google account connected for API access';
COMMENT ON COLUMN public.mss_accounts.google_connected_at IS 'Timestamp when Google Ads was connected';





















