#!/usr/bin/env python3
"""
Genera dist/western-runner.html: el juego completo en un solo archivo
(CSS y JavaScript incrustados). Solo usa la biblioteca estándar.

    python3 tools/build.py
"""
import base64, io, re
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"


def main():
    html = (ROOT / "index.html").read_text(encoding="utf-8")
    html = re.sub(r'<link rel="stylesheet" href="(css/[^"]+)">',
                  lambda m: "<style>\n" + (ROOT / m.group(1)).read_text(encoding="utf-8") + "</style>", html)
    html = re.sub(r'<script src="(js/[^"]+)"></script>',
                  lambda m: "<script>\n" + (ROOT / m.group(1)).read_text(encoding="utf-8").replace("</script", "<\\/script") + "</script>", html)
    # Imágenes del atlas como data URI (en HTML, CSS y en el manifiesto de JS)
    cache = {}
    def data_uri(m):
        name = m.group(1)
        if name not in cache:
            # WebP con alfa: mucho más ligero que PNG y compatible con navegadores actuales
            buf = io.BytesIO()
            Image.open(ROOT / "assets" / name).save(buf, "WEBP", quality=90, method=6)
            cache[name] = "data:image/webp;base64," + base64.b64encode(buf.getvalue()).decode()
        return cache[name]
    html = re.sub(r'(?:\.\./)?assets/([\w-]+\.png)', data_uri, html)
    if re.search(r'(src|href)="(?:css|js)/', html):
        raise SystemExit("ERROR: quedó un recurso local sin incrustar")
    if "assets/" in html:
        raise SystemExit("ERROR: quedó una imagen sin incrustar")
    for bad in ("clickTag", "cupón", "coupon", "ad.size"):
        if bad.lower() in html.lower():
            raise SystemExit(f"ERROR: resto publicitario encontrado: {bad}")
    DIST.mkdir(exist_ok=True)
    out = DIST / "western-runner.html"
    out.write_text(html, encoding="utf-8")
    print(f"OK {out.relative_to(ROOT)}  {len(html.encode()) / 1024:.1f} KB")


if __name__ == "__main__":
    main()
