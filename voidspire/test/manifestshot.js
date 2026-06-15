/* Screenshot the Warpcaller Crew Manifest via headless chromium (DOM + CSS). */
'use strict';
var path = require('path');
var { chromium } = require('playwright-core');

(async function () {
  var browser = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium_headless_shell-1194/chrome-linux/headless_shell',
    args: ['--no-sandbox'],
  });
  var page = await browser.newPage({ viewport: { width: 390, height: 800 }, deviceScaleFactor: 2 });
  await page.goto('file://' + path.join(__dirname, '..', 'voidspire.html'));
  await page.waitForFunction(function () { return window.VS && window.VS.engine; });

  await page.evaluate(function () {
    var VS = window.VS, E = VS.engine;
    E.seed(7);
    E.newRun('warpcaller');
    E.run.faction = 'voidspawn';
    E.run.nodeIdx = 6;
    E.startNode('fight');
    // build a varied formation: tank front-ish, healer, attackers, a 2-slot behemoth
    E.combat.allies.length = 0;
    ['warden', 'leech', 'stinger', 'totem'].forEach(function (id) { E.summonPet(id, 1); });
    VS.ui.refresh();
    VS.ui.updateHUD();
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: '/tmp/manifest.png' });

  // selected state (pick up the front pet)
  await page.evaluate(function () { document.querySelector('[data-mf="0"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); });
  await page.waitForTimeout(200);
  await page.screenshot({ path: '/tmp/manifest-sel.png' });

  await browser.close();
  console.log('wrote /tmp/manifest.png and /tmp/manifest-sel.png');
})();
