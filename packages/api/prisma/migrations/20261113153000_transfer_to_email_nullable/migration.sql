-- AlterTable
ALTER TABLE "Transfer" ADD COLUMN "toEmail" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Transfer" ALTER COLUMN "toUserId" DROP NOT NULL;
-- best-effort backfill if needed (no existing rows guaranteed in fresh env)
UPDATE "Transfer" SET "toEmail" = COALESCE("toEmail", '');
