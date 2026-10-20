/**
 * WESTERN RUNNER · Arte vectorial original
 * ---------------------------------------
 * Todo se dibuja con Canvas 2D: no hay imágenes externas. Los objetos pequeños se
 * pre-renderizan en sprites a la resolución de la pantalla; el escenario usa Path2D
 * en unidades de mundo, así se ve nítido a cualquier tamaño sin gastar memoria.
 * Convención: y negativa hacia arriba, origen a ras de suelo.
 */
(function (w, d) {
  'use strict';
  var WR = (w.WR = w.WR || {});
  var TAU = Math.PI * 2;
  var INK = '#3B2314';

  var C = {
    horse: '#8A5530', horseDark: '#6A3E22', horseFar: '#5E361D', horseLight: '#A86C40', muzzle: '#9C6642',
    mane: '#3A2216', hoof: '#2A1A10',
    skin: '#F2C08F', skinShade: '#D99E6C', hair: '#5A3418',
    shirt: '#F6EEDF', shirtShade: '#DCCDB4', jeans: '#2F3B5C', jeansShade: '#232C46',
    boot: '#6B3F1D', hat: '#8B5A2B', hatDark: '#6B3F1D', hatBand: '#3E2414',
    scarf: '#D9362B', scarfDark: '#AE2620', blanket: '#C9853F', blanketStripe: '#8F2F22', saddle: '#7B4524',
    card: '#FFF8EC', red: '#D6322A', black: '#2B1E17',
    cactus: '#5DA33E', cactusShade: '#47862F', cactusLight: '#7CC052'
  };
  WR.COLORS = C;

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function lerp(a, b, t) { return a + (b - a) * t; }

  function rrPath(p, x, y, wd, h, r) {
    p.moveTo(x + r, y);
    p.arcTo(x + wd, y, x + wd, y + h, r);
    p.arcTo(x + wd, y + h, x, y + h, r);
    p.arcTo(x, y + h, x, y, r);
    p.arcTo(x, y, x + wd, y, r);
    p.closePath();
  }

  /* Rellena una forma con contorno de tinta. Si varias piezas comparten path,
     el contorno interior queda oculto bajo el relleno (unión limpia). */
  function inked(ctx, path, fill, lw) {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = (lw || 2.4) * 2;
    ctx.strokeStyle = INK;
    ctx.stroke(path);
    ctx.fillStyle = fill;
    ctx.fill(path);
  }

  function ellipse(p, x, y, rx, ry, rot) { p.moveTo(x + rx * Math.cos(rot || 0), y + rx * Math.sin(rot || 0)); p.ellipse(x, y, rx, ry, rot || 0, 0, TAU); }
  function circle(p, x, y, r) { p.moveTo(x + r, y); p.arc(x, y, r, 0, TAU); }

  /* ================= CABALLO Y JINETE ================= */

  function leg(ctx, hx, hy, a1, a2, l1, l2, color, lw) {
    var kx = hx + Math.sin(a1) * l1, ky = hy + Math.cos(a1) * l1;
    var a = a1 + a2, fx = kx + Math.sin(a) * l2, fy = ky + Math.cos(a) * l2;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(kx, ky); ctx.lineTo(fx, fy);
    ctx.strokeStyle = INK; ctx.lineWidth = lw + 4.6; ctx.stroke();
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.stroke();
    // casco
    ctx.save(); ctx.translate(fx, fy); ctx.rotate(-a);
    ctx.beginPath(); ctx.moveTo(-5, -2); ctx.lineTo(5, -2); ctx.lineTo(6, 5); ctx.lineTo(-6, 5); ctx.closePath();
    ctx.lineWidth = 2.2; ctx.strokeStyle = INK; ctx.stroke(); ctx.fillStyle = C.hoof; ctx.fill();
    ctx.restore();
  }

  /**
   * pose: { phase 0..1 (ciclo de galope), air bool, k -1..1 (vy/v0), scarf seg, hurt 0..1 }
   */
  WR.drawRider = function (ctx, pose) {
    var th = pose.phase * TAU, air = pose.air, k = pose.k || 0, s = pose.scarf || 0;
    var bob = air ? 0 : -2.5 - 2.5 * Math.cos(th * 2);
    var rot = air ? -k * 0.17 : 0.03 * Math.sin(th * 2);
    if (pose.hurt) rot += -0.12 * pose.hurt;

    ctx.save();
    ctx.translate(0, bob);
    ctx.rotate(rot);

    // ---- Patas (detrás del cuerpo) ----
    var fA1, fA2, fB1, fB2, hA1, hA2, hB1, hB2;
    if (air) {
      var up = clamp(k * 1.4, -1, 1), tuck = up > 0 ? 1 : 1 + up; // 1 = recogidas, 0 = listas para aterrizar
      fA1 = lerp(0.6, 1.15, tuck); fA2 = lerp(-0.25, -1.9, tuck);
      fB1 = fA1 - 0.18; fB2 = fA2 + 0.15;
      hA1 = lerp(-0.45, -1.0, tuck); hA2 = lerp(0.35, 0.55, tuck);
      hB1 = hA1 + 0.15; hB2 = hA2;
    } else {
      var f1 = th, f2 = th + 0.55, h1 = th + Math.PI, h2 = th + Math.PI + 0.55;
      fA1 = 0.2 + 0.62 * Math.sin(f1); fA2 = -0.08 - 1.45 * Math.max(0, Math.cos(f1));
      fB1 = 0.2 + 0.62 * Math.sin(f2); fB2 = -0.08 - 1.45 * Math.max(0, Math.cos(f2));
      hA1 = -0.3 + 0.55 * Math.sin(h1); hA2 = 0.42 + 0.75 * Math.max(0, Math.cos(h1));
      hB1 = -0.3 + 0.55 * Math.sin(h2); hB2 = 0.42 + 0.75 * Math.max(0, Math.cos(h2));
    }
    leg(ctx, -36, -64, hB1, hB2, 27, 30, C.horseFar, 9);
    leg(ctx, 26, -62, fB1, fB2, 27, 30, C.horseFar, 8.5);

    // ---- Cola ----
    var tw = air ? -0.5 : Math.sin(th * 2) * 0.18;
    ctx.save(); ctx.translate(-52, -82); ctx.rotate(0.35 + tw);
    var tail = new Path2D();
    tail.moveTo(0, -6);
    tail.quadraticCurveTo(-26, -6, -40, 16);
    tail.quadraticCurveTo(-30, 8, -32, 26);
    tail.quadraticCurveTo(-18, 10, -8, 18);
    tail.quadraticCurveTo(-6, 6, 4, 6);
    tail.closePath();
    inked(ctx, tail, C.mane, 2);
    ctx.restore();

    // ---- Patas cercanas ----
    leg(ctx, -30, -62, hA1, hA2, 27, 30, C.horse, 9.5);
    leg(ctx, 32, -60, fA1, fA2, 27, 30, C.horse, 9);

    // ---- Cuerpo, cuello y cabeza (una sola silueta) ----
    var nb = air ? 0 : Math.sin(th * 2 + 0.6) * 2;
    var body = new Path2D();
    ellipse(body, 0, -76, 47, 22);
    circle(body, 30, -76, 22);
    circle(body, -34, -79, 21);
    body.moveTo(12, -92); body.quadraticCurveTo(28, -112, 44, -132 + nb); body.lineTo(68, -120 + nb); body.quadraticCurveTo(58, -90, 52, -62); body.closePath();
    ellipse(body, 70, -118 + nb, 22, 12, 0.62);
    circle(body, 83, -104 + nb, 10.5);
    body.moveTo(54, -130 + nb); body.lineTo(57, -150 + nb); body.lineTo(65, -132 + nb); body.closePath();
    inked(ctx, body, C.horse, 2.4);

    // sombras y luces del pelaje
    ctx.save(); ctx.clip(body);
    ctx.fillStyle = C.horseDark;
    ctx.beginPath(); ctx.ellipse(-4, -58, 56, 16, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = C.horseLight; ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.ellipse(-6, -94, 34, 7, -0.05, 0, TAU); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = C.muzzle;
    ctx.beginPath(); ctx.arc(85, -103 + nb, 9, 0, TAU); ctx.fill();
    ctx.restore();

    // ojo, ollar y boca
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(69, -123 + nb, 3.6, 0, TAU); ctx.fill();
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.arc(70.2, -123 + nb, 2.1, 0, TAU); ctx.fill();
    ctx.beginPath(); ctx.arc(88, -106 + nb, 1.7, 0, TAU); ctx.fill();
    ctx.lineWidth = 1.6; ctx.strokeStyle = INK;
    ctx.beginPath(); ctx.moveTo(80, -97 + nb); ctx.quadraticCurveTo(86, -95 + nb, 90, -98 + nb); ctx.stroke();

    // crin al viento
    var mw = air ? 3 : Math.sin(th * 2) * 2;
    var mane = new Path2D();
    mane.moveTo(54, -136 + nb);
    mane.quadraticCurveTo(38, -128, 26, -110);
    mane.lineTo(18 - mw, -108);
    mane.lineTo(22, -102);
    mane.lineTo(10 - mw, -98);
    mane.lineTo(16, -93);
    mane.quadraticCurveTo(30, -110, 47, -128 + nb);
    mane.lineTo(40 - mw, -126 + nb);
    mane.lineTo(50, -124 + nb);
    mane.closePath();
    inked(ctx, mane, C.mane, 1.8);
    var fore = new Path2D();
    fore.moveTo(58, -134 + nb); fore.quadraticCurveTo(66, -132 + nb, 70, -136 + nb); fore.quadraticCurveTo(64, -128 + nb, 60, -128 + nb); fore.closePath();
    inked(ctx, fore, C.mane, 1.4);

    // riendas
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(80, -101 + nb); ctx.quadraticCurveTo(52, -102, 34, -110); ctx.stroke();

    // ---- Manta y silla ----
    var bl = new Path2D(); rrPath(bl, -22, -104, 40, 22, 5);
    inked(ctx, bl, C.blanket, 2);
    ctx.fillStyle = C.blanketStripe; ctx.fillRect(-21, -90, 38, 3.5);
    var sd = new Path2D();
    sd.moveTo(-18, -104); sd.quadraticCurveTo(-12, -96, 0, -98); sd.quadraticCurveTo(10, -98, 14, -108);
    sd.lineTo(10, -102); sd.quadraticCurveTo(0, -92, -16, -96); sd.closePath();
    inked(ctx, sd, C.saddle, 1.8);

    // ---- Jinete ----
    var lean = air ? 0.36 : 0.28 + 0.03 * Math.sin(th * 2);
    if (pose.hurt) lean -= 0.4 * pose.hurt;
    var rb = air ? -3 : Math.sin(th * 2 + 1.2) * 1.5;

    ctx.save();
    ctx.translate(0, -100 + rb);
    ctx.scale(1.12, 1.12);

    // bufanda al viento (detrás del cuerpo)
    ctx.save(); ctx.rotate(lean);
    var sw1 = Math.sin(s * 9) * 4, sw2 = Math.sin(s * 9 + 1.6) * 6;
    var scarf = new Path2D();
    scarf.moveTo(2, -36);
    scarf.quadraticCurveTo(-16, -42 + sw1, -34, -36 + sw1);
    scarf.quadraticCurveTo(-44, -36 + sw2, -54, -26 + sw2);
    scarf.quadraticCurveTo(-40, -28 + sw2, -32, -28 + sw1);
    scarf.quadraticCurveTo(-16, -28, 2, -30);
    scarf.closePath();
    inked(ctx, scarf, C.scarf, 1.8);
    ctx.restore();

    // pierna (lado cercano)
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-2, -4); ctx.lineTo(16, 6); ctx.lineTo(12, 28);
    ctx.strokeStyle = INK; ctx.lineWidth = 15; ctx.stroke();
    ctx.strokeStyle = C.jeans; ctx.lineWidth = 10.5; ctx.stroke();
    var boot = new Path2D();
    boot.moveTo(6, 24); boot.lineTo(17, 24); boot.lineTo(18, 32); boot.lineTo(26, 34); boot.lineTo(26, 38); boot.lineTo(6, 38); boot.closePath();
    inked(ctx, boot, C.boot, 1.8);

    // torso
    ctx.save(); ctx.rotate(lean);
    var torso = new Path2D();
    torso.moveTo(-9, 0); torso.lineTo(-11, -30); torso.quadraticCurveTo(-8, -40, 2, -40);
    torso.quadraticCurveTo(12, -40, 12, -30); torso.lineTo(9, 0); torso.closePath();
    inked(ctx, torso, C.shirt, 2.2);
    ctx.save(); ctx.clip(torso);
    ctx.fillStyle = C.shirtShade; ctx.fillRect(-12, -40, 7, 40);
    ctx.restore();
    var belt = new Path2D(); rrPath(belt, -10, -6, 20, 5, 1.5);
    inked(ctx, belt, C.boot, 1.2);
    ctx.fillStyle = '#E8C060'; ctx.fillRect(-2, -5.4, 4, 3.8);

    // nudo de la bufanda
    var knot = new Path2D(); ellipse(knot, 3, -36, 9, 5, 0.1);
    inked(ctx, knot, C.scarf, 1.6);

    // brazo hacia las riendas
    ctx.beginPath(); ctx.moveTo(4, -32); ctx.lineTo(16, -16); ctx.lineTo(30, -16);
    ctx.strokeStyle = INK; ctx.lineWidth = 12; ctx.stroke();
    ctx.strokeStyle = C.shirt; ctx.lineWidth = 7.6; ctx.stroke();
    var hand = new Path2D(); circle(hand, 31, -16, 4.6);
    inked(ctx, hand, C.skin, 1.5);

    // cabeza
    ctx.translate(4, -52);
    var head = new Path2D(); ellipse(head, 0, 0, 11, 12);
    inked(ctx, head, C.skin, 2.2);
    ctx.save(); ctx.clip(head);
    ctx.fillStyle = C.hair; ctx.beginPath(); ctx.ellipse(-8, -2, 7, 12, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = C.skinShade; ctx.beginPath(); ctx.ellipse(-2, 9, 10, 4, 0, 0, TAU); ctx.fill();
    ctx.restore();
    ctx.fillStyle = INK;
    ctx.beginPath(); ctx.ellipse(6, -1, 1.6, 2.4, 0, 0, TAU); ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = INK;
    ctx.beginPath(); ctx.moveTo(3, -5); ctx.lineTo(8, -6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, 6); ctx.quadraticCurveTo(7, 7.5, 9, 5.5); ctx.stroke();
    var ear = new Path2D(); ellipse(ear, -4, 1, 2.6, 3.6);
    inked(ctx, ear, C.skin, 1.2);

    // sombrero
    ctx.rotate(-0.08);
    WR.drawHatShape(ctx, 1, -9, 1.0);
    ctx.restore(); // torso

    ctx.restore(); // jinete
    ctx.restore(); // caballo
  };

  /* Sombrero vaquero: centro de la base de la copa en (x, y). */
  WR.drawHatShape = function (ctx, x, y, sc) {
    ctx.save(); ctx.translate(x, y); ctx.scale(sc, sc);
    var brim = new Path2D();
    brim.moveTo(-26, -6);
    brim.quadraticCurveTo(-24, 3, 0, 3);
    brim.quadraticCurveTo(24, 3, 26, -6);
    brim.quadraticCurveTo(22, -2, 0, -2);
    brim.quadraticCurveTo(-22, -2, -26, -6);
    brim.closePath();
    var crown = new Path2D();
    crown.moveTo(-13, -1); crown.lineTo(-12, -16);
    crown.quadraticCurveTo(-7, -24, -2, -18);
    crown.quadraticCurveTo(0, -21, 2, -18);
    crown.quadraticCurveTo(7, -24, 12, -16);
    crown.lineTo(13, -1); crown.closePath();
    inked(ctx, crown, C.hat, 2);
    ctx.save(); ctx.clip(crown);
    ctx.fillStyle = C.hatDark; ctx.fillRect(4, -26, 12, 28);
    ctx.fillStyle = C.hatBand; ctx.fillRect(-14, -6, 28, 5);
    ctx.restore();
    inked(ctx, brim, C.hat, 2);
    ctx.save(); ctx.clip(brim);
    ctx.fillStyle = C.hatDark; ctx.fillRect(-28, 0, 56, 4);
    ctx.restore();
    ctx.restore();
  };

  /* ================= SPRITES PRE-RENDERIZADOS ================= */

  function sprite(wd, h, ox, oy, S, draw) {
    var c = d.createElement('canvas');
    c.width = Math.max(1, Math.ceil(wd * S));
    c.height = Math.max(1, Math.ceil(h * S));
    var x = c.getContext('2d');
    x.scale(S, S);
    x.translate(ox, oy);
    draw(x);
    return { c: c, w: wd, h: h, ox: ox, oy: oy };
  }

  function suitPath(suit, sz) {
    var p = new Path2D(), s = sz;
    if (suit === 0) { // corazón
      p.moveTo(0, s * 0.42);
      p.bezierCurveTo(-s * 0.95, -s * 0.18, -s * 0.5, -s * 0.9, 0, -s * 0.38);
      p.bezierCurveTo(s * 0.5, -s * 0.9, s * 0.95, -s * 0.18, 0, s * 0.42);
    } else if (suit === 1) { // diamante
      p.moveTo(0, -s * 0.55); p.lineTo(s * 0.42, 0); p.lineTo(0, s * 0.55); p.lineTo(-s * 0.42, 0);
    } else if (suit === 2) { // pica
      p.moveTo(0, -s * 0.56);
      p.bezierCurveTo(s * 0.95, s * 0.02, s * 0.5, s * 0.62, 0, s * 0.18);
      p.bezierCurveTo(-s * 0.5, s * 0.62, -s * 0.95, s * 0.02, 0, -s * 0.56);
      p.moveTo(0, s * 0.1); p.lineTo(s * 0.18, s * 0.58); p.lineTo(-s * 0.18, s * 0.58);
    } else { // trébol
      circle(p, 0, -s * 0.26, s * 0.23); circle(p, -s * 0.26, s * 0.06, s * 0.23); circle(p, s * 0.26, s * 0.06, s * 0.23);
      p.moveTo(0, -s * 0.05); p.lineTo(s * 0.17, s * 0.58); p.lineTo(-s * 0.17, s * 0.58);
    }
    p.closePath();
    return p;
  }

  WR.drawCard = function (ctx, suit, glow) {
    var cw = 36, chh = 50;
    var body = new Path2D(); rrPath(body, -cw / 2, -chh / 2, cw, chh, 5);
    if (glow) {
      var tr = ctx.getTransform ? ctx.getTransform().a : 2;
      ctx.save(); ctx.shadowColor = 'rgba(255,165,40,1)'; ctx.shadowBlur = 11 * tr;
      ctx.fillStyle = '#FFC861'; ctx.fill(body); ctx.restore();
    }
    inked(ctx, body, C.card, 2);
    var col = suit < 2 ? C.red : C.black;
    ctx.lineWidth = 1.2; ctx.strokeStyle = suit < 2 ? 'rgba(214,50,42,.45)' : 'rgba(43,30,23,.35)';
    var inner = new Path2D(); rrPath(inner, -cw / 2 + 4, -chh / 2 + 4, cw - 8, chh - 8, 3); ctx.stroke(inner);
    ctx.fillStyle = col;
    ctx.fill(suitPath(suit, 20));
    ctx.save(); ctx.translate(-11, -16); ctx.fill(suitPath(suit, 7)); ctx.restore();
    ctx.save(); ctx.translate(11, 16); ctx.rotate(Math.PI); ctx.fill(suitPath(suit, 7)); ctx.restore();
  };

  function drawBarrel(x) {
    var b = new Path2D();
    b.moveTo(5, 0); b.quadraticCurveTo(-3, -30, 5, -60); b.lineTo(43, -60); b.quadraticCurveTo(51, -30, 43, 0); b.closePath();
    inked(x, b, '#A2622F', 2.4);
    x.save(); x.clip(b);
    x.fillStyle = '#7E4A22'; x.fillRect(34, -62, 16, 64);
    x.fillStyle = '#BE7B43'; x.fillRect(8, -62, 6, 64);
    x.strokeStyle = 'rgba(59,35,20,.55)'; x.lineWidth = 1.6;
    [16, 24, 32].forEach(function (sx) { x.beginPath(); x.moveTo(sx, 0); x.quadraticCurveTo(sx - 1, -30, sx, -60); x.stroke(); });
    x.fillStyle = '#5E5F66';
    [-9, -51].forEach(function (yy) { x.fillRect(-2, yy - 3, 54, 6); });
    x.fillStyle = '#8A8C94';
    [-9, -51].forEach(function (yy) { x.fillRect(-2, yy - 3, 54, 1.8); });
    x.restore();
    x.strokeStyle = INK; x.lineWidth = 1.8;
    [-9, -51].forEach(function (yy) {
      x.beginPath(); x.moveTo(yy === -9 ? 3 : 3, yy - 3); x.lineTo(45, yy - 3); x.moveTo(3, yy + 3); x.lineTo(45, yy + 3); x.stroke();
    });
    var top = new Path2D(); ellipse(top, 24, -60, 19, 3.5);
    inked(x, top, '#C08550', 1.6);
  }

  function drawCrate(x) {
    var b = new Path2D(); rrPath(b, 0, -56, 56, 56, 3);
    inked(x, b, '#B47A3E', 2.4);
    x.save(); x.clip(b);
    x.fillStyle = '#8F5C2C';
    x.fillRect(0, -56, 56, 8); x.fillRect(0, -8, 56, 8); x.fillRect(0, -56, 8, 56); x.fillRect(48, -56, 8, 56);
    x.strokeStyle = 'rgba(59,35,20,.4)'; x.lineWidth = 1.2;
    for (var i = 1; i < 4; i++) { x.beginPath(); x.moveTo(8, -8 - i * 10); x.lineTo(48, -8 - i * 10); x.stroke(); }
    x.restore();
    x.strokeStyle = INK; x.lineWidth = 1.8;
    x.strokeRect(8, -48, 40, 40);
    var dg = new Path2D();
    dg.moveTo(9, -14); dg.lineTo(14, -9); dg.lineTo(47, -42); dg.lineTo(42, -47); dg.closePath();
    dg.moveTo(42, -9); dg.lineTo(47, -14); dg.lineTo(14, -47); dg.lineTo(9, -42); dg.closePath();
    inked(x, dg, '#9D6632', 1.5);
    x.fillStyle = INK;
    [[4, -52], [52, -52], [4, -4], [52, -4]].forEach(function (p) { x.beginPath(); x.arc(p[0], p[1], 1.5, 0, TAU); x.fill(); });
  }

  function drawRock(x) {
    var r = new Path2D();
    r.moveTo(2, 0); r.quadraticCurveTo(-2, -22, 14, -34); r.quadraticCurveTo(26, -48, 44, -44);
    r.quadraticCurveTo(62, -42, 68, -24); r.quadraticCurveTo(76, -10, 72, 0); r.closePath();
    inked(x, r, '#B8653C', 2.4);
    x.save(); x.clip(r);
    x.fillStyle = '#93492A'; x.beginPath(); x.ellipse(56, -4, 30, 22, -0.3, 0, TAU); x.fill();
    x.fillStyle = '#D9824F'; x.beginPath(); x.ellipse(30, -38, 20, 7, -0.25, 0, TAU); x.fill();
    x.restore();
    x.strokeStyle = 'rgba(59,35,20,.6)'; x.lineWidth = 1.6;
    x.beginPath(); x.moveTo(36, -42); x.lineTo(32, -28); x.lineTo(38, -18); x.stroke();
    x.beginPath(); x.moveTo(58, -30); x.lineTo(52, -20); x.stroke();
  }

  function bale(x, bx, by, bw, bh) {
    var b = new Path2D(); rrPath(b, bx, by - bh, bw, bh, 5);
    inked(x, b, '#E4B94A', 2.2);
    x.save(); x.clip(b);
    x.fillStyle = '#F3D57D'; x.fillRect(bx, by - bh, bw, 6);
    x.fillStyle = '#C7952D'; x.fillRect(bx, by - 6, bw, 6);
    x.strokeStyle = 'rgba(150,100,30,.55)'; x.lineWidth = 1.1;
    for (var i = 0; i < 6; i++) {
      var yy = by - bh + 8 + i * (bh - 12) / 6;
      x.beginPath(); x.moveTo(bx + 3, yy); x.lineTo(bx + bw * 0.35, yy + 1.5); x.moveTo(bx + bw * 0.55, yy - 1); x.lineTo(bx + bw - 3, yy); x.stroke();
    }
    x.fillStyle = '#9B6B2A';
    x.fillRect(bx + bw * 0.28, by - bh, 3, bh); x.fillRect(bx + bw * 0.66, by - bh, 3, bh);
    x.restore();
  }
  function drawHay(x) { bale(x, 0, 0, 46, 44); bale(x, 46, 0, 46, 44); }
  function drawHayStack(x) { bale(x, 0, 0, 42, 37); bale(x, 42, 0, 42, 37); bale(x, 21, -37, 42, 37); }

  function drawFence(x) {
    var wood = '#8E5B30';
    var rails = new Path2D();
    rrPath(rails, 0, -46, 84, 11, 2);
    rrPath(rails, 0, -22, 84, 11, 2);
    inked(x, rails, '#A36B3A', 2);
    var brace = new Path2D();
    brace.moveTo(14, -12); brace.lineTo(20, -10); brace.lineTo(70, -42); brace.lineTo(64, -46); brace.closePath();
    inked(x, brace, '#9A6334', 1.8);
    var posts = new Path2D();
    rrPath(posts, 4, -58, 13, 58, 2);
    rrPath(posts, 67, -58, 13, 58, 2);
    inked(x, posts, wood, 2.2);
    x.save(); x.clip(posts);
    x.fillStyle = '#6E4324'; x.fillRect(12, -60, 6, 60); x.fillRect(75, -60, 6, 60);
    x.restore();
    x.strokeStyle = 'rgba(59,35,20,.45)'; x.lineWidth = 1.2;
    x.beginPath(); x.moveTo(24, -41); x.lineTo(60, -40); x.moveTo(26, -17); x.lineTo(58, -16); x.stroke();
  }

  WR.OBSTACLE_ART = { barrel: drawBarrel, crate: drawCrate, rock: drawRock, hay: drawHay, hayStack: drawHayStack, fence: drawFence };

  WR.makeSprites = function (S, cfg) {
    var pad = 10, out = { cards: [], cardsGlow: [], obstacles: {} };
    for (var s = 0; s < 4; s++) {
      out.cards.push(sprite(36 + pad * 2, 50 + pad * 2, 18 + pad, 25 + pad, S, (function (su) { return function (x) { WR.drawCard(x, su, false); }; })(s)));
      out.cardsGlow.push(sprite(36 + 40, 50 + 40, 38, 45, S, (function (su) { return function (x) { WR.drawCard(x, su, true); }; })(s)));
    }
    for (var k in cfg.obstacles) {
      var o = cfg.obstacles[k];
      out.obstacles[k] = sprite(o.w + pad * 2, o.h + pad * 2, pad, o.h + pad, S, WR.OBSTACLE_ART[k]);
    }
    out.hat = sprite(64 + pad * 2, 40 + pad * 2, 32 + pad, 22 + pad, S, function (x) { WR.drawHatShape(x, 0, 6, 1.2); });
    out.hatGlow = sprite(140, 140, 70, 70, S, function (x) {
      var g = x.createRadialGradient(0, 0, 4, 0, 0, 66);
      g.addColorStop(0, 'rgba(255,236,140,.95)'); g.addColorStop(0.35, 'rgba(255,200,70,.55)'); g.addColorStop(1, 'rgba(255,170,40,0)');
      x.fillStyle = g;
      x.beginPath();
      for (var i = 0; i < 14; i++) {
        var a = i / 14 * TAU, a2 = a + TAU / 28;
        x.moveTo(0, 0); x.lineTo(Math.cos(a) * 66, Math.sin(a) * 66); x.lineTo(Math.cos(a2) * 66, Math.sin(a2) * 66);
      }
      x.fill();
      x.beginPath(); x.arc(0, 0, 34, 0, TAU); x.fill();
    });
    return out;
  };

  /* Icono pequeño en un canvas para la pantalla "Cómo jugar". */
  WR.icon = function (wd, h, ox, oy, scale, draw) {
    var dpr = Math.min(w.devicePixelRatio || 1, 2);
    var c = sprite(wd / scale, h / scale, ox / scale, oy / scale, dpr * scale, draw).c;
    c.style.width = wd + 'px'; c.style.height = h + 'px';
    return c;
  };

  /* ================= ESCENARIO (Path2D en unidades) ================= */

  function rngFrom(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* Meseta: silueta de base ancha, talud, acantilado y cima plana. */
  function mesa(p, x, wd, h, r) {
    var top = -h, talus = h * 0.32, cliffIn = wd * 0.16;
    p.moveTo(x, 0);
    p.lineTo(x + cliffIn * 0.6, -talus * 0.6);
    p.lineTo(x + cliffIn, -talus);
    p.lineTo(x + cliffIn * 1.15, top + h * 0.12 * r());
    p.lineTo(x + cliffIn * 1.3, top);
    p.lineTo(x + wd - cliffIn * 1.3, top + 4 * r());
    p.lineTo(x + wd - cliffIn * 1.1, top + h * 0.1);
    p.lineTo(x + wd - cliffIn, -talus);
    p.lineTo(x + wd - cliffIn * 0.5, -talus * 0.5);
    p.lineTo(x + wd, 0);
    p.closePath();
  }
  /* Aguja de roca (butte estrecha). */
  function spire(p, x, wd, h) {
    p.moveTo(x, 0);
    p.lineTo(x + wd * 0.3, -h * 0.3);
    p.lineTo(x + wd * 0.36, -h);
    p.lineTo(x + wd * 0.64, -h + 6);
    p.lineTo(x + wd * 0.7, -h * 0.3);
    p.lineTo(x + wd, 0);
    p.closePath();
  }

  function cactusPath(p, x, h, sc, r) {
    var tw = 14 * sc;
    rrPath(p, x - tw / 2, -h, tw, h, tw / 2);
    var arms = 1 + Math.floor(r() * 2);
    for (var i = 0; i < arms; i++) {
      var left = i === 0 ? r() < 0.5 : true;
      if (i === 1) left = !left;
      var ay = -h * (0.35 + r() * 0.25), aw = 11 * sc, ah = h * (0.22 + r() * 0.18), ax = left ? x - tw / 2 - aw : x + tw / 2;
      rrPath(p, Math.min(ax, ax + aw) - (left ? 0 : 2), ay - 9 * sc, aw + 4, 9 * sc, 4 * sc);
      var vx = left ? ax : ax + aw - 9 * sc + 2;
      rrPath(p, vx, ay - ah, 10 * sc, ah, 5 * sc);
    }
  }

  function cloudPath(p, x, y, sc) {
    circle(p, x, y, 22 * sc); circle(p, x + 26 * sc, y - 12 * sc, 28 * sc); circle(p, x + 58 * sc, y - 4 * sc, 24 * sc);
    circle(p, x + 80 * sc, y + 4 * sc, 16 * sc);
    rrPath(p, x - 12 * sc, y, 106 * sc, 18 * sc, 9 * sc);
  }

  WR.buildScenery = function (seed) {
    var r = rngFrom(seed || 7), L = {};

    // Nubes
    var clouds = new Path2D(), cloudShade = new Path2D(), TW = 1800;
    for (var i = 0; i < 5; i++) {
      var cx = i * TW / 5 + r() * 160, cy = r() * 110, sc = 0.7 + r() * 0.6;
      [-TW, 0, TW].forEach(function (o) { cloudPath(clouds, cx + o, cy, sc); rrPath(cloudShade, cx + o - 10 * sc, cy + 8 * sc, 104 * sc, 10 * sc, 5 * sc); });
    }
    L.clouds = { tile: TW, path: clouds, shade: cloudShade };

    // Mesetas lejanas
    var far = new Path2D(), FW = 1600, x = 0;
    while (x < FW) {
      var wd = 160 + r() * 260, h = 110 + r() * 120;
      [-FW, 0, FW].forEach(function (o) { r() < 0.25 ? spire(far, x + o, wd * 0.5, h * 1.05) : mesa(far, x + o, wd, h, function () { return 0.5; }); });
      x += wd * (0.65 + r() * 0.5);
    }
    L.far = { tile: FW, path: far };

    // Mesetas medias con estratos y un arco
    var mid = new Path2D(), midShade = new Path2D(), midLight = new Path2D(), MW = 1500;
    x = 40;
    var arcDone = false;
    while (x < MW - 100) {
      var mw = 150 + r() * 200, mh = 90 + r() * 120;
      var shapes = function (o) {
        var p0 = x + o;
        if (!arcDone && x > 600) {
          // arco natural
          mid.moveTo(p0, 0); mid.lineTo(p0 + 24, -mh * 0.9); mid.lineTo(p0 + 40, -mh); mid.lineTo(p0 + 170, -mh + 6);
          mid.lineTo(p0 + 188, -mh * 0.85); mid.lineTo(p0 + 200, 0); mid.lineTo(p0 + 160, 0);
          mid.quadraticCurveTo(p0 + 150, -mh * 0.7, p0 + 100, -mh * 0.7);
          mid.quadraticCurveTo(p0 + 52, -mh * 0.7, p0 + 44, 0); mid.closePath();
          midShade.moveTo(p0, 0); midShade.lineTo(p0 + 24, -mh * 0.9); midShade.lineTo(p0 + 40, -mh); midShade.lineTo(p0 + 50, -mh); midShade.lineTo(p0 + 44, 0); midShade.closePath();
          midLight.moveTo(p0 + 40, -mh); midLight.lineTo(p0 + 170, -mh + 6); midLight.lineTo(p0 + 168, -mh + 13); midLight.lineTo(p0 + 42, -mh + 8); midLight.closePath();
        } else {
          mesa(mid, p0, mw, mh, function () { return 0.4; });
          var cin = mw * 0.16;
          // cara en sombra (luz desde la derecha)
          midShade.moveTo(p0, 0); midShade.lineTo(p0 + cin, -mh * 0.32); midShade.lineTo(p0 + cin * 1.3, -mh);
          midShade.lineTo(p0 + cin * 1.3 + mw * 0.12, -mh); midShade.lineTo(p0 + cin * 1.2 + mw * 0.1, -mh * 0.32); midShade.lineTo(p0 + cin + mw * 0.2, 0); midShade.closePath();
          midLight.moveTo(p0 + cin * 1.3, -mh); midLight.lineTo(p0 + mw - cin * 1.3, -mh + 1.6); midLight.lineTo(p0 + mw - cin * 1.3, -mh + 8); midLight.lineTo(p0 + cin * 1.4, -mh + 7); midLight.closePath();
          // estratos
          for (var sI = 1; sI < 3; sI++) { var yy = -mh * (0.32 + sI * 0.2); midLight.rect(p0 + cin * 1.25 + 8, yy, mw - cin * 2.6 - 16, 2.2); }
        }
      };
      [-MW, 0, MW].forEach(shapes);
      if (!arcDone && x > 600) { arcDone = true; x += 230; } else x += mw * (0.8 + r() * 0.5);
    }
    L.mid = { tile: MW, path: mid, shade: midShade, light: midLight };

    // Colinas cercanas, cactus y rocas
    var hills = new Path2D(), cacti = new Path2D(), cactShade = new Path2D(), rocks = new Path2D(), HW = 1300;
    hills.moveTo(-HW, 0);
    for (var hx = -HW; hx <= HW * 2; hx += 130) hills.quadraticCurveTo(hx + 65, -30 - ((hx / 130) % 3) * 9, hx + 130, -4);
    hills.lineTo(HW * 2, 30); hills.lineTo(-HW, 30); hills.closePath();
    for (i = 0; i < 6; i++) {
      var px = 60 + i * HW / 6 + r() * 80, ch = 60 + r() * 60, s2 = 0.9 + r() * 0.5;
      var seedArm = r() * 1000;
      [-HW, 0, HW].forEach(function (o) {
        var rr2 = rngFrom(seedArm | 0);
        cactusPath(cacti, px + o, ch, s2, rr2);
        cactShade.rect(px + o + 1, -ch + 6, 4 * s2, ch - 8);
      });
      var rx = px + 90 + r() * 60, rw = 26 + r() * 30;
      [-HW, 0, HW].forEach(function (o) { rocks.moveTo(rx + o, 0); rocks.quadraticCurveTo(rx + o + rw * 0.2, -rw * 0.6, rx + o + rw * 0.55, -rw * 0.5); rocks.quadraticCurveTo(rx + o + rw, -rw * 0.4, rx + o + rw, 0); rocks.closePath(); });
    }
    L.near = { tile: HW, hills: hills, cacti: cacti, cactShade: cactShade, rocks: rocks };

    // Suelo: piedras, grietas, huellas
    var pebbles = new Path2D(), cracks = new Path2D(), tufts = new Path2D(), GW = 1000;
    for (i = 0; i < 46; i++) {
      var gx = r() * GW, gy = 6 + r() * 120, gr = 1.5 + r() * 3.5;
      [-GW, 0, GW].forEach(function (o) { pebbles.moveTo(gx + o + gr, gy); pebbles.ellipse(gx + o, gy, gr * 1.4, gr, 0, 0, TAU); });
    }
    for (i = 0; i < 9; i++) {
      var kx = r() * GW, ky = 20 + r() * 100;
      [-GW, 0, GW].forEach(function (o) { cracks.moveTo(kx + o, ky); cracks.lineTo(kx + o + 14, ky + 4); cracks.lineTo(kx + o + 22, ky + 1); cracks.moveTo(kx + o + 14, ky + 4); cracks.lineTo(kx + o + 18, ky + 10); });
    }
    for (i = 0; i < 12; i++) {
      var tx = r() * GW, ty = 4 + r() * 4;
      [-GW, 0, GW].forEach(function (o) {
        for (var b = -2; b <= 2; b++) { tufts.moveTo(tx + o + b * 3, ty); tufts.lineTo(tx + o + b * 5.5, ty - 10 - Math.abs(2 - Math.abs(b)) * 4); tufts.lineTo(tx + o + b * 3 + 2, ty); }
      });
    }
    L.ground = { tile: GW, pebbles: pebbles, cracks: cracks, tufts: tufts };

    // Primer plano: matas y piedras más grandes
    var fg = new Path2D(), FGW = 1400;
    for (i = 0; i < 7; i++) {
      var fx = r() * FGW, fs = 1 + r() * 0.8;
      [-FGW, 0, FGW].forEach(function (o) {
        for (var b2 = -3; b2 <= 3; b2++) { fg.moveTo(fx + o + b2 * 4 * fs, 0); fg.lineTo(fx + o + b2 * 7 * fs, (-14 - (3 - Math.abs(b2)) * 5) * fs); fg.lineTo(fx + o + b2 * 4 * fs + 3, 0); }
      });
    }
    L.fg = { tile: FGW, path: fg };
    return L;
  };

  /* Dibuja un patrón Path2D repetido horizontalmente con desplazamiento. */
  function tiled(ctx, tile, off, W, fn) {
    var o = ((off % tile) + tile) % tile;
    ctx.save(); ctx.translate(-o, 0);
    for (var x = 0; x - o < W + tile; x += tile) { fn(); ctx.translate(tile, 0); }
    ctx.restore();
  }

  /**
   * view: { W, H, groundY }; scroll en unidades; low = modo de bajo consumo
   */
  WR.drawBackground = function (ctx, L, view, scroll, time, low) {
    var W = view.W, gy = view.groundY;
    // Cielo
    var sky = ctx.createLinearGradient(0, 0, 0, gy);
    sky.addColorStop(0, '#3D97DD'); sky.addColorStop(0.55, '#7EC4EE'); sky.addColorStop(0.86, '#CFE6EE'); sky.addColorStop(1, '#F7D9A3');
    ctx.fillStyle = sky; ctx.fillRect(0, 0, W, gy + 2);

    // Sol
    var sx = W * 0.86, sy = Math.min(gy * 0.2, 110);
    var sg = ctx.createRadialGradient(sx, sy, 20, sx, sy, 90);
    sg.addColorStop(0, 'rgba(255,240,170,.85)'); sg.addColorStop(1, 'rgba(255,240,170,0)');
    ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, 90, 0, TAU); ctx.fill();
    ctx.fillStyle = '#FFD35C'; ctx.beginPath(); ctx.arc(sx, sy, 34, 0, TAU); ctx.fill();

    // Nubes
    if (!low) {
      ctx.save(); ctx.translate(0, Math.max(60, gy * 0.18));
      tiled(ctx, L.clouds.tile, scroll * 0.04 + time * 8, W, function () {
        ctx.fillStyle = '#CFE3F2'; ctx.fill(L.clouds.shade);
        ctx.fillStyle = '#FFFFFF'; ctx.fill(L.clouds.path);
      });
      ctx.restore();
    }

    // Mesetas lejanas
    ctx.save(); ctx.translate(0, gy - 26);
    tiled(ctx, L.far.tile, scroll * 0.08, W, function () { ctx.fillStyle = '#E8A57C'; ctx.fill(L.far.path); });
    ctx.restore();
    // bruma
    var haze = ctx.createLinearGradient(0, gy - 140, 0, gy);
    haze.addColorStop(0, 'rgba(247,217,163,0)'); haze.addColorStop(1, 'rgba(247,210,150,.55)');
    ctx.fillStyle = haze; ctx.fillRect(0, gy - 140, W, 140);

    // Mesetas medias
    ctx.save(); ctx.translate(0, gy - 8);
    tiled(ctx, L.mid.tile, scroll * 0.2, W, function () {
      ctx.lineJoin = 'round'; ctx.lineWidth = 2.4; ctx.strokeStyle = 'rgba(59,35,20,.45)';
      ctx.stroke(L.mid.path);
      ctx.fillStyle = '#D16A3C'; ctx.fill(L.mid.path);
      ctx.fillStyle = '#AE4C2B'; ctx.fill(L.mid.shade);
      ctx.fillStyle = '#E98A53'; ctx.fill(L.mid.light);
    });
    ctx.restore();

    // Colinas cercanas con cactus
    ctx.save(); ctx.translate(0, gy);
    tiled(ctx, L.near.tile, scroll * 0.45, W, function () {
      ctx.fillStyle = '#E39147'; ctx.fill(L.near.hills);
      ctx.lineWidth = 3.6; ctx.strokeStyle = INK; ctx.lineJoin = 'round';
      ctx.stroke(L.near.rocks); ctx.fillStyle = '#B9673E'; ctx.fill(L.near.rocks);
      ctx.stroke(L.near.cacti); ctx.fillStyle = C.cactus; ctx.fill(L.near.cacti);
      ctx.fillStyle = C.cactusShade; ctx.fill(L.near.cactShade);
    });
    ctx.restore();

    // Suelo
    var gr = ctx.createLinearGradient(0, gy, 0, view.H);
    gr.addColorStop(0, '#EDAE63'); gr.addColorStop(0.35, '#E29E55'); gr.addColorStop(1, '#C97B3A');
    ctx.fillStyle = gr; ctx.fillRect(0, gy, W, view.H - gy);
    ctx.fillStyle = 'rgba(59,35,20,.22)'; ctx.fillRect(0, gy, W, 3);
    ctx.save(); ctx.translate(0, gy);
    tiled(ctx, L.ground.tile, scroll, W, function () {
      ctx.fillStyle = 'rgba(150,85,40,.55)'; ctx.fill(L.ground.pebbles);
      ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(120,64,30,.5)'; ctx.stroke(L.ground.cracks);
      ctx.fillStyle = '#8FA545'; ctx.fill(L.ground.tufts);
    });
    ctx.restore();
  };

  WR.drawForeground = function (ctx, L, view, scroll) {
    ctx.save(); ctx.translate(0, view.H + 2);
    tiled(ctx, L.fg.tile, scroll * 1.25, view.W, function () { ctx.fillStyle = '#6E8E33'; ctx.fill(L.fg.path); });
    ctx.restore();
  };
})(window, document);
