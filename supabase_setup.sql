-- =====================================================
-- MSS MANAGER - ПОЛНАЯ НАСТРОЙКА SUPABASE
-- =====================================================
-- Скопируй этот код и выполни в Supabase SQL Editor:
-- Dashboard -> SQL Editor -> New Query -> Вставить -> Run
-- =====================================================

-- =====================================================
-- 1. СОЗДАНИЕ ENUM ТИПОВ
-- =====================================================

-- Уровни доступа для Google Ads аккаунтов
CREATE TYPE public.access_level AS ENUM ('admin', 'standard', 'read');

-- Статусы аккаунтов
CREATE TYPE public.account_status AS ENUM ('pending', 'active', 'suspended', 'closed');

-- Роли пользователей в системе
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'client');


-- =====================================================
-- 2. СОЗДАНИЕ ТАБЛИЦ
-- =====================================================

-- Профили пользователей (связан с auth.users)
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Роли пользователей
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'client',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, role)
);

-- MSS (MCC) аккаунты Google Ads
CREATE TABLE public.mss_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  mcc_number TEXT NOT NULL UNIQUE,
  developer_token TEXT NOT NULL,
  manager_email TEXT NOT NULL,
  manager_password TEXT,
  status account_status DEFAULT 'active',
  -- Google Ads API OAuth tokens
  google_refresh_token TEXT,
  google_connected_email TEXT,
  google_connected_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Менеджеры Google Ads
CREATE TABLE public.managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Валюты
CREATE TABLE public.currencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  symbol TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Часовые пояса
CREATE TABLE public.timezones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  timezone_offset TEXT NOT NULL,
  country TEXT,
  flag_emoji TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Избранные валюты пользователя
CREATE TABLE public.user_favorite_currencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  currency_id UUID REFERENCES public.currencies(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, currency_id)
);

-- Приглашения в аккаунты
CREATE TABLE public.account_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mss_account_id UUID REFERENCES public.mss_accounts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  access_level access_level DEFAULT 'admin',
  status TEXT DEFAULT 'pending',
  invited_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  accepted_at TIMESTAMP WITH TIME ZONE
);

-- Google Ads аккаунты
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


-- Account budgets cache
CREATE TABLE public.account_budgets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mss_account_id UUID REFERENCES public.mss_accounts(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  budget_id TEXT NOT NULL,
  budget_name TEXT NOT NULL,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  budget_amount_micros BIGINT,
  remaining_budget_micros BIGINT,
  spend_micros BIGINT,
  spend_percent NUMERIC,
  purchase_order TEXT,
  status TEXT,
  currency_code TEXT,
  spending_limit_type TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  unique (mss_account_id, budget_id)
);


-- =====================================================
-- 3. ВКЛЮЧЕНИЕ ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mss_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.managers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.timezones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_favorite_currencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.google_ads_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_budgets ENABLE ROW LEVEL SECURITY;


-- =====================================================
-- 4. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
-- =====================================================

-- Функция обновления updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Проверка роли пользователя
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Проверка является ли пользователь админом
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

-- Проверка является ли пользователь менеджером или админом
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

-- Функция создания профиля при регистрации
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Создаём профиль
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  
  -- Назначаем роль client по умолчанию
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'client');
  
  RETURN NEW;
END;
$$;


-- =====================================================
-- 5. ТРИГГЕРЫ
-- =====================================================

-- Триггер создания профиля при регистрации
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Триггеры обновления updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_mss_accounts_updated_at
  BEFORE UPDATE ON public.mss_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_google_ads_accounts_updated_at
  BEFORE UPDATE ON public.google_ads_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();


-- =====================================================
-- 6. RLS ПОЛИТИКИ (ПРАВА ДОСТУПА)
-- =====================================================

-- PROFILES
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

-- USER_ROLES
CREATE POLICY "Users can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update roles"
  ON public.user_roles FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- MSS_ACCOUNTS
