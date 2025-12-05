-- =====================================================
-- MSS MANAGER - ПОЛНАЯ НАСТРОЙКА SUPABASE
-- =====================================================
-- 
-- КАК ИСПОЛЬЗОВАТЬ:
-- 1. Открой Supabase Dashboard
-- 2. Иди в SQL Editor (слева в меню)
-- 3. Нажми "New Query"
-- 4. Скопируй ВЕСЬ этот код
-- 5. Нажми "Run" (или Ctrl+Enter)
--
-- =====================================================


-- =====================================================
-- ЧАСТЬ 1: УДАЛЕНИЕ СТАРЫХ ДАННЫХ (если есть)
-- =====================================================

-- Удаляем старые таблицы если существуют (в правильном порядке из-за foreign keys)
DROP TABLE IF EXISTS public.account_invitations CASCADE;
DROP TABLE IF EXISTS public.google_ads_accounts CASCADE;
DROP TABLE IF EXISTS public.user_favorite_currencies CASCADE;
DROP TABLE IF EXISTS public.user_roles CASCADE;
DROP TABLE IF EXISTS public.profiles CASCADE;
DROP TABLE IF EXISTS public.managers CASCADE;
DROP TABLE IF EXISTS public.mss_accounts CASCADE;
DROP TABLE IF EXISTS public.currencies CASCADE;
DROP TABLE IF EXISTS public.timezones CASCADE;

-- Удаляем старые типы
DROP TYPE IF EXISTS public.access_level CASCADE;
DROP TYPE IF EXISTS public.account_status CASCADE;
DROP TYPE IF EXISTS public.app_role CASCADE;


-- =====================================================
-- ЧАСТЬ 2: СОЗДАНИЕ ТИПОВ (ENUMS)
-- =====================================================

-- Уровни доступа для Google Ads
CREATE TYPE public.access_level AS ENUM ('admin', 'standard', 'read');

-- Статусы аккаунтов
CREATE TYPE public.account_status AS ENUM ('pending', 'active', 'suspended', 'closed');

-- Роли пользователей
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'client');


-- =====================================================
-- ЧАСТЬ 3: СОЗДАНИЕ ТАБЛИЦ
-- =====================================================

-- Профили пользователей
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Роли пользователей
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL DEFAULT 'client',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, role)
);

-- MSS (MCC) аккаунты
CREATE TABLE public.mss_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  mcc_number TEXT NOT NULL UNIQUE,
  developer_token TEXT NOT NULL,
  manager_email TEXT NOT NULL,
  manager_password TEXT,
  status account_status DEFAULT 'active',
  -- Google Ads API OAuth
  google_refresh_token TEXT,
  google_connected_email TEXT,
  google_connected_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Менеджеры Google Ads
CREATE TABLE public.managers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Валюты
CREATE TABLE public.currencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  symbol TEXT,
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Часовые пояса
CREATE TABLE public.timezones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  timezone_offset TEXT NOT NULL,
  country TEXT,
  flag_emoji TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Избранные валюты пользователя
CREATE TABLE public.user_favorite_currencies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  currency_id UUID REFERENCES public.currencies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, currency_id)
);

-- Приглашения в аккаунты
CREATE TABLE public.account_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mss_account_id UUID REFERENCES public.mss_accounts(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  access_level access_level DEFAULT 'admin',
  status TEXT DEFAULT 'pending',
  invited_at TIMESTAMPTZ DEFAULT now(),
  accepted_at TIMESTAMPTZ
);

-- Google Ads аккаунты
CREATE TABLE public.google_ads_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mss_account_id UUID REFERENCES public.mss_accounts(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL,
  currency_code TEXT NOT NULL,
  timezone TEXT NOT NULL,
  status account_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);


-- =====================================================
-- ЧАСТЬ 4: ВКЛЮЧЕНИЕ RLS (Row Level Security)
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


-- =====================================================
-- ЧАСТЬ 5: ФУНКЦИИ
-- =====================================================

-- Обновление updated_at
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

-- Проверка роли
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Проверка админа
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = 'admin'
  )
$$;

-- Проверка менеджера или админа
CREATE OR REPLACE FUNCTION public.is_manager_or_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'manager')
  )
$$;

-- Создание профиля при регистрации
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'client');
  
  RETURN NEW;
END;
$$;


-- =====================================================
-- ЧАСТЬ 6: ТРИГГЕРЫ
-- =====================================================

-- Триггер создания профиля
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Триггеры updated_at
CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_mss_accounts_updated_at
  BEFORE UPDATE ON public.mss_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_google_ads_accounts_updated_at
  BEFORE UPDATE ON public.google_ads_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- =====================================================
-- ЧАСТЬ 7: RLS ПОЛИТИКИ (ПРАВА ДОСТУПА)
-- =====================================================

-- PROFILES
CREATE POLICY "profiles_select" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- USER_ROLES
CREATE POLICY "user_roles_select" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_roles_insert" ON public.user_roles FOR INSERT TO authenticated WITH CHECK (public.is_admin(auth.uid()));
CREATE POLICY "user_roles_update" ON public.user_roles FOR UPDATE TO authenticated USING (public.is_admin(auth.uid()));
CREATE POLICY "user_roles_delete" ON public.user_roles FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- MSS_ACCOUNTS
CREATE POLICY "mss_select" ON public.mss_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "mss_insert" ON public.mss_accounts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "mss_update" ON public.mss_accounts FOR UPDATE TO authenticated USING (true);
CREATE POLICY "mss_delete" ON public.mss_accounts FOR DELETE TO authenticated USING (true);

