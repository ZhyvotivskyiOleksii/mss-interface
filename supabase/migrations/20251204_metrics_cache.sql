-- Таблиця для кешування метрик MSS
CREATE TABLE IF NOT EXISTS mss_metrics_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mss_account_id UUID NOT NULL REFERENCES mss_accounts(id) ON DELETE CASCADE,
  
  -- Загальні метрики
  total_clicks BIGINT DEFAULT 0,
  total_impressions BIGINT DEFAULT 0,
  total_cost DECIMAL(12,2) DEFAULT 0,
  total_conversions DECIMAL(10,2) DEFAULT 0,
  avg_cpc DECIMAL(8,2) DEFAULT 0,
  ctr DECIMAL(5,2) DEFAULT 0,
  
  -- Статистика
  account_count INTEGER DEFAULT 0,
  folder_count INTEGER DEFAULT 0,
  
  -- Таймстемпи
  last_updated_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Унікальність по MSS
  UNIQUE(mss_account_id)
);

-- Індекс для швидкого пошуку
CREATE INDEX IF NOT EXISTS idx_mss_metrics_cache_mss_id ON mss_metrics_cache(mss_account_id);

-- RLS
ALTER TABLE mss_metrics_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to mss_metrics_cache" ON mss_metrics_cache
  FOR ALL USING (true) WITH CHECK (true);




