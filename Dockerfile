FROM node:20-bookworm-slim

# Install OpenSSL and build tools for native modules
RUN apt-get update && apt-get install -y openssl python3 make g++ && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY tsconfig*.json ./

COPY packages/api/package.json ./packages/api/package.json
COPY packages/web/package.json ./packages/web/package.json

RUN corepack enable && PNPM_CONFIG_STRICT_DEP_BUILDS=false pnpm install --frozen-lockfile

# Force argon2 to compile from source for the correct libc (glibc)
RUN pnpm rebuild argon2 --build-from-source

COPY packages/api ./packages/api

WORKDIR /app/packages/api
RUN pnpm prisma generate


ENV PORT=7860
EXPOSE 7860

CMD ["sh", "-c", "pnpm prisma migrate deploy && npx tsx src/index.ts"]
