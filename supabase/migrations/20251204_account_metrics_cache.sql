-- Таблиця для кешування метрик по кожному акаунту
CREATE TABLE IF NOT EXISTS account_metrics_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mss_account_id UUID NOT NULL REFERENCES mss_accounts(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL,
  customer_name TEXT,
  currency_code TEXT,
  timezone TEXT,
  is_manager BOOLEAN DEFAULT false,
  status TEXT,
  
  -- Метрики
  clicks BIGINT DEFAULT 0,
  impressions BIGINT DEFAULT 0,
  cost_micros BIGINT DEFAULT 0,
  cost DECIMAL(12,2) DEFAULT 0,
  conversions DECIMAL(10,2) DEFAULT 0,
  ctr DECIMAL(5,2) DEFAULT 0,
  avg_cpc DECIMAL(8,2) DEFAULT 0,
  
  -- Мітки часу
  metrics_date_from DATE,
  metrics_date_to DATE,
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Унікальність
  UNIQUE(mss_account_id, customer_id)
);

-- Індекси
CREATE INDEX IF NOT EXISTS idx_account_metrics_mss_id ON account_metrics_cache(mss_account_id);
CREATE INDEX IF NOT EXISTS idx_account_metrics_customer_id ON account_metrics_cache(customer_id);

-- RLS
ALTER TABLE account_metrics_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to account_metrics_cache" ON account_metrics_cache
  FOR ALL USING (true) WITH CHECK (true);







