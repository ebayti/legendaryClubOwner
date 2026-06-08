// ----------------------------------------------------------------
// playwright.config.js
// ----------------------------------------------------------------
// BASE_URL controls what the test runs against:
//   - local server :  BASE_URL=http://localhost:3000  (default)
//   - live deploy  :  BASE_URL=https://your-deploy-url
// The match sim runs for 10s, so the per-test timeout is generous (30s).
// ----------------------------------------------------------------
const { defineConfig, devices } = require("@playwright/test");

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 30 * 1000,            // 30s per test — sim alone is 10s
  expect: { timeout: 15 * 1000 }, // waits long enough for the result overlay
  reporter: "list",
  use: {
    baseURL: BASE_URL,
    headless: true,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
