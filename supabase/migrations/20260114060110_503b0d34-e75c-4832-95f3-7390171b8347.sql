-- Create quote_status enum
CREATE TYPE public.quote_status AS ENUM ('draft', 'sent', 'approved', 'declined', 'revised');

-- Create invoice_status enum
CREATE TYPE public.invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled');

-- Create invoice_type enum
CREATE TYPE public.invoice_type AS ENUM ('staged', 'final');

-- Create quotes table
CREATE TABLE public.quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  quote_number TEXT NOT NULL,
  status public.quote_status NOT NULL DEFAULT 'draft',
  subtotal NUMERIC DEFAULT 0,
  tax_rate NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  valid_until DATE,
  notes TEXT,
  terms TEXT,
  client_comment TEXT,
  approved_at TIMESTAMP WITH TIME ZONE,
  declined_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create invoices table
CREATE TABLE public.invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL,
  invoice_number TEXT NOT NULL,
  type public.invoice_type NOT NULL DEFAULT 'staged',
  status public.invoice_status NOT NULL DEFAULT 'draft',
  subtotal NUMERIC DEFAULT 0,
  tax_rate NUMERIC DEFAULT 0,
  tax_amount NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  amount_paid NUMERIC DEFAULT 0,
  due_date DATE,
  paid_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  terms TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create invoice_line_items table
CREATE TABLE public.invoice_line_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC DEFAULT 1,
  unit_price NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  scope_item_id UUID REFERENCES public.scope_items(id) ON DELETE SET NULL,
  change_request_id UUID REFERENCES public.change_requests(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add active_quote_id to projects table
ALTER TABLE public.projects ADD COLUMN active_quote_id UUID REFERENCES public.quotes(id) ON DELETE SET NULL;

-- Enable RLS on all new tables
ALTER TABLE public.quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_line_items ENABLE ROW LEVEL SECURITY;

-- Quotes RLS policies
CREATE POLICY "Anyone can view quotes"
ON public.quotes FOR SELECT
USING (true);

CREATE POLICY "Project owners can manage quotes"
ON public.quotes FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = quotes.project_id
  AND projects.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = quotes.project_id
  AND projects.user_id = auth.uid()
));

CREATE POLICY "Anyone can update quote status"
ON public.quotes FOR UPDATE
USING (true)
WITH CHECK (true);

-- Invoices RLS policies
CREATE POLICY "Anyone can view invoices"
ON public.invoices FOR SELECT
USING (true);

CREATE POLICY "Project owners can manage invoices"
ON public.invoices FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = invoices.project_id
  AND projects.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = invoices.project_id
  AND projects.user_id = auth.uid()
));

-- Invoice line items RLS policies
CREATE POLICY "Anyone can view invoice line items"
ON public.invoice_line_items FOR SELECT
USING (true);

CREATE POLICY "Project owners can manage invoice line items"
ON public.invoice_line_items FOR ALL
USING (EXISTS (
  SELECT 1 FROM public.invoices
  JOIN public.projects ON projects.id = invoices.project_id
  WHERE invoices.id = invoice_line_items.invoice_id
  AND projects.user_id = auth.uid()
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.invoices
  JOIN public.projects ON projects.id = invoices.project_id
  WHERE invoices.id = invoice_line_items.invoice_id
  AND projects.user_id = auth.uid()
));

-- Create triggers for updated_at
CREATE TRIGGER update_quotes_updated_at
BEFORE UPDATE ON public.quotes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();