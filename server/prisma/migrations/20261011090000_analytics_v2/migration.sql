-- Analytics v2: only additive nullable columns, no data changes.

-- AlterTable
ALTER TABLE "visit_logs" ADD COLUMN "is_bot" BOOLEAN,
ADD COLUMN "referrer_domain" TEXT,
ADD COLUMN "utm_source" TEXT,
ADD COLUMN "utm_medium" TEXT,
ADD COLUMN "utm_campaign" TEXT;

-- AlterTable
ALTER TABLE "author_profiles" ADD COLUMN "heard_from" TEXT,
ADD COLUMN "heard_from_at" TIMESTAMP(3);
