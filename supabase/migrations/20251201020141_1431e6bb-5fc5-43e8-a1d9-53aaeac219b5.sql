-- Create enum for access levels
CREATE TYPE public.access_level AS ENUM ('admin', 'standard', 'read');

-- Create enum for account status
CREATE TYPE public.account_status AS ENUM ('pending', 'active', 'suspended', 'closed');

-- Create MSS (MCC) accounts table
CREATE TABLE public.mss_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  mcc_number TEXT NOT NULL UNIQUE,
  developer_token TEXT NOT NULL,
  manager_email TEXT NOT NULL,
  manager_password TEXT,
  status account_status DEFAULT 'active',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create managers table
CREATE TABLE public.managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create currencies table
CREATE TABLE public.currencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  symbol TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create timezones table
CREATE TABLE public.timezones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  timezone_offset TEXT NOT NULL,
  country TEXT,
  flag_emoji TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create user favorite currencies
CREATE TABLE public.user_favorite_currencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  currency_id UUID REFERENCES public.currencies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, currency_id)
);

-- Create account invitations table
CREATE TABLE public.account_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mss_account_id UUID REFERENCES public.mss_accounts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  access_level access_level DEFAULT 'admin',
  status TEXT DEFAULT 'pending',
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE
);

-- Create Google Ads accounts table
CREATE TABLE public.google_ads_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mss_account_id UUID REFERENCES public.mss_accounts(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL,
  currency_code TEXT NOT NULL,
  timezone TEXT NOT NULL,
  status account_status DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.mss_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timezones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_favorite_currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_ads_accounts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Authenticated users can view MSS accounts"
  ON public.mss_accounts FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can insert MSS accounts"
  ON public.mss_accounts FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can view managers"
  ON public.managers FOR SELECT TO authenticated USING (true);

CREATE POLICY "Everyone can view currencies"
  ON public.currencies FOR SELECT TO authenticated USING (true);

CREATE POLICY "Everyone can view timezones"
  ON public.timezones FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can manage their favorite currencies"
  ON public.user_favorite_currencies FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view invitations"
  ON public.account_invitations FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated users can create invitations"
  ON public.account_invitations FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can view Google Ads accounts"
  ON public.google_ads_accounts FOR SELECT TO authenticated USING (true);

-- Insert default currencies
INSERT INTO public.currencies (code, name, symbol, is_default) VALUES
  ('USD', 'US Dollar', '$', true),
  ('EUR', 'Euro', '€', true),
  ('GBP', 'British Pound', '£', false),
  ('JPY', 'Japanese Yen', '¥', false),
  ('CHF', 'Swiss Franc', 'CHF', false),
  ('CAD', 'Canadian Dollar', 'CA$', false),
  ('AUD', 'Australian Dollar', 'A$', false),
  ('CNY', 'Chinese Yuan', '¥', false),
  ('RUB', 'Russian Ruble', '₽', false),
  ('UAH', 'Ukrainian Hryvnia', '₴', false);

-- Insert default timezones
INSERT INTO public.timezones (name, timezone_offset, country, flag_emoji) VALUES
  ('Warsaw (Europe)', '+02:00', 'Poland', '🇵🇱'),
  ('New York (America)', '-05:00', 'USA', '🇺🇸'),
  ('London (Europe)', '+00:00', 'UK', '🇬🇧'),
  ('Tokyo (Asia)', '+09:00', 'Japan', '🇯🇵'),
  ('Sydney (Australia)', '+11:00', 'Australia', '🇦🇺'),
  ('Berlin (Europe)', '+01:00', 'Germany', '🇩🇪'),
  ('Paris (Europe)', '+01:00', 'France', '🇫🇷'),
  ('Moscow (Europe)', '+03:00', 'Russia', '🇷🇺'),
  ('Dubai (Asia)', '+04:00', 'UAE', '🇦🇪'),
  ('Singapore (Asia)', '+08:00', 'Singapore', '🇸🇬');

-- Insert default managers
INSERT INTO public.managers (name, email) VALUES
  ('Developer Manager', 'dev@pestnovaltd.com'),
  ('Vasia Manager', 'vasia@example.com');

-- Insert default MSS account
INSERT INTO public.mss_accounts (name, mcc_number, developer_token, manager_email) VALUES
  ('BETA_STONE', '521-179-6829', 'eWBN45P304d-0JNtxagyUg', 'dev@pestnovaltd.com');

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
CREATE TRIGGER update_mss_accounts_updated_at
  BEFORE UPDATE ON public.mss_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_google_ads_accounts_updated_at
  BEFORE UPDATE ON public.google_ads_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();