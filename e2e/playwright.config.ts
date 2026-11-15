import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "..");

export default defineConfig({
  testDir: "./",
  timeout: 60000,
  expect: {
    timeout: 15000,
  },
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: [
    {
      command: "npx tsx packages/api/src/index.ts",
      cwd: rootDir,
      port: 3000,
      reuseExistingServer: true,
      env: {
        PORT: "3000",
        NODE_ENV: "development",
      },
    },
    {
      command: "npx vite packages/web --port 5173 --host 127.0.0.1",
      cwd: rootDir,
      port: 5173,
      reuseExistingServer: true,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
