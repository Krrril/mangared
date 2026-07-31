-- AlterTable: доступ к /admin — вручную проставляется в базе
ALTER TABLE "users" ADD COLUMN "is_admin" BOOLEAN NOT NULL DEFAULT false;
