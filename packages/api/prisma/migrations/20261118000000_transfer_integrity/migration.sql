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

-- A seat may have multiple historical ticket records after transfers,
-- but only one ticket may be active or awaiting transfer at any moment.
DROP INDEX IF EXISTS "Ticket_eventId_section_row_seat_key";
CREATE UNIQUE INDEX IF NOT EXISTS "Ticket_active_seat_key"
  ON "Ticket" ("eventId", "section", "row", "seat")
  WHERE "status" IN ('ACTIVE', 'TRANSFER_PENDING');
