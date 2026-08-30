/* =========================================================================
 * VOIDSPIRE — test/rig.js
 * Making a limb swing without redrawing it.
 *
 * The complaint this exists for: "when animating we are removing some lines
 * and redrawing them in a different position — I wanna make the arms go up
 * and down." And then, of the first answer: "the pivot occurs automatically
 * where the selected lines and the first non-selected lines meet. This way
 * they are still connected and nothing gets deformed. Then the user can just
 * hold the selected bunch of lines to go up and down."
 *
 * Which is the whole design:
 *
 *   THE JOINT IS FOUND, NOT PLACED. Select the arm and the places it touches
 *   the body are where it is held. There is nothing to choose.
 *   IT IS NOT ONE POINT. A leg is an outline and BOTH its top ends touch the
 *   body. Every contact is a PIN and simply does not move.
 *   HOLD IT AND SWING IT. Dragging turns everything that is not pinned, and
 *   the lines running from a pin into the limb change length to bridge — so
 *   the limb stays attached at all of its joints at once.
 *   REPEAT walks that swing out over as many frames as you ask for, holding
 *   the same pins in every one.
 *
 * What is asserted is the GEOMETRY, not the buttons. Three signatures no
 * amount of "it looked right" can stand in for: every pin is EXACTLY where it
 * was, the parts of the limb that touch nothing keep their exact size, and the
 * strokes you did not select are byte-identical. And a generated frame has to
 * keep the stroke ORDER, because TWEEN pairs strokes by index — a limb deleted
 * and redrawn goes to the end of the list, which is what makes a hand-redrawn
 * animation tween into a body melting through an arm.
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
  const selBar = () => p.textContent('#selCount');
  const pivotLabel = () => p.textContent('#tPivot');
  const swingLabel = async () => (await p.textContent('#tSwing')).trim();
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
  const cur = async () => (await frames())[0];
  const armOf = async () => pairs((await cur()).p[1]);
  const bodyOf = async () => JSON.stringify((await cur()).p[0]);
  const dist = (a, c) => Math.hypot(a[0] - c[0], a[1] - c[1]);

  /* MEASURED AGAIN BEFORE EVERY GESTURE. The pad is resized to whatever is left
   * over, and the frame strip grows the moment a drawing has more than one
   * frame — so REPEAT changes the canvas's size and position, and a box
   * measured at the top of the file is wrong from then on. Every screen
   * fraction in this suite was silently landing somewhere else after the first
   * REPEAT, which read as a pivot being placed off the end of the arm.
   *
   * A fraction of the pad maps to the same WORLD point whatever size the pad
   * is — rawWorld divides by the box's own width — so sx/sy below stay valid;
   * it is only fraction-to-pixel that has to be redone. */
  let box = await p.locator('#pad').boundingBox();
  const remeasure = async () => { box = await p.locator('#pad').boundingBox(); };
  const at = (fx, fy) => [box.x + box.width * fx, box.y + box.height * fy];
  async function drag(a0, b0, c, d) {
    await remeasure();
    const [x0, y0] = at(a0, b0), [x1, y1] = at(c, d);
    await p.mouse.move(x0, y0); await p.mouse.down();
    await p.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 4 });
    await p.mouse.move(x1, y1, { steps: 4 });
    await p.mouse.up(); await p.waitForTimeout(150);
  }
  async function tap(fx, fy) {
    await remeasure();
    const [x, y] = at(fx, fy);
    await p.mouse.move(x, y); await p.mouse.down(); await p.mouse.up();
    await p.waitForTimeout(140);
  }
  /* Back to the drawing AS DRAWN — not all the way back, which undoes the two
   * strokes as well and leaves every later block asserting against an empty
   * canvas. Undo until the art matches what was drawn, then stop. */
  let ART0 = null;
  const rewind = async () => {
    let n = 0;
    while (++n < 40) {
      if (JSON.stringify((await cur()).p) === ART0) return true;
      if (!(await p.$eval('#bUndo', e => !e.disabled))) return false;
      await p.click('#bUndo'); await p.waitForTimeout(60);
    }
    return false;
  };
  // the middle of everything selected, which is what a turn without a joint uses
  const midOf = async idx => {
    const q = (await cur()).p.filter((_, i) => idx.indexOf(i) >= 0)
      .reduce((a, r) => a.concat(pairs(r)), []);
    const xs = q.map(v => v[0]), ys = q.map(v => v[1]);
    return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  };

  /* MIRROR off: it doubles every path, and what is being measured here is
   * which strokes moved and which did not. */
  await p.click('#bMirror'); await p.waitForTimeout(120);

  /* ---- a body and an arm that MEETS it ---------------------------------- */
  console.log('A BODY AND AN ARM THAT MEETS IT');
  /* The arm runs down ONTO the body's line, not to a corner of it. That is how
   * a limb is actually drawn and it is why the joint has to be found by
   * measuring a point against a SEGMENT: the place they meet is part way along
   * the body and there is no point of the body's own anywhere near it. */
  const ARM_TOP = [0.60, 0.25], ARM_FOOT = [0.60, 0.80];
  await p.click('#mLine'); await p.waitForTimeout(80);
  await drag(0.20, 0.80, 0.85, 0.80);                 // stroke 0 — the body
  await drag(ARM_TOP[0], ARM_TOP[1], ARM_FOOT[0], ARM_FOOT[1]);  // stroke 1 — the arm
  let f = await frames();
  ok('two strokes, drawn in that order', f && f.length === 1 && f[0].p.length === 2,
    f && f[0].p.length + ' strokes in ' + f.length + ' frame');
  const BODY0 = JSON.stringify(f[0].p[0]);
  const ARM0 = JSON.stringify(f[0].p[1]);
  ART0 = JSON.stringify(f[0].p);

  /* WORLD BACK TO SCREEN. The pad is not square, and the world is stretched
   * to its aspect — the two axes have different scales — so "the middle of the
   * arm" is not a screen fraction that can be guessed. It can be fitted from
   * what was just drawn, though: points whose screen fraction AND world
   * coordinate are both known. Grabbing the arm by a fraction picked by eye is
   * how the drag in this suite first missed the selection entirely. */
  const body0 = pairs(f[0].p[0]), arm00 = pairs(f[0].p[1]);
  const kx = (0.85 - 0.20) / (body0[1][0] - body0[0][0]);
  const ky = (0.80 - 0.25) / (body0[0][1] - arm00[0][1]);
  const sx = wx => 0.20 + (wx - body0[0][0]) * kx;
  const sy = wy => 0.25 + (wy - arm00[0][1]) * ky;
  // take hold of a stroke part way along it and pull to somewhere else
  async function haul(from, to) { await drag(sx(from[0]), sy(from[1]), sx(to[0]), sy(to[1])); }

  /* ==================================================================
   * THE JOINT FINDS ITSELF
   * ================================================================== */
  console.log('\nTHE JOINT IS FOUND, NOT PLACED');
  await p.click('#mSel'); await p.waitForTimeout(150);
  await drag(0.45, 0.12, 0.78, 0.70);                 // a box round the arm only
  ok('the arm alone is selected', /1 stroke selected/.test(await selBar()), await selBar());
  ok('and the bar says it found the hinge without being asked',
    /held at \d+ points?/.test(await selBar()), await selBar());
  ok('SWING is lit, so a drag will turn it',
    await p.$eval('#tSwing', e => e.classList.contains('on')) && (await swingLabel()) === 'SWING',
    await swingLabel());
  ok('nobody placed a pivot — PIVOT is untouched',
    (await pivotLabel()).trim() === 'PIVOT', await pivotLabel());
  ok('a crosshair is drawn for it', await p.evaluate(() => {
    const c = document.getElementById('pad'), g = c.getContext('2d');
    const d = g.getImageData(0, 0, c.width, c.height).data;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] > 200 && d[i + 1] > 130 && d[i + 1] < 200 && d[i + 2] < 90) return true;
    }
    return false;
  }));

  /* Before anything has been done, so REPEAT genuinely has nothing armed —
   * run after a swing it is armed with that swing and refuses nothing. */
  console.log('\nREPEAT SAYS WHAT IT NEEDS');
  await p.click('#selNone'); await p.waitForTimeout(150);
  await p.click('#tRepeat'); await p.waitForTimeout(180);
  ok('with nothing selected it asks for a selection, and makes no frames',
    /select the part that moves/.test(await status()) && (await frameCount()) === 1,
    await status());
  ok('and says so as a warning, not as news', /⚠/.test(await status()), await status());
  await drag(0.45, 0.12, 0.78, 0.70);
  await p.click('#tRepeat'); await p.waitForTimeout(180);
  ok('with nothing done yet it asks you to do it once',
    /REPEAT does that again/.test(await status()) && (await frameCount()) === 1,
    await status());
  ok('and the hint has not promised anything yet',
    /each one step further/.test(await repHint()), await repHint());

  /* ==================================================================
   * HOLD IT AND SWING IT
   * ================================================================== */
  console.log('\nHOLD THE ARM AND IT SWINGS ROUND THAT JOINT');
  {
    const before = await armOf();
    const foot = before[1], hand = before[0];        // foot on the body, hand free
    const rWas = dist(hand, foot);
    const grip = [(hand[0] + foot[0]) / 2, (hand[1] + foot[1]) / 2];
    await haul(grip, [grip[0] + 0.35, grip[1] + 0.10]);
    const after = await armOf();
    ok('the attached end has not moved AT ALL — it is still joined on',
      dist(after[1], foot) < 0.002, foot.join(',') + ' → ' + after[1].join(','));
    ok('the free end swung', dist(after[0], hand) > 0.05,
      hand.join(',') + ' → ' + after[0].join(','));
    ok('and the arm is exactly as long as it was — rigid, nothing deformed',
      Math.abs(dist(after[0], foot) - rWas) < 0.003,
      rWas.toFixed(4) + ' → ' + dist(after[0], foot).toFixed(4));
    ok('the body was not touched', (await bodyOf()) === BODY0);
    ok('it says how far it swung', /swung -?\d+° round the joint/.test(await status()),
      await status());
    ok('and REPEAT is armed with that swing', /turned further/.test(await repHint()),
      await repHint());
  }

  console.log('\nUP AND DOWN, WHICH IS THE WHOLE ASK');
  /* Three hauls in a row, the arm ending each one wherever the last left it.
   * The point is that it never drifts off the shoulder and never stretches —
   * the thing that made redrawing it by hand necessary. */
  {
    const foot = (await armOf())[1];
    const rWas = dist((await armOf())[0], foot);
    for (const [dx, dy] of [[-0.5, -0.2], [0.3, 0.4], [-0.2, -0.3]]) {
      const arm = await armOf();
      const grip = [(arm[0][0] + arm[1][0]) / 2, (arm[0][1] + arm[1][1]) / 2];
      await haul(grip, [grip[0] + dx, grip[1] + dy]);
    }
    const arm = await armOf();
    ok('after three swings the shoulder is still exactly the shoulder',
      dist(arm[1], foot) < 0.002, foot.join(',') + ' → ' + arm[1].join(','));
    ok('and the arm has not grown or shrunk a thousandth',
      Math.abs(dist(arm[0], foot) - rWas) < 0.003,
      rWas.toFixed(4) + ' → ' + dist(arm[0], foot).toFixed(4));
    ok('the body is still byte-identical after all of it', (await bodyOf()) === BODY0);
  }

  console.log('\nA SWING PAST THE FAR SIDE DOES NOT GO THE LONG WAY ROUND');
  /* atan2 comes back in (-π, π], so measuring the whole swing against where the
   * drag STARTED reads one that has crossed the far side of the joint as an
   * enormous turn the other way. A gentle drag upward reported −275°, and
   * REPEAT would then have walked the arm backwards through the body five
   * times. The angle is unwrapped a step at a time instead. */
  {
    await rewind();
    await drag(0.45, 0.12, 0.78, 0.70);
    const foot = (await armOf())[1], hand = (await armOf())[0];
    const grip = [(hand[0] + foot[0]) / 2, (hand[1] + foot[1]) / 2];
    // up and across, which takes the grip round past the joint's far side
    await haul(grip, [grip[0] - 0.55, grip[1] - 0.30]);
    const said = (await status()).match(/swung (-?\d+)°/);
    ok('it reports a swing a person could have made, not a wild one',
      said && Math.abs(+said[1]) <= 180, said ? said[1] + '°' : await status());
    const after = await armOf();
    ok('and the arm still hangs off the same shoulder',
      dist(after[1], foot) < 0.002, foot.join(',') + ' → ' + after[1].join(','));
    ok('with its length untouched',
      Math.abs(dist(after[0], foot) - dist(hand, foot)) < 0.003,
      dist(hand, foot).toFixed(4) + ' → ' + dist(after[0], foot).toFixed(4));
    await rewind();
    await drag(0.45, 0.12, 0.78, 0.70);
  }

  console.log('\nMOVE IS THERE FOR WHEN YOU WANT TO SLIDE IT');
  {
    const before = await armOf();
    await p.click('#tSwing'); await p.waitForTimeout(160);
    ok('the button says MOVE', (await swingLabel()) === 'MOVE', await swingLabel());
    ok('and the bar agrees', /drag to slide it/.test(await selBar()), await selBar());
    const grip = [(before[0][0] + before[1][0]) / 2, (before[0][1] + before[1][1]) / 2];
    await haul(grip, [grip[0] + 0.3, grip[1]]);
    const after = await armOf();
    ok('both ends move by the same amount — it slid, it did not turn',
      Math.abs((after[0][0] - before[0][0]) - (after[1][0] - before[1][0])) < 0.002
      && Math.abs(after[0][0] - before[0][0]) > 0.05,
      JSON.stringify(before) + ' → ' + JSON.stringify(after));
    await p.click('#bUndo'); await p.waitForTimeout(200);
    await p.click('#tSwing'); await p.waitForTimeout(160);
    ok('and it goes back to SWING', (await swingLabel()) === 'SWING', await swingLabel());
  }

  console.log('\nHELD AT TWO POINTS, AND BOTH OF THEM HOLD');
  /* THE CASE THIS WAS REBUILT FOR. A leg is not butted onto a hip at one spot:
   * it is an outline, and BOTH its top ends touch the body. Turned rigidly
   * about anything, both of them move — it comes away on one side and drives
   * into the body on the other. Averaging them first is worse: the average is
   * in clear space between the two, welded to nothing.
   *
   * So every contact is a PIN and simply does not move; everything else turns;
   * and the lines running from a pin into the limb change length to bridge.
   * "This way they stay connected, the shape stays the same, they don't get
   * lose or overlap." */
  {
    await p.click('#tabAdd'); await p.waitForTimeout(600);
    await p.click('#mLine'); await p.waitForTimeout(80);
    const Wf = v => (v / 1.35 + 1) / 2;
    const wdrag = (a1, c1, d1, e1) => drag(Wf(a1), Wf(c1), Wf(d1), Wf(e1));
    await wdrag(-0.8, 0.0, 0.8, 0.0);            // 0 the hips — not selected
    await wdrag(-0.3, 0.0, -0.3, 0.7);           // 1 leg, outer edge
    await wdrag(0.1, 0.0, 0.1, 0.7);             // 2 leg, inner edge
    await wdrag(-0.3, 0.7, 0.1, 0.7);            // 3 the foot, touching nothing
    await p.click('#mSel'); await p.waitForTimeout(150);
    await wdrag(-0.5, -0.02, 0.35, 0.9);         // the leg, not the hips
    ok('the leg is selected', /3 strokes selected/.test(await selBar()), await selBar());
    ok('and the bar says it is held at two points',
      /held at 2 points/.test(await selBar()), await selBar());

    const was = (await cur()).p;
    const HIP_A = [-0.3, 0], HIP_B = [0.1, 0];
    const footWas = dist(pairs(was[3])[0], pairs(was[3])[1]);
    await wdrag(-0.1, 0.55, 0.55, 0.35);         // swing the foot across
    const now = (await cur()).p;

    ok('the outer edge is still welded to the hip, exactly',
      dist(pairs(now[1])[0], HIP_A) < 0.002, pairs(now[1])[0].join(','));
    ok('and so is the inner edge — BOTH points hold, not an average of them',
      dist(pairs(now[2])[0], HIP_B) < 0.002, pairs(now[2])[0].join(','));
    ok('the hips themselves never moved', JSON.stringify(now[0]) === JSON.stringify(was[0]),
      JSON.stringify(now[0]));
    ok('the leg really did swing', dist(pairs(now[1])[1], pairs(was[1])[1]) > 0.1,
      pairs(was[1])[1].join(',') + ' → ' + pairs(now[1])[1].join(','));

    /* The two claims that make it usable: the part of the limb that touches
     * nothing keeps its shape exactly, and the lines that reach the pins are
     * the only ones that change length. */
    ok('the foot — which touches nothing — keeps its exact length',
      Math.abs(dist(pairs(now[3])[0], pairs(now[3])[1]) - footWas) < 0.003,
      footWas.toFixed(4) + ' → ' + dist(pairs(now[3])[0], pairs(now[3])[1]).toFixed(4));
    ok('the foot stayed joined to both edges of the leg',
      dist(pairs(now[3])[0], pairs(now[1])[1]) < 0.002
      && dist(pairs(now[3])[1], pairs(now[2])[1]) < 0.002,
      JSON.stringify(pairs(now[3])) + ' vs ' + pairs(now[1])[1] + ' / ' + pairs(now[2])[1]);
    const eA = dist(pairs(now[1])[0], pairs(now[1])[1]);
    const eB = dist(pairs(now[2])[0], pairs(now[2])[1]);
    ok('and the two edges changed length to bridge — one longer, one shorter',
      (eA - 0.7) * (eB - 0.7) < 0 && Math.abs(eA - 0.7) > 0.02 && Math.abs(eB - 0.7) > 0.02,
      '0.700 → ' + eA.toFixed(3) + ' and ' + eB.toFixed(3));

    ok('a marker is drawn on each pin, and none between them', await p.evaluate(() => {
      const c = document.getElementById('pad'), g = c.getContext('2d');
      const d = g.getImageData(0, 0, c.width, c.height).data;
      const cols = [];
      for (let y = 0; y < c.height; y++) for (let x = 0; x < c.width; x++) {
        const i = (y * c.width + x) * 4;
        if (d[i] > 200 && d[i + 1] > 130 && d[i + 1] < 200 && d[i + 2] < 90) cols.push(x);
      }
      if (!cols.length) return false;
      // two clumps of amber, and a clear gap in the middle where the average was
      cols.sort((u, v) => u - v);
      let gaps = 0;
      for (let i = 1; i < cols.length; i++) if (cols[i] - cols[i - 1] > 20) gaps++;
      return gaps === 1;
    }));
    await p.click('#bUndo'); await p.waitForTimeout(200);
  }

  console.log('\nREPEAT HOLDS THE SAME PINS IN EVERY FRAME');
  {
    const Wf = v => (v / 1.35 + 1) / 2;
    const wdrag = (a1, c1, d1, e1) => drag(Wf(a1), Wf(c1), Wf(d1), Wf(e1));
    await wdrag(-0.1, 0.55, 0.35, 0.45);         // a gentler swing to repeat
    await p.fill('#tRepeatN', '4');
    await p.click('#tRepeat'); await p.waitForTimeout(450);
    ok('four frames', (await frameCount()) === 5, (await frameCount()) + ' frames');
    const fs = await frames();
    ok('every frame still has the leg welded at both hips',
      fs.every(x => dist(pairs(x.p[1])[0], [-0.3, 0]) < 0.003
                 && dist(pairs(x.p[2])[0], [0.1, 0]) < 0.003),
      fs.map(x => pairs(x.p[1])[0].join(',') + '/' + pairs(x.p[2])[0].join(',')).join(' | '));
    ok('and the foot keeps its length in every one of them',
      fs.every(x => Math.abs(dist(pairs(x.p[3])[0], pairs(x.p[3])[1]) - 0.4) < 0.004),
      fs.map(x => dist(pairs(x.p[3])[0], pairs(x.p[3])[1]).toFixed(3)).join(', '));
    ok('the hips are byte-identical throughout',
      new Set(fs.map(x => JSON.stringify(x.p[0]))).size === 1,
      fs.map(x => JSON.stringify(x.p[0])).join(' | '));
    await p.click('#bUndo'); await p.waitForTimeout(300);
  }

  console.log('\nA WHOLE EDGE OF CONTACT IS HELD ALONG ITS LENGTH');
  {
    await p.click('#tabAdd'); await p.waitForTimeout(600);
    await p.click('#mLine'); await p.waitForTimeout(80);
    const Wf = v => (v / 1.35 + 1) / 2;
    const wdrag = (a1, c1, d1, e1) => drag(Wf(a1), Wf(c1), Wf(d1), Wf(e1));
    /* The body edge runs well past the slab on both sides, so a marquee can
     * take the slab and leave the edge out. It cannot be excluded by height:
     * the marquee snaps to the grid too, so a box that stops a hair above y=0
     * rounds down onto it and swallows the edge. */
    await wdrag(-1.2, 0.0, 1.2, 0.0);            // a long body edge
    await wdrag(-0.4, 0.0, 0.4, 0.0);            // a slab sitting on it
    await wdrag(-0.4, 0.0, -0.4, -0.4);
    await wdrag(0.4, 0.0, 0.4, -0.4);
    await wdrag(-0.4, -0.4, 0.4, -0.4);
    await p.click('#mSel'); await p.waitForTimeout(150);
    await wdrag(-0.7, -0.6, 0.7, 0.2);           // the slab, not the long edge
    ok('the slab is selected and the edge is not',
      /4 strokes selected/.test(await selBar()), await selBar());
    ok('its whole base is held — four points in one place',
      /held at 4 points/.test(await selBar()) && !/in \d+ places/.test(await selBar()),
      await selBar());
    const was = (await cur()).p;
    await wdrag(0.0, -0.3, 0.35, -0.2);
    const now = (await cur()).p;
    ok('the base has not moved at all', JSON.stringify(now[1]) === JSON.stringify(was[1]),
      JSON.stringify(was[1]) + ' → ' + JSON.stringify(now[1]));
    ok('the top has', JSON.stringify(now[4]) !== JSON.stringify(was[4]),
      JSON.stringify(was[4]) + ' → ' + JSON.stringify(now[4]));
    ok('the top is still the same width — it turned, it did not stretch',
      Math.abs(dist(pairs(now[4])[0], pairs(now[4])[1])
             - dist(pairs(was[4])[0], pairs(was[4])[1])) < 0.003,
      dist(pairs(now[4])[0], pairs(now[4])[1]).toFixed(4));
    ok('and the sides still reach from the base to the top',
      dist(pairs(now[2])[0], pairs(now[1])[0]) < 0.002
      && dist(pairs(now[3])[0], pairs(now[1])[1]) < 0.002,
      'sides still meet the base');
  }

  /* Back to the body-and-arm drawing these two blocks borrowed a tab from —
   * everything below assumes it. */
  await p.click('#tabBar .tab:nth-child(1)'); await p.waitForTimeout(600);
  await p.click('#mSel'); await p.waitForTimeout(150);
  ok('back in the first drawing', (await bodyOf()) === BODY0, await bodyOf());

  console.log('\nSTRETCHING ONE LINE, AND WHAT COMES WITH IT');
  /* "Select a single line and make it longer or shorter by dragging. If
   *  another thing is attached it will move together with it, because it will
   *  still just be attached. For example an antenna with a block at the end —
   *  when you make the antenna shorter the block stays attached and moves
   *  down."
   *
   * The whole claim is that the BLOCK arrives somewhere else with its shape
   * untouched. Moving only the points that happen to touch the tip would pull
   * one corner and leave the other three, which is a torn box. */
  {
    await p.click('#tabAdd'); await p.waitForTimeout(600);
    await p.click('#mLine'); await p.waitForTimeout(80);
    const Wf = v => (v / 1.35 + 1) / 2;
    const wdrag = (a1, c1, d1, e1) => drag(Wf(a1), Wf(c1), Wf(d1), Wf(e1));
    await wdrag(-0.4, 0.4, 0.4, 0.4);            // 0 the head
    await wdrag(0.0, 0.4, 0.0, -0.5);            // 1 THE ANTENNA, tip at (0,-0.5)
    await wdrag(-0.15, -0.5, 0.15, -0.5);        // 2 block, bottom
    await wdrag(-0.15, -0.5, -0.15, -0.8);       // 3 block, left
    await wdrag(0.15, -0.5, 0.15, -0.8);         // 4 block, right
    await wdrag(-0.15, -0.8, 0.15, -0.8);        // 5 block, top
    await p.click('#mSel'); await p.waitForTimeout(150);
    // a thin box round the antenna only, clear of the head's ends and the block
    await wdrag(-0.06, -0.45, 0.06, 0.45);
    ok('the antenna alone is selected', /1 stroke selected/.test(await selBar()), await selBar());
    ok('the bar offers the ends', /drag an end . to make it longer or shorter/.test(await selBar()),
      await selBar());
    ok('and says a swing has nothing to move — it is joined at both ends',
      /held at every point/.test(await selBar()), await selBar());
    ok('so SWING is not lit', await p.$eval('#tSwing', e => !e.classList.contains('on')),
      await swingLabel());

    const was = (await cur()).p;
    const blockWas = was.slice(2).map(r => r.slice());
    ok('the antenna starts 0.9 long',
      Math.abs(dist(pairs(was[1])[0], pairs(was[1])[1]) - 0.9) < 0.002,
      dist(pairs(was[1])[0], pairs(was[1])[1]).toFixed(3));

    // take hold of the TIP and pull it back up towards the head
    await wdrag(0.0, -0.5, 0.0, -0.15);
    const now = (await cur()).p;
    ok('it says what came along', /4 strokes attached to that end came along/.test(await status()),
      await status());
    ok('the antenna is shorter',
      Math.abs(dist(pairs(now[1])[0], pairs(now[1])[1]) - 0.55) < 0.003,
      dist(pairs(now[1])[0], pairs(now[1])[1]).toFixed(3));
    ok('its base never moved — only the end you took hold of',
      dist(pairs(now[1])[0], pairs(was[1])[0]) < 0.002,
      pairs(was[1])[0].join(',') + ' → ' + pairs(now[1])[0].join(','));
    ok('the head it grows out of is byte-identical',
      JSON.stringify(now[0]) === JSON.stringify(was[0]), JSON.stringify(now[0]));

    /* The block: every one of its four strokes moved by the SAME amount, so it
     * is the same block in a different place rather than a distorted one. */
    const shifts = now.slice(2).map((r, i) => pairs(r).map((q, j) =>
      [q[0] - pairs(blockWas[i])[j][0], q[1] - pairs(blockWas[i])[j][1]]))
      .reduce((a, r) => a.concat(r), []);
    ok('the whole block moved by one and the same amount',
      shifts.every(d => Math.abs(d[0] - shifts[0][0]) < 0.002
                     && Math.abs(d[1] - shifts[0][1]) < 0.002),
      shifts.map(d => d.map(v => v.toFixed(2)).join(',')).join(' | '));
    ok('and that amount is exactly how far the tip moved',
      Math.abs(shifts[0][1] - 0.35) < 0.003 && Math.abs(shifts[0][0]) < 0.002,
      shifts[0].map(v => v.toFixed(3)).join(', '));
    ok('so it is still sitting on the tip',
      Math.abs(pairs(now[2])[0][1] - pairs(now[1])[1][1]) < 0.002,
      'block base y ' + pairs(now[2])[0][1] + ' vs tip y ' + pairs(now[1])[1][1]);
    ok('the block kept its exact size',
      Math.abs(dist(pairs(now[2])[0], pairs(now[2])[1])
             - dist(pairs(blockWas[0])[0], pairs(blockWas[0])[1])) < 0.002,
      dist(pairs(now[2])[0], pairs(now[2])[1]).toFixed(3));

    console.log('\n  REPEAT WALKS A STRETCH OUT TOO');
    /* A SMALLER step to repeat. Three more of the 0.35 above would take the tip
     * straight through the base and out the other side — which is REPEAT doing
     * exactly what it says, and not something to assert a steady shortening
     * against. */
    await p.click('#bUndo'); await p.waitForTimeout(250);
    await wdrag(0.0, -0.5, 0.0, -0.35);
    await p.fill('#tRepeatN', '3');
    ok('the hint knows it was a stretch', /stretched further/.test(await repHint()),
      await repHint());
    await p.click('#tRepeat'); await p.waitForTimeout(450);
    ok('three frames', (await frameCount()) === 4, (await frameCount()) + ' frames');
    const fs = await frames();
    const lens = fs.map(x => dist(pairs(x.p[1])[0], pairs(x.p[1])[1]));
    ok('the antenna shortens by the same step every frame',
      lens.slice(1).every((v, i) => Math.abs((lens[i] - v) - 0.15) < 0.004),
      lens.map(v => v.toFixed(3)).join(', '));
    ok('and the block rides the tip down in every one of them',
      fs.every(x => Math.abs(pairs(x.p[2])[0][1] - pairs(x.p[1])[1][1]) < 0.003),
      fs.map(x => pairs(x.p[2])[0][1] + '/' + pairs(x.p[1])[1][1]).join(' | '));
    ok('the head never moves',
      new Set(fs.map(x => JSON.stringify(x.p[0]))).size === 1,
      fs.map(x => JSON.stringify(x.p[0])).join(' | '));
    await p.click('#bUndo'); await p.waitForTimeout(300);
  }

  console.log('\nA LINE IN A RING CARRIES NOTHING');
  /* The guard that stops this eating the drawing. A leg's outer edge reaches
   * the foot, the inner edge, the hip and then the whole figure — pulling its
   * end would drag everything rather than stretch anything. */
  {
    await p.click('#tabAdd'); await p.waitForTimeout(600);
    await p.click('#mLine'); await p.waitForTimeout(80);
    const Wf = v => (v / 1.35 + 1) / 2;
    const wdrag = (a1, c1, d1, e1) => drag(Wf(a1), Wf(c1), Wf(d1), Wf(e1));
    /* The rails overhang the uprights, so the uprights meet them part way along
     * rather than at a shared corner — which is the only way a marquee can take
     * ONE side of a closed ring. Every corner of a plain box belongs to two
     * strokes at the same coordinate, so a box round one of them takes both. */
    await wdrag(-0.4, 0.0, 0.4, 0.0);            // 0 top rail
    await wdrag(-0.3, 0.0, -0.3, 0.6);           // 1 left upright
    await wdrag(0.3, 0.0, 0.3, 0.6);             // 2 right upright
    await wdrag(-0.4, 0.6, 0.4, 0.6);            // 3 bottom rail
    await p.click('#mSel'); await p.waitForTimeout(150);
    await wdrag(-0.35, -0.1, -0.25, 0.7);        // the left upright alone
    ok('one side of the box is selected', /1 stroke selected/.test(await selBar()), await selBar());
    const was = (await cur()).p;
    await wdrag(-0.3, 0.6, -0.3, 0.35);          // pull its bottom end up
    ok('it says nothing came along, and why',
      /loops back round/.test(await status()), await status());
    const now = (await cur()).p;
    ok('the side really did shorten',
      Math.abs(dist(pairs(now[1])[0], pairs(now[1])[1]) - 0.35) < 0.004,
      dist(pairs(now[1])[0], pairs(now[1])[1]).toFixed(3));
    ok('and the rest of the box did NOT get dragged along with it',
      JSON.stringify(now[0]) === JSON.stringify(was[0])
      && JSON.stringify(now[2]) === JSON.stringify(was[2])
      && JSON.stringify(now[3]) === JSON.stringify(was[3]),
      'top/right/bottom unchanged');
    await p.click('#tabBar .tab:nth-child(1)'); await p.waitForTimeout(600);
    await p.click('#mSel'); await p.waitForTimeout(150);
    ok('back in the first drawing again', (await bodyOf()) === BODY0, await bodyOf());
  }

  console.log('\nA SELECTION THAT TOUCHES NOTHING HAS NO JOINT');
  /* Select everything and there is no "rest of the drawing" left to hinge
   * against, so it must say so rather than inventing a hinge — and a drag has
   * to fall back to sliding instead of spinning the whole picture. */
  {
    await drag(0.03, 0.03, 0.97, 0.97);
    ok('both strokes are selected', /2 strokes selected/.test(await selBar()), await selBar());
    ok('it says there is nothing to hinge against',
      /touching nothing, so drag slides it/.test(await selBar()), await selBar());
    ok('and SWING is not lit', await p.$eval('#tSwing', e => !e.classList.contains('on')),
      await swingLabel());
    const before = await armOf();
    const grip = [(before[0][0] + before[1][0]) / 2, (before[0][1] + before[1][1]) / 2];
    await haul(grip, [grip[0] + 0.2, grip[1]]);
    const after = await armOf();
    ok('a drag slides it rather than spinning the whole drawing',
      Math.abs((after[0][0] - before[0][0]) - (after[1][0] - before[1][0])) < 0.002,
      JSON.stringify(before) + ' → ' + JSON.stringify(after));
    await p.click('#bUndo'); await p.waitForTimeout(250);
  }

  console.log('\nWITH NOTHING TO HINGE ON, A TURN GOES ROUND THE MIDDLE');
  {
    const before = await armOf();
    /* The middle of EVERYTHING selected, not of the arm — a turn with no joint
     * goes round the selection's own box, and both strokes are in it. */
    const mid = await midOf([0, 1]);
    const rWas = [...pairs((await cur()).p[0]), ...before].map(q => dist(q, mid));
    await p.click('#tRotR'); await p.waitForTimeout(220);
    const after = await armOf();
    /* The fixed point is the middle of the selection AS IT WAS — every point
     * keeps its distance from there. Not "the new middle equals the old one":
     * a rotated shape has a different bounding box, so its centre moves even
     * though the rotation is perfectly about the old one. Within a grid square,
     * because with no joint the result is settled onto the grid. */
    const rNow = [...pairs((await cur()).p[0]), ...after].map(q => dist(q, mid));
    ok('every point keeps its distance from the middle it turned about',
      rNow.every((r, i) => Math.abs(r - rWas[i]) <= 0.05),
      rWas.map(r => r.toFixed(3)).join(',') + ' → ' + rNow.map(r => r.toFixed(3)).join(','));
    ok('and BOTH ends move — which is the thing that is wrong for a limb',
      dist(after[0], before[0]) > 0.02 && dist(after[1], before[1]) > 0.02,
      JSON.stringify(before) + ' → ' + JSON.stringify(after));
    await p.click('#bUndo'); await p.waitForTimeout(220);
  }

  /* ---- back to the drawing as drawn -------------------------------------- */
  ok('undo gives back the drawing exactly as it was drawn', await rewind(),
    JSON.stringify((await cur()).p));

  /* ==================================================================
   * REPEAT
   * ================================================================== */
  console.log('\nREPEAT WALKS THE SWING OUT OVER FRAMES');
  /* The arm ALONE again — the block before this one selected everything, and a
   * selection with nothing outside it has no joint, so a haul would slide the
   * whole drawing and REPEAT would faithfully walk that slide out over five
   * frames. Which is exactly what it did before this line was here. */
  await drag(0.45, 0.12, 0.78, 0.70);
  ok('the arm alone, hinged again', /held at \d+ points?/.test(await selBar()),
    await selBar());
  const JOINT = (await armOf())[1];
  {
    const hand0 = (await armOf())[0];
    const r0 = dist(hand0, JOINT);
    const grip = [(hand0[0] + JOINT[0]) / 2, (hand0[1] + JOINT[1]) / 2];
    await haul(grip, [grip[0] + 0.30, grip[1] + 0.10]);
    const swung = (await armOf())[0];
    const oneStep = Math.atan2(swung[1] - JOINT[1], swung[0] - JOINT[0])
                  - Math.atan2(hand0[1] - JOINT[1], hand0[0] - JOINT[0]);

    await p.fill('#tRepeatN', '5');
    await p.click('#tRepeat'); await p.waitForTimeout(500);
    ok('five new frames', (await frameCount()) === 6, (await frameCount()) + ' frames');
    ok('and it says so', /made 5 frames/.test(await status()), await status());
    ok('with no warning — a swing has nothing for the grid to swallow',
      !/⚠/.test(await status()), await status());

    f = await frames();
    ok('the export is an animation now', f && f.length === 6, f && f.length);
    ok('every frame still has both strokes, in the same order — TWEEN pairs by index',
      f.every(x => x.p.length === 2), f.map(x => x.p.length).join(','));
    ok('the body is byte-identical in all six', f.every(x => JSON.stringify(x.p[0]) === BODY0),
      f.map(x => JSON.stringify(x.p[0]) === BODY0 ? '=' : '≠').join(''));
    ok('and the shoulder is on the joint in every one of them',
      f.every(x => dist(pairs(x.p[1])[1], JOINT) < 0.003),
      f.map(x => pairs(x.p[1])[1].join(',')).join(' | '));

    const angles = f.map(x => {
      const h = pairs(x.p[1])[0];
      return Math.atan2(h[1] - JOINT[1], h[0] - JOINT[0]);
    });
    const radii = f.map(x => dist(pairs(x.p[1])[0], JOINT));
    const steps = angles.slice(1).map((a, i) => (a - angles[i]) * DEG);
    ok('the arm advances one step per frame, every frame the same step',
      steps.every(s => Math.abs(s - oneStep * DEG) < 0.6),
      steps.map(s => s.toFixed(2)).join(', ') + '  want ' + (oneStep * DEG).toFixed(2));
    ok('none of them backwards', steps.every(s => s / oneStep > 0),
      steps.map(s => s.toFixed(2)).join(', '));
    ok('and it never changes length on the way round — rigid every frame',
      radii.every(r => Math.abs(r - r0) < 0.004), radii.map(r => r.toFixed(4)).join(', '));
  }

  console.log('\nAND IT IS ONE UNDO');
  await p.click('#bUndo'); await p.waitForTimeout(300);
  ok('the five frames go together', (await frameCount()) === 1, (await frameCount()) + ' frames');
  await p.click('#bRedo'); await p.waitForTimeout(300);
  ok('and come back together', (await frameCount()) === 6, (await frameCount()) + ' frames');
  await p.click('#bUndo'); await p.waitForTimeout(300);

  /* ==================================================================
   * PLACING ONE BY HAND STILL OVERRULES IT
   * ================================================================== */
  console.log('\nPIVOT OVERRULES THE JOINT THAT WAS FOUND');
  /* Back to the arm exactly as drawn before tapping ARM_TOP. After five swings
   * the free end is nowhere near where it started, so tapping the old screen
   * point would put the pivot in empty space — and the tap snaps to the grid,
   * which only lands ON the end if the end is still on the grid. */
  await rewind();
  await drag(0.45, 0.12, 0.78, 0.70);
  ok('the arm is back where it was drawn', JSON.stringify((await cur()).p[1]) === ARM0,
    JSON.stringify((await cur()).p[1]));
  ok('the button starts off', (await pivotLabel()).trim() === 'PIVOT', await pivotLabel());
  await p.click('#tPivot'); await p.waitForTimeout(150);
  ok('pressing it asks for the joint', /TAP THE JOINT/.test(await pivotLabel()), await pivotLabel());
  await p.click('#tPivot'); await p.waitForTimeout(150);
  ok('pressing it again backs out without moving anything',
    (await pivotLabel()).trim() === 'PIVOT', await pivotLabel());
  await p.click('#tPivot'); await p.waitForTimeout(150);
  await tap(ARM_TOP[0], ARM_TOP[1]);                  // the FREE end, not the joint
  ok('tapping sets it', /PIVOT ✕/.test(await pivotLabel()), await pivotLabel());
  ok('and it says where', /turns now go round/.test(await status()), await status());
  ok('the selection is still the arm — placing a pivot is not a click on the canvas',
    /1 stroke selected/.test(await selBar()), await selBar());
  ok('the bar now names YOUR pivot rather than the found one',
    /drag to swing it round your pivot/.test(await selBar()), await selBar());
  {
    const before = await armOf();
    const HAND = before[0];
    ok('and the pivot really is the free end, not the shoulder',
      dist(HAND, JOINT) > 0.2, HAND.join(',') + ' vs joint ' + JOINT.join(','));
    await p.click('#tRotR'); await p.waitForTimeout(220);
    const after = await armOf();
    ok('now the free end is what stays still', dist(after[0], HAND) < 0.004,
      HAND.join(',') + ' → ' + after[0].join(','));
    ok('and the shoulder is what swings', dist(after[1], before[1]) > 0.05,
      before[1].join(',') + ' → ' + after[1].join(','));
    ok('by fifteen degrees, which is what the button says',
      Math.abs((Math.atan2(after[1][1] - HAND[1], after[1][0] - HAND[0])
              - Math.atan2(before[1][1] - HAND[1], before[1][0] - HAND[0])) * DEG - 15) < 1,
      'turned');
    ok('and the arm kept its exact length — a pivot means rigid',
      Math.abs(dist(after[1], HAND) - dist(before[1], HAND)) < 0.003,
      dist(before[1], HAND).toFixed(4) + ' → ' + dist(after[1], HAND).toFixed(4));
  }
  await p.click('#tPivot'); await p.waitForTimeout(150);
  ok('clearing it hands the arm back to the joint that was found',
    (await pivotLabel()).trim() === 'PIVOT'
    && /held at \d+ points?/.test(await selBar()), await selBar());
  await rewind();

  console.log('\nTHE JOINT BELONGS TO ONE DRAWING');
  await p.click('#tabAdd'); await p.waitForTimeout(600);
  await p.click('#mSel'); await p.waitForTimeout(150);
  ok('the new drawing has no pivot', (await pivotLabel()).trim() === 'PIVOT', await pivotLabel());
  ok('and nothing to repeat', /each one step further/.test(await repHint()), await repHint());
  await p.click('#tRepeat'); await p.waitForTimeout(200);
  ok('REPEAT there does not build frames out of the other drawing\'s movement',
    (await frameCount()) === 1, (await frameCount()) + ' frames');
  await p.click('#tabBar .tab:nth-child(1)'); await p.waitForTimeout(600);
  ok('and the first drawing is intact', (await bodyOf()) === BODY0, await bodyOf());

  /* ==================================================================
   * THE GRID, FOR THINGS THAT ARE NOT HINGED
   * ==================================================================
   * A turn about a joint is rigid — the joint holds it together and there is
   * nothing for rounding to fix. A free-floating selection has nothing holding
   * it, and that is where the grid earns its place: a shape turned off the
   * ruling it was drawn on will not meet the next line you draw.
   * ================================================================== */
  console.log('\nA FREE SHAPE TURNED ON THE GRID STAYS ON THE GRID');
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
    await drag(0.05, 0.05, 0.95, 0.95);              // the only stroke there is
  }
  for (const step of ['0.1', '0.05', '0.02']) {
    await fresh(step, 0.30, 0.30, 0.70, 0.62);
    ok('a lone stroke has nothing to hinge on',
      /touching nothing/.test(await selBar()), await selBar());
    const before = (await cur()).p[0];
    ok('drawn on grid ' + step.padEnd(5) + ' it starts on the grid',
      before.every(v => onGrid(v, +step)), before.join(', '));
    await p.click('#tRotR'); await p.waitForTimeout(220);
    const after = (await cur()).p[0];
    ok('and after a 15° turn every point is STILL on it',
      after.every(v => onGrid(v, +step)), after.join(', ') + '  ·  ' + (await status()));
    ok('it really did turn — this is not a no-op passing by accident',
      JSON.stringify(after) !== JSON.stringify(before),
      before.join(',') + ' → ' + after.join(','));
    await p.click('#tBig'); await p.waitForTimeout(220);
    ok('a scale lands on it too', (await cur()).p[0].every(v => onGrid(v, +step)),
      (await cur()).p[0].join(', '));
  }

  console.log('\nA COARSE GRID SAYS SO RATHER THAN FLATTENING YOUR WORK');
  /* The one bad outcome of settling a turn: a step big enough to be useful is
   * big enough to land every point of a short stroke on the same intersection.
   * Applied blind that destroys the stroke and burns an undo doing it. */
  await fresh('0.2', 0.48, 0.46, 0.55, 0.53);
  const tiny = JSON.stringify((await cur()).p[0]);
  await p.click('#tRotR'); await p.waitForTimeout(250);
  ok('it refuses and names the grid as the reason',
    /grid 0\.2/.test(await status()) && /⚠/.test(await status()), await status());
  ok('and the stroke is untouched', JSON.stringify((await cur()).p[0]) === tiny,
    JSON.stringify((await cur()).p[0]));
  await p.click('#tRepeat'); await p.waitForTimeout(220);
  ok('and REPEAT was never armed with a movement that did not happen',
    /REPEAT does that again/.test(await status()) && (await frameCount()) === 1,
    await status());

  console.log('\nREPEAT MAKES NO FRAMES IT WOULD HAVE TO APOLOGISE FOR');
  /* A stroke shorter than half a coarse square, so BOTH its ends settle onto
   * the same intersection. Armed with a drag rather than a turn: a turn of
   * something this small is within a rounding of doing nothing at the fine
   * grid too, and a test that depends on which side of a rounding it falls is
   * a test that fails on a day nothing changed. */
  /* TWO strokes, not one. A single selected stroke puts a grab on each of its
   * ends, and something small enough to flatten on a coarse grid is small
   * enough that its middle is within grabbing distance of both — so the drag
   * that was arming a MOVE here started stretching instead, and a stretch has
   * nothing for the grid to swallow. Two strokes means no handles. */
  await p.click('#tabAdd'); await p.waitForTimeout(600);
  await p.click('.gstep[data-step="0.02"]'); await p.waitForTimeout(140);
  await p.click('#mLine'); await p.waitForTimeout(80);
  /* Far enough apart that the point magnet does not weld them into one — it
   * pulls a new point onto any endpoint within 0.05, and two strokes drawn a
   * finer step apart than that simply became one. */
  await drag(0.48519, 0.47037, 0.48519, 0.52963);
  await drag(0.51481, 0.47037, 0.51481, 0.52963);
  await p.click('#mSel'); await p.waitForTimeout(120);
  await drag(0.4500, 0.4400, 0.5500, 0.5600);
  ok('both tiny strokes are selected', /2 strokes selected/.test(await selBar()), await selBar());
  await drag(0.5000, 0.5000, 0.50741, 0.5000);      // push them one fine square right
  ok('the move goes through on a fine grid', !/⚠/.test(await status()), await status());
  const fine = JSON.stringify((await cur()).p);
  await p.click('.gstep[data-step="0.2"]'); await p.waitForTimeout(140);
  await p.fill('#tRepeatN', '2');
  await p.click('#tRepeat'); await p.waitForTimeout(400);
  ok('not one frame is made', (await frameCount()) === 1, (await frameCount()) + ' frames');
  ok('and it names the grid as the reason', /grid 0\.2 is too coarse/.test(await status()),
    await status());
  ok('the drawing is exactly as it was', JSON.stringify((await cur()).p) === fine,
    JSON.stringify((await cur()).p));

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
    const was = (await cur()).p[0];
    await p.keyboard.press('ArrowRight'); await p.waitForTimeout(200);
    const now = (await cur()).p[0];
    ok('an arrow key moves it exactly one square',
      Math.abs((now[0] - was[0]) - 0.1) < 0.002, (now[0] - was[0]).toFixed(4));
    ok('and it is still on the grid', now.every(v => onGrid(v, 0.1)), now.join(', '));
    await p.keyboard.down('Shift'); await p.keyboard.press('ArrowRight'); await p.keyboard.up('Shift');
    await p.waitForTimeout(200);
    const big = (await cur()).p[0];
    ok('shift moves it five — the brighter ruling you can actually see',
      Math.abs((big[0] - now[0]) - 0.5) < 0.002, (big[0] - now[0]).toFixed(4));
    /* DUPLICATE leaves the COPY selected, so the copy is the LAST stroke —
     * reading p[0] here reads the original and passes whatever happened. */
    await p.click('#tDup'); await p.waitForTimeout(220);
    const all = (await cur()).p;
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
  const lenOf = q => { const a = pairs(q); return dist(a[0], a[1]); };
  const wasLen = lenOf((await cur()).p[0]);
  await p.click('#tRotR'); await p.waitForTimeout(250);
  {
    const free = (await cur()).p[0];
    ok('a turn with GRID off leaves points where the maths put them',
      free.some(v => !onGrid(v, 0.1)), free.join(', '));
    ok('and the length is exact, not merely close',
      Math.abs(lenOf(free) - wasLen) < 0.003,
      wasLen.toFixed(4) + ' → ' + lenOf(free).toFixed(4));
  }
  /* And a MOVE never rounds anything either way, which is what makes it safe
   * on art that was never on a grid — an enemy loaded out of the game, say. */
  await p.click('#bSnap'); await p.waitForTimeout(150);
  {
    const off = (await cur()).p[0];
    await p.keyboard.press('ArrowRight'); await p.waitForTimeout(220);
    const moved = (await cur()).p[0];
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