-- MANAGERS
CREATE POLICY "managers_select" ON public.managers FOR SELECT TO authenticated USING (true);
CREATE POLICY "managers_insert" ON public.managers FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "managers_update" ON public.managers FOR UPDATE TO authenticated USING (true);
CREATE POLICY "managers_delete" ON public.managers FOR DELETE TO authenticated USING (public.is_admin(auth.uid()));

-- CURRENCIES
CREATE POLICY "currencies_select" ON public.currencies FOR SELECT TO authenticated USING (true);

-- TIMEZONES  
CREATE POLICY "timezones_select" ON public.timezones FOR SELECT TO authenticated USING (true);

-- USER_FAVORITE_CURRENCIES
CREATE POLICY "favorites_all" ON public.user_favorite_currencies FOR ALL TO authenticated 
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ACCOUNT_INVITATIONS
CREATE POLICY "invitations_select" ON public.account_invitations FOR SELECT TO authenticated USING (true);
CREATE POLICY "invitations_insert" ON public.account_invitations FOR INSERT TO authenticated WITH CHECK (true);

-- GOOGLE_ADS_ACCOUNTS
CREATE POLICY "gads_select" ON public.google_ads_accounts FOR SELECT TO authenticated USING (true);
CREATE POLICY "gads_insert" ON public.google_ads_accounts FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "gads_update" ON public.google_ads_accounts FOR UPDATE TO authenticated USING (true);


-- =====================================================
-- ЧАСТЬ 8: НАЧАЛЬНЫЕ ДАННЫЕ
-- =====================================================

-- Валюты
INSERT INTO public.currencies (code, name, symbol, is_default) VALUES
  ('USD', 'US Dollar', '$', true),
  ('EUR', 'Euro', '€', true),
  ('UAH', 'Ukrainian Hryvnia', '₴', true),
  ('PLN', 'Polish Zloty', 'zł', true),
  ('GBP', 'British Pound', '£', false),
  ('CHF', 'Swiss Franc', 'CHF', false),
  ('CAD', 'Canadian Dollar', 'CA$', false),
  ('AUD', 'Australian Dollar', 'A$', false),
  ('JPY', 'Japanese Yen', '¥', false),
  ('CNY', 'Chinese Yuan', '¥', false),
  ('RUB', 'Russian Ruble', '₽', false),
  ('TRY', 'Turkish Lira', '₺', false),
  ('INR', 'Indian Rupee', '₹', false),
  ('BRL', 'Brazilian Real', 'R$', false),
  ('KRW', 'South Korean Won', '₩', false);

-- Часовые пояса
INSERT INTO public.timezones (name, timezone_offset, country, flag_emoji) VALUES
  ('Kyiv', '+02:00', 'Ukraine', '🇺🇦'),
  ('Warsaw', '+01:00', 'Poland', '🇵🇱'),
  ('New York', '-05:00', 'USA', '🇺🇸'),
  ('Los Angeles', '-08:00', 'USA', '🇺🇸'),
  ('London', '+00:00', 'UK', '🇬🇧'),
  ('Berlin', '+01:00', 'Germany', '🇩🇪'),
  ('Paris', '+01:00', 'France', '🇫🇷'),
  ('Moscow', '+03:00', 'Russia', '🇷🇺'),
  ('Tokyo', '+09:00', 'Japan', '🇯🇵'),
  ('Sydney', '+11:00', 'Australia', '🇦🇺'),
  ('Dubai', '+04:00', 'UAE', '🇦🇪'),
  ('Singapore', '+08:00', 'Singapore', '🇸🇬'),
  ('Hong Kong', '+08:00', 'Hong Kong', '🇭🇰'),
  ('Istanbul', '+03:00', 'Turkey', '🇹🇷'),
  ('Toronto', '-05:00', 'Canada', '🇨🇦');

-- MSS аккаунт BETA_STONE
INSERT INTO public.mss_accounts (name, mcc_number, developer_token, manager_email, manager_password, status) VALUES
  ('BETA_STONE', '521-179-6829', 'eWBN45P304d-0JNtxagyUg', 'dev@pestnovaltd.com', 'rSQ97bN>', 'active');

-- Менеджер
INSERT INTO public.managers (name, email) VALUES
  ('Developer Manager', 'dev@pestnovaltd.com');


-- =====================================================
-- ГОТОВО!
-- =====================================================
-- 
-- После выполнения этого скрипта:
-- 1. Зарегистрируйся в приложении
-- 2. Сделай себя админом (см. ниже)
--
-- =====================================================


-- =====================================================
-- ЧАСТЬ 9: СДЕЛАТЬ СЕБЯ АДМИНОМ
-- =====================================================
-- 
-- ПОСЛЕ регистрации в приложении, выполни этот запрос
-- заменив email на свой:
--
-- UPDATE public.user_roles 
-- SET role = 'admin' 
-- WHERE user_id = (
--   SELECT id FROM public.profiles WHERE email = 'ТВОЙ_EMAIL@gmail.com'
-- );
--
-- =====================================================

