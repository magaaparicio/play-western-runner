/**
 * WESTERN RUNNER · Efectos de sonido sintetizados con Web Audio (sin archivos).
 */
(function (w) {
  'use strict';
  var WR = w.WR;

  function Sound() { this.enabled = true; this.musicEnabled = true; this.ctx = null; this.musicTimer = 0; this.tempo = 116; }

  Sound.prototype.unlock = function () {
    if (!this.ctx) {
      var AC = w.AudioContext || w.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.42;
      this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.musicBus.gain.value = 0.16;
      this.musicBus.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') this.ctx.resume();
  };

  Sound.prototype._tone = function (f0, f1, dur, type, vol, delay) {
    var c = this.ctx, t = c.currentTime + (delay || 0);
    var o = c.createOscillator(), g = c.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.02);
  };

  Sound.prototype._noise = function (dur, vol, freq, delay) {
    var c = this.ctx, t = c.currentTime + (delay || 0);
    var len = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = buf; f.type = 'lowpass'; f.frequency.value = freq || 900;
    g.gain.value = vol || 0.3;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t);
  };

  Sound.prototype.play = function (name) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    var s = this;
    switch (name) {
      case 'jump': s._tone(260, 560, 0.14, 'square', 0.09); s._noise(0.08, 0.08, 700); break;
      case 'land': s._noise(0.07, 0.1, 380); break;
      case 'card': s._tone(988, 988, 0.07, 'triangle', 0.22); s._tone(1319, 1319, 0.12, 'triangle', 0.2, 0.06); break;
      case 'hat': [523, 659, 784, 1047, 1319].forEach(function (f, i) { s._tone(f, f, 0.1, 'triangle', 0.2, i * 0.05); }); break;
      case 'multEnd': s._tone(784, 392, 0.22, 'triangle', 0.16); break;
      case 'hit': s._noise(0.22, 0.4, 600); s._tone(150, 55, 0.25, 'sawtooth', 0.16); break;
      case 'phase': s._tone(392, 392, 0.08, 'square', 0.1); s._tone(523, 523, 0.14, 'square', 0.1, 0.09); break;
      case 'over': [523, 440, 349, 262].forEach(function (f, i) { s._tone(f, f * 0.98, 0.16, 'triangle', 0.2, i * 0.15); }); break;
      case 'record': [523, 659, 784, 659, 784, 1047].forEach(function (f, i) { s._tone(f, f, 0.14, 'square', 0.12, i * 0.11); }); break;
      case 'bonus': [784, 988, 1175, 1568].forEach(function (f, i) { s._tone(f, f, 0.09, 'square', 0.12, i * 0.06); }); break;
      case 'click': s._tone(620, 480, 0.05, 'triangle', 0.12); break;
    }
  };

  /* ---------- Música: tema western en bucle (La menor, 4 compases) ---------- */
  var BASS = [110, 110, 146.83, 164.81];                       // Am, Am, Dm, E
  var MEL = [659, 0, 0, 880, 784, 0, 659, 0, 587, 0, 659, 0, 0, 0, 0, 0,
             587, 0, 0, 698, 659, 0, 587, 0, 523, 0, 494, 0, 440, 0, 0, 0];

  Sound.prototype._mnote = function (f, t, dur, type, vol, vib) {
    var c = this.ctx, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (vib) {
      var l = c.createOscillator(), lg = c.createGain();
      l.frequency.value = 5.5; lg.gain.value = f * 0.012;
      l.connect(lg); lg.connect(o.frequency); l.start(t); l.stop(t + dur + 0.05);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.musicBus);
    o.start(t); o.stop(t + dur + 0.05);
  };

  Sound.prototype._musicStep = function (i, t) {
    var bar = Math.floor(i / 8), beat = i % 8, root = BASS[bar], e = 60 / this.tempo / 2;
    if (beat === 0) this._mnote(root, t, e * 1.8, 'triangle', 0.5);
    if (beat === 4) this._mnote(root * 1.5, t, e * 1.8, 'triangle', 0.4);
    // cascos: clop-clop en cada corchea
    this._mnote(i % 2 ? 640 : 820, t, 0.05, 'sine', i % 2 ? 0.12 : 0.2);
    if (MEL[i]) this._mnote(MEL[i], t, e * 2.6, 'sine', 0.22, true);
  };

  Sound.prototype._schedule = function () {
    var c = this.ctx, e = 60 / this.tempo / 2;
    while (this.nextNote < c.currentTime + 0.15) {
      this._musicStep(this.mstep, this.nextNote);
      this.nextNote += e;
      this.mstep = (this.mstep + 1) % 32;
    }
  };

  Sound.prototype.startMusic = function () {
    if (!this.musicEnabled || !this.ctx || this.musicTimer) return;
    var self = this;
    this.nextNote = this.ctx.currentTime + 0.08;
    this.mstep = 0;
    this.musicTimer = setInterval(function () { self._schedule(); }, 30);
  };
  Sound.prototype.stopMusic = function () {
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = 0; }
  };
  Sound.prototype.setTempo = function (bpm) { this.tempo = bpm; };

  WR.Sound = Sound;
})(window);
