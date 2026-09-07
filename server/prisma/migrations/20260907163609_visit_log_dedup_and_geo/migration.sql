-- AlterTable
ALTER TABLE "visit_logs" ADD COLUMN     "city" TEXT,
ADD COLUMN     "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "region" TEXT,
ADD COLUMN     "visit_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "visit_logs_visit_id_key" ON "visit_logs"("visit_id");
