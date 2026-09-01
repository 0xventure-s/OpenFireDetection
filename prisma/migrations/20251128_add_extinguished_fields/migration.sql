-- Add extinguished_by and extinguished_at columns to incidents table
ALTER TABLE incidents
ADD COLUMN IF NOT EXISTS extinguished_by TEXT,
ADD COLUMN IF NOT EXISTS extinguished_at TIMESTAMP(3);

-- Add index for extinguished status queries
CREATE INDEX IF NOT EXISTS incidents_status_extinguished_idx
ON incidents(status)
WHERE status = 'extinguished';
