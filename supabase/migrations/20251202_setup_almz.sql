-- Очистка и настройка ALMZ
-- Запусти в Supabase SQL Editor: https://supabase.com/dashboard/project/nngnawaxyqzzvbtchhgw/sql

-- 1. Очистить google_ads_accounts
DELETE FROM google_ads_accounts;

-- 2. Очистить account_invitations
DELETE FROM account_invitations;

-- 3. Очистить mss_accounts  
DELETE FROM mss_accounts;

-- 4. Добавить ALMZ с готовым refresh token
INSERT INTO mss_accounts (
    name,
    mcc_number,
    developer_token,
    manager_email,
    status,
    google_refresh_token,
    google_connected_email,
    google_connected_at
) VALUES (
    'ALMZ',
    '493-816-1278',
    '5k9zvX4_DBzcFeyO_dwArQ',
    'ceo@pestnovaltd.com',
    'active',
    '1//0gzZXHV-xyF2FCgYIARAAGBASNwF-L9Ir2GtV2tW9FelHgYlBfI9um9gklaVgxJXrPGDPTjWLc8vBkCAMZYOf7oTXzgvpPZuitrw',
    'ceo@pestnovaltd.com',
    NOW()
);

-- 5. Проверка
SELECT id, name, mcc_number, 
       CASE WHEN google_refresh_token IS NOT NULL THEN '✅ Connected' ELSE '❌ Not connected' END as google_status
FROM mss_accounts;










