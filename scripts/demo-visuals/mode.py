"""
Visuels ORIGINAUX de démonstration pour le secteur Mode et vêtements (démo « Atelier
Naya ») : vêtements à plat (boubou, caftan, robe wax, chemises, sandales, mules,
foulard) sur fond de studio, avec des motifs textiles dessinés par procédé (wax, bazin
indigo, bogolan, lin). Aucune photographie, aucun modèle, aucune marque, aucun motif
copié : droits entiers, provenance = ce script. Illustrations de démonstration.

Usage : python3 scripts/demo-visuals/mode.py  (nécessite Pillow)
Sortie : apps/web/public/demo-templates/mode/*.webp (900 x 1125, format 4:5)
"""
import math
import os
import random

from PIL import Image, ImageChops, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "../../apps/web/public/demo-templates/mode")
os.makedirs(OUT, exist_ok=True)
W, H = 900, 1125
S = 2  # sur-échantillonnage
CW, CH = W * S, H * S


def P(x, y):
    return (int(x * CW), int(y * CH))


# ---------------------------------------------------------------- fonds et matières
def backdrop(top, bottom, seed):
    random.seed(seed)
    img = Image.new("RGB", (CW, CH), top)
    d = ImageDraw.Draw(img)
    for y in range(CH):
        t = y / CH
        d.line([(0, y), (CW, y)], fill=tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return grain(img, 5, size=(CW // 4, CH // 4))


def grain(img, amount=10, size=None):
    """Grain centré sur zéro : éclaircit et assombrit autant, sans changer la teinte."""
    noise = Image.effect_noise(size or img.size, 64).resize(img.size).point(lambda v: max(0, min(255, 128 + int((v - 128) * amount / 64))))
    return ImageChops.add(img, noise.convert("RGB"), scale=1.0, offset=-128)


def linen(color, seed=1):
    random.seed(seed)
    img = Image.new("RGB", (CW, CH), color)
    d = ImageDraw.Draw(img)
    for x in range(0, CW, 3 * S):
        shade = random.randint(-9, 9)
        d.line([(x, 0), (x, CH)], fill=tuple(max(0, min(255, c + shade)) for c in color), width=1)
    for y in range(0, CH, 4 * S):
        shade = random.randint(-6, 6)
        d.line([(0, y), (CW, y)], fill=tuple(max(0, min(255, c + shade)) for c in color), width=1)
    return grain(img, 8)


def bazin(base, motif, seed=2):
    """Bazin damassé : fond profond, motifs floraux ton sur ton, reflet vertical."""
    random.seed(seed)
    img = Image.new("RGB", (CW, CH), base)
    d = ImageDraw.Draw(img, "RGBA")
    step = 120 * S
    for gy in range(-step, CH + step, step):
        for gx in range(-step, CW + step, step):
            ox = gx + (step // 2 if (gy // step) % 2 else 0)
            cx, cy = ox + step // 2, gy + step // 2
            for k in range(8):
                a = k * math.pi / 4
                px, py = cx + math.cos(a) * 26 * S, cy + math.sin(a) * 26 * S
                d.ellipse([px - 13 * S, py - 7 * S, px + 13 * S, py + 7 * S], fill=motif + (70,))
            d.ellipse([cx - 9 * S, cy - 9 * S, cx + 9 * S, cy + 9 * S], fill=motif + (110,))
    sheen = Image.new("L", (CW, CH), 0)
    sd = ImageDraw.Draw(sheen)
    for x in range(CW):
        v = int(38 * (0.5 + 0.5 * math.sin(x / CW * math.pi * 3.2)))
        sd.line([(x, 0), (x, CH)], fill=v)
    img.paste(Image.new("RGB", (CW, CH), (255, 255, 255)), (0, 0), sheen)
    return grain(img, 6)


def wax(base, colors, seed=3):
    """Wax imprimé original : cercles concentriques, feuilles et points en quinconce."""
    random.seed(seed)
    img = Image.new("RGB", (CW, CH), base)
    d = ImageDraw.Draw(img)
    step = 150 * S
    for row, gy in enumerate(range(-step, CH + step, step)):
        for gx in range(-step, CW + step, step):
            cx = gx + (step // 2 if row % 2 else 0)
            cy = gy
            for r, col in [(58, colors[0]), (44, base), (34, colors[1]), (20, base), (11, colors[2])]:
                d.ellipse([cx - r * S, cy - r * S, cx + r * S, cy + r * S], fill=col)
            # feuilles entre les cercles
            lx, ly = cx + step // 2, cy + step // 2
            for a in (0.6, 2.2, 3.8, 5.4):
                pts = []
                for t in range(0, 21):
                    u = t / 20
                    rr = 48 * S * u
                    wdt = math.sin(u * math.pi) * 11 * S
                    pts.append((lx + math.cos(a) * rr - math.sin(a) * wdt, ly + math.sin(a) * rr + math.cos(a) * wdt))
                for t in range(20, -1, -1):
                    u = t / 20
                    rr = 48 * S * u
                    wdt = math.sin(u * math.pi) * 11 * S
                    pts.append((lx + math.cos(a) * rr + math.sin(a) * wdt, ly + math.sin(a) * rr - math.cos(a) * wdt))
                d.polygon(pts, fill=colors[3])
            d.ellipse([lx - 7 * S, ly - 7 * S, lx + 7 * S, ly + 7 * S], fill=colors[0])
    return grain(img, 7)


def bogolan(base, ink, seed=4):
    """Bogolan : bandes de motifs géométriques sombres sur fond de terre."""
    random.seed(seed)
    img = Image.new("RGB", (CW, CH), base)
    d = ImageDraw.Draw(img)
    band = 110 * S
    for i, y0 in enumerate(range(0, CH, band)):
        kind = i % 4
        d.line([(0, y0), (CW, y0)], fill=ink, width=5 * S)
        if kind == 0:
            for x in range(0, CW, 44 * S):
                d.line([(x, y0 + 20 * S), (x + 22 * S, y0 + band - 20 * S), (x + 44 * S, y0 + 20 * S)], fill=ink, width=5 * S)
        elif kind == 1:
            for x in range(20 * S, CW, 40 * S):
                for y in range(y0 + 25 * S, y0 + band - 15 * S, 30 * S):
                    d.ellipse([x - 5 * S, y - 5 * S, x + 5 * S, y + 5 * S], fill=ink)
        elif kind == 2:
            for x in range(0, CW, 70 * S):
                cx, cy = x + 35 * S, y0 + band // 2
                d.line([(cx - 22 * S, cy), (cx + 22 * S, cy)], fill=ink, width=6 * S)
                d.line([(cx, cy - 22 * S), (cx, cy + 22 * S)], fill=ink, width=6 * S)
        else:
            for x in range(0, CW, 60 * S):
                d.rectangle([x + 12 * S, y0 + 28 * S, x + 42 * S, y0 + band - 28 * S], outline=ink, width=5 * S)
    return grain(img, 9)


def leather(color, seed=5):
    img = linen(color, seed)
    return img.filter(ImageFilter.GaussianBlur(2 * S))


# ---------------------------------------------------------------- composition
def place(bg, fabric, polys, shadow=True, embroidery=None):
    mask = Image.new("L", (CW, CH), 0)
    md = ImageDraw.Draw(mask)
    for poly in polys:
        md.polygon([P(x, y) for x, y in poly], fill=255)
    if shadow:
        sh = mask.filter(ImageFilter.GaussianBlur(26 * S))
        off = Image.new("L", (CW, CH), 0)
        off.paste(sh, (10 * S, 22 * S))
        bg.paste(Image.new("RGB", (CW, CH), (40, 26, 18)), (0, 0), off.point(lambda v: int(v * 0.42)))
    # volume : léger dégradé d'ombre sur les bords du vêtement
    edge = mask.filter(ImageFilter.GaussianBlur(30 * S))
    shade = ImageChops.subtract(mask, edge).point(lambda v: int(v * 0.55))
    fab = fabric.copy()
    fab.paste(Image.new("RGB", (CW, CH), (0, 0, 0)), (0, 0), shade)
    bg.paste(fab, (0, 0), mask)
    if embroidery:
        d = ImageDraw.Draw(bg)
        for line, color, width in embroidery:
            d.line([P(x, y) for x, y in line], fill=color, width=width * S, joint="curve")
    return mask


def save(img, name):
    img = img.resize((W, H), Image.LANCZOS)
    img.save(os.path.join(OUT, f"{name}.webp"), "WEBP", quality=84, method=6)
    print("écrit", name)


def boubou(name, fabric, bg_colors, thread, seed):
    bg = backdrop(*bg_colors, seed)
    body = [(0.10, 0.16), (0.40, 0.12), (0.46, 0.20), (0.54, 0.20), (0.60, 0.12), (0.90, 0.16), (0.93, 0.56), (0.80, 0.58), (0.78, 0.92), (0.22, 0.92), (0.20, 0.58), (0.07, 0.56)]
    place(bg, fabric, [body])
    emb = []
    for k in range(4):
        o = k * 0.012
        emb.append(([(0.42 - o, 0.13), (0.50, 0.30 + o * 2), (0.58 + o, 0.13)], thread, 3))
    for k in range(5):
        y = 0.34 + k * 0.03
        emb.append(([(0.44, y), (0.50, y + 0.018), (0.56, y)], thread, 2))
    ImageDraw.Draw(bg)
    for line, color, width in emb:
        ImageDraw.Draw(bg).line([P(x, y) for x, y in line], fill=color, width=width * S)
    save(bg, name)


def caftan(name, fabric, bg_colors, seed):
    bg = backdrop(*bg_colors, seed)
    body = [(0.18, 0.15), (0.42, 0.11), (0.47, 0.17), (0.53, 0.17), (0.58, 0.11), (0.82, 0.15), (0.86, 0.46), (0.72, 0.47), (0.74, 0.93), (0.26, 0.93), (0.28, 0.47), (0.14, 0.46)]
    place(bg, fabric, [body])
    d = ImageDraw.Draw(bg)
    d.line([P(0.47, 0.17), P(0.50, 0.26), P(0.53, 0.17)], fill=(250, 236, 200), width=4 * S)
    save(bg, name)


def dress(name, fabric, bg_colors, seed, belt=None):
    bg = backdrop(*bg_colors, seed)
    bodice = [(0.36, 0.13), (0.45, 0.11), (0.50, 0.19), (0.55, 0.11), (0.64, 0.13), (0.74, 0.22), (0.66, 0.27), (0.62, 0.22), (0.60, 0.40), (0.40, 0.40), (0.38, 0.22), (0.34, 0.27), (0.26, 0.22)]
    skirt = [(0.40, 0.39), (0.60, 0.39), (0.80, 0.91), (0.20, 0.91)]
    place(bg, fabric, [bodice, skirt])
    if belt:
        d = ImageDraw.Draw(bg)
        d.rectangle([P(0.395, 0.385), P(0.605, 0.405)], fill=belt)
    save(bg, name)


def shirt(name, fabric, bg_colors, seed, mao=False):
    bg = backdrop(*bg_colors, seed)
    body = [(0.30, 0.15), (0.44, 0.12), (0.56, 0.12), (0.70, 0.15), (0.70, 0.88), (0.30, 0.88)]
    left = [(0.30, 0.15), (0.13, 0.62), (0.21, 0.65), (0.33, 0.33)]
    right = [(0.70, 0.15), (0.87, 0.62), (0.79, 0.65), (0.67, 0.33)]
    place(bg, fabric, [body, left, right])
    d = ImageDraw.Draw(bg)
    if mao:
        d.rounded_rectangle([P(0.44, 0.105), P(0.56, 0.135)], 6 * S, fill=tuple(max(0, c - 25) for c in fabric.getpixel((CW // 2, CH // 8))))
    else:
        d.polygon([P(0.44, 0.12), P(0.50, 0.18), P(0.42, 0.20)], fill=(238, 232, 220))
        d.polygon([P(0.56, 0.12), P(0.50, 0.18), P(0.58, 0.20)], fill=(238, 232, 220))
    d.line([P(0.50, 0.16), P(0.50, 0.88)], fill=(40, 30, 24), width=2 * S)
    for k in range(7):
        y = 0.22 + k * 0.09
        d.ellipse([P(0.505, y), P(0.522, y + 0.012)], fill=(236, 228, 210))
    save(bg, name)


def sandals(name, bg_colors, seed, strap=(120, 72, 40)):
    bg = backdrop(*bg_colors, seed)
    sole = leather((170, 112, 64), seed)
    soles = []
    for cx in (0.30, 0.70):
        pts = []
        for t in range(0, 60):
            a = t / 60 * 2 * math.pi
            # semelle : avant plus large que le talon
            r = 0.12 if math.sin(a) < 0 else 0.095
            pts.append((cx + math.cos(a) * r, 0.53 + math.sin(a) * 0.28))
        soles.append(pts)
    place(bg, sole, soles)
    d = ImageDraw.Draw(bg)
    for cx in (0.30, 0.70):
        d.rounded_rectangle([P(cx - 0.115, 0.36), P(cx + 0.115, 0.425)], 12 * S, fill=strap)
        d.rounded_rectangle([P(cx - 0.10, 0.52), P(cx + 0.10, 0.575)], 12 * S, fill=strap)
        d.ellipse([P(cx - 0.012, 0.30), P(cx + 0.012, 0.315)], fill=(196, 156, 72))
    save(bg, name)


def mules(name, fabric, bg_colors, seed):
    bg = backdrop(*bg_colors, seed)
    soles, vamps = [], []
    for cx in (0.30, 0.70):
        pts = []
        for t in range(0, 60):
            a = t / 60 * 2 * math.pi
            pts.append((cx + math.cos(a) * 0.11, 0.53 + math.sin(a) * 0.28))
        soles.append(pts)
        vamps.append([(cx - 0.115, 0.38), (cx - 0.08, 0.29), (cx, 0.26), (cx + 0.08, 0.29), (cx + 0.115, 0.38), (cx + 0.11, 0.54), (cx - 0.11, 0.54)])
    place(bg, leather((92, 58, 38), seed), soles)
    place(bg, fabric, vamps, shadow=False)
    save(bg, name)


def headwrap(name, fabric, bg_colors, seed):
    bg = backdrop(*bg_colors, seed)
    folded = [(0.14, 0.30), (0.86, 0.22), (0.90, 0.40), (0.70, 0.48), (0.88, 0.62), (0.80, 0.80), (0.16, 0.74), (0.24, 0.56), (0.10, 0.46)]
    place(bg, fabric, [folded])
    d = ImageDraw.Draw(bg, "RGBA")
    for k in range(5):
        y = 0.36 + k * 0.08
        d.line([P(0.18, y), P(0.84, y - 0.05)], fill=(0, 0, 0, 40), width=4 * S)
    save(bg, name)


CREAM = ((241, 230, 214), (222, 204, 182))
SAND = ((236, 222, 198), (210, 188, 158))
CLAY = ((226, 196, 170), (196, 158, 128))
STONE = ((228, 226, 220), (200, 196, 188))

boubou("boubou-indigo", bazin((26, 40, 92), (70, 92, 160), 11), CREAM, (214, 196, 150), 21)
boubou("boubou-blanc", bazin((236, 230, 214), (210, 200, 176), 12), CLAY, (196, 156, 72), 22)
caftan("caftan-wax-soleil", wax((232, 150, 38), [(28, 58, 112), (246, 222, 170), (176, 52, 36), (38, 112, 74)], 13), STONE, 23)
dress("robe-wax-baobab", wax((24, 92, 84), [(238, 186, 64), (246, 236, 214), (200, 74, 44), (230, 140, 50)], 14), SAND, 24, belt=(150, 96, 40))
dress("robe-lin-terracotta", linen((182, 92, 58), 15), CREAM, 25)
shirt("chemise-bogolan", bogolan((176, 140, 98), (52, 34, 22), 16), STONE, 26)
shirt("chemise-lin-mao", linen((222, 214, 196), 17), CLAY, 27, mao=True)
sandals("sandales-ngor", SAND, 28)
mules("mules-brodees", wax((120, 36, 44), [(232, 186, 80), (246, 232, 206), (40, 60, 110), (210, 120, 60)], 18), STONE, 29)
headwrap("foulard-wax", wax((40, 70, 140), [(240, 190, 60), (250, 240, 220), (210, 70, 50), (60, 140, 90)], 19), CREAM, 30)
