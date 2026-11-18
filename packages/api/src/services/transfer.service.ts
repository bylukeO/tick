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

  if (!params.senderPassword) {
    throw new Error("Account password is required to authorize this transfer");
  }
  if (!senderUser.encryptedPriv) {
    throw new Error("Sender signing key is unavailable");
  }
  const decryptedSenderPriv = decryptPrivateKey(senderUser.encryptedPriv, params.senderPassword);

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

  const transfer = await db.$transaction(async (tx) => {
    // Claim the ticket state first with a conditional update. This prevents two
    // concurrent requests from creating pending transfers for the same ticket.
    const ticketClaim = await tx.ticket.updateMany({
      where: {
        id: ticket.id,
        ownerId: senderUser.id,
        status: "ACTIVE",
      },
      data: { status: "TRANSFER_PENDING" },
    });

    if (ticketClaim.count !== 1) {
      throw new Error("Ticket is no longer available to transfer");
    }

    return tx.transfer.create({
      data: {
        ticketId: ticket.id,
        fromUserId: senderUser.id,
        toUserId: recipient?.id ?? null,
        toEmail,
        status: "PENDING",
        proofHash,
        proofDocument: canonicalDoc,
        senderSig,
        createdAt: new Date(timestamp),
      },
      include: {
        ticket: { include: { event: true } },
        fromUser: true,
        toUser: true,
      },
    });
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

  if (!params.recipientPassword) {
    throw new Error("Account password is required to accept this transfer");
  }
  if (!recipientUser.encryptedPriv || !recipientUser.publicKey) {
    throw new Error("Recipient signing key is unavailable");
  }
  const decryptedRecipientPriv = decryptPrivateKey(
    recipientUser.encryptedPriv,
    params.recipientPassword
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

  const { recipientTicket, updatedTransfer } = await db.$transaction(async (tx) => {
    const transferClaim = await tx.transfer.updateMany({
      where: { id: transfer.id, status: "PENDING" },
      data: {
        status: "ACCEPTED",
        receiverSig,
        acceptedAt,
        toUserId: recipientUser.id,
      },
    });
    if (transferClaim.count !== 1) {
      throw new Error("Transfer is no longer pending");
    }

    const ticketClaim = await tx.ticket.updateMany({
      where: {
        id: originalTicket.id,
        ownerId: transfer.fromUserId,
        status: "TRANSFER_PENDING",
      },
      data: {
        status: "TRANSFERRED",
        invalidatedAt: acceptedAt,
        replacedByTicketId: recipientTicketId,
        transferCount: (originalTicket.transferCount || 0) + 1,
      },
    });
    if (ticketClaim.count !== 1) {
      throw new Error("Original ticket is no longer transferable");
    }

    const createdTicket = await tx.ticket.create({
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

    const updated = await tx.transfer.findUnique({
      where: { id: transfer.id },
      include: {
        ticket: { include: { event: true } },
        fromUser: true,
        toUser: true,
      },
    });
    if (!updated) throw new Error("Transfer record disappeared during acceptance");

    return { recipientTicket: createdTicket, updatedTransfer: updated };
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

  return db.$transaction(async (tx) => {
    const transferClaim = await tx.transfer.updateMany({
      where: { id: transfer.id, fromUserId: senderUserId, status: "PENDING" },
      data: { status: "REVOKED" },
    });
    if (transferClaim.count !== 1) {
      throw new Error("Transfer is no longer pending");
    }

    const ticketClaim = await tx.ticket.updateMany({
      where: {
        id: transfer.ticketId,
        ownerId: senderUserId,
        status: "TRANSFER_PENDING",
      },
      data: { status: "ACTIVE" },
    });
    if (ticketClaim.count !== 1) {
      throw new Error("Ticket is no longer pending transfer");
    }

    return tx.transfer.findUnique({ where: { id: transfer.id } });
  });
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
    const expired = await db.$transaction(async (tx) => {
      const transferClaim = await tx.transfer.updateMany({
        where: { id: transfer.id, status: "PENDING", createdAt: { lt: cutoffTime } },
        data: { status: "EXPIRED" },
      });
      if (transferClaim.count !== 1) return false;

      const ticketClaim = await tx.ticket.updateMany({
        where: {
          id: transfer.ticketId,
          ownerId: transfer.fromUserId,
          status: "TRANSFER_PENDING",
        },
        data: { status: "ACTIVE" },
      });
      if (ticketClaim.count !== 1) {
        throw new Error(`Ticket state is inconsistent while expiring transfer ${transfer.id}`);
      }
      return true;
    });
    if (expired) count += 1;
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

  return {
    transferId: transfer.id,
    ticketId: transfer.ticketId,
    canonicalDoc: transfer.proofDocument,
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
  const proofDocumentValid = Boolean(
    transfer.proofDocument && computeSha256(transfer.proofDocument) === transfer.proofHash
  );

  checks.push({
    name: "proof_document_hash",
    passed: proofDocumentValid,
    details: proofDocumentValid
      ? "Persisted canonical document matches the recorded SHA-256 hash"
      : "Canonical document is missing or does not match the recorded hash",
  });

  const senderPubkey = transfer.fromUser?.publicKey;
  const receiverPubkey = transfer.toUser?.publicKey;

  const senderSigValid = proofDocumentValid && senderPubkey
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
    receiverSigValid = proofDocumentValid && receiverPubkey
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

  const overallValid = proofDocumentValid && senderSigValid && receiverSigValid;
  const safeTransfer = {
    id: transfer.id,
    ticketId: transfer.ticketId,
    fromUserId: transfer.fromUserId,
    toUserId: transfer.toUserId,
    status: transfer.status,
    proofHash: transfer.proofHash,
    senderSig: transfer.senderSig,
    receiverSig: transfer.receiverSig,
    createdAt: transfer.createdAt,
    acceptedAt: transfer.acceptedAt,
  };

  return {
    valid: overallValid,
    checks,
    transfer: safeTransfer,
  };
}
