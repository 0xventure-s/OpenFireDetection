-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis" WITH VERSION "3.4.0";

-- CreateTable
CREATE TABLE "incidents" (
    "id" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "geom" TEXT NOT NULL,
    "detected_at" TIMESTAMP(3) NOT NULL,
    "confirmed" BOOLEAN NOT NULL DEFAULT false,
    "confirmed_by" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'unconfirmed',
    "sources" JSONB NOT NULL DEFAULT '[]',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "manual" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "incidents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fire_audit" (
    "id" TEXT NOT NULL,
    "fire_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "actor" TEXT NOT NULL,
    "reason" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fire_audit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "incidents_status_detected_at_idx" ON "incidents"("status", "detected_at");

-- CreateIndex
CREATE INDEX "incidents_detected_at_idx" ON "incidents"("detected_at");

-- CreateIndex
CREATE INDEX "incidents_confirmed_idx" ON "incidents"("confirmed");

-- CreateIndex
CREATE INDEX "fire_audit_fire_id_idx" ON "fire_audit"("fire_id");

-- CreateIndex
CREATE INDEX "fire_audit_created_at_idx" ON "fire_audit"("created_at");

-- AddForeignKey
ALTER TABLE "fire_audit" ADD CONSTRAINT "fire_audit_fire_id_fkey" FOREIGN KEY ("fire_id") REFERENCES "incidents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
