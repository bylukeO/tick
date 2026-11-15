import { FastifyInstance } from "fastify";
import { db } from "../lib/db";
import {
  createTransfer,
  acceptTransfer,
  revokeTransfer,
  getTransferProofDetails,
  verifyTransferRecord,
} from "../services/transfer.service";
import { sendTransferEmail } from "../email/sendTransfer";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function transferRoutes(server: FastifyInstance): Promise<void> {
  server.post(
    "/api/transfers",
    {
      preHandler: [(server as any).authenticate],
      config: {
        rateLimit: {
          max: 10,
          timeWindow: "1 minute",
        },
      },
    },
    async (request, reply) => {
      const { ticketId, toEmail, password } = request.body as {
        ticketId?: string;
        toEmail?: string;
        password?: string;
      };

      if (!ticketId || !toEmail) {
        return reply.code(400).send({ error: "ticketId and toEmail are required" });
      }

      const normalizedToEmail = String(toEmail).toLowerCase().trim();
      if (!EMAIL_RE.test(normalizedToEmail)) {
        return reply.code(400).send({ error: "Invalid email address" });
      }

      const senderUser = await db.user.findUnique({ where: { id: request.user!.id } });
      if (!senderUser) {
        return reply.code(401).send({ error: "User not found" });
      }

      if (normalizedToEmail === String(senderUser.email || "").toLowerCase().trim()) {
        return reply.code(400).send({ error: "Cannot transfer ticket to yourself" });
      }

      try {
        const transfer = await createTransfer({
          ticketId,
          senderUser,
          senderPassword: password,
          recipientEmail: normalizedToEmail,
        });

        const sender = await db.user.findUnique({ where: { id: request.user!.id } });
        const ticket = await db.ticket.findUnique({ where: { id: ticketId } });
        const event = ticket ? await db.event.findUnique({ where: { id: ticket.eventId } }) : null;

        if (sender && ticket && event) {
          const senderDisplayName = (sender as any).displayName ?? sender.email.split("@")[0];
          try {
            await sendTransferEmail({
              toEmail: normalizedToEmail,
              senderDisplayName,
              eventName: event.name,
              eventDate: event.startsAt.toLocaleDateString("en-US", {
                weekday: "short",
                month: "short",
                day: "numeric",
                year: "numeric",
              }),
              venue: event.venue,
              seatList: `Section ${ticket.section}, Row ${ticket.row}, Seat ${ticket.seat}`,
              transferId: transfer.id,
            });
          } catch (emailErr) {
            request.log.error({ err: emailErr, transferId: transfer.id }, "Resend transfer email failed");
          }
        }

        return reply.code(201).send({ transfer });
      } catch (err: any) {
        const msg = err?.message || "Failed to create transfer";
        if (msg === "Register with this email first") {
          return reply.code(409).send({ error: msg });
        }
        return reply.code(400).send({ error: msg });
      }
    }
  );

  server.post(
    "/api/transfers/:id/accept",
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const { password } = (request.body as { password?: string }) || {};

      const recipientUser = await db.user.findUnique({ where: { id: request.user!.id } });
      if (!recipientUser) {
        return reply.code(401).send({ error: "User not found" });
      }

      try {
        const result = await acceptTransfer({
          transferId: id,
          recipientUser,
          recipientPassword: password,
        });

        return reply.send(result);
      } catch (err: any) {
        const msg = err?.message || "Failed to accept transfer";
        if (msg === "Register with this email first") {
          return reply.code(409).send({ error: msg });
        }
        return reply.code(400).send({ error: msg });
      }
    }
  );

  server.post(
    "/api/transfers/:id/revoke",
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const { id } = request.params as { id: string };

      try {
        const revoked = await revokeTransfer({
          transferId: id,
          senderUserId: request.user!.id,
        });

        return reply.send({ transfer: revoked });
      } catch (err: any) {
        return reply.code(400).send({ error: err.message || "Failed to revoke transfer" });
      }
    }
  );

  server.get(
    "/api/transfers",
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const userId = request.user!.id;
      const user = await db.user.findUnique({ where: { id: userId } });
      const userEmail = String(user?.email || "").toLowerCase().trim();
      const transfers = await db.transfer.findMany({
        where: {
          OR: [
            { fromUserId: userId },
            { toUserId: userId },
            ...(userEmail ? [{ toEmail: userEmail }] : []),
          ],
        },
        include: {
          ticket: { include: { event: true } },
          fromUser: true,
          toUser: true,
        },
      });

      const incoming = transfers.filter((t: any) => t.toUserId === userId || String(t.toEmail || "").toLowerCase().trim() === userEmail);
      const outgoing = transfers.filter((t: any) => t.fromUserId === userId);

      return reply.send({
        incoming,
        outgoing,
      });
    }
  );

  server.get("/api/transfers/:id/proof", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const proof = await getTransferProofDetails(id);
      return reply.send(proof);
    } catch (err: any) {
      return reply.code(404).send({ error: err.message || "Transfer proof not found" });
    }
  });

  server.get("/api/transfers/:id/verify", async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      const result = await verifyTransferRecord(id);
      return reply.send(result);
    } catch (err: any) {
      return reply.code(404).send({ error: err.message || "Transfer verification failed" });
    }
  });
}
