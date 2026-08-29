/* =========================================================================
 * VOIDSPIRE — test/sampler.js
 * Drives the RECORD tab's sample editor through a real browser.
 *
 * The editor is destructive and lives entirely inside a closure, so there is
 * nothing to unit-test from the outside. What there IS, is a status line and
 * a selection readout that between them state the buffer's length, the
 * selection, and what the last command did — so this drives the actual
 * buttons and reads those back, which is also the only way to catch the class
 * of bug that has bitten this tool twice already: a handler that updates the
 * model and leaves the canvas and the export stale.
 *
 * A synthetic WAV goes in through LOAD FILE rather than the microphone, so
 * the test is deterministic and also covers the import path.
 *
 * Usage: node test/sampler.js     (with the tools served on :8944)
 * ========================================================================= */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');

const OUT = '/tmp/vs-sampler-test.wav';

/* A second of something with structure: a decaying tone, a gap, then a burst.
 * The gap is there so the noise gate has something to close on, and the burst
 * so a trim has an obvious landmark. */
function makeWav(file) {
  const rate = 44100, n = rate;
  const pcm = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) {
    const t = i / rate;
    let v;
    if (t < 0.35) v = Math.sin(2 * Math.PI * 220 * t) * Math.exp(-t * 4) * 0.8;
    else if (t < 0.6) v = (Math.random() - 0.5) * 0.002;
    else v = Math.sin(2 * Math.PI * 660 * t) * Math.exp(-(t - 0.6) * 9) * 0.9;
    pcm.writeInt16LE(Math.max(-32767, Math.min(32767, Math.round(v * 32767))), i * 2);
  }
  const h = Buffer.alloc(44);
  h.write('RIFF', 0); h.writeUInt32LE(36 + pcm.length, 4); h.write('WAVE', 8);
  h.write('fmt ', 12); h.writeUInt32LE(16, 16); h.writeUInt16LE(1, 20);
  h.writeUInt16LE(1, 22); h.writeUInt32LE(rate, 24); h.writeUInt32LE(rate * 2, 28);
  h.writeUInt16LE(2, 32); h.writeUInt16LE(16, 34);
  h.write('data', 36); h.writeUInt32LE(pcm.length, 40);
  fs.writeFileSync(file, Buffer.concat([h, pcm]));
}

let pass = 0, fail = 0;
function ok(name, cond, detail) {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  — ' + detail : '')); }
}

