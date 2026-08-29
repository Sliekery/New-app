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
  var TEMPO = { base: 74, climb: 16 };

  /* EXPOSED SO THE SOUND TOOL CAN DRIVE THE REAL ENGINE. tools/sound.html
   * edits these in place and hears the actual mix rather than a reimplementation
   * of it, which is the same reason the artist previews art through the game's
   * own draw call. Nothing in the game writes to them. */
  M.PROG = PROG; M.ARP = ARP; M.VOL = VOL; M.TEMPO = TEMPO;

  /* ==================================================================
   * THE PATTERN LAYER — a written loop riding on the generated bed
   * ==================================================================
   * Everything above this GENERATES its notes from the chord progression and
   * the intensity, which is why the bed never quite repeats and why it
   * tightens as a run goes deeper. That is worth keeping, so a written pattern
   * does not replace it — it plays ON TOP of it.
   *
   * A pattern is a list of hits per voice: { step, midi, len, vel }. Steps are
   * the same 16-per-bar grid the generator uses, so a hit lands exactly on the
   * beat the sequencer drew it on. An empty pattern costs one array lookup a
   * step and changes nothing.
   * ================================================================== */
  var PATTERN = null;
  M.setPattern = function (p) { PATTERN = (p && p.hits) ? p : null; };
  // Where the loop is, so a sequencer can draw a playhead on the right column.
  M.getStep = function () { return stepN; };
  /* Sound one note now, outside the loop. A sequencer has to speak the moment
   * a square is tapped — waiting for the playhead to come round is the
   * difference between an instrument and a form. */
  M.auditionHit = function (voice, h) {
    var c = ctx(); if (!c) return;
    playHit(voice, c.currentTime + 0.01, h || {}, 1);
  };
  M.getPattern = function () { return PATTERN; };

  // The voices a written hit can use. Names match the sequencer's rows.
  function playHit(voice, time, h, sm) {
    var vel = (h.vel == null ? 1 : h.vel);
    var len = (h.len || 1) * secPerStep();
    if (voice === 'kick') return kick(time, VOL.kick * vel * sm);
    if (voice === 'hat') return hat(time, VOL.hat * vel * sm);
    if (voice === 'bass') return tone(time, h.midi, len, 'sawtooth', VOL.bass * vel * sm);
    if (voice === 'sub') return tone(time, h.midi, len, 'sine', VOL.sub * vel * sm);
    if (voice === 'pad') return pad(time, h.midi, len, VOL.pad * vel * sm);
    if (voice === 'arp') return tone(time, h.midi, len, 'triangle', VOL.arp * vel * sm);
    if (voice === 'blip') return tone(time, h.midi, len, 'square', VOL.arp * 0.9 * vel * sm);
    if (voice === 'lead') return tone(time, h.midi, len, 'sawtooth', VOL.arp * 1.1 * vel * sm);
  }
  function schedulePattern(step, time, sm) {
    if (!PATTERN) return;
    var n = PATTERN.steps || 64;
    var at = step % n;
    var hits = PATTERN.hits[at];
    if (!hits) return;
    for (var i = 0; i < hits.length; i++) playHit(hits[i].voice, time, hits[i], sm);
  }
  M.setIntensity = function (v) { intensity = Math.max(0, Math.min(1, v)); };

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

  function secPerStep() { return 60 / (TEMPO.base + intensity * TEMPO.climb) / 4; }   // slower, spacier

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
    schedulePattern(step, time, sm);          // the written loop, over the top
  }

  /* THE ONE LOOP HERE THAT CAN HANG A TAB. It advances by secPerStep() until
   * it has scheduled far enough ahead; if that ever returns zero, a negative,
   * or NaN it never advances and the browser locks up hard with no error —
   * which is exactly what a frozen tab looks like from the outside.
   *
   * Nothing in the game could produce such a tempo, but the sound tool now
   * writes TEMPO.base from a slider, and a tool reaching into a live engine is
   * a new way for a bad value to arrive. The guard costs one comparison a
   * frame and removes the whole failure mode. */
  function scheduler() {
    if (!AC) return;
    var guard = 0;
    while (nextTime < AC.currentTime + 0.18) {
      var dt = secPerStep();
      if (!(dt > 0.0005) || !isFinite(dt)) {          // refuse to spin
        nextTime = AC.currentTime + 0.18;
        break;
      }
      scheduleStep(stepN, nextTime);
      nextTime += dt;
      stepN = (stepN + 1) % STEPS;
      if (++guard > 256) break;                      // a frame cannot need more
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
