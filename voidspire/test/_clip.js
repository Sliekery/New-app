const { chromium } = require('playwright-core');
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', args: ['--no-sandbox'] });
  for (const [name, w, h] of [['phone', 390, 844], ['laptop', 1280, 720]]) {
    for (const tool of ['artist', 'sound', 'fx', 'card', 'layout']) {
      const p = await b.newPage({ viewport: { width: w, height: h } });
      await p.goto('http://localhost:8946/tools/' + tool + '.html');
      await p.waitForTimeout(tool === 'artist' || tool === 'sound' ? 700 : 2000);
      const r = await p.evaluate(() => {
        const cols = [...document.querySelectorAll('.wrap > *')];
        let stranded = 0;
        cols.forEach(c => {
          const canScroll = c.scrollHeight > c.clientHeight + 2;
          const oy = getComputedStyle(c).overflowY;
          if (canScroll && oy !== 'auto' && oy !== 'scroll') stranded++;
        });
        const reach = cols.map(c => {
          c.scrollTop = c.scrollHeight;
          const last = c.lastElementChild;
          if (!last) return true;
          return last.getBoundingClientRect().bottom <= c.getBoundingClientRect().bottom + 6;
        });
        return { cols: cols.length, stranded, ok: reach.every(Boolean) };
      });
      const flag = (r.stranded || !r.ok) ? '   <-- CHECK' : '';
      console.log((name + '/' + tool).padEnd(17) + 'columns ' + r.cols
        + ' · stranded ' + r.stranded + ' · bottom reachable ' + r.ok + flag);
      await p.close();
    }
  }
  await b.close();
})();
