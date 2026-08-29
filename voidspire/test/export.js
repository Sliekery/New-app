/* =========================================================================
 * VOIDSPIRE — test/export.js
 * Every export format, saved for real and then opened.
 *
 * A file that downloads is not a file that works. The GIF encoder and the zip
 * writer here are written from the spec rather than pulled from a library, so
 * "it produced 40KB" proves nothing at all — a GIF with a bad LZW stream, a
 * zip with a wrong CRC and a sprite sheet with the frames stacked instead of
 * laid out all download perfectly happily and are all useless.
 *
 * So each one is checked against its own format: magic bytes, the structures
 * the spec requires, and — for the two that a browser can read back — decoded
 * and measured.
 *
 * Usage: node test/export.js     (tools served on :8944)
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

/* ---------------------------------------------------------------------
 * THE LZW ENCODER, ROUND-TRIPPED AGAINST A DECODER WRITTEN FROM THE SPEC.
 *
 * This is here because of the exact bug it now catches. GIF's dictionary is
 * rebuilt by the decoder as it reads, and the decoder is always ONE ENTRY
 * BEHIND the encoder — it cannot add the entry a code created until it has
 * read the code after it. So the code width must grow when `next` has PASSED
 * the limit, not when it reaches it. Off by that one, the encoder runs a code
 * ahead of every decoder in the world.
 *
 * Both versions produce a file with a correct header, a correct frame count,
 * a correct palette and a correct trailer. One of them draws the picture and
 * the other draws nothing, and no structural check can tell them apart —
 * which is why the browser check further down exists too, and why this runs
 * first: it says WHICH code is wrong, where the browser only says "blank".
 * ------------------------------------------------------------------- */
function lzwFromTool() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'tools', 'artist.html'), 'utf8');
  const i = src.indexOf('  function lzw(px, minCode) {');
  const j = src.indexOf('  function gifEncode(', i);
  if (i < 0 || j < 0) throw new Error('could not find lzw() in artist.html');
  // eslint-disable-next-line no-new-func
  return Function(src.slice(i, j) + '\nreturn lzw;')();
}
function unlzw(bytes, minCode, expect) {
  const clear = 1 << minCode, eoi = clear + 1;
  let dict = [], next = eoi + 1, width = minCode + 1;
  const reset = () => {
    dict = [];
    for (let i = 0; i < clear; i++) dict[i] = [i];
    next = eoi + 1; width = minCode + 1;
  };
  reset();
  let bitPos = 0; const out = []; let prev = null;
  const read = () => {
    let v = 0;
    for (let i = 0; i < width; i++) {
      const by = bytes[bitPos >> 3];
      if (by === undefined) return -1;
      v |= ((by >> (bitPos & 7)) & 1) << i;
      bitPos++;
    }
    return v;
  };
  for (;;) {
    const code = read();
    if (code < 0) return { out, err: 'ran out of bits' };
    if (code === clear) { reset(); prev = null; continue; }
    if (code === eoi) return { out, err: null };
    const entry = dict[code] || (prev !== null ? prev.concat([prev[0]]) : null);
    if (!entry) return { out, err: 'code ' + code + ' was never defined' };
    out.push(...entry);
    if (prev !== null) {
      dict[next++] = prev.concat([entry[0]]);
      if (next === (1 << width) && width < 12) width++;
    }
    prev = entry;
    if (out.length > expect * 2) return { out, err: 'overran the input' };
  }
}

