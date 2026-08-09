-- CreateEnum
CREATE TYPE "manga_content_type" AS ENUM ('manga', 'manhwa', 'comic');

-- CreateEnum
CREATE TYPE "manga_status" AS ENUM ('draft', 'pending', 'published', 'rejected');

-- CreateTable
CREATE TABLE "author_profiles" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "bio" TEXT,
    "avatar_url" TEXT,
    "boosty_url" TEXT,
    "followers_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "author_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_mangas" (
    "id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "cover_url" TEXT,
    "genres" TEXT[],
    "content_type" "manga_content_type" NOT NULL,
    "status" "manga_status" NOT NULL DEFAULT 'draft',
    "rules_agreed_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_mangas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_manga_chapters" (
    "id" TEXT NOT NULL,
    "manga_id" TEXT NOT NULL,
    "number" DOUBLE PRECISION NOT NULL,
    "title" TEXT,
    "pages" TEXT[],
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_manga_chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "author_follows" (
    "id" TEXT NOT NULL,
    "follower_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "author_follows_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "author_profiles_user_id_key" ON "author_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "author_profiles_username_key" ON "author_profiles"("username");

-- CreateIndex
CREATE INDEX "user_mangas_status_idx" ON "user_mangas"("status");

-- CreateIndex
CREATE UNIQUE INDEX "user_manga_chapters_manga_id_number_key" ON "user_manga_chapters"("manga_id", "number");

-- CreateIndex
CREATE UNIQUE INDEX "author_follows_follower_id_author_id_key" ON "author_follows"("follower_id", "author_id");

-- AddForeignKey
ALTER TABLE "author_profiles" ADD CONSTRAINT "author_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_mangas" ADD CONSTRAINT "user_mangas_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "author_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_manga_chapters" ADD CONSTRAINT "user_manga_chapters_manga_id_fkey" FOREIGN KEY ("manga_id") REFERENCES "user_mangas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "author_follows" ADD CONSTRAINT "author_follows_follower_id_fkey" FOREIGN KEY ("follower_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "author_follows" ADD CONSTRAINT "author_follows_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "author_profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
