-- AlterTable: пароль стал опциональным (есть вход только через Google)
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;

-- AlterTable: имя пользователя (таблица на Render пустая — NOT NULL без DEFAULT безопасен)
ALTER TABLE "users" ADD COLUMN "name" TEXT NOT NULL;

-- AlterTable: id аккаунта Google для входа через Google
ALTER TABLE "users" ADD COLUMN "google_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "users_google_id_key" ON "users"("google_id");
