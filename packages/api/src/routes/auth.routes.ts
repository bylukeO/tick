import { FastifyInstance } from "fastify";
import { db } from "../lib/db";
import { hashPassword, verifyPassword } from "../services/auth.service";
import { generateEd25519KeyPair, encryptPrivateKey } from "../lib/crypto";
import { generateCsrfToken } from "../plugins/auth.plugin";

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export async function authRoutes(server: FastifyInstance): Promise<void> {
  server.post("/api/auth/register", async (request, reply) => {
    const { email, password } = request.body as { email?: string; password?: string };

    if (!email || !password || password.length < 6) {
      return reply.code(400).send({ error: "Valid email and password (minimum 6 chars) required" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await db.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      return reply.code(409).send({ error: "Email is already registered" });
    }

    const passwordHash = await hashPassword(password);
    const keyPair = generateEd25519KeyPair();
    const encryptedPriv = encryptPrivateKey(keyPair.privateKey, password);

    const user = await db.user.create({
      data: {
        email: normalizedEmail,
        passwordHash,
        publicKey: keyPair.publicKey,
        encryptedPriv,
      },
    });

    const accessToken = server.jwt.sign(
      { id: user.id, email: user.email },
      { expiresIn: ACCESS_TOKEN_TTL_SECONDS }
    );
    const refreshToken = server.jwt.sign(
      { id: user.id, email: user.email, type: "refresh" },
      { expiresIn: REFRESH_TOKEN_TTL_SECONDS }
    );
    const csrfToken = generateCsrfToken();

    reply
      .setCookie("access_token", accessToken, {
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        maxAge: ACCESS_TOKEN_TTL_SECONDS,
      })
      .setCookie("refresh_token", refreshToken, {
        httpOnly: true,
        path: "/api/auth/refresh",
        sameSite: "lax",
        maxAge: REFRESH_TOKEN_TTL_SECONDS,
      })
      .setCookie("csrf_token", csrfToken, {
        httpOnly: false,
        path: "/",
        sameSite: "lax",
      });

    return reply.code(201).send({
      user: { id: user.id, email: user.email, publicKey: user.publicKey },
      accessToken,
      csrfToken,
    });
  });

  server.post("/api/auth/login", async (request, reply) => {
    const { email, password } = request.body as { email?: string; password?: string };

    if (!email || !password) {
      return reply.code(400).send({ error: "Email and password are required" });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const user = await db.user.findUnique({ where: { email: normalizedEmail } });

    if (!user) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }

    const matches = await verifyPassword(user.passwordHash, password);
    if (!matches) {
      return reply.code(401).send({ error: "Invalid credentials" });
    }

    if (!user.publicKey || !user.encryptedPriv) {
      const keyPair = generateEd25519KeyPair();
      const encryptedPriv = encryptPrivateKey(keyPair.privateKey, password);
      await db.user.update({
        where: { id: user.id },
        data: { publicKey: keyPair.publicKey, encryptedPriv },
      });
      user.publicKey = keyPair.publicKey;
      user.encryptedPriv = encryptedPriv;
    }

    const accessToken = server.jwt.sign(
      { id: user.id, email: user.email },
      { expiresIn: ACCESS_TOKEN_TTL_SECONDS }
    );
    const refreshToken = server.jwt.sign(
      { id: user.id, email: user.email, type: "refresh" },
      { expiresIn: REFRESH_TOKEN_TTL_SECONDS }
    );
    const csrfToken = generateCsrfToken();

    reply
      .setCookie("access_token", accessToken, {
        httpOnly: true,
        path: "/",
        sameSite: "lax",
        maxAge: ACCESS_TOKEN_TTL_SECONDS,
      })
      .setCookie("refresh_token", refreshToken, {
        httpOnly: true,
        path: "/api/auth/refresh",
        sameSite: "lax",
        maxAge: REFRESH_TOKEN_TTL_SECONDS,
      })
      .setCookie("csrf_token", csrfToken, {
        httpOnly: false,
        path: "/",
        sameSite: "lax",
      });

    return reply.send({
      user: { id: user.id, email: user.email, publicKey: user.publicKey },
      accessToken,
      csrfToken,
    });
  });

  server.post("/api/auth/refresh", async (request, reply) => {
    const refreshToken = request.cookies.refresh_token;

    if (!refreshToken) {
      return reply.code(401).send({ error: "Refresh token missing" });
    }

    try {
      const decoded = server.jwt.verify<{ id: string; email: string; type?: string }>(
        refreshToken
      );

      const user = await db.user.findUnique({ where: { id: decoded.id } });
      if (!user) {
        return reply.code(401).send({ error: "User not found" });
      }

      const newAccessToken = server.jwt.sign(
        { id: user.id, email: user.email },
        { expiresIn: ACCESS_TOKEN_TTL_SECONDS }
      );
      const newRefreshToken = server.jwt.sign(
        { id: user.id, email: user.email, type: "refresh" },
        { expiresIn: REFRESH_TOKEN_TTL_SECONDS }
      );
      const csrfToken = generateCsrfToken();

      reply
        .setCookie("access_token", newAccessToken, {
          httpOnly: true,
          path: "/",
          sameSite: "lax",
          maxAge: ACCESS_TOKEN_TTL_SECONDS,
        })
        .setCookie("refresh_token", newRefreshToken, {
          httpOnly: true,
          path: "/api/auth/refresh",
          sameSite: "lax",
          maxAge: REFRESH_TOKEN_TTL_SECONDS,
        })
        .setCookie("csrf_token", csrfToken, {
          httpOnly: false,
          path: "/",
          sameSite: "lax",
        });

      return reply.send({
        accessToken: newAccessToken,
        csrfToken,
      });
    } catch {
      return reply.code(401).send({ error: "Invalid refresh token" });
    }
  });

  server.post("/api/auth/logout", async (_request, reply) => {
    reply
      .clearCookie("access_token", { path: "/" })
      .clearCookie("refresh_token", { path: "/api/auth/refresh" })
      .clearCookie("csrf_token", { path: "/" });

    return reply.send({ success: true });
  });

  server.get(
    "/api/auth/me",
    { preHandler: [(server as any).authenticate] },
    async (request, reply) => {
      const user = await db.user.findUnique({ where: { id: request.user!.id } });
      if (!user) {
        return reply.code(404).send({ error: "User not found" });
      }

      return reply.send({
        user: { id: user.id, email: user.email, publicKey: user.publicKey },
      });
    }
  );
}
