-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'premium';

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "dedupe_key" TEXT,
ADD COLUMN     "message" TEXT,
ADD COLUMN     "premium_kind" TEXT,
ADD COLUMN     "until" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "premium_grants" ADD COLUMN     "message" TEXT;

-- CreateTable
CREATE TABLE "premium_broadcasts" (
    "id" TEXT NOT NULL,
    "message_hash" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "recipients" INTEGER NOT NULL,
    "admin_id" TEXT NOT NULL,
    "admin_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "premium_broadcasts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "premium_broadcasts_message_hash_day_key" ON "premium_broadcasts"("message_hash", "day");

-- CreateIndex
CREATE INDEX "notifications_user_id_dedupe_key_idx" ON "notifications"("user_id", "dedupe_key");

