CREATE TABLE public.quote_line_item_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  line_item_id uuid NOT NULL,
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  field_changed text NOT NULL,
  old_value text,
  new_value text,
  change_reason text,
  changed_by text NOT NULL DEFAULT 'trade',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_qlih_quote_id ON public.quote_line_item_history(quote_id);
CREATE INDEX idx_qlih_line_item_id ON public.quote_line_item_history(line_item_id);

ALTER TABLE public.quote_line_item_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trade owner can manage quote line item history"
ON public.quote_line_item_history
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.quotes q
    JOIN public.projects p ON p.id = q.project_id
    WHERE q.id = quote_line_item_history.quote_id
    AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.quotes q
    JOIN public.projects p ON p.id = q.project_id
    WHERE q.id = quote_line_item_history.quote_id
    AND p.user_id = auth.uid()
  )
);

CREATE POLICY "Public can read history for shared quotes"
ON public.quote_line_item_history
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.quotes q
    WHERE q.id = quote_line_item_history.quote_id
    AND q.quote_token IS NOT NULL
  )
);
