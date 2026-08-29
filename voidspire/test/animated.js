/* =========================================================================
 * VOIDSPIRE — test/animated.js
 * The round trip for an ANIMATED piece of art.
 *
 * Nothing in the game is animated yet: all 49 enemies, all 96 engravings and
 * all 201 card icons are a single { p, e }. The battlefield renderer has
 * always been able to play { fps, frames: [ … ] }, and because nothing ever
 * handed it one, three other places had quietly grown unable to:
 *
 *   - tools/build-assets.js read art.p off an animated block, got undefined,
 *     and dropped the asset entirely — the first sprite we animated would
 *     have vanished from the artist's library with no error to say why
 *   - the artist's asset list pulled a.p / a.e off the record, so even a
 *     surviving reel would have opened as a still and been saved back as one
 *   - artSVG did art.p.forEach and threw, which would have taken out every
 *     screen that shows an engraving or a card icon
 *
 * All three are the same shape of bug: a capability that exists at one end of
 * a pipe and nowhere along it. So this walks the whole pipe with a real
 * animated block and checks it comes out the other side still animated.
 *
 * Usage: node test/animated.js     (served on :8944)
 * ========================================================================= */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  — ' + detail : '')); }
}

// a four-frame block: a bar that grows, so each frame is visibly different
const REEL = {
  fps: 6,
  frames: [0.2, 0.45, 0.7, 0.95].map(h => ({
    p: [[-0.5, 0.6, 0.5, 0.6], [-0.3, 0.6, -0.3, 0.6 - h], [0.3, 0.6, 0.3, 0.6 - h]],
    e: [[0, -0.4]],
  })),
};

