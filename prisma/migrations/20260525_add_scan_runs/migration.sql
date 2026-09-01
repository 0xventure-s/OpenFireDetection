-- CreateTable
CREATE TABLE IF NOT EXISTS "scan_runs" (
    "id" TEXT NOT NULL,
    "trigger_type" TEXT NOT NULL,
    "triggered_by" TEXT,
    "status" TEXT NOT NULL DEFAULT 'running',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "new_count" INTEGER NOT NULL DEFAULT 0,
    "updated_count" INTEGER NOT NULL DEFAULT 0,
    "confirmed_count" INTEGER NOT NULL DEFAULT 0,
    "closed_count" INTEGER NOT NULL DEFAULT 0,
    "summary" TEXT,
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scan_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "scan_runs_started_at_idx" ON "scan_runs"("started_at");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "scan_runs_status_started_at_idx" ON "scan_runs"("status", "started_at");
