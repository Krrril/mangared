-- CreateEnum
CREATE TYPE "cover_change_status" AS ENUM ('pending', 'approved', 'rejected');

-- CreateTable
CREATE TABLE "cover_change_requests" (
    "id" TEXT NOT NULL,
    "manga_id" TEXT NOT NULL,
    "old_cover_url" TEXT,
    "new_cover_url" TEXT NOT NULL,
    "status" "cover_change_status" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),

    CONSTRAINT "cover_change_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "cover_change_requests_manga_id_idx" ON "cover_change_requests"("manga_id");

-- CreateIndex
CREATE INDEX "cover_change_requests_status_idx" ON "cover_change_requests"("status");

-- AddForeignKey
ALTER TABLE "cover_change_requests" ADD CONSTRAINT "cover_change_requests_manga_id_fkey" FOREIGN KEY ("manga_id") REFERENCES "user_mangas"("id") ON DELETE CASCADE ON UPDATE CASCADE;
