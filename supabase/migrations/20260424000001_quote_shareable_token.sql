-- Add a shareable token to quotes so tradespeople can send clients a direct link
-- The token is unique and used for unauthenticated access to the quote page.
ALTER TABLE public.quotes
  ADD COLUMN IF NOT EXISTS quote_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE;

-- Back-fill existing quotes that were created without a token
UPDATE public.quotes
SET quote_token = gen_random_uuid()
WHERE quote_token IS NULL;
