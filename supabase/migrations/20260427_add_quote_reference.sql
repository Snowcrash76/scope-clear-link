-- Add a separate editable reference field to quotes.
-- The existing quote_number remains the auto-generated read-only identifier.
ALTER TABLE quotes ADD COLUMN IF NOT EXISTS reference text;
