-- Nickname/name settings: only additive changes (new nullable columns + two new tables).

-- AlterTable
ALTER TABLE "users" ADD COLUMN "username_changed_at" TIMESTAMP(3),
ADD COLUMN "name_changed_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "username_history" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "old_username" TEXT NOT NULL,
    "new_username" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "username_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "identity_change_log" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "old_value" TEXT,
    "new_value" TEXT NOT NULL,
    "actor_type" TEXT NOT NULL,
    "actor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "identity_change_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "username_history_old_username_idx" ON "username_history"("old_username");

-- CreateIndex
CREATE INDEX "username_history_user_id_idx" ON "username_history"("user_id");

-- CreateIndex
CREATE INDEX "identity_change_log_user_id_created_at_idx" ON "identity_change_log"("user_id", "created_at");

-- AddForeignKey
ALTER TABLE "username_history" ADD CONSTRAINT "username_history_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "identity_change_log" ADD CONSTRAINT "identity_change_log_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
