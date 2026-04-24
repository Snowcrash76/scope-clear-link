-- Remove all direct anonymous UPDATE access on the quotes table.
-- Unauthenticated client quote responses (accept / decline) must now go through
-- the respond_to_quote_by_token SECURITY DEFINER RPC, which validates the token
-- before making any writes. Authenticated project owners retain full update
-- access via the existing "Project owners can manage quotes" FOR ALL policy.

DROP POLICY IF EXISTS "Anyone can update quote status" ON public.quotes;
DROP POLICY IF EXISTS "Anyone can respond to a sent quote" ON public.quotes;
