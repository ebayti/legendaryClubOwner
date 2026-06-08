# Legendary Club Owner — Landing Page

English landing page for the international launch of **Legendary Club Owner** (*Efsane Başkan*).
Built for one persona: Alex, 24, London, casual mobile football gamer, 5 seconds of attention.

**The idea:** capture the first fixation with a falling ball, then guide the gaze down a clean hierarchy toward the interactive element.

---

## Files

```
/index.html             single page
/style.css              all styling (strict dark "cyber" palette)
/script.js              CONFIG + ball animation + sim logic + store routing
/assets/                football.png (the ball), video.mp4 (hero), pitch.svg
/tests/sim.spec.js      Playwright test (bonus) — runs vs local OR the live URL
/playwright.config.js   reads BASE_URL, 15s expect timeout for the 10s sim
/package.json           scripts + devDependencies
/README.md              this file
```

All configurable values (timings, probabilities, formation names, colours) live in the `CONFIG` and `FORMATION_GOAL_CHANCE` blocks at the top of `script.js`. Nothing is hardcoded below them.

---

## The interactive element

A mini lineup builder plus a short match sim. Supposed to be a small replica of the game's core loop (set formation → simulate → result):

1. The opponent is fixed in a **4-4-2**.
2. Alex picks one of four formations.
3. A simulation plays
4. **Goal → "Well Done"** — "Get the game" detects the device (iOS → App Store,
   Android → Play Store, desktop → web fallback). **Miss → "Try Again"** (skill
   feedback, returns to the picker).

---

## Store links

The "Get the game" button is device-aware (`storeUrl()` in `script.js`, links in
`CONFIG.storeLinks`): iOS → App Store, Android → Play Store, desktop → web fallback. No auto-redirect the user taps the button.

