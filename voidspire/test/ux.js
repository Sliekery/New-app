/* =========================================================================
 * VOIDSPIRE — test/ux.js
 * The layout budget, kept honest.
 *
 * These are not style opinions, they are numbers that were measured before
 * and after a rework, against what the drawing tools everyone else uses
 * actually do:
 *
 *   - HOW MUCH OF THE SCREEN IS THE DRAWING. It was 21% on a desktop and 19%
 *     on a laptop. Procreate gives the canvas essentially the whole display
 *     and hides the rest behind gestures; Photoshop with its default panels
 *     out is around 60%. A tool that spends four fifths of the screen on its
 *     own chrome is a control panel that happens to have a canvas.
 *   - HOW BIG THE CONTROLS ARE. WCAG 2.2 makes 24x24 CSS pixels a Level AA
 *     requirement (SC 2.5.8). 27 of the 50 visible controls were under it.
 *   - HOW MUCH THERE IS TO READ. 854 characters of explanation on screen at
 *     once, which is Corel Painter's oldest complaint almost word for word —
 *     "busy", "chaotic", stuck in the settings before you can start.
 *
 * Every one of these regresses silently. A panel added later, a bar that
 * grows a row, a font bumped a point: none of it errors, and the canvas just
 * quietly gets smaller again.
 *
 * Usage: node test/ux.js     (tools served on :8944)
 * ========================================================================= */
const { chromium } = require('playwright-core');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  — ' + detail : '')); }
}

const MEASURE = () => {
  const seen = el => {
    const c = getComputedStyle(el);
    if (c.display === 'none' || c.visibility === 'hidden') return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && r.top < innerHeight && r.bottom > 0;
  };
  const pad = document.getElementById('pad').getBoundingClientRect();
  const hits = [...document.querySelectorAll('button,label.btn,.swatch')].filter(seen);
  const small = hits.filter(e => {
    const r = e.getBoundingClientRect();
    return Math.min(r.width, r.height) < 24;
  }).map(e => (e.id || e.textContent || e.className).trim().slice(0, 16));
  const prose = [...document.querySelectorAll('.hint,p')].filter(seen)
    .reduce((a, e) => a + (e.innerText || '').trim().length, 0);
  return {
    side: Math.round(pad.width),
    pct: Math.round(pad.width * pad.height / (innerWidth * innerHeight) * 100),
    controls: hits.length,
    small: small,
    prose: prose,
  };
};

