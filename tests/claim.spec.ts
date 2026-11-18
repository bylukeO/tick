import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import { buildServer } from "../packages/api/src/server";
import { seedDatabase } from "../packages/api/src/seed";
import { verifySignedQrEnvelope } from "../packages/api/src/services/ticket.service";
import { FastifyInstance } from "fastify";

describe("Ticket Claiming & QR Cryptography", () => {
  let app: FastifyInstance;
  let aliceToken: string;
  let bobToken: string;

  beforeAll(async () => {
    app = await buildServer();
    await app.ready();
    await seedDatabase();

    const aliceRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "alice@demo.test", password: "demo1234" },
    });
    aliceToken = aliceRes.json().accessToken;

    const bobRes = await app.inject({
      method: "POST",
      url: "/api/auth/login",
      payload: { email: "bob@demo.test", password: "demo1234" },
    });
    bobToken = bobRes.json().accessToken;
  });

  afterAll(async () => {
    await app.close();
  });

  it("should claim an unclaimed seat and return a valid signed QR payload and image", async () => {
    const claimRes = await app.inject({
      method: "POST",
      url: "/api/tickets/claim",
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: {
        eventId: "event_arena_night",
        section: "D",
        row: "5",
        seat: "10",
        password: "demo1234",
      },
    });

    expect(claimRes.statusCode).toBe(201);
    const body = claimRes.json();
    expect(body.ticket).toBeDefined();
    expect(body.ticket.section).toBe("D");
    expect(body.ticket.row).toBe("5");
    expect(body.ticket.seat).toBe("10");
    expect(body.qrPng).toMatch(/^data:image\/png;base64,/);

    const envelopeVerification = verifySignedQrEnvelope(body.ticket.qrPayload);
    expect(envelopeVerification.valid).toBe(true);
    expect(envelopeVerification.expiredForDisplay).toBe(false);
    expect(envelopeVerification.envelope?.payload.sec).toBe("D");
    expect(envelopeVerification.envelope?.payload.row).toBe("5");
    expect(envelopeVerification.envelope?.payload.seat).toBe("10");
  });

  it("should require the correct account password to sign a ticket", async () => {
    const missingPassword = await app.inject({
      method: "POST",
      url: "/api/tickets/claim",
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: {
        eventId: "event_arena_night",
        section: "D",
        row: "5",
        seat: "8",
      },
    });
    expect(missingPassword.statusCode).toBe(400);

    const wrongPassword = await app.inject({
      method: "POST",
      url: "/api/tickets/claim",
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: {
        eventId: "event_arena_night",
        section: "D",
        row: "5",
        seat: "8",
        password: "not-the-account-password",
      },
    });
    expect(wrongPassword.statusCode).toBe(401);
  });

  it("should return 409 conflict when claiming an already-claimed seat", async () => {
    const duplicateClaim = await app.inject({
      method: "POST",
      url: "/api/tickets/claim",
      headers: { authorization: `Bearer ${bobToken}` },
      payload: {
        eventId: "event_arena_night",
        section: "D",
        row: "5",
        seat: "10",
        password: "demo1234",
      },
    });

    expect(duplicateClaim.statusCode).toBe(409);
    expect(duplicateClaim.json().error).toMatch(/already claimed/i);
  });

  it("should verify QR code round-trip via verify endpoint", async () => {
    const claimRes = await app.inject({
      method: "POST",
      url: "/api/tickets/claim",
      headers: { authorization: `Bearer ${aliceToken}` },
      payload: {
        eventId: "event_stadium_tour",
        section: "C",
        row: "4",
        seat: "9",
        password: "demo1234",
      },
    });

    const qrPayload = claimRes.json().ticket.qrPayload;

    const verifyRes = await app.inject({
      method: "POST",
      url: "/api/verify/qr",
      payload: { qrPayload },
    });

    expect(verifyRes.statusCode).toBe(200);
    const verifyBody = verifyRes.json();
    expect(verifyBody.valid).toBe(true);
    expect(verifyBody.expiredForDisplay).toBe(false);
  });
});