(async () => {
  makeWav(OUT);
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
  });
  const p = await b.newPage({ viewport: { width: 1500, height: 950 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => {
    // the favicon 404 is the static server, not the tool
    if (m.type() === 'error' && !/favicon/.test(m.location().url || '')
        && !/404/.test(m.text())) errs.push('console: ' + m.text());
  });
  await p.goto('http://localhost:8944/tools/sound.html');
  await p.click('#tabRec');
  await p.waitForTimeout(200);

  const sel = () => p.textContent('#rSel');
  const status = () => p.textContent('#rStatus');
  // "wave 1.00s · 44100 samples @ 44.1kHz"
  const secs = async () => {
    const m = (await sel()).match(/wave ([\d.]+)s/);
    return m ? parseFloat(m[1]) : -1;
  };
  const bytes = async () => (await p.inputValue('#rOut')).length;
  /* How far the exported bytes get from 128. Unsigned 8-bit centres on 128,
   * so 128 repeated IS digital silence — which is what a real broken capture
   * looked like. A substring test is not enough: any recording with a pause
   * in it legitimately contains a run of 128s. */
  const peakDev = async () => {
    const m = (await p.inputValue('#rOut')).match(/data: '([^']*)'/);
    if (!m) return -1;
    let d = 0;
    for (const v of Buffer.from(m[1], 'base64')) d = Math.max(d, Math.abs(v - 128));
    return d;
  };

  console.log('LOAD');
  await p.setInputFiles('#rFile', OUT);
  await p.waitForTimeout(900);
  const base = await secs();
  ok('the file arrives on the wave', Math.abs(base - 1) < 0.02, 'got ' + base + 's');
  ok('the export fills in', (await bytes()) > 1000, (await bytes()) + ' chars');
  ok('the export is not silence', (await peakDev()) > 40, 'peak deviation ' + (await peakDev()));

  console.log('\nSELECTION');
  const box = await p.locator('#rWave').boundingBox();
  async function drag(f0, f1) {
    const y = box.y + box.height * 0.6;
    await p.mouse.move(box.x + box.width * f0, y);
    await p.mouse.down();
    await p.mouse.move(box.x + box.width * ((f0 + f1) / 2), y, { steps: 4 });
    await p.mouse.move(box.x + box.width * f1, y, { steps: 4 });
    await p.mouse.up();
    await p.waitForTimeout(80);
  }
  await drag(0.25, 0.75);
  ok('a drag selects', /SELECTED/.test(await sel()), await sel());
  const selLen = parseFloat((await sel()).match(/SELECTED ([\d.]+)s/)[1]);
  ok('the selection is about half', Math.abs(selLen - 0.5) < 0.05, selLen + 's');
  ok('the export follows the selection', /SELECTION only/.test(await p.textContent('#rSize')));

  console.log('\nCUT / UNDO / CROP');
  await p.click('#eCut'); await p.waitForTimeout(120);
  const afterCut = await secs();
  ok('cut removes the selection', Math.abs(afterCut - (base - selLen)) < 0.03,
    base + ' - ' + selLen + ' should be ' + afterCut);
  await p.click('#eUndo'); await p.waitForTimeout(120);
  ok('undo puts it back', Math.abs((await secs()) - base) < 0.02, await secs());
  await p.click('#eRedo'); await p.waitForTimeout(120);
  ok('redo takes it away again', Math.abs((await secs()) - afterCut) < 0.03);
  await p.click('#eUndo'); await p.waitForTimeout(120);

  /* Start clear of the previous selection's edges: dragging from one of them
   * is the edge-grab gesture, not a new selection, and that is deliberate. */
  await drag(0.35, 0.85);
  const cropLen = parseFloat((await sel()).match(/SELECTED ([\d.]+)s/)[1]);
  await p.click('#eCrop'); await p.waitForTimeout(120);
  ok('crop keeps only the selection', Math.abs((await secs()) - cropLen) < 0.05,
    'selected ' + cropLen + 's, kept ' + (await secs()) + 's');
  await p.click('#eUndo'); await p.waitForTimeout(120);
  ok('undo restores after crop', Math.abs((await secs()) - base) < 0.02);

  console.log('\nCOPY / PASTE / MIX');
  await p.click('#eAll'); await p.waitForTimeout(60);
  await p.click('#eCopy'); await p.waitForTimeout(60);
  await p.click('#ePaste'); await p.waitForTimeout(150);
  ok('paste over a full selection replaces it', Math.abs((await secs()) - base) < 0.02, await secs());
  await p.click('#eFit'); await p.waitForTimeout(60);
  await drag(0.88, 0.93);                      // a short drag near the end
  await p.click('#ePaste'); await p.waitForTimeout(200);
  ok('paste at a point makes it longer', (await secs()) > base + 0.5, await secs());
  await p.click('#eUndo'); await p.waitForTimeout(120);
  await p.click('#eUndo'); await p.waitForTimeout(120);
  await p.click('#eAll');
  await p.click('#eMix'); await p.waitForTimeout(200);
  ok('mix in does not change the length', Math.abs((await secs()) - base) < 0.02, await secs());
  await p.click('#eUndo'); await p.waitForTimeout(120);

  console.log('\nSILENCE');
  await p.click('#eAll');
  await p.click('#eHush'); await p.waitForTimeout(150);
  ok('silence flattens the export', (await peakDev()) === 0, 'peak deviation ' + (await peakDev()));
  await p.click('#eUndo'); await p.waitForTimeout(150);
  ok('undo brings the sound back', (await peakDev()) > 40, 'peak deviation ' + (await peakDev()));

  console.log('\nEFFECTS — each one applied to the whole wave, then undone');
  const fxNames = await p.$$eval('#fxGrid button', bs => bs.map(b => b.textContent));
  ok('every effect is on the rack', fxNames.length === 17, fxNames.length + ': ' + fxNames.join(','));
  // effects that are expected to change the duration, and in which direction
  const grows = { 'ECHO': 1, 'REVERB': 1 };
  for (const name of fxNames) {
    await p.click(`#fxGrid button:has-text("${name}")`);
    await p.waitForTimeout(60);
    const shown = await p.isVisible('#fxPanel');
    if (!shown) { ok(name + ': panel opens', false); continue; }
    const before = await secs();
    const beforeOut = await p.inputValue('#rOut');
    await p.click('#fxPanel button:has-text("▶ PREVIEW")');
    await p.waitForTimeout(120);
    const previewLeftItAlone = Math.abs((await secs()) - before) < 0.001
      && (await p.inputValue('#rOut')) === beforeOut;
    await p.click('#fxPanel button:has-text("APPLY")');
    await p.waitForTimeout(400);
    const after = await secs();
    const changed = (await p.inputValue('#rOut')) !== beforeOut;
    const st = await status();
    ok(name.padEnd(16) + ' applies',
      /applied/.test(st) && after > 0.01 && previewLeftItAlone,
      'status "' + st + '" · ' + before + 's → ' + after + 's'
      + (previewLeftItAlone ? '' : ' · PREVIEW MUTATED THE BUFFER'));
    if (grows[name]) ok(name + ' grows a tail', after > before + 0.05, before + ' → ' + after);
    if (name === 'REVERSE' || name === 'NORMALISE' || name === 'DISTORT')
      ok(name + ' actually alters the samples', changed);
    await p.click('#fxPanel button:has-text("CLOSE")');
    await p.click('#eUndo'); await p.waitForTimeout(150);
    ok(name.padEnd(16) + ' undoes cleanly', Math.abs((await secs()) - before) < 0.005,
      before + ' → ' + (await secs()));
  }

  console.log('\nLENGTH-CHANGING EFFECTS, checked in the right direction');
  async function setFx(name, k, val) {
    await p.click(`#fxGrid button:has-text("${name}")`);
    await p.waitForTimeout(60);
    const sliders = await p.$$('#fxPanel input[type=range]');
    await sliders[k].fill(String(val));
    await sliders[k].dispatchEvent('input');
    const b0 = await secs();
    await p.click('#fxPanel button:has-text("APPLY")');
    await p.waitForTimeout(400);
    const b1 = await secs();
    await p.click('#fxPanel button:has-text("CLOSE")');
    await p.click('#eUndo'); await p.waitForTimeout(150);
    return [b0, b1];
  }
  let [a0, a1] = await setFx('PITCH / SPEED', 0, 12);
  ok('an octave up halves the length', Math.abs(a1 - a0 / 2) < 0.03, a0 + ' → ' + a1);
  [a0, a1] = await setFx('PITCH / SPEED', 0, -12);
  ok('an octave down doubles it', Math.abs(a1 - a0 * 2) < 0.05, a0 + ' → ' + a1);
  [a0, a1] = await setFx('LONGER / SHORTER', 0, 200);
  ok('200% is about twice as long', a1 > a0 * 1.8 && a1 < a0 * 2.3, a0 + ' → ' + a1);
  [a0, a1] = await setFx('LONGER / SHORTER', 0, 50);
  ok('50% is about half', a1 > a0 * 0.4 && a1 < a0 * 0.75, a0 + ' → ' + a1);

  console.log('\nVIEW');
  const z = async () => { const m = (await sel()).match(/zoom ([\d.]+)/); return m ? parseFloat(m[1]) : 1; };
  await p.click('#eFit'); await p.waitForTimeout(60);
  await p.click('#eZin'); await p.click('#eZin'); await p.waitForTimeout(80);
  ok('zoom in bites', (await z()) > 3, 'zoom ' + (await z()));
  await p.click('#eFit'); await p.waitForTimeout(80);
  ok('fit goes back to the whole wave', (await z()) < 1.1, 'zoom ' + (await z()));

  console.log('\nEXPORT');
  await p.click('#eAll');
  await p.fill('#rName', 'testGrunt');
  await p.waitForTimeout(120);
  const code = await p.inputValue('#rOut');
  ok('the code names the sample', /testGrunt: \{ rate: \d+, data: '/.test(code), code.slice(0, 80));
  const b64 = code.match(/data: '([^']*)'/)[1];
  const dec = Buffer.from(b64, 'base64');
  let dev = 0;
  for (const v of dec) dev = Math.max(dev, Math.abs(v - 128));
  ok('the exported bytes are not all 128', dev > 40, 'peak deviation ' + dev + ' of 127');
  ok('the size readout is filled in', /KB/.test(await p.textContent('#rSize')));

  console.log('\nKEEP AND RELOAD');
  await p.click('#rKeep'); await p.waitForTimeout(150);
  ok('it lands in the list', /testGrunt/.test(await p.textContent('#rList')));
  await p.click('#rList .it button:has-text("↑")'); await p.waitForTimeout(250);
  ok('loading it back puts it on the wave', /loaded "testGrunt"/.test(await status()), await status());

  console.log('\n' + (errs.length ? 'PAGE ERRORS:\n  ' + errs.join('\n  ') : 'no page errors'));
  if (errs.length) fail += errs.length;

  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
