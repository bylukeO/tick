import { FastifyInstance } from "fastify";
import { db } from "../lib/db";
import { verifySignedQrEnvelope } from "../services/ticket.service";

export async function verifyRoutes(server: FastifyInstance): Promise<void> {
  server.post("/api/verify/qr", async (request, reply) => {
    const { qrPayload } = request.body as { qrPayload?: string };

    if (!qrPayload) {
      return reply.code(400).send({ error: "qrPayload string is required" });
    }

    const verification = verifySignedQrEnvelope(qrPayload);
    if (!verification.valid || !verification.envelope) {
      return reply.send(verification);
    }

    const { payload, pubkey } = verification.envelope;
    const ticket = await db.ticket.findUnique({
      where: { id: payload.tid },
      include: { owner: true },
    });

    const ticketIsCurrent =
      Boolean(ticket) &&
      ticket!.status === "ACTIVE" &&
      ticket!.eventId === payload.eid &&
      ticket!.section === payload.sec &&
      ticket!.row === payload.row &&
      ticket!.seat === payload.seat &&
      ticket!.owner.publicKey === pubkey &&
      ticket!.qrPayload === qrPayload;

    if (!ticketIsCurrent) {
      return reply.send({
        valid: false,
        expiredForDisplay: verification.expiredForDisplay,
        error: "Ticket is not active or this QR code has been replaced",
      });
    }

    return reply.send(verification);
  });
}
