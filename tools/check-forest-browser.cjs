// Run against npm run dev. Use PLAYWRIGHT_PACKAGE for an existing installation.
const { chromium } = require(process.env.PLAYWRIGHT_PACKAGE || 'playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('console', m => { if(m.type() === 'error') errors.push(m.text()); });
    await page.goto((process.env.MO_URL || 'http://127.0.0.1:8080') + '/?stage=stage-1-1');
    await page.waitForFunction(() => game.stage?.player?.visual?.model);
    await page.evaluate(() => { game.story.set('intro_seen'); game.story.set('s12_intro'); });
    await page.waitForFunction(() => game.state === 'playing' && !game.stageManager.busy);
    await page.waitForTimeout(500);
    fs.mkdirSync('assets/backgrounds', { recursive: true });
    const stats = [];
    for (const id of ['stage-1-1', 'stage-1-2', 'stage-1-1', 'stage-1-2', 'stage-1-1']) {
      if(await page.evaluate(() => game.stage.id) !== id) {
        await page.evaluate(async id => { await game.stageManager.load(id, { titleCard: false }); }, id);
        await page.waitForTimeout(300);
      }
      const stat = await page.evaluate(() => {
        const s = game.stage, forest = s.forest;
        const gapX = s.id === 'stage-1-1' ? 14.5 : 11;
        const gapBlocked = game.physics.bodies.some(b => b.type === 'static' && b.owner?.tags.has('terrain') && b.left < gapX && b.right > gapX && b.bottom < 1 && b.top > 1);
        const collisionInForest = game.physics.bodies.some(b => { let o = b.owner?.object; while(o) { if(o === forest) return true; o = o.parent; } return false; });
        return { id:s.id, mood:forest.userData.theme, modules:s.kit.templates.size, kitVersion:forest.userData.kitVersion, calls:game.renderer.info.render.calls, triangles:game.renderer.info.render.triangles,
          geometries:game.renderer.info.memory.geometries, gapBlocked, collisionInForest,
          layers:['Painted sky','Placed Blender scenery','Autotiled Blender terrain','Floating pollen','Golden woodland butterflies'].every(n => !!forest.getObjectByName(n)) };
      });
      assert.equal(stat.gapBlocked, false); assert.equal(stat.collisionInForest, false); assert.ok(stat.layers); assert.equal(stat.modules,30); assert.equal(stat.kitVersion,1);
      assert.ok(stat.calls < 160, `Draw call regression: ${stat.calls}`);
      assert.ok(stat.triangles < 1100000, `Geometry budget exceeded: ${stat.triangles}`);
      stats.push(stat);
      await page.screenshot({ path:`assets/backgrounds/${stat.mood}.png` });
      if(id === 'stage-1-1') {
        await page.evaluate(() => { game.state='paused'; game.stage.player.respawnAt(31,8.54); game.camera.follow(game.stage.player,true); });
        await page.waitForTimeout(200);
        await page.screenshot({ path:'assets/backgrounds/treetops.png' });
        await page.evaluate(() => { game.stage.player.respawnAt(3,3); game.state='playing'; });
      }
    }
    // First visit uploads newly used library modules. Compare after both stages warmed the shared cache.
    console.log(JSON.stringify(stats));
    assert.ok(stats[4].geometries <= stats[2].geometries, 'Stage reload leaked geometries after kit cache warmup');
    const before = await page.evaluate(() => {
      game.state='paused'; return game.stage.forest.getObjectByName('Floating pollen').material.uniforms.time.value;
    });
    await page.waitForTimeout(200);
    const after = await page.evaluate(() => game.stage.forest.getObjectByName('Floating pollen').material.uniforms.time.value);
    assert.equal(after, before, 'Forest animation must pause with the game');
    await page.setViewportSize({width:390,height:844});
    await page.waitForTimeout(250);
    assert.equal(await page.evaluate(() => document.querySelector('#gl').width > 0 && game.camera.cam.aspect < 1), true);
    await page.screenshot({path:'/tmp/mo-forest-mobile.png'});
    assert.deepEqual(errors, [], 'Browser or shader errors');
    console.log('PASS: forest layers, both stage palettes, intact pits, draw budgets, reload disposal, pause, mobile.');
    console.log(JSON.stringify(stats));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
