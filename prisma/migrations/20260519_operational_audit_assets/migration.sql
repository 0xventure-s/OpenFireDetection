ALTER TABLE "operational_audit"
  ADD COLUMN IF NOT EXISTS "asset_id" TEXT;

CREATE INDEX IF NOT EXISTS "operational_audit_asset_id_idx" ON "operational_audit"("asset_id");
CREATE INDEX IF NOT EXISTS "operational_audit_created_at_idx" ON "operational_audit"("created_at");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'operational_audit_asset_id_fkey') THEN
    ALTER TABLE "operational_audit"
      ADD CONSTRAINT "operational_audit_asset_id_fkey"
      FOREIGN KEY ("asset_id") REFERENCES "operational_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
