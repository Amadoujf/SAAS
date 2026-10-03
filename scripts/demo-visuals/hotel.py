"""
Visuels ORIGINAUX de démonstration pour le secteur Hôtels (template « Palmeraie ») :
illustrations rendues par procédé (façade au crépuscule, piscine, chambres, terrasse
face à l'océan). Aucune photographie, aucune ressource tierce : droits entiers,
provenance = ce script. Illustrations de démonstration, jamais présentées comme les
chambres d'un établissement réel.

Usage : python3 scripts/demo-visuals/hotel.py  (nécessite numpy et Pillow)
Sortie : apps/web/public/demo-templates/hotel/*.webp (+ recadrages -mobile)
"""
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "../../apps/web/public/demo-templates/hotel")
os.makedirs(OUT, exist_ok=True)
W, H = 1600, 1000
S = 2


def rgb(h, a=255):
    """Couleur « #RRGGBB » ou « #RRGGBBAA » (l'alpha du code prime sur `a`)."""
    h = h.lstrip("#")
    if len(h) == 8:
        a = int(h[6:8], 16)
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4)) + (a,)


def vgrad(w, h, stops):
    ys = np.linspace(0, 1, h)[:, None]
    arr = np.zeros((h, 1, 3))
    for (p0, c0), (p1, c1) in zip(stops[:-1], stops[1:]):
        t = np.clip((ys - p0) / max(1e-6, p1 - p0), 0, 1)[..., None]
        m = ((ys >= p0) & (ys <= p1))[..., None]
        a = np.array(rgb(c0)[:3], float)
        b = np.array(rgb(c1)[:3], float)
        arr = np.where(m, a + (b - a) * t, arr)
    arr = np.where((ys > stops[-1][0])[..., None], np.array(rgb(stops[-1][1])[:3], float), arr)
    return Image.fromarray(np.repeat(arr, w, axis=1).astype(np.uint8), "RGB").convert("RGBA")


def radial(w, h, cx, cy, r, inner, outer, power=1.5):
    y, x = np.mgrid[0:h, 0:w]
    d = np.clip(np.sqrt((x - cx) ** 2 + (y - cy) ** 2) / r, 0, 1) ** power
    a = np.array(rgb(inner), float)
    b = np.array(rgb(outer), float)
    return Image.fromarray((a + (b - a) * d[..., None]).astype(np.uint8), "RGBA")


def layer():
    return Image.new("RGBA", (W * S, H * S), (0, 0, 0, 0))


def blur(img, r):
    return img.filter(ImageFilter.GaussianBlur(r * S))


def finish(img, name, seed, mobile=True):
    rng = np.random.default_rng(seed)
    small = img.resize((W, H), Image.LANCZOS).convert("RGB")
    arr = np.asarray(small, dtype=np.int16) + rng.normal(0, 3.5, (H, W))[..., None]
    out = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8))
    out.save(os.path.join(OUT, f"{name}.webp"), "WEBP", quality=84, method=6)
    if mobile:
        cw = int(H * 0.8)
        x0 = (W - cw) // 2
        out.crop((x0, 0, x0 + cw, H)).resize((640, 800), Image.LANCZOS).save(os.path.join(OUT, f"{name}-mobile.webp"), "WEBP", quality=82, method=6)
    print("✓", name)


def palm(d, x, y, height, color, lean=0.0, fronds=9, scale=1.0):
    """Palmier en silhouette : tronc incurvé, palmes plumeuses."""
    pts = []
    for i in range(30):
        t = i / 29
        pts.append((x + lean * height * t * t, y - height * t))
    for i in range(29):
        wdt = int((10 - 5 * i / 29) * S * scale)
        d.line([pts[i], pts[i + 1]], fill=color, width=max(2, wdt))
    tx, ty = pts[-1]
    for k in range(fronds):
        ang = math.radians(-180 + k * (360 / fronds) + (k % 2) * 8)
        length = height * (0.42 + 0.08 * math.sin(k * 1.7)) * scale
        droop = 0.55
        prev = (tx, ty)
        for j in range(1, 17):
            t = j / 16
            fx = tx + math.cos(ang) * length * t
            fy = ty + math.sin(ang) * length * t * 0.55 + droop * length * t * t * 0.6
            d.line([prev, (fx, fy)], fill=color, width=int(4 * S * scale))
            nx, ny = -(fy - prev[1]), (fx - prev[0])
            nl = math.hypot(nx, ny) or 1
            leaf = (1 - t) * 26 * S * scale + 6 * S
            for sgn in (-1, 1):
                d.line([(fx, fy), (fx + sgn * nx / nl * leaf + (fx - prev[0]) * 0.8, fy + sgn * ny / nl * leaf + 10 * S * t)], fill=color, width=int(3 * S * scale))
            prev = (fx, fy)


