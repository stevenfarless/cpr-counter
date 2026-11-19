// Workstation-load measurement for the timing fault checks (issue #17).
//
// Starts a session at 120 BPM under a load condition and reports whether
// it false-faults, which check fired, and the observed frame gaps.
// Load is applied two ways: CDP CPU throttling (a proxy for a busy
// dispatcher workstation: CAD, maps, radio) and main-thread stall
// injection (a busy loop, placed right after a cue so it cannot also
// trip the missed-cue check).
//
// Usage:
//   node browser-tests/load-measurement.cjs [scenario ...]
// Scenarios: idle, throttle4, throttle10, stall120, stall300, stall2x300,
//   stall600, endurance. Default: idle throttle4 throttle10 stall300.
// Exits non-zero if any scenario faults unexpectedly (stall600 is
// expected to fault: a 600 ms freeze is a genuine interruption).
//
// This is a measurement script, not part of `npm test`: the endurance
// scenario runs for minutes.
'use strict';
const { spawn } = require('node:child_process');
const { chromium } = require('@playwright/test');

const BASE = 'http://127.0.0.1:8901';
const SCENARIOS = {
  idle: { seconds: 60 },
  throttle4: { seconds: 60, throttle: 4 },
  throttle10: { seconds: 60, throttle: 10 },
  stall120: { seconds: 30, stalls: [{ ms: 120 }] },
  stall300: { seconds: 30, stalls: [{ ms: 300 }] },
  // Stall starting 250 ms after a cue: the next cue (500 ms after the
  // previous at 120 BPM) falls inside the stall, so only the missed-cue
  // check can fire — this measures that path in isolation.
  stall300mid: { seconds: 30, stalls: [{ ms: 300, delayMs: 250 }] },
  'stall2x300': { seconds: 30, stalls: [{ ms: 300 }, { ms: 300, gapMs: 50 }], expectFault: true },
  stall600: { seconds: 30, stalls: [{ ms: 600 }], expectFault: true },
  endurance: { seconds: 180, throttle: 4 },
};

async function waitForServer() {
  for (let i = 0; i < 50; i++) {
    try {
      const res = await fetch(BASE + '/index.html');
      if (res.ok) return;
    } catch {}
    await new Promise(r => setTimeout(r, 200));
  }
  throw new Error('test server did not come up');
}

async function runScenario(browser, name, cfg) {
  const context = await browser.newContext();
  const page = await context.newPage();
  // Frame-gap probe: records every rAF interval in the page.
  await page.addInitScript(() => {
    window.__gaps = [];
    let last = 0;
    const loop = t => { if (last) window.__gaps.push(Math.round(t - last)); last = t; requestAnimationFrame(loop); };
    requestAnimationFrame(loop);
  });
  await page.goto(BASE + '/', { waitUntil: 'load' });
  await page.fill('#bpm', '120');
  await page.click('#action');
  await page.waitForFunction(() => document.getElementById('phase').textContent === 'Compressions', null, { timeout: 10000 });
  if (cfg.throttle) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: cfg.throttle });
  }
  const faults = [];
  const start = Date.now();
  let stallIndex = 0;
  // Stalls run once, shortly after the session starts, placed right after
  // a cue so the missed-cue check cannot also fire.
  const runStalls = async () => {
    for (const s of cfg.stalls || []) {
      await page.waitForFunction(() => document.getElementById('count').textContent !== '—', null, { timeout: 10000 });
      if (s.delayMs) await page.waitForTimeout(s.delayMs);
      await page.evaluate(ms => { const end = performance.now() + ms; while (performance.now() < end) {} }, s.ms);
      if (s.gapMs) await page.waitForTimeout(s.gapMs);
      stallIndex++;
    }
  };
  const stallPromise = runStalls().catch(e => faults.push({ at: Date.now() - start, msg: 'stall injection failed: ' + e.message }));
  while (Date.now() - start < cfg.seconds * 1000) {
    await page.waitForTimeout(250);
    const phase = await page.textContent('#phase');
    if (phase.includes('Interrupted')) {
      faults.push({ at: Date.now() - start, msg: await page.textContent('#message') });
      break;
    }
  }
  await stallPromise.catch(() => {});
  const gaps = await page.evaluate(() => window.__gaps || []);
  const over250 = gaps.filter(g => g > 250).length;
  const max = gaps.length ? Math.max(...gaps) : 0;
  await context.close();
  const faulted = faults.length > 0;
  const expected = !!cfg.expectFault;
  console.log(`--- ${name} (${cfg.seconds}s${cfg.throttle ? `, CPU x${cfg.throttle}` : ''}${cfg.stalls ? `, stalls ${cfg.stalls.map(s => s.ms + 'ms').join('+')}` : ''})`);
  console.log(`    faults: ${faulted ? faults.map(f => `${f.at}ms: ${f.msg}`).join(' | ') : 'none'}${faulted === expected ? '' : '  <-- UNEXPECTED'}`);
  console.log(`    rAF gaps: n=${gaps.length} max=${max}ms over250ms=${over250}`);
  return faulted === expected;
}

async function main() {
  const names = process.argv.slice(2).length ? process.argv.slice(2) : ['idle', 'throttle4', 'throttle10', 'stall300'];
  for (const n of names) if (!SCENARIOS[n]) throw new Error('unknown scenario: ' + n + ' (known: ' + Object.keys(SCENARIOS).join(', ') + ')');
  const server = spawn('python3', ['-m', 'http.server', '8901', '--bind', '127.0.0.1'], { stdio: 'ignore' });
  try {
    await waitForServer();
    const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
    let ok = true;
    try {
      for (const n of names) ok = (await runScenario(browser, n, SCENARIOS[n])) && ok;
    } finally {
      await browser.close();
    }
    console.log(ok ? 'ALL SCENARIOS AS EXPECTED' : 'UNEXPECTED RESULT — see above');
    process.exit(ok ? 0 : 1);
  } finally {
    server.kill();
  }
}
main().catch(e => { console.error(e.message); process.exit(1); });
