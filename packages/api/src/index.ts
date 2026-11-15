import { buildServer } from "./server";
import { startExpiryCron } from "./cron/expire.cron";
import { seedDatabase } from "./seed";

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

async function main() {
  const server = await buildServer();
  await seedDatabase();
  startExpiryCron();

  try {
    await server.listen({ port: PORT, host: HOST });
    console.log(`API server listening on http://${HOST}:${PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

if (process.env.NODE_ENV !== "test") {
  main();
}
