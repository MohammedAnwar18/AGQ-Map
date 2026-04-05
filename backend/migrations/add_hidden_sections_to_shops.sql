
-- Add hidden_sections column to shops table
ALTER TABLE shops ADD COLUMN IF NOT EXISTS hidden_sections TEXT DEFAULT '[]';
