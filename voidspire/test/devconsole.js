/* =========================================================================
 * VOIDSPIRE — test/devconsole.js
 * Drives the dev console's buttons in a real browser.
 *
 * The point of the console is that it hands straight back to the real code,
 * so the thing worth asserting is not "the panel opened" but "the situation
 * it set up is a real one" — the enemies are the ones asked for, scaled for
 * the sector; the card is really in hand; the engraving is really on the die;
 * ending a turn really advances the fight.
 *
 * Usage: node test/devconsole.js   (tools served on :8944)
 * ========================================================================= */
const { chromium } = require('playwright-core');
let pass = 0, fail = 0;
function ok(n, c, d) {
  if (c) { pass++; console.log('  ok   ' + n); }
  else { fail++; console.log('  FAIL ' + n + (d ? '  — ' + d : '')); }
}
(async () => {
  const b = await chromium.launch({
    executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/404|favicon/.test(m.text())) errs.push('console: ' + m.text()); });

  console.log('OFF BY DEFAULT');
  await p.goto('http://localhost:8944/index.html');
  await p.waitForTimeout(700);
  ok('no panel without the flag', !(await p.$('#vsdev')));

  await p.goto('http://localhost:8944/index.html?dev=1');
  await p.waitForTimeout(700);
  ok('the tab appears with ?dev=1', !!(await p.$('#vsdevTab')));
  ok('and a control to move it off whatever it is covering', !!(await p.$('#vsdevSide')));
  ok('it starts closed', !(await p.isVisible('#vsdev .body')));
  await p.click('#vsdevTab');
  await p.waitForTimeout(200);
  ok('it opens', await p.isVisible('#vsdev .body'));

  const st = () => p.evaluate(() => {
    const E = window.VS.engine, r = E.run, c = E.combat;
    return {
      run: !!r, cls: r && r.cls, phase: r && r.phase, sector: r && r.sector,
      hp: r && r.hp, maxHp: r && r.maxHp, credits: r && r.credits,
      combat: !!c, turn: c && c.turn, energy: c && c.energy, block: c && c.player.block,
      enemies: c ? c.enemies.map(e => ({ id: e.id, hp: e.hp, alive: e.alive })) : [],
      hand: c ? c.hand.map(x => x.id) : [],
      faces: r && r.die ? Object.keys(r.die.faces).map(f => f + ':' + r.die.faces[f].id) : [],
      str: c ? (c.player.statuses.str || 0) : 0,
    };
  });
  const sayText = () => p.textContent('#vsdevSay').catch(() => '');

  console.log('\nA RUN');
  await p.click('#vsdev button:has-text("VANG")');
  await p.waitForTimeout(400);
  let s = await st();
  /* newRun stops at the first-mark screen — that is the real flow, and the
   * console does not skip it. Everything below still works from there, which
   * is worth knowing rather than working around. */
  ok('a vanguard run starts', s.run && s.cls === 'vanguard' && /first-mark|map/.test(s.phase),
    JSON.stringify(s).slice(0, 120));

  console.log('\nA FIGHT WITH NAMED ENEMIES');
  // stage two specific enemies through the picker's search box
  const pickEnemy = async (name) => {
    const box = p.locator('#vsdev input[placeholder="find an enemy…"]');
    await box.fill(name);
    await p.waitForTimeout(120);
    await p.locator('#vsdev .pick div', { hasText: name }).first().click();
    await p.waitForTimeout(120);
  };
  await pickEnemy('Drone Skirmisher');
  await pickEnemy('Scrap Hound');
  ok('both are staged', /Drone Skirmisher \+ Scrap Hound/.test(await p.textContent('#vsdevPicked')),
    await p.textContent('#vsdevPicked'));
  await p.click('#vsdev button:has-text("START THIS FIGHT")');
  await p.waitForTimeout(700);
  s = await st();
  ok('the fight is against exactly those two',
    s.combat && s.enemies.length === 2
    && s.enemies[0].id === 'drone_skirmisher' && s.enemies[1].id === 'scrap_hound',
    JSON.stringify(s.enemies));
  ok('the phase really is combat', s.phase === 'combat', s.phase);
  ok('the first turn was dealt', s.turn === 1 && s.hand.length > 0,
    'turn ' + s.turn + ', ' + s.hand.length + ' in hand');
  ok('energy was granted', s.energy > 0, String(s.energy));
  const sector1Hp = s.enemies[0].hp;

  console.log('\nA CARD INTO HAND');
  const handBefore = (await st()).hand.length;
  await p.locator('#vsdev input[placeholder="find a card…"]').fill('Pulse Rifle');
  await p.waitForTimeout(120);
  await p.locator('#vsdev .pick div', { hasText: 'Pulse Rifle' }).first().click();
  await p.waitForTimeout(400);
  s = await st();
  ok('it lands in hand', s.hand.length === handBefore + 1 && s.hand.indexOf('pulse_rifle') >= 0,
    s.hand.join(','));

  console.log('\nAN ENGRAVING, WITHOUT THE BENCH');
  const facesBefore = (await st()).faces.length;
  await p.locator('#vsdev input[placeholder="find an engraving…"]').fill('');
  await p.waitForTimeout(120);
  await p.locator('#vsdev .pick div').last().click();
  await p.waitForTimeout(400);
  s = await st();
  ok('the die gained a face', s.faces.length > facesBefore || /cut into face/.test(await sayText()),
    'faces ' + s.faces.join(' ') + ' · said "' + (await sayText()) + '"');

  console.log('\nIN THE FIGHT');
  await p.click('#vsdev button:has-text("+1 str")');
  await p.waitForTimeout(300);
  ok('a status can be granted', (await st()).str === 1, 'str ' + (await st()).str);
  const turnBefore = (await st()).turn;
  await p.click('#vsdev button:has-text("END TURN")');
  await p.waitForTimeout(1400);
  s = await st();
  ok('the turn advances', s.turn > turnBefore || !s.combat, 'turn ' + turnBefore + ' → ' + s.turn);
  if (s.combat) {
    await p.click('#vsdev button:has-text("KILL ALL")');
    await p.waitForTimeout(900);
    s = await st();
    ok('kill all ends the fight', !s.combat || s.enemies.every(e => !e.alive),
      JSON.stringify(s.enemies));
  }

  console.log('\nSECTOR SCALING IS REAL, NOT FAKED');
  await p.evaluate(() => { window.VS.engine.dev.set('sector', 4); });
  await p.evaluate(() => { window.VS.engine.dev.fight(['drone_skirmisher'], 'fight'); });
  await p.waitForTimeout(400);
  s = await st();
  ok('the same enemy is tougher in sector 4', s.enemies[0].hp > sector1Hp,
    'sector 1: ' + sector1Hp + 'hp · sector 4: ' + s.enemies[0].hp + 'hp');

  console.log('\nREFUSALS ARE REPORTED, NOT SWALLOWED');
  const why = await p.evaluate(() => window.VS.engine.dev.fight(['no_such_enemy'], 'fight'));
  ok('a bad enemy id comes back as a sentence', /no such enemy/.test(why || ''), String(why));
  const why2 = await p.evaluate(() => window.VS.engine.dev.card('no_such_card', false, 'hand'));
  ok('so does a bad card id', /no such card/.test(why2 || ''), String(why2));

  console.log('\nNON-COMBAT SCREENS');
  for (const node of ['shop', 'rest', 'forge', 'treasure']) {
    await p.evaluate(n => window.VS.engine.dev.node(n), node);
    await p.evaluate(() => window.VS.ui.refresh());
    await p.waitForTimeout(250);
    const ph = (await st()).phase;
    ok('go to ' + node.padEnd(9) + ' → phase ' + ph, !!ph && ph !== 'combat', ph);
  }

  console.log('\n' + (errs.length ? 'PAGE ERRORS:\n  ' + errs.join('\n  ') : 'no page errors'));
  if (errs.length) fail += errs.length;
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  await b.close();
  process.exit(fail ? 1 : 0);
})();
