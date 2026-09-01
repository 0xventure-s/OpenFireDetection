CREATE TABLE IF NOT EXISTS "fire_stations" (
  "id" TEXT NOT NULL,
  "code" TEXT,
  "name" TEXT NOT NULL,
  "locality" TEXT,
  "address" TEXT,
  "contact" TEXT,
  "lat" DOUBLE PRECISION,
  "lon" DOUBLE PRECISION,
  "notes" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "fire_stations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "operational_units" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'engine',
  "station_id" TEXT,
  "base_name" TEXT,
  "status" TEXT NOT NULL DEFAULT 'available',
  "contact" TEXT,
  "license_plate" TEXT,
  "capacity_liters" INTEGER,
  "crew_capacity" INTEGER,
  "lat" DOUBLE PRECISION,
  "lon" DOUBLE PRECISION,
  "notes" TEXT,
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

ALTER TABLE "operational_units"
  ADD COLUMN IF NOT EXISTS "station_id" TEXT,
  ADD COLUMN IF NOT EXISTS "license_plate" TEXT,
  ADD COLUMN IF NOT EXISTS "capacity_liters" INTEGER,
  ADD COLUMN IF NOT EXISTS "crew_capacity" INTEGER,
  ADD COLUMN IF NOT EXISTS "notes" TEXT;

CREATE TABLE IF NOT EXISTS "maintenance_records" (
  "id" TEXT NOT NULL,
  "unit_id" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'scheduled',
  "due_at" TIMESTAMP(3),
  "scheduled_at" TIMESTAMP(3),
  "started_at" TIMESTAMP(3),
  "completed_at" TIMESTAMP(3),
  "odometer_km" INTEGER,
  "performed_by" TEXT,
  "notes" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "maintenance_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "operational_audit" (
  "id" TEXT NOT NULL,
  "station_id" TEXT,
  "unit_id" TEXT,
  "maintenance_id" TEXT,
  "action" TEXT NOT NULL,
  "actor" TEXT NOT NULL,
  "reason" TEXT,
  "payload" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "operational_audit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "fire_stations_code_key" ON "fire_stations"("code");
CREATE INDEX IF NOT EXISTS "fire_stations_name_idx" ON "fire_stations"("name");
CREATE INDEX IF NOT EXISTS "fire_stations_locality_idx" ON "fire_stations"("locality");

CREATE UNIQUE INDEX IF NOT EXISTS "operational_units_code_key" ON "operational_units"("code");
CREATE INDEX IF NOT EXISTS "operational_units_status_idx" ON "operational_units"("status");
CREATE INDEX IF NOT EXISTS "operational_units_type_status_idx" ON "operational_units"("type", "status");
CREATE INDEX IF NOT EXISTS "operational_units_station_id_idx" ON "operational_units"("station_id");

CREATE INDEX IF NOT EXISTS "operational_assets_type_idx" ON "operational_assets"("type");
CREATE INDEX IF NOT EXISTS "operational_assets_status_idx" ON "operational_assets"("status");

CREATE INDEX IF NOT EXISTS "incident_assignments_fire_id_status_idx" ON "incident_assignments"("fire_id", "status");
CREATE INDEX IF NOT EXISTS "incident_assignments_unit_id_status_idx" ON "incident_assignments"("unit_id", "status");
CREATE INDEX IF NOT EXISTS "incident_assignments_asset_id_idx" ON "incident_assignments"("asset_id");
CREATE INDEX IF NOT EXISTS "incident_assignments_assigned_at_idx" ON "incident_assignments"("assigned_at");

CREATE INDEX IF NOT EXISTS "maintenance_records_unit_id_status_idx" ON "maintenance_records"("unit_id", "status");
CREATE INDEX IF NOT EXISTS "maintenance_records_status_idx" ON "maintenance_records"("status");
CREATE INDEX IF NOT EXISTS "maintenance_records_due_at_idx" ON "maintenance_records"("due_at");

CREATE INDEX IF NOT EXISTS "operational_audit_station_id_idx" ON "operational_audit"("station_id");
CREATE INDEX IF NOT EXISTS "operational_audit_unit_id_idx" ON "operational_audit"("unit_id");
CREATE INDEX IF NOT EXISTS "operational_audit_maintenance_id_idx" ON "operational_audit"("maintenance_id");
CREATE INDEX IF NOT EXISTS "operational_audit_created_at_idx" ON "operational_audit"("created_at");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'operational_units_station_id_fkey') THEN
    ALTER TABLE "operational_units"
      ADD CONSTRAINT "operational_units_station_id_fkey"
      FOREIGN KEY ("station_id") REFERENCES "fire_stations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'incident_assignments_fire_id_fkey') THEN
    ALTER TABLE "incident_assignments"
      ADD CONSTRAINT "incident_assignments_fire_id_fkey"
      FOREIGN KEY ("fire_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'incident_assignments_unit_id_fkey') THEN
    ALTER TABLE "incident_assignments"
      ADD CONSTRAINT "incident_assignments_unit_id_fkey"
      FOREIGN KEY ("unit_id") REFERENCES "operational_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'incident_assignments_asset_id_fkey') THEN
    ALTER TABLE "incident_assignments"
      ADD CONSTRAINT "incident_assignments_asset_id_fkey"
      FOREIGN KEY ("asset_id") REFERENCES "operational_assets"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'maintenance_records_unit_id_fkey') THEN
    ALTER TABLE "maintenance_records"
      ADD CONSTRAINT "maintenance_records_unit_id_fkey"
      FOREIGN KEY ("unit_id") REFERENCES "operational_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'operational_audit_station_id_fkey') THEN
    ALTER TABLE "operational_audit"
      ADD CONSTRAINT "operational_audit_station_id_fkey"
      FOREIGN KEY ("station_id") REFERENCES "fire_stations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'operational_audit_unit_id_fkey') THEN
    ALTER TABLE "operational_audit"
      ADD CONSTRAINT "operational_audit_unit_id_fkey"
      FOREIGN KEY ("unit_id") REFERENCES "operational_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'operational_audit_maintenance_id_fkey') THEN
    ALTER TABLE "operational_audit"
      ADD CONSTRAINT "operational_audit_maintenance_id_fkey"
      FOREIGN KEY ("maintenance_id") REFERENCES "maintenance_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
