ALTER TABLE "incidents"
ADD COLUMN IF NOT EXISTS "lifecycle_status" TEXT NOT NULL DEFAULT 'active',
ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "reviewed_by" TEXT,
ADD COLUMN IF NOT EXISTS "dispatched_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "dispatched_by" TEXT,
ADD COLUMN IF NOT EXISTS "closed_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "data_freshness" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS "weather_snapshot" JSONB,
ADD COLUMN IF NOT EXISTS "terrain_snapshot" JSONB,
ADD COLUMN IF NOT EXISTS "projection_snapshot" JSONB;

UPDATE "incidents"
SET "lifecycle_status" = CASE
  WHEN "payload"->>'test' = 'true' THEN 'test'
  WHEN "status" IN ('extinguished', 'false_positive') THEN 'closed'
  ELSE 'active'
END
WHERE "lifecycle_status" = 'active';

UPDATE "incidents"
SET "closed_at" = COALESCE("extinguished_at", "updated_at")
WHERE "lifecycle_status" = 'closed' AND "closed_at" IS NULL;

CREATE INDEX IF NOT EXISTS "incidents_lifecycle_status_detected_at_idx"
ON "incidents"("lifecycle_status", "detected_at");
