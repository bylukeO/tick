const { defineConfig, devices } = require("@playwright/test");
const path = require("node:path");

const rootDir = path.resolve(__dirname);

module.exports = defineConfig({
  testDir: "./e2e",
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
      command: "./packages/api/node_modules/.bin/tsx packages/api/src/index.ts",
      cwd: rootDir,
      port: 3000,
      timeout: 60000,
      reuseExistingServer: !process.env.CI,
      env: {
        PORT: "3000",
        NODE_ENV: "development",
      },
    },
    {
      command: "./packages/web/node_modules/.bin/vite packages/web --port 5173 --host 127.0.0.1",
      cwd: rootDir,
      port: 5173,
      timeout: 60000,
      reuseExistingServer: !process.env.CI,
    },
  ],
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: {
          args: ["--no-sandbox", "--disable-setuid-sandbox"],
        },
      },
    },
  ],
});