# ---------------------------------------------------------------------------
def facade():
    w, h = W * S, H * S
    img = vgrad(w, h, [(0, "#2B4A5A"), (0.35, "#C9876B"), (0.62, "#F2C59A"), (0.63, "#E9CFAE"), (1, "#D9B990")])
    img.alpha_composite(radial(w, h, int(w * 0.72), int(h * 0.56), int(w * 0.35), "#FFE8C8D0", "#F2C59A00", 1.2))
    d = ImageDraw.Draw(img)
    # Bâtiment en terre cuite, deux niveaux, arcades éclairées
    bx0, bx1, by0, by1 = w * 0.16, w * 0.84, h * 0.34, h * 0.7
    shadow = layer()
    ImageDraw.Draw(shadow).rectangle((bx0 + 20 * S, by1 - 10 * S, bx1 + 60 * S, by1 + 26 * S), fill=rgb("#3A2618", 110))
    img.alpha_composite(blur(shadow, 14))
    d.rectangle((bx0, by0, bx1, by1), fill=rgb("#C98A62"))
    d.rectangle((bx0, by0, bx1, by0 + 14 * S), fill=rgb("#B5774F"))
    d.rectangle((bx0 - 12 * S, by0 - 12 * S, bx1 + 12 * S, by0), fill=rgb("#A9694A"))
    for row, (top, bot) in enumerate([(0.38, 0.51), (0.55, 0.7)]):
        n = 7
        for i in range(n):
            cx = bx0 + (bx1 - bx0) * (i + 0.5) / n
            aw = (bx1 - bx0) / n * 0.56
            y0, y1 = h * top, h * bot
            lit = (i + row) % 3 != 1
            col = rgb("#FFD38A") if lit else rgb("#5C3A2A")
            d.rectangle((cx - aw / 2, y0 + aw / 2, cx + aw / 2, y1), fill=col)
            d.ellipse((cx - aw / 2, y0, cx + aw / 2, y0 + aw), fill=col)
            if lit:
                glow = layer()
                ImageDraw.Draw(glow).ellipse((cx - aw, y0 - aw * 0.2, cx + aw, y1 + aw * 0.4), fill=rgb("#FFC878", 70))
                img.alpha_composite(blur(glow, 18))
            if row == 0:
                d.rectangle((cx - aw * 0.62, y1 - 3 * S, cx + aw * 0.62, y1 + 6 * S), fill=rgb("#8E5638"))
        d = ImageDraw.Draw(img)
    # Sol de sable et allée
    d.polygon([(w * 0.44, h), (w * 0.56, h), (w * 0.52, h * 0.7), (w * 0.48, h * 0.7)], fill=rgb("#EAD7B8"))
    # Palmiers en silhouette
    pl = layer()
    pd = ImageDraw.Draw(pl)
    palm(pd, w * 0.08, h * 1.02, h * 0.78, rgb("#1B2A22"), lean=0.25, scale=1.25)
    palm(pd, w * 0.93, h * 1.02, h * 0.86, rgb("#1B2A22"), lean=-0.22, scale=1.3)
    palm(pd, w * 0.34, h * 0.72, h * 0.5, rgb("#2C3B30"), lean=0.1, scale=0.8)
    palm(pd, w * 0.7, h * 0.72, h * 0.46, rgb("#2C3B30"), lean=-0.12, scale=0.75)
    img.alpha_composite(pl)
    # Buissons au pied
    b = layer()
    bd = ImageDraw.Draw(b)
    rng = np.random.default_rng(2)
    for i in range(40):
        x = rng.uniform(0, w)
        r = rng.uniform(28, 60) * S
        bd.ellipse((x - r, h * 0.7 - r * 0.6, x + r, h * 0.7 + r * 0.5), fill=rgb(rng.choice(["#2F4A38", "#3B5A43", "#27402F"])))
    img.alpha_composite(b)
    finish(img, "facade-crepuscule", 21)


