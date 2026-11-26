// Browser behavior tests for CPR Counter (issue 10).
// These assert what the app DOES in a real browser: labels, counting,
// layout stability, computed styles, and viewport behavior. They do not
// assert CSS source text, and they do not claim to verify actual speaker
// or display delivery, or clinical readiness.
const { test, expect } = require('@playwright/test');

async function box(page, selector) {
  return page.locator(selector).boundingBox();
}

async function startAtBpm(page, bpm) {
  if (bpm) {
    await page.fill('#bpm', String(bpm));
  }
  await page.click('#action');
  await expect(page.locator('#phase')).toHaveText('Compressions', { timeout: 10000 });
}

async function waitForCount(page, value) {
  // At-least semantics: a fast counter can pass an exact value between polls.
  await expect
    .poll(async () => Number(await page.locator('#count').textContent()), { timeout: 20000 })
    .toBeGreaterThanOrEqual(value);
}

async function stopIfRunning(page) {
  try {
    if (
      (await page.locator('#stop').count()) &&
      (await page.locator('#stop').isEnabled({ timeout: 2000 }))
    ) {
      await page.click('#stop', { timeout: 2000 });
    }
  } catch {}
}

test.afterEach(async ({ page }) => {
  await stopIfRunning(page).catch(() => {});
});

test('fresh launch: labels, defaults, and configuration summary', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#action')).toHaveText('Start round 1');
  await expect(page.locator('#stop')).toBeDisabled();
  await expect(page.locator('#count')).toHaveText('—');
  await expect(page.locator('#phase')).toHaveText('Ready');
  await expect(page.locator('#configSummary')).toHaveText('110 BPM · 30:2 · Sound off · Visual pulse on');
  await expect(page.locator('#settingsDetails')).toHaveAttribute('open', '');
  await expect(page.locator('footer')).toContainText('Unvalidated prototype');
});

test('invalid BPM is rejected and the session stays idle', async ({ page }) => {
  await page.goto('/');
  await page.fill('#bpm', '99');
  await page.click('#action');
  await expect(page.locator('#phase')).toHaveText('Ready');
  await expect(page.locator('#action')).toHaveText('Start round 1');
  await page.fill('#bpm', '120');
  await page.click('#action');
  await expect(page.locator('#phase')).toHaveText('Compressions', { timeout: 10000 });
});

test('counter-only start works and output toggles do not stop the counter', async ({ page }) => {
  await page.goto('/');
  // Both outputs off: sound starts off; turn the visual pulse off too.
  await page.click('#visual');
  await expect(page.locator('#configSummary')).toContainText('Counter only');
  await page.click('#action');
  await expect(page.locator('#phase')).toHaveText('Compressions', { timeout: 10000 });
  await waitForCount(page, 2);
  // Settings collapse on start; reopen them to reach the output toggles.
  await page.click('#settingsDetails summary');
  // Re-enable sound mid-session, then disable it again: counting continues.
  await page.click('#sound');
  await expect(page.locator('#configSummary')).toContainText('Sound on');
  await waitForCount(page, 4);
  await page.click('#sound');
  await expect(page.locator('#configSummary')).toContainText('Counter only');
  await waitForCount(page, 6);
});

