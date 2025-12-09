-- Stripe Payment Integration Schema

-- Add payment fields to requests table
ALTER TABLE requests
ADD COLUMN payment_status VARCHAR(50) DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
ADD COLUMN stripe_payment_intent_id VARCHAR(255) UNIQUE,
ADD COLUMN amount_php DECIMAL(10, 2),
ADD COLUMN payment_method VARCHAR(50),
ADD COLUMN payment_date TIMESTAMP,
ADD COLUMN payment_receipt_url TEXT;

-- Create payments table for detailed payment records
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stripe_payment_intent_id VARCHAR(255) UNIQUE NOT NULL,
  stripe_charge_id VARCHAR(255),
  amount_php DECIMAL(10, 2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'PHP',
  payment_method VARCHAR(50) NOT NULL, -- 'card', 'gcash', 'maya', etc.
  payment_status VARCHAR(50) NOT NULL CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
  description TEXT,
  metadata JSONB, -- Store additional data
  receipt_url TEXT,
  receipt_email VARCHAR(255),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create payment history table for tracking payment changes
CREATE TABLE IF NOT EXISTS payment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  request_id UUID NOT NULL REFERENCES requests(id) ON DELETE CASCADE,
  old_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  changed_by UUID REFERENCES profiles(id),
  notes TEXT,
  changed_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_payments_request_id ON payments(request_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_stripe_intent ON payments(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_requests_payment_status ON requests(payment_status);

-- Enable RLS (Row Level Security) on new tables
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for payments table
CREATE POLICY "Users can view their own payments"
  ON payments FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payments"
  ON payments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all payments"
  ON payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- RLS Policies for payment_history table
CREATE POLICY "Users can view their own payment history"
  ON payment_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM payments
      WHERE payments.id = payment_history.payment_id
      AND payments.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can view all payment history"
  ON payment_history FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid() AND profiles.role = 'admin'
    )
  );

-- Update requests table RLS to include payment fields
-- (Add this to your existing RLS policies)

-- Function to update payment status and create history
CREATE OR REPLACE FUNCTION update_payment_status(
  payment_id UUID,
  new_status VARCHAR,
  user_notes TEXT DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  old_status VARCHAR;
  v_request_id UUID;
BEGIN
  -- Get current status
  SELECT payment_status, request_id INTO old_status, v_request_id
  FROM payments WHERE id = payment_id;

  -- Update payment status
  UPDATE payments
  SET payment_status = new_status,
      updated_at = NOW()
  WHERE id = payment_id;

  -- Create history record
  INSERT INTO payment_history (payment_id, request_id, old_status, new_status, changed_by, notes, changed_at)
  VALUES (payment_id, v_request_id, old_status, new_status, auth.uid(), user_notes, NOW());

  -- Update request payment_status if payment completed
  IF new_status = 'completed' THEN
    UPDATE requests
    SET payment_status = 'completed',
        payment_date = NOW(),
        updated_at = NOW()
    WHERE id = v_request_id;
  ELSIF new_status = 'failed' THEN
    UPDATE requests
    SET payment_status = 'failed',
        updated_at = NOW()
    WHERE id = v_request_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get payment summary for a request
CREATE OR REPLACE FUNCTION get_request_payment_summary(p_request_id UUID)
RETURNS TABLE (
  request_id UUID,
  payment_id UUID,
  amount_php DECIMAL,
  payment_status VARCHAR,
  payment_date TIMESTAMP,
  receipt_url TEXT,
  payment_method VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.request_id,
    p.id,
    p.amount_php,
    p.payment_status,
    p.payment_date,
    p.receipt_url,
    p.payment_method
  FROM payments p
  WHERE p.request_id = p_request_id
  ORDER BY p.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql;
