-- CreateEnum
CREATE TYPE "manga_age_rating" AS ENUM ('six_plus', 'twelve_plus', 'sixteen_plus', 'eighteen_plus', 'unrated');

-- AlterTable
ALTER TABLE "user_mangas" ADD COLUMN     "age_rating" "manga_age_rating" NOT NULL DEFAULT 'unrated';

-- Разовый маппинг свободных жанров на курируемый список (см.
-- server/src/constants/genres.ts) для 3 тайтлов, опубликованных до
-- введения этого поля — вручную сопоставлено с автором/по решению из
-- сессии (см. историю: "Постапокалипсис"/"Монстры" -> Sci-Fi по выбору
-- пользователя; demographic-теги вроде "Сэйнен"/"shonen"/"Гг женщина"
-- отброшены как не жанры). age_rating для них сознательно остаётся
-- 'unrated' (дефолт выше) — временная пометка "не указан" до того, как
-- авторы/админ проставят его вручную.
UPDATE "user_mangas" SET "genres" = ARRAY['Fantasy','Horror','Adventure','Action','Mystery','Drama','Comedy'] WHERE "id" = '65a7c098-f8db-4f8f-9b88-dd68635f10f6';
UPDATE "user_mangas" SET "genres" = ARRAY['Sci-Fi','Drama','Thriller'] WHERE "id" = '32a1ee51-407e-4f19-8822-ec284b4875b0';
UPDATE "user_mangas" SET "genres" = ARRAY['Psychological','Horror','Action','Mystery','Comedy'] WHERE "id" = '26cca8c5-f876-4acc-8e0c-2de6b3d6d33e';
