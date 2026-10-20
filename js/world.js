/**
 * WESTERN RUNNER · Lógica del juego (sin dibujo ni DOM)
 * ----------------------------------------------------
 * Coordenadas: x crece hacia la derecha a lo largo del camino; y es la altura sobre el suelo.
 * world.step(dt) avanza la simulación con un paso fijo; los cambios se publican en world.events
 * para que la interfaz, el render y el audio reaccionen sin acoplarse a la lógica.
 */
(function (root) {
  'use strict';

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

  // Cajas relativas al punto de apoyo del caballo (centro del cuerpo, a ras de suelo).
  var HORSE_BOX = { l: -36, r: 42, b: 4, t: 96 };    // daño: patas y cuerpo
  var COLLECT_BOX = { l: -46, r: 62, b: 0, t: 182 };  // recoger: caballo + jinete
  var CARD = { hw: 17, hh: 23 };
  var HAT = { hw: 28, hh: 17 };
  var HB_W = HORSE_BOX.r - HORSE_BOX.l;

  function World(cfg, opts) {
    opts = opts || {};
    this.cfg = cfg;
    this.viewW = opts.viewW || 960;
    this.horseX = opts.horseX || 220;
    var j = cfg.physics;
    this.T = j.airTime;
    this.H = j.jumpHeight;
    this.v0 = 4 * j.jumpHeight / j.airTime;
    this.g = 8 * j.jumpHeight / (j.airTime * j.airTime);
    this.endless = !!opts.endless;
    this.reset(opts.seed != null ? opts.seed : cfg.seed);
  }

  World.prototype.reset = function (seed) {
    this.rng = seed != null ? mulberry32(seed) : Math.random;
    this.t = 0;
    this.timeLeft = this.endless ? Infinity : this.cfg.durationSeconds;
    this.score = 0;
    this.lives = this.cfg.lives;
    this.invuln = 0;
    this.mult = 0;
    this.dist = 0;
    this.speed = this.cfg.speed.start;
    this.horse = { y: 0, vy: 0, air: false };
    this.obstacles = [];
    this.cards = [];
    this.hats = [];
    this.events = [];
    this.phaseIndex = 0;
    this.over = false;
    this.reason = null;
    this.group = 0;
    this.nextX = this.horseX + this.viewW * 0.55;
    this.minObstacleCenter = this.horseX + this.viewW * 0.9;
    this.nextHatT = this.cfg.hats.firstAfter;
    this.stats = { cards: 0, hats: 0, hits: 0, jumps: 0, bestStreak: 0, bonuses: 0 };
    this.streak = 0;
    this.lastCardX = 0;
    this.spawnIdle = false; // true en el tutorial: el caballo corre sin generar nada
  };

  /* Coloca el primer contenido delante del caballo (tras el tutorial o un reinicio). */
  World.prototype.beginRun = function () {
    this.spawnIdle = false;
    var X = this.horseAbsX();
    this.nextX = X + this.viewW * 0.55;
    this.lastCardX = X;
    this.minObstacleCenter = X + this.viewW * 0.9;
  };

  /* ---------- Curvas de dificultad ---------- */
  World.prototype.speedAt = function (t) {
    var s = this.cfg.speed, ph = this.cfg.phases, dur = this.cfg.durationSeconds;
    if (!this.endless) t = Math.min(t, dur);
    var self = this;
    function target(i, at) {
      var P = ph[i], dt = Math.max(0, at - P.from);
      if (self.endless && i === ph.length - 1)
        return P.speed + (s.endlessMax - P.speed) * (1 - Math.exp(-dt / (s.endlessRamp || 90)));
      return P.speed + (s.drift || 0) * dt;
    }
    var i = this.phaseAt(t), v = target(i, t);
    if (i > 0) {
      var prevEnd = target(i - 1, ph[i].from);
      var k = clamp((t - ph[i].from) / (s.phaseRamp || 2), 0, 1);
      k = k * k * (3 - 2 * k);                 // arranque y llegada suaves
      v = prevEnd + (v - prevEnd) * k;
    }
    return Math.min(v, this.endless ? s.endlessMax : s.max);
  };
  World.prototype.phaseAt = function (t) {
    var ph = this.cfg.phases, i = 0;
    for (var k = 0; k < ph.length; k++) if (t >= ph[k].from) i = k;
    return i;
  };
  World.prototype.horseAbsX = function () { return this.dist + this.horseX; };

  /* Velocidad prevista cuando el caballo llegue a x (la velocidad solo sube). */
  World.prototype.speedAtX = function (x) {
    var dt = Math.max(0, (x - this.horseAbsX()) / this.speed);
    return this.speedAt(this.t + dt + 0.25);
  };

  /* Distancia horizontal que el caballo pasa por encima de una altura h. */
  World.prototype.clearWindow = function (h, s) {
    var f = 1 - h / this.H;
    return f <= 0 ? 0 : s * this.T * Math.sqrt(f);
  };

  /* ---------- Generación de contenido ---------- */
  World.prototype._obstacleTypes = function (phase, comboOnly) {
    var o = this.cfg.obstacles, out = [];
    for (var k in o) if (o[k].minPhase <= phase && (!comboOnly || o[k].combo)) out.push(k);
    return out;
  };

  World.prototype._effective = function (type) {
    var d = this.cfg.obstacles[type];
    return { w: d.w - d.box[0] - d.box[2], h: d.h - d.box[1] };
  };

  World.prototype._makeObstacle = function (type, x) {
    var d = this.cfg.obstacles[type];
    var o = { type: type, x: x, w: d.w, h: d.h, box: d.box, hit: false, g: this.group };
    this.obstacles.push(o);
    return o;
  };

  World.prototype._card = function (x, y) {
    this.cards.push({ x: x, y: y, got: false, suit: Math.floor(this.rng() * 4), bob: this.rng() * 6.28 });
    this.lastCardX = Math.max(this.lastCardX, x);
    this.stats.spawned = (this.stats.spawned || 0) + 1;
  };

  /* Cartas siguiendo la trayectoria de un salto centrado en cx. */
  World.prototype._arc = function (cx, s, n, withHat) {
    var span = s * this.T * 0.62;
    for (var i = 0; i < n; i++) {
      var f = n === 1 ? 0 : (i / (n - 1)) - 0.5;
      var dx = f * span, tau = dx / s;
      var y = this.H - 0.5 * this.g * tau * tau + 96;
      if (withHat && i === Math.floor(n / 2)) {
        this.hats.push({ x: cx + dx, y: this.H + 110, got: false });
        this.nextHatT = this.t + this._rand(this.cfg.hats.every[0], this.cfg.hats.every[1]);
      } else this._card(cx + dx, y);
    }
  };

  World.prototype._rand = function (a, b) { return a + this.rng() * (b - a); };
  World.prototype._pick = function (arr) { return arr[Math.floor(this.rng() * arr.length)]; };

  /* Coloca un grupo de obstáculos (1 o 2 piezas que se saltan de una vez). */
  World.prototype._placeGroup = function (types, s, P) {
    var parts = types.map(this._effective, this);
    var hmax = 0, total = 0, i;
    for (i = 0; i < parts.length; i++) { hmax = Math.max(hmax, parts[i].h); total += this.cfg.obstacles[types[i]].w; }
    var gap = 0;
    if (types.length === 2) {
      var win = this.clearWindow(hmax, s) - s * 0.14;               // margen de 0.14 s para el jugador
      var need = parts[0].w + parts[1].w + HB_W + this.cfg.obstacles[types[0]].box[2] + this.cfg.obstacles[types[1]].box[0];
      gap = Math.min(56, win - need);
      if (gap < 6) return this._placeGroup([types[0]], s, P);     // no cabe: un solo obstáculo
      total += gap;
    }
    var start = Math.max(this.nextX, this.minObstacleCenter - total / 2);
    this.group++;
    var x = start;
    for (i = 0; i < types.length; i++) {
      this._makeObstacle(types[i], x);
      x += this.cfg.obstacles[types[i]].w + gap;
    }
    var center = start + total / 2;
    for (i = this.obstacles.length - types.length; i < this.obstacles.length; i++) this.obstacles[i].gc = center;
    return { start: start, end: start + total, center: center };
  };

  World.prototype._spawnChunk = function () {
    var ph = this.phaseAt(this.t), P = this.cfg.phases[ph];
    var s = this.speedAtX(this.nextX);
    var hatDue = this.t >= this.nextHatT;
    var r = this.rng();
    // Garantía: nunca más de ~3 s de recorrido sin cartas.
    // (también cuando el siguiente obstáculo quedaría lejos por la separación mínima)
    var nextObstacleAt = Math.max(this.nextX, this.minObstacleCenter - 60);
    if (this.nextX - this.lastCardX > s * 3 || nextObstacleAt - this.lastCardX > s * 2.4) r = 1;

    if (r < P.obstacleChance) {
      var r2 = this.rng(), kind = r2 < P.doubleChance ? 'double' : r2 < P.doubleChance + P.comboChance ? 'combo' : 'single';
      var types = kind === 'combo'
        ? [this._pick(this._obstacleTypes(ph, true)), this._pick(this._obstacleTypes(ph, true))]
        : [this._pick(this._obstacleTypes(ph, false))];
      var grp = this._placeGroup(types, s, P);
      var step = s * (this.T + P.reaction);
      // Nunca más de ~2 s de recorrido sin cartas.
      var starving = grp.center - this.lastCardX > s * 2.4;
      if (this.rng() < 0.12 || hatDue || starving) this._arc(grp.center, s, 3, hatDue);
      if (kind === 'double') {
        // Segundo obstáculo a la distancia mínima justa: exige precisión.
        this.nextX = grp.end + 4;
        this.minObstacleCenter = grp.center + step;
        var grp2 = this._placeGroup([this._pick(this._obstacleTypes(ph, false))], this.speedAtX(grp.center + step), P);
        grp = grp2;
      }
      this.nextX = grp.end + 30;
      this.minObstacleCenter = grp.center + step * this._rand(P.gapLoose[0], P.gapLoose[1]);
    } else if (this.rng() < P.highCardChance || hatDue) {
      var cx = this.nextX + s * this.T * 0.5;
      this._arc(cx, s, 3, hatDue);
      this.nextX = cx + s * this.T * 0.5 + s * this._rand(0.9, 1.6);   // tramo vacío después
    } else {
      var n = 3, sp = 58;
      for (var i = 0; i < n; i++) this._card(this.nextX + i * sp, 92);
      this.nextX += n * sp + s * this._rand(0.9, 1.6);
    }
  };

  /* ---------- Racha ---------- */
  World.prototype._addStreak = function () {
    var st = this.cfg.streak;
    this.streak++;
    if (this.streak > this.stats.bestStreak) this.stats.bestStreak = this.streak;
    this.events.push({ type: 'streak', count: this.streak });
    if (st && st.every && this.streak % st.every === 0) {
      this.score += st.bonus;
      this.stats.bonuses++;
      this.events.push({ type: 'bonus', count: this.streak, points: st.bonus });
    }
  };
  World.prototype._breakStreak = function () {
    if (this.streak > 0) this.events.push({ type: 'streakLost', count: this.streak });
    this.streak = 0;
  };

  /* Semilla del reto del día: igual para todos en la misma fecha local. */
  World.dailySeed = function (date) {
    date = date || new Date();
    return date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate();
  };

  /* ---------- Acciones ---------- */
  World.prototype.jump = function () {
    if (this.over || this.horse.air) return false;
    this.horse.vy = this.v0;
    this.horse.air = true;
    this.stats.jumps++;
    this.events.push({ type: 'jump' });
    return true;
  };

  World.prototype._end = function (reason) {
    if (this.over) return;
    this.over = true;
    this.reason = reason;
    this.events.push({ type: 'over', reason: reason, score: this.score });
  };

  /* ---------- Paso de simulación ---------- */
  World.prototype.step = function (dt) {
    if (this.over) return;
    var cfg = this.cfg, h = this.horse;

    if (!this.spawnIdle) {
      this.t += dt;
      this.timeLeft = this.endless ? Infinity : Math.max(0, cfg.durationSeconds - this.t);
      var ph = this.phaseAt(this.t);
      if (ph !== this.phaseIndex) {
        this.phaseIndex = ph;
        this.events.push({ type: 'phase', index: ph, message: cfg.phases[ph].message });
      }
    }
    this.speed = this.speedAt(this.t);
    this.dist += this.speed * dt;

    if (h.air) {
      h.vy -= this.g * dt;
      h.y += h.vy * dt;
      if (h.y <= 0) { h.y = 0; h.vy = 0; h.air = false; this.events.push({ type: 'land' }); }
    }

    if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);
    if (this.mult > 0) {
      this.mult -= dt;
      if (this.mult <= 0) { this.mult = 0; this.events.push({ type: 'multEnd' }); }
    }

    if (!this.spawnIdle) {
      while (this.nextX < this.dist + this.viewW + 160) this._spawnChunk();
    }

    var X = this.horseAbsX(), i;
    // Daño
    var hl = X + HORSE_BOX.l, hr = X + HORSE_BOX.r, hb = h.y + HORSE_BOX.b;
    for (i = 0; i < this.obstacles.length; i++) {
      var o = this.obstacles[i];
      if (o.hit || this.invuln > 0) continue;
      var ol = o.x + o.box[0], or = o.x + o.w - o.box[2], ot = o.h - o.box[1];
      if (hr > ol && hl < or && hb < ot) {
        o.hit = true;
        this.lives--;
        this.stats.hits++;
        this.invuln = cfg.invulnerableSeconds;
        this.events.push({ type: 'hit', lives: this.lives, obstacle: o });
        this._breakStreak();
        if (this.lives <= 0) { this._end('lives'); return; }
      }
    }
    // Recolección
    var cl = X + COLLECT_BOX.l, cr = X + COLLECT_BOX.r, cb = h.y + COLLECT_BOX.b, ct = h.y + COLLECT_BOX.t;
    for (i = 0; i < this.cards.length; i++) {
      var c = this.cards[i];
      if (c.got) continue;
      if (cr > c.x - CARD.hw && cl < c.x + CARD.hw && ct > c.y - CARD.hh && cb < c.y + CARD.hh) {
        c.got = true;
        var pts = cfg.scoring.cardPoints * (this.mult > 0 ? cfg.scoring.multiplier : 1);
        this.score += pts;
        this.stats.cards++;
        this.events.push({ type: 'card', points: pts, card: c });
        this._addStreak();
      } else if (!c.missed && c.x + CARD.hw < cl) {
        c.missed = true;           // la carta quedó atrás: se rompe la racha
        this._breakStreak();
      }
    }
    for (i = 0; i < this.hats.length; i++) {
      var ht = this.hats[i];
      if (ht.got) continue;
      if (cr > ht.x - HAT.hw && cl < ht.x + HAT.hw && ct > ht.y - HAT.hh && cb < ht.y + HAT.hh) {
        ht.got = true;
        var refresh = this.mult > 0;
        this.mult = cfg.scoring.multiplierSeconds;
        this.stats.hats++;
        this.events.push({ type: 'hat', refresh: refresh, hat: ht });
      }
    }

    // Limpieza de lo que ya salió por la izquierda
    var cut = this.dist - 220;
    if (this.obstacles.length && this.obstacles[0].x + 120 < cut) this.obstacles = this.obstacles.filter(function (e) { return e.x + 120 >= cut; });
    if (this.cards.length && this.cards[0].x < cut) this.cards = this.cards.filter(function (e) { return e.x >= cut; });
    if (this.hats.length && this.hats[0].x < cut) this.hats = this.hats.filter(function (e) { return e.x >= cut; });

    if (!this.spawnIdle && !this.endless && this.timeLeft <= 0) this._end('time');
  };

  /* ---------- Piloto perfecto (solo QA): salta para que el grupo quede bajo el ápice ---------- */
  World.prototype.autopilot = function () {
    if (this.horse.air || this.over) return;
    var X = this.horseAbsX(), best = null;
    for (var i = 0; i < this.obstacles.length; i++) {
      var o = this.obstacles[i];
      if (o.gc > X + 1 && (best === null || o.gc < best)) best = o.gc;
    }
    if (best !== null && best - X <= this.speed * this.T * 0.5) this.jump();
  };

  World.HORSE_BOX = HORSE_BOX;
  World.COLLECT_BOX = COLLECT_BOX;
  root.WR = root.WR || {};
  root.WR.World = World;
  if (typeof module !== 'undefined') module.exports = World;
})(typeof window !== 'undefined' ? window : globalThis);
