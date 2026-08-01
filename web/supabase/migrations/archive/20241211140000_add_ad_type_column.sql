-- Add ad_type column to p2p_fiat_offers
-- This distinguishes between buy and sell offers

ALTER TABLE public.p2p_fiat_offers
ADD COLUMN IF NOT EXISTS ad_type TEXT NOT NULL DEFAULT 'sell'
CHECK (ad_type IN ('buy', 'sell'));

-- Add index for filtering by ad_type
CREATE INDEX IF NOT EXISTS idx_p2p_offers_ad_type ON public.p2p_fiat_offers(ad_type);

-- Update existing offers to be 'sell' type (default)
UPDATE public.p2p_fiat_offers SET ad_type = 'sell' WHERE ad_type IS NULL;

COMMENT ON COLUMN public.p2p_fiat_offers.ad_type IS 'Type of offer: buy (user wants to buy crypto) or sell (user wants to sell crypto)';
