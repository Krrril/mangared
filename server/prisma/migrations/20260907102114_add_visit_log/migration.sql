-- CreateTable
CREATE TABLE "visit_logs" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "device" TEXT NOT NULL,
    "country" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "visit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "visit_logs_created_at_idx" ON "visit_logs"("created_at");
