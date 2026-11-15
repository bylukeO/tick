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
    include: { event: true, owner: true, transfers: true },
  });

  if (!currentTicket) {
    throw new Error("Ticket not found");
  }

  const rootOriginId = currentTicket.originTicket || currentTicket.id;
  const rootTicket = await db.ticket.findUnique({
    where: { id: rootOriginId },
    include: { event: true, owner: true },
  });

  const allTickets = await db.ticket.findMany({
    include: { owner: true, event: true },
  });

  const relatedTickets = allTickets.filter(
    (t: any) => t.id === rootOriginId || t.originTicket === rootOriginId
  );

  const relatedTicketIds = new Set(relatedTickets.map((t: any) => t.id));
  relatedTicketIds.add(rootOriginId);

  const allTransfers = await db.transfer.findMany({
    include: { fromUser: true, toUser: true, ticket: true },
  });

  const relatedTransfers = allTransfers
    .filter((tr: any) => relatedTicketIds.has(tr.ticketId))
    .sort((a: any, b: any) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

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
      recipient: {
        id: transfer.toUser.id,
        email: transfer.toUser.email,
        publicKey: transfer.toUser.publicKey,
      },
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

  return {
    ticket: currentTicket,
    rootOriginId,
    timeline,
    allHolders,
  };
}
