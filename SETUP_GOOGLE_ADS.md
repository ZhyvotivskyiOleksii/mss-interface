# Настройка Google Ads API интеграции

## 1. Google Cloud Console

Ты уже создал проект BETA-STONE и OAuth Client. ✅

### Добавь Redirect URI:

1. Иди в [Google Cloud Console](https://console.cloud.google.com/apis/credentials?project=beta-stone)
2. Нажми на **Web client 1**
3. В разделе **Authorized redirect URIs** добавь:
   ```
   https://ВАШ_SUPABASE_URL/functions/v1/google-ads-callback
   ```
   Например: `https://abcdefgh.supabase.co/functions/v1/google-ads-callback`

4. Нажми **Save**

### Включи Google Ads API:

1. Иди в [Library](https://console.cloud.google.com/apis/library?project=beta-stone)
2. Найди **Google Ads API**
3. Нажми **Enable**

---

## 2. Supabase Dashboard

### Добавь Environment Variables:

1. Иди в **Supabase Dashboard** → **Settings** → **Edge Functions**
2. Добавь переменные:

```
GOOGLE_ADS_CLIENT_ID=669872731512-e0ukp41pdeg631rj6s7jodd1b4uth8mf.apps.googleusercontent.com
GOOGLE_ADS_CLIENT_SECRET=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
APP_URL=https://твой-домен.com
```

Или в **Project Settings** → **Configuration** → **Edge Functions** → **Add new secret**

### Задеплой Edge Functions:

```bash
# Установи Supabase CLI если не установлен
npm install -g supabase

# Залогинься
supabase login

# Линкуй проект
supabase link --project-ref твой-project-ref

# Деплой функции
supabase functions deploy google-ads-auth
supabase functions deploy google-ads-callback
supabase functions deploy create-google-ads-accounts
```

---

## 3. Выполни миграцию

В **SQL Editor** выполни:

```sql
-- Добавить колонки для Google Ads токенов
ALTER TABLE public.mss_accounts 
ADD COLUMN IF NOT EXISTS google_refresh_token TEXT,
ADD COLUMN IF NOT EXISTS google_connected_email TEXT,
ADD COLUMN IF NOT EXISTS google_connected_at TIMESTAMP WITH TIME ZONE;
```

---

## 4. Как работает

1. **Пользователь** нажимает "Подключить Google Ads" на странице MSS аккаунта
2. **Редирект** на Google OAuth с scope `https://www.googleapis.com/auth/adwords`
3. **Пользователь** авторизуется под `dev@pestnovaltd.com` (или другим аккаунтом с доступом к MCC)
4. **Callback** получает код, обменивает на токены
5. **Refresh token** сохраняется в базу для этого MSS
6. При **создании аккаунтов**:
   - Получаем свежий access_token из refresh_token
   - Вызываем Google Ads API для создания customer account
   - Отправляем приглашения на указанные email

---

## 5. Важно!

- **Developer Token** (`eWBN45P304d-0JNtxagyUg`) должен быть одобрен Google для production
- Пока токен в **Test** режиме - можно создавать только тестовые аккаунты
- Для production нужно подать заявку на [Google Ads API Access](https://developers.google.com/google-ads/api/docs/get-started/dev-token)

---

## Credentials (для справки)

```
Client ID: 669872731512-e0ukp41pdeg631rj6s7jodd1b4uth8mf.apps.googleusercontent.com
Client Secret: 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
Developer Token: eWBN45P304d-0JNtxagyUg
MCC: 521-179-6829
Manager Email: dev@pestnovaltd.com
```





