test('cue 30 boundary, whole-second breath timer, no auto resume, one round per Resume', async ({ page }) => {
  await page.goto('/');
  await startAtBpm(page, 120);
  await waitForCount(page, 30);
  await expect(page.locator('#phase')).toHaveText('2 breaths — awaiting dispatcher', { timeout: 10000 });
  await expect(page.locator('#action')).toHaveText('Resume compressions');
  await expect(page.locator('#action')).toBeEnabled();
  // Breath timer: whole seconds, labeled from the last cue.
  await expect(page.locator('#breathTime')).toHaveText(/Since last cue: \d+ s/);
  await expect(page.locator('#breathTime')).not.toHaveText(/\.\d s/);
  // Hiding the timer changes nothing about timing or resume behavior.
  // Settings collapse on start; reopen them to reach the checkbox.
  // Compare document-relative boxes: opening Settings scrolls the page.
  const docBox = (sel) => page.evaluate((s) => {
    const r = document.querySelector(s).getBoundingClientRect();
    return { x: r.x, y: r.y + window.scrollY, width: r.width, height: r.height };
  }, sel);
  const countBoxBefore = await docBox('#count');
  await page.click('#settingsDetails summary');
  await page.locator('#showBreathTime').uncheck();
  await expect(page.locator('#breathTime')).toBeHidden();
  expect(await docBox('#count')).toEqual(countBoxBefore);
  await page.locator('#showBreathTime').check();
  await expect(page.locator('#breathTime')).toBeVisible();
  // No automatic resume after several seconds in the breath phase.
  await page.waitForTimeout(3000);
  await expect(page.locator('#phase')).toHaveText('2 breaths — awaiting dispatcher');
  await expect(page.locator('#round')).toHaveText('Round 1');
  // Exactly one round advance per Resume.
  await page.click('#action');
  await expect(page.locator('#round')).toHaveText('Round 2');
  await expect(page.locator('#phase')).toHaveText('Compressions');
  await waitForCount(page, 2);
});

test('Stop preserves round and count; a new session resets to round 1, cue 1', async ({ page }) => {
  await page.goto('/');
  await startAtBpm(page, 120);
  await waitForCount(page, 3);
  const preserved = await page.locator('#count').textContent();
  await page.click('#stop');
  await expect(page.locator('#action')).toHaveText('Start new session');
  await expect(page.locator('#count')).toHaveText(preserved);
  await expect(page.locator('#round')).toHaveText('Round 1');
  await page.click('#action');
  await expect(page.locator('#round')).toHaveText('Round 1');
  await expect(page.locator('#phase')).toHaveText('Compressions', { timeout: 10000 });
  await waitForCount(page, 1);
});

test('settings collapse on start and the summary stays visible', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#settingsDetails')).toHaveAttribute('open', '');
  await startAtBpm(page, 120);
  await expect(page.locator('#settingsDetails')).not.toHaveAttribute('open', '');
  await expect(page.locator('#configSummary')).toBeVisible();
  await expect(page.locator('#configSummary')).toHaveText('120 BPM · 30:2 · Sound off · Visual pulse on');
});

test('counter and primary controls do not move across counts 9, 10, 29, 30 and breath', async ({ page }) => {
  await page.goto('/');
  await startAtBpm(page, 120);
  const transportBefore = await box(page, '.transport');
  // Sample the count box at whatever values the poll actually observes;
  // the invariant is that 1-digit and 2-digit counts share x/width.
  const countBoxes = [];
  for (const n of [9, 10, 29, 30]) {
    await waitForCount(page, n);
    countBoxes.push(await box(page, '#count'));
  }
  await expect(page.locator('#phase')).toHaveText('2 breaths — awaiting dispatcher', { timeout: 10000 });
  const transportAfter = await box(page, '.transport');
  const countAfter = await box(page, '#count');
  for (const b of countBoxes.slice(1)) {
    expect(Math.abs(b.x - countBoxes[0].x)).toBeLessThanOrEqual(1);
    expect(Math.abs(b.width - countBoxes[0].width)).toBeLessThanOrEqual(1);
  }
  expect(transportAfter).toEqual(transportBefore);
  expect(countAfter.x).toBeCloseTo(countBoxes[0].x, 0);
});

test('a single 300 ms main-thread stall does not fault the session', async ({ page }) => {
  await page.goto('/');
  await startAtBpm(page, 120);
  // Block the main thread right after a count change (just after a cue),
  // so the next cue is ~200 ms away at 120 BPM.
  await page.waitForFunction(() => document.getElementById('count').textContent !== '—', null, { timeout: 10000 });
  await page.evaluate(() => { const end = performance.now() + 300; while (performance.now() < end) {} });
  await page.waitForTimeout(2000);
  await expect(page.locator('#phase')).toHaveText('Compressions');
  await waitForCount(page, 6);
});

