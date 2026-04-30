-- Add is_variation boolean column to quote_line_items.
-- Replaces the fragile title-prefix heuristic ("Variation: …") with a proper flag.
ALTER TABLE quote_line_items ADD COLUMN IF NOT EXISTS is_variation boolean NOT NULL DEFAULT false;

-- Backfill: mark any existing line items whose title starts with "Variation:" or "Variation -"
UPDATE quote_line_items
SET is_variation = true
WHERE title ILIKE 'Variation:%' OR title ILIKE 'Variation -%';
