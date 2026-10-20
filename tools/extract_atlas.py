#!/usr/bin/env python3
"""
Recorta el atlas de sprites en PNG individuales con transparencia real.

    python3 tools/extract_atlas.py ruta/al/atlas.png

El atlas trae el cuadriculado de "transparencia" pintado en la imagen (RGB sin alfa).
Se elimina así: un píxel es fondo si es gris claro casi neutro; se borran las zonas de
fondo conectadas al borde de cada recorte y los huecos interiores que contienen el patrón
de dos tonos del cuadriculado. Después se limpia un borde de 1 px para evitar halos.
Si el atlas cambia de distribución, ajusta las cajas de BOXES.
"""
import sys
from pathlib import Path
import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets"

# nombre: (x0, y0, x1, y1) en el atlas de 1536 × 1024
GALLOP_X = [4, 170, 332, 492, 652, 822, 990, 1166, 1346, 1532]
BOXES = {f"horse-run-{i}": (GALLOP_X[i], 40, GALLOP_X[i + 1], 183) for i in range(9)}
BOXES.update({
    "horse-jump": (14, 226, 262, 420),
    "horse-land": (272, 232, 518, 420),
    "horse-hurt": (522, 210, 752, 428),
    "card-0": (852, 220, 940, 331), "card-1": (958, 218, 1045, 330),
    "card-2": (1069, 220, 1158, 330), "card-3": (1183, 219, 1275, 331),
    "hat": (1302, 214, 1465, 341),
    "obs-barrel": (812, 372, 920, 492), "obs-fence": (924, 376, 1075, 490),
    "obs-rock": (1075, 388, 1218, 492), "obs-crate": (1219, 375, 1356, 490),
    "obs-hay": (1358, 384, 1532, 493),
    "bg-sky": (13, 480, 799, 554),
    "bg-far": (15, 596, 796, 663),
    "bg-near": (15, 676, 803, 782),
    "bg-cactus": (15, 796, 802, 897),
    "bg-road": (15, 949, 802, 992),
    "ui-logo": (836, 552, 1191, 694),
    "ui-button": (1213, 570, 1516, 665),
    "ui-score": (867, 742, 1044, 818),
    "ui-timer": (1126, 742, 1316, 818),
    "ui-parchment": (832, 864, 1104, 976),
    "ui-heart": (1132, 876, 1234, 969),
    "ui-pause": (1265, 870, 1375, 973),
})
# zonas con etiquetas de texto que hay que borrar dentro de un recorte (coordenadas del atlas)
LABELS = [(10, 192, 90, 226), (276, 190, 384, 226), (558, 192, 632, 226), (10, 788, 286, 826), (10, 440, 216, 474), (10, 565, 312, 593), (10, 670, 326, 700), (10, 905, 290, 936)]
OPAQUE = {"bg-sky", "bg-road"}  # capas que deben ser totalmente opacas


def is_bg(a):
    mx, mn = a.max(2), a.min(2)
    return (mx - mn <= 14) & (mn >= 186)


def cut(atlas, name, box):
    x0, y0, x1, y1 = box
    a = atlas[y0:y1, x0:x1].astype(int)
    alpha = np.full(a.shape[:2], 255, np.uint8)
    for lx0, ly0, lx1, ly1 in LABELS:  # etiquetas → fuera
        ix0, iy0, ix1, iy1 = max(lx0, x0) - x0, max(ly0, y0) - y0, min(lx1, x1) - x0, min(ly1, y1) - y0
        if ix1 > ix0 and iy1 > iy0:
            alpha[iy0:iy1, ix0:ix1] = 0
    if name not in OPAQUE:
        bg = is_bg(a)
        lab, n = ndimage.label(bg)
        border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
        kill = np.isin(lab, list(border))
        # huecos interiores con patrón de cuadriculado (dos tonos de gris)
        mn = a.min(2)
        for i in range(1, n + 1):
            if i in border:
                continue
            m = lab == i
            if m.sum() < 25:
                continue
            vals = mn[m]
            if (vals < 226).mean() > 0.2 and (vals > 234).mean() > 0.2:
                kill |= m
        alpha[kill] = 0
        # borde de 1 px: quita restos claros neutros pegados al fondo
        ring = ndimage.binary_dilation(alpha == 0) & (alpha > 0)
        mx = a.max(2)
        light = (mx - a.min(2) <= 30) & (a.min(2) >= 160)
        alpha[ring & light] = 0
        ring2 = ndimage.binary_dilation(alpha == 0) & (alpha > 0)
        alpha[ring2] = (alpha[ring2] * 0.6).astype(np.uint8)
    if name == "hat":
        # el brillo pintado está mezclado con el cuadriculado: se descarta (el juego dibuja el suyo)
        alpha[a.min(2) >= 150] = 0
    if name not in OPAQUE and not name.startswith("bg-"):
        # conservar solo piezas grandes (quita restos de sprites vecinos)
        lab, n = ndimage.label(alpha > 0)
        if n > 1:
            sizes = ndimage.sum(np.ones_like(lab), lab, range(1, n + 1))
            keep = [i + 1 for i, v in enumerate(sizes) if v >= max(sizes) * 0.02]
            alpha[~np.isin(lab, keep)] = 0
    rgba = np.dstack([a.astype(np.uint8), alpha])
    img = Image.fromarray(rgba, "RGBA")
    bb = img.getchannel("A").getbbox()
    if bb and name not in OPAQUE:
        img = img.crop(bb)
    img.save(OUT / f"{name}.png", optimize=True)
    return img.size


def horse_meta(img):
    """Caja del caballo + jinete (píxeles oscuros, sin polvo) para alinear cuadros."""
    a = np.asarray(img).astype(int)
    lum = a[..., 0] * 0.3 + a[..., 1] * 0.59 + a[..., 2] * 0.11
    dark = (a[..., 3] > 0) & (lum < 125)
    dark = ndimage.binary_closing(dark, iterations=3)
    lab, n = ndimage.label(dark)
    sizes = ndimage.sum(dark, lab, range(1, n + 1))
    big = lab == (int(np.argmax(sizes)) + 1)
    ys, xs = np.nonzero(big)
    return {"x0": int(xs.min()), "x1": int(xs.max()), "y0": int(ys.min()), "y1": int(ys.max()), "w": img.width, "h": img.height}


def main():
    src = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "art" / "atlas.png"
    atlas = np.asarray(Image.open(src).convert("RGB"))
    OUT.mkdir(exist_ok=True)
    meta = {}
    for name, box in BOXES.items():
        size = cut(atlas, name, box)
        print(f"{name:16s} {size}")
        if name.startswith("horse-"):
            meta[name] = horse_meta(Image.open(OUT / f"{name}.png").convert("RGBA"))
    import json
    (OUT / "horse-meta.json").write_text(json.dumps(meta, indent=1))
    # Manifiesto para el juego: rutas + cajas de alineación del caballo
    files = {n: f"assets/{n}.png" for n in BOXES}
    js = ("/* Generado por tools/extract_atlas.py: no editar a mano. */\n"
          "window.WR = window.WR || {};\n"
          "WR.ASSET_FILES = " + json.dumps(files, indent=1) + ";\n"
          "WR.HORSE_META = " + json.dumps(meta) + ";\n")
    (ROOT / "js" / "assets.js").write_text(js, encoding="utf-8")


if __name__ == "__main__":
    main()
