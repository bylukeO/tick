import { FastifyInstance } from "fastify";
import { verifySignedQrEnvelope } from "../services/ticket.service";

export async function verifyRoutes(server: FastifyInstance): Promise<void> {
  server.post("/api/verify/qr", async (request, reply) => {
    const { qrPayload } = request.body as { qrPayload?: string };

    if (!qrPayload) {
      return reply.code(400).send({ error: "qrPayload string is required" });
    }

    const verification = verifySignedQrEnvelope(qrPayload);
    return reply.send(verification);
  });
}