def piscine():
    w, h = W * S, H * S
    img = vgrad(w, h, [(0, "#8FC4D1"), (0.38, "#F4DDC2"), (0.4, "#EFE6D6"), (1, "#E4D6BF")])
    d = ImageDraw.Draw(img)
    # Mur de fond et bougainvillier
    d.rectangle((0, h * 0.2, w, h * 0.4), fill=rgb("#F3E8D8"))
    rng = np.random.default_rng(5)
    bg = layer()
    bgd = ImageDraw.Draw(bg)
    for i in range(160):
        x = rng.uniform(w * 0.55, w)
        y = rng.uniform(h * 0.12, h * 0.34)
        r = rng.uniform(10, 26) * S
        bgd.ellipse((x - r, y - r, x + r, y + r), fill=rgb(rng.choice(["#C2336B", "#D84C80", "#A8285A", "#3F6B45"]), 230))
    img.alpha_composite(blur(bg, 1))
    # Piscine en perspective
    pool = [(w * 0.18, h * 0.46), (w * 0.82, h * 0.46), (w * 1.02, h * 0.98), (w * -0.02, h * 0.98)]
    water = vgrad(w, h, [(0, "#3FB5C4"), (0.46, "#46BFCB"), (1, "#1E8FA3")])
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).polygon(pool, fill=255)
    img.paste(water, (0, 0), m)
    ripple = layer()
    rd = ImageDraw.Draw(ripple)
    for i in range(70):
        y = rng.uniform(h * 0.48, h * 0.96)
        span = (y - h * 0.46) / (h * 0.52)
        x0 = w * (0.18 - 0.2 * span) + rng.uniform(0, w * 0.6)
        rd.line([(x0, y), (x0 + rng.uniform(40, 140) * S * (0.4 + span), y + rng.uniform(-3, 3) * S)], fill=(255, 255, 255, int(60 + 80 * span)), width=int(2 * S * (0.5 + span)))
    ripple = blur(ripple, 1.2)
    ripple.putalpha(Image.fromarray(np.minimum(np.asarray(ripple.split()[3]), np.asarray(m))))
    img.alpha_composite(ripple)
    d = ImageDraw.Draw(img)
    d.line(pool[:2], fill=rgb("#FFFFFF"), width=int(10 * S))
    # Transats
    for x0 in (0.62, 0.74):
        sh = layer()
        ImageDraw.Draw(sh).polygon([(w * x0, h * 0.44), (w * (x0 + 0.1), h * 0.44), (w * (x0 + 0.12), h * 0.455), (w * (x0 + 0.02), h * 0.455)], fill=rgb("#3E2E20", 90))
        img.alpha_composite(blur(sh, 4))
        d.polygon([(w * x0, h * 0.425), (w * (x0 + 0.075), h * 0.425), (w * (x0 + 0.09), h * 0.44), (w * (x0 + 0.015), h * 0.44)], fill=rgb("#FFFFFF"))
        d.polygon([(w * x0, h * 0.425), (w * (x0 + 0.02), h * 0.39), (w * (x0 + 0.03), h * 0.395), (w * (x0 + 0.012), h * 0.428)], fill=rgb("#F6F1E8"))
        d.rectangle((w * (x0 + 0.03), h * 0.426, w * (x0 + 0.07), h * 0.432), fill=rgb("#1D8A8F"))
    # Palmier et son ombre sur l'eau
    shadow = layer()
    palm(ImageDraw.Draw(shadow), w * 0.08, h * 1.1, h * 0.5, rgb("#0E4A57", 110), lean=0.9, scale=1.2)
    img.alpha_composite(blur(shadow, 6))
    pl = layer()
    palm(ImageDraw.Draw(pl), w * 0.1, h * 0.46, h * 0.52, rgb("#2E4A36"), lean=0.12, scale=1.0)
    img.alpha_composite(pl)
    finish(img, "piscine", 22)


