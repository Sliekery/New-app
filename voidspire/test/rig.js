/* =========================================================================
 * VOIDSPIRE — test/rig.js
 * Making a limb swing without redrawing it.
 *
 * The complaint this exists for: "when animating we are removing some lines
 * and redrawing them in a different position — I wanna make the arms go up
 * and down." Two things were added for it, and they only pay off together:
 *
 *   PIVOT   turn a selection around a point you place — a shoulder, a hinge —
 *           instead of around the selection's own middle, which swings the top
 *           of an arm backwards and leaves the shoulder behind.
 *   REPEAT  do that same movement again over N new frames, each one step
 *           further, with everything you did not select left exactly alone.
 *
 * What is asserted is the GEOMETRY, not the buttons. A rotation about a pivot
 * has two signatures no amount of "it looked right" can stand in for: the
 * point on the pivot does not move at all, and every other point keeps its
 * distance from it. And a generated frame has to leave the body byte-identical
 * and keep the stroke ORDER, because TWEEN pairs strokes by index — a limb
 * deleted and redrawn goes to the end of the list, which is exactly what makes
 * a hand-redrawn animation tween into a body melting through an arm.
 *
 * Usage: node test/rig.js     (tools served on :8944)
 * ========================================================================= */
const { chromium } = require('playwright-core');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  — ' + detail : '')); }
}
const DEG = 180 / Math.PI;

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
  await p.goto('http://localhost:8944/tools/artist.html');
  await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
  await p.reload();
  await p.waitForTimeout(900);

  const status = () => p.textContent('#status');
  const pivotLabel = () => p.textContent('#tPivot');
  const repHint = () => p.textContent('#repHint');
  const frameCount = () => p.$$eval('#frameList > *', e => e.length);

  /* Every frame of the drawing, as the export sees it — which is the only
   * view of it that is not the tool's own private state. A still exports as
   * { p, e }; more than one frame exports as { fps, frames: [ … ] }. */
  async function frames() {
    const v = await p.inputValue('#out');
    const m = v.match(/art:\s*([\s\S]*),\s*$/);
    if (!m) return null;
    let a;
    // eslint-disable-next-line no-new-func
    try { a = Function('return (' + m[1] + ')')(); } catch (e) { return null; }
    return a.frames ? a.frames : [a];
  }
  // one polyline as a list of [x,y], rather than the flat run the format uses
  const pairs = run => {
    const o = [];
    for (let i = 0; i < run.length; i += 2) o.push([run[i], run[i + 1]]);
    return o;
  };

  const box = await p.locator('#pad').boundingBox();
  const at = (fx, fy) => [box.x + box.width * fx, box.y + box.height * fy];
  async function drag(a0, b0, c, d) {
    const [x0, y0] = at(a0, b0), [x1, y1] = at(c, d);
    await p.mouse.move(x0, y0); await p.mouse.down();
    await p.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 4 });
    await p.mouse.move(x1, y1, { steps: 4 });
    await p.mouse.up(); await p.waitForTimeout(140);
  }
  async function tap(fx, fy) {
    const [x, y] = at(fx, fy);
    await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.up();
    await p.waitForTimeout(140);
  }

  /* MIRROR off: it doubles every path, and what is being measured here is
   * which strokes moved and which did not. */
  await p.click('#bMirror'); await p.waitForTimeout(120);

  /* ---- a body and an arm ------------------------------------------------ */
  console.log('A BODY AND AN ARM');
  const ARM_TOP = [0.60, 0.25];                 // the shoulder
  await p.click('#mLine'); await p.waitForTimeout(80);
  await drag(0.20, 0.80, 0.80, 0.80);           // stroke 0 — the body, low down
  await drag(ARM_TOP[0], ARM_TOP[1], 0.60, 0.55); // stroke 1 — the arm, hanging
  let f = await frames();
  ok('two strokes, drawn in that order', f && f.length === 1 && f[0].p.length === 2,
    f && f[0].p.length + ' strokes in ' + f.length + ' frame');
  const BODY0 = JSON.stringify(f[0].p[0]);

  /* WORLD BACK TO SCREEN. The pad is not square, and the world is stretched
   * to its aspect — the two axes have different scales — so "the middle of the
   * arm" is not a screen fraction that can be guessed. It can be fitted from
   * what was just drawn, though: three points whose screen fraction AND world
   * coordinate are both known. Grabbing the arm by a fraction picked by eye is
   * how the drag in this suite first missed the selection entirely. */
  const body = pairs(f[0].p[0]), arm0 = pairs(f[0].p[1]);
  const kx = (0.80 - 0.20) / (body[1][0] - body[0][0]);
  const ky = (0.80 - 0.25) / (body[0][1] - arm0[0][1]);
  const sx = wx => 0.20 + (wx - body[0][0]) * kx;
  const sy = wy => 0.25 + (wy - arm0[0][1]) * ky;

  /* ---- the guards, before anything has been done ------------------------- */
  console.log('\nREPEAT SAYS WHAT IT NEEDS');
  await p.click('#mSel'); await p.waitForTimeout(120);
  ok('the selection bar is showing', await p.$eval('#selBar', e => getComputedStyle(e).display !== 'none'));
  await p.click('#tRepeat'); await p.waitForTimeout(160);
  ok('with nothing selected it asks for a selection, and makes no frames',
    /select the part that moves/.test(await status()) && (await frameCount()) === 1,
    await status());
  ok('and says so as a warning, not as news', /⚠/.test(await status()), await status());

  // a box round the arm only — the body is far below it
  await drag(0.45, 0.12, 0.78, 0.62);
  ok('the arm alone is selected', /1 stroke selected/.test(
    await p.textContent('#selCount')), await p.textContent('#selCount'));
  await p.click('#tRepeat'); await p.waitForTimeout(160);
  ok('with nothing done yet it asks you to do it once',
    /REPEAT does that again/.test(await status()) && (await frameCount()) === 1,
    await status());
  ok('and the hint has not promised anything yet',
    /each one step further/.test(await repHint()), await repHint());

  /* ---- no pivot: it turns about its own middle --------------------------- */
  console.log('\nWITH NO PIVOT A TURN GOES ROUND THE MIDDLE');
  const armBefore = pairs((await frames())[0].p[1]);
  const midBefore = [(armBefore[0][0] + armBefore[1][0]) / 2,
                     (armBefore[0][1] + armBefore[1][1]) / 2];
  await p.click('#tRotR'); await p.waitForTimeout(200);
  {
    const arm = pairs((await frames())[0].p[1]);
    const mid = [(arm[0][0] + arm[1][0]) / 2, (arm[0][1] + arm[1][1]) / 2];
    ok('the middle stays put', Math.hypot(mid[0] - midBefore[0], mid[1] - midBefore[1]) < 0.01,
      midBefore.join(',') + ' → ' + mid.join(','));
    ok('and BOTH ends move — which is the thing that is wrong for a limb',
      Math.hypot(arm[0][0] - armBefore[0][0], arm[0][1] - armBefore[0][1]) > 0.02
      && Math.hypot(arm[1][0] - armBefore[1][0], arm[1][1] - armBefore[1][1]) > 0.02,
      JSON.stringify(armBefore) + ' → ' + JSON.stringify(arm));
    ok('the body was not touched', JSON.stringify((await frames())[0].p[0]) === BODY0);
    ok('and the hint now knows what would be repeated',
      /turned further/.test(await repHint()), await repHint());
  }
  await p.click('#bUndo'); await p.waitForTimeout(200);
  ok('undo puts the arm back exactly',
    JSON.stringify(pairs((await frames())[0].p[1])) === JSON.stringify(armBefore),
    JSON.stringify(pairs((await frames())[0].p[1])));

  /* ---- placing one ------------------------------------------------------- */
  console.log('\nPLACING A PIVOT');
  ok('the button starts off', (await pivotLabel()).trim() === 'PIVOT', await pivotLabel());
  await p.click('#tPivot'); await p.waitForTimeout(150);
  ok('pressing it asks for the joint', /TAP THE JOINT/.test(await pivotLabel()), await pivotLabel());
  ok('and says what it wants in words too', /tap the point to turn around/.test(await status()),
    await status());
  await p.click('#tPivot'); await p.waitForTimeout(150);
  ok('pressing it again backs out without moving anything',
    (await pivotLabel()).trim() === 'PIVOT', await pivotLabel());

  await p.click('#tPivot'); await p.waitForTimeout(150);
  await tap(ARM_TOP[0], ARM_TOP[1]);            // the shoulder
  ok('tapping the joint sets it', /PIVOT ✕/.test(await pivotLabel()), await pivotLabel());
  ok('and it says where', /turns now go round/.test(await status()), await status());
  ok('the selection is still the arm — placing a pivot is not a click on the canvas',
    /1 stroke selected/.test(await p.textContent('#selCount')),
    await p.textContent('#selCount'));
  ok('and no stroke was added by the tap', (await frames())[0].p.length === 2,
    (await frames())[0].p.length + ' strokes');
  ok('it is drawn on the canvas', await p.evaluate(() => {
    /* the crosshair is the only amber thing on the pad */
    const c = document.getElementById('pad'), g = c.getContext('2d');
    const d = g.getImageData(0, 0, c.width, c.height).data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] > 200 && d[i + 1] > 130 && d[i + 1] < 200 && d[i + 2] < 90) return true;
    }
    return false;
  }));

  /* The pivot is a world point, so it is wherever the arm's top end is: both
   * came through the same screen point and the same snapping. */
  const PIVOT = pairs((await frames())[0].p[1])[0];

  /* ---- the whole point --------------------------------------------------- */
  console.log('\nTHE SHOULDER STAYS AND THE HAND SWINGS');
  const handBefore = pairs((await frames())[0].p[1])[1];
  const r0 = Math.hypot(handBefore[0] - PIVOT[0], handBefore[1] - PIVOT[1]);
  await p.click('#tRotR'); await p.waitForTimeout(200);
  {
    const arm = pairs((await frames())[0].p[1]);
    ok('the shoulder does not move at all',
      Math.hypot(arm[0][0] - PIVOT[0], arm[0][1] - PIVOT[1]) < 0.004,
      PIVOT.join(',') + ' → ' + arm[0].join(','));
    ok('the hand does move', Math.hypot(arm[1][0] - handBefore[0], arm[1][1] - handBefore[1]) > 0.02,
      handBefore.join(',') + ' → ' + arm[1].join(','));
    /* THE BARGAIN, stated as a number. On the grid a turn cannot keep the arm
     * exactly as long, because the end has to come down on a ruling — the
     * length moves by up to one square and that was the deal asked for: "even
     * if this would make them a bit longer". What must NOT happen is a drift
     * bigger than the grid, which would be the arm growing rather than
     * rounding. At GRID off it is exact, and that is checked further down. */
    const STEP = 0.05;                            // the tool's default grid
    const r1 = Math.hypot(arm[1][0] - PIVOT[0], arm[1][1] - PIVOT[1]);
    ok('the arm keeps its length to within one grid square — it turned, it did not stretch',
      Math.abs(r1 - r0) <= STEP, r0.toFixed(4) + ' → ' + r1.toFixed(4));
    ok('and both its ends are on the grid, which is the whole point',
      arm.every(q => q.every(v => Math.abs(v / STEP - Math.round(v / STEP)) < 0.02)),
      JSON.stringify(arm));
    const a0 = Math.atan2(handBefore[1] - PIVOT[1], handBefore[0] - PIVOT[0]);
    const a1 = Math.atan2(arm[1][1] - PIVOT[1], arm[1][0] - PIVOT[0]);
    /* The angle the grid can afford: an end that may land half a square out in
     * either axis, over the arm's own length. */
    const slop = Math.max(1.5, (STEP / r0) * DEG);
    ok('by about fifteen degrees, which is what the button says',
      Math.abs(((a1 - a0) * DEG) - 15) < slop,
      ((a1 - a0) * DEG).toFixed(2) + '° ±' + slop.toFixed(1));
    ok('the body still has not moved', JSON.stringify((await frames())[0].p[0]) === BODY0);
  }

  /* ---- repeating it ------------------------------------------------------ */
  console.log('\nREPEAT — THE SAME SWING, ACROSS NEW FRAMES');
  await p.fill('#tRepeatN', '5');
  await p.click('#tRepeat'); await p.waitForTimeout(500);
  ok('five new frames', (await frameCount()) === 6, (await frameCount()) + ' frames');
  ok('and it says so', /made 5 frames/.test(await status()), await status());
  f = await frames();
  ok('the export is an animation now', f && f.length === 6, f && f.length);
  ok('every frame still has both strokes, in the same order — TWEEN pairs by index',
    f.every(x => x.p.length === 2), f.map(x => x.p.length).join(','));
  ok('the body is byte-identical in all six', f.every(x => JSON.stringify(x.p[0]) === BODY0),
    f.map(x => JSON.stringify(x.p[0]) === BODY0 ? '=' : '≠').join(''));

  const angles = f.map(x => {
    const h = pairs(x.p[1])[1];
    return Math.atan2(h[1] - PIVOT[1], h[0] - PIVOT[0]) * DEG;
  });
  const radii = f.map(x => {
    const h = pairs(x.p[1])[1];
    return Math.hypot(h[0] - PIVOT[0], h[1] - PIVOT[1]);
  });
  const steps = angles.slice(1).map((a, i) => a - angles[i]);
  const SLOP = Math.max(1.5, (0.05 / radii[0]) * DEG);
  /* Every step forward, none of them backward, and no step wildly out. The
   * grid rounds each frame independently, so the individual steps vary by up
   * to a square's worth of angle — but a step that came out NEGATIVE would be
   * the arm jerking back, which is the thing that would actually be seen. */
  ok('the arm advances every frame, none of them backwards',
    steps.every(s => s > 0), steps.map(s => s.toFixed(1)).join(', '));
  ok('and each step is about fifteen degrees, within what the grid can afford',
    steps.every(s => Math.abs(s - 15) < SLOP),
    steps.map(s => s.toFixed(1)).join(', ') + '  ±' + SLOP.toFixed(1));
  ok('over the whole run it is exactly five steps of fifteen, so nothing drifts',
    Math.abs((angles[angles.length - 1] - angles[0]) - 75) < SLOP,
    (angles[angles.length - 1] - angles[0]).toFixed(1) + '° over 5 frames');
  ok('and the arm keeps its length to within a square all the way round',
    radii.every(r => Math.abs(r - radii[0]) <= 0.05),
    radii.map(r => r.toFixed(3)).join(', '));
  ok('every frame of it is on the grid',
    f.every(x => x.p.every(run => run.every(v => Math.abs(v / 0.05 - Math.round(v / 0.05)) < 0.02))),
    f.map(x => x.p[1].join(',')).join(' | '));
  ok('every shoulder is still on the pivot',
    f.every(x => {
      const s = pairs(x.p[1])[0];
      return Math.hypot(s[0] - PIVOT[0], s[1] - PIVOT[1]) < 0.004;
    }), f.map(x => pairs(x.p[1])[0].join(',')).join(' | '));

  console.log('\nAND IT IS ONE UNDO');
  await p.click('#bUndo'); await p.waitForTimeout(300);
  ok('the five frames go together', (await frameCount()) === 1, (await frameCount()) + ' frames');
  await p.click('#bRedo'); await p.waitForTimeout(300);
  ok('and come back together', (await frameCount()) === 6, (await frameCount()) + ' frames');

  console.log('\nA DRAG IS A MOVEMENT TOO');
  /* Not only the buttons: a limb pushed across by hand is the commonest way to
   * say what the movement is, and REPEAT has to be able to carry it on. */
  await p.click('#bUndo'); await p.waitForTimeout(300);
  await p.click('#tPivot'); await p.waitForTimeout(150);
  ok('the pivot can be cleared', (await pivotLabel()).trim() === 'PIVOT', await pivotLabel());
  ok('and it says turns go round the middle again', /round the middle/.test(await status()),
    await status());

  const armPre = pairs((await frames())[0].p[1]);
  // grab the arm by its middle — in world, then converted — and push it right
  const grab = [(armPre[0][0] + armPre[1][0]) / 2, (armPre[0][1] + armPre[1][1]) / 2];
  await drag(sx(grab[0]), sy(grab[1]), sx(grab[0] + 0.2), sy(grab[1]));
  const armPost = pairs((await frames())[0].p[1]);
  const dx = armPost[0][0] - armPre[0][0];
  ok('dragging the selection moves it', Math.abs(dx) > 0.02, 'dx ' + dx.toFixed(3));
  ok('the hint knows it was a move', /moved further/.test(await repHint()), await repHint());
  await p.fill('#tRepeatN', '3');
  await p.click('#tRepeat'); await p.waitForTimeout(400);
  ok('three more frames', (await frameCount()) === 4, (await frameCount()) + ' frames');
  f = await frames();
  const xs = f.map(x => pairs(x.p[1])[0][0]);
  const dxs = xs.slice(1).map((v, i) => v - xs[i]);
  ok('each one a step further along, all the same step',
    dxs.every(v => Math.abs(v - dx) < 0.01), dxs.map(v => v.toFixed(3)).join(', '));
  ok('and the body stayed where the body was',
    f.every(x => JSON.stringify(x.p[0]) === BODY0),
    f.map(x => JSON.stringify(x.p[0]) === BODY0 ? '=' : '≠').join(''));

  console.log('\nTHE PIVOT BELONGS TO ONE DRAWING');
  /* A shoulder is a point in a picture. Carried into the next tab it would sit
   * in the middle of nothing, and a REPEAT there would build frames out of a
   * movement made in a drawing you are no longer looking at. */
  await p.click('#tPivot'); await p.waitForTimeout(120);
  await tap(0.35, 0.35);
  ok('a pivot is set in the first drawing', /PIVOT ✕/.test(await pivotLabel()), await pivotLabel());
  await p.click('#tabAdd'); await p.waitForTimeout(600);
  await p.click('#mSel'); await p.waitForTimeout(150);
  ok('the new drawing has no pivot', (await pivotLabel()).trim() === 'PIVOT', await pivotLabel());
  ok('and nothing to repeat', /each one step further/.test(await repHint()), await repHint());
  await p.click('#tRepeat'); await p.waitForTimeout(200);
  ok('REPEAT there does not build frames out of the other drawing\'s movement',
    (await frameCount()) === 1, (await frameCount()) + ' frames');
  await p.click('#tabBar .tab:nth-child(1)'); await p.waitForTimeout(600);
  ok('and the first drawing is still four frames', (await frameCount()) === 4,
    (await frameCount()) + ' frames');

  /* ==================================================================
   * A TURNED LINE STAYS ON THE GRID
   * ==================================================================
   * The report: turned lines "get loose and you still have to redraw it". The
   * grid held the pen and nothing else, so a rotation left its ends a few
   * thousandths off the ruling they started on — near enough to look right,
   * far enough that a new line snapped to the grid missed it.
   *
   * The assertion is the one that matters in practice: after a turn, a point
   * is an exact multiple of the step, which is the same test a freshly drawn
   * point passes. The length changing is expected and is the price.
   * ================================================================== */
  console.log('\nA TURNED LINE IS STILL ON THE GRID');
  const onGrid = (v, g) => Math.abs(v / g - Math.round(v / g)) < 0.02;
  /* A DRAWING OF ITS OWN for each of these, because they are about the state
   * the tool is carrying — which grid, what REPEAT is armed with, which
   * strokes are selected — and a block that inherits the last one's state
   * tests something other than what it says. Two of these read green against
   * the wrong stroke before they were separated: DUPLICATE leaves the COPY
   * selected, so the transform after it moved a stroke the assertion was not
   * looking at. */
  async function fresh(step, x0, y0, x1, y1) {
    await p.click('#tabAdd'); await p.waitForTimeout(600);
    await p.click(`.gstep[data-step="${step}"]`); await p.waitForTimeout(140);
    await p.click('#mLine'); await p.waitForTimeout(80);
    await drag(x0, y0, x1, y1);
    await p.click('#mSel'); await p.waitForTimeout(120);
    await drag(0.10, 0.10, 0.92, 0.92);         // everything
  }
  for (const step of ['0.1', '0.05', '0.02']) {
    await p.click('#tabAdd'); await p.waitForTimeout(600);
    await p.click(`.gstep[data-step="${step}"]`); await p.waitForTimeout(120);
    await p.click('#mLine'); await p.waitForTimeout(80);
    await drag(0.30, 0.30, 0.70, 0.62);         // a diagonal, so a turn changes both axes
    const before = (await frames())[0].p[0];
    ok('drawn on grid ' + step.padEnd(5) + ' it starts on the grid',
      before.every(v => onGrid(v, +step)), before.join(', '));
    await p.click('#mSel'); await p.waitForTimeout(120);
    await drag(0.18, 0.18, 0.85, 0.75);
    await p.click('#tRotR'); await p.waitForTimeout(220);
    const after = (await frames())[0].p[0];
    ok('and after a 15° turn every point is STILL on it',
      after.every(v => onGrid(v, +step)), after.join(', ') + '  ·  ' + (await status()));
    ok('it really did turn — this is not a no-op passing by accident',
      JSON.stringify(after) !== JSON.stringify(before),
      before.join(',') + ' → ' + after.join(','));
    await p.click('#tBig'); await p.waitForTimeout(220);
    const scaled = (await frames())[0].p[0];
    ok('a scale lands on it too', scaled.every(v => onGrid(v, +step)), scaled.join(', '));
    // back to one stroke for the next step
    let n = 0;
    while (await p.$eval('#bUndo', e => !e.disabled) && ++n < 30) {
      await p.click('#bUndo'); await p.waitForTimeout(50);
    }
  }

  console.log('\nA COARSE GRID SAYS SO RATHER THAN FLATTENING YOUR WORK');
  /* The one bad outcome of snapping a turn: a step big enough to be useful is
   * big enough to land every point of a short stroke on the same intersection.
   * Applied blind that destroys the stroke and burns an undo doing it. */
  await fresh('0.2', 0.48, 0.46, 0.55, 0.53);   // barely longer than one square
  const tiny = (await frames())[0].p[0];
  await p.click('#tRotR'); await p.waitForTimeout(250);
  ok('it refuses and names the grid as the reason',
    /grid 0\.2/.test(await status()) && /⚠/.test(await status()), await status());
  ok('and the stroke is untouched',
    JSON.stringify((await frames())[0].p[0]) === JSON.stringify(tiny),
    JSON.stringify((await frames())[0].p[0]));
  await p.click('#tRepeat'); await p.waitForTimeout(220);
  ok('and REPEAT was never armed with a movement that did not happen',
    /REPEAT does that again/.test(await status()) && (await frameCount()) === 1,
    await status());

  console.log('\nREPEAT MAKES NO FRAMES IT WOULD HAVE TO APOLOGISE FOR');
  /* A turn made on a fine grid and then repeated on a coarse one. A frame whose
   * arm the grid has flattened to a dot is worse than a frame never made — the
   * limb just disappears part way through, and there are N frames to undo
   * before you find out why. So the whole run is built and checked first. */
  /* A stroke shorter than half a coarse square, so BOTH its ends settle onto
   * the same intersection. Armed with a drag rather than a turn: a turn of
   * something this small is within a rounding of doing nothing at the fine
   * grid too, and a test that depends on which side of a rounding it falls is
   * a test that fails on a day nothing changed. */
  await fresh('0.02', 0.5000, 0.5000, 0.5075, 0.5075);
  await drag(0.5040, 0.5040, 0.5115, 0.5040);   // push it one fine square right
  ok('the move goes through on a fine grid', !/⚠/.test(await status()), await status());
  const fine = JSON.stringify((await frames())[0].p[0]);
  await p.click('.gstep[data-step="0.2"]'); await p.waitForTimeout(140);
  await p.fill('#tRepeatN', '3');
  await p.click('#tRepeat'); await p.waitForTimeout(400);
  ok('not one frame is made', (await frameCount()) === 1, (await frameCount()) + ' frames');
  ok('and it names the grid as the reason', /grid 0\.2 is too coarse/.test(await status()),
    await status());
  ok('the drawing is exactly as it was', JSON.stringify((await frames())[0].p[0]) === fine,
    JSON.stringify((await frames())[0].p[0]));

  console.log('\nEVERY FRAME REPEAT DOES MAKE IS ON THE GRID');
  await fresh('0.1', 0.32, 0.28, 0.62, 0.58);
  await p.click('#tRotR'); await p.waitForTimeout(220);
  await p.fill('#tRepeatN', '4');
  await p.click('#tRepeat'); await p.waitForTimeout(400);
  ok('four frames', (await frameCount()) === 5, (await frameCount()) + ' frames');
  ok('and every point of every one of them is on the grid',
    (await frames()).every(x => x.p.every(run => run.every(v => onGrid(v, 0.1)))),
    (await frames()).map(x => x.p[0].join(',')).join(' | '));
  ok('with no two frames the same — the swing really advances',
    new Set((await frames()).map(x => JSON.stringify(x.p))).size === 5,
    new Set((await frames()).map(x => JSON.stringify(x.p))).size + ' distinct of 5');

  console.log('\nNUDGE AND DUPLICATE MOVE BY WHOLE SQUARES');
  await fresh('0.1', 0.30, 0.40, 0.62, 0.40);
  {
    const was = (await frames())[0].p[0];
    await p.keyboard.press('ArrowRight'); await p.waitForTimeout(200);
    const now = (await frames())[0].p[0];
    ok('an arrow key moves it exactly one square',
      Math.abs((now[0] - was[0]) - 0.1) < 0.002, (now[0] - was[0]).toFixed(4));
    ok('and it is still on the grid', now.every(v => onGrid(v, 0.1)), now.join(', '));
    await p.keyboard.down('Shift'); await p.keyboard.press('ArrowRight'); await p.keyboard.up('Shift');
    await p.waitForTimeout(200);
    const big = (await frames())[0].p[0];
    ok('shift moves it five — the brighter ruling you can actually see',
      Math.abs((big[0] - now[0]) - 0.5) < 0.002, (big[0] - now[0]).toFixed(4));
    /* DUPLICATE leaves the COPY selected, so the copy is the LAST stroke —
     * reading p[0] here reads the original and passes whatever happened. */
    await p.click('#tDup'); await p.waitForTimeout(220);
    const all = (await frames())[0].p;
    const copy = all[all.length - 1];
    ok('a duplicate lands on the grid as well', copy.every(v => onGrid(v, 0.1)), copy.join(', '));
    ok('one square off the original, not a fraction of one',
      Math.abs((copy[0] - big[0]) - 0.1) < 0.002, (copy[0] - big[0]).toFixed(4));
  }

  console.log('\nOFF THE GRID NOTHING IS ROUNDED');
  /* GRID off has to mean off here too, or loading a piece of the game's art —
   * none of which is on any grid — and turning it would quantise its curves. */
  await fresh('0.1', 0.30, 0.30, 0.70, 0.62);
  await p.click('#bSnap'); await p.waitForTimeout(150);
  ok('the readout says freehand', /FREEHAND/.test(await status()), await status());
  const lenOf = q => { const a = pairs(q); return Math.hypot(a[1][0] - a[0][0], a[1][1] - a[0][1]); };
  const wasLen = lenOf((await frames())[0].p[0]);
  await p.click('#tRotR'); await p.waitForTimeout(250);
  {
    const free = (await frames())[0].p[0];
    ok('a turn with GRID off leaves points where the maths put them',
      free.some(v => !onGrid(v, 0.1)), free.join(', '));
    /* And with nothing rounding it, a turn is exact — the length the grid can
     * only hold to within a square is held to a thousandth here. That is the
     * whole trade, and it is why GRID is the switch rather than a new one. */
    ok('and the length is exact, not merely close',
      Math.abs(lenOf(free) - wasLen) < 0.003,
      wasLen.toFixed(4) + ' → ' + lenOf(free).toFixed(4));
  }
  /* And a MOVE never rounds anything either way, which is what makes it safe
   * on art that was never on a grid — an enemy loaded out of the game, say. */
  await p.click('#bSnap'); await p.waitForTimeout(150);
  {
    const off = (await frames())[0].p[0];
    await p.keyboard.press('ArrowRight'); await p.waitForTimeout(220);
    const moved = (await frames())[0].p[0];
    ok('nudging off-grid art with GRID back on shifts it without straightening it',
      moved.every((v, i) => i % 2 ? Math.abs(v - off[i]) < 1e-6
                                  : Math.abs((v - off[i]) - 0.1) < 0.002),
      off.join(', ') + ' → ' + moved.join(', '));
    ok('so it is still exactly as off-grid as it was — nothing was quantised',
      moved.some(v => !onGrid(v, 0.1)), moved.join(', '));
  }

  console.log('\n' + (errs.length ? 'PAGE ERRORS:\n  ' + errs.join('\n  ') : 'no page errors'));
  if (errs.length) fail += errs.length;
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
