-- Allow anyone (including unauthenticated clients) to read trade profiles.
-- Business details like name, address, ABN, and logo are public-facing info
-- needed for client quote PDFs and project pages.
CREATE POLICY "Public can read trade profiles"
ON public.profiles
FOR SELECT
USING (true);
