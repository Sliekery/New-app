const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  for (const [name, w, h] of [['desktop', 1600, 900], ['laptop', 1280, 720], ['phone', 390, 844]]) {
    for (const tool of ['artist', 'sound', 'fx', 'card', 'layout']) {
      const p = await b.newPage({ viewport: { width: w, height: h } });
      p.on('pageerror', e => console.log('ERR', tool, e.message));
      await p.goto('http://localhost:8944/tools/' + tool + '.html');
      await p.waitForTimeout(tool === 'artist' || tool === 'sound' ? 700 : 2200);
      const r = await p.evaluate(() => {
        const b = document.body, d = document.documentElement;
        const canvases = [...document.querySelectorAll('canvas')];
        const bad = canvases.filter(c => getComputedStyle(c).touchAction !== 'none');
        return {
          pageScrolls: d.scrollHeight > d.clientHeight + 2,
          bodyOverflow: getComputedStyle(b).overflow,
          zoomBlocked: /user-scalable=no/.test(document.querySelector('meta[name=viewport]').content),
          canvases: canvases.length, unprotected: bad.length,
          innerScrollers: [...document.querySelectorAll('.wrap > *')].filter(e => e.scrollHeight > e.clientHeight + 2).length,
        };
      });
      if (name === 'desktop' || r.pageScrolls || r.unprotected)
        console.log((name + '/' + tool).padEnd(18)
          + 'page scrolls: ' + (r.pageScrolls ? 'YES' : 'no')
          + ' · zoom blocked: ' + r.zoomBlocked
          + ' · canvases ' + r.canvases + ' (' + r.unprotected + ' unprotected)'
          + ' · panels scrolling inside: ' + r.innerScrollers);
      await p.close();
    }
  }
  await b.close();
})();
