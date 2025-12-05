-- =====================================================
-- 🔄 MSS MANAGER - ПОВНИЙ RESET БАЗИ ДАНИХ
-- =====================================================
-- Виконай в Supabase SQL Editor:
-- https://supabase.com/dashboard/project/nngnawaxyqzzvbtchhgw/sql
-- =====================================================

-- 1️⃣ ОЧИСТИТИ ВСІ ДАНІ (крім валют і таймзон)
-- =====================================================

-- Видалити кеш метрик
TRUNCATE TABLE IF EXISTS account_metrics_cache CASCADE;
TRUNCATE TABLE IF EXISTS mss_metrics_cache CASCADE;

-- Видалити бюджети
TRUNCATE TABLE IF EXISTS account_budgets CASCADE;

-- Видалити запрошення
TRUNCATE TABLE IF EXISTS account_invitations CASCADE;

-- Видалити Google Ads акаунти
TRUNCATE TABLE IF EXISTS google_ads_accounts CASCADE;

-- Видалити логи активності
TRUNCATE TABLE IF EXISTS activity_log CASCADE;

-- Видалити MSS акаунти
TRUNCATE TABLE IF EXISTS mss_accounts CASCADE;

-- Видалити менеджерів
TRUNCATE TABLE IF EXISTS managers CASCADE;

-- Видалити улюблені валюти користувачів
TRUNCATE TABLE IF EXISTS user_favorite_currencies CASCADE;

-- НЕ чіпаємо: currencies, timezones, profiles, user_roles

-- 2️⃣ ПЕРЕВІРИТИ ЩО ВАЛЮТИ І ТАЙМЗОНИ Є
-- =====================================================

-- Додати валюти якщо їх немає
INSERT INTO currencies (code, name, symbol, is_default) 
SELECT * FROM (VALUES
  ('USD', 'US Dollar', '$', true),
  ('EUR', 'Euro', '€', true),
  ('UAH', 'Ukrainian Hryvnia', '₴', true),
  ('PLN', 'Polish Zloty', 'zł', true),
  ('GBP', 'British Pound', '£', true),
  ('CAD', 'Canadian Dollar', 'CA$', false),
  ('AUD', 'Australian Dollar', 'A$', false),
  ('CHF', 'Swiss Franc', 'CHF', false),
  ('JPY', 'Japanese Yen', '¥', false),
  ('CNY', 'Chinese Yuan', '¥', false)
) AS v(code, name, symbol, is_default)
WHERE NOT EXISTS (SELECT 1 FROM currencies LIMIT 1);

-- Додати таймзони якщо їх немає
INSERT INTO timezones (name, timezone_offset, country, flag_emoji)
SELECT * FROM (VALUES
  ('Kyiv', '+02:00', 'Ukraine', '🇺🇦'),
  ('Warsaw', '+01:00', 'Poland', '🇵🇱'),
  ('London', '+00:00', 'UK', '🇬🇧'),
  ('Berlin', '+01:00', 'Germany', '🇩🇪'),
  ('Paris', '+01:00', 'France', '🇫🇷'),
  ('New York', '-05:00', 'USA', '🇺🇸'),
  ('Los Angeles', '-08:00', 'USA', '🇺🇸'),
  ('Toronto', '-05:00', 'Canada', '🇨🇦'),
  ('Dubai', '+04:00', 'UAE', '🇦🇪'),
  ('Singapore', '+08:00', 'Singapore', '🇸🇬'),
  ('Tokyo', '+09:00', 'Japan', '🇯🇵'),
  ('Sydney', '+11:00', 'Australia', '🇦🇺'),
  ('Moscow', '+03:00', 'Russia', '🇷🇺'),
  ('Istanbul', '+03:00', 'Turkey', '🇹🇷'),
  ('Hong Kong', '+08:00', 'Hong Kong', '🇭🇰')
) AS v(name, timezone_offset, country, flag_emoji)
WHERE NOT EXISTS (SELECT 1 FROM timezones LIMIT 1);

-- 3️⃣ СТВОРИТИ МЕНЕДЖЕРА ЗА ЗАМОВЧУВАННЯМ
-- =====================================================

INSERT INTO managers (name, email) VALUES
  ('Default Manager', 'manager@company.com')
ON CONFLICT (email) DO NOTHING;

-- 4️⃣ ПЕРЕВІРКА
-- =====================================================

SELECT 'MSS Accounts' as table_name, COUNT(*) as count FROM mss_accounts
UNION ALL
SELECT 'Google Ads Accounts', COUNT(*) FROM google_ads_accounts
UNION ALL
SELECT 'Invitations', COUNT(*) FROM account_invitations
UNION ALL
SELECT 'Managers', COUNT(*) FROM managers
UNION ALL
SELECT 'Currencies', COUNT(*) FROM currencies
UNION ALL
SELECT 'Timezones', COUNT(*) FROM timezones;

-- =====================================================
-- ✅ ГОТОВО! База очищена.
-- Тепер додай MSS через інтерфейс або виконай наступний SQL:
-- =====================================================

-- ОПЦІОНАЛЬНО: Додати ALMZ MSS з токенами
/*
INSERT INTO mss_accounts (
  name, 
  mcc_number, 
  developer_token, 
  manager_email,
  google_refresh_token,
  google_connected_email,
  google_connected_at,
  status
) VALUES (
  'ALMZ',
  '493-816-1278',
  '5k9zvX4_DBzcFeyO_dwArQ',
  'manager@company.com',
  '1//0gaDXFBSv_hUJCgYIARAAGBASNwF-L9IrtQcoxHUS_ypedkc6Q_DYKgJwXO1dJcpqcAVoF4TmexHfENmzU5alnSXQPaRMG14S_8U',
  'pablo@almz.com',
  NOW(),
  'active'
);
*/

