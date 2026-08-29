/* =========================================================================
 * VOIDSPIRE — samples.js
 * A registry of RECORDED sounds, and the small player that fires them.
 *
 * Everything else in this game's audio is synthesised: oscillators, noise and
 * envelopes, no files. That is why the whole thing is one HTML document you
 * can open from a folder. A recording breaks that rule, so it has to earn it.
 *
 * HOW A RECORDING IS STORED, and why it is deliberately crude:
 *
 * The game is a single 1.5MB file. Audio embedded as base64 is enormous —
 * one second of ordinary 44.1kHz 16-bit mono is 88KB raw and about 118KB
 * base64, so five seconds of voice would add a third to the whole game. So a
 * sample here is downsampled to 8kHz and quantised to 8 bits: the same second
 * becomes 8KB raw, 11KB base64. Roughly a tenth.
 *
 * That is not only a size trick. 8-bit at 8kHz is the texture of a hardware
 * sampler, and it sits with the square waves and the vector line-work far
 * better than a clean recording would — a pristine voice clip over this
 * soundtrack would sound like it had wandered in from another game.
 *
 * The tool at tools/sound.html records, trims and encodes; this only holds
 * what it produced and plays it back.
 * ========================================================================= */
(function (ns) {
  'use strict';

  /* name -> { rate, data } where data is base64 of unsigned 8-bit mono PCM.
   * Empty by default: a game with no recordings behaves exactly as before and
   * costs nothing. */
  ns.SAMPLES = {};

  var AC = null, decoded = {};
  function ctx() {
    if (AC) return AC;
    try { AC = new (window.AudioContext || window.webkitAudioContext)(); }
    catch (e) { return null; }
    return AC;
  }

  /* Decode once and keep it. Rebuilding the AudioBuffer on every shot meant a
   * base64 decode and a float conversion inside a keypress, which is exactly
   * where a stutter is most visible. */
  function buffer(name) {
    if (decoded[name]) return decoded[name];
    var s = ns.SAMPLES[name];
    var c = ctx();
    if (!s || !c || !s.data) return null;
    var bin;
    try { bin = atob(s.data); } catch (e) { return null; }
    var n = bin.length;
    var buf = c.createBuffer(1, n, s.rate || 8000);
    var ch = buf.getChannelData(0);
    // unsigned 8-bit centres on 128; -1..1 is what an AudioBuffer wants
    for (var i = 0; i < n; i++) ch[i] = (bin.charCodeAt(i) - 128) / 128;
    decoded[name] = buf;
    return buf;
  }

  /* Play one. `rate` re-pitches by playing faster or slower, which is how a
   * sampler has always done it and keeps one recording useful at several
   * pitches instead of needing one per note. */
  ns.playSample = function (name, opts) {
    opts = opts || {};
    var c = ctx(), buf = buffer(name);
    if (!c || !buf) return false;
    if (c.state === 'suspended') c.resume();
    var src = c.createBufferSource();
    src.buffer = buf;
    src.playbackRate.value = opts.rate || 1;
    var g = c.createGain();
    g.gain.value = (opts.vol == null ? 0.5 : opts.vol);
    var out = g;
    if (opts.filter) {
      var bq = c.createBiquadFilter();
      bq.type = 'lowpass'; bq.frequency.value = opts.filter;
      g.connect(bq); out = bq;
    }
    src.connect(g); out.connect(c.destination);
    src.start();
    return true;
  };

  // What the recordings are costing, so the bill is visible rather than a
  // surprise the next time the bundle is measured.
  ns.sampleBytes = function () {
    var n = 0;
    Object.keys(ns.SAMPLES).forEach(function (k) { n += (ns.SAMPLES[k].data || '').length; });
    return n;
  };
})(typeof window !== 'undefined' ? (window.VS = window.VS || {}) : (global.VS = global.VS || {}));
