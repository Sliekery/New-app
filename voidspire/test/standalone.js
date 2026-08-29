/* =========================================================================
 * VOIDSPIRE — test/standalone.js
 * The gift version: tools/linework.html.
 *
 * It is opened from FILE:// here, not from a server, because that is how it
 * will actually be used — an attachment, a download, a file on a desktop.
 * Half of what can go wrong with a "single file" only goes wrong there: a
 * script that 404s silently, a fetch that is blocked, a stylesheet that was
 * never inlined. The page carries on looking almost right in every case.
 *
 * Then it draws something and saves it, because the whole point of the
 * standalone is that SAVE SVG produces a file somebody else can open.
 *
 * Usage: node test/standalone.js
 * ========================================================================= */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const os = require('os');

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  — ' + detail : '')); }
}

(async () => {
  const FILE = path.resolve(__dirname, '..', 'tools', 'linework.html');
  ok('the build produced a file', fs.existsSync(FILE));
  const html = fs.readFileSync(FILE, 'utf8');

  console.log('IT IS ACTUALLY ONE FILE');
  ok('nothing is loaded from beside it',
    !/<(?:script|link|img)[^>]+(?:src|href)="(?!data:|https?:|#)[^"]+"/.test(html));
  ok('the game\'s asset pack is not in it', !/VS_ASSETS\s*=/.test(html));
  ok('and it is a sane size', html.length > 60000 && html.length < 400000,
    Math.round(html.length / 1024) + ' KB');

  /* A copy on its own, in an empty directory. If anything is still expected
   * to sit beside it, it will be missing here and only here. */
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'linework-'));
  const lone = path.join(dir, 'linework.html');
  fs.copyFileSync(FILE, lone);

  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox'],
  });
  const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
  const errs = [], missing = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  p.on('requestfailed', r => missing.push(r.url()));
  p.on('dialog', d => d.accept());
  await p.goto('file://' + lone);
  await p.waitForTimeout(700);

  console.log('\nOPENED FROM A FOLDER, NOT A SERVER');
  ok('nothing failed to load', missing.length === 0, missing.join(', '));
  ok('no page errors', errs.length === 0, errs.join(' | '));
  ok('it does not call itself Voidspire', !/VOIDSPIRE/i.test(await p.title()), await p.title());
  ok('the canvas is there', !!(await p.$('#pad')));
  ok('so are all nine tools', (await p.$$('#railShapes .shp, .shp')).length >= 9);

  console.log('\nTHE PARTS THAT ONLY MEAN SOMETHING INSIDE THE PROJECT ARE GONE');
  const vis = sel => p.evaluate(s => {
    const e = document.querySelector(s);
    return e ? getComputedStyle(e).display !== 'none' : null;
  }, sel);
  const gameBox = await p.evaluate(() => {
    const hs = [...document.querySelectorAll('.box h2')];
    const h = hs.find(x => /THE GAME'S ART/.test(x.textContent));
    return h ? getComputedStyle(h.closest('.box')).display : 'absent';
  });
  ok('the game art browser is hidden', gameBox === 'none' || gameBox === 'absent', gameBox);
  ok('HAND OFF is hidden', (await vis('#vsHandoff')) === false, String(await vis('#vsHandoff')));
  ok('BACKUP ALL is kept — it is generally useful', (await vis('#vsBackup')) !== false);
  /* innerText, not textContent: textContent includes the source of every
   * <script> on the page, so this was reading the tool's own code and calling
   * it an instruction. What matters is what a reader actually sees. */
  const body = await p.evaluate(() => document.body.innerText);
  ok('no js/enemies.js in what you can read', !/js\/enemies\.js|js\/cardart\.js/.test(body),
    (body.match(/js\/\w+\.js/g) || []).join(', '));
  ok('the export panel offers the formats a stranger needs',
    /EXPORT/.test(body) && /ANIMATED GIF/.test(body) && /SVG/.test(body), 
    (body.match(/ANIMATED GIF|VIDEO|SPRITE SHEET|SVG/g) || []).join(', '));

  console.log('\nDRAW SOMETHING');
  const box = await p.locator('#pad').boundingBox();
  const at = (fx, fy) => [box.x + box.width * fx, box.y + box.height * fy];
  async function drag(a, bb, c, d) {
    const [x0, y0] = at(a, bb), [x1, y1] = at(c, d);
    await p.mouse.move(x0, y0); await p.mouse.down();
    await p.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 4 });
    await p.mouse.move(x1, y1, { steps: 4 });
    await p.mouse.up(); await p.waitForTimeout(90);
  }
  await p.click('#mShape'); await p.waitForTimeout(80);
  await drag(0.28, 0.28, 0.72, 0.72);
  const out = await p.inputValue('#out');
  ok('the box fills in', out.length > 20, out.slice(0, 40));
  ok('and no longer says "art:" — that was for the game', !/^art:/.test(out.trim()),
    out.slice(0, 30));
  ok('it still parses as the drawing', (() => {
    try { return !!Function('return (' + out + ')')().p; } catch (e) { return false; }
  })(), out.slice(0, 60));

  console.log('\nSAVE SVG');
  /* Through the tool's own export panel now, not a pair of buttons this build
   * used to bolt on with a second copy of an SVG writer behind them. */
  await p.$eval('#xName', el => { el.value = 'drawing'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  /* Collected from the event stream: the sprite sheet saves two files, and two
   * waitForEvent calls made before one click both resolve on the same event. */
  const inbox = [];
  p.on('download', async dl => {
    const to = path.join(dir, dl.suggestedFilename());
    await dl.saveAs(to);
    inbox.push({ name: dl.suggestedFilename(), path: to,
                 size: fs.statSync(to).size, data: fs.readFileSync(to) });
  });
  async function grab(fmt) {
    inbox.length = 0;
    await p.click(`#xFormat button[data-x="${fmt}"]`);
    await p.waitForTimeout(120);
    await p.click('#xGo');
    const want = fmt === 'sheet' ? 2 : 1;
    const until = Date.now() + 15000;
    while (inbox.length < want && Date.now() < until) await p.waitForTimeout(120);
    if (!inbox.length) throw new Error(fmt + ': nothing came down');
    return want === 1 ? inbox[0] : inbox.slice();
  }
  const svg = await grab('svg');
  ok('a .svg comes down', /\.svg$/.test(svg.name), svg.name);
  const svgText = fs.readFileSync(svg.path, 'utf8');
  ok('it is a real svg document', /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(svgText));
  ok('with the drawing in it', (svgText.match(/<polyline/g) || []).length > 0,
    (svgText.match(/<polyline/g) || []).length + ' polylines');
  ok('and it is black line art, not a screenshot of a dark theme',
    /color="#111"/.test(svgText) && !/#05090b/.test(svgText));

  // the real test of an SVG is whether a browser will render it
  {
    const v = await b.newPage();
    const shown = [];
    v.on('pageerror', e => shown.push('ERR ' + e.message));
    await v.goto('file://' + svg.path);
    await v.waitForTimeout(300);
    const drew = await v.evaluate(() => {
      const s = document.querySelector('svg');
      if (!s) return null;
      const bb = s.getBBox();
      return { polys: s.querySelectorAll('polyline').length, w: bb.width, h: bb.height };
    });
    ok('a browser opens it and it has visible extent',
      drew && drew.polys > 0 && drew.w > 0.1 && drew.h > 0.1,
      JSON.stringify(drew) + shown.join(''));
    await v.close();
  }

  console.log('\nSAVE PNG');
  const png = await grab('png');
  ok('a .png comes down', /\.png$/.test(png.name), png.name);
  const bytes = fs.readFileSync(png.path);
  ok('it is a real png', bytes.slice(1, 4).toString() === 'PNG', bytes.slice(0, 8).toString('hex'));
  ok('and it is not an empty one', png.size > 3000, png.size + ' bytes');

  console.log('\nAN ANIMATION SAVES AS ONE FILE THAT PLAYS');
  await p.click('#fDup'); await p.waitForTimeout(200);
  await p.click('#mLine'); await p.waitForTimeout(60);
  await drag(0.2, 0.5, 0.8, 0.5);                 // make frame 2 different
  await p.click('#fDup'); await p.waitForTimeout(200);
  const status = await p.textContent('#status');
  ok('there are three frames now', /\/3/.test(status), status);
  const asvg = await grab('svg');
  const atext = fs.readFileSync(asvg.path, 'utf8');
  ok('the animation is a reel of three',
    /class="reel"/.test(atext) && (atext.match(/<g transform/g) || []).length === 3,
    (atext.match(/<g transform/g) || []).length + ' frame groups, reel: ' + /class="reel"/.test(atext));
  ok('stepped once per frame', /steps\(3\)/.test(atext), (atext.match(/steps\(\d+\)/) || [])[0]);
  ok('and it respects prefers-reduced-motion', /prefers-reduced-motion/.test(atext));
  {
    const v = await b.newPage();
    await v.goto('file://' + asvg.path);
    await v.waitForTimeout(200);
    const anim = await v.evaluate(() => {
      const g = document.querySelector('.reel');
      return g ? { name: getComputedStyle(g).animationName, dur: getComputedStyle(g).animationDuration } : null;
    });
    ok('a browser actually runs the animation', anim && anim.name === 'reel',
      JSON.stringify(anim));
    await v.close();
  }
  /* PNG is one still now and the strip is its own format, which is the right
   * split: a person wants a picture, an engine wants a sheet. */
  const sheet = await grab('sheet');
  const strip = Array.isArray(sheet) ? sheet[0] : sheet;
  ok('and the sprite sheet is a strip, three cells wide',
    strip.data.readUInt32BE(16) > strip.data.readUInt32BE(20) * 2,
    strip.data.readUInt32BE(16) + 'x' + strip.data.readUInt32BE(20));

  console.log('\nIT SURVIVES BEING CLOSED AND REOPENED');
  await p.goto('file://' + lone);
  await p.waitForTimeout(700);
  /* Not the status line: on a reload it carries "restored your last drawing"
   * rather than the frame count. The frame strip is the thing that has to
   * come back, so count that. */
  const backFrames = await p.$$eval('#frameList > *', els => els.length);
  ok('the drawing comes back', backFrames === 3, backFrames + ' frames after reload');
  ok('and it says so', /restored/.test(await p.textContent('#status')),
    await p.textContent('#status'));

  console.log('\n' + (errs.length ? 'PAGE ERRORS:\n  ' + errs.join('\n  ') : 'no page errors'));
  if (errs.length) fail += errs.length;
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  fs.rmSync(dir, { recursive: true, force: true });
  process.exit(fail ? 1 : 0);
})();
