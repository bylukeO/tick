# Ticketmaster Clone — Simulated Inventory, Real Transfer Ledger

A full-stack web application modeling Ticketmaster's core user experience with synthetic event seat maps, cryptographically attested peer-to-peer transfers, and an immutable provenance ledger.

Transfers in this architecture model **proof of transfer intent** rather than a destructive admission token swap: the sender's original admission token remains valid in their wallet with a `SIMULATED TRANSFER — SENDER RETAINS ORIGINAL` banner, while the recipient receives a cryptographically linked ticket record (`<ticketId>#<transferId>`). Both tokens resolve to the same immutable provenance chain.

---

## 1. System Architecture & Stack

| Layer | Tool | Version | Description |
|---|---|---|---|
| Runtime | Node.js | `>=20.11.1` | JavaScript/TypeScript server & client execution |
| Package Mgr | pnpm | `>=8.15.4` | Monorepo workspace management |
| Frontend | React | `18.2.0` | UI component tree with Tailwind styling |
| Bundler | Vite | `5.1.4` | Client development & optimized bundling |
| Router | React Router DOM | `6.22.1` | Client-side routing |
| State | Zustand | `4.5.0` | Client state (`useAuth`, `useWallet`, `useTransfers`) |
| Data Fetching | TanStack React Query | `5.17.9` | Asynchronous cache and server state |
| UI Styling | Tailwind CSS | `3.4.1` | Responsive utility design system |
| Backend | Fastify | `4.26.1` | High-throughput Node.js web server |
| ORM | Prisma | `5.10.2` | Data modeling & migration engine |
| Database | PostgreSQL | `16.2` | Persistent relational store |
| Queue & Cache | Redis | `7.2.4` | Background transfer notification queue |
| Auth & Crypto | `@fastify/jwt`, `argon2`, `tweetnacl` | `argon2@0.31.2`, `tweetnacl@1.0.3` | Argon2id hashing, Ed25519 signatures, AES-256-GCM |
| Email Stub | Nodemailer + MailHog | `nodemailer@6.9.10`, `MailHog@1.0.1` | SMTP capture for transfer notifications |
| Testing | Vitest + Playwright | `vitest@1.3.1`, `@playwright/test@1.42.1` | Integration & E2E browser test suites |

---

## 2. Cryptographic Attestation Model

1. **User Key Generation & Storage**:
   - On registration or initial claim, an Ed25519 signing keypair is generated.
   - The user's public key is stored in base64.
   - The user's private key is encrypted at rest using AES-256-GCM with a key derived from the user's password via `scrypt(password, salt, 32)` using a per-user random salt.
   - The private key is only decrypted in memory during explicit signing operations.

2. **Admission QR Codes**:
   - QR payload content: `{"eid":<eventId>,"row":<row>,"sec":<section>,"seat":<seat>,"tid":<ticketId>,"ts":<isoTimestamp>}`.
   - The payload string is signed with the user's Ed25519 private key.
   - Stored envelope: `{"payload": {...}, "sig": "<base64>", "pubkey": "<base64>"}`.
   - Rendered as high-density QR PNGs using `qrcode`. Payloads older than 72 hours are flagged upon verification while wallet records remain intact.

3. **Transfer Intent & Ledger**:
   - Canonical document structure: `{"from":<senderId>,"nonce":<16ByteRandomBase64>,"ticketId":<ticketId>,"to":<recipientId>,"ts":<isoTimestamp>}` (keys sorted alphabetically).
   - `proofHash = sha256(canonicalDoc)`.
   - Sender signs `proofHash` with Ed25519 -> `senderSig`.
   - Transfer is logged with status `PENDING`.
   - Recipient accepts and signs `proofHash` with their Ed25519 private key -> `receiverSig`.
   - Recipient receives derivative ticket `<ticketId>#<transferId>`, status becomes `ACCEPTED`.
   - Original sender's ticket record retains its original `qrPayload` with incremented `transferCount`.

---

## 3. Getting Started

### 3.1 Prerequisites
- Node.js `>= 20.11.1`
- pnpm `>= 8.15.4`
- Docker & Docker Compose (for production PostgreSQL and Redis services)

### 3.2 Installation & Environment

```bash
# Clone and enter directory
cd ticketmaster-clone

# Copy environment variables
cp .env.example .env

# Install dependencies
pnpm install
```

### 3.3 Database & Seed Data

```bash
# Start background services (PostgreSQL 16.2, Redis 7.2.4, MailHog 1.0.1)
docker compose up -d

# Run Prisma migrations
pnpm prisma migrate dev

# Seed demo events, seats, and users
pnpm db:seed
```

#### Demo Accounts
All seeded accounts use password: `demo1234`
- `alice@demo.test`
- `bob@demo.test`
- `charlie@demo.test`
- `dave@demo.test`

Seeded events (200 seats each, 40 pre-claimed tickets distributed across demo users):
- **Arena Night** (Madison Square Garden)
- **Stadium Tour** (SoFi Stadium)
- **Theater Gala** (Broadway Theater)

---

## 4. Running the Application

```bash
# Start both API (:3000) and Web (:5173) in development mode
pnpm dev
```

Visit [http://localhost:5173](http://localhost:5173) in your browser.

---

## 5. Running the Test Suites

### Vitest Integration Tests
Validates cryptographic signing, tamper rejection, double-claim prevention, revoke paths, and expiry logic:
```bash
pnpm test
```

### Playwright End-to-End Tests
Executes full user journey (`register -> claim -> transfer -> accept -> verify page -> assert sender retains original`):
```bash
pnpm e2e
```

---

## 6. Frontend Routes

- `/` — Event discovery grid with venue filters and search.
- `/events/:id` — Interactive SVG seat map (Sections A-D, Rows 1-5, Seats 1-10) with real-time claim status.
- `/wallet` — Digital ticket cards, QR modal inspection, transfer triggers, and original retention banner.
- `/wallet/:id/history` — Full provenance chain timeline displaying claims, transfers, and cryptographic signatures.
- `/transfers` — Incoming/outgoing transfer inbox with accept and revoke controls.
- `/verify/:id` — Public cryptographic verification portal auditing SHA-256 canonical hash and Ed25519 signatures.
- `/login`, `/register` — Authentication interface with quick demo sign-in shortcuts.