test('a 300 ms stall straddling a cue does not fault the session', async ({ page }) => {
  await page.goto('/');
  await startAtBpm(page, 120);
  await page.waitForFunction(() => document.getElementById('count').textContent !== '—', null, { timeout: 10000 });
  // The next cue (500 ms after the previous at 120 BPM) falls inside
  // this stall; it was already scheduled, so it still plays on time.
  await page.waitForTimeout(250);
  await page.evaluate(() => { const end = performance.now() + 300; while (performance.now() < end) {} });
  await page.waitForTimeout(2000);
  await expect(page.locator('#phase')).toHaveText('Compressions');
  await waitForCount(page, 6);
});

test('two long stalls close together fault the session', async ({ page }) => {
  await page.goto('/');
  await startAtBpm(page, 120);
  await page.waitForFunction(() => document.getElementById('count').textContent !== '—', null, { timeout: 10000 });
  await page.evaluate(() => { const end = performance.now() + 300; while (performance.now() < end) {} });
  await page.waitForTimeout(50);
  await page.evaluate(() => { const end = performance.now() + 300; while (performance.now() < end) {} });
  await expect(page.locator('#phase')).toHaveText('Interrupted — stopped', { timeout: 10000 });
  await expect(page.locator('#message')).toContainText('cue timing was interrupted');
  await expect(page.locator('#action')).toHaveText('Restart session');
});

test('a freeze over a second faults the session', async ({ page }) => {
  await page.goto('/');
  await startAtBpm(page, 120);
  await page.waitForFunction(() => document.getElementById('count').textContent !== '—', null, { timeout: 10000 });
  await page.evaluate(() => { const end = performance.now() + 1100; while (performance.now() < end) {} });
  await expect(page.locator('#phase')).toHaveText('Interrupted — stopped', { timeout: 10000 });
  await expect(page.locator('#action')).toHaveText('Restart session');
});

test('a six-digit continuous count does not overflow the panel', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 320, height: 600 } });
  const page = await context.newPage();
  await page.goto('/');
  // A continuous session passes 99,999 cues at ~14 hours; the count must
  // shrink instead of spilling out of the panel.
  await page.evaluate(() => {
    const count = document.getElementById('count');
    count.textContent = '123456';
    count.dataset.digits = '6';
  });
  const fits = await page.evaluate(() => {
    const count = document.getElementById('count').getBoundingClientRect();
    const panel = document.getElementById('panel').getBoundingClientRect();
    return count.left >= panel.left && count.right <= panel.right;
  });
  expect(fits).toBe(true);
  await context.close();
});

test('duplicate session in a second window is rejected in plain language with a Restart label', async ({ page, context }) => {
  await page.goto('/');
  await startAtBpm(page, 120);
  const second = await context.newPage();
  await second.goto('/');
  await second.click('#action');
  await expect(second.locator('#action')).toHaveText('Restart session', { timeout: 10000 });
  await expect(second.locator('#message')).toContainText('Another CPR Counter window is already running a session');
  await second.close();
  // The first session is unaffected.
  await expect(page.locator('#phase')).toHaveText('Compressions');
});

test('double activation does not perform multiple transitions', async ({ page }) => {
  await page.goto('/');
  await page.dblclick('#action');
  await expect(page.locator('#phase')).toHaveText('Compressions', { timeout: 10000 });
  await expect(page.locator('#round')).toHaveText('Round 1');
  await waitForCount(page, 2);
});

