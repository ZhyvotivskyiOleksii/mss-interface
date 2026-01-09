-- ================================================
-- MCC Structure Cache Table
-- Швидке завантаження ієрархії акаунтів
-- ================================================

-- Таблиця для кешування структури MCC
CREATE TABLE IF NOT EXISTS mcc_structure_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mss_account_id UUID NOT NULL REFERENCES mss_accounts(id) ON DELETE CASCADE,
  
  -- Кешовані дані
  folders JSONB DEFAULT '[]',           -- Sub-MCCs з акаунтами
  direct_accounts JSONB DEFAULT '[]',   -- Акаунти напряму під MCC
  total_accounts INTEGER DEFAULT 0,
  total_folders INTEGER DEFAULT 0,
  
  -- Метадані
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '1 hour'),
  
  -- Унікальність
  CONSTRAINT unique_mss_cache UNIQUE (mss_account_id)
);

-- Індекс для швидкого пошуку
CREATE INDEX IF NOT EXISTS idx_mcc_cache_mss_id ON mcc_structure_cache(mss_account_id);
CREATE INDEX IF NOT EXISTS idx_mcc_cache_expires ON mcc_structure_cache(expires_at);

-- RLS
ALTER TABLE mcc_structure_cache ENABLE ROW LEVEL SECURITY;

-- Політики доступу
CREATE POLICY "Anyone can read cache" ON mcc_structure_cache
  FOR SELECT USING (true);

CREATE POLICY "Service can manage cache" ON mcc_structure_cache
  FOR ALL USING (true);

-- Функція для оновлення кешу
CREATE OR REPLACE FUNCTION update_mcc_cache(
  p_mss_account_id UUID,
  p_folders JSONB,
  p_direct_accounts JSONB,
  p_total_accounts INTEGER,
  p_total_folders INTEGER
) RETURNS void AS $$
BEGIN
  INSERT INTO mcc_structure_cache (
    mss_account_id, folders, direct_accounts, 
    total_accounts, total_folders, cached_at, expires_at
  ) VALUES (
    p_mss_account_id, p_folders, p_direct_accounts,
    p_total_accounts, p_total_folders, NOW(), NOW() + INTERVAL '1 hour'
  )
  ON CONFLICT (mss_account_id) DO UPDATE SET
    folders = p_folders,
    direct_accounts = p_direct_accounts,
    total_accounts = p_total_accounts,
    total_folders = p_total_folders,
    cached_at = NOW(),
    expires_at = NOW() + INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- Коментар
COMMENT ON TABLE mcc_structure_cache IS 'Кеш структури MCC для швидкого завантаження';




