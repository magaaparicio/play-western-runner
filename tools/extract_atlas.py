#!/usr/bin/env python3
"""
Recorta la lámina de arte (RGBA con transparencia real) en PNG individuales.

    python3 tools/extract_atlas.py art/atlas.png

La lámina ya trae canal alfa, así que no hace falta quitar fondos. Cada sprite es una
pieza conectada (alfa > 40); los restos pequeños se pegan a la pieza grande más cercana
(cabellos, bordes del pañuelo). Las piezas se identifican por fila y orden de izquierda
a derecha. Si la lámina cambia de distribución, ajusta ROWS y NAMES.

Además calcula la caja de apoyo del caballo (js/assets.js) y, con --upscale, entrega
cada sprite al doble de resolución (Lanczos + nitidez suave) para que el navegador
escale menos y se vea más limpio.
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets"
THR = 40          # umbral de alfa para considerar un píxel como parte de un sprite
BIG = 1200        # área mínima de una pieza "grande"
ATTACH = 10       # distancia máxima (px) para pegar un resto pequeño a una pieza grande

# (y_min, y_max) de cada fila de la lámina y los nombres, de izquierda a derecha.
# None = pieza que no se usa.
ROWS = [
    ((0, 200), [None] * 11),   # el galope viene de art/horse/ (cuadros nuevos, más nítidos)
    ((200, 440), ["jump-takeoff", "horse-jump", "horse-land", "jump-landing",
                  "horse-hurt", "fall-1", "fall-2", "fall-3"]),
    ((440, 632), ["obs-cactus", "obs-crate", "obs-barrel", "obs-hay",
                  "obs-rock", "obs-fence", "obs-wheel", "obs-tumble"]),
    ((632, 776), [None, None, None, None, None, "card-0", "card-1", "card-2", "card-3",
                  "hat-cream", "hat", "hat-black"]),
]
# Piezas grandes de la fila 4 en orden: agave+arbusto, cactus pequeño, roca+árbol seco,
# letrero, cráneo, 4 cartas, 3 sombreros. Solo se usan cartas y sombreros.

MAIN_SIZE = {"horse": 1, "obs": 1}


def main():
    src = Path(sys.argv[1]) if len(sys.argv) > 1 and not sys.argv[1].startswith("--") else ROOT / "art" / "atlas.png"
    upscale = "--upscale" in sys.argv
    rgba = np.asarray(Image.open(src).convert("RGBA"))
    alpha = rgba[..., 3]
    lab, n = ndimage.label(alpha > THR)
    objs = ndimage.find_objects(lab)
    areas = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
    big = [i + 1 for i in range(n) if areas[i] >= BIG]
    # asignar restos pequeños a la pieza grande más cercana
    owner = {i: i for i in big}
    for i in range(1, n + 1):
        if i in owner:
            continue
        s = objs[i - 1]
        best, bd = None, 1e9
        for j in big:
            t = objs[j - 1]
            dx = max(t[1].start - s[1].stop, s[1].start - t[1].stop, 0)
            dy = max(t[0].start - s[0].stop, s[0].start - t[0].stop, 0)
            d = max(dx, dy)
            if d < bd:
                best, bd = j, d
        if best is not None and bd <= ATTACH:
            owner[i] = best
    OUT.mkdir(exist_ok=True)
    meta, files = {}, {}
    for (y0, y1), names in ROWS:
        row = sorted([j for j in big if y0 <= (objs[j - 1][0].start + objs[j - 1][0].stop) / 2 < y1],
                     key=lambda j: objs[j - 1][1].start)
        # En la fila de salto hay rocas y polvo sueltos: se descartan por estar debajo del caballo
        if names[0] == "jump-takeoff":
            row = [j for j in row if objs[j - 1][0].stop - objs[j - 1][0].start >= 100]
        if len(row) != len(names):
            raise SystemExit(f"Fila {y0}-{y1}: se esperaban {len(names)} piezas y hay {len(row)}")
        for name, j in zip(names, row):
            if not name:
                continue
            members = [i for i, o in owner.items() if o == j]
            mask = np.isin(lab, members)
            ys, xs = np.nonzero(mask)
            x0, x1, yy0, yy1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
            crop = rgba[yy0:yy1, x0:x1].copy()
            crop[..., 3] = np.where(mask[yy0:yy1, x0:x1], crop[..., 3], 0)
            img = Image.fromarray(crop, "RGBA")
            if name.startswith("horse-"):
                meta[name] = horse_meta(img)
            if upscale:
                img = img.resize((img.width * 2, img.height * 2), Image.LANCZOS)
                img = img.filter(ImageFilter.UnsharpMask(radius=1.2, percent=60, threshold=2))
                if name in meta:  # la caja de apoyo también se duplica
                    meta[name] = {k: v * 2 for k, v in meta[name].items()}
            img.save(OUT / f"{name}.png", optimize=True)
            print(f"{name:14s} {img.size}")
    # Galope: cuadros sueltos de art/horse/f01..f12.png (transparentes; traen número y restos vecinos)
    # Se usan f01..f08: tienen la misma proporción jinete/patas. f09..f12 están dibujados a otra
    # escala (jinete más bajo respecto a las patas) y al mezclarlos el caballo "salta" entre cuadros.
    frames = [clean_frame(Image.open(f).convert("RGBA")) for f in sorted((ROOT / "art" / "horse").glob("f0[1-8].png"))]
    frames = repair_muzzles(frames)
    # Los cuadros no vienen exactamente a la misma escala: se igualan por área visible
    areas = [float((np.asarray(im)[..., 3] > 128).sum()) for im in frames]
    target = float(np.median(areas))
    for k, im in enumerate(frames):
        name = f"horse-run-{k}"
        f = (target / areas[k]) ** 0.5
        if abs(f - 1) > 0.01:
            im = im.resize((round(im.width * f), round(im.height * f)), Image.LANCZOS)
        im.save(OUT / f"{name}.png", optimize=True)
        meta[name] = horse_meta(im)
        # Ancla horizontal: centro de los jeans (estable), no el centro de la caja (cambia con la cola)
        a = np.asarray(im).astype(int)
        jeans = (a[..., 3] > 128) & (a[..., 2] > a[..., 0] + 25) & (a[..., 2] > 90) & (a[..., 1] > 60)
        jx = int(np.nonzero(jeans)[1].mean())
        meta[name]["x0"] = meta[name]["x1"] = jx
        print(f"{name:14s} {im.size}  escala {f:.3f}")
    # Archivos de interfaz que se conservan fuera de la lámina
    for f in sorted(OUT.glob("*.png")):
        files[f.stem] = f"assets/{f.name}"
    for stale in ("bg-sky", "bg-far", "bg-near", "bg-cactus", "bg-road", "ui-logo", "ui-button",
                  "ui-score", "ui-timer", "ui-parchment", "ui-heart", "ui-pause"):
        files.pop(stale, None)
    for k in list(files):
        if k.startswith(("jump-", "fall-", "hat-", "obs-wheel", "obs-tumble", "obs-cactus")):
            files.pop(k)
    js = ("/* Generado por tools/extract_atlas.py: no editar a mano. */\n"
          "window.WR = window.WR || {};\n"
          "WR.ASSET_FILES = " + json.dumps(files, indent=1) + ";\n"
          "WR.HORSE_META = " + json.dumps(meta) + ";\n"
          "WR.ASSET_SCALE = " + ("2" if upscale else "1") + ";\n")
    (ROOT / "js" / "assets.js").write_text(js, encoding="utf-8")
    (OUT / "horse-meta.json").write_text(json.dumps(meta, indent=1))


def clean_frame(img):
    """Se queda con caballo + jinete: la pieza mayor y sus restos pegados (pañuelo, crin).
    Quita el número del cuadro y los pedazos de cuadros vecinos."""
    a = np.asarray(img)
    lab, n = ndimage.label(a[..., 3] > THR)
    areas = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
    main = int(np.argmax(areas)) + 1
    near = ndimage.binary_dilation(lab == main, iterations=5)  # restos pegados (pañuelo, crin)
    keep = set(np.unique(lab[near])) - {0}
    mask = np.isin(lab, list(keep))
    out = a.copy()
    out[..., 3] = np.where(mask, out[..., 3], 0)
    im = Image.fromarray(out, "RGBA")
    return im.crop(im.getchannel("A").getbbox())


STRIP = 60  # columnas del borde derecho que se comparan para calzar la cabeza


def _edge(a):
    return int((a[..., 3] > 128)[:, -1].sum())


def _match(cut, donor):
    """Busca en qué desplazamiento la cabeza completa (donante) calza con la cortada."""
    h, w = cut.shape[:2]
    H, W = donor.shape[:2]
    T = cut[:, w - STRIP:]
    best = (1e18, None)
    for dy in range(-30, 31):
        for dx in range(-40, 41):
            x0 = W - STRIP - 12 + dx
            if x0 < 0 or x0 + STRIP > W:
                continue
            y0, y1 = max(0, -dy), min(h, H - dy)
            Tt = T[y0:y1]
            Dd = donor[y0 + dy:y1 + dy, x0:x0 + STRIP]
            tm, dm = Tt[..., 3] > 128, Dd[..., 3] > 128
            both = tm & dm
            if both.sum() < 0.55 * tm.sum():
                continue
            diff = np.abs(Tt[..., :3] - Dd[..., :3]).mean(2)[both].mean()
            xor = ((tm != dm)[:, :STRIP - 8]).mean() * 300  # el borde cortado no cuenta
            if diff + xor < best[0]:
                best = (diff + xor, (dy, x0))
    return best


def repair_muzzles(frames):
    """Algunos cuadros vienen con el hocico cortado en el borde. Se toma la cabeza completa de
    un cuadro intacto, se calza sobre la cortada y se pega lo que falta (con mezcla en la unión)."""
    arr = [np.asarray(f).astype(float) for f in frames]
    intact = [i for i, a in enumerate(arr) if _edge(a) <= 15]
    out = []
    for k, cut in enumerate(arr):
        if k in intact or not intact:
            out.append(frames[k])
            continue
        sc, d = min((_match(cut, arr[d])[0], d) for d in intact), None
        sc, d = sc
        _, (dy, x0) = _match(cut, arr[d])
        don = arr[d]
        h, w = cut.shape[:2]
        H, W = don.shape[:2]
        extra = W - (x0 + STRIP)
        res = np.zeros((h + abs(dy) + 4, w + extra + 2, 4))
        res[:h, :w] = cut
        for xx in range(extra):
            for y in range(h):
                sy = y + dy
                if 0 <= sy < H:
                    res[y, w + xx] = don[sy, x0 + STRIP + xx]
        for b in range(6):
            ox, sx, t = w - 6 + b, x0 + STRIP - 6 + b, (b + 1) / 7
            for y in range(h):
                sy = y + dy
                if 0 <= sy < H and cut[y, ox, 3] > 0 and don[sy, sx, 3] > 0:
                    res[y, ox, :3] = cut[y, ox, :3] * (1 - t) + don[sy, sx, :3] * t
        im = Image.fromarray(res.astype(np.uint8), "RGBA")
        out.append(im.crop(im.getchannel("A").getbbox()))
    return out


def horse_meta(img):
    """Caja del caballo + jinete (zona oscura/saturada sin polvo) para alinear cuadros."""
    a = np.asarray(img).astype(int)
    lum = a[..., 0] * 0.3 + a[..., 1] * 0.59 + a[..., 2] * 0.11
    solid = (a[..., 3] > 128) & (lum < 175)
    solid = ndimage.binary_closing(solid, iterations=3)
    lab, n = ndimage.label(solid)
    sizes = ndimage.sum(solid, lab, range(1, n + 1))
    big = lab == (int(np.argmax(sizes)) + 1)
    ys, xs = np.nonzero(big)
    return {"x0": int(xs.min()), "x1": int(xs.max()), "y0": int(ys.min()), "y1": int(ys.max()),
            "w": img.width, "h": img.height}


if __name__ == "__main__":
    main()