(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox'],
  });
  const errs = [];

  for (const [name, w, h, minPct] of [['desktop', 1500, 950, 33], ['laptop', 1280, 720, 24]]) {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    p.on('pageerror', e => errs.push(name + ': ' + e.message));
    await p.goto('http://localhost:8944/tools/artist.html');
    await p.evaluate(() => { try { localStorage.clear(); } catch (e) {} });
    await p.reload();
    await p.waitForTimeout(900);

    console.log('\n' + name.toUpperCase() + ' ' + w + 'x' + h);
    const m = await p.evaluate(MEASURE);
    ok('the drawing gets at least ' + minPct + '% of the screen', m.pct >= minPct,
      m.side + 'px, ' + m.pct + '% (was 21% on desktop, 19% on a laptop)');
    ok('every control clears the 24px WCAG floor', m.small.length === 0,
      m.small.length + ' under: ' + m.small.join(', '));
    ok('there is less than half a screen of prose', m.prose < 560,
      m.prose + ' characters (was 854)');

    if (name === 'desktop') {
      console.log('\nHIDING THINGS MAKES THE DRAWING BIGGER');
      const base = (await p.evaluate(MEASURE)).side;
      await p.keyboard.press('Shift+Tab'); await p.waitForTimeout(500);
      const focus = await p.evaluate(MEASURE);
      ok('focus grows the canvas', focus.side > base + 60, base + ' → ' + focus.side);
      ok('and hides the rail and the panels', await p.evaluate(() =>
        getComputedStyle(document.querySelector('.rail')).display === 'none'
        && getComputedStyle(document.querySelector('.side')).display === 'none'));
      ok('but never hides the way back out', await p.isVisible('#vFocus'));
      await p.reload(); await p.waitForTimeout(900);
      ok('and the view is remembered across a reload',
        (await p.evaluate(MEASURE)).side === focus.side,
        focus.side + ' → ' + (await p.evaluate(MEASURE)).side);
      await p.keyboard.press('Shift+Tab'); await p.waitForTimeout(500);
      ok('shift-tab comes back out', (await p.evaluate(MEASURE)).side === base,
        base + ' vs ' + (await p.evaluate(MEASURE)).side);

      console.log('\nPANELS FOLD, AND STAY FOLDED');
      const shutCount = () => p.$$eval('.side .box', bs => bs.filter(x => x.classList.contains('shut')).length);
      const open0 = await shutCount();
      ok('most panels start folded', open0 >= 3, open0 + ' of 6 shut');
      ok('but layers and the live preview do not', await p.evaluate(() => {
        const want = [...document.querySelectorAll('.side .box')].filter(x =>
          /LAYERS|LIVE PREVIEW/.test(x.querySelector('h2').textContent));
        return want.length === 2 && want.every(x => !x.classList.contains('shut'));
      }));
      ok('the button that opens the big view is reachable without hunting',
        await p.isVisible('#pvBig'));
      await p.click('.side .box h2');
      await p.waitForTimeout(200);
      ok('a heading folds its panel', (await shutCount()) !== open0,
        open0 + ' → ' + (await shutCount()));
      const after = await shutCount();
      await p.reload(); await p.waitForTimeout(900);
      ok('and it is still folded next time', (await shutCount()) === after,
        after + ' → ' + (await shutCount()));

      console.log('\nTHE ANIMATION CONTROLS STAY OUT OF THE WAY OF A STILL DRAWING');
      const tucked = () => p.$eval('.framestrip', e => e.classList.contains('tucked'));
      ok('one frame tucks the strip', await tucked());
      ok('but + FRAME and DUPLICATE stay — that is how an animation starts',
        (await p.isVisible('#fAdd')) && (await p.isVisible('#fDup')));
      ok('and TWEEN, ONION and the fps slider do not clutter a still',
        !(await p.isVisible('#fTween')) && !(await p.isVisible('#bOnion')));
      const withStrip = (await p.evaluate(MEASURE)).side;
      await p.click('#fDup'); await p.waitForTimeout(500);
      ok('a second frame brings the whole strip back', !(await tucked()));
      ok('and everything in it', await p.isVisible('#fTween'));
      ok('which costs the canvas some height, as it should',
        (await p.evaluate(MEASURE)).side < withStrip,
        withStrip + ' → ' + (await p.evaluate(MEASURE)).side);

      console.log('\nONE THING IS THE LOUDEST');
      /* The tool you are holding has to win over the switches that are merely
       * on. Five filled green buttons at once and none of them reads as the
       * answer to "what happens when I touch the canvas". */
      const filled = await p.$$eval('.rail button.on', bs => bs.filter(x => {
        // only what is actually on screen: the shape rack lives in the rail
        // too and keeps its selection marked while the tool is put away
        const r = x.getBoundingClientRect();
        if (!r.width || !r.height) return false;
        const bg = getComputedStyle(x).backgroundColor;
        const m = bg.match(/[\d.]+/g);
        return m && m.length > 3 && parseFloat(m[3]) > 0.1 && !/^rgba?\(10, ?1[0-9]/.test(bg);
      }).map(x => x.id));
      ok('exactly one button in the rail is filled, and it is the tool',
        filled.length === 1 && /^m/.test(filled[0]), filled.join(',') || 'none');
    }
    await p.close();
  }

  console.log('\n' + (errs.length ? 'PAGE ERRORS:\n  ' + errs.join('\n  ') : 'no page errors'));
  if (errs.length) fail += errs.length;
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
