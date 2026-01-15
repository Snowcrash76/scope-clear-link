-- Create quote_line_items table for custom quote items
CREATE TABLE public.quote_line_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id uuid NOT NULL REFERENCES public.quotes(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  cost numeric NOT NULL DEFAULT 0,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.quote_line_items ENABLE ROW LEVEL SECURITY;

-- Anyone can view quote line items (for client view)
CREATE POLICY "Anyone can view quote line items" 
ON public.quote_line_items 
FOR SELECT 
USING (true);

-- Project owners can manage quote line items
CREATE POLICY "Project owners can manage quote line items" 
ON public.quote_line_items 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.quotes q
    JOIN public.projects p ON p.id = q.project_id
    WHERE q.id = quote_line_items.quote_id AND p.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.quotes q
    JOIN public.projects p ON p.id = q.project_id
    WHERE q.id = quote_line_items.quote_id AND p.user_id = auth.uid()
  )
);

-- Add trigger for updated_at
CREATE TRIGGER update_quote_line_items_updated_at
BEFORE UPDATE ON public.quote_line_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();