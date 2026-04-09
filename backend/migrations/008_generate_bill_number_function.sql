-- Migration: Create generate_bill_number RPC function
-- Purpose: Atomically generate bill number and update order in single transaction
-- This prevents duplicate invoice_number errors and ensures idempotency

CREATE OR REPLACE FUNCTION generate_bill_number(
  p_order_id UUID,
  p_restaurant_id UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bill_number TEXT;
  v_existing_bill_number TEXT;
BEGIN
  IF p_order_id IS NULL OR p_restaurant_id IS NULL THEN
    RAISE EXCEPTION 'order_id and restaurant_id are required';
  END IF;

  -- Check if order already has a bill number (idempotency)
  SELECT invoice_number INTO v_existing_bill_number
  FROM orders
  WHERE id = p_order_id
    AND restaurant_id = p_restaurant_id;

  IF v_existing_bill_number IS NOT NULL THEN
    RETURN v_existing_bill_number;
  END IF;

  -- Generate next invoice number via RPC and get formatted bill number
  SELECT (get_next_invoice_number(p_restaurant_id)).formatted_invoice_number INTO v_bill_number;

  IF v_bill_number IS NULL THEN
    RAISE EXCEPTION 'Failed to generate bill number';
  END IF;

  -- Atomically update invoice_number (only if still NULL)
  UPDATE orders
  SET invoice_number = v_bill_number,
      updated_at = NOW()
  WHERE id = p_order_id
    AND restaurant_id = p_restaurant_id
    AND invoice_number IS NULL;

  RETURN v_bill_number;
END;
$$;

GRANT EXECUTE ON FUNCTION generate_bill_number(UUID, UUID) TO authenticated, anon, service_role;
