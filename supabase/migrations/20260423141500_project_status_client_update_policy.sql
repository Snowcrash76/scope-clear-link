-- Allow unauthenticated clients to advance a project from "sent" to "in_progress"
-- when they approve the quote. The transition is only permitted in one direction
-- (sent → in_progress) so clients cannot arbitrarily change other statuses.
CREATE POLICY "Clients can advance project status on quote approval"
ON public.projects
FOR UPDATE
USING (status = 'sent')
WITH CHECK (status = 'in_progress');

-- Fix projects already stuck in "sent" state whose active quote is approved
UPDATE public.projects
SET status = 'in_progress'
WHERE status = 'sent'
  AND active_quote_id IN (
    SELECT id FROM public.quotes WHERE status = 'approved'
  );
