import { db } from "../lib/db";
import {
  createCanonicalTransferDoc,
  computeSha256,
  generateNonce,
  signWithEd25519,
  verifyEd25519Signature,
  decryptPrivateKey,
} from "../lib/crypto";
import { createSignedQrPayload } from "./ticket.service";
import { queueManager } from "../lib/redis";

export interface VerificationCheck {
  name: string;
  passed: boolean;
  details?: string;
}

export interface VerificationResult {
  valid: boolean;
  checks: VerificationCheck[];
  transfer: any;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function createTransfer(params: {
  ticketId: string;
  senderUser: any;
  senderPassword?: string;
  recipientEmail: string;
}): Promise<any> {
  const { ticketId, senderUser, recipientEmail } = params;

  const toEmail = String(recipientEmail || "").toLowerCase().trim();
  if (!EMAIL_RE.test(toEmail)) {
    throw new Error("Invalid email address");
  }

  if (toEmail === String(senderUser.email || "").toLowerCase().trim()) {
    throw new Error("Cannot transfer ticket to yourself");
  }

  const ticket = await db.ticket.findUnique({
    where: { id: ticketId },
    include: { owner: true, event: true },
  });

  if (!ticket) {
    throw new Error("Ticket not found");
  }

  if (ticket.ownerId !== senderUser.id) {
    throw new Error("Only ticket owner can initiate transfer");
  }

  if (ticket.status === "TRANSFER_PENDING") {
    throw new Error("A transfer is already pending for this ticket");
  }

  const recipient = await db.user.findUnique({ where: { email: toEmail } });

  const senderPassword = params.senderPassword || "demo1234";
  const decryptedSenderPriv = decryptPrivateKey(senderUser.encryptedPriv, senderPassword);

  const timestamp = new Date().toISOString();
  const nonce = generateNonce();
  const toIdentifier = recipient?.id || toEmail;

  const canonicalDoc = createCanonicalTransferDoc({
    ticketId: ticket.id,
    from: senderUser.id,
    to: toIdentifier,
    ts: timestamp,
    nonce,
  });

  const proofHash = computeSha256(canonicalDoc);
  const senderSig = signWithEd25519(proofHash, decryptedSenderPriv);

  const transfer = await db.transfer.create({
    data: {
      ticketId: ticket.id,
      fromUserId: senderUser.id,
      toUserId: recipient?.id ?? null,
      toEmail,
      status: "PENDING",
      proofHash,
      senderSig,
      createdAt: new Date(timestamp),
    },
    include: {
      ticket: { include: { event: true } },
      fromUser: true,
      toUser: true,
    },
  });

  await db.ticket.update({
    where: { id: ticket.id },
    data: { status: "TRANSFER_PENDING" },
  });

  const notificationPayload = {
    transferId: transfer.id,
    ticketId: ticket.id,
    fromEmail: senderUser.email,
    toEmail,
    createdAt: timestamp,
  };

  await queueManager.pushTransferNotification(notificationPayload);

  return transfer;
}

export async function acceptTransfer(params: {
  transferId: string;
  recipientUser: any;
  recipientPassword?: string;
}): Promise<any> {
  const { transferId, recipientUser } = params;

  const transfer = await db.transfer.findUnique({
    where: { id: transferId },
    include: { ticket: { include: { event: true } }, fromUser: true, toUser: true },
  });

  if (!transfer) {
    throw new Error("Transfer not found");
  }

  if (transfer.status !== "PENDING") {
    throw new Error(`Transfer cannot be accepted in status ${transfer.status}`);
  }

  const recipientEmail = String(recipientUser.email || "").toLowerCase().trim();
  const transferToEmail = String(transfer.toEmail || transfer.toUser?.email || "").toLowerCase().trim();
  const emailMatches = transferToEmail && transferToEmail === recipientEmail;
  const idMatches = transfer.toUserId && transfer.toUserId === recipientUser.id;

  if (!emailMatches && !idMatches) {
    throw new Error("Register with this email first");
  }

  // ensure toUserId set if null (recipient registered/claimed)
  if (!transfer.toUserId && emailMatches) {
    await db.transfer.update({ where: { id: transfer.id }, data: { toUserId: recipientUser.id } });
  }

  const recipientPassword = params.recipientPassword || "demo1234";
  const decryptedRecipientPriv = decryptPrivateKey(
    recipientUser.encryptedPriv,
    recipientPassword
  );

  const receiverSig = signWithEd25519(transfer.proofHash, decryptedRecipientPriv);
  const acceptedAt = new Date();

  const originalTicket = transfer.ticket;
  const rootOriginId = originalTicket.originTicket || originalTicket.id;

  const { qrPayloadJson: recipientQrPayload } = await createSignedQrPayload(
    {
      id: originalTicket.id,
      eventId: originalTicket.eventId,
      section: originalTicket.section,
      row: originalTicket.row,
      seat: originalTicket.seat,
    },
    decryptedRecipientPriv,
    recipientUser.publicKey,
    transfer.id
  );

  const recipientTicketId = `${originalTicket.id}#${transfer.id}`;

  const recipientTicket = await db.ticket.create({
    data: {
      id: recipientTicketId,
      eventId: originalTicket.eventId,
      ownerId: recipientUser.id,
      section: originalTicket.section,
      row: originalTicket.row,
      seat: originalTicket.seat,
      status: "ACTIVE",
      qrPayload: recipientQrPayload,
      originTicket: rootOriginId,
      transferCount: originalTicket.transferCount || 0,
    },
    include: { event: true, owner: true },
  });

  await db.ticket.update({
    where: { id: originalTicket.id },
    data: {
      status: "TRANSFERRED",
      invalidatedAt: new Date(),
      replacedByTicketId: recipientTicket.id,
      transferCount: (originalTicket.transferCount || 0) + 1,
    },
  });

  const updatedTransfer = await db.transfer.update({
    where: { id: transfer.id },
    data: {
      status: "ACCEPTED",
      receiverSig,
      acceptedAt,
      toUserId: recipientUser.id,
    },
    include: {
      ticket: { include: { event: true } },
      fromUser: true,
      toUser: true,
    },
  });

  return {
    transfer: updatedTransfer,
    recipientTicket,
  };
}

export async function revokeTransfer(params: {
  transferId: string;
  senderUserId: string;
}): Promise<any> {
  const { transferId, senderUserId } = params;

  const transfer = await db.transfer.findUnique({
    where: { id: transferId },
    include: { ticket: true },
  });

  if (!transfer) {
    throw new Error("Transfer not found");
  }

  if (transfer.fromUserId !== senderUserId) {
    throw new Error("Only sender can revoke this transfer");
  }

  if (transfer.status !== "PENDING") {
    throw new Error("Only PENDING transfers can be revoked");
  }

  const updatedTransfer = await db.transfer.update({
    where: { id: transfer.id },
    data: { status: "REVOKED" },
  });

  await db.ticket.update({
    where: { id: transfer.ticketId },
    data: { status: "ACTIVE" },
  });

  return updatedTransfer;
}

export async function expireOldPendingTransfers(cutoffHours = 24): Promise<number> {
  const cutoffTime = new Date(Date.now() - cutoffHours * 60 * 60 * 1000);
  const pendingTransfers = await db.transfer.findMany({
    where: {
      status: "PENDING",
      createdAt: { lt: cutoffTime },
    },
    include: { ticket: true },
  });

  let count = 0;
  for (const transfer of pendingTransfers) {
    await db.transfer.update({
      where: { id: transfer.id },
      data: { status: "EXPIRED" },
    });
    if (transfer.ticketId) {
      await db.ticket.update({
        where: { id: transfer.ticketId },
        data: { status: "ACTIVE" },
      });
    }
    count += 1;
  }

  return count;
}

export async function getTransferProofDetails(transferId: string): Promise<any> {
  const transfer = await db.transfer.findUnique({
    where: { id: transferId },
    include: {
      fromUser: true,
      toUser: true,
      ticket: { include: { event: true } },
    },
  });

  if (!transfer) {
    throw new Error("Transfer not found");
  }

  const canonicalDoc = createCanonicalTransferDoc({
    ticketId: transfer.ticketId,
    from: transfer.fromUserId,
    to: transfer.toUserId || transfer.toEmail,
    ts: new Date(transfer.createdAt).toISOString(),
    nonce: "canonical-nonce-placeholder",
  });

  return {
    transferId: transfer.id,
    ticketId: transfer.ticketId,
    canonicalDoc,
    proofHash: transfer.proofHash,
    senderSig: transfer.senderSig,
    receiverSig: transfer.receiverSig,
    senderPubkey: transfer.fromUser?.publicKey || null,
    receiverPubkey: transfer.toUser?.publicKey || null,
    status: transfer.status,
    createdAt: transfer.createdAt,
    acceptedAt: transfer.acceptedAt,
  };
}

export async function verifyTransferRecord(transferId: string): Promise<VerificationResult> {
  const transfer = await db.transfer.findUnique({
    where: { id: transferId },
    include: {
      fromUser: true,
      toUser: true,
      ticket: { include: { event: true } },
    },
  });

  if (!transfer) {
    throw new Error("Transfer not found");
  }

  const checks: VerificationCheck[] = [];

  const senderPubkey = transfer.fromUser?.publicKey;
  const receiverPubkey = transfer.toUser?.publicKey;

  const senderSigValid = senderPubkey
    ? verifyEd25519Signature(transfer.proofHash, transfer.senderSig, senderPubkey)
    : false;

  checks.push({
    name: "sender_signature",
    passed: senderSigValid,
    details: senderSigValid
      ? "Sender Ed25519 signature verified against sender public key"
      : "Sender signature verification failed",
  });

  let receiverSigValid = true;
  if (transfer.receiverSig) {
    receiverSigValid = receiverPubkey
      ? verifyEd25519Signature(transfer.proofHash, transfer.receiverSig, receiverPubkey)
      : false;

    checks.push({
      name: "receiver_signature",
      passed: receiverSigValid,
      details: receiverSigValid
        ? "Receiver Ed25519 signature verified against receiver public key"
        : "Receiver signature verification failed",
    });
  }

  const overallValid = senderSigValid && receiverSigValid;

  return {
    valid: overallValid,
    checks,
    transfer,
  };
}
