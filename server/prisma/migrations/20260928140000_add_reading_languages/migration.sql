-- AlterTable
ALTER TABLE "user_mangas" ADD COLUMN     "primary_language" TEXT NOT NULL DEFAULT 'ru';

-- CreateTable
CREATE TABLE "user_manga_chapter_translations" (
    "id" TEXT NOT NULL,
    "chapter_id" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "pages" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_manga_chapter_translations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_manga_chapter_translations_chapter_id_language_key" ON "user_manga_chapter_translations"("chapter_id", "language");

-- AddForeignKey
ALTER TABLE "user_manga_chapter_translations" ADD CONSTRAINT "user_manga_chapter_translations_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "user_manga_chapters"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Основной язык уже опубликованных Originals (проверено по содержимому страниц/описаний):
-- по умолчанию 'ru' (колонка выше), исключения — по id тайтла.
UPDATE "user_mangas" SET "primary_language" = 'es' WHERE "id" = 'f9705714-907f-4fc5-99d8-31ce509df7f7'; -- Tu la miras a ella
UPDATE "user_mangas" SET "primary_language" = 'en' WHERE "id" IN (
  '2eef94a9-2277-4b6a-ab7b-1cd94e298ad6', -- LATENT OF HEMA
  'b92c8643-976f-47a2-8687-d82197e00b0a'  -- Petra: Son Of The Lightning Reaper
);
