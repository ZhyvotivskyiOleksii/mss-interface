-- Додати колонки для бюджетів в mss_metrics_cache
ALTER TABLE mss_metrics_cache 
ADD COLUMN IF NOT EXISTS total_budget DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_spent DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_remaining DECIMAL(15,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS percent_used INTEGER DEFAULT 0;

