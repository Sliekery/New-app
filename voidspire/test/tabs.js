/* =========================================================================
 * VOIDSPIRE — test/tabs.js
 * Several drawings open at once.
 *
 * The whole risk in this feature is LEAKAGE. The tool holds one `doc`, one
 * undo stack, one frame index and one viewport; tabs work by pouring a tab
 * into those globals on the way in and pouring them back on the way out. Get
 * one of them wrong and the failure is not a crash — it is undo in one
 * drawing removing a stroke from another, or a half-finished path following
 * you across and being committed into a drawing you had not touched.
 *
 * So this checks the seams rather than the buttons: that each tab keeps its
 * own strokes, its own history, its own frames and its own zoom; that work in
 * progress is dropped at the boundary; and that the single-document autosave
 * that existed before tabs becomes tab one instead of being thrown away.
 *
 * Usage: node test/tabs.js     (tools served on :8944)
 * ========================================================================= */
const { chromium } = require('playwright-core');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  — ' + detail : '')); }
}

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox'],
  });
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) errs.push('console: ' + m.text()); });
  p.on('dialog', d => d.accept());

  const read = async () => {
    const s = await p.textContent('#status');
    return {
      frames: +((s.match(/frame \d+\/(\d+)/) || [])[1] || 0),
      frame: +((s.match(/frame (\d+)\//) || [])[1] || 0),
      strokes: +((s.match(/(\d+) stroke/) || [])[1] || 0),
      zoom: +((s.match(/· ([\d.]+)×/) || [])[1] || 1),
      raw: s,
    };
  };
  const names = () => p.$$eval('#tabBar .tab .tn', e => e.map(x => x.textContent));
  const activeTab = () => p.$$eval('#tabBar .tab', e => e.findIndex(x => x.classList.contains('on')));
  const undoOn = () => p.$eval('#bUndo', e => !e.disabled);

  /* ---- the migration, first: it only happens once ---------------------- */
  console.log('THE DRAWING THAT WAS ALREADY OPEN BECOMES TAB ONE');
  {
    /* Seeded on a page of its own, from an init script, so the old autosave is
     * in place BEFORE the tool's own boot runs. Writing it with evaluate() and
     * reloading does not work: the reload fires pagehide, the tool flushes its
     * (empty) tab set on the way out, and the migration then finds a tab file
     * already there and correctly declines to migrate. */
    const m = await b.newPage();
    m.on('pageerror', e => errs.push('migration: ' + e.message));
    await m.addInitScript(() => {
      localStorage.clear();
      localStorage.setItem('voidspire.artist.doc', JSON.stringify({
        fps: 8,
        layers: [{ name: 'sketch', vis: true, exp: false }, { name: 'line', vis: true, exp: true }],
        frames: [{ cells: [{ strokes: [], eyes: [] },
          { strokes: [{ pts: [[-0.5, -0.5], [0.5, 0.5]], m: false },
                      { pts: [[-0.5, 0.5], [0.5, -0.5]], m: false }], eyes: [] }] }],
      }));
    });
    await m.goto('http://localhost:8944/tools/artist.html');
    await m.waitForTimeout(900);
    const s = await m.textContent('#status');
    ok('the old autosave is there, not thrown away', /2 strokes/.test(s), s);
    ok('as a single tab', (await m.$$eval('#tabBar .tab', e => e.length)) === 1);
    await m.close();
  }

  /* ---- from here, a clean start ---------------------------------------- */
  await p.goto('http://localhost:8944/tools/artist.html');
  await p.evaluate(() => localStorage.clear());
  await p.reload(); await p.waitForTimeout(900);

  const box = await p.locator('#pad').boundingBox();
  async function drag(a, bb, c, d) {
    const x0 = box.x + box.width * a, y0 = box.y + box.height * bb;
    const x1 = box.x + box.width * c, y1 = box.y + box.height * d;
    await p.mouse.move(x0, y0); await p.mouse.down();
    await p.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 4 });
    await p.mouse.move(x1, y1, { steps: 4 });
    await p.mouse.up(); await p.waitForTimeout(140);
  }
  const openTab = async i => { await p.click(`#tabBar .tab:nth-child(${i + 1})`); await p.waitForTimeout(400); };

  console.log('\nTWO DRAWINGS');
  ok('it starts with one tab', (await names()).length === 1, (await names()).join(','));
  await p.click('#mShape'); await p.waitForTimeout(80);
  await drag(0.2, 0.2, 0.8, 0.8);
  await drag(0.3, 0.3, 0.6, 0.6);
  const one = await read();
  ok('two shapes in the first', one.strokes === 2, one.raw);

  await p.click('#tabAdd'); await p.waitForTimeout(500);
  ok('a second tab appears', (await names()).length === 2, (await names()).join(','));
  ok('with its own name', (await names())[1] !== (await names())[0], (await names()).join(','));
  ok('and it is the one you are in', (await activeTab()) === 1);
  ok('and it is empty — the first drawing did not follow', (await read()).strokes === 0,
    (await read()).raw);

  await p.click('#mLine'); await p.waitForTimeout(60);
  await drag(0.2, 0.5, 0.8, 0.5);
  ok('drawing in it does not touch the first', (await read()).strokes === 1);

  await openTab(0);
  ok('and the first is exactly as it was left', (await read()).strokes === 2, (await read()).raw);
  await openTab(1);
  ok('as is the second', (await read()).strokes === 1, (await read()).raw);

  console.log('\nUNDO BELONGS TO ONE DRAWING');
  /* The failure this catches would be silent and awful: undo in one tab
   * taking a stroke out of another, because both share one history stack. */
  await openTab(0);
  await p.click('#bUndo'); await p.waitForTimeout(200);
  ok('undo in the first takes back the first\'s stroke', (await read()).strokes === 1);
  await openTab(1);
  ok('and leaves the second alone', (await read()).strokes === 1, (await read()).raw);
  await p.click('#bUndo'); await p.waitForTimeout(200);
  ok('the second has its own history to undo', (await read()).strokes === 0);
  await openTab(0);
  ok('and the first still has the stroke undo left it', (await read()).strokes === 1);
  ok('with its own redo still available', await p.$eval('#bRedo', e => !e.disabled));

  console.log('\nFRAMES AND ZOOM ARE PER DRAWING');
  await p.click('#fDup'); await p.waitForTimeout(400);
  await p.click('#fDup'); await p.waitForTimeout(400);
  ok('the first has three frames', (await read()).frames === 3, (await read()).raw);
  await openTab(1);
  ok('the second still has one', (await read()).frames === 1, (await read()).raw);
  await p.click('#zIn'); await p.click('#zIn'); await p.waitForTimeout(300);
  const z2 = (await read()).zoom;
  ok('zooming the second changes its zoom', z2 > 1.2, String(z2));
  await openTab(0);
  ok('and the first is still where you left it', (await read()).zoom === 1,
    String((await read()).zoom));
  await openTab(1);
  ok('while the second kept its zoom', (await read()).zoom === z2, String((await read()).zoom));

  console.log('\nWORK IN PROGRESS DOES NOT FOLLOW YOU');
  /* A path still being laid down belongs to the tab it was started in. Carried
   * across, its points would be committed into a drawing you never touched. */
  await p.click('#mDraw'); await p.waitForTimeout(80);
  const tap = async (x, y) => {
    await p.mouse.move(box.x + box.width * x, box.y + box.height * y);
    await p.mouse.down(); await p.mouse.up(); await p.waitForTimeout(60);
  };
  await tap(0.3, 0.3); await tap(0.5, 0.3); await tap(0.5, 0.6);
  ok('three points are in hand', /3 in hand/.test((await read()).raw), (await read()).raw);
  await openTab(0);
  ok('switching drops them rather than carrying them', !/in hand/.test((await read()).raw),
    (await read()).raw);
  const before = (await read()).strokes;
  await p.click('#bFinish'); await p.waitForTimeout(200);
  ok('and they cannot be committed into the other drawing',
    (await read()).strokes === before, before + ' → ' + (await read()).strokes);

  console.log('\nIT ALL COMES BACK');
  const snapshot = { names: await names(), active: await activeTab() };
  await openTab(1);
  const two = await read();
  await openTab(0);
  const oneAgain = await read();
  await p.reload(); await p.waitForTimeout(1000);
  ok('both tabs are still there', (await names()).length === 2, (await names()).join(','));
  ok('with their names', (await names()).join(',') === snapshot.names.join(','),
    (await names()).join(','));
  ok('and the one you were in is the one you get', (await activeTab()) === 0, String(await activeTab()));
  ok('the first drawing is intact', (await read()).strokes === oneAgain.strokes
    && (await read()).frames === oneAgain.frames, (await read()).raw);
  await openTab(1);
  ok('and so is the second', (await read()).strokes === two.strokes, (await read()).raw);

  console.log('\nCLOSING ONE');
  await p.click('#tabBar .tab:nth-child(2) .tx'); await p.waitForTimeout(500);
  ok('the tab goes', (await names()).length === 1, (await names()).join(','));
  ok('and what is left is the other drawing', (await read()).strokes === oneAgain.strokes,
    (await read()).raw);
  ok('the last tab has no close button — there has to be somewhere to draw',
    (await p.$$('#tabBar .tab .tx')).length === 0);
  await p.reload(); await p.waitForTimeout(900);
  ok('and it stays closed', (await names()).length === 1, (await names()).join(','));

  console.log('\nTHE NAME FOLLOWS THROUGH TO THE EXPORT');
  await p.evaluate(() => {
    const box2 = [...document.querySelectorAll('.side .box')]
      .find(x => /EXPORT/.test(x.querySelector('h2').textContent));
    if (box2 && box2.classList.contains('shut')) box2.querySelector('h2').onclick();
  });
  await p.waitForTimeout(250);
  ok('the export name is the drawing\'s name', (await p.inputValue('#xName')) === (await names())[0],
    (await p.inputValue('#xName')) + ' vs ' + (await names())[0]);

  console.log('\n' + (errs.length ? 'PAGE ERRORS:\n  ' + errs.join('\n  ') : 'no page errors'));
  if (errs.length) fail += errs.length;
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
