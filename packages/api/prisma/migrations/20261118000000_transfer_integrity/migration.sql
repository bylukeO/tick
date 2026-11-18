-- Align the original SQL schema with the current Prisma model and persist
-- the exact canonical document that was hashed and signed for each transfer.
ALTER TABLE "Transfer"
  ADD COLUMN IF NOT EXISTS "toEmail" TEXT,
  ADD COLUMN IF NOT EXISTS "proofDocument" TEXT;

UPDATE "Transfer" AS transfer
SET "toEmail" = recipient."email"
FROM "User" AS recipient
WHERE transfer."toUserId" = recipient."id"
  AND transfer."toEmail" IS NULL;

ALTER TABLE "Transfer"
  ALTER COLUMN "toUserId" DROP NOT NULL,
  ALTER COLUMN "toEmail" SET NOT NULL;

ALTER TABLE "Ticket"
  ADD COLUMN IF NOT EXISTS "invalidatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "replacedByTicketId" TEXT;

-- Preserve the seat-level uniqueness guarantee already present in the initial
-- migration; Prisma now declares the same compound unique constraint.
