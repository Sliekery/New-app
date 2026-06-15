/* =========================================================================
 * VOIDSPIRE — music.js
 * Procedural deep-synthwave background bed. Pure Web Audio (no files): a dark
 * D-minor progression with bass + pad, layering in kick / hats / arp and
 * nudging tempo + brightness as the sector (intensity) climbs. Kept low in the
 * mix on its own AudioContext so it never fights the SFX.
 *
 * API:  VS.music.start() / .stop() / .setSector(s) / .setScene('menu'|'combat')
 *       / .setMuted(bool) / .isOn()
 * No-ops gracefully where Web Audio is unavailable (jsdom / headless).
 * ========================================================================= */
(function (ns) {
  'use strict';
  var M = {};
  ns.music = M;

  var AC = null, master = null, lp = null;
  var muted = false, playing = false, timer = null;
  var intensity = 0;        // 0..1, from the sector
  var scene = 'menu';       // 'menu' | 'combat'
  var nextTime = 0, stepN = 0;
  var STEPS = 64;           // 16 steps/bar * 4 bars
  var noiseBuf = null;

  // overall loudness — deliberately subtle and bass-heavy (output = layer gain * master)
  var VOL = { menu: 0.04, combat: 0.062, tense: 0.016, bass: 0.62, sub: 0.5, drone: 0.22, pad: 0.045, kick: 0.62, hat: 0.08, arp: 0.06 };
  var userVol = 0.7;     // user master slider (0..1), persisted
  try { var _sv = (window.localStorage && window.localStorage.getItem('vs_music_vol')); if (_sv != null) userVol = Math.max(0, Math.min(1, parseFloat(_sv))); } catch (e) {}

  function ctx() {
    if (muted) return null;
    if (!AC) {
      try { AC = new (window.AudioContext || window.webkitAudioContext)(); }
      catch (e) { muted = true; return null; }
      master = AC.createGain(); master.gain.value = 0.0001;
      lp = AC.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 640; lp.Q.value = 0.4;
      lp.connect(master); master.connect(AC.destination);
      var n = Math.floor(AC.sampleRate * 0.2);
      noiseBuf = AC.createBuffer(1, n, AC.sampleRate);
      var d = noiseBuf.getChannelData(0);
      for (var i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    }
    if (AC.state === 'suspended') AC.resume();
    return AC;
  }

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  // i - VI - III - VII in D minor (classic dark retrowave cadence)
  var PROG = [
    { bass: 38, chord: [50, 53, 57] }, // Dm  (D F A)
    { bass: 34, chord: [46, 50, 53] }, // Bb  (Bb D F)
    { bass: 41, chord: [53, 57, 60] }, // F   (F A C)
    { bass: 36, chord: [48, 52, 55] }, // C   (C E G)
  ];
  var ARP = [0, 2, 1, 2];

  function tone(time, midi, dur, type, vol, dest) {
    var o = AC.createOscillator(), g = AC.createGain();
    o.type = type; o.frequency.setValueAtTime(mtof(midi), time);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.linearRampToValueAtTime(vol, time + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    o.connect(g); g.connect(dest || lp);
    o.start(time); o.stop(time + dur + 0.03);
  }
  function pad(time, midi, dur, vol) {     // two slightly-detuned saws, slow swell
    [-6, 6].forEach(function (dt) {
      var o = AC.createOscillator(), g = AC.createGain();
      o.type = 'sawtooth'; o.frequency.value = mtof(midi); o.detune.value = dt;
      g.gain.setValueAtTime(0.0001, time);
      g.gain.linearRampToValueAtTime(vol * 0.5, time + 0.35);
      g.gain.setValueAtTime(vol * 0.5, Math.max(time + 0.36, time + dur - 0.4));
      g.gain.exponentialRampToValueAtTime(0.0001, time + dur);
      o.connect(g); g.connect(lp);
      o.start(time); o.stop(time + dur + 0.05);
    });
  }
  function kick(time, vol) {
    var o = AC.createOscillator(), g = AC.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(110, time);
    o.frequency.exponentialRampToValueAtTime(38, time + 0.14);   // deeper drop
    g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.2);
    o.connect(g); g.connect(master);     // punch bypasses the lowpass
    o.start(time); o.stop(time + 0.22);
  }
  function hat(time, vol) {
    var s = AC.createBufferSource(); s.buffer = noiseBuf;
    var hp = AC.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 7500;
    var g = AC.createGain(); g.gain.setValueAtTime(vol, time);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.04);
    s.connect(hp); hp.connect(g); g.connect(master);
    s.start(time); s.stop(time + 0.06);
  }

  function secPerStep() { return 60 / (74 + intensity * 16) / 4; }   // slower, spacier

  function scheduleStep(step, time) {
    var bar = (step >> 4) & 3, inBar = step & 15, ch = PROG[bar];
    var I = intensity, sm = scene === 'combat' ? 1 : 0.6, barDur = secPerStep() * 16;

    if (inBar % 2 === 0) {                                          // bass eighths + sub octave
      tone(time, ch.bass, 0.17 + 0.05 * I, 'sawtooth', VOL.bass * sm);
      tone(time, ch.bass - 12, 0.22, 'sine', VOL.sub * sm);
    }
    if (inBar === 0) {                                              // dark pad (low octave) + deep drone
      pad(time, ch.bass - 12, barDur * 0.99, VOL.drone * sm);
      ch.chord.forEach(function (m) { pad(time, m, barDur * 0.97, VOL.pad * sm); });
    }
    if (I > 0.15 && (inBar === 0 || inBar === 8)) kick(time, VOL.kick * sm);              // beats 1 & 3
    if (I > 0.6 && inBar === 14) kick(time, VOL.kick * 0.7 * sm);                          // driving pickup
    if (I > 0.45 && inBar % 4 === 2) hat(time, (VOL.hat * 0.6 + VOL.hat * I) * sm);        // off-beat hats
    if (I > 0.45 && scene === 'combat') {                                                  // sparse arp when tense
      tone(time, ch.chord[ARP[inBar % ARP.length]] + 12, 0.1, 'triangle', VOL.arp * (0.6 + 0.4 * I));
    }
  }

  function scheduler() {
    if (!AC) return;
    while (nextTime < AC.currentTime + 0.18) {
      scheduleStep(stepN, nextTime);
      nextTime += secPerStep();
      stepN = (stepN + 1) % STEPS;
    }
  }

  function targetVol() { return ((scene === 'combat' ? VOL.combat : VOL.menu) + intensity * VOL.tense) * userVol; }
  function targetCut() { return 560 + intensity * 1100; }   // stays dark; opens only a little as it tenses
  function rampMix() {
    if (!playing || !AC) return;
    var now = AC.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), now);
    master.gain.exponentialRampToValueAtTime(Math.max(0.0001, targetVol()), now + 1.4);
    lp.frequency.cancelScheduledValues(now);
    lp.frequency.setValueAtTime(lp.frequency.value, now);
    lp.frequency.linearRampToValueAtTime(targetCut(), now + 1.4);
  }

  M.start = function () {
    if (playing) return;
    var ac = ctx(); if (!ac) return;
    playing = true;
    nextTime = ac.currentTime + 0.12; stepN = 0;
    master.gain.cancelScheduledValues(ac.currentTime);
    master.gain.setValueAtTime(0.0001, ac.currentTime);
    master.gain.exponentialRampToValueAtTime(Math.max(0.0001, targetVol()), ac.currentTime + 2.6); // gentle fade-in
    lp.frequency.setValueAtTime(targetCut(), ac.currentTime);
    timer = setInterval(scheduler, 25);
  };
  M.stop = function () {
    if (!playing || !AC) return;
    playing = false;
    if (timer) { clearInterval(timer); timer = null; }
    var now = AC.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(Math.max(0.0001, master.gain.value), now);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
  };
  M.setSector = function (s) {
    var nv = Math.max(0, Math.min(1, ((s || 1) - 1) / 7));
    if (Math.abs(nv - intensity) < 0.001) return;
    intensity = nv; rampMix();
  };
  M.setScene = function (sc) { if (sc !== 'menu' && sc !== 'combat') sc = 'menu'; if (sc === scene) return; scene = sc; rampMix(); };
  M.setMuted = function (m) { muted = !!m; if (muted) M.stop(); };
  M.setVolume = function (v) {
    userVol = Math.max(0, Math.min(1, v));
    try { if (window.localStorage) window.localStorage.setItem('vs_music_vol', String(userVol)); } catch (e) {}
    rampMix();
  };
  M.getVolume = function () { return userVol; };
  M.isOn = function () { return playing; };

})(typeof window !== 'undefined' ? (window.VS = window.VS || {}) : (global.VS = global.VS || {}));
