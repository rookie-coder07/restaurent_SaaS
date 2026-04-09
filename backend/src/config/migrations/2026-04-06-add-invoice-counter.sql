CREATE TABLE IF NOT EXISTS invoice_counters (
  restaurant_id UUID PRIMARY KEY REFERENCES restaurants(id) ON DELETE CASCADE,
  prefix VARCHAR(20) NOT NULL DEFAULT 'INV',
  next_number BIGINT NOT NULL DEFAULT 1001,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT invoice_counters_prefix_check CHECK (prefix ~ '^[A-Z0-9][A-Z0-9-]{0,19}$'),
  CONSTRAINT invoice_counters_next_number_check CHECK (next_number > 0)
);

CREATE OR REPLACE FUNCTION set_invoice_counter_config(
  p_restaurant_id UUID,
  p_prefix TEXT DEFAULT NULL,
  p_starting_number BIGINT DEFAULT NULL
)
RETURNS TABLE (
  restaurant_id UUID,
  prefix TEXT,
  next_number BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_current invoice_counters%ROWTYPE;
  v_prefix TEXT;
  v_starting_number BIGINT;
BEGIN
  IF p_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'restaurant_id is required';
  END IF;

  v_prefix := UPPER(TRIM(COALESCE(p_prefix, '')));
  IF v_prefix = '' THEN
    v_prefix := 'INV';
  END IF;

  IF v_prefix !~ '^[A-Z0-9][A-Z0-9-]{0,19}$' THEN
    RAISE EXCEPTION 'Invoice prefix must contain only uppercase letters, numbers, or hyphens';
  END IF;

  v_starting_number := COALESCE(p_starting_number, 1001);
  IF v_starting_number <= 0 THEN
    RAISE EXCEPTION 'Invoice starting number must be greater than zero';
  END IF;

  LOOP
    SELECT *
    INTO v_current
    FROM invoice_counters
    WHERE invoice_counters.restaurant_id = p_restaurant_id
    FOR UPDATE;

    EXIT WHEN FOUND;

    BEGIN
      INSERT INTO invoice_counters (restaurant_id, prefix, next_number)
      VALUES (p_restaurant_id, v_prefix, v_starting_number);
    EXCEPTION
      WHEN unique_violation THEN
        NULL;
    END;
  END LOOP;

  IF v_current.restaurant_id IS NOT NULL AND p_starting_number IS NOT NULL AND p_starting_number < v_current.next_number THEN
    RAISE EXCEPTION 'Bill starting number must be greater than or equal to the current next number (%)', v_current.next_number;
  END IF;

  UPDATE invoice_counters
  SET
    prefix = COALESCE(NULLIF(v_prefix, ''), prefix),
    next_number = CASE
      WHEN p_starting_number IS NULL THEN next_number
      ELSE GREATEST(next_number, p_starting_number)
    END,
    updated_at = NOW()
  WHERE restaurant_id = p_restaurant_id;

  RETURN QUERY
  SELECT
    invoice_counters.restaurant_id,
    invoice_counters.prefix::TEXT,
    invoice_counters.next_number
  FROM invoice_counters
  WHERE invoice_counters.restaurant_id = p_restaurant_id;
END;
$$;

CREATE OR REPLACE FUNCTION get_next_invoice_number(p_restaurant_id UUID)
RETURNS TABLE (
  prefix TEXT,
  invoice_number BIGINT,
  formatted_invoice_number TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_number BIGINT;
  v_prefix TEXT;
BEGIN
  IF p_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'restaurant_id is required';
  END IF;

  -- Ensure counter exists (idempotent, don't reset)
  BEGIN
    INSERT INTO invoice_counters (restaurant_id, prefix, next_number)
    VALUES (p_restaurant_id, 'INV', 1001)
    ON CONFLICT (restaurant_id) DO NOTHING;
  EXCEPTION
    WHEN unique_violation THEN
      NULL;
  END;

  -- Lock and atomically increment
  UPDATE invoice_counters
  SET next_number = next_number + 1,
      updated_at = NOW()
  WHERE restaurant_id = p_restaurant_id
  RETURNING prefix, next_number INTO v_prefix, v_current_number;

  IF v_prefix IS NULL THEN
    RAISE EXCEPTION 'Failed to get invoice counter for restaurant %', p_restaurant_id;
  END IF;

  -- Return the incremented number (the one we just assigned)
  RETURN QUERY SELECT v_prefix::TEXT, v_current_number, (v_prefix || '-' || v_current_number::TEXT)::TEXT;
END;
$$;
