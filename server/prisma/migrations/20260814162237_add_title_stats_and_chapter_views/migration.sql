-- CreateTable
CREATE TABLE "title_stats" (
    "manga_id" TEXT NOT NULL,
    "views_count" INTEGER NOT NULL DEFAULT 0,
    "favorites_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "title_stats_pkey" PRIMARY KEY ("manga_id")
);

-- CreateTable
CREATE TABLE "chapter_views" (
    "id" TEXT NOT NULL,
    "user_id" TEXT,
    "manga_id" TEXT NOT NULL,
    "chapter_id" TEXT NOT NULL,
    "view_date" DATE NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chapter_views_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "chapter_views_manga_id_idx" ON "chapter_views"("manga_id");

-- CreateIndex
CREATE UNIQUE INDEX "chapter_views_user_id_chapter_id_view_date_key" ON "chapter_views"("user_id", "chapter_id", "view_date");

-- AddForeignKey
ALTER TABLE "chapter_views" ADD CONSTRAINT "chapter_views_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
