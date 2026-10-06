-- AlterTable
ALTER TABLE "users" ADD COLUMN     "accent_color" TEXT,
ADD COLUMN     "avatar_frame" TEXT,
ADD COLUMN     "premium_until" TIMESTAMP(3),
ADD COLUMN     "profile_background" TEXT,
ADD COLUMN     "theme_bundle" TEXT;

-- CreateTable
CREATE TABLE "premium_grants" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "granted_by" TEXT NOT NULL,
    "granted_by_name" TEXT NOT NULL,
    "until" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "premium_grants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "premium_grants_user_id_idx" ON "premium_grants"("user_id");

-- AddForeignKey
ALTER TABLE "premium_grants" ADD CONSTRAINT "premium_grants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

