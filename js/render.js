/**
 * WESTERN RUNNER · Render
 * Dibuja el estado del mundo. Solo lee de world; nunca lo modifica.
 * Mantiene su propia capa de efectos visuales (polvo, destellos, textos).
 */
(function (w, d) {
  'use strict';
  var WR = w.WR, TAU = Math.PI * 2;
  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function rand(a, b) { return a + Math.random() * (b - a); }

  function Renderer(canvas, cfg) {
    this.cv = canvas;
    this.ctx = canvas.getContext('2d');
    this.img = null;
    this.cfg = cfg;
    this.L = WR.buildScenery(11);
    this.fx = [];
    this.wind = [];
    this.windT = 0;
    this.time = 0;
    this.gallop = 0;
    this.scarf = 0;
    this.dustT = 0;
    this.shake = 0;
    this.hurt = 0;
    this.horseScale = 1;
    this.horseScaleTarget = 1;
    this.heroX = null;
    this.reduced = !!(w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches);
    this.low = false;
    this.slowFrames = 0;
    this.dprCap = 2;
    this.resize();
  }

  Renderer.prototype.resize = function () {
    var cssW = this.cv.clientWidth || w.innerWidth, cssH = this.cv.clientHeight || w.innerHeight;
    var dpr = Math.min(w.devicePixelRatio || 1, this.dprCap);
    var aspect = cssW / cssH, W, H;
    if (aspect >= 600 / 540) { H = 540; W = 540 * aspect; }
    else { W = 600; H = 600 / aspect; }
    this.view = {
      W: W, H: H,
      groundY: aspect >= 1 ? H * 0.8 : H * 0.74,
      portrait: aspect < 1
    };
    this.cv.width = Math.round(cssW * dpr);
    this.cv.height = Math.round(cssH * dpr);
    this.S = this.cv.width / W;
    this.unitPx = cssW / W; // px CSS por unidad (para convertir toques)
    this.horseX = clamp(W * 0.24, 150, 300);
    this.sprites = WR.makeSprites(this.S, this.cfg);
  };

  /* ---------- Modo ilustrado (imágenes del atlas) ---------- */
  var RUN_UPX = 1.3;            // unidades de mundo por píxel en los cuadros de galope
  var SPECIAL_UPX = 1.3 * 0.68; // salto, aterrizaje y daño vienen dibujados más grandes
  var RUN_FRAMES = 9;
  // Orden de cuadros que forma el ciclo más fluido (calculado comparando la pose de las patas).
  var RUN_ORDER = [0, 3, 5, 7, 8, 1, 6, 4, 2];

  function avgRow(im, row) {
    var c = d.createElement('canvas'); c.width = im.width; c.height = 1;
    var x = c.getContext('2d'); x.drawImage(im, 0, -row);
    var data = x.getImageData(0, 0, im.width, 1).data, r = 0, g = 0, b = 0, n = 0;
    for (var i = 0; i < data.length; i += 4) { if (data[i + 3] < 200) continue; r += data[i]; g += data[i + 1]; b += data[i + 2]; n++; }
    n = n || 1;
    return 'rgb(' + Math.round(r / n) + ',' + Math.round(g / n) + ',' + Math.round(b / n) + ')';
  }

  Renderer.prototype.setImages = function (img) {
    this.img = img;
    if (!img) return;
    try {
      this.skyTop = avgRow(img['bg-sky'], 3);
      this.skyBottom = avgRow(img['bg-sky'], img['bg-sky'].height - 2);
      this.roadBottom = avgRow(img['bg-road'], img['bg-road'].height - 2);
    } catch (e) { this.skyTop = '#3D97DD'; this.skyBottom = '#BFE0F2'; this.roadBottom = '#D9863F'; }
    var cg = d.createElement('canvas'); cg.width = cg.height = 128;
    var x = cg.getContext('2d'), g = x.createRadialGradient(64, 64, 8, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,190,70,.85)'); g.addColorStop(0.55, 'rgba(255,160,40,.35)'); g.addColorStop(1, 'rgba(255,150,30,0)');
    x.fillStyle = g; x.fillRect(0, 0, 128, 128);
    this.cardGlow = cg;
  };

  /* Capa repetida horizontalmente; las copias impares se espejan para ocultar la unión. */
  function strip(ctx, im, off, y, h, W) {
    var tw = im.width * h / im.height, period = tw * 2;
    var o = ((off % period) + period) % period;
    for (var x = -o, i = 0; x < W; x += tw, i++) {
      if (i % 2) { ctx.save(); ctx.translate(x + tw, y); ctx.scale(-1, 1); ctx.drawImage(im, -0.5, 0, tw + 1, h); ctx.restore(); }
      else ctx.drawImage(im, x - 0.5, y, tw + 1, h);
    }
  }

  Renderer.prototype._bgImg = function (dist) {
    var ctx = this.ctx, v = this.view, W = v.W, gy = v.groundY, I = this.img;
    // Cielo: degradado + franja ilustrada fija (trae el sol pintado, no se repite)
    var sky = I['bg-sky'], sh, sy, sx = 0, sw = W;
    if (v.portrait) {
      // En vertical la franja se amplía y se coloca sobre las montañas, mostrando el sol.
      sw = W * 2; sx = -W; sh = sw * sky.height / sky.width; sy = gy - 150 - sh * 0.82;
      var top = ctx.createLinearGradient(0, 0, 0, sy + 2);
      top.addColorStop(0, '#2B7FD0'); top.addColorStop(1, this.skyTop);
      ctx.fillStyle = top; ctx.fillRect(0, 0, W, sy + 2);
    } else {
      sh = W * sky.height / sky.width; sy = Math.max(16, gy * 0.07);
      ctx.fillStyle = this.skyTop; ctx.fillRect(0, 0, W, sy + 2);
    }
    var g = ctx.createLinearGradient(0, sy + sh - 2, 0, gy);
    g.addColorStop(0, this.skyBottom); g.addColorStop(1, '#F6DDB0');
    ctx.fillStyle = g; ctx.fillRect(0, sy + sh - 2, W, gy - sy - sh + 4);
    ctx.drawImage(sky, 0, 3, sky.width, sky.height - 3, sx, sy, sw, sh);
    // Montañas lejanas, cercanas
    strip(ctx, I['bg-far'], dist * 0.08, gy - 150, 120, W);
    strip(ctx, I['bg-near'], dist * 0.22, gy - 178, 186, W);
    // Camino; en pantallas altas se apilan bandas espejadas que avanzan más rápido (primer plano)
    var road = I['bg-road'], rh = Math.min(v.H - gy + 6, 150), ry = gy - 6, k = 0;
    while (ry < v.H) {
      if (k % 2) {
        ctx.save(); ctx.translate(0, ry * 2 + rh); ctx.scale(1, -1);
        strip(ctx, road, dist * (1 + k * 0.25), ry, rh, W);
        ctx.restore();
      } else strip(ctx, road, dist * (1 + k * 0.25), ry, rh, W);
      ry += rh - 1; k++;
      if (k > 6) { ctx.fillStyle = this.roadBottom; ctx.fillRect(0, ry, W, v.H - ry); break; }
    }
    // Cactus y rocas por delante del horizonte
    strip(ctx, I['bg-cactus'], dist * 0.5, gy - 112, 118, W);
  };

  Renderer.prototype._horseImg = function (world, x, gy, hs, alpha) {
    var ctx = this.ctx, h = world.horse, name;
    if (this.hurt > 0.45) name = 'horse-hurt';
    else if (h.air) name = h.vy > -world.v0 * 0.2 ? 'horse-jump' : 'horse-land';
    else name = 'horse-run-' + RUN_ORDER[Math.floor(this.gallop * RUN_FRAMES) % RUN_FRAMES];
    var m = WR.HORSE_META[name], im = this.img[name];
    var upx = (name.indexOf('run') > 0 ? RUN_UPX : SPECIAL_UPX) * hs;
    var cx = (m.x0 + m.x1) / 2;
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.drawImage(im, x - cx * upx, gy - h.y - m.y1 * upx + 3 * hs, m.w * upx, m.h * upx);
    ctx.restore();
  };

  /* ---------- Reacciones a eventos del mundo ---------- */
  Renderer.prototype.onEvent = function (e, world) {
    var gy = this.view.groundY, hx = this.horseX, i;
    if (e.type === 'jump') {
      this._dust(hx - 20, gy, this.low ? 3 : 7, 1.3);
    } else if (e.type === 'land') {
      this._dust(hx - 10, gy, this.low ? 4 : 10, 1.6);
    } else if (e.type === 'card') {
      var c = e.card, sx = c.x - world.dist, sy = gy - c.y;
      this.fx.push({ k: 'card', x: sx, y: sy, suit: c.suit, life: 0.35, max: 0.35 });
      this.fx.push({ k: 'text', x: sx, y: sy - 10, text: '+' + e.points, life: 0.8, max: 0.8, big: e.points > this.cfg.scoring.cardPoints });
      if (!this.low) for (i = 0; i < 6; i++) this.fx.push({ k: 'spark', x: sx, y: sy, vx: rand(-120, 120), vy: rand(-160, -40), life: 0.4, max: 0.4, c: '#FFD35C' });
    } else if (e.type === 'hat') {
      var h = e.hat, hx2 = h.x - world.dist, hy = gy - h.y;
      this.fx.push({ k: 'flash', x: hx2, y: hy, life: 0.55, max: 0.55 });
      this.fx.push({ k: 'text', x: hx2, y: hy - 20, text: 'x' + this.cfg.scoring.multiplier, life: 1, max: 1, big: true });
      for (i = 0; i < (this.low ? 6 : 16); i++) this.fx.push({ k: 'spark', x: hx2, y: hy, vx: rand(-220, 220), vy: rand(-220, 80), life: 0.6, max: 0.6, c: i % 2 ? '#FFE27A' : '#FFFFFF' });
    } else if (e.type === 'hit') {
      this.hurt = 1;
      this.shake = this.reduced ? 0 : 0.28;
      e.obstacle.hitAt = this.time;
      this.fx.push({ k: 'stars', life: 0.9, max: 0.9 });
      this._dust(hx + 30, gy, this.low ? 4 : 9, 1.8);
    }
  };

  Renderer.prototype._dust = function (x, y, n, power) {
    for (var i = 0; i < n; i++) {
      this.fx.push({ k: 'dust', x: x + rand(-18, 18), y: y - rand(0, 6), vx: rand(-160, -40) * power, vy: rand(-60, -10) * power,
        r: rand(5, 10), life: rand(0.35, 0.6), max: 0.6 });
    }
  };

  Renderer.prototype.clearFx = function () { this.fx.length = 0; this.wind.length = 0; this.hurt = 0; this.shake = 0; };

  /* ---------- Actualización de efectos ---------- */
  Renderer.prototype.update = function (dt, world, running) {
    this.time += dt;
    this.scarf += dt;
    var speed = world.speed;
    if (!world.horse.air) this.gallop = (this.gallop + dt * speed / 150) % 1;
    this.hurt = Math.max(0, this.hurt - dt * 1.6);
    this.shake = Math.max(0, this.shake - dt);
    this.horseScale += (this.horseScaleTarget - this.horseScale) * (1 - Math.exp(-dt * 6));

    if (running && !world.horse.air && !this.low && !this.img) {
      this.dustT -= dt;
      if (this.dustT <= 0) { this.dustT = 0.07; this._dust(this.horseX - 34 * this.horseScale, this.view.groundY, 1, 0.8); }
    }
    // Líneas de viento: aparecen a partir de ~400 u/s y se intensifican con la velocidad.
    var wind = running && !this.reduced ? clamp((speed - 400) / 260, 0, 1) : 0;
    this.windLevel = wind;
    if (wind > 0) {
      this.windT -= dt;
      if (this.windT <= 0) {
        this.windT = (this.low ? 0.12 : 0.05) / (0.4 + wind);
        var gy = this.view.groundY;
        this.wind.push({ x: this.view.W + 40, y: gy * (0.25 + Math.random() * 0.72), len: 60 + Math.random() * 120 * (0.5 + wind), v: speed * (1.6 + Math.random()), a: 0.18 + wind * 0.32 });
      }
    }
    for (var wi = this.wind.length - 1; wi >= 0; wi--) {
      var ln = this.wind[wi];
      ln.x -= ln.v * dt;
      if (ln.x + ln.len < -20) this.wind.splice(wi, 1);
    }
    for (var i = this.fx.length - 1; i >= 0; i--) {
      var f = this.fx[i];
      f.life -= dt;
      if (f.life <= 0) { this.fx.splice(i, 1); continue; }
      if (f.vx !== undefined) {
        f.x += f.vx * dt; f.y += f.vy * dt;
        if (f.k === 'spark') f.vy += 420 * dt;
        if (f.k === 'dust') { f.vx *= 0.94; f.vy *= 0.92; f.r += dt * 18; }
      } else if (f.k === 'text') f.y -= 60 * dt;
    }

    // Bajo rendimiento sostenido → menos efectos y menos resolución.
    if (running && !this.low) {
      if (dt > 1 / 42) this.slowFrames++; else this.slowFrames = Math.max(0, this.slowFrames - 1);
      if (this.slowFrames > 90) { this.low = true; this.dprCap = 1.25; this.resize(); }
    }
  };

  /* ---------- Dibujo ---------- */
  Renderer.prototype.draw = function (world, opts) {
    opts = opts || {};
    var ctx = this.ctx, v = this.view, S = this.S, gy = v.groundY, sp = this.sprites, i;
    var sx = 0, sy = 0;
    if (this.shake > 0) { sx = rand(-1, 1) * 7 * this.shake / 0.28; sy = rand(-1, 1) * 5 * this.shake / 0.28; }
    ctx.setTransform(S, 0, 0, S, sx * S, sy * S);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (this.img) this._bgImg(world.dist);
    else WR.drawBackground(ctx, this.L, v, world.dist, this.time, this.low);

    var dist = world.dist, maxX = v.W + 120;
    // Obstáculos
    for (i = 0; i < world.obstacles.length; i++) {
      var o = world.obstacles[i], ox = o.x - dist;
      if (ox > maxX || ox + o.w < -60) continue;
      var spr = sp.obstacles[o.type], oim = this.img && this.img['obs-' + o.type];
      if (oim) spr = { c: oim, w: o.w, h: o.h, ox: 0, oy: o.h - 2 };
      ctx.fillStyle = 'rgba(80,40,15,.22)';
      ctx.beginPath(); ctx.ellipse(ox + o.w / 2, gy + 2, o.w * 0.55, 6, 0, 0, TAU); ctx.fill();
      if (o.hitAt != null) {
        var t = this.time - o.hitAt, wob = Math.sin(t * 40) * Math.max(0, 0.3 - t) * 0.4;
        ctx.save(); ctx.globalAlpha = Math.max(0.55, 1 - t * 1.4);
        ctx.translate(ox + o.w / 2, gy); ctx.rotate(wob);
        ctx.drawImage(spr.c, -o.w / 2 - spr.ox, -spr.oy, spr.w, spr.h);
        ctx.restore();
      } else ctx.drawImage(spr.c, ox - spr.ox, gy - spr.oy, spr.w, spr.h);
    }

    // Cartas
    var glow = !this.low;
    for (i = 0; i < world.cards.length; i++) {
      var c = world.cards[i];
      if (c.got) continue;
      var cx = c.x - dist;
      if (cx > maxX || cx < -60) continue;
      var cy = gy - c.y + Math.sin(this.time * 3 + c.bob) * 4;
      ctx.save(); ctx.translate(cx, cy); ctx.rotate(Math.sin(this.time * 2 + c.bob) * 0.18);
      if (this.img) {
        if (glow) ctx.drawImage(this.cardGlow, -42, -46, 84, 92);
        ctx.drawImage(this.img['card-' + c.suit], -20, -26, 40, 52);
      } else {
        var cs = glow ? sp.cardsGlow[c.suit] : sp.cards[c.suit];
        ctx.drawImage(cs.c, -cs.ox, -cs.oy, cs.w, cs.h);
      }
      ctx.restore();
    }

    // Sombreros
    for (i = 0; i < world.hats.length; i++) {
      var h = world.hats[i];
      if (h.got) continue;
      var hx = h.x - dist;
      if (hx > maxX || hx < -80) continue;
      var hy = gy - h.y + Math.sin(this.time * 3.4) * 5;
      var g = sp.hatGlow, pulse = 0.85 + Math.sin(this.time * 6) * 0.12;
      ctx.save(); ctx.translate(hx, hy); ctx.rotate(this.time * 0.8); ctx.scale(pulse, pulse);
      ctx.globalAlpha = 0.9; ctx.drawImage(g.c, -g.ox, -g.oy, g.w, g.h);
      ctx.restore();
      if (this.img) ctx.drawImage(this.img.hat, hx - 37, hy - 30, 74, 58);
      else ctx.drawImage(sp.hat.c, hx - sp.hat.ox, hy - sp.hat.oy, sp.hat.w, sp.hat.h);
    }

    // Viento
    if (this.wind.length) {
      ctx.lineCap = 'round'; ctx.strokeStyle = '#FFFFFF';
      for (i = 0; i < this.wind.length; i++) {
        var wl = this.wind[i];
        ctx.globalAlpha = wl.a; ctx.lineWidth = 2.2;
        ctx.beginPath(); ctx.moveTo(wl.x, wl.y); ctx.lineTo(wl.x + wl.len, wl.y); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    // Caballo y jinete
    this._drawHorse(world, opts);

    // Efectos
    for (i = 0; i < this.fx.length; i++) this._drawFx(this.fx[i], world);

    if (!this.img) WR.drawForeground(ctx, this.L, v, dist);
  };

  Renderer.prototype._drawHorse = function (world, opts) {
    var ctx = this.ctx, gy = this.view.groundY, hs = this.horseScale, hy = world.horse.y;
    var x = this.heroX != null ? this.heroX : this.horseX;
    // sombra
    var sh = clamp(1 - hy / 260, 0.35, 1);
    ctx.fillStyle = 'rgba(80,40,15,.28)';
    ctx.beginPath(); ctx.ellipse(x + 6 * hs, gy + 3, 60 * hs * sh, 8 * sh, 0, 0, TAU); ctx.fill();

    var blink = world.invuln > 0 && !opts.static && Math.floor(world.invuln * 12) % 2 === 0;
    if (this.img) { this._horseImg(world, x, gy, hs, blink ? 0.4 : 1); return; }
    ctx.save();
    ctx.translate(x, gy - hy);
    ctx.scale(hs, hs);
    if (blink) ctx.globalAlpha = 0.4;
    WR.drawRider(ctx, {
      phase: this.gallop,
      air: world.horse.air,
      k: world.horse.vy / world.v0,
      scarf: this.scarf,
      hurt: this.hurt
    });
    ctx.restore();
  };

  Renderer.prototype._drawFx = function (f, world) {
    var ctx = this.ctx, a = clamp(f.life / f.max, 0, 1);
    if (f.k === 'dust') {
      ctx.globalAlpha = a * 0.55; ctx.fillStyle = '#F3D3A0';
      ctx.beginPath(); ctx.arc(f.x, f.y - f.r * 0.5, f.r, 0, TAU); ctx.fill();
    } else if (f.k === 'spark') {
      ctx.globalAlpha = a; ctx.fillStyle = f.c;
      ctx.beginPath(); ctx.arc(f.x, f.y, 3, 0, TAU); ctx.fill();
    } else if (f.k === 'card') {
      var s = this.sprites.cards[f.suit], sc = 1 + (1 - a) * 0.8;
      ctx.globalAlpha = a;
      ctx.save(); ctx.translate(f.x, f.y - (1 - a) * 18); ctx.scale(sc, sc);
      if (this.img) ctx.drawImage(this.img['card-' + f.suit], -20, -26, 40, 52);
      else ctx.drawImage(s.c, -s.ox, -s.oy, s.w, s.h);
      ctx.restore();
    } else if (f.k === 'flash') {
      var g = this.sprites.hatGlow, fs = 1 + (1 - a) * 2.2;
      ctx.globalAlpha = a;
      ctx.save(); ctx.translate(f.x, f.y); ctx.scale(fs, fs); ctx.drawImage(g.c, -g.ox, -g.oy, g.w, g.h); ctx.restore();
    } else if (f.k === 'text') {
      ctx.globalAlpha = Math.min(1, a * 1.6);
      ctx.font = (f.big ? '900 34px ' : '900 26px ') + '"Rye", "Zilla Slab", Georgia, serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.lineJoin = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = '#3B2314';
      ctx.strokeText(f.text, f.x, f.y);
      ctx.fillStyle = f.big ? '#FFE27A' : '#FFFFFF';
      ctx.fillText(f.text, f.x, f.y);
    } else if (f.k === 'stars' && !this.img) {
      var x = this.horseX + 4, y = this.view.groundY - world.horse.y - 190;
      ctx.globalAlpha = a;
      for (var i = 0; i < 4; i++) {
        var an = this.time * 6 + i * TAU / 4, px = x + Math.cos(an) * 26, py = y + Math.sin(an) * 8;
        star(ctx, px, py, 7, '#FFD35C');
      }
    }
    ctx.globalAlpha = 1;
  };

  function star(ctx, x, y, r, col) {
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? r * 0.45 : r;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.lineWidth = 2; ctx.strokeStyle = '#3B2314'; ctx.stroke();
    ctx.fillStyle = col; ctx.fill();
  }

  WR.Renderer = Renderer;
})(window, document);
