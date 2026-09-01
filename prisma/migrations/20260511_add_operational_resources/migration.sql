CREATE TABLE IF NOT EXISTS "operational_units" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'brigade',
  "base_name" TEXT,
  "status" TEXT NOT NULL DEFAULT 'available',
  "contact" TEXT,
  "lat" DOUBLE PRECISION,
  "lon" DOUBLE PRECISION,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "operational_units_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "operational_assets" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'unknown',
  "lat" DOUBLE PRECISION,
  "lon" DOUBLE PRECISION,
  "notes" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "operational_assets_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "incident_assignments" (
  "id" TEXT NOT NULL,
  "fire_id" TEXT NOT NULL,
  "unit_id" TEXT,
  "asset_id" TEXT,
  "unit_name" TEXT,
  "role" TEXT NOT NULL DEFAULT 'primary',
  "status" TEXT NOT NULL DEFAULT 'assigned',
  "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "assigned_by" TEXT NOT NULL,
  "released_at" TIMESTAMP(3),
  "notes" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "incident_assignments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "operational_units_code_key" ON "operational_units"("code");
CREATE INDEX IF NOT EXISTS "operational_units_status_idx" ON "operational_units"("status");
CREATE INDEX IF NOT EXISTS "operational_assets_type_idx" ON "operational_assets"("type");
CREATE INDEX IF NOT EXISTS "operational_assets_status_idx" ON "operational_assets"("status");
CREATE INDEX IF NOT EXISTS "incident_assignments_fire_id_status_idx" ON "incident_assignments"("fire_id", "status");
CREATE INDEX IF NOT EXISTS "incident_assignments_unit_id_status_idx" ON "incident_assignments"("unit_id", "status");
CREATE INDEX IF NOT EXISTS "incident_assignments_asset_id_idx" ON "incident_assignments"("asset_id");
CREATE INDEX IF NOT EXISTS "incident_assignments_assigned_at_idx" ON "incident_assignments"("assigned_at");

ALTER TABLE "incident_assignments"
  ADD CONSTRAINT "incident_assignments_fire_id_fkey"
  FOREIGN KEY ("fire_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "incident_assignments"
  ADD CONSTRAINT "incident_assignments_unit_id_fkey"
  FOREIGN KEY ("unit_id") REFERENCES "operational_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "incident_assignments"
  ADD CONSTRAINT "incident_assignments_asset_id_fkey"
  FOREIGN KEY ("asset_id") REFERENCES "operational_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
