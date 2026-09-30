"""
Visuels ORIGINAUX de démonstration pour le secteur Éducation (template « Préau ») :
natures mortes d'école rendues par procédé — tableau noir, cahier à lignes Seyès,
bulles de langues, ordinateur, instruments de géométrie, crayons et cubes, pile de
livres — et une cour sous préau pour l'accueil. Aucune photographie, aucune personne,
aucun logo : formes géométriques et typographies système (DejaVu, libres). Droits
entiers, provenance = ce script. Illustrations de démonstration, jamais présentées
comme les locaux ou les élèves d'un établissement réel.

Usage : python3 scripts/demo-visuals/education.py  (nécessite numpy et Pillow)
Sortie : apps/web/public/demo-templates/education/*.webp
"""
import math
import os
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

OUT = os.path.join(os.path.dirname(__file__), "../../apps/web/public/demo-templates/education")
os.makedirs(OUT, exist_ok=True)
S = 2
W, H = 1440, 1080
FONT_DIR = "/usr/share/fonts/truetype/dejavu"


def font(name, size):
    return ImageFont.truetype(os.path.join(FONT_DIR, name), int(size * S))


def rgb(h, a=255):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4)) + (a,)


def canvas(color, w=W, h=H):
    return Image.new("RGB", (w * S, h * S), rgb(color)[:3])


def grain(img, amount=6, seed=1):
    rng = np.random.default_rng(seed)
    a = np.asarray(img).astype(np.int16)
    n = rng.normal(0, amount, a.shape[:2])[..., None]
    a[..., :3] = np.clip(a[..., :3] + n, 0, 255)
    return Image.fromarray(a.astype(np.uint8))


def vignette(img, strength=0.28):
    w, h = img.size
    y, x = np.ogrid[:h, :w]
    d = np.sqrt(((x - w / 2) / (w / 2)) ** 2 + ((y - h / 2) / (h / 2)) ** 2)
    m = np.clip(1 - strength * (d**2) / 2, 0, 1)
    a = np.asarray(img).astype(np.float32)
    a[..., :3] *= m[..., None]
    return Image.fromarray(a.astype(np.uint8))


