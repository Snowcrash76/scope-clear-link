-- Allow unauthenticated clients to update change request status (approve/decline)
-- Mirrors the "Anyone can update quote status" policy on the quotes table.
CREATE POLICY "Anyone can update change request status"
ON public.change_requests
FOR UPDATE
USING (true)
WITH CHECK (true);
