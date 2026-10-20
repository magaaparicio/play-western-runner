#!/usr/bin/env python3
"""
Pruebas de interfaz en navegador real (requiere: pip install playwright && playwright install chromium)

    python3 tests/ui_test.py            # prueba index.html
    python3 tests/ui_test.py dist/western-runner.html
"""
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parent.parent
TARGET = (ROOT / (sys.argv[1] if len(sys.argv) > 1 else "index.html")).as_uri()
results = []


def check(name, cond, info=""):
    results.append(bool(cond))
    print(("PASA  " if cond else "FALLA ") + name + (f"  ({info})" if info and not cond else ""))


W = "WR.app.world()"


def wait_ground(pg):
    pg.wait_for_function(f"!{W}.horse.air", timeout=3000)


def run():
    errors = []
    with sync_playwright() as p:
        b = p.chromium.launch()

        # ---------------- Móvil táctil ----------------
        ctx = b.new_context(viewport={"width": 390, "height": 844}, has_touch=True, is_mobile=True, device_scale_factor=2)
        pg = ctx.new_page()
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.goto(TARGET)
        pg.wait_for_timeout(500)
        pg.tap("#btn-play")
        pg.wait_for_timeout(300)
        check("móvil: el tutorial aparece antes de la primera partida", pg.is_visible("#screen-tutorial"))
        check("móvil: por defecto muestra TOCA PARA SALTAR", "DOS VECES" not in pg.inner_text("#tut-touch") and pg.is_visible("#tut-touch"))
        pg.touchscreen.tap(200, 500)
        pg.wait_for_timeout(30)
        check("móvil (1 toque): un toque salta y empieza la partida", pg.evaluate("WR.app.mode()") == "play" and pg.evaluate(f"{W}.horse.air"))
        check("móvil: el tutorial desaparece al empezar", not pg.is_visible("#screen-tutorial"))
        wait_ground(pg)
        # Cambiar a doble toque desde la pausa
        pg.tap("#btn-pause")
        pg.tap("#btn-jump-pause")
        check("móvil: la pausa permite cambiar a doble toque", pg.evaluate("WR.app.jumpMode()") == "doubletap" and "2 TOQUES" in pg.inner_text("#btn-jump-pause"))
        pg.tap("#btn-resume")
        pg.wait_for_timeout(450)
        pg.touchscreen.tap(200, 500)
        pg.wait_for_timeout(30)
        check("móvil (2 toques): un toque solo no salta", not pg.evaluate(f"{W}.horse.air"))
        pg.wait_for_timeout(450)
        pg.touchscreen.tap(200, 500)
        pg.wait_for_timeout(120)
        pg.touchscreen.tap(205, 505)
        pg.wait_for_timeout(30)
        check("móvil (2 toques): el doble toque salta", pg.evaluate(f"{W}.horse.air"))
        wait_ground(pg)
        pg.wait_for_timeout(450)
        # Toques demasiado separados (> 300 ms)
        pg.touchscreen.tap(200, 500)
        pg.wait_for_timeout(380)
        pg.touchscreen.tap(200, 500)
        pg.wait_for_timeout(30)
        check("móvil: dos toques separados más de 300 ms no saltan", not pg.evaluate(f"{W}.horse.air"))
        pg.wait_for_timeout(400)
        jumps = pg.evaluate(f"{W}.stats.jumps")
        # El botón de pausa no cuenta como toque
        pg.tap("#btn-pause")
        pg.wait_for_timeout(100)
        check("móvil: el botón de pausa pausa", pg.evaluate("WR.app.mode()") == "pause")
        t0 = pg.evaluate(f"{W}.t")
        pg.wait_for_timeout(900)
        check("pausa: el temporizador se detiene", pg.evaluate(f"{W}.t") == t0)
        pg.tap("#btn-resume")
        pg.wait_for_timeout(60)
        pg.tap("#btn-pause")
        pg.wait_for_timeout(60)
        check("móvil: tocar pausa nunca genera un salto", pg.evaluate(f"{W}.stats.jumps") == jumps)
        pg.tap("#btn-resume")
        hud_rows = pg.evaluate("""() => { const s = document.querySelector('.score').getBoundingClientRect();
            const h = document.querySelector('.hearts').getBoundingClientRect(); return s.top > h.bottom - 2; }""")
        check("móvil: HUD con puntaje bajo vidas y tiempo", hud_rows)
        no_zoom = pg.evaluate("getComputedStyle(document.getElementById('scene')).touchAction")
        check("móvil: área de juego sin zoom ni desplazamiento", no_zoom == "none", no_zoom)
        ctx.close()

        # ---------------- Escritorio ----------------
        ctx = b.new_context(viewport={"width": 1280, "height": 720})
        pg = ctx.new_page()
        pg.on("pageerror", lambda e: errors.append(str(e)))
        pg.on("console", lambda m: errors.append(m.text) if m.type == "error" and "ERR_NAME_NOT_RESOLVED" not in m.text and "Failed to load resource" not in m.text else None)
        pg.goto(TARGET)
        pg.wait_for_timeout(500)
        check("escritorio: sin récord previo no se muestra el récord", not pg.is_visible("#record"))
        pg.click("#btn-how")
        check("escritorio: pantalla Cómo jugar", pg.is_visible("#screen-how"))
        pg.click("#btn-how-play")
        pg.wait_for_timeout(200)
        check("escritorio: muestra PULSA ESPACIO PARA SALTAR", pg.is_visible(".tut-text.only-desk"))
        pg.keyboard.press("Space")
        pg.wait_for_timeout(30)
        check("escritorio: Espacio salta", pg.evaluate(f"{W}.horse.air"))
        wait_ground(pg)
        pg.keyboard.press("ArrowUp")
        pg.wait_for_timeout(30)
        check("escritorio: Flecha arriba salta", pg.evaluate(f"{W}.horse.air"))
        pg.keyboard.press("p")
        check("escritorio: P pausa", pg.evaluate("WR.app.mode()") == "pause")
        pg.keyboard.press("Escape")
        check("escritorio: Escape reanuda", pg.evaluate("WR.app.mode()") == "play")

        # Puntos y multiplicador a través de la interfaz real
        wait_ground(pg)
        pg.evaluate(f"""() => {{ const w = {W}; w.cards.push({{x: w.horseAbsX() + 20, y: 92, got: false, suit: 0, bob: 0}}); }}""")
        pg.wait_for_timeout(200)
        sc = pg.evaluate(f"{W}.score")
        pg.evaluate(f"""() => {{ const w = {W}; w.hats.push({{x: w.horseAbsX() + 20, y: 100, got: false}}); }}""")
        pg.wait_for_timeout(200)
        check("escritorio: indicador x2 visible al atrapar un sombrero", pg.is_visible("#mult"))
        pg.evaluate(f"""() => {{ const w = {W}; WR._pts = []; const orig = w.step.bind(w);
            w.step = function (dt) {{ orig(dt); w.events.forEach(e => {{ if (e.type === 'card' && w.mult > 0) WR._pts.push(e.points); }}); }};
            w.cards.push({{x: w.horseAbsX() + 20, y: 92, got: false, suit: 1, bob: 0}}); }}""")
        pg.wait_for_timeout(200)
        # Se mide por eventos para no confundir con cartas del recorrido recogidas a la vez.
        pts = pg.evaluate("WR._pts || []")
        check("escritorio: con x2 la carta suma 20", 20 in pts and all(v == 20 for v in pts), str(pts))
        check("escritorio: el HUD muestra el puntaje del mundo", pg.inner_text("#score").replace(",", "") == str(pg.evaluate(f"{W}.score")))

        # El juego es siempre sin fin: el menú solo ofrece JUGAR y CÓMO JUGAR
        check("escritorio: el menú ya no ofrece modos extra", pg.locator("#btn-daily").count() == 0 and pg.locator("#btn-endless").count() == 0)
        check("escritorio: el reloj cuenta hacia arriba", pg.inner_text("#time") in ("0:00", "0:01", "0:02", "0:03", "0:04", "0:05", "0:06", "0:07", "0:08", "0:09", "0:10", "0:11", "0:12"), pg.inner_text("#time"))
        wait_ground(pg)
        pg.evaluate(f"() => {{ const w = {W}; w.t = 75; }}")
        pg.wait_for_timeout(400)
        check("escritorio: no termina a los 60 s", pg.evaluate("WR.app.mode()") == "play")

        # Perder las tres vidas y guardar récord
        pg.evaluate(f"""() => {{ const w = {W}; w.lives = 1; w.invuln = 0;
            w.obstacles.push({{type: 'barrel', x: w.horseAbsX() + 40, w: 48, h: 60, box: [5, 3, 5], hit: false}}); }}""")
        pg.wait_for_function("WR.app.mode() === 'over'", timeout=3000)
        pg.wait_for_timeout(900)
        score = pg.evaluate(f"{W}.score")
        check("escritorio: sin vidas termina la partida", pg.evaluate(f"{W}.reason") == "lives" and pg.is_visible("#screen-over"))
        check("escritorio: muestra ¡FIN DEL RECORRIDO! y ¡NUEVO RÉCORD!", pg.is_visible("#new-record") and "RECORRIDO" in pg.inner_text(".board--over .board-title"))
        saved = pg.evaluate("JSON.parse(localStorage.getItem(WR_CONFIG.storageKey)).bestEndless")
        check("escritorio: el récord se guarda en localStorage", saved == score and score > 0, f"{saved} vs {score}")
        check("escritorio: el final indica el tiempo aguantado", "Aguantaste" in pg.inner_text("#over-reason"))
        check("escritorio: botón para compartir visible", pg.is_visible("#btn-share"))

        # Volver a jugar: estado limpio
        pg.click("#btn-again")
        pg.wait_for_timeout(150)
        clean = pg.evaluate(f"({W}.score === 0 && {W}.lives === 3 && {W}.t < 2 && {W}.mult === 0)")
        hud = pg.inner_text("#score") == "0" and pg.locator(".heart.is-lost").count() == 0
        check("escritorio: Volver a jugar reinicia todo", clean and hud and pg.evaluate("WR.app.mode()") == "play")
        check("escritorio: el tutorial no se repite", not pg.is_visible("#screen-tutorial"))
        pg.evaluate(f"""() => {{ const w = {W}; w.lives = 1; w.invuln = 0;
            w.obstacles.push({{type: 'barrel', x: w.horseAbsX() + 40, w: 48, h: 60, box: [5, 3, 5], hit: false}}); }}""")
        pg.wait_for_function("WR.app.mode() === 'over'", timeout=3000)
        pg.wait_for_timeout(800)
        check("escritorio: un puntaje menor no muestra nuevo récord", not pg.is_visible("#new-record"))

        # Menú principal con récord tras recargar
        pg.click("#btn-over-menu")
        pg.reload()
        pg.wait_for_timeout(400)
        check("escritorio: el récord aparece en el menú tras recargar", pg.is_visible("#record") and pg.inner_text("#record-value").replace(",", "") == str(score))

        # Música y sonido
        pg.click("#btn-music-menu")
        check("escritorio: la música se puede desactivar y se recuerda", pg.evaluate("JSON.parse(localStorage.getItem(WR_CONFIG.storageKey)).music") is False)
        pg.click("#btn-sound-menu")
        check("escritorio: el sonido se puede desactivar y se recuerda", pg.evaluate("JSON.parse(localStorage.getItem(WR_CONFIG.storageKey)).sound") is False)
        ctx.close()
        b.close()

    check("sin errores de JavaScript", not errors, "; ".join(errors[:3]))
    print(f"\n{sum(results)}/{len(results)} pruebas de interfaz superadas")
    sys.exit(0 if all(results) else 1)


if __name__ == "__main__":
    run()
