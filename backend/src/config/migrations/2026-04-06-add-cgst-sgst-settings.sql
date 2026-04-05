ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS default_cgst_percent DECIMAL(5, 2) DEFAULT 2.5,
ADD COLUMN IF NOT EXISTS default_sgst_percent DECIMAL(5, 2) DEFAULT 2.5;

UPDATE restaurants
SET
  default_cgst_percent = COALESCE(default_cgst_percent, COALESCE(default_gst_percent, 5) / 2),
  default_sgst_percent = COALESCE(default_sgst_percent, COALESCE(default_gst_percent, 5) / 2)
WHERE default_cgst_percent IS NULL
   OR default_sgst_percent IS NULL;
