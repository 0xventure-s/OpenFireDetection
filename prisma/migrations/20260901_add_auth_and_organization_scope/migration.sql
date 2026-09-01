-- Community Edition uses one fixed internal organization boundary.
-- The fixed identifier keeps the installation deterministic.
CREATE TABLE "auth_users" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "email_verified" BOOLEAN NOT NULL DEFAULT false,
  "image" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "must_change_password" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "auth_users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "organizations" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "logo" TEXT,
  "metadata" TEXT,
  "status" TEXT NOT NULL DEFAULT 'active',
  "edition" TEXT NOT NULL DEFAULT 'community',
  "timezone" TEXT NOT NULL DEFAULT 'UTC',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

INSERT INTO "organizations" (
  "id",
  "name",
  "slug",
  "status",
  "edition",
  "timezone"
) VALUES (
  '00000000-0000-4000-8000-000000000001',
  'OpenFireDetection',
  'community',
  'active',
  'community',
  'UTC'
) ON CONFLICT ("id") DO NOTHING;

CREATE TABLE "auth_sessions" (
  "id" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "token" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "user_id" TEXT NOT NULL,
  "active_organization_id" TEXT,
  CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "auth_accounts" (
  "id" TEXT NOT NULL,
  "account_id" TEXT NOT NULL,
  "provider_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "access_token" TEXT,
  "refresh_token" TEXT,
  "id_token" TEXT,
  "access_token_expires_at" TIMESTAMP(3),
  "refresh_token_expires_at" TIMESTAMP(3),
  "scope" TEXT,
  "password" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "auth_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "auth_verifications" (
  "id" TEXT NOT NULL,
  "identifier" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "auth_verifications_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "organization_members" (
  "id" TEXT NOT NULL,
  "organization_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "role" TEXT NOT NULL DEFAULT 'operator',
  "status" TEXT NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "organization_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "auth_users_email_key" ON "auth_users"("email");
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");
CREATE UNIQUE INDEX "auth_sessions_token_key" ON "auth_sessions"("token");
CREATE INDEX "auth_sessions_user_id_idx" ON "auth_sessions"("user_id");
CREATE INDEX "auth_sessions_active_organization_id_idx" ON "auth_sessions"("active_organization_id");
CREATE UNIQUE INDEX "auth_accounts_provider_id_account_id_key" ON "auth_accounts"("provider_id", "account_id");
CREATE INDEX "auth_accounts_user_id_idx" ON "auth_accounts"("user_id");
CREATE INDEX "auth_verifications_identifier_idx" ON "auth_verifications"("identifier");
CREATE UNIQUE INDEX "organization_members_organization_id_user_id_key" ON "organization_members"("organization_id", "user_id");
CREATE INDEX "organization_members_organization_id_idx" ON "organization_members"("organization_id");
CREATE INDEX "organization_members_user_id_idx" ON "organization_members"("user_id");

ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "auth_accounts" ADD CONSTRAINT "auth_accounts_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "organization_members" ADD CONSTRAINT "organization_members_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "auth_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "incidents" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "fire_audit" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "fire_stations" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "operational_units" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "maintenance_records" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "operational_audit" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "scan_runs" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "operational_assets" ADD COLUMN "organization_id" TEXT;
ALTER TABLE "incident_assignments" ADD COLUMN "organization_id" TEXT;

UPDATE "incidents" SET "organization_id" = '00000000-0000-4000-8000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "fire_audit" SET "organization_id" = '00000000-0000-4000-8000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "fire_stations" SET "organization_id" = '00000000-0000-4000-8000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "operational_units" SET "organization_id" = '00000000-0000-4000-8000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "maintenance_records" SET "organization_id" = '00000000-0000-4000-8000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "operational_audit" SET "organization_id" = '00000000-0000-4000-8000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "scan_runs" SET "organization_id" = '00000000-0000-4000-8000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "operational_assets" SET "organization_id" = '00000000-0000-4000-8000-000000000001' WHERE "organization_id" IS NULL;
UPDATE "incident_assignments" SET "organization_id" = '00000000-0000-4000-8000-000000000001' WHERE "organization_id" IS NULL;

ALTER TABLE "incidents" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "fire_audit" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "fire_stations" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "operational_units" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "maintenance_records" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "operational_audit" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "scan_runs" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "operational_assets" ALTER COLUMN "organization_id" SET NOT NULL;
ALTER TABLE "incident_assignments" ALTER COLUMN "organization_id" SET NOT NULL;

DROP INDEX IF EXISTS "fire_stations_code_key";
DROP INDEX IF EXISTS "operational_units_code_key";

CREATE UNIQUE INDEX "incidents_organization_id_id_key" ON "incidents"("organization_id", "id");
CREATE UNIQUE INDEX "fire_stations_organization_id_id_key" ON "fire_stations"("organization_id", "id");
CREATE UNIQUE INDEX "fire_stations_organization_id_code_key" ON "fire_stations"("organization_id", "code");
CREATE UNIQUE INDEX "operational_units_organization_id_id_key" ON "operational_units"("organization_id", "id");
CREATE UNIQUE INDEX "operational_units_organization_id_code_key" ON "operational_units"("organization_id", "code");
CREATE UNIQUE INDEX "maintenance_records_organization_id_id_key" ON "maintenance_records"("organization_id", "id");
CREATE UNIQUE INDEX "operational_assets_organization_id_id_key" ON "operational_assets"("organization_id", "id");

CREATE INDEX "incidents_organization_id_status_detected_at_idx" ON "incidents"("organization_id", "status", "detected_at");
CREATE INDEX "incidents_organization_id_lifecycle_status_detected_at_idx" ON "incidents"("organization_id", "lifecycle_status", "detected_at");
CREATE INDEX "fire_audit_organization_id_created_at_idx" ON "fire_audit"("organization_id", "created_at");
CREATE INDEX "fire_stations_organization_id_name_idx" ON "fire_stations"("organization_id", "name");
CREATE INDEX "operational_units_organization_id_status_idx" ON "operational_units"("organization_id", "status");
CREATE INDEX "maintenance_records_organization_id_status_idx" ON "maintenance_records"("organization_id", "status");
CREATE INDEX "operational_audit_organization_id_created_at_idx" ON "operational_audit"("organization_id", "created_at");
CREATE INDEX "scan_runs_organization_id_started_at_idx" ON "scan_runs"("organization_id", "started_at");
CREATE INDEX "operational_assets_organization_id_type_idx" ON "operational_assets"("organization_id", "type");
CREATE INDEX "incident_assignments_organization_id_fire_id_status_idx" ON "incident_assignments"("organization_id", "fire_id", "status");

ALTER TABLE "fire_audit" DROP CONSTRAINT IF EXISTS "fire_audit_fire_id_fkey";
ALTER TABLE "operational_units" DROP CONSTRAINT IF EXISTS "operational_units_station_id_fkey";
ALTER TABLE "incident_assignments" DROP CONSTRAINT IF EXISTS "incident_assignments_fire_id_fkey";
ALTER TABLE "incident_assignments" DROP CONSTRAINT IF EXISTS "incident_assignments_unit_id_fkey";
ALTER TABLE "incident_assignments" DROP CONSTRAINT IF EXISTS "incident_assignments_asset_id_fkey";
ALTER TABLE "maintenance_records" DROP CONSTRAINT IF EXISTS "maintenance_records_unit_id_fkey";
ALTER TABLE "operational_audit" DROP CONSTRAINT IF EXISTS "operational_audit_station_id_fkey";
ALTER TABLE "operational_audit" DROP CONSTRAINT IF EXISTS "operational_audit_unit_id_fkey";
ALTER TABLE "operational_audit" DROP CONSTRAINT IF EXISTS "operational_audit_asset_id_fkey";
ALTER TABLE "operational_audit" DROP CONSTRAINT IF EXISTS "operational_audit_maintenance_id_fkey";

ALTER TABLE "incidents" ADD CONSTRAINT "incidents_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fire_audit" ADD CONSTRAINT "fire_audit_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "fire_audit" ADD CONSTRAINT "fire_audit_organization_id_fire_id_fkey"
  FOREIGN KEY ("organization_id", "fire_id") REFERENCES "incidents"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fire_stations" ADD CONSTRAINT "fire_stations_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "operational_units" ADD CONSTRAINT "operational_units_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "operational_units" ADD CONSTRAINT "operational_units_organization_id_station_id_fkey"
  FOREIGN KEY ("organization_id", "station_id") REFERENCES "fire_stations"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "maintenance_records" ADD CONSTRAINT "maintenance_records_organization_id_unit_id_fkey"
  FOREIGN KEY ("organization_id", "unit_id") REFERENCES "operational_units"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "operational_audit" ADD CONSTRAINT "operational_audit_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "operational_audit" ADD CONSTRAINT "operational_audit_organization_id_station_id_fkey"
  FOREIGN KEY ("organization_id", "station_id") REFERENCES "fire_stations"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "operational_audit" ADD CONSTRAINT "operational_audit_organization_id_unit_id_fkey"
  FOREIGN KEY ("organization_id", "unit_id") REFERENCES "operational_units"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "operational_audit" ADD CONSTRAINT "operational_audit_organization_id_asset_id_fkey"
  FOREIGN KEY ("organization_id", "asset_id") REFERENCES "operational_assets"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "operational_audit" ADD CONSTRAINT "operational_audit_organization_id_maintenance_id_fkey"
  FOREIGN KEY ("organization_id", "maintenance_id") REFERENCES "maintenance_records"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "scan_runs" ADD CONSTRAINT "scan_runs_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "operational_assets" ADD CONSTRAINT "operational_assets_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "incident_assignments" ADD CONSTRAINT "incident_assignments_organization_id_fkey"
  FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "incident_assignments" ADD CONSTRAINT "incident_assignments_organization_id_fire_id_fkey"
  FOREIGN KEY ("organization_id", "fire_id") REFERENCES "incidents"("organization_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "incident_assignments" ADD CONSTRAINT "incident_assignments_organization_id_unit_id_fkey"
  FOREIGN KEY ("organization_id", "unit_id") REFERENCES "operational_units"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "incident_assignments" ADD CONSTRAINT "incident_assignments_organization_id_asset_id_fkey"
  FOREIGN KEY ("organization_id", "asset_id") REFERENCES "operational_assets"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
