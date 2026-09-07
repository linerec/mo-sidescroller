// PLAYWRIGHT_PACKAGE may point to an existing Playwright package; no production dependency.
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('favicon')) errors.push(m.text()); });
  const base = process.env.MO_URL || 'http://127.0.0.1:8080';
  await page.goto(base + '/character-preview.html');
  await page.waitForFunction(() => window.previewCharacter?.model);
  assert.equal(await page.locator('[data-motion]').count(), 13);
  for (const name of ['idle','attack','sleepy','use_item','double_jump','hit','damage','happy']) {
    await page.locator(`[data-motion="${name}"]`).click();
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => previewCharacter.motion.name), name);
  }
  await page.locator('[data-motion="idle"]').click();
  await page.waitForTimeout(180);
  await page.screenshot({ path: '/tmp/mochi-preview-browser.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(base + '/?stage=stage-1-2');
  await page.waitForFunction(() => window.game?.stage?.player?.visual?.model);
  await page.evaluate(() => { game.story.set('s12_intro'); });
  await page.waitForFunction(() => game.state === 'playing' && !game.input.locked, { timeout: 20000 });
  await page.waitForTimeout(1000);
  const result = await page.evaluate(async () => {
    const p = game.stage.player;
    // Isolate deterministic gameplay ticks from the live requestAnimationFrame loop.
    game.setState('paused');
    const savedInput = game.input;
    let pressed = new Set();
    game.input = { axis: () => 0, pressed: a => pressed.has(a), down: () => false, released: () => false };
    const tick = (n, keys = []) => {
      game.state = 'playing';
      for (let i=0;i<n;i++) { pressed = new Set(i === 0 ? keys : []); p.update(1/60); }
      pressed.clear(); game.state = 'paused';
    };
    const reset = () => { p.respawnAt(2, 2.54); p.invuln = 0; p.body.onGround = true; p._wasGround = true; p.body.vx = 0; p.body.vy = 0; };
    const checks = {};
    reset(); tick(1, ['jump']); checks.jump = p._jumps === 1 && p.body.vy > 0;
    tick(1, ['jump']); checks.double = p._jumps === 2 && p.visual.motion.name === 'double_jump';
    tick(1, ['jump']); checks.noThird = p._jumps === 2;
    reset(); tick(740); checks.sleep = p.visual.motion.name === 'sleepy';
    tick(1, ['attack']); checks.wake = p.visual.motion.name === 'attack';
    let impacts = 0; const off = game.events.on('player:attack-impact', () => impacts++);
    tick(6); checks.windup = impacts === 0; tick(10); checks.impact = impacts === 1; tick(50); checks.singleImpact = impacts === 1; off();
    reset(); game.inventory.add('lantern'); p.useItem(); tick(40); checks.item = p.itemLight.intensity > 0 && game.inventory.has('lantern');
    reset(); p.useItem(); p.takeDamage(); checks.hit = p.visual.motion.name === 'hit' && p._pendingItem === null;
    tick(14); checks.damage = p.visual.motion.name === 'damage'; tick(50); checks.recovery = p.state === 'idle';
    reset(); p.attack(); p.takeDamage(); checks.cancelAttack = p._pendingAttack === null;
    reset(); p.celebrate(); checks.happy = p.visual.motion.name === 'happy';
    // Check lethal damage without opening a game-over menu in this isolated tick run.
    const emit = game.events.emit.bind(game.events); game.events.emit = (name, data) => { if(name !== 'player:died') emit(name,data); };
    p.hp = 1; p.takeDamage(); tick(70); checks.dead = p.state === 'dead' && p.visual.motion.name === 'dead';
    p.invuln = 0.6; p.updateVisual(0.1); checks.deadVisible = p.rig.visible;
    game.events.emit = emit; p.heal(3); reset(); checks.respawn = p.control && p.visual.motion.name === 'idle' && p.itemLight.intensity === 0;
    game.input = savedInput; game.state = 'playing'; game.input.unlock();
    return checks;
  });
  for (const [name, ok] of Object.entries(result)) assert.equal(ok, true, name);
  await page.waitForTimeout(200);
  await page.screenshot({ path: '/tmp/mochi-game-browser.png' });
  assert.deepEqual(errors, []);
  console.log('PASS browser:', JSON.stringify(result));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