def bedroom(name, wall, accent, window="light", seed=23, sea=False):
    w, h = W * S, H * S
    img = vgrad(w, h, [(0, wall[0]), (0.72, wall[1]), (0.721, "#B79874"), (1, "#A88763")])
    d = ImageDraw.Draw(img)
    # Fenêtre (arche) avec voilage, ou vue mer
    wx0, wx1, wy0, wy1 = w * 0.08, w * 0.3, h * 0.12, h * 0.66
    if sea:
        view = vgrad(w, h, [(0, "#9CCBDA"), (0.34, "#F4D7B8"), (0.35, "#3E8FA3"), (0.66, "#2C6F83")])
        m = Image.new("L", (w, h), 0)
        md = ImageDraw.Draw(m)
        rad = (wx1 - wx0) / 2
        md.rectangle((wx0, wy0 + rad, wx1, wy1), fill=255)
        md.ellipse((wx0, wy0, wx1, wy0 + 2 * rad), fill=255)
        img.paste(view, (0, 0), m)
        d = ImageDraw.Draw(img)
        d.rectangle((wx0 - 8 * S, wy1, wx1 + 8 * S, wy1 + 12 * S), fill=rgb("#F3E9DA"))
    else:
        d.rectangle((wx0, wy0, wx1, wy1), fill=rgb("#FFF6E6"))
        glow = layer()
        ImageDraw.Draw(glow).rectangle((wx0 - 60 * S, wy0 - 40 * S, wx1 + 60 * S, wy1 + 40 * S), fill=rgb("#FFF1D8", 90))
        img.alpha_composite(blur(glow, 40))
        d = ImageDraw.Draw(img)
        for i in range(9):
            x = wx0 + (wx1 - wx0) * i / 8
            d.line([(x, wy0), (x + 6 * S * math.sin(i), wy1)], fill=rgb("#EFE2CC"), width=int(6 * S))
        d.rectangle((wx0 - 10 * S, wy0 - 14 * S, wx1 + 10 * S, wy0), fill=rgb("#8A6A48"))
    # Tête de lit et lit
    hx0, hx1 = w * 0.38, w * 0.9
    d.rounded_rectangle((hx0, h * 0.26, hx1, h * 0.62), radius=int(20 * S), fill=rgb(accent))
    for i in range(1, 8):
        x = hx0 + (hx1 - hx0) * i / 8
        d.line([(x, h * 0.28), (x, h * 0.6)], fill=rgb("#000000", 28), width=int(3 * S))
    bed_sh = layer()
    ImageDraw.Draw(bed_sh).rectangle((hx0 - 10 * S, h * 0.83, hx1 + 30 * S, h * 0.9), fill=rgb("#3B2A1C", 110))
    img.alpha_composite(blur(bed_sh, 14))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((hx0 - 20 * S, h * 0.5, hx1 + 20 * S, h * 0.86), radius=int(24 * S), fill=rgb("#FBF8F2"))
    d.rounded_rectangle((hx0 - 20 * S, h * 0.66, hx1 + 20 * S, h * 0.86), radius=int(24 * S), fill=rgb("#F2ECE2"))
    d.rectangle((hx0 - 20 * S, h * 0.66, hx1 + 20 * S, h * 0.69), fill=rgb(accent, 200))
    for px in (0.45, 0.6, 0.74):
        d.rounded_rectangle((w * px, h * 0.42, w * (px + 0.12), h * 0.53), radius=int(26 * S), fill=rgb("#FFFFFF"))
        d.rounded_rectangle((w * px, h * 0.5, w * (px + 0.12), h * 0.53), radius=int(14 * S), fill=rgb("#EAE3D6"))
    # Tables de chevet et lampes
    for tx in (w * 0.3, w * 0.915):
        d.rectangle((tx, h * 0.6, tx + w * 0.07, h * 0.8), fill=rgb("#7E5B3E"))
        d.rectangle((tx + w * 0.03, h * 0.5, tx + w * 0.04, h * 0.6), fill=rgb("#5C432F"))
        d.polygon([(tx + w * 0.012, h * 0.5), (tx + w * 0.058, h * 0.5), (tx + w * 0.048, h * 0.43), (tx + w * 0.022, h * 0.43)], fill=rgb("#F6E7C9"))
        lamp = layer()
        ImageDraw.Draw(lamp).ellipse((tx - w * 0.04, h * 0.36, tx + w * 0.11, h * 0.6), fill=rgb("#FFD99A", 80))
        img.alpha_composite(blur(lamp, 26))
        d = ImageDraw.Draw(img)
    # Tapis et plante
    d.ellipse((w * 0.16, h * 0.86, w * 0.5, h * 0.99), fill=rgb("#C9A77E"))
    d.ellipse((w * 0.2, h * 0.875, w * 0.46, h * 0.975), outline=rgb("#E7D4B5"), width=int(4 * S))
    pl = layer()
    pd = ImageDraw.Draw(pl)
    pd.rectangle((w * 0.02, h * 0.72, w * 0.08, h * 0.86), fill=rgb("#B7835B"))
    rng = np.random.default_rng(seed)
    for k in range(12):
        ang = math.radians(-160 + k * 12 + rng.uniform(-4, 4))
        L = h * rng.uniform(0.18, 0.3)
        ex, ey = w * 0.05 + math.cos(ang) * L * 0.6, h * 0.72 + math.sin(ang) * L
        pd.line([(w * 0.05, h * 0.72), (ex, ey)], fill=rgb("#3D6247"), width=int(4 * S))
        pd.ellipse((ex - 22 * S, ey - 10 * S, ex + 22 * S, ey + 10 * S), fill=rgb("#4B7556"))
    img.alpha_composite(pl)
    finish(img, name, seed)


