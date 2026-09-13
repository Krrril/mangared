-- CreateEnum
CREATE TYPE "reaction_type" AS ENUM ('like', 'dislike');

-- AlterTable
ALTER TABLE "notifications" ADD COLUMN     "chapter_id" TEXT;

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "manga_id" TEXT NOT NULL,
    "chapter_id" TEXT,
    "text" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comment_reports" (
    "id" TEXT NOT NULL,
    "comment_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolved_at" TIMESTAMP(3),

    CONSTRAINT "comment_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reactions" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "manga_id" TEXT NOT NULL,
    "chapter_id" TEXT NOT NULL DEFAULT '',
    "type" "reaction_type" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "comments_manga_id_chapter_id_created_at_idx" ON "comments"("manga_id", "chapter_id", "created_at");

-- CreateIndex
CREATE INDEX "comment_reports_resolved_at_idx" ON "comment_reports"("resolved_at");

-- CreateIndex
CREATE UNIQUE INDEX "comment_reports_comment_id_user_id_key" ON "comment_reports"("comment_id", "user_id");

-- CreateIndex
CREATE INDEX "reactions_manga_id_chapter_id_idx" ON "reactions"("manga_id", "chapter_id");

-- CreateIndex
CREATE UNIQUE INDEX "reactions_user_id_manga_id_chapter_id_key" ON "reactions"("user_id", "manga_id", "chapter_id");

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_reports" ADD CONSTRAINT "comment_reports_comment_id_fkey" FOREIGN KEY ("comment_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comment_reports" ADD CONSTRAINT "comment_reports_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reactions" ADD CONSTRAINT "reactions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