def shadow(base, shape_fn, offset=(18, 26), blur=28, opacity=90):
    """Ombre portée douce d'une forme (dessinée par shape_fn sur un masque)."""
    m = Image.new("L", base.size, 0)
    shape_fn(ImageDraw.Draw(m), 255)
    m = m.filter(ImageFilter.GaussianBlur(blur * S))
    sh = Image.new("RGBA", base.size, (20, 22, 30, 0))
    sh.putalpha(m.point(lambda v: v * opacity // 255))
    base.paste(sh, (offset[0] * S, offset[1] * S), sh)


def rr(d, box, r, fill, outline=None, width=0):
    d.rounded_rectangle([c * S for c in box], radius=r * S, fill=fill, outline=outline, width=width * S)


def save(img, name, w=W, h=H):
    out = img.resize((w, h), Image.LANCZOS).convert("RGB")
    path = os.path.join(OUT, f"{name}.webp")
    out.save(path, "WEBP", quality=82, method=6)
    print(path, os.path.getsize(path))


# --------------------------------------------------------------------------- tableau
def tableau():
    img = canvas("#E9E1CF")
    d = ImageDraw.Draw(img, "RGBA")
    board = (120, 110, 1320, 820)
    shadow(img, lambda m, v: m.rounded_rectangle([c * S for c in board], 14 * S, fill=v))
    rr(d, (104, 94, 1336, 836), 16, rgb("#7A5230"))
    rr(d, board, 10, rgb("#244236"))
    # voile de craie effacée
    haze = Image.new("RGBA", img.size, (0, 0, 0, 0))
    hd = ImageDraw.Draw(haze)
    random.seed(4)
    for _ in range(38):
        x, y = random.randint(160, 1250), random.randint(150, 760)
        hd.ellipse([x * S, y * S, (x + random.randint(120, 320)) * S, (y + random.randint(30, 90)) * S], fill=(255, 255, 255, random.randint(6, 16)))
    _l = haze.filter(ImageFilter.GaussianBlur(24 * S))
    img.paste(_l, (0, 0), _l)
    chalk = (242, 240, 228, 235)
    f = font("DejaVuSerif-Italic.ttf" if os.path.exists(os.path.join(FONT_DIR, "DejaVuSerif-Italic.ttf")) else "DejaVuSerif.ttf", 58)
    fs = font("DejaVuSans.ttf", 44)
    d.text((200 * S, 170 * S), "f(x) = x² − 4x + 3", font=f, fill=chalk)
    d.text((200 * S, 262 * S), "Δ = b² − 4ac = 4", font=fs, fill=(242, 240, 228, 205))
    d.text((200 * S, 336 * S), "x₁ = 1   ·   x₂ = 3", font=fs, fill=(242, 240, 228, 205))
    # repère et parabole à la craie
    ox, oy, sx, sy = 930, 560, 70, 52
    d.line([(760 * S, oy * S), (1250 * S, oy * S)], fill=chalk, width=3 * S)
    d.line([(ox * S, 170 * S), (ox * S, 780 * S)], fill=chalk, width=3 * S)
    pts = []
    for i in range(-10, 61):
        x = i / 10
        y = x * x - 4 * x + 3
        pts.append(((ox + (x - 0.2) * sx) * S, (oy - y * sy) * S))
    pts = [p for p in pts if 170 * S < p[1] < 790 * S]
    d.line(pts, fill=(245, 210, 120, 240), width=5 * S, joint="curve")
    for xr in (1, 3):
        cx = (ox + (xr - 0.2) * sx) * S
        d.ellipse([cx - 9 * S, oy * S - 9 * S, cx + 9 * S, oy * S + 9 * S], fill=(245, 210, 120, 255))
    # rebord, craies, brosse
    rr(d, (104, 836, 1336, 872), 6, rgb("#5E3E22"))
    rr(d, (300, 818, 380, 836), 7, rgb("#F4F1E6"))
    rr(d, (400, 822, 450, 836), 6, rgb("#F2C94C"))
    rr(d, (1040, 792, 1230, 836), 8, rgb("#3A2A1C"))
    rr(d, (1040, 822, 1230, 836), 4, rgb("#CFC7B4"))
    img = grain(vignette(img, 0.22), 5, 2)
    save(img, "tableau")


# --------------------------------------------------------------------------- cahier
def cahier():
    img = canvas("#2F5D50")
    d = ImageDraw.Draw(img, "RGBA")
    page = (190, 120, 1250, 960)
    shadow(img, lambda m, v: m.rectangle([c * S for c in page], fill=v), (20, 30), 34, 120)
    d.rectangle([c * S for c in page], fill=rgb("#FFFDF6"))
    # Seyès : lignes fines + lignes fortes tous les 4 interlignes, marge rouge
    for i, y in enumerate(range(170, 950, 12)):
        col = (120, 140, 200, 150) if i % 4 == 0 else (150, 170, 220, 70)
        d.line([(page[0] * S, y * S), (page[2] * S, y * S)], fill=col, width=(2 if i % 4 == 0 else 1) * S)
    for x in range(page[0] + 48, page[2], 48):
        d.line([(x * S, page[1] * S), (x * S, page[3] * S)], fill=(150, 170, 220, 55), width=1 * S)
    d.line([(330 * S, page[1] * S), (330 * S, page[3] * S)], fill=rgb("#D6463A"), width=3 * S)
    ink = rgb("#1C2A4A")
    f = font("DejaVuSerif.ttf", 40)
    fb = font("DejaVuSerif-Bold.ttf", 44)
    d.text((360 * S, 196 * S), "Exercice 3", font=fb, fill=rgb("#C9433A"))
    lines = ["Résoudre :  3x + 7 = 22", "3x = 22 − 7", "3x = 15", "x = 15 ÷ 3", "x = 5"]
    for i, t in enumerate(lines):
        d.text((380 * S, (290 + i * 96) * S), t, font=f, fill=ink)
    d.rectangle([370 * S, 660 * S, 520 * S, 730 * S], outline=rgb("#2F6B3F"), width=4 * S)
    d.text((880 * S, 836 * S), "Très bien !", font=font("DejaVuSerif.ttf", 38), fill=rgb("#C9433A"))
    # crayon en diagonale
    pen = Image.new("RGBA", (900 * S, 90 * S), (0, 0, 0, 0))
    pd = ImageDraw.Draw(pen)
    pd.rectangle([120 * S, 18 * S, 780 * S, 72 * S], fill=rgb("#F2B632"))
    pd.rectangle([120 * S, 18 * S, 780 * S, 34 * S], fill=rgb("#F7CC5C"))
    pd.rectangle([780 * S, 18 * S, 840 * S, 72 * S], fill=rgb("#C9C3B6"))
    pd.rectangle([840 * S, 18 * S, 890 * S, 72 * S], fill=rgb("#E89AA0"))
    pd.polygon([(120 * S, 18 * S), (120 * S, 72 * S), (20 * S, 45 * S)], fill=rgb("#EAD2A8"))
    pd.polygon([(52 * S, 36 * S), (52 * S, 54 * S), (20 * S, 45 * S)], fill=rgb("#2A2A2A"))
    pen = pen.rotate(-28, resample=Image.BICUBIC, expand=True)
    sh = Image.new("RGBA", pen.size, (20, 22, 30, 0))
    sh.putalpha(pen.split()[3].filter(ImageFilter.GaussianBlur(10 * S)).point(lambda v: v * 90 // 255))
    img.paste(sh, (760 * S, 620 * S), sh)
    img.paste(pen, (730 * S, 590 * S), pen)
    img = grain(vignette(img, 0.2), 4, 3)
    save(img, "cahier")


# --------------------------------------------------------------------------- langues
def langues():
    img = canvas("#D8A327")
    d = ImageDraw.Draw(img, "RGBA")
    bubbles = [
        ((150, 150, 830, 430), "#1C2A4A", "#FFFCF5", "Hello, how are you?", 54, "l"),
        ((620, 400, 1300, 650), "#FFFCF5", "#1C2A4A", "Nice to meet you.", 52, "r"),
        ((230, 660, 900, 900), "#2F5D50", "#FFFCF5", "Where is the library?", 48, "l"),
    ]
    for box, bg, fg, txt, size, tail in bubbles:
        shadow(img, lambda m, v, b=box: m.rounded_rectangle([c * S for c in b], 44 * S, fill=v), (14, 20), 22, 70)
        rr(d, box, 44, rgb(bg))
        x0, y0, x1, y1 = box
        if tail == "l":
            d.polygon([((x0 + 90) * S, (y1 - 4) * S), ((x0 + 60) * S, (y1 + 60) * S), ((x0 + 170) * S, (y1 - 4) * S)], fill=rgb(bg))
        else:
            d.polygon([((x1 - 90) * S, (y1 - 4) * S), ((x1 - 50) * S, (y1 + 60) * S), ((x1 - 170) * S, (y1 - 4) * S)], fill=rgb(bg))
        f = font("DejaVuSerif.ttf", size)
        tw = d.textlength(txt, font=f) / S
        d.text(((x0 + x1) / 2 * S - tw / 2 * S, ((y0 + y1) / 2 - size * 0.62) * S), txt, font=f, fill=rgb(fg))
    d.text((1120 * S, 150 * S), "B1", font=font("DejaVuSerif-Bold.ttf", 120), fill=(28, 42, 74, 60))
    img = grain(vignette(img, 0.18), 5, 4)
    save(img, "langues")


# --------------------------------------------------------------------------- ordinateur
def ordinateur():
    img = canvas("#DCE3E8")
    d = ImageDraw.Draw(img, "RGBA")
    scr = (300, 170, 1140, 700)
    shadow(img, lambda m, v: m.polygon([(210 * S, 760 * S), (1230 * S, 760 * S), (1300 * S, 820 * S), (140 * S, 820 * S)], fill=v), (0, 30), 30, 110)
    rr(d, (280, 150, 1160, 720), 24, rgb("#1B2130"))
    d.rectangle([c * S for c in scr], fill=rgb("#FFFFFF"))
    # tableur : en-têtes, grille, valeurs, graphique
    d.rectangle([scr[0] * S, scr[1] * S, scr[2] * S, (scr[1] + 44) * S], fill=rgb("#2F5D50"))
    f = font("DejaVuSans.ttf", 22)
    fb = font("DejaVuSans-Bold.ttf", 22)
    d.text(((scr[0] + 20) * S, (scr[1] + 10) * S), "Budget du club — Trimestre 1", font=fb, fill=(255, 255, 255, 255))
    cols = [scr[0], scr[0] + 60, scr[0] + 230, scr[0] + 350, scr[0] + 470, scr[0] + 590]
    for r in range(9):
        y = scr[1] + 44 + r * 38
        d.line([(scr[0] * S, y * S), (cols[-1] * S, y * S)], fill=(200, 206, 214, 255), width=1 * S)
    for x in cols:
        d.line([(x * S, (scr[1] + 44) * S), (x * S, (scr[1] + 44 + 8 * 38) * S)], fill=(200, 206, 214, 255), width=1 * S)
    rows = [("Poste", "Jan.", "Fév.", "Mars"), ("Matériel", "42 000", "18 500", "9 000"), ("Sorties", "15 000", "30 000", "12 000"), ("Livres", "8 500", "8 500", "11 000"), ("Total", "65 500", "57 000", "32 000")]
    for i, row in enumerate(rows):
        for j, cell in enumerate(row):
            d.text(((cols[j + 1] + 12) * S, (scr[1] + 54 + i * 38) * S), cell, font=fb if i in (0, 4) else f, fill=rgb("#1C2A4A"))
    for i in range(1, 9):
        d.text(((scr[0] + 22) * S, (scr[1] + 54 + (i - 1) * 38) * S), str(i), font=f, fill=rgb("#6B7285"))
    # histogramme
    base_y = scr[3] - 40
    for k, (v, c) in enumerate([(0.9, "#2F5D50"), (0.78, "#D8A327"), (0.44, "#C9433A")]):
        x = cols[-1] + 60 + k * 64
        d.rectangle([x * S, (base_y - v * 300) * S, (x + 48) * S, base_y * S], fill=rgb(c))
    d.line([((cols[-1] + 40) * S, base_y * S), ((scr[2] - 20) * S, base_y * S)], fill=rgb("#1C2A4A"), width=2 * S)
    d.text(((cols[-1] + 40) * S, (scr[1] + 64) * S), "Dépenses", font=fb, fill=rgb("#1C2A4A"))
    # base du portable
    d.polygon([(210 * S, 720 * S), (1230 * S, 720 * S), (1300 * S, 790 * S), (140 * S, 790 * S)], fill=rgb("#B9C0C8"))
    d.polygon([(140 * S, 790 * S), (1300 * S, 790 * S), (1290 * S, 806 * S), (150 * S, 806 * S)], fill=rgb("#8E969F"))
    rr(d, (640, 732, 800, 752), 8, rgb("#A3AAB2"))
    img = grain(vignette(img, 0.2), 4, 5)
    save(img, "ordinateur")


# --------------------------------------------------------------------------- géométrie
def geometrie():
    img = canvas("#1C2A4A")
    d = ImageDraw.Draw(img, "RGBA")
    # papier millimétré
    paper = (170, 120, 1270, 960)
    shadow(img, lambda m, v: m.rectangle([c * S for c in paper], fill=v), (20, 26), 30, 140)
    d.rectangle([c * S for c in paper], fill=rgb("#FBF8EF"))
    for i, x in enumerate(range(paper[0], paper[2], 20)):
        d.line([(x * S, paper[1] * S), (x * S, paper[3] * S)], fill=(214, 120, 90, 110 if i % 5 == 0 else 45), width=1 * S)
    for i, y in enumerate(range(paper[1], paper[3], 20)):
        d.line([(paper[0] * S, y * S), (paper[2] * S, y * S)], fill=(214, 120, 90, 110 if i % 5 == 0 else 45), width=1 * S)
    ink = rgb("#1C2A4A")
    A, B, C = (330, 800), (930, 800), (560, 330)
    d.polygon([(p[0] * S, p[1] * S) for p in (A, B, C)], outline=ink, width=4 * S)
    cx, cy, r = 620, 640, 200
    d.ellipse([(cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S], outline=rgb("#C9433A"), width=3 * S)
    f = font("DejaVuSerif-Bold.ttf", 40)
    for p, n in ((A, "A"), (B, "B"), (C, "C")):
        d.text(((p[0] - 44) * S, (p[1] - 10) * S), n, font=f, fill=ink)
    # règle transparente
    ruler = Image.new("RGBA", (980 * S, 110 * S), (0, 0, 0, 0))
    rd = ImageDraw.Draw(ruler)
    rd.rounded_rectangle([0, 0, 980 * S, 110 * S], 10 * S, fill=(220, 236, 244, 170), outline=(120, 160, 180, 200), width=2 * S)
    fr = font("DejaVuSans.ttf", 18)
    for k in range(0, 481):
        x = (20 + k * 2) * S
        h = 40 if k % 50 == 0 else 26 if k % 10 == 0 else 14
        rd.line([(x, 0), (x, h * S)], fill=(28, 42, 74, 220), width=max(1, S))
        if k % 50 == 0:
            rd.text((x - 6 * S, 46 * S), str(k // 10), font=fr, fill=(28, 42, 74, 230))
    ruler = ruler.rotate(12, resample=Image.BICUBIC, expand=True)
    img.paste(ruler, (260 * S, 830 * S - ruler.size[1]), ruler)
    # équerre
    sq = Image.new("RGBA", (420 * S, 420 * S), (0, 0, 0, 0))
    sd = ImageDraw.Draw(sq)
    sd.polygon([(10 * S, 10 * S), (10 * S, 410 * S), (410 * S, 410 * S)], fill=(242, 201, 76, 185), outline=(150, 110, 20, 230))
    sd.polygon([(80 * S, 180 * S), (80 * S, 340 * S), (240 * S, 340 * S)], fill=(0, 0, 0, 0))
    img.paste(sq, (900 * S, 180 * S), sq)
    img = grain(vignette(img, 0.22), 4, 6)
    save(img, "geometrie")


# --------------------------------------------------------------------------- crayons et cubes (primaire)
def primaire():
    img = canvas("#F6F1E6")
    d = ImageDraw.Draw(img, "RGBA")
    colors = ["#C9433A", "#E08A2E", "#D8A327", "#2F6B3F", "#2F5D50", "#2B5BA8", "#3A2E5C", "#1C2A4A"]
    for i, c in enumerate(colors):
        x = 230 + i * 70
        body = (x, 200 + (i % 3) * 20, x + 50, 720)
        shadow(img, lambda m, v, b=body: m.rectangle([c2 * S for c2 in b], fill=v), (14, 18), 12, 70)
        d.rectangle([c2 * S for c2 in body], fill=rgb(c))
        d.rectangle([body[0] * S, body[1] * S, (body[0] + 16) * S, body[3] * S], fill=(255, 255, 255, 40))
        d.polygon([(body[0] * S, body[1] * S), (body[2] * S, body[1] * S), ((x + 25) * S, (body[1] - 80) * S)], fill=rgb("#EAD2A8"))
        d.polygon([((x + 15) * S, (body[1] - 50) * S), ((x + 35) * S, (body[1] - 50) * S), ((x + 25) * S, (body[1] - 80) * S)], fill=rgb(c))
    fb = font("DejaVuSerif-Bold.ttf", 120)
    for k, (ch, col, pos) in enumerate([("A", "#C9433A", (820, 470)), ("B", "#2F5D50", (1060, 470)), ("C", "#D8A327", (940, 250))]):
        box = (pos[0], pos[1], pos[0] + 210, pos[1] + 210)
        shadow(img, lambda m, v, b=box: m.rounded_rectangle([c2 * S for c2 in b], 18 * S, fill=v), (18, 24), 22, 90)
        rr(d, box, 18, rgb(col))
        rr(d, (box[0] + 16, box[1] + 16, box[2] - 16, box[3] - 16), 10, (255, 255, 255, 36))
        tw = d.textlength(ch, font=fb) / S
        d.text(((pos[0] + 105 - tw / 2) * S, (pos[1] + 30) * S), ch, font=fb, fill=(255, 255, 255, 240))
    box = (820, 700, 1270, 900)
    rr(d, box, 16, rgb("#1C2A4A"))
    d.text((858 * S, 752 * S), "1 + 2 = 3", font=font("DejaVuSans-Bold.ttf", 70), fill=rgb("#FFFCF5"))
    img = grain(vignette(img, 0.16), 4, 7)
    save(img, "primaire")


# --------------------------------------------------------------------------- livres
def livres():
    img = canvas("#2F5D50")
    d = ImageDraw.Draw(img, "RGBA")
    books = [("#C9433A", 120, "HISTOIRE"), ("#D8A327", 96, "LETTRES"), ("#1C2A4A", 110, "MATHS"), ("#FFFCF5", 80, "ANGLAIS"), ("#3A2E5C", 130, "SCIENCES"), ("#E08A2E", 90, "GÉO")]
    y = 900
    f = font("DejaVuSans-Bold.ttf", 34)
    for i, (c, h, title) in enumerate(books):
        w = 760 - (i % 3) * 60
        x = 340 + (i % 2) * 40 - (i % 3) * 10
        box = (x, y - h, x + w, y)
        shadow(img, lambda m, v, b=box: m.rectangle([c2 * S for c2 in b], fill=v), (16, 10), 14, 110)
        d.rectangle([c2 * S for c2 in box], fill=rgb(c))
        d.rectangle([box[0] * S, box[1] * S, box[2] * S, (box[1] + 8) * S], fill=(255, 255, 255, 40))
        d.rectangle([(box[2] - 26) * S, box[1] * S, box[2] * S, box[3] * S], fill=rgb("#F3EBDA"))
        for k in range(4):
            d.line([((box[2] - 24) * S, (box[1] + 12 + k * (h - 24) / 3) * S), (box[2] * S, (box[1] + 12 + k * (h - 24) / 3) * S)], fill=(180, 170, 150, 180), width=1 * S)
        fg = rgb("#1C2A4A") if c == "#FFFCF5" or c == "#D8A327" else rgb("#FFFCF5")
        d.text(((box[0] + 50) * S, (box[1] + h / 2 - 20) * S), title, font=f, fill=fg)
        y -= h + 4
    # pomme géométrique
    ax, ay = 820, y - 110
    shadow(img, lambda m, v: m.ellipse([(ax - 90) * S, (ay - 80) * S, (ax + 90) * S, (ay + 90) * S], fill=v), (10, 14), 14, 110)
    d.ellipse([(ax - 90) * S, (ay - 80) * S, (ax + 90) * S, (ay + 90) * S], fill=rgb("#C9433A"))
    d.ellipse([(ax - 60) * S, (ay - 60) * S, (ax - 10) * S, (ay - 10) * S], fill=(255, 255, 255, 60))
    d.line([(ax * S, (ay - 80) * S), ((ax + 10) * S, (ay - 130) * S)], fill=rgb("#5E3E22"), width=10 * S)
    d.ellipse([(ax + 10) * S, (ay - 140) * S, (ax + 80) * S, (ay - 110) * S], fill=rgb("#2F6B3F"))
    img = grain(vignette(img, 0.24), 4, 8)
    save(img, "livres")


# --------------------------------------------------------------------------- préau (accueil)
def preau(w=1600, h=1200, name="preau"):
    img = canvas("#F1E4CC", w, h)
    d = ImageDraw.Draw(img, "RGBA")
    # ciel chaud en dégradé
    top, bot = np.array(rgb("#F6D9A8")[:3]), np.array(rgb("#F3EBDD")[:3])
    for y in range(0, int(h * 0.62)):
        t = y / (h * 0.62)
        c = tuple(int(v) for v in top * (1 - t) + bot * t) + (255,)
        d.line([(0, y * S), (w * S, y * S)], fill=c)
    # sol de la cour
    d.rectangle([0, int(h * 0.62) * S, w * S, h * S], fill=rgb("#E3CFA9"))
    # arbre (flamboyant stylisé) à droite
    tx = int(w * 0.8)
    d.rectangle([(tx - 14) * S, int(h * 0.36) * S, (tx + 14) * S, int(h * 0.64) * S], fill=rgb("#5E3E22"))
    random.seed(11)
    for _ in range(90):
        rx, ry = tx + random.gauss(0, 150), int(h * 0.28) + random.gauss(0, 60)
        r = random.randint(30, 70)
        col = random.choice(["#C9433A", "#D9542F", "#B83A2E", "#E07A3A", "#2F6B3F"])
        d.ellipse([(rx - r) * S, (ry - r * 0.7) * S, (rx + r) * S, (ry + r * 0.7) * S], fill=rgb(col, 235))
    # bâtiment et préau à arcades (perspective frontale)
    bx0, bx1, by0, by1 = int(w * 0.06), int(w * 0.7), int(h * 0.22), int(h * 0.64)
    d.rectangle([bx0 * S, by0 * S, bx1 * S, by1 * S], fill=rgb("#F4E9D6"))
    d.rectangle([bx0 * S, (by0 - 26) * S, (bx1 + 20) * S, by0 * S], fill=rgb("#C9433A"))
    n = 5
    aw = (bx1 - bx0) / n
    top_y = by0 + (by1 - by0) * 0.34
    for k in range(n):
        ax0 = bx0 + k * aw + aw * 0.1
        ax1 = bx0 + (k + 1) * aw - aw * 0.1
        rad = (ax1 - ax0) / 2
        # ouverture de l'arcade : ombre profonde en haut, lumière du fond en bas
        d.rectangle([ax0 * S, top_y * S, ax1 * S, by1 * S], fill=rgb("#6E4629"))
        d.pieslice([ax0 * S, (top_y - rad) * S, ax1 * S, (top_y + rad) * S], 180, 360, fill=rgb("#6E4629"))
        d.rectangle([ax0 * S, (by1 - (by1 - top_y) * 0.35) * S, ax1 * S, by1 * S], fill=rgb("#A7774C"))
    # corniche et bandeau de l'étage
    d.rectangle([bx0 * S, (by0 + 18) * S, bx1 * S, (by0 + 30) * S], fill=rgb("#E5D3B5"))
    for k in range(n * 2):
        wx = bx0 + (k + 0.5) * aw / 2 - 14
        d.rectangle([wx * S, (by0 + 46) * S, (wx + 28) * S, (by0 + 92) * S], fill=rgb("#2F5D50"))
    # ombres portées des arcades sur la cour
    sh = Image.new("RGBA", img.size, (0, 0, 0, 0))
    sd = ImageDraw.Draw(sh)
    for k in range(n + 1):
        px = bx0 + k * aw
        sd.polygon([(px * S, by1 * S), ((px + aw * 0.28) * S, by1 * S), ((px + aw * 0.28 + 160) * S, h * S), ((px + 160) * S, h * S)], fill=(90, 50, 20, 70))
    _l = sh.filter(ImageFilter.GaussianBlur(6 * S))
    img.paste(_l, (0, 0), _l)
    # marelle à la craie
    hx, hy = int(w * 0.46), int(h * 0.8)
    for i, (dx, dy) in enumerate([(0, 0), (0, -70), (-60, -140), (60, -140), (0, -210)]):
        x0, y0 = hx + dx - 55, hy + dy
        d.polygon([(x0 * S, y0 * S), ((x0 + 110) * S, y0 * S), ((x0 + 100) * S, (y0 - 64) * S), ((x0 + 10) * S, (y0 - 64) * S)], outline=(255, 255, 255, 210), width=4 * S)
    img = grain(vignette(img, 0.18), 4, 9)
    out = img.resize((w, h), Image.LANCZOS).convert("RGB")
    path = os.path.join(OUT, f"{name}.webp")
    out.save(path, "WEBP", quality=82, method=6)
    print(path, os.path.getsize(path))


if __name__ == "__main__":
    tableau()
    cahier()
    langues()
    ordinateur()
    geometrie()
    primaire()
    livres()
    preau()
