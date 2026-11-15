import { db } from "./lib/db";
import { hashPassword } from "./services/auth.service";
import {
  generateEd25519KeyPair,
  encryptPrivateKey,
} from "./lib/crypto";
import { createSignedQrPayload } from "./services/ticket.service";

export interface DemoUserConfig {
  email: string;
  password: string;
}

const DEMO_USERS: DemoUserConfig[] = [
  { email: "alice@demo.test", password: "demo1234" },
  { email: "bob@demo.test", password: "demo1234" },
  { email: "charlie@demo.test", password: "demo1234" },
  { email: "dave@demo.test", password: "demo1234" },
];

function generateSeatMap() {
  const sections = ["A", "B", "C", "D"];
  const rows = ["1", "2", "3", "4", "5"];
  const seatsPerRow = 10;

  const map: Record<string, Record<string, string[]>> = {};

  for (const section of sections) {
    map[section] = {};
    for (const row of rows) {
      map[section][row] = [];
      for (let s = 1; s <= seatsPerRow; s++) {
        map[section][row].push(s.toString());
      }
    }
  }

  return map;
}

export async function seedDatabase(): Promise<void> {
  const existingUsers = await db.user.findMany();
  if (existingUsers.length >= 4) {
    return;
  }

  const createdUsers: any[] = [];
  const userKeys: Record<string, { privateKey: string; publicKey: string }> = {};

  for (const demo of DEMO_USERS) {
    const existing = await db.user.findUnique({ where: { email: demo.email } });
    if (existing) {
      createdUsers.push(existing);
      continue;
    }

    const passwordHash = await hashPassword(demo.password);
    const keyPair = generateEd25519KeyPair();
    const encryptedPriv = encryptPrivateKey(keyPair.privateKey, demo.password);

    let user;
    try {
      user = await db.user.create({
        data: {
          email: demo.email,
          passwordHash,
          publicKey: keyPair.publicKey,
          encryptedPriv,
        },
      });
    } catch (err: any) {
      if (err.code === 'P2002') {
        user = await db.user.findUniqueOrThrow({ where: { email: demo.email } });
      } else {
        throw err;
      }
    }

    createdUsers.push(user);
    userKeys[user.id] = keyPair;
  }

  const eventConfigs = [
    {
      id: "event_arena_night",
      name: "Arena Night",
      venue: "Madison Square Garden",
      startsAt: new Date(Date.now() + 10 * 86400000),
    },
    {
      id: "event_stadium_tour",
      name: "Stadium Tour",
      venue: "SoFi Stadium",
      startsAt: new Date(Date.now() + 20 * 86400000),
    },
    {
      id: "event_theater_gala",
      name: "Theater Gala",
      venue: "Broadway Theater",
      startsAt: new Date(Date.now() + 30 * 86400000),
    },
  ];

  const seatMap = generateSeatMap();
  const createdEvents: any[] = [];

  for (const cfg of eventConfigs) {
    const existing = await db.event.findUnique({ where: { id: cfg.id } });
    if (existing) {
      createdEvents.push(existing);
    } else {
      const ev = await db.event.create({
        data: {
          id: cfg.id,
          name: cfg.name,
          venue: cfg.venue,
          startsAt: cfg.startsAt,
          seatMap,
        },
      });
      createdEvents.push(ev);
    }
  }

  const preClaimTarget = 40;
  const existingTickets = await db.ticket.findMany();

  if (existingTickets.length < preClaimTarget) {
    let claimIndex = 0;
    const targetPerUser = 10;

    for (let u = 0; u < createdUsers.length; u++) {
      const user = createdUsers[u];
      const keys = userKeys[user.id] || generateEd25519KeyPair();

      for (let i = 0; i < targetPerUser; i++) {
        const event = createdEvents[claimIndex % createdEvents.length];
        const section = ["A", "B", "C", "D"][i % 4];
        const row = `${Math.floor(i / 4) + 1}`;
        const seat = `${(u * 2) + (i % 2) + 1}`;

        const ticketId = `seed_tkt_${claimIndex + 1}`;
        const { qrPayloadJson } = await createSignedQrPayload(
          {
            id: ticketId,
            eventId: event.id,
            section,
            row,
            seat,
          },
          keys.privateKey,
          user.publicKey
        );

        await db.ticket.create({
          data: {
            id: ticketId,
            eventId: event.id,
            ownerId: user.id,
            section,
            row,
            seat,
            status: "ACTIVE",
            qrPayload: qrPayloadJson,
            originTicket: null,
            transferCount: 0,
          },
        });

        claimIndex += 1;
      }
    }
  }
}
