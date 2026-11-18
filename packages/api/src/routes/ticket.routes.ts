import { FastifyInstance } from "fastify";
import QRCode from "qrcode";
import { db } from "../lib/db";
import {
  generateEd25519KeyPair,
  encryptPrivateKey,
  decryptPrivateKey,
} from "../lib/crypto";
import { createSignedQrPayload } from "../services/ticket.service";
import { getTicketProvenanceHistory } from "../services/history.service";

export async function ticketRoutes(server: FastifyInstance): Promise<void> {
  server.post(
    "/api/tickets/claim",
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const { eventId, section, row, seat, password } = request.body as {
        eventId?: string;
        section?: string;
        row?: string;
        seat?: string;
        password?: string;
      };

      if (!eventId || !section || !row || !seat) {
        return reply.code(400).send({ error: "eventId, section, row, and seat are required" });
      }
      if (!password) {
        return reply.code(400).send({ error: "Account password is required to sign the ticket" });
      }

      const event = await db.event.findUnique({ where: { id: eventId } });
      if (!event) {
        return reply.code(404).send({ error: "Event not found" });
      }

      const seatMap = event.seatMap as Record<string, Record<string, string[]>>;
      if (!seatMap?.[section]?.[row]?.includes(seat)) {
        return reply.code(400).send({ error: "The selected seat does not exist for this event" });
      }

      const existingTicket = await db.ticket.findFirst({
        where: { eventId, section, row, seat },
      });

      if (existingTicket) {
        return reply.code(409).send({ error: "Seat is already claimed" });
      }

      const user = await db.user.findUnique({ where: { id: request.user!.id } });
      if (!user) {
        return reply.code(401).send({ error: "User not found" });
      }

      const signingPassword = password;
      let privateKeyBase64: string;

      if (!user.publicKey || !user.encryptedPriv) {
        const keyPair = generateEd25519KeyPair();
        const encryptedPriv = encryptPrivateKey(keyPair.privateKey, signingPassword);
        await db.user.update({
          where: { id: user.id },
          data: { publicKey: keyPair.publicKey, encryptedPriv },
        });
        user.publicKey = keyPair.publicKey;
        user.encryptedPriv = encryptedPriv;
        privateKeyBase64 = keyPair.privateKey;
      } else {
        privateKeyBase64 = decryptPrivateKey(user.encryptedPriv, signingPassword);
      }

      const preliminaryId = `tkt_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      const { qrPayloadJson, qrPngDataUrl } = await createSignedQrPayload(
        {
          id: preliminaryId,
          eventId,
          section,
          row,
          seat,
        },
        privateKeyBase64,
        user.publicKey
      );

      try {
        const ticket = await db.ticket.create({
          data: {
            id: preliminaryId,
            eventId,
            ownerId: user.id,
            section,
            row,
            seat,
            status: "ACTIVE",
            qrPayload: qrPayloadJson,
            originTicket: null,
            transferCount: 0,
          },
          include: { event: true },
        });

        return reply.code(201).send({
          ticket,
          qrPng: qrPngDataUrl,
        });
      } catch (error: any) {
        // The compound unique index is the final guard against concurrent claims.
        if (error?.code === "P2002") {
          return reply.code(409).send({ error: "Seat is already claimed" });
        }
        throw error;
      }
    }
  );

  server.get(
    "/api/tickets",
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const tickets = await db.ticket.findMany({
        where: { ownerId: request.user!.id },
        include: { event: true, transfers: true },
      });

      const ticketsWithQr = await Promise.all(
        tickets.map(async (t: any) => {
          let qrPng: string | null = null;
          try {
            qrPng = await QRCode.toDataURL(t.qrPayload, {
              errorCorrectionLevel: "M",
              margin: 2,
              width: 280,
            });
          } catch {
            qrPng = null;
          }

          return {
            ...t,
            qrPng,
            isOriginalRetained: (t.transferCount || 0) > 0,
          };
        })
      );

      return reply.send({ tickets: ticketsWithQr });
    }
  );

  server.get(
    "/api/tickets/:id",
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const ticket = await db.ticket.findUnique({
        where: { id },
        include: { event: true, owner: true, transfers: true },
      });

      if (!ticket) {
        return reply.code(404).send({ error: "Ticket not found" });
      }

      const qrPng = await QRCode.toDataURL(ticket.qrPayload, {
        errorCorrectionLevel: "M",
        margin: 2,
        width: 280,
      });

      return reply.send({
        ticket: {
          ...ticket,
          qrPng,
          isOriginalRetained: (ticket.transferCount || 0) > 0,
        },
      });
    }
  );

  server.get(
    "/api/tickets/:id/history",
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      try {
        const history = await getTicketProvenanceHistory(id);
        const userId = request.user!.id;
        const isRelatedHolder = history.allHolders.some((holder: any) => holder.ownerId === userId);
        const isRelatedTransferParty = history.timeline.some(
          (item: any) => item.actor?.id === userId || item.recipient?.id === userId
        );

        if (!isRelatedHolder && !isRelatedTransferParty) {
          return reply.code(403).send({ error: "You are not authorized to view this ticket history" });
        }

        return reply.send(history);
      } catch {
        return reply.code(404).send({ error: "Ticket history not found" });
      }
    }
  );
}