def terrasse():
    w, h = W * S, H * S
    img = vgrad(w, h, [(0, "#3C5E78"), (0.3, "#E8A07C"), (0.48, "#F7D3A2"), (0.49, "#3F7F91"), (0.66, "#2D6475"), (0.661, "#9C7652"), (1, "#7E5C3E")])
    img.alpha_composite(radial(w, h, int(w * 0.62), int(h * 0.47), int(w * 0.25), "#FFF0CFE0", "#F7D3A200", 1.1))
    d = ImageDraw.Draw(img)
    d.ellipse((w * 0.6, h * 0.42, w * 0.64, h * 0.49), fill=rgb("#FFEFD0"))
    d.rectangle((0, h * 0.485, w, h * 0.66), fill=None)
    # Reflet du soleil sur l'eau (zone mer seulement)
    refl = layer()
    rd = ImageDraw.Draw(refl)
    rng = np.random.default_rng(9)
    for i in range(50):
        y = rng.uniform(h * 0.5, h * 0.65)
        span = (y - h * 0.49) / (h * 0.17)
        x = w * 0.62 + rng.normal(0, w * 0.02 * (1 + span))
        rd.line([(x - 20 * S * (1 + span), y), (x + 20 * S * (1 + span), y)], fill=(255, 226, 180, 150), width=int(3 * S))
    img.alpha_composite(blur(refl, 1))
    d = ImageDraw.Draw(img)
    # Planches du deck
    for i in range(12):
        y = h * (0.66 + i * 0.03)
        d.line([(0, y), (w, y)], fill=rgb("#6E4F34"), width=int(2 * S))
    # Rambarde
    d.rectangle((0, h * 0.6, w, h * 0.61), fill=rgb("#EFE3D0"))
    for i in range(18):
        x = w * i / 17
        d.rectangle((x - 4 * S, h * 0.6, x + 4 * S, h * 0.66), fill=rgb("#EFE3D0"))
    # Table et deux fauteuils
    sh = layer()
    ImageDraw.Draw(sh).ellipse((w * 0.36, h * 0.88, w * 0.64, h * 0.95), fill=rgb("#2A1B10", 120))
    img.alpha_composite(blur(sh, 12))
    d = ImageDraw.Draw(img)
    d.ellipse((w * 0.42, h * 0.72, w * 0.58, h * 0.77), fill=rgb("#F4EDE2"))
    d.rectangle((w * 0.495, h * 0.745, w * 0.505, h * 0.9), fill=rgb("#3B2A1C"))
    for cx, sgn in ((0.33, 1), (0.67, -1)):
        d.rounded_rectangle((w * (cx - 0.06), h * 0.68, w * (cx + 0.06), h * 0.86), radius=int(30 * S), fill=rgb("#C88A5A"))
        d.rounded_rectangle((w * (cx - 0.05), h * 0.76, w * (cx + 0.05), h * 0.84), radius=int(18 * S), fill=rgb("#F2E6D3"))
    # Lanterne allumée
    d.rectangle((w * 0.49, h * 0.68, w * 0.51, h * 0.72), fill=rgb("#2B2019"))
    lg = layer()
    ImageDraw.Draw(lg).ellipse((w * 0.44, h * 0.62, w * 0.56, h * 0.78), fill=rgb("#FFC86E", 110))
    img.alpha_composite(blur(lg, 16))
    # Palmier en silhouette
    pl = layer()
    palm(ImageDraw.Draw(pl), w * 0.92, h * 1.02, h * 0.95, rgb("#1B2A22"), lean=-0.3, scale=1.3)
    img.alpha_composite(pl)
    finish(img, "terrasse-ocean", 25)


if __name__ == "__main__":
    facade()
    piscine()
    bedroom("chambre-jardin", ("#EFE3D1", "#E4D3BC"), "#6F8A6B", seed=23)
    bedroom("suite-ocean", ("#F2E7DA", "#E7D8C4"), "#2F5F6B", seed=24, sea=True)
    terrasse()