CREATE POLICY "Authenticated users can view MSS accounts"
  ON public.mss_accounts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers and admins can insert MSS accounts"
  ON public.mss_accounts FOR INSERT
  TO authenticated
  WITH CHECK (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Managers and admins can update MSS accounts"
  ON public.mss_accounts FOR UPDATE
  TO authenticated
  USING (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Admins can delete MSS accounts"
  ON public.mss_accounts FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- MANAGERS
CREATE POLICY "Authenticated users can view managers"
  ON public.managers FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert managers"
  ON public.managers FOR INSERT
  TO authenticated
  WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Admins can update managers"
  ON public.managers FOR UPDATE
  TO authenticated
  USING (public.is_admin(auth.uid()));

CREATE POLICY "Admins can delete managers"
  ON public.managers FOR DELETE
  TO authenticated
  USING (public.is_admin(auth.uid()));

-- CURRENCIES
CREATE POLICY "Everyone can view currencies"
  ON public.currencies FOR SELECT
  TO authenticated
  USING (true);

-- TIMEZONES
CREATE POLICY "Everyone can view timezones"
  ON public.timezones FOR SELECT
  TO authenticated
  USING (true);

-- USER_FAVORITE_CURRENCIES
CREATE POLICY "Users can manage their favorite currencies"
  ON public.user_favorite_currencies FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ACCOUNT_INVITATIONS
CREATE POLICY "Authenticated users can view invitations"
  ON public.account_invitations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers and admins can create invitations"
  ON public.account_invitations FOR INSERT
  TO authenticated
  WITH CHECK (public.is_manager_or_admin(auth.uid()));

-- GOOGLE_ADS_ACCOUNTS
CREATE POLICY "Authenticated users can view Google Ads accounts"
  ON public.google_ads_accounts FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Managers and admins can insert Google Ads accounts"
  ON public.google_ads_accounts FOR INSERT
  TO authenticated
  WITH CHECK (public.is_manager_or_admin(auth.uid()));

CREATE POLICY "Managers and admins can update Google Ads accounts"
  ON public.google_ads_accounts FOR UPDATE
  TO authenticated
  USING (public.is_manager_or_admin(auth.uid()));

-- ACCOUNT_BUDGETS
CREATE POLICY "Authenticated users can view account budgets"
  ON public.account_budgets FOR SELECT
  TO authenticated
  USING (true);


-- =====================================================
-- 7. НАЧАЛЬНЫЕ ДАННЫЕ
-- =====================================================

-- Валюты
INSERT INTO public.currencies (code, name, symbol, is_default) VALUES
  ('USD', 'US Dollar', '$', true),
  ('EUR', 'Euro', '€', true),
  ('UAH', 'Ukrainian Hryvnia', '₴', true),
  ('PLN', 'Polish Zloty', 'zł', true),
  ('GBP', 'British Pound', '£', false),
  ('JPY', 'Japanese Yen', '¥', false),
  ('CHF', 'Swiss Franc', 'CHF', false),
  ('CAD', 'Canadian Dollar', 'CA$', false),
  ('AUD', 'Australian Dollar', 'A$', false),
  ('CNY', 'Chinese Yuan', '¥', false),
  ('RUB', 'Russian Ruble', '₽', false),
  ('TRY', 'Turkish Lira', '₺', false),
  ('INR', 'Indian Rupee', '₹', false),
  ('BRL', 'Brazilian Real', 'R$', false),
  ('KRW', 'South Korean Won', '₩', false);

-- Часовые пояса
INSERT INTO public.timezones (name, timezone_offset, country, flag_emoji) VALUES
  ('Kyiv (Europe)', '+02:00', 'Ukraine', '🇺🇦'),
  ('Warsaw (Europe)', '+01:00', 'Poland', '🇵🇱'),
  ('New York (America)', '-05:00', 'USA', '🇺🇸'),
  ('Los Angeles (America)', '-08:00', 'USA', '🇺🇸'),
  ('London (Europe)', '+00:00', 'UK', '🇬🇧'),
  ('Berlin (Europe)', '+01:00', 'Germany', '🇩🇪'),
  ('Paris (Europe)', '+01:00', 'France', '🇫🇷'),
  ('Moscow (Europe)', '+03:00', 'Russia', '🇷🇺'),
  ('Tokyo (Asia)', '+09:00', 'Japan', '🇯🇵'),
  ('Sydney (Australia)', '+11:00', 'Australia', '🇦🇺'),
  ('Dubai (Asia)', '+04:00', 'UAE', '🇦🇪'),
  ('Singapore (Asia)', '+08:00', 'Singapore', '🇸🇬'),
  ('Hong Kong (Asia)', '+08:00', 'Hong Kong', '🇭🇰'),
  ('Istanbul (Europe)', '+03:00', 'Turkey', '🇹🇷'),
  ('Toronto (America)', '-05:00', 'Canada', '🇨🇦');


-- =====================================================
-- 8. НАЧАЛЬНЫЕ MSS И МЕНЕДЖЕРЫ
-- =====================================================

-- MSS аккаунт BETA_STONE
INSERT INTO public.mss_accounts (name, mcc_number, developer_token, manager_email, manager_password, status) VALUES
  ('BETA_STONE', '521-179-6829', 'eWBN45P304d-0JNtxagyUg', 'dev@pestnovaltd.com', 'rSQ97bN>', 'active');

-- Менеджер по умолчанию
INSERT INTO public.managers (name, email) VALUES
  ('Developer Manager', 'dev@pestnovaltd.com');


-- =====================================================
-- 9. СОЗДАНИЕ ПЕРВОГО АДМИНА
-- =====================================================
-- ВАЖНО: Замени 'your-email@gmail.com' на свой email!
-- Выполни этот запрос ПОСЛЕ регистрации в приложении

-- UPDATE public.user_roles 
-- SET role = 'admin' 
-- WHERE user_id = (
--   SELECT id FROM public.profiles WHERE email = 'your-email@gmail.com'
-- );


-- =====================================================
-- ГОТОВО! 
-- =====================================================
-- 
-- Что дальше:
--
-- 1. Настрой Google OAuth в Supabase:
--    - Authentication -> Providers -> Google
--    - Включи Google
--    - Добавь Client ID и Client Secret из Google Cloud Console
--    - В Google Cloud Console добавь Redirect URL из Supabase
--
-- 2. Создай .env файл в проекте:
--    VITE_SUPABASE_URL=https://твой-проект.supabase.co
--    VITE_SUPABASE_PUBLISHABLE_KEY=твой-anon-key
--
-- 3. Зарегистрируйся в приложении и сделай себя админом (пункт 9)
--
-- 4. Для интеграции с Google Ads API нужно:
--    - Создать проект в Google Cloud Console
--    - Включить Google Ads API
--    - Получить OAuth credentials
--    - Добавить refresh_token для менеджера MSS
--
-- =====================================================
