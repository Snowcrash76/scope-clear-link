ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS default_quote_terms text,
  ADD COLUMN IF NOT EXISTS default_invoice_terms text;
