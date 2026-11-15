import { seedDatabase } from "../src/seed";

async function run() {
  await seedDatabase();
  console.log("Database seeded successfully");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
