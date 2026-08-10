// Scripted phone-viewport walkthrough of StratFolio, recorded deterministically.
//
// The market simulator is seeded, so this produces the same run every time and can be
// re-recorded after any UI change. Output is a webm; encode-demo.mjs turns it into the
// mp4 + gif that the README uses.
//
//   node scripts/record-demo.mjs            (expects `npm run dev` on :5173)
//   node scripts/record-demo.mjs --url ...  (record against a deployed build)

import { chromium } from 'playwright';
import { mkdirSync, rmSync, readdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';

const args = process.argv.slice(2);
const urlArg = args.indexOf('--url');
const BASE = urlArg !== -1 ? args[urlArg + 1] : 'http://localhost:5173';
const OUT = 'docs/demo';
const RAW = join(OUT, 'raw');

const VIEWPORT = { width: 390, height: 844 };

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// easeInOutCubic, shared by both axes — linear scrolling reads as "machine", not "hand".
const EASE = `(p) => (p < 0.5 ? 4*p*p*p : 1 - Math.pow(-2*p + 2, 3) / 2)`;

/** Smoothly scroll the page vertically. */
function glideY(page, to, ms = 900) {
  return page.evaluate(
    ([top, duration, easeSrc]) => {
      const ease = eval(easeSrc);
      const el = document.scrollingElement;
      const start = el.scrollTop;
      const delta = top - start;
      const t0 = performance.now();
      return new Promise((done) => {
        function step(now) {
          const p = Math.min(1, (now - t0) / duration);
          el.scrollTop = start + delta * ease(p);
          p < 1 ? requestAnimationFrame(step) : done();
        }
        requestAnimationFrame(step);
      });
    },
    [to, ms, EASE],
  );
}

/** Smoothly scroll a horizontal carousel by N card-widths. */
function glideX(page, ariaLabel, to, ms = 900) {
  return page.evaluate(
    ([label, left, duration, easeSrc]) => {
      const ease = eval(easeSrc);
      const el = document.querySelector(`[aria-label="${label}"]`);
      if (!el) throw new Error(`no carousel: ${label}`);
      const start = el.scrollLeft;
      const delta = left - start;
      const t0 = performance.now();
      return new Promise((done) => {
        function step(now) {
          const p = Math.min(1, (now - t0) / duration);
          el.scrollLeft = start + delta * ease(p);
          p < 1 ? requestAnimationFrame(step) : done();
        }
        requestAnimationFrame(step);
      });
    },
    [ariaLabel, to, ms, EASE],
  );
}

/** Never let one missing selector kill a 15-second take. */
async function attempt(label, fn) {
  try {
    await fn();
    console.log(`  ✓ ${label}`);
  } catch (err) {
    console.warn(`  ! beat "${label}" degraded: ${err.message.split('\n')[0]}`);
  }
}

rmSync(RAW, { recursive: true, force: true });
mkdirSync(RAW, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: VIEWPORT,
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  colorScheme: 'dark',
  recordVideo: { dir: RAW, size: VIEWPORT },
});

const page = await context.newPage();
console.log(`recording ${BASE} at ${VIEWPORT.width}x${VIEWPORT.height}`);

await page.goto(`${BASE}/app/portfolio`, { waitUntil: 'networkidle' });
await page.locator('[aria-label="Positions carousel"]').waitFor({ timeout: 20000 });
// Let the seeded simulator tick so sparklines and the ticker strip aren't static on frame 1.
await wait(2200);

// ─── Beat 1 (0-3.5s) · the landing: live value, ticker strip, first position ──
await attempt('landing hold', async () => {
  await wait(1300);
});

// ─── Beat 2 (3.5-7s) · swipe the positions carousel ──────────────────────────
await attempt('positions carousel', async () => {
  await glideX(page, 'Positions carousel', 366, 950);
  await wait(1200);
  await glideX(page, 'Positions carousel', 732, 900);
  await wait(1100);
});

// ─── Beat 3 (7-13s) · the differentiator: ask it a real question ─────────────
await attempt('assistant', async () => {
  await page.getByRole('button', { name: /Open StratFolio AI Insights/i }).first().click();
  await wait(1100);

  const input = page.getByLabel('Ask the StratFolio assistant').locator('visible=true').first();
  await input.click();
  // Typed at human cadence — instant text looks like a screenshot, not a demo.
  await input.type('When should I sell my PLTRs?', { delay: 52 });
  await wait(350);
  await input.press('Enter');
  await wait(4600); // thinking indicator → answer renders, then hold so it's readable
});

// ─── Beat 4 (13-15.5s) · dismiss back to the app, so the loop restarts clean ──
// The assistant panel is an overlay: anything scrolled while it is open happens behind
// it and never makes the cut. Minimise first, then move.
await attempt('return to app', async () => {
  // Submitting a question hands off from the outlook panel to the floating chat, so this
  // is "Minimize assistant chat", not the panel's own minimise control.
  await page.getByRole('button', { name: /Minimize assistant chat/i }).first().click();
  await wait(700);
  await glideY(page, 620, 800);
  await wait(900);
});

await context.close();
await browser.close();

const file = readdirSync(RAW).find((f) => f.endsWith('.webm'));
if (!file) {
  console.error('no video produced');
  process.exit(1);
}
const dest = join(OUT, 'walkthrough.webm');
renameSync(join(RAW, file), dest);
rmSync(RAW, { recursive: true, force: true });
console.log(`wrote ${dest}`);
