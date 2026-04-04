ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS business_name VARCHAR(255),
ADD COLUMN IF NOT EXISTS cuisine_type VARCHAR(100),
ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'active',
ADD COLUMN IF NOT EXISTS subscription_start TIMESTAMP DEFAULT now(),
ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(100),
ADD COLUMN IF NOT EXISTS subscription_renewal TIMESTAMP,
ADD COLUMN IF NOT EXISTS timezone VARCHAR(100) DEFAULT 'Asia/Kolkata',
ADD COLUMN IF NOT EXISTS currency VARCHAR(10) DEFAULT 'INR',
ADD COLUMN IF NOT EXISTS enable_gst BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS default_gst_percent DECIMAL(5, 2) DEFAULT 5;

UPDATE restaurants
SET
  business_name = COALESCE(NULLIF(business_name, ''), name),
  subscription_status = COALESCE(NULLIF(subscription_status, ''), status, 'active'),
  timezone = COALESCE(NULLIF(timezone, ''), 'Asia/Kolkata'),
  currency = COALESCE(NULLIF(currency, ''), 'INR'),
  default_gst_percent = COALESCE(default_gst_percent, 5),
  enable_gst = COALESCE(enable_gst, true)
WHERE
  business_name IS NULL
  OR business_name = ''
  OR subscription_status IS NULL
  OR subscription_status = ''
  OR timezone IS NULL
  OR timezone = ''
  OR currency IS NULL
  OR currency = ''
  OR default_gst_percent IS NULL
  OR enable_gst IS NULL;