test('computed styles: panel status text is white with 4.5:1 contrast in every theme', async ({ page }) => {
  await page.goto('/');
  const luminance = (rgb) => {
    const [r, g, b] = rgb.map((v) => {
      const s = v / 255;
      return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  for (const theme of ['teal', 'blue', 'sage', 'lavender', 'amber']) {
    await page.selectOption('#theme', theme);
    const colors = await page.evaluate(() => {
      const cs = (id) => getComputedStyle(document.getElementById(id));
      return {
        status: cs('rateLabel').color,
        pulse: cs('pulse').backgroundColor,
      };
    });
    expect(colors.status).toBe('rgb(255, 255, 255)');
    const parse = (c) => c.match(/\d+/g).map(Number);
    const contrast = (luminance([255, 255, 255]) + 0.05) / (luminance(parse(colors.pulse)) + 0.05);
    expect(contrast).toBeGreaterThanOrEqual(4.5);
  }
});

test('touch targets, separation, and no text selection on primary buttons', async ({ page }) => {
  await page.goto('/');
  const action = await box(page, '#action');
  const stop = await box(page, '#stop');
  expect(action.height).toBeGreaterThanOrEqual(48);
  expect(stop.height).toBeGreaterThanOrEqual(48);
  expect(stop.x - (action.x + action.width)).toBeGreaterThanOrEqual(8);
  const userSelect = await page.evaluate(() =>
    getComputedStyle(document.getElementById('action')).userSelect);
  expect(userSelect).toBe('none');
  // Body text selection is not disabled app-wide.
  const bodySelect = await page.evaluate(() => getComputedStyle(document.body).userSelect);
  expect(bodySelect).not.toBe('none');
});

test('short landscape keeps Start and Stop reachable; labels do not clip at 200% zoom', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 360 });
  await page.goto('/');
  const action = await box(page, '#action');
  const stop = await box(page, '#stop');
  expect(action.y + action.height).toBeLessThanOrEqual(360);
  expect(stop.y + stop.height).toBeLessThanOrEqual(360);
  // 200% zoom: button labels must not clip.
  await page.evaluate(() => { document.body.style.zoom = '200%'; });
  for (const id of ['#action', '#stop']) {
    const clipped = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      return el.scrollWidth > el.clientWidth || el.scrollHeight > el.clientHeight;
    }, id);
    expect(clipped).toBe(false);
  }
});

test('narrow portrait keeps the counter, controls, and summary visible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  for (const sel of ['#count', '#action', '#stop', '#configSummary', '#settingsDetails summary']) {
    await expect(page.locator(sel)).toBeVisible();
  }
  await startAtBpm(page, 120);
  await waitForCount(page, 2);
  await expect(page.locator('#action')).toBeVisible();
  await expect(page.locator('#stop')).toBeVisible();
});

test('pending-update banner reserves its space and never moves the controls', async ({ page }) => {
  await page.goto('/');
  // getBoundingClientRect measures layout space even for a
  // visibility:hidden banner; Playwright's boundingBox() returns null there.
  const rect = (sel) => page.evaluate((s) => {
    const r = document.querySelector(s).getBoundingClientRect();
    return { x: r.x, y: r.y, width: r.width, height: r.height };
  }, sel);
  // The updater loads with the page and creates the banner on startup.
  await page.waitForSelector('#releaseBanner', { state: 'attached' });
  const banner = await rect('#releaseBanner');
  expect(banner.height).toBeGreaterThan(0);
  // The banner is hidden but already reserves its space. Showing it (what
  // happens when an update becomes pending) must not move the controls.
  const transportHidden = await rect('.transport');
  await page.evaluate(() => {
    document.getElementById('releaseBanner').style.visibility = 'visible';
  });
  expect(await rect('.transport')).toEqual(transportHidden);
});

