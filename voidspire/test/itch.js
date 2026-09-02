/* ==================================================================
 * THE ITCH.IO PACKAGES, OPENED THE WAY ITCH OPENS THEM
 * ==================================================================
 * itch unzips a package and opens index.html inside an IFRAME on a domain of
 * its own, with nothing beside it. Both halves of that matter:
 *
 *   - NOTHING BESIDE IT catches a file the zip forgot. On this machine the
 *     missing file is sitting next to the build and everything works.
 *   - ANOTHER ORIGIN makes the page's storage third-party storage, which is
 *     the thing browsers are increasingly willing to refuse.
 *
 * So each package is served from its own port and framed from a THIRD one,
 * and the page is then asked about itself rather than judged by eye.
 *
 * Run tools/build-itch.js first; this reads what it wrote.
 * ================================================================== */
const { chromium } = require('playwright-core');
const http = require('http'), fs = require('fs'), path = require('path'), cp = require('child_process');
const ROOT = path.join(__dirname, '..');
const SP = path.join(ROOT, 'dist', '_framed');

/* Unpack fresh every run, so this can never pass against a stale unzip. */
[['linework-itch', 'lw'], ['voidspire-itch', 'vs']].forEach(function (z) {
  const d = path.join(SP, z[1]);
  fs.rmSync(d, { recursive: true, force: true });
  fs.mkdirSync(d, { recursive: true });
  const zip = path.join(ROOT, 'dist', z[0] + '.zip');
  if (!fs.existsSync(zip)) {
    console.error('no ' + z[0] + '.zip — run node tools/build-itch.js first');
    process.exit(1);
  }
  cp.execSync('unzip -q -o "' + zip + '" -d "' + d + '"');
});

function serve(dir, port) {
  return new Promise(r => {
    const s = http.createServer((rq, rs) => {
      let f = path.join(dir, rq.url.split('?')[0] === '/' ? '/index.html' : rq.url.split('?')[0]);
      fs.readFile(f, (e, b) => {
        if (e) { rs.writeHead(404); return rs.end('no'); }
        rs.writeHead(200, { 'Content-Type': f.endsWith('.js') ? 'text/javascript' : 'text/html' });
        rs.end(b);
      });
    }).listen(port, () => r(s));
  });
}

(async () => {
  const a = await serve(SP + '/lw', 8951);      // the "itch.zone" origin
  const b = await serve(SP + '/vs', 8952);
  const host = await serve(SP, 8950);           // the "itch.io" page origin
  fs.writeFileSync(SP + '/frame-lw.html',
    '<link rel=icon href="data:,"><body style="margin:0"><iframe src="http://127.0.0.1:8951/" width="1280" height="800" frameborder="0"></iframe>');
  fs.writeFileSync(SP + '/frame-vs.html',
    '<link rel=icon href="data:,"><body style="margin:0"><iframe src="http://127.0.0.1:8952/" width="1280" height="800" frameborder="0"></iframe>');

  const br = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  let bad = 0;
  for (const [name, url, shot] of [
    ['LINEWORK', 'http://127.0.0.1:8950/frame-lw.html', 'itch-linework.png'],
    ['VOIDSPIRE', 'http://127.0.0.1:8950/frame-vs.html', 'itch-voidspire.png']]) {
    const pg = await br.newPage({ viewport: { width: 1280, height: 820 } });
    const errs = [], missing = [];
    pg.on('pageerror', e => errs.push(String(e)));
    pg.on('console', m => { if (m.type() === 'error') errs.push(m.text() + ' @ ' + JSON.stringify(m.location())); });
    pg.on('requestfailed', r => missing.push(r.url()));
    pg.on('response', r => { if (r.status() >= 400) missing.push(r.status() + ' ' + r.url()); });
    await pg.goto(url, { waitUntil: 'networkidle' });
    await pg.waitForTimeout(2500);
    const fr = pg.frames()[1];
    /* Ask the page about itself rather than trusting the screenshot alone. */
    const said = await fr.evaluate(() => ({
      title: document.title,
      ver: (document.getElementById('ver') || {}).textContent || '',
      canvas: !!document.querySelector('canvas'),
      painted: (() => {
        const c = document.querySelector('canvas'); if (!c) return 0;
        try {
          const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
          let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++;
          return n;
        } catch (e) { return -1; }
      })(),
      store: (() => { try { localStorage.setItem('t', '1'); localStorage.removeItem('t'); return 'works'; }
                      catch (e) { return 'BLOCKED: ' + e.name; } })()
    }));
    await pg.screenshot({ path: SP + '/' + shot });
    const ok = said.canvas && said.painted > 500 && !errs.length && !missing.length;
    if (!ok) bad++;
    console.log('\n' + name + '  ' + (ok ? 'OK' : 'PROBLEM'));
    console.log('  title      ' + said.title);
    if (said.ver) console.log('  build      ' + said.ver);
    console.log('  canvas     ' + (said.canvas ? 'yes, ' + said.painted + ' pixels painted' : 'MISSING'));
    console.log('  storage    ' + said.store + '  (third-party, as on itch)');
    console.log('  missing    ' + (missing.length ? missing.join('\n             ') : 'nothing — the zip is complete'));
    console.log('  errors     ' + (errs.length ? errs.join('\n             ') : 'none'));
    await pg.close();
  }
  await br.close(); a.close(); b.close(); host.close();
  console.log('\n' + (bad ? bad + ' PACKAGE(S) BROKEN' : 'both packages run framed, standalone, with no missing files'));
  process.exit(bad ? 1 : 0);
})();
