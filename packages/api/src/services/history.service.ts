import { db } from "../lib/db";

export interface ProvenanceTimelineItem {
  id: string;
  type: "CLAIM" | "TRANSFER";
  status: string;
  timestamp: string;
  actor: {
    id: string;
    email: string;
    publicKey?: string | null;
  };
  recipient?: {
    id: string;
    email: string;
    publicKey?: string | null;
  };
  details: {
    ticketId: string;
    proofHash?: string;
    senderSig?: string;
    receiverSig?: string | null;
  };
}

export async function getTicketProvenanceHistory(ticketId: string): Promise<{
  ticket: any;
  rootOriginId: string;
  timeline: ProvenanceTimelineItem[];
  allHolders: any[];
}> {
  const currentTicket = await db.ticket.findUnique({
    where: { id: ticketId },
    include: {
      event: true,
      owner: { select: { id: true, email: true, publicKey: true } },
      transfers: { select: { id: true } },
    },
  });

  if (!currentTicket) {
    throw new Error("Ticket not found");
  }

  const rootOriginId = currentTicket.originTicket || currentTicket.id;
  const rootTicket = await db.ticket.findUnique({
    where: { id: rootOriginId },
    include: {
      event: true,
      owner: { select: { id: true, email: true, publicKey: true } },
    },
  });

  const relatedTickets = await db.ticket.findMany({
    where: {
      OR: [{ id: rootOriginId }, { originTicket: rootOriginId }],
    },
    include: {
      owner: { select: { id: true, email: true, publicKey: true } },
      event: true,
    },
  });

  const relatedTicketIds = new Set(relatedTickets.map((t: any) => t.id));
  relatedTicketIds.add(rootOriginId);

  const relatedTransfers = await db.transfer.findMany({
    where: { ticketId: { in: Array.from(relatedTicketIds) } },
    include: {
      fromUser: { select: { id: true, email: true, publicKey: true } },
      toUser: { select: { id: true, email: true, publicKey: true } },
      ticket: { select: { id: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const timeline: ProvenanceTimelineItem[] = [];

  const originHolder = rootTicket?.owner || currentTicket.owner;
  timeline.push({
    id: `claim_${rootOriginId}`,
    type: "CLAIM",
    status: "CONFIRMED",
    timestamp: new Date(rootTicket?.createdAt || currentTicket.createdAt).toISOString(),
    actor: {
      id: originHolder.id,
      email: originHolder.email,
      publicKey: originHolder.publicKey,
    },
    details: {
      ticketId: rootOriginId,
    },
  });

  for (const transfer of relatedTransfers) {
    timeline.push({
      id: transfer.id,
      type: "TRANSFER",
      status: transfer.status,
      timestamp: new Date(transfer.createdAt).toISOString(),
      actor: {
        id: transfer.fromUser.id,
        email: transfer.fromUser.email,
        publicKey: transfer.fromUser.publicKey,
      },
      ...(transfer.toUser
        ? {
            recipient: {
              id: transfer.toUser.id,
              email: transfer.toUser.email,
              publicKey: transfer.toUser.publicKey,
            },
          }
        : {}),
      details: {
        ticketId: transfer.ticketId,
        proofHash: transfer.proofHash,
        senderSig: transfer.senderSig,
        receiverSig: transfer.receiverSig,
      },
    });
  }

  const allHolders = relatedTickets.map((t: any) => ({
    ticketId: t.id,
    ownerId: t.ownerId,
    ownerEmail: t.owner?.email,
    ownerPublicKey: t.owner?.publicKey,
    status: t.status,
    transferCount: t.transferCount,
  }));

  // Provenance views must never expose a live QR payload. The ticket's
  // current holder can retrieve that credential through the authenticated wallet.
  const safeTicket = {
    id: currentTicket.id,
    eventId: currentTicket.eventId,
    ownerId: currentTicket.ownerId,
    section: currentTicket.section,
    row: currentTicket.row,
    seat: currentTicket.seat,
    status: currentTicket.status,
    originTicket: currentTicket.originTicket,
    transferCount: currentTicket.transferCount,
    invalidatedAt: currentTicket.invalidatedAt,
    replacedByTicketId: currentTicket.replacedByTicketId,
    createdAt: currentTicket.createdAt,
    event: currentTicket.event,
  };

  return {
    ticket: safeTicket,
    rootOriginId,
    timeline,
    allHolders,
  };
}