test('service worker keeps only the current and previous version caches', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => document.getElementById('offline').textContent.includes('Offline files verified'), null, { timeout: 15000 });
  // Seed the caches past releases left behind.
  await page.evaluate(async () => {
    for (const v of ['2.0.0', '2.1.0', '2.2.0', '2.3.0']) {
      const c = await caches.open('cpr-counter-' + v);
      await c.put('/seed-' + v, new Response('seed'));
    }
  });
  // Force the worker to activate again: unregister, then reload.
  await page.evaluate(async () => {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(regs.map((r) => r.unregister()));
  });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => document.getElementById('offline').textContent.includes('Offline files verified'), null, { timeout: 15000 });
  const names = await page.evaluate(() => caches.keys());
  expect(names).toContain('cpr-counter-2.4.0'); // current release
  expect(names).toContain('cpr-counter-2.3.0'); // previous release kept
  expect(names).not.toContain('cpr-counter-2.2.0');
  expect(names).not.toContain('cpr-counter-2.1.0');
  expect(names).not.toContain('cpr-counter-2.0.0');
  // The pruned caches are gone, the kept ones still serve, and the app
  // still works offline after the cleanup.
  await page.evaluate(() => caches.open('cpr-counter-2.3.0').then((c) => c.match('/seed-2.3.0').then((r) => r.text())));
  await expect(page.locator('#action')).toHaveText('Start round 1');
});

test('simulation harness is isolated: scenarios work, normal app is untouched', async ({ page }) => {
  await page.goto('/sim.html');
  await expect(page.locator('h1')).toContainText('Simulation');
  await expect(page.locator('.sim-note')).toContainText('development only');
  await page.click('#simCue28');
  await expect(page.locator('#simCount')).toHaveText('28');
  await page.click('#simBreath');
  await expect(page.locator('#simPhase')).toContainText('breaths');
  await page.click('#simReset');
  await expect(page.locator('#simCount')).toHaveText('—');
  // Isolation: the harness is not in the service-worker cache list and
  // is not linked from the normal page.
  const sw = await page.evaluate(() => fetch('/sw.js').then((r) => r.text()));
  expect(sw).not.toContain('sim.html');
  const index = await page.evaluate(() => fetch('/index.html').then((r) => r.text()));
  expect(index).not.toContain('sim.html');
});


test('CPR reference and FAQ are present in the offline-cached application page', async ({ page }) => {
  await page.goto('/');
  const reference = page.locator('#referenceDetails');
  await expect(reference).toBeAttached();
  const referenceSummary = reference.locator(':scope > summary');
  await expect(referenceSummary).toHaveText('CPR reference & frequently asked questions');
  await referenceSummary.click();
  await expect(reference).toContainText('100–120 compressions per minute');
  await expect(reference).toContainText('Hands-Only CPR');
  await expect(reference).toContainText('25 November 2026');
  await expect(reference.locator('a[href^="https://"]')).toHaveCount(6);
  await page.waitForFunction(() => document.getElementById('offline').textContent.includes('Offline files verified'), null, { timeout: 15000 });
  const cached = await page.evaluate(async () => {
    // The previous release is intentionally retained, so selecting the
    // first matching cache can read stale HTML depending on cache order.
    // Read the current release cache explicitly.
    const cache = await caches.open('cpr-counter-2.4.0');
    const response = await cache.match(new URL('./index.html', location.href).href);
    return response ? response.text() : '';
  });
  expect(cached).toContain('CPR reference & frequently asked questions');
  expect(cached).toContain('American Heart Association, 2025 Guidelines');
});

test('App details explain cue counts, both modes, Stop, Resume, and timing interruptions', async ({ page }) => {
  await page.goto('/');
  await page.locator('#appDetails summary').click();
  const details = page.locator('#countingHelp').locator('..');
  await expect(details).toContainText('scheduled metronome cue');
  await expect(details).toContainText('Continuous cadence');
  await expect(details).toContainText('Start afterward begins a new session');
  await expect(details).toContainText('does not time or confirm two breaths');
  await expect(details).toContainText('400 ms ahead');
  await expect(details).toContainText('frozen browser');
});