(async () => {
  console.log('THE COLLECTOR — tools/build-assets.js');
  {
    // exercise clean()/take() directly on an animated block, without editing
    // any of the game's real art to do it
    const src = fs.readFileSync(path.join(__dirname, '..', 'tools', 'build-assets.js'), 'utf8');
    const body = src.slice(src.indexOf('function cleanFrame'), src.indexOf('var out = []'));
    // eslint-disable-next-line no-new-func
    const clean = Function(body + '\nreturn clean;')();
    const c = clean(REEL);
    ok('an animated block survives cleaning', !!(c && c.frames), JSON.stringify(c || null).slice(0, 80));
    ok('all four frames come through', c && c.frames.length === 4, c && c.frames.length);
    ok('and the frame rate with them', c && c.fps === 6, c && c.fps);
    const still = clean({ p: [[-1, -1, 1, 1]], e: [] });
    ok('a single-frame block is untouched', !!(still && still.p && !still.frames),
      JSON.stringify(still));
    const junk = clean({ fps: 8, frames: [{ p: [[NaN, 0, 1, 1]], e: [] }] });
    ok('a frame that is all NaN is dropped, not emitted', junk === null, JSON.stringify(junk));
  }

  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
  });
  const errs = [];

  console.log('\nTHE ARTIST — tools/artist.html');
  {
    const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
    p.on('pageerror', e => errs.push('artist: ' + e.message));
    p.on('dialog', d => d.accept());
    // push a fake animated asset into the library the page reads, so the list
    // is exercised exactly as it would be with a real animated sprite
    await p.addInitScript(reel => {
      try { localStorage.clear(); } catch (e) {}
      window.__REEL = reel;
    }, REEL);
    await p.goto('http://localhost:8944/tools/artist.html');
    await p.waitForTimeout(500);
    const row = await p.evaluate(() => {
      /* The panels fold by default now, and a folded panel's contents are
       * display:none — so the list is there and unclickable until it opens. */
      const box = [...document.querySelectorAll('.side .box')]
        .find(x => /THE GAME'S ART/.test(x.querySelector('h2').textContent));
      if (box && box.classList.contains('shut')) box.querySelector('h2').onclick();
      window.VS_ASSETS.push(Object.assign(
        { kind: 'enemy', id: 'test_reel', name: 'ZZ Test Reel' }, window.__REEL));
      document.getElementById('aSearch').value = 'ZZ Test Reel';
      document.getElementById('aSearch').dispatchEvent(new Event('input'));
      const r = document.querySelector('#assetList .it');
      return r ? r.textContent : null;
    });
    ok('the list says how many frames an animated asset has', /4 frames/.test(row || ''), row);
    await p.click('#assetList .it');
    await p.waitForTimeout(400);
    const status = await p.textContent('#status');
    ok('loading it gives back all four frames', /frame 1\/4/.test(status), status);
    const out = await p.inputValue('#out');
    ok('and it exports as an animation again', /^art: \{ fps: 6, frames: \[/.test(out),
      out.slice(0, 60));
    let parsed = null;
    try {
      // eslint-disable-next-line no-new-func
      parsed = Function('return (' + out.match(/art:\s*([\s\S]*),\s*$/)[1] + ')')();
    } catch (e) { /* reported below */ }
    ok('the export parses back to four frames', parsed && parsed.frames.length === 4,
      parsed ? parsed.frames.length : 'unparseable');
    /* MIRROR is on by default, so the path counts double — what has to hold is
     * that every frame kept its shape and none of them collapsed to empty. */
    ok('no frame came back empty', parsed && parsed.frames.every(f => f.p.length > 0),
      parsed && parsed.frames.map(f => f.p.length).join(','));
    ok('and the frames still differ from one another',
      parsed && new Set(parsed.frames.map(f => JSON.stringify(f.p))).size === 4,
      parsed && new Set(parsed.frames.map(f => JSON.stringify(f.p))).size + ' distinct');
    await p.close();
  }

  console.log('\nTHE GAME — artSVG, the DOM half of the renderer');
  {
    const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
    p.on('pageerror', e => errs.push('game: ' + e.message));
    await p.goto('http://localhost:8944/voidspire.html?dev=1');
    await p.waitForTimeout(1200);
    /* The densest real user of artSVG is the first-mark screen, which draws
     * the engraving each opening offers. Patch the art of one engraving it is
     * actually about to show, then let the game draw its own screen — no
     * private function is reached into, so what is measured is the real path. */
    const r = await p.evaluate(reel => {
      const E = window.VS.engine, U = window.VS.ui;
      E.newRun('vanguard');
      const offers = E.firstMarkOffers();
      const id = offers[0].eng;
      window.__patched = { id: id, was: window.VS.DIE_AUGMENTS[id].art };
      window.VS.DIE_AUGMENTS[id].art = reel;
      let threw = null;
      try { U.refresh(); } catch (e) { threw = e.message; }
      return { id: id, threw: threw, svgs: document.querySelectorAll('svg.vec').length };
    }, REEL);
    ok('a real screen renders animated art without throwing', !r.threw && r.svgs > 0,
      r.threw || (r.svgs + ' svgs drawn'));

    const svg = await p.evaluate(() => {
      const el = document.querySelector('svg.vec .vec-reel');
      if (!el) return null;
      return {
        frames: el.children.length,
        n: el.style.getPropertyValue('--vec-n'),
        anim: el.style.animation,
        shifts: [...el.children].map(g => g.getAttribute('transform')),
        moves: getComputedStyle(el).animationName,
        dur: getComputedStyle(el).animationDuration,
      };
    });
    ok('it emits one group per frame', svg && svg.frames === 4, JSON.stringify(svg));
    ok('laid out side by side, one frame-width apart',
      svg && svg.shifts.join('|') === 'translate(0,0)|translate(24,0)|translate(48,0)|translate(72,0)',
      svg && svg.shifts.join('|'));
    ok('stepped once per frame over 4/6 of a second',
      svg && /steps\(4\)/.test(svg.anim) && /^0\.66/.test(svg.dur),
      svg && (svg.anim + ' · computed ' + svg.dur));
    ok('and the animation is actually running', svg && svg.moves === 'vec-reel', svg && svg.moves);
    ok('the frame count reaches the CSS as --vec-n', svg && svg.n === '4', svg && svg.n);

    // put the engraving back, then confirm ordinary art draws no reel at all
    await p.evaluate(() => {
      window.VS.DIE_AUGMENTS[window.__patched.id].art = window.__patched.was;
      window.VS.ui.refresh();
    });
    await p.waitForTimeout(200);

    // single-frame art must be exactly what it was
    const plain = await p.evaluate(() => ({
      svgs: document.querySelectorAll('svg.vec').length,
      reels: document.querySelectorAll('svg.vec .vec-reel').length,
      polylines: document.querySelectorAll('svg.vec > polyline').length,
    }));
    ok('ordinary art draws no reel at all',
      plain.svgs > 0 && plain.reels === 0 && plain.polylines > 0, JSON.stringify(plain));
    await p.close();
  }

  console.log('\n' + (errs.length ? 'PAGE ERRORS:\n  ' + errs.join('\n  ') : 'no page errors'));
  if (errs.length) fail += errs.length;
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
