import { db } from "../packages/api/src/lib/db";
import { buildServer } from "../packages/api/src/server";
import { seedDatabase } from "../packages/api/src/seed";
import { expireOldPendingTransfers } from "../packages/api/src/services/transfer.service";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { FastifyInstance } from "fastify";

describe("Cryptographic Ticket Transfers", () => {
  let app: FastifyInstance;
  let aliceToken: string;
  let bobToken: string;
  let aliceId: string;
  let bobId: string;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
    await seedDatabase();

    const aliceRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "alice@demo.test", password: "demo1234" },
    });
    const aliceData = aliceRes.json();
    aliceToken = aliceData.accessToken;
    aliceId = aliceData.user.id;

    const bobRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "bob@demo.test", password: "demo1234" },
    });
    const bobData = bobRes.json();
    bobToken = bobData.accessToken;
    bobId = bobData.user.id;
  });

  afterAll(async () => {
    await app.close();
  });

  it("should complete full create -> sign -> accept -> verify transfer flow", async () => {
    // create recipient user first, then accept via API to exercise signature path
    const reg = await app.inject({
  method: "POST",
  url: "/api/auth/register",
  payload: { email: "recipient_verify@test.local", password: "demo1234" },
});
let recipientToken: string;
if (reg.statusCode === 201) {
  recipientToken = reg.json().accessToken;
} else {
  const login = await app.inject({
    method: "POST",
    url: "/api/auth/login",
    payload: { email: "recipient_verify@test.local", password: "demo1234" },
  });
  recipientToken = login.json().accessToken;
}

    const claimRes = await app.inject({
      method: "POST",
      url: "/api/tickets/claim",
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: {
        eventId: "event_theater_gala",
        section: "A",
        row: "1",
        seat: "1",
        password: "demo1234",
      },
    });
    const ticketId = claimRes.json().ticket.id;
    const originalSenderQr = claimRes.json().ticket.qrPayload;

    const foreignTicketDetail = await app.inject({
      method: "GET",
      url: `/api/tickets/${ticketId}`,
      headers: { authorization: `Bearer ${bobToken}` },
    });
    expect(foreignTicketDetail.statusCode).toBe(404);

    const ownerTicketDetail = await app.inject({
      method: "GET",
      url: `/api/tickets/${ticketId}`,
      headers: { authorization: `Bearer ${aliceToken}` },
    });
    expect(ownerTicketDetail.statusCode).toBe(200);
    expect(ownerTicketDetail.json().ticket.owner.passwordHash).toBeUndefined();
    expect(ownerTicketDetail.json().ticket.owner.encryptedPriv).toBeUndefined();

    const transferRes = await app.inject({
      method: "POST",
      url: "/api/transfers",
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: {
        ticketId,
        toEmail: "recipient_verify@test.local",
        password: "demo1234",
      },
    });

    expect(transferRes.statusCode).toBe(201);
    const transfer = transferRes.json().transfer;
    expect(transfer.status).toBe("PENDING");
    expect(transfer.proofHash).toBeDefined();
    expect(transfer.senderSig).toBeDefined();
    expect(transfer.toEmail).toBe("recipient_verify@test.local");
    expect(transfer.fromUser.passwordHash).toBeUndefined();
    expect(transfer.fromUser.encryptedPriv).toBeUndefined();
    expect(transfer.ticket.qrPayload).toBeUndefined();

    const inbox = await app.inject({
      method: "GET",
      url: "/api/transfers",
      headers: { authorization: `Bearer ${aliceToken}` },
    });
    expect(inbox.statusCode).toBe(200);
    expect(inbox.json().outgoing[0].fromUser.passwordHash).toBeUndefined();
    expect(inbox.json().outgoing[0].fromUser.encryptedPriv).toBeUndefined();
    expect(inbox.json().outgoing[0].ticket.qrPayload).toBeUndefined();

    const acceptRes = await app.inject({
      method: "POST",
      url: `/api/transfers/${transfer.id}/accept`,
      headers: { authorization: `Bearer ${recipientToken}` },
      payload: { password: "demo1234" },
    });

    if (acceptRes.statusCode !== 200) {
      console.error('ACCEPT FAIL', acceptRes.statusCode, acceptRes.body);
    }
    expect(acceptRes.statusCode).toBe(200);
    const acceptData = acceptRes.json();
    expect(acceptData.transfer.status).toBe("ACCEPTED");
    expect(acceptData.transfer.receiverSig).toBeDefined();
    expect(acceptData.recipientTicket.id).toBe(`${ticketId}#${transfer.id}`);

    const eventAfterTransfer = await app.inject({
      method: "GET",
      url: "/api/events/event_theater_gala",
    });
    const liveSeatRecords = eventAfterTransfer.json().claimedSeats.filter(
      (seat: any) => seat.section === "A" && seat.row === "1" && seat.seat === "1"
    );
    expect(liveSeatRecords).toHaveLength(1);
    expect(liveSeatRecords[0].ticketId).toBe(acceptData.recipientTicket.id);

    const anonymousHistory = await app.inject({
      method: "GET",
      url: `/api/tickets/${ticketId}/history`,
    });
    expect(anonymousHistory.statusCode).toBe(401);

    const senderHistory = await app.inject({
      method: "GET",
      url: `/api/tickets/${ticketId}/history`,
      headers: { authorization: `Bearer ${aliceToken}` },
    });
    expect(senderHistory.statusCode).toBe(200);
    expect(senderHistory.json().ticket.qrPayload).toBeUndefined();

    const verifyRes = await app.inject({
      method: "GET",
      url: `/api/transfers/${transfer.id}/verify`,
    });

    expect(verifyRes.statusCode).toBe(200);
    const verifyData = verifyRes.json();
    expect(verifyData.valid).toBe(true);
    const proofDocumentCheck = verifyData.checks.find((c: any) => c.name === "proof_document_hash");
    expect(proofDocumentCheck?.passed).toBe(true);

    const oldQrVerify = await app.inject({
      method: "POST",
      url: "/api/verify/qr",
      payload: { qrPayload: originalSenderQr },
    });
    expect(oldQrVerify.json().valid).toBe(false);

    const recipientQrVerify = await app.inject({
      method: "POST",
      url: "/api/verify/qr",
      payload: { qrPayload: acceptData.recipientTicket.qrPayload },
    });
    expect(recipientQrVerify.json().valid).toBe(true);

    const senderCheck = verifyData.checks.find((c: any) => c.name === "sender_signature");
    const receiverCheck = verifyData.checks.find((c: any) => c.name === "receiver_signature");
    expect(senderCheck?.passed).toBe(true);
    expect(receiverCheck?.passed).toBe(true);

    const originalTicketAfterTransfer = await db.ticket.findUnique({
      where: { id: ticketId },
    });
    expect(originalTicketAfterTransfer.qrPayload).toBe(originalSenderQr);
    expect(originalTicketAfterTransfer.status).toBe("TRANSFERRED");
    expect(originalTicketAfterTransfer.invalidatedAt).not.toBeNull();
    expect(originalTicketAfterTransfer.replacedByTicketId).toBe(
      `${ticketId}#${transfer.id}`
    );
  });

  it("should allow transfer to unregistered email and store null toUserId", async () => {
    const claimRes = await app.inject({
      method: "POST",
      url: "/api/tickets/claim",
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: {
        eventId: "event_theater_gala",
        section: "A",
        row: "1",
        seat: "10",
        password: "demo1234",
      },
    });
    const ticketId = claimRes.json().ticket.id;
    const originalSenderQr = claimRes.json().ticket.qrPayload;

    const transferRes = await app.inject({
      method: "POST",
      url: "/api/transfers",
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: {
        ticketId,
        toEmail: "stranger@example.com",
        password: "demo1234",
      },
    });

    expect(transferRes.statusCode).toBe(201);
    const transfer = transferRes.json().transfer;
    expect(transfer.toUserId).toBeNull();
    expect(transfer.toEmail).toBe("stranger@example.com");
    expect(transfer.status).toBe("PENDING");
    expect(transfer.proofDocument).not.toContain("stranger@example.com");

    const originalTicket = await db.ticket.findUnique({ where: { id: ticketId } });
    expect(originalTicket.qrPayload).toBe(originalSenderQr);
  });

  it("should prevent two concurrent transfers from claiming the same ticket", async () => {
    const claimRes = await app.inject({
      method: "POST",
      url: "/api/tickets/claim",
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: {
        eventId: "event_theater_gala",
        section: "A",
        row: "1",
        seat: "5",
        password: "demo1234",
      },
    });
    expect(claimRes.statusCode).toBe(201);
    const ticketId = claimRes.json().ticket.id;

    const makeTransfer = (toEmail: string) =>
      app.inject({
        method: "POST",
        url: "/api/transfers",
        headers: { authorization: `Bearer ${aliceToken}` },
        payload: { ticketId, toEmail, password: "demo1234" },
      });

    const results = await Promise.all([
      makeTransfer("first-recipient@example.test"),
      makeTransfer("second-recipient@example.test"),
    ]);

    expect(results.filter((result) => result.statusCode === 201)).toHaveLength(1);
    expect(results.filter((result) => result.statusCode !== 201)).toHaveLength(1);

    const pendingTransfers = await db.transfer.findMany({
      where: { ticketId, status: "PENDING" },
    });
    expect(pendingTransfers).toHaveLength(1);
  });

  it("should reject a canonical proof document with altered ticket details", async () => {
    const claimRes = await app.inject({
      method: "POST",
      url: "/api/tickets/claim",
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: {
        eventId: "event_theater_gala",
        section: "A",
        row: "1",
        seat: "6",
        password: "demo1234",
      },
    });
    expect(claimRes.statusCode).toBe(201);
    const ticketId = claimRes.json().ticket.id;

    const transferRes = await app.inject({
      method: "POST",
      url: "/api/transfers",
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: { ticketId, toEmail: "proof-check@example.test", password: "demo1234" },
    });
    expect(transferRes.statusCode).toBe(201);
    const transferId = transferRes.json().transfer.id;
    const transfer = await db.transfer.findUnique({ where: { id: transferId } });
    const alteredDocument = JSON.parse(transfer.proofDocument);
    alteredDocument.ticketId = "another-ticket";
    await db.transfer.update({
      where: { id: transferId },
      data: { proofDocument: JSON.stringify(alteredDocument) },
    });

    const verifyRes = await app.inject({
      method: "GET",
      url: `/api/transfers/${transferId}/verify`,
    });
    expect(verifyRes.json().valid).toBe(false);
    expect(verifyRes.json().checks.find((check: any) => check.name === "proof_document_hash")?.passed).toBe(false);
  });

  it("should reject transfer to sender email", async () => {
    const claimRes = await app.inject({
      method: "POST",
      url: "/api/tickets/claim",
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: {
        eventId: "event_theater_gala",
        section: "A",
        row: "1",
        seat: "9",
        password: "demo1234",
      },
    });
    const ticketId = claimRes.json().ticket.id;

    const transferRes = await app.inject({
      method: "POST",
      url: "/api/transfers",
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: {
        ticketId,
        toEmail: "alice@demo.test",
        password: "demo1234",
      },
    });

    expect(transferRes.statusCode).toBe(400);
  });

  it("should fail verification when proofHash is tampered", async () => {
    const claimRes = await app.inject({
      method: "POST",
      url: "/api/tickets/claim",
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: {
        eventId: "event_theater_gala",
        section: "A",
        row: "1",
        seat: "2",
        password: "demo1234",
      },
    });
    const ticketId = claimRes.json().ticket.id;

    const transferRes = await app.inject({
      method: "POST",
      url: "/api/transfers",
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: {
        ticketId,
        toEmail: "bob@demo.test",
        password: "demo1234",
      },
    });
    const transferId = transferRes.json().transfer.id;

    await db.transfer.update({
      where: { id: transferId },
      data: { proofHash: "0000000000000000000000000000000000000000000000000000000000000000" },
    });

    const verifyRes = await app.inject({
      method: "GET",
      url: `/api/transfers/${transferId}/verify`,
    });

    expect(verifyRes.statusCode).toBe(200);
    const verifyData = verifyRes.json();
    expect(verifyData.valid).toBe(false);
    const senderCheck = verifyData.checks.find((c: any) => c.name === "sender_signature");
    expect(senderCheck?.passed).toBe(false);
  });

  it("should handle revoke path correctly", async () => {
    const claimRes = await app.inject({
      method: "POST",
      url: "/api/tickets/claim",
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: {
        eventId: "event_theater_gala",
        section: "A",
        row: "1",
        seat: "3",
        password: "demo1234",
      },
    });
    const ticketId = claimRes.json().ticket.id;

    const transferRes = await app.inject({
      method: "POST",
      url: "/api/transfers",
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: {
        ticketId,
        toEmail: "bob@demo.test",
        password: "demo1234",
      },
    });
    const transferId = transferRes.json().transfer.id;

    const revokeRes = await app.inject({
      method: "POST",
      url: `/api/transfers/${transferId}/revoke`,
      headers: { authorization: `Bearer ${aliceToken}` },
    });

    expect(revokeRes.statusCode).toBe(200);
    expect(revokeRes.json().transfer.status).toBe("REVOKED");

    const ticketAfterRevoke = await db.ticket.findUnique({
      where: { id: ticketId },
    });
    expect(ticketAfterRevoke.status).toBe("ACTIVE");
  });

  it("should handle expiry path correctly", async () => {
    const claimRes = await app.inject({
      method: "POST",
      url: "/api/tickets/claim",
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: {
        eventId: "event_theater_gala",
        section: "A",
        row: "1",
        seat: "4",
        password: "demo1234",
      },
    });
    const ticketId = claimRes.json().ticket.id;

    const transferRes = await app.inject({
      method: "POST",
      url: "/api/transfers",
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: {
        ticketId,
        toEmail: "bob@demo.test",
        password: "demo1234",
      },
    });
    const transferId = transferRes.json().transfer.id;

    const oldDate = new Date(Date.now() - 25 * 60 * 60 * 1000);
    await db.transfer.update({
      where: { id: transferId },
      data: { createdAt: oldDate },
    });

    const expiredCount = await expireOldPendingTransfers(24);
    expect(expiredCount).toBeGreaterThanOrEqual(1);

    const expiredTransfer = await db.transfer.findUnique({
      where: { id: transferId },
    });
    expect(expiredTransfer.status).toBe("EXPIRED");

    const ticketAfterExpiry = await db.ticket.findUnique({
      where: { id: ticketId },
    });
    expect(ticketAfterExpiry.status).toBe("ACTIVE");
  });
});
