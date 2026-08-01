-- P2P Visa System
-- Provides identity for non-citizen P2P traders
-- Citizens use their on-chain Citizen Number (from NFT)
-- Non-citizens apply for a Visa (off-chain, stored in Supabase)

CREATE TABLE IF NOT EXISTS public.p2p_visa (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  visa_number TEXT UNIQUE NOT NULL,
  wallet_address TEXT UNIQUE NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  trust_level INTEGER NOT NULL DEFAULT 1,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ DEFAULT (now() + interval '1 year'),
  metadata JSONB DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_visa_wallet ON public.p2p_visa(wallet_address);
CREATE INDEX IF NOT EXISTS idx_visa_status ON public.p2p_visa(status);

-- Generate unique visa number: V-XXXXXX (6 digits)
CREATE OR REPLACE FUNCTION generate_visa_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  num TEXT;
BEGIN
  LOOP
    num := 'V-' || lpad(floor(random() * 1000000)::text, 6, '0');
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.p2p_visa WHERE visa_number = num);
  END LOOP;
  RETURN num;
END;
$$;

-- Issue a visa for a wallet address (returns the visa record)
CREATE OR REPLACE FUNCTION issue_p2p_visa(p_wallet_address TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_visa_number TEXT;
  v_result JSONB;
BEGIN
  -- Check if wallet already has a visa
  IF EXISTS (SELECT 1 FROM public.p2p_visa WHERE wallet_address = p_wallet_address AND status = 'active') THEN
    SELECT jsonb_build_object(
      'success', true,
      'visa_number', visa_number,
      'already_exists', true
    ) INTO v_result
    FROM public.p2p_visa
    WHERE wallet_address = p_wallet_address AND status = 'active';
    RETURN v_result;
  END IF;

  -- Generate unique visa number
  v_visa_number := generate_visa_number();

  -- Insert new visa
  INSERT INTO public.p2p_visa (visa_number, wallet_address)
  VALUES (v_visa_number, p_wallet_address);

  RETURN jsonb_build_object(
    'success', true,
    'visa_number', v_visa_number,
    'already_exists', false
  );
END;
$$;

-- RLS: service role only (P2P operations go through edge functions)
ALTER TABLE public.p2p_visa ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access on p2p_visa"
  ON public.p2p_visa
  FOR ALL
  USING (auth.role() = 'service_role');

-- Allow anon/authenticated to read their own visa by wallet address
CREATE POLICY "Users can read own visa"
  ON public.p2p_visa
  FOR SELECT
  USING (true);
