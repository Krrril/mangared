-- Telegram auto-posting journal: one new table, nothing existing is touched.

-- CreateTable
CREATE TABLE "telegram_posts" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "ref_id" TEXT NOT NULL,
    "message_id" INTEGER,
    "message_ids" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
    "status" TEXT NOT NULL,
    "error" TEXT,
    "label" TEXT,
    "batch_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telegram_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "telegram_posts_kind_ref_id_key" ON "telegram_posts"("kind", "ref_id");

-- CreateIndex
CREATE INDEX "telegram_posts_status_idx" ON "telegram_posts"("status");

-- CreateIndex
CREATE INDEX "telegram_posts_batch_id_idx" ON "telegram_posts"("batch_id");

-- CreateIndex
CREATE INDEX "telegram_posts_created_at_idx" ON "telegram_posts"("created_at");
