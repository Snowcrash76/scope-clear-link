-- Add invoice fields to project_stages
ALTER TABLE project_stages ADD COLUMN invoice_amount numeric DEFAULT NULL;
ALTER TABLE project_stages ADD COLUMN invoice_percentage numeric DEFAULT NULL;

-- Add stage reference to invoices
ALTER TABLE invoices ADD COLUMN stage_id uuid REFERENCES project_stages(id) ON DELETE SET NULL;