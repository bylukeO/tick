-- DropForeignKey
ALTER TABLE "Transfer" DROP CONSTRAINT "Transfer_toUserId_fkey";

-- DropIndex
DROP INDEX "Ticket_eventId_section_row_seat_key";

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "invalidatedAt" TIMESTAMP(3),
ADD COLUMN     "replacedByTicketId" TEXT;

-- AlterTable
ALTER TABLE "Transfer" ALTER COLUMN "toEmail" DROP DEFAULT;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
