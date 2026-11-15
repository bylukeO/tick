import { FastifyInstance } from "fastify";
import { db } from "../lib/db";

export async function eventRoutes(server: FastifyInstance): Promise<void> {
  server.get("/api/events", async (_request, reply) => {
    const events = await db.event.findMany();
    const tickets = await db.ticket.findMany();

    const formattedEvents = events.map((ev: any) => {
      const eventTickets = tickets.filter((t: any) => t.eventId === ev.id);
      return {
        ...ev,
        totalClaimed: eventTickets.length,
      };
    });

    return reply.send({ events: formattedEvents });
  });

  server.get("/api/events/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const event = await db.event.findUnique({
      where: { id },
      include: { tickets: true },
    });

    if (!event) {
      return reply.code(404).send({ error: "Event not found" });
    }

    const claimedSeats = (event.tickets || []).map((t: any) => ({
      ticketId: t.id,
      section: t.section,
      row: t.row,
      seat: t.seat,
      status: t.status,
      ownerId: t.ownerId,
    }));

    return reply.send({
      event,
      claimedSeats,
    });
  });
}
