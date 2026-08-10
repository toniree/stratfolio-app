// Builds docs/demo/social-preview.png (1280x640) — the image GitHub renders when the repo
// link is pasted into Slack, LinkedIn, or a recruiter's inbox. Set it under
// Settings → General → Social preview. Without one you get a grey Octocat card.
//
// Screenshots are captured live from the running app rather than kept as stale fixtures,
// and the logo is lifted from the real DOM so the card can never drift from the product.
//
//   node scripts/social-card.mjs   (expects `npm run dev` on :5173)

import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const OUT = 'docs/demo/social-preview.png';

mkdirSync('docs/demo', { recursive: true });

const browser = await chromium.launch();

/** Capture one viewport of the app as a base64 png. */
async function shoot(viewport, opts = {}) {
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor: 2,
    colorScheme: 'dark',
    ...opts,
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/app/portfolio`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(3000); // let the simulator populate sparklines
  const buf = await page.screenshot();
  const logo = await page.evaluate(() => {
    const svg = document.querySelector('[aria-label="StratFolio"] svg, svg');
    return svg ? svg.outerHTML : '';
  });
  await ctx.close();
  return { data: `data:image/png;base64,${buf.toString('base64')}`, logo };
}

console.log('capturing desktop…');
const desktop = await shoot({ width: 1440, height: 900 });
console.log('capturing phone…');
const phone = await shoot({ width: 390, height: 844 }, { isMobile: true, hasTouch: true });

const card = `
<style>
  @import url('');
  * { margin:0; padding:0; box-sizing:border-box; }
  body {
    width:1280px; height:640px; overflow:hidden; position:relative;
    background:
      radial-gradient(900px 500px at 78% 18%, rgba(47,123,255,.22), transparent 62%),
      radial-gradient(700px 420px at 8% 92%, rgba(124,92,255,.16), transparent 60%),
      #0E131B;
    font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Inter', system-ui, sans-serif;
    color:#F4F7FB;
  }
  .grid { position:absolute; inset:0;
    background-image:linear-gradient(rgba(255,255,255,.028) 1px, transparent 1px),
                     linear-gradient(90deg, rgba(255,255,255,.028) 1px, transparent 1px);
    background-size:46px 46px; mask-image:radial-gradient(circle at 30% 40%, black, transparent 76%); }
  .copy { position:absolute; left:56px; top:74px; width:472px; z-index:4; }
  .mark { display:flex; align-items:center; gap:14px; margin-bottom:26px; }
  .mark svg { width:58px; height:58px; }
  .name { font-size:42px; font-weight:800; letter-spacing:-.024em; }
  .name b { color:#5BA6FF; font-weight:800; }
  h1 { font-size:34px; line-height:1.14; font-weight:800; letter-spacing:-.03em; margin-bottom:15px; }
  h1 em { font-style:normal; background:linear-gradient(96deg,#5BA6FF,#9E86FF);
          -webkit-background-clip:text; -webkit-text-fill-color:transparent; }
  p { font-size:14.5px; line-height:1.5; color:#8D99A8; font-weight:450; }
  /* The promise is the memorable part — it gets weight and near-white. */
  .promise { margin-top:15px; font-size:16px; line-height:1.45; font-weight:700;
             color:#E4EBF4; letter-spacing:-.012em; }
  .promise .note { display:block; margin-top:9px; font-size:11.5px; font-style:italic;
                   font-weight:500; line-height:1.45; color:#66748A; letter-spacing:0; }
  .brokers { margin-top:20px; }
  .brokers .lbl { font-size:10px; font-weight:700; letter-spacing:.13em; text-transform:uppercase;
                  color:#66748A; margin-bottom:7px; }
  .brokers .list { font-size:12.5px; font-weight:600; color:#B9C6D6; line-height:1.55; }
  .brokers .list span { color:#3E4A5C; }
  /* Desktop bleeds off the right edge; phone sits on its bottom-left corner. */
  .shots { position:absolute; inset:0; z-index:2; }
  /* Geometry is deliberate: desk is 760x475 at x=560..1320, so the phone at x=505
     and 44px taller straddles its bottom-left corner instead of floating beside it. */
  .desk { position:absolute; right:-56px; top:116px; width:736px; border-radius:16px;
          border:1px solid rgba(255,255,255,.13); box-shadow:0 46px 96px rgba(0,0,0,.66);
          transform:rotate(-1.4deg); }
  .fone { position:absolute; left:556px; top:186px; width:198px; border-radius:26px;
          border:1px solid rgba(255,255,255,.2); box-shadow:0 40px 80px rgba(0,0,0,.78);
          transform:rotate(2.6deg); z-index:3; }
</style>
<div class="grid"></div>
<div class="copy">
  <div class="mark">${phone.logo}<div class="name">Strat<b>Folio</b></div></div>
  <h1>AI financial intelligence<br><em>platform that never sleeps.</em></h1>
  <p>StratFolio analyzes your positions, prompts, market data, and news, to build plans
     for every trade. You judge the plans, or just let StratFolio work its magic. StratFolio
     continuously backtests every trade plan and your decisions to learn to better manage
     risk in your portfolio.</p>
  <div class="promise">Know what to buy. Know when to buy.<br>Know StratFolio will get you out.*
    <span class="note">*AI auto-trade mode configurable at broker/plan/position level,
      paper trade mode available</span></div>
  <div class="brokers">
    <div class="lbl">One book, every brokerage</div>
    <div class="list">
      Robinhood <span>·</span> Schwab <span>·</span> Fidelity<br>
      E*TRADE <span>·</span> Webull <span>·</span> Interactive Brokers
    </div>
  </div>
</div>
<div class="shots">
  <img class="desk" src="${desktop.data}">
  <img class="fone" src="${phone.data}">
</div>
`;

const ctx = await browser.newContext({ viewport: { width: 1280, height: 640 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.setContent(card);
await page.waitForTimeout(700);
await page.screenshot({ path: OUT });
await browser.close();

console.log(`wrote ${OUT}`);
