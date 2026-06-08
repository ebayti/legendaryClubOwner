// ----------------------------------------------------------------
// tests/sim.spec.js
// ----------------------------------------------------------------
// Verifies the interactive element end-to-end: the lineup builder +
// 10-second match sim.
//
// It drives the ONE deterministic path on purpose. 4-2-3-1 has a goal
// chance of 1.00 in script.js (FORMATION_GOAL_CHANCE), so it always
// scores and the "Well Done" overlay is guaranteed. Asserting on a
// probabilistic formation (e.g. 5-4-1 at 15%) would make the test flaky.
//
// Run:
//   1. start a server     ->  npm run serve   (or: npx serve . -l 3000)
//   2. point + run         ->  BASE_URL=http://localhost:3000 npx playwright test
//   or against the deploy  ->  BASE_URL=https://your-url npx playwright test
// ----------------------------------------------------------------
const { test, expect } = require("@playwright/test");

test("lineup builder: 4-2-3-1 scores and shows Well Done -> store CTA", async ({ page }) => {
  // -- Step 1: the page loads with its hook on screen --
  await page.goto("/");
  await expect(page).toHaveTitle(/Legendary Club Owner/i);
  await expect(page.locator(".headline")).toBeVisible();

  // -- Step 2: the CTA jumps Alex down to the interactive demo --
  await page.locator("#cta").click();
  const builder = page.locator("#builder");
  await expect(builder).toBeVisible();

  // all four formation options load (the choices Alex steps through)
  await expect(page.locator(".formation-card")).toHaveCount(4);

  // kickoff is locked until a formation is chosen
  const kickoff = page.locator("#kickoff-btn");
  await expect(kickoff).toBeDisabled();

  // -- Step 3: pick the optimal counter (the always-scores path) --
  const pick = page.locator('.formation-card[data-formation="4-2-3-1"]');
  await pick.click();
  await expect(pick).toHaveAttribute("aria-checked", "true");

  // selecting a formation unlocks kickoff and updates its label
  await expect(kickoff).toBeEnabled();
  await expect(kickoff).toHaveText(/Kick off vs 4-4-2/i);

  // -- Step 4: kick off -> the arena (scoreboard + pitch) appears --
  await kickoff.click();
  const arena = page.locator("#arena");
  await expect(arena).toBeVisible();
  await expect(page.locator("#pitch")).toBeVisible();

  // the result overlay must STAY hidden while the match plays — otherwise it
  // covers the pitch and the sim is invisible (regression guard).
  const overlay = page.locator("#result-overlay");
  await expect(overlay).toBeHidden();
  await page.waitForTimeout(2000);            // 2s into the 10s sim
  await expect(overlay).toBeHidden();         // still playing, still no overlay

  // -- Step 5: the sim runs ~10s, then the result overlay resolves --
  // expect.timeout is 15s in playwright.config.js, which covers the 10s match.
  await expect(overlay).toBeVisible();

  // 4-2-3-1 must score: the player who found the correct counter never sees "Try Again"
  await expect(page.locator("#result-title")).toHaveText(/Well Done/i);
  await expect(page.locator("#score")).toHaveText(/1\s*[–-]\s*0/);

  // the win routes toward the store
  await expect(page.locator("#result-action")).toHaveText(/Get the game/i);
});