(async () => {
  console.log('THE LZW STREAM ROUND TRIPS');
  {
    const lzw = lzwFromTool();
    const cases = {
      'a flat block': [new Array(64).fill(3), 6],
      'two colours, 4096px': [Array.from({ length: 4096 }, (_, i) => (i % 97 < 3) ? 1 : 0), 6],
      'noise, 64 colours': [Array.from({ length: 8000 }, (_, i) => (i * 2654435761 >>> 13) % 64), 6],
      'line art, 65536px': [Array.from({ length: 65536 }, (_, i) => {
        const x = i % 256, y = (i / 256) | 0;
        const d = Math.abs(Math.hypot(x - 128, y - 128) - 90);
        return d < 2 ? 40 + ((d * 8) | 0) : 1;
      }), 6],
      'a full 8-bit palette': [Array.from({ length: 65536 }, (_, i) => {
        const x = i % 256, y = (i / 256) | 0;
        const d = Math.abs(Math.hypot(x - 128, y - 128) - 90);
        return d < 2 ? 200 + ((d * 8) | 0) : 1;
      }), 8],
    };
    for (const [name, [px, minCode]] of Object.entries(cases)) {
      const { out, err } = unlzw(Uint8Array.from(lzw(px, minCode)), minCode, px.length);
      const same = out.length === px.length && out.every((v, i) => v === px[i]);
      ok(name.padEnd(22) + ' decodes back to itself', same,
        'in ' + px.length + ', out ' + out.length + (err ? ' · ' + err : '')
        + (same ? '' : ' · first wrong at ' + out.findIndex((v, i) => v !== px[i])));
    }
  }

  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'vs-export-'));
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

  // a real four-frame animation to export: a spinning d20
  await p.click('#mSolid'); await p.waitForTimeout(200);
  await p.click('#solidBar .sld[data-sld="icosa"]'); await p.waitForTimeout(80);
  await p.$eval('#sFrames', el => { el.value = 4; el.dispatchEvent(new Event('input', { bubbles: true })); });
  await p.click('#sBake'); await p.waitForTimeout(800);
  const frames = await p.$$eval('#frameList > *', e => e.length);
  ok('there is a four-frame animation to export', frames === 4, frames + ' frames');

  // open the export panel — it folds shut with the rest
  await p.evaluate(() => {
    const box = [...document.querySelectorAll('.side .box')]
      .find(x => /EXPORT/.test(x.querySelector('h2').textContent));
    if (box && box.classList.contains('shut')) box.querySelector('h2').onclick();
  });
  await p.waitForTimeout(300);
  ok('the export panel opens', await p.isVisible('#xGo'));

  /* Collect downloads from the event stream rather than awaiting one promise
   * per file. Two waitForEvent('download') calls made before the click both
   * resolve on the SAME first event, so the sprite sheet's json came back as
   * a second copy of its png. */
  const inbox = [];
  p.on('download', async dl => {
    const to = path.join(dir, dl.suggestedFilename());
    await dl.saveAs(to);
    inbox.push({ name: dl.suggestedFilename(), path: to,
                 size: fs.statSync(to).size, data: fs.readFileSync(to) });
  });
  async function save(fmt, waitMs) {
    inbox.length = 0;
    await p.click(`#xFormat button[data-x="${fmt}"]`);
    await p.waitForTimeout(120);
    const want = fmt === 'sheet' ? 2 : 1;
    await p.click('#xGo');
    const until = Date.now() + (waitMs || 15000);
    while (inbox.length < want && Date.now() < until) await p.waitForTimeout(120);
    if (inbox.length < want) throw new Error(fmt + ': got ' + inbox.length + ' of ' + want + ' files');
    const got = inbox.slice();
    return want === 1 ? got[0] : got;
  }

  console.log('\nFOR A GAME');
  {
    const [sheet, meta] = await save('sheet');
    ok('the sprite sheet is a png', sheet.data.slice(1, 4).toString() === 'PNG', sheet.name);
    // the IHDR width/height sit at bytes 16..24 of every PNG
    const w = sheet.data.readUInt32BE(16), h = sheet.data.readUInt32BE(20);
    const j = JSON.parse(meta.data.toString());
    ok('the json says how to cut it', j.frames === 4 && j.layout === 'horizontal-strip',
      JSON.stringify(j).slice(0, 90));
    ok('and the numbers in it match the actual image',
      w === j.sheetWidth && h === j.sheetHeight && w === j.frameWidth * j.frames,
      w + 'x' + h + ' vs json ' + j.sheetWidth + 'x' + j.sheetHeight
      + ' (' + j.frameWidth + ' x ' + j.frames + ')');
    ok('the strip is four cells wide, not four stacked', w > h * 3, w + 'x' + h);
    ok('and it carries the frame rate', j.fps > 0, String(j.fps));
  }
  {
    const z = await save('frames');
    ok('the frames come down as a zip', /\.zip$/.test(z.name), z.name);
    ok('with the right magic bytes', z.data.slice(0, 4).toString('hex') === '504b0304',
      z.data.slice(0, 4).toString('hex'));
    // count local file headers, and check the end-of-central-directory count
    let count = 0;
    for (let i = 0; i < z.data.length - 4; i++) {
      if (z.data.readUInt32LE(i) === 0x04034b50) count++;
    }
    ok('holding four entries', count === 4, count + ' local headers');
    const eocd = z.data.lastIndexOf(Buffer.from('504b0506', 'hex'));
    ok('and a central directory that agrees', eocd > 0 && z.data.readUInt16LE(eocd + 10) === 4,
      eocd > 0 ? String(z.data.readUInt16LE(eocd + 10)) : 'no EOCD');
    // every entry must be a real PNG, and named so it sorts
    const names = [];
    for (let i = 0; i < z.data.length - 30; i++) {
      if (z.data.readUInt32LE(i) === 0x04034b50) {
        const n = z.data.readUInt16LE(i + 26);
        const name = z.data.slice(i + 30, i + 30 + n).toString();
        const body = z.data.slice(i + 30 + n, i + 34 + n);
        names.push(name);
        if (body.slice(1, 4).toString() !== 'PNG') fail++;
      }
    }
    ok('each entry is a png', true, names.join(' '));
    ok('numbered so they sort', names.join(',') === [...names].sort().join(','), names.join(','));
  }
  {
    const s = await save('svg');
    const text = s.data.toString();
    ok('the svg is a real document', /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/.test(text));
    ok('and animates, since there are four frames', /class="reel"/.test(text) && /steps\(4\)/.test(text));
    const v = await b.newPage();
    await v.goto('file://' + s.path); await v.waitForTimeout(300);
    const drew = await v.evaluate(() => {
      const g = document.querySelector('.reel');
      const bb = document.querySelector('svg').getBBox();
      return { anim: g && getComputedStyle(g).animationName, w: bb.width, h: bb.height };
    });
    ok('a browser opens it and runs it', drew.anim === 'reel' && drew.w > 0.1,
      JSON.stringify(drew));
    await v.close();
  }

  console.log('\nTO SEND TO SOMEONE');
  {
    await p.$eval('#xSize', el => { el.value = 256; el.dispatchEvent(new Event('input', { bubbles: true })); });
    const g = await save('gif', 30000);
    ok('the gif has the right header', g.data.slice(0, 6).toString() === 'GIF89a',
      g.data.slice(0, 6).toString());
    const W = g.data.readUInt16LE(6), H = g.data.readUInt16LE(8);
    ok('at the size asked for', W === 256 && H === 256, W + 'x' + H);
    ok('it loops — a gif without the Netscape block plays once and stops',
      g.data.includes(Buffer.from('NETSCAPE2.0')));
    // one graphic-control extension per frame
    let gce = 0;
    for (let i = 0; i < g.data.length - 2; i++) {
      if (g.data[i] === 0x21 && g.data[i + 1] === 0xF9 && g.data[i + 2] === 4) gce++;
    }
    ok('with four frames in it', gce === 4, gce + ' graphic control blocks');
    ok('and it ends properly', g.data[g.data.length - 1] === 0x3B);
    ok('it is a sane size', g.size > 1000 && g.size < 900000, Math.round(g.size / 1024) + ' KB');

    /* THE REAL TEST: a browser decodes it. A GIF with a broken LZW stream has
     * a perfect header and renders as nothing, so every check above can pass
     * on a file that shows a blank square. */
    const v = await b.newPage();
    /* The bytes go in as a data: URL. A page built with setContent has an
     * about:blank origin, so a file:// image simply never loads into it — and
     * a file:// page that CAN load one taints the canvas, so getImageData
     * throws instead. A data URL is neither. */
    await v.setContent('<body style="margin:0;background:#333"><img id="g" src="data:image/gif;base64,'
      + g.data.toString('base64') + '">');
    await v.waitForTimeout(700);
    const shown = await v.evaluate(() => {
      const im = document.getElementById('g');
      if (!im.complete || !im.naturalWidth) return null;
      const c = document.createElement('canvas');
      c.width = im.naturalWidth; c.height = im.naturalHeight;
      const x = c.getContext('2d');
      x.drawImage(im, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height).data;
      const seen = {};
      let lit = 0;
      for (let i = 0; i < d.length; i += 4) {
        const k = (d[i] >> 4) + ',' + (d[i + 1] >> 4) + ',' + (d[i + 2] >> 4);
        seen[k] = 1;
        if (d[i + 1] > 90 && d[i + 1] > d[i] + 30) lit++;   // the green line work
      }
      return { w: im.naturalWidth, h: im.naturalHeight, colours: Object.keys(seen).length, lit: lit };
    });
    ok('a browser decodes it', shown && shown.w === 256, JSON.stringify(shown));
    ok('and there is a drawing in it, not an empty square',
      shown && shown.lit > 200 && shown.colours > 2,
      shown ? shown.lit + ' lit pixels, ' + shown.colours + ' colours' : 'nothing');
    await v.close();
  }
  {
    const canRecord = await p.evaluate(() => typeof MediaRecorder !== 'undefined');
    if (!canRecord) {
      ok('video is offered only where the browser can record', true, 'MediaRecorder absent');
    } else {
      const v = await save('video', 40000);
      ok('a video comes down', /\.(mp4|webm)$/.test(v.name), v.name);
      ok('and it is not empty', v.size > 2000, Math.round(v.size / 1024) + ' KB');
      const head = v.data.slice(0, 12);
      ok('with a container magic a player will recognise',
        head.slice(4, 8).toString() === 'ftyp' || head.readUInt32BE(0) === 0x1A45DFA3,
        head.toString('hex'));
    }
  }
  {
    await p.$eval('#xSize', el => { el.value = 512; el.dispatchEvent(new Event('input', { bubbles: true })); });
    await p.click('#xShape button[data-shape="story"]');
    await p.click('#xBg button[data-bg="none"]');
    const s = await save('png');
    ok('a still png comes down', s.data.slice(1, 4).toString() === 'PNG', s.name);
    const w = s.data.readUInt32BE(16), h = s.data.readUInt32BE(20);
    ok('shaped 9:16 for a story', w === 512 && h === Math.round(512 * 16 / 9), w + 'x' + h);
    const v = await b.newPage();
    await v.setContent('<img id="i" src="data:image/png;base64,' + s.data.toString('base64') + '">');
    await v.waitForTimeout(400);
    const alpha = await v.evaluate(() => {
      const im = document.getElementById('i');
      const c = document.createElement('canvas');
      c.width = im.naturalWidth; c.height = im.naturalHeight;
      c.getContext('2d').drawImage(im, 0, 0);
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      let clear = 0, solid = 0;
      for (let i = 3; i < d.length; i += 4) (d[i] < 20 ? clear++ : solid++);
      return { clear, solid };
    });
    ok('and NOTHING as a ground really means transparent',
      alpha.clear > alpha.solid * 4 && alpha.solid > 100, JSON.stringify(alpha));
    await v.close();
  }

  console.log('\n' + (errs.length ? 'PAGE ERRORS:\n  ' + errs.join('\n  ') : 'no page errors'));
  if (errs.length) fail += errs.length;
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  fs.rmSync(dir, { recursive: true, force: true });
  process.exit(fail ? 1 : 0);
})();
