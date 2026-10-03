"""
Visuels ORIGINAUX de démonstration pour le secteur Restauration (template « Braise ») :
plats vus du dessus rendus par procédé (assiettes, riz, sauces, grillades, boissons) et
une scène de braise pour l'accueil. Aucune photographie, aucune ressource tierce :
droits entiers, provenance = ce script. Illustrations de démonstration, jamais
présentées comme les plats d'un restaurant réel.

Usage : python3 scripts/demo-visuals/restaurant.py  (nécessite numpy et Pillow)
Sortie : apps/web/public/demo-templates/restaurant/*.webp (+ recadrage -mobile du visuel d'accueil)
"""
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "../../apps/web/public/demo-templates/restaurant")
os.makedirs(OUT, exist_ok=True)
S = 2


def rgb(h, a=255):
    """Couleur « #RRGGBB » ou « #RRGGBBAA » (l'alpha du code prime sur `a`)."""
    h = h.lstrip("#")
    if len(h) == 8:
        a = int(h[6:8], 16)
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4)) + (a,)


def layer(w, h):
    return Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))


def blur(img, r):
    return img.filter(ImageFilter.GaussianBlur(r * S))


def table_bg(w, h, seed, base="#2A211C", grain="#3A2D25"):
    """Plateau de bois sombre : lames, veinage, vignettage."""
    rng = np.random.default_rng(seed)
    W, H = w * S, h * S
    y, x = np.mgrid[0:H, 0:W]
    b = np.array(rgb(base)[:3], float)
    g = np.array(rgb(grain)[:3], float)
    plank = (x // (180 * S)) % 2
    wave = np.sin(y / (9 * S) + np.sin(x / (61 * S)) * 3 + plank * 2.1) * 0.5 + 0.5
    t = (wave ** 3) * 0.55 + plank[..., None].squeeze() * 0.08
    arr = b + (g - b) * t[..., None]
    arr += rng.normal(0, 4, (H, W))[..., None]
    seams = (x % (180 * S)) < 2 * S
    arr[seams] *= 0.55
    cx, cy = W / 2, H / 2
    d = np.sqrt(((x - cx) / (W * 0.7)) ** 2 + ((y - cy) / (H * 0.7)) ** 2)
    arr *= np.clip(1.15 - d * 0.55, 0.45, 1.1)[..., None]
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB").convert("RGBA")


def finish(img, name, w, h, seed, mobile=False):
    rng = np.random.default_rng(seed)
    small = img.resize((w, h), Image.LANCZOS).convert("RGB")
    arr = np.asarray(small, dtype=np.int16) + rng.normal(0, 3.0, (h, w))[..., None]
    out = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    out.save(os.path.join(OUT, f"{name}.webp"), "WEBP", quality=84, method=6)
    if mobile:
        cw = int(h * 0.8)
        x0 = (w - cw) // 2
        out.crop((x0, 0, x0 + cw, h)).resize((640, 800), Image.LANCZOS).save(os.path.join(OUT, f"{name}-mobile.webp"), "WEBP", quality=82, method=6)
    print("✓", name)


def plate(img, cx, cy, r, color="#F4EFE6", rim="#E4DCCD", deep=False):
    """Assiette (ou bol) vue du dessus avec ombre portée."""
    W, H = img.size
    sh = layer(W // S, H // S)
    ImageDraw.Draw(sh).ellipse([(cx - r + 14) * S, (cy - r + 22) * S, (cx + r + 14) * S, (cy + r + 22) * S], fill=(0, 0, 0, 150))
    img.alpha_composite(blur(sh, 22))
    d = ImageDraw.Draw(img)
    d.ellipse([(cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S], fill=rgb(rim))
    inner = r * (0.78 if not deep else 0.86)
    d.ellipse([(cx - inner) * S, (cy - inner) * S, (cx + inner) * S, (cy + inner) * S], fill=rgb(color))
    hl = layer(W // S, H // S)
    ImageDraw.Draw(hl).arc([(cx - r + 6) * S, (cy - r + 6) * S, (cx + r - 6) * S, (cy + r - 6) * S], 200, 290, fill=(255, 255, 255, 120), width=5 * S)
    img.alpha_composite(blur(hl, 2))
    return inner


def rice(img, cx, cy, r, seed, tint="#F7F2E6", shade="#DCD3C0", count=2600, spread=1.0):
    """Dôme de riz : milliers de grains orientés au hasard, ombrés vers le bas."""
    rng = np.random.default_rng(seed)
    W, H = img.size
    base = layer(W // S, H // S)
    ImageDraw.Draw(base).ellipse([(cx - r) * S, (cy - r * 0.92) * S, (cx + r) * S, (cy + r * 0.92) * S], fill=rgb(shade))
    img.alpha_composite(blur(base, 3))
    g = layer(W // S, H // S)
    d = ImageDraw.Draw(g)
    tc, sc = np.array(rgb(tint)[:3]), np.array(rgb(shade)[:3])
    for _ in range(count):
        a = rng.uniform(0, 2 * math.pi)
        rr = r * math.sqrt(rng.uniform(0, 1)) * spread
        x, y = cx + math.cos(a) * rr, cy + math.sin(a) * rr * 0.92
        ang = rng.uniform(0, math.pi)
        L = rng.uniform(5, 8)
        k = np.clip((y - (cy - r)) / (2 * r) + rng.normal(0, 0.15), 0, 1)
        c = tuple(int(v) for v in tc + (sc - tc) * k * 0.8) + (255,)
        dx, dy = math.cos(ang) * L / 2, math.sin(ang) * L / 2
        d.line([((x - dx) * S, (y - dy) * S), ((x + dx) * S, (y + dy) * S)], fill=c, width=int(2.6 * S))
    img.alpha_composite(g)


def blob(img, cx, cy, rx, ry, color, soft=6, seed=0, lumpy=0.12):
    rng = np.random.default_rng(seed)
    W, H = img.size
    l = layer(W // S, H // S)
    pts = []
    n = 40
    ph = rng.uniform(0, 6.28, 3)
    for i in range(n):
        a = 2 * math.pi * i / n
        k = 1 + lumpy * (math.sin(3 * a + ph[0]) * 0.6 + math.sin(5 * a + ph[1]) * 0.4)
        pts.append(((cx + math.cos(a) * rx * k) * S, (cy + math.sin(a) * ry * k) * S))
    ImageDraw.Draw(l).polygon(pts, fill=rgb(color))
    img.alpha_composite(blur(l, soft))


def shine(img, cx, cy, rx, ry, alpha=90):
    W, H = img.size
    l = layer(W // S, H // S)
    ImageDraw.Draw(l).ellipse([(cx - rx) * S, (cy - ry) * S, (cx + rx) * S, (cy + ry) * S], fill=(255, 255, 255, alpha))
    img.alpha_composite(blur(l, 5))


def onion_rings(img, cx, cy, r, seed, n=26, color="#F0C85A", edge="#B8801F"):
    rng = np.random.default_rng(seed)
    W, H = img.size
    l = layer(W // S, H // S)
    d = ImageDraw.Draw(l)
    for _ in range(n):
        a = rng.uniform(0, 2 * math.pi)
        rr = r * math.sqrt(rng.uniform(0, 1))
        x, y = cx + math.cos(a) * rr, cy + math.sin(a) * rr
        rad = rng.uniform(14, 30)
        start = rng.uniform(0, 360)
        d.arc([(x - rad) * S, (y - rad * 0.7) * S, (x + rad) * S, (y + rad * 0.7) * S], start, start + rng.uniform(140, 260), fill=rgb(edge), width=int(7 * S))
        d.arc([(x - rad) * S, (y - rad * 0.7) * S, (x + rad) * S, (y + rad * 0.7) * S], start, start + rng.uniform(120, 240), fill=rgb(color), width=int(4 * S))
    img.alpha_composite(blur(l, 0.6))


def meat_piece(img, x, y, rx, ry, seed, dark="#5A2A14", mid="#8C4520", light="#C0702F", char=True):
    rng = np.random.default_rng(seed)
    blob(img, x + 3, y + 5, rx, ry, "#00000066", soft=6, seed=seed)
    blob(img, x, y, rx, ry, dark, soft=1.5, seed=seed, lumpy=0.18)
    blob(img, x - rx * 0.1, y - ry * 0.12, rx * 0.8, ry * 0.75, mid, soft=4, seed=seed + 1, lumpy=0.2)
    blob(img, x - rx * 0.25, y - ry * 0.3, rx * 0.4, ry * 0.3, light, soft=6, seed=seed + 2)
    if char:
        W, H = img.size
        l = layer(W // S, H // S)
        d = ImageDraw.Draw(l)
        for k in range(3):
            off = (k - 1) * ry * 0.5 + rng.uniform(-4, 4)
            d.line([((x - rx * 0.7) * S, (y + off - rx * 0.25) * S), ((x + rx * 0.7) * S, (y + off + rx * 0.25) * S)], fill=(30, 12, 5, 170), width=int(5 * S))
        img.alpha_composite(blur(l, 1.5))
    shine(img, x - rx * 0.3, y - ry * 0.35, rx * 0.25, ry * 0.12, 70)


def herbs(img, cx, cy, r, seed, n=40, colors=("#3E7A2E", "#5E9E3A", "#2F5E24")):
    rng = np.random.default_rng(seed)
    W, H = img.size
    l = layer(W // S, H // S)
    d = ImageDraw.Draw(l)
    for _ in range(n):
        a = rng.uniform(0, 2 * math.pi)
        rr = r * math.sqrt(rng.uniform(0, 1))
        x, y = cx + math.cos(a) * rr, cy + math.sin(a) * rr
        s = rng.uniform(3, 7)
        d.ellipse([(x - s) * S, (y - s * 0.6) * S, (x + s) * S, (y + s * 0.6) * S], fill=rgb(colors[rng.integers(0, len(colors))]))
    img.alpha_composite(l)


def lemon_wedge(img, x, y, r, ang):
    W, H = img.size
    l = layer(W // S, H // S)
    d = ImageDraw.Draw(l)
    box = [(x - r) * S, (y - r) * S, (x + r) * S, (y + r) * S]
    d.pieslice(box, ang, ang + 150, fill=rgb("#E6D040"))
    rr = r * 0.82
    d.pieslice([(x - rr) * S, (y - rr) * S, (x + rr) * S, (y + rr) * S], ang + 6, ang + 144, fill=rgb("#F6EC9A"))
    for k in range(1, 5):
        a = math.radians(ang + 6 + k * 27.6)
        d.line([(x * S, y * S), ((x + math.cos(a) * rr) * S, (y + math.sin(a) * rr) * S)], fill=rgb("#E9DC6E"), width=2 * S)
    img.alpha_composite(l)


# ---------------------------------------------------------------------------------------
# Plats (1200 × 900, 4:3)
# ---------------------------------------------------------------------------------------
PW, PH = 1200, 900


def yassa():
    img = table_bg(PW, PH, 11)
    plate(img, 600, 460, 380)
    rice(img, 470, 470, 190, 3)
    blob(img, 720, 450, 190, 170, "#C98A1E", soft=10, seed=4)  # sauce oignons-citron
    onion_rings(img, 720, 450, 150, 5, n=34)
    for i, (x, y) in enumerate([(700, 420), (780, 500), (660, 520)]):
        meat_piece(img, x, y, 62, 46, 20 + i, dark="#6B3A12", mid="#A55E1E", light="#D99040")
    lemon_wedge(img, 860, 330, 46, 200)
    herbs(img, 700, 460, 150, 7, n=18)
    shine(img, 640, 380, 60, 14, 60)
    finish(img, "yassa-poulet", PW, PH, 1)


def thieboudienne():
    img = table_bg(PW, PH, 12)
    plate(img, 600, 460, 390, color="#EEE6D8")
    rice(img, 600, 470, 300, 8, tint="#E07A2E", shade="#A2471A", count=4200)
    # Légumes : carotte, chou, manioc, aubergine
    blob(img, 520, 390, 70, 48, "#6FA04A", soft=2, seed=9, lumpy=0.25)
    blob(img, 520, 390, 52, 30, "#A9CF7E", soft=5, seed=10)
    for i, (x, y, a) in enumerate([(700, 360, 20), (730, 400, -15)]):
        blob(img, x, y, 64, 20, "#E88A1F", soft=1.5, seed=30 + i, lumpy=0.05)
        shine(img, x - 10, y - 6, 30, 5, 70)
    blob(img, 470, 560, 70, 30, "#EFE3C8", soft=1.5, seed=12, lumpy=0.1)
    blob(img, 650, 580, 44, 44, "#3E2440", soft=1.5, seed=13, lumpy=0.12)
    blob(img, 650, 580, 30, 30, "#E3D2B0", soft=3, seed=14)
    # Poisson farci (darne dorée)
    blob(img, 610, 470, 110, 72, "#8C4B1E", soft=2, seed=15, lumpy=0.08)
    blob(img, 600, 460, 90, 56, "#C47A35", soft=6, seed=16)
    blob(img, 600, 460, 30, 30, "#3D6B2A", soft=3, seed=17)
    shine(img, 570, 430, 40, 10, 80)
    herbs(img, 600, 470, 260, 18, n=30)
    finish(img, "thieboudienne", PW, PH, 2)


def dibi():
    img = table_bg(PW, PH, 13, base="#231B17")
    # Papier kraft froissé
    paper = layer(PW, PH)
    ImageDraw.Draw(paper).polygon([(260 * S, 170 * S), (980 * S, 140 * S), (1010 * S, 760 * S), (230 * S, 790 * S)], fill=rgb("#C9A56E"))
    img.alpha_composite(blur(paper, 1))
    rng = np.random.default_rng(3)
    cr = layer(PW, PH)
    d = ImageDraw.Draw(cr)
    for _ in range(40):
        x, y = rng.uniform(280, 960), rng.uniform(190, 740)
        d.line([(x * S, y * S), ((x + rng.uniform(-80, 80)) * S, (y + rng.uniform(-40, 40)) * S)], fill=(120, 90, 50, 70), width=2 * S)
    img.alpha_composite(blur(cr, 1))
    for i in range(9):
        x = 400 + (i % 3) * 170 + rng.uniform(-20, 20)
        y = 330 + (i // 3) * 140 + rng.uniform(-20, 20)
        meat_piece(img, x, y, 70, 48, 50 + i, dark="#3E1C0C", mid="#7A3818", light="#B8652C")
    onion_rings(img, 620, 470, 250, 8, n=22, color="#EFE7D4", edge="#C9B99A")
    # Moutarde et piment
    blob(img, 880, 640, 44, 44, "#D8A92A", soft=2, seed=60)
    shine(img, 870, 628, 14, 6, 90)
    blob(img, 340, 650, 36, 36, "#B0261A", soft=2, seed=61)
    finish(img, "dibi-agneau", PW, PH, 3)


def mafe():
    img = table_bg(PW, PH, 14)
    plate(img, 600, 460, 380, color="#EFE8DC")
    rice(img, 450, 470, 170, 21)
    blob(img, 700, 460, 200, 190, "#7A3F1A", soft=5, seed=22)  # sauce arachide
    blob(img, 700, 450, 170, 160, "#9A5424", soft=14, seed=23)
    for i, (x, y) in enumerate([(680, 400), (760, 470), (670, 520), (740, 380)]):
        meat_piece(img, x, y, 40, 34, 70 + i, dark="#4A200C", mid="#6E3214", light="#93491E", char=False)
    blob(img, 790, 540, 40, 26, "#E2892A", soft=2, seed=24)
    shine(img, 660, 380, 70, 16, 55)
    herbs(img, 700, 460, 160, 25, n=10)
    finish(img, "mafe", PW, PH, 4)


def fataya():
    img = table_bg(PW, PH, 15)
    plate(img, 600, 470, 370, color="#F2ECE2")
    rng = np.random.default_rng(5)
    for i, (x, y, a) in enumerate([(470, 400, -20), (650, 360, 15), (560, 560, 5), (740, 540, -30)]):
        l = layer(PW, PH)
        d = ImageDraw.Draw(l)
        r = 110
        box = [(x - r) * S, (y - r * 0.8) * S, (x + r) * S, (y + r * 0.8) * S]
        d.chord(box, 180 + a, 360 + a, fill=rgb("#C7812C"))
        img.alpha_composite(blur(l, 1))
        blob(img, x, y - 20, 80, 30, "#E3A650", soft=10, seed=80 + i)
        crimp = layer(PW, PH)
        cd = ImageDraw.Draw(crimp)
        for k in range(13):
            t = math.radians(180 + a + k * 15)
            cd.ellipse([(x + math.cos(t) * r * 0.98 - 7) * S, (y + math.sin(t) * r * 0.78 - 7) * S, (x + math.cos(t) * r * 0.98 + 7) * S, (y + math.sin(t) * r * 0.78 + 7) * S], fill=rgb("#A9651F"))
        img.alpha_composite(crimp)
    blob(img, 830, 350, 50, 50, "#B8321E", soft=2, seed=90)  # sauce piment
    shine(img, 820, 338, 16, 7, 90)
    finish(img, "fataya", PW, PH, 5)


def drink(name, liquid, top, seed, garnish="mint"):
    img = table_bg(PW, PH, seed)
    for i, (x, y) in enumerate([(430, 480), (800, 420)]):
        r = 210 if i == 0 else 180
        sh = layer(PW, PH)
        ImageDraw.Draw(sh).ellipse([(x - r + 18) * S, (y - r + 26) * S, (x + r + 18) * S, (y + r + 26) * S], fill=(0, 0, 0, 140))
        img.alpha_composite(blur(sh, 20))
        g = layer(PW, PH)
        d = ImageDraw.Draw(g)
        d.ellipse([(x - r) * S, (y - r) * S, (x + r) * S, (y + r) * S], fill=rgb("#FFFFFF40"))
        d.ellipse([(x - r * 0.9) * S, (y - r * 0.9) * S, (x + r * 0.9) * S, (y + r * 0.9) * S], fill=rgb(liquid))
        img.alpha_composite(g)
        blob(img, x - r * 0.15, y - r * 0.15, r * 0.6, r * 0.6, top, soft=18, seed=seed + i)
        rng = np.random.default_rng(seed + i)
        ice = layer(PW, PH)
        idr = ImageDraw.Draw(ice)
        for _ in range(4):
            ix, iy, s = x + rng.uniform(-r * 0.5, r * 0.5), y + rng.uniform(-r * 0.5, r * 0.5), rng.uniform(22, 34)
            idr.rounded_rectangle([(ix - s) * S, (iy - s) * S, (ix + s) * S, (iy + s) * S], radius=8 * S, fill=(255, 255, 255, 70), outline=(255, 255, 255, 130), width=2 * S)
        img.alpha_composite(blur(ice, 1))
        hl = layer(PW, PH)
        ImageDraw.Draw(hl).arc([(x - r + 6) * S, (y - r + 6) * S, (x + r - 6) * S, (y + r - 6) * S], 190, 280, fill=(255, 255, 255, 170), width=6 * S)
        img.alpha_composite(blur(hl, 1.5))
        if garnish == "mint":
            herbs(img, x + r * 0.35, y - r * 0.35, 26, seed + 10 + i, n=9, colors=("#4E9A3A", "#6DBB4A"))
    finish(img, name, PW, PH, seed)


def thiakry():
    img = table_bg(PW, PH, 18)
    plate(img, 600, 460, 330, color="#F7F3EC", deep=True)
    blob(img, 600, 460, 250, 250, "#F3EEDF", soft=8, seed=40)
    rng = np.random.default_rng(41)
    g = layer(PW, PH)
    d = ImageDraw.Draw(g)
    for _ in range(900):
        a = rng.uniform(0, 2 * math.pi)
        rr = 230 * math.sqrt(rng.uniform(0, 1))
        x, y = 600 + math.cos(a) * rr, 460 + math.sin(a) * rr
        s = rng.uniform(2, 3.5)
        d.ellipse([(x - s) * S, (y - s) * S, (x + s) * S, (y + s) * S], fill=rgb("#E7DDC4"))
    for _ in range(28):
        a = rng.uniform(0, 2 * math.pi)
        rr = 200 * math.sqrt(rng.uniform(0, 1))
        x, y = 600 + math.cos(a) * rr, 460 + math.sin(a) * rr
        d.ellipse([(x - 9) * S, (y - 6) * S, (x + 9) * S, (y + 6) * S], fill=rgb("#5B2A2A"))
    img.alpha_composite(g)
    shine(img, 540, 400, 90, 20, 70)
    blob(img, 700, 380, 40, 30, "#F0C040", soft=3, seed=42)  # zeste
    finish(img, "thiakry", PW, PH, 6)


# ---------------------------------------------------------------------------------------
# Accueil : braise et brochettes (1600 × 1000)
# ---------------------------------------------------------------------------------------
def braise():
    W, H = 1600, 1000
    img = Image.new("RGBA", (W * S, H * S), rgb("#120D0B"))
    rng = np.random.default_rng(99)
    # Lueur des braises
    y, x = np.mgrid[0 : H * S, 0 : W * S]
    glow = np.clip(1 - np.sqrt(((x - W * S * 0.55) / (W * S * 0.6)) ** 2 + ((y - H * S * 1.05) / (H * S * 0.75)) ** 2), 0, 1) ** 1.6
    base = np.array(rgb("#120D0B")[:3], float)
    hot = np.array(rgb("#E0561C")[:3], float)
    arr = base + (hot - base) * glow[..., None] * 0.9
    img = Image.fromarray(arr.astype(np.uint8), "RGB").convert("RGBA")
    # Charbons
    coals = layer(W, H)
    d = ImageDraw.Draw(coals)
    for _ in range(260):
        cx, cy = rng.uniform(0, W), rng.uniform(H * 0.72, H * 1.05)
        r = rng.uniform(18, 46)
        heat = rng.uniform(0, 1)
        col = (int(40 + 200 * heat ** 2), int(18 + 70 * heat ** 3), int(10 + 10 * heat), 255)
        d.ellipse([(cx - r) * S, (cy - r * 0.7) * S, (cx + r) * S, (cy + r * 0.7) * S], fill=col)
    img.alpha_composite(blur(coals, 2))
    # Grille
    grill = layer(W, H)
    gd = ImageDraw.Draw(grill)
    for k in range(-2, 30):
        xx = k * 64
        gd.line([(xx * S, 0), ((xx + 260) * S, H * S)], fill=(40, 34, 30, 200), width=6 * S)
    img.alpha_composite(blur(grill, 1))
    # Brochettes
    for j in range(4):
        y0 = 260 + j * 150 + rng.uniform(-10, 10)
        sk = layer(W, H)
        ImageDraw.Draw(sk).line([(120 * S, (y0 + 40) * S), (1500 * S, (y0 - 60) * S)], fill=rgb("#8A6A45"), width=8 * S)
        img.alpha_composite(sk)
        for i in range(6):
            t = (i + 0.5) / 6
            px = 220 + t * 1180
            py = y0 + 40 - t * 100 + rng.uniform(-6, 6)
            if i % 3 == 2:
                blob(img, px, py, 46, 40, "#E9D9B8", soft=1.5, seed=j * 10 + i)  # oignon
                blob(img, px, py, 30, 24, "#F5EBD5", soft=4, seed=j * 10 + i + 5)
            elif i % 3 == 1:
                blob(img, px, py, 48, 40, "#3F7A2B", soft=1.5, seed=j * 10 + i)  # poivron
                shine(img, px - 8, py - 8, 12, 5, 80)
            else:
                meat_piece(img, px, py, 62, 50, 200 + j * 10 + i, dark="#3A170A", mid="#6E2E12", light="#A34E22")
    # Fumée et étincelles
    smoke = layer(W, H)
    sd = ImageDraw.Draw(smoke)
    for _ in range(18):
        sx, sy, r = rng.uniform(0, W), rng.uniform(0, H * 0.5), rng.uniform(80, 200)
        sd.ellipse([(sx - r) * S, (sy - r * 0.6) * S, (sx + r) * S, (sy + r * 0.6) * S], fill=(200, 190, 180, 18))
    img.alpha_composite(blur(smoke, 30))
    sp = layer(W, H)
    spd = ImageDraw.Draw(sp)
    for _ in range(90):
        sx, sy = rng.uniform(0, W), rng.uniform(H * 0.1, H * 0.8)
        r = rng.uniform(1.5, 3.5)
        spd.ellipse([(sx - r) * S, (sy - r) * S, (sx + r) * S, (sy + r) * S], fill=(255, rng.integers(150, 220), 60, 230))
    img.alpha_composite(blur(sp, 0.8))
    finish(img, "braise-brochettes", W, H, 9, mobile=True)


if __name__ == "__main__":
    braise()
    yassa()
    thieboudienne()
    dibi()
    mafe()
    fataya()
    drink("bissap-bouye", "#7E0F2A", "#B0203F", 16)
    thiakry()
