-- Очистка всіх даних для свіжого старту
-- Виконай це в Supabase SQL Editor

-- Видаляємо всі записи (в правильному порядку через foreign keys)
DELETE FROM public.account_invitations;
DELETE FROM public.google_ads_accounts;
DELETE FROM public.activity_log;
DELETE FROM public.mss_accounts;

-- Перевірка що все видалено
SELECT 'mss_accounts' as table_name, count(*) as count FROM public.mss_accounts
UNION ALL
SELECT 'google_ads_accounts', count(*) FROM public.google_ads_accounts
UNION ALL
SELECT 'account_invitations', count(*) FROM public.account_invitations
UNION ALL
SELECT 'activity_log', count(*) FROM public.activity_log;





















