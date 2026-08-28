-- DropIndex
DROP INDEX "users_email_key";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "yandex_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_yandex_id_key" ON "users"("yandex_id");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");
