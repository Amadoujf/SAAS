"""
Visuels ORIGINAUX de démonstration pour le secteur Salons (template « Écrin ») : natures
mortes rendues par procédé (arche éclairée, flacons, tresse, vernis, galets). Aucune
photographie, aucune ressource tierce : droits entiers, provenance = ce script. Ce sont
des illustrations de démonstration, jamais présentées comme les prestations d'un salon
réel. Pas de portraits : sans photo, l'équipe s'affiche en monogramme.

Usage : python3 scripts/demo-visuals/salon.py  (nécessite numpy et Pillow)
Sortie : apps/web/public/demo-templates/salon/*.webp
"""
import math
import os

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "../../apps/web/public/demo-templates/salon")
os.makedirs(OUT, exist_ok=True)
W, H = 1200, 1500  # portrait 4:5 (images en arche)
S = 2  # suréchantillonnage (anticrénelage)


def rgb(h, a=255):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4)) + (a,)


def canvas(color):
    return Image.new("RGBA", (W * S, H * S), rgb(color))


def vgrad(w, h, top, bottom):
    t = np.linspace(0, 1, h)[:, None, None]
    a = np.array(rgb(top)[:3], dtype=float)
    b = np.array(rgb(bottom)[:3], dtype=float)
    arr = a + (b - a) * t
    arr = np.repeat(arr, w, axis=1)
    return Image.fromarray(arr.astype(np.uint8), "RGB").convert("RGBA")


def radial(w, h, cx, cy, r, inner, outer, power=1.6):
    y, x = np.mgrid[0:h, 0:w]
    d = np.clip(np.sqrt((x - cx) ** 2 + (y - cy) ** 2) / r, 0, 1) ** power
    a = np.array(rgb(inner), dtype=float)
    b = np.array(rgb(outer), dtype=float)
    arr = a + (b - a) * d[..., None]
    return Image.fromarray(arr.astype(np.uint8), "RGBA")


def soft_shadow(size, box, radius, blur, alpha=90, color="#2A1621"):
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).rounded_rectangle(box, radius=radius, fill=rgb(color, alpha))
    return layer.filter(ImageFilter.GaussianBlur(blur))


def ellipse_shadow(size, box, blur, alpha=80, color="#2A1621"):
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse(box, fill=rgb(color, alpha))
    return layer.filter(ImageFilter.GaussianBlur(blur))


def grain(img, amount=6, seed=1):
    rng = np.random.default_rng(seed)
    arr = np.asarray(img.convert("RGB"), dtype=np.int16)
    n = rng.normal(0, amount, arr.shape[:2])[..., None]
    return Image.fromarray(np.clip(arr + n, 0, 255).astype(np.uint8), "RGB")


def finish(img, name, seed):
    small = img.resize((W, H), Image.LANCZOS)
    out = grain(small, 4, seed)
    out.save(os.path.join(OUT, f"{name}.webp"), "WEBP", quality=84, method=6)
    print("✓", name)


def paste(base, layer):
    base.alpha_composite(layer)


# ---------------------------------------------------------------------------
# 1. Arche lumineuse : mur poudré, fenêtre en arche, lumière au sol, ombre de palme
# ---------------------------------------------------------------------------
def arche_lumiere():
    w, h = W * S, H * S
    img = vgrad(w, h, "#F1DCD3", "#E6C8BC")
    # Sol
    floor_y = int(h * 0.72)
    floor = vgrad(w, h - floor_y, "#D8AE9F", "#C99A8A")
    img.paste(floor, (0, floor_y))
    # Fenêtre en arche (ciel pêche du soir)
    ax0, ax1 = int(w * 0.28), int(w * 0.72)
    ay0, ay1 = int(h * 0.12), int(h * 0.62)
    rad = (ax1 - ax0) // 2
    mask = Image.new("L", (w, h), 0)
    md = ImageDraw.Draw(mask)
    md.rectangle((ax0, ay0 + rad, ax1, ay1), fill=255)
    md.ellipse((ax0, ay0, ax1, ay0 + 2 * rad), fill=255)
    skyimg = vgrad(w, h, "#F7D9B8", "#F2B79C")
    sun = radial(w, h, int(w * 0.56), int(h * 0.42), int(w * 0.28), "#FFF4DE", "#F2B79C00", 1.2)
    skyimg.alpha_composite(sun)
    # Collines lointaines dans la fenêtre
    hills = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    hd = ImageDraw.Draw(hills)
    pts = [(ax0, ay1)]
    for i in range(0, 41):
        x = ax0 + (ax1 - ax0) * i / 40
        y = h * 0.53 + math.sin(i * 0.45) * h * 0.012 + math.sin(i * 1.3) * h * 0.006
        pts.append((x, y))
    pts.append((ax1, ay1))
    hd.polygon(pts, fill=rgb("#C98A7C"))
    skyimg.alpha_composite(hills)
    img.paste(skyimg, (0, 0), mask)
    # Embrasure (profondeur)
    frame = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    fd = ImageDraw.Draw(frame)
    t = int(w * 0.018)
    fd.rectangle((ax0 - t, ay0 + rad, ax0, ay1), fill=rgb("#DDB9AC"))
    fd.arc((ax0 - t, ay0 - t, ax1 + t, ay0 + 2 * rad + t), 180, 360, fill=rgb("#DDB9AC"), width=t)
    fd.rectangle((ax1, ay0 + rad, ax1 + t, ay1), fill=rgb("#E8CFC5"))
    fd.rectangle((ax0 - t, ay1, ax1 + t, ay1 + int(t * 1.4)), fill=rgb("#EBD3C9"))
    paste(img, frame)
    # Tache de lumière projetée au sol (arche déformée)
    light = Image.new("L", (w, h), 0)
    ld = ImageDraw.Draw(light)
    lx0, lx1 = int(w * 0.18), int(w * 0.66)
    ly0, ly1 = int(h * 0.76), int(h * 0.98)
    ld.polygon([(lx0 + w * 0.06, ly0), (lx1 + w * 0.08, ly0), (lx1 + w * 0.22, ly1), (lx0 - w * 0.04, ly1)], fill=120)
    light = light.filter(ImageFilter.GaussianBlur(28 * S))
    glow = Image.new("RGBA", (w, h), rgb("#FFE9D2"))
    img.paste(glow, (0, 0), light)
    # Ombre de palme sur le mur (à droite)
    palm = Image.new("L", (w, h), 0)
    pd = ImageDraw.Draw(palm)
    cx, cy = int(w * 0.9), int(h * 0.2)
    for k in range(9):
        ang = math.radians(150 + k * 13)
        length = h * (0.32 + 0.05 * math.sin(k))
        ex, ey = cx + math.cos(ang) * length, cy + math.sin(ang) * length * 0.8 + h * 0.15
        pd.line([(cx, cy), (ex, ey)], fill=90, width=int(3 * S))
        for j in range(1, 16):
            tt = j / 16
            px, py = cx + (ex - cx) * tt, cy + (ey - cy) * tt
            nx, ny = -(ey - cy), (ex - cx)
            nl = math.hypot(nx, ny)
            lf = (1 - abs(tt - 0.45)) * w * 0.05
            for sgn in (-1, 1):
                pd.line([(px, py), (px + sgn * nx / nl * lf + (ex - cx) * 0.03, py + sgn * ny / nl * lf + (ey - cy) * 0.03)], fill=80, width=int(5 * S))
    palm = palm.filter(ImageFilter.GaussianBlur(9 * S))
    shade = Image.new("RGBA", (w, h), rgb("#8E5E5C"))
    img.paste(shade, (0, 0), palm.point(lambda v: int(v * 0.55)))
    # Vase et tige d'herbe de pampa au premier plan
    paste(img, ellipse_shadow((w, h), (int(w * 0.64), int(h * 0.87), int(w * 0.9), int(h * 0.91)), 14 * S, 90))
    vase = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    vd = ImageDraw.Draw(vase)
    vx0, vx1, vy0, vy1 = int(w * 0.68), int(w * 0.86), int(h * 0.74), int(h * 0.895)
    vd.ellipse((vx0, vy0 + (vy1 - vy0) * 0.25, vx1, vy1), fill=rgb("#A24D63"))
    vd.rectangle((vx0 + (vx1 - vx0) * 0.33, vy0, vx1 - (vx1 - vx0) * 0.33, vy0 + (vy1 - vy0) * 0.45), fill=rgb("#A24D63"))
    vd.ellipse((vx0 + (vx1 - vx0) * 0.3, vy0 - 10 * S, vx1 - (vx1 - vx0) * 0.3, vy0 + 10 * S), fill=rgb("#7E3548"))
    # Reflet
    vd.ellipse((vx0 + (vx1 - vx0) * 0.18, vy0 + (vy1 - vy0) * 0.42, vx0 + (vx1 - vx0) * 0.34, vy0 + (vy1 - vy0) * 0.8), fill=rgb("#C77A8E", 150))
    paste(img, vase)
    stems = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(stems)
    bx, by = (vx0 + vx1) / 2, vy0
    for k, (dx, top) in enumerate([(-0.12, 0.36), (-0.03, 0.30), (0.07, 0.34), (0.15, 0.40)]):
        tx, ty = bx + dx * w, h * top
        sd.line([(bx, by), (tx, ty)], fill=rgb("#B08A62"), width=int(3 * S))
        for j in range(30):
            tt = j / 30
            px, py = tx + (bx - tx) * tt * 0.35, ty + (by - ty) * tt * 0.35
            r = (1 - tt) * w * 0.028 + w * 0.006
            sd.ellipse((px - r, py - r * 0.6, px + r, py + r * 0.6), fill=rgb("#EAD2B4", 70))
    stems = stems.filter(ImageFilter.GaussianBlur(2 * S))
    paste(img, stems)
    finish(img, "arche-lumiere", 11)


# ---------------------------------------------------------------------------
# 2. Flacons de soin sur une étagère
# ---------------------------------------------------------------------------
def bottle(size, x, y, bw, bh, body, cap, cap_h, neck=0.45, label=None, rounded=0.18):
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.rounded_rectangle((x, y, x + bw, y + bh), radius=int(bw * rounded), fill=rgb(body))
    nw = bw * neck
    d.rectangle((x + (bw - nw) / 2, y - cap_h * 0.25, x + (bw + nw) / 2, y + 4), fill=rgb(body))
    d.rounded_rectangle((x + (bw - nw * 1.1) / 2, y - cap_h, x + (bw + nw * 1.1) / 2, y - cap_h * 0.2), radius=int(nw * 0.12), fill=rgb(cap))
    if label:
        d.rounded_rectangle((x + bw * 0.14, y + bh * 0.38, x + bw * 0.86, y + bh * 0.72), radius=int(bw * 0.04), fill=rgb(label))
        d.line((x + bw * 0.26, y + bh * 0.5, x + bw * 0.74, y + bh * 0.5), fill=rgb("#2A1621", 140), width=int(3 * S))
        d.line((x + bw * 0.32, y + bh * 0.58, x + bw * 0.68, y + bh * 0.58), fill=rgb("#2A1621", 90), width=int(2 * S))
    # Reflet vertical
    hl = Image.new("RGBA", size, (0, 0, 0, 0))
    ImageDraw.Draw(hl).rounded_rectangle((x + bw * 0.1, y + bh * 0.08, x + bw * 0.2, y + bh * 0.9), radius=int(bw * 0.05), fill=(255, 255, 255, 70))
    layer.alpha_composite(hl.filter(ImageFilter.GaussianBlur(3 * S)))
    return layer


def flacons():
    w, h = W * S, H * S
    img = vgrad(w, h, "#EFD5CC", "#E2BCB0")
    paste(img, radial(w, h, int(w * 0.3), int(h * 0.25), int(w * 0.8), "#FBEDE6CC", "#E2BCB000", 1.3))
    shelf_y = int(h * 0.7)
    shelf = vgrad(w, h - shelf_y, "#D6A79A", "#C38F82")
    img.paste(shelf, (0, shelf_y))
    ImageDraw.Draw(img).rectangle((0, shelf_y, w, shelf_y + 6 * S), fill=rgb("#E9C9BE"))
    items = [
        (0.10, 0.19, 0.30, "#F4E6DA", "#A7864F", 0.09, 0.45, "#FFFFFF"),
        (0.31, 0.15, 0.40, "#8E4E5E", "#2A1621", 0.08, 0.4, "#F2E3CF"),
        (0.49, 0.22, 0.24, "#E9C3A6", "#A7864F", 0.06, 0.6, None),
        (0.70, 0.17, 0.34, "#FAF3EE", "#A24D63", 0.1, 0.35, "#EAD9D0"),
    ]
    for (fx, fw, fh, body, cap, capf, neck, label) in items:
        bw, bh = w * fw, h * fh
        x, y = w * fx, shelf_y - bh
        paste(img, soft_shadow((w, h), (x + bw * 0.1, shelf_y - 20 * S, x + bw * 1.15, shelf_y + 18 * S), 20 * S, 16 * S, 110))
        paste(img, bottle((w, h), x, y, bw, bh, body, cap, h * capf, neck, label))
    # Petit pot rond au premier plan
    paste(img, ellipse_shadow((w, h), (int(w * 0.52), int(h * 0.86), int(w * 0.86), int(h * 0.92)), 16 * S, 100))
    pot = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    pd = ImageDraw.Draw(pot)
    pd.rounded_rectangle((w * 0.55, h * 0.79, w * 0.83, h * 0.9), radius=int(w * 0.04), fill=rgb("#F7EEE8"))
    pd.rounded_rectangle((w * 0.545, h * 0.765, w * 0.835, h * 0.8), radius=int(w * 0.02), fill=rgb("#A7864F"))
    pd.ellipse((w * 0.59, h * 0.815, w * 0.63, h * 0.87), fill=(255, 255, 255, 120))
    paste(img, pot)
    # Feuille d'eucalyptus
    leaf = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ld = ImageDraw.Draw(leaf)
    for i in range(7):
        cx, cy = w * (0.12 + i * 0.055), h * (0.9 - i * 0.012)
        r = w * 0.03
        ld.ellipse((cx - r, cy - r * 0.8, cx + r, cy + r * 0.8), fill=rgb("#8FA394", 230))
    ld.line([(w * 0.1, h * 0.91), (w * 0.47, h * 0.81)], fill=rgb("#6F7F70"), width=int(3 * S))
    paste(img, leaf)
    finish(img, "flacons", 12)


# ---------------------------------------------------------------------------
# 3. Tresse (gros plan graphique) sur fond chaud
# ---------------------------------------------------------------------------
def tresse():
    w, h = W * S, H * S
    img = vgrad(w, h, "#EBD0C2", "#D9AF9C")
    paste(img, radial(w, h, int(w * 0.45), int(h * 0.35), int(w * 0.9), "#F8E6DBB0", "#D9AF9C00", 1.4))
    rng = np.random.default_rng(3)
    cx = w * 0.5
    bw = w * 0.38  # largeur de la tresse
    step = h * 0.075
    band = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(band).rounded_rectangle((cx - bw * 0.55, -80, cx + bw * 0.62, h + 80), radius=int(bw * 0.5), fill=rgb("#4A2420", 110))
    paste(img, band.filter(ImageFilter.GaussianBlur(34 * S)))
    n = int(h / step) + 4
    for i in range(n):
        yc = -step + i * step
        side = -1 if i % 2 == 0 else 1
        # Mèche : losange arrondi incliné, d'un bord de la tresse vers le centre bas
        ang = math.radians(28 * side)
        length, thick = bw * 0.78, step * 1.25
        seg = Image.new("RGBA", (int(length * 1.2), int(thick * 1.3)), (0, 0, 0, 0))
        sw, sh = seg.size
        d = ImageDraw.Draw(seg)
        d.ellipse((sw * 0.05, sh * 0.12, sw * 0.95, sh * 0.88), fill=rgb("#2E1C18"))
        # Dégradé de volume : plus clair au sommet de la mèche
        vol = radial(sw, sh, int(sw * 0.45), int(sh * 0.3), int(sw * 0.55), "#7A5140D0", "#2E1C1800", 1.1)
        m = Image.new("L", (sw, sh), 0)
        ImageDraw.Draw(m).ellipse((sw * 0.05, sh * 0.12, sw * 0.95, sh * 0.88), fill=255)
        tmp = Image.new("RGBA", (sw, sh), (0, 0, 0, 0))
        tmp.paste(vol, (0, 0), m)
        seg.alpha_composite(tmp)
        # Fibres suivant la mèche
        fib = Image.new("RGBA", (sw, sh), (0, 0, 0, 0))
        fd = ImageDraw.Draw(fib)
        for f in range(70):
            yy = rng.uniform(0.2, 0.8)
            col = rng.choice(["#5C3A2E", "#3A2320", "#8A5E47", "#1F1210"])
            pts = [(sw * (0.1 + 0.8 * t / 15), sh * (yy + 0.1 * math.sin(math.pi * t / 15) * (0.5 - yy))) for t in range(16)]
            fd.line(pts, fill=rgb(col, 150), width=max(1, int(S * rng.uniform(1, 2))))
        fm = Image.new("L", (sw, sh), 0)
        ImageDraw.Draw(fm).ellipse((sw * 0.07, sh * 0.16, sw * 0.93, sh * 0.84), fill=255)
        seg.paste(fib, (0, 0), Image.fromarray(np.minimum(np.asarray(fm), np.asarray(fib.split()[3]))))
        # Reflet
        hl = Image.new("RGBA", (sw, sh), (0, 0, 0, 0))
        ImageDraw.Draw(hl).arc((sw * 0.15, sh * 0.2, sw * 0.85, sh * 0.7), 200, 330, fill=(230, 180, 140, 150), width=int(5 * S))
        seg.alpha_composite(hl.filter(ImageFilter.GaussianBlur(3 * S)))
        seg = seg.rotate(math.degrees(ang), resample=Image.BICUBIC, expand=True)
        px = int(cx + side * bw * 0.2 - seg.size[0] / 2)
        py = int(yc - seg.size[1] / 2)
        sh_layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        sh_layer.paste(Image.new("RGBA", seg.size, (15, 6, 4, 130)), (px + int(6 * S), py + int(16 * S)), seg.split()[3])
        paste(img, sh_layer.filter(ImageFilter.GaussianBlur(8 * S)))
        layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        layer.paste(seg, (px, py), seg)
        paste(img, layer)
    # Anneaux dorés
    for yy in (0.3, 0.66):
        by = h * yy
        ring = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        rd = ImageDraw.Draw(ring)
        rd.rounded_rectangle((cx - bw * 0.26, by - h * 0.022, cx + bw * 0.3, by + h * 0.022), radius=int(h * 0.02), fill=rgb("#B8914F"))
        rd.rounded_rectangle((cx - bw * 0.24, by - h * 0.018, cx + bw * 0.28, by - h * 0.006), radius=int(h * 0.01), fill=(255, 238, 196, 150))
        for k in range(6):
            x = cx - bw * 0.2 + k * bw * 0.09
            rd.line((x, by - h * 0.02, x, by + h * 0.02), fill=rgb("#8A6A33"), width=int(2 * S))
        paste(img, soft_shadow((w, h), (cx - bw * 0.24, by, cx + bw * 0.34, by + h * 0.035), int(h * 0.02), 8 * S, 120, "#1E1010"))
        paste(img, ring)
    finish(img, "tresse", 13)


# ---------------------------------------------------------------------------
# 4. Vernis : flacons et touches de couleur
# ---------------------------------------------------------------------------
def vernis():
    w, h = W * S, H * S
    img = vgrad(w, h, "#F3E1D9", "#E7CBC0")
    rng = np.random.default_rng(4)
    # Nuancier : faux ongles vernis (forme amande), alignés sur un présentoir
    for i, col in enumerate(["#A24D63", "#C4586A", "#7E2F43", "#E3A095", "#B27B5A", "#F1D6CB"]):
        nx = w * (0.1 + i * 0.14)
        ny = h * (0.12 + (0.02 if i % 2 else 0))
        nw_, nh = w * 0.09, h * 0.16
        paste(img, soft_shadow((w, h), (nx + 8 * S, ny + 14 * S, nx + nw_ + 8 * S, ny + nh + 14 * S), int(nw_ * 0.5), 10 * S, 70))
        nail = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        nd = ImageDraw.Draw(nail)
        nd.rounded_rectangle((nx, ny + nh * 0.3, nx + nw_, ny + nh), radius=int(nw_ * 0.18), fill=rgb(col))
        nd.ellipse((nx, ny, nx + nw_, ny + nh * 0.7), fill=rgb(col))
        hl = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        ImageDraw.Draw(hl).rounded_rectangle((nx + nw_ * 0.2, ny + nh * 0.12, nx + nw_ * 0.34, ny + nh * 0.8), radius=int(nw_ * 0.07), fill=(255, 255, 255, 120))
        nail.alpha_composite(hl.filter(ImageFilter.GaussianBlur(3 * S)))
        paste(img, nail)
    ImageDraw.Draw(img).line((w * 0.08, h * 0.33, w * 0.92, h * 0.33), fill=rgb("#D7B3A6"), width=int(3 * S))
    # Trois flacons de vernis
    base_y = h * 0.86
    for i, (fx, col) in enumerate([(0.14, "#A24D63"), (0.40, "#7E2F43"), (0.66, "#E3A095")]):
        bw, bh = w * 0.2, h * 0.2
        x = w * fx
        y = base_y - bh
        paste(img, ellipse_shadow((w, h), (int(x - w * 0.02), int(base_y - h * 0.02), int(x + bw * 1.25), int(base_y + h * 0.03)), 16 * S, 120))
        b = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        d = ImageDraw.Draw(b)
        d.rounded_rectangle((x, y, x + bw, base_y), radius=int(bw * 0.2), fill=rgb(col))
        # Verre épais : bord clair
        d.rounded_rectangle((x, y, x + bw, base_y), radius=int(bw * 0.2), outline=(255, 255, 255, 80), width=int(6 * S))
        cap_w, cap_h = bw * 0.36, h * 0.2
        d.rounded_rectangle((x + (bw - cap_w) / 2, y - cap_h, x + (bw + cap_w) / 2, y + 6 * S), radius=int(cap_w * 0.18), fill=rgb("#2A1621"))
        d.rounded_rectangle((x + (bw - cap_w) / 2 + cap_w * 0.15, y - cap_h + 10 * S, x + (bw - cap_w) / 2 + cap_w * 0.3, y - 10 * S), radius=int(cap_w * 0.06), fill=(255, 255, 255, 60))
        hl = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        ImageDraw.Draw(hl).rounded_rectangle((x + bw * 0.12, y + bh * 0.12, x + bw * 0.24, y + bh * 0.85), radius=int(bw * 0.05), fill=(255, 255, 255, 110))
        b.alpha_composite(hl.filter(ImageFilter.GaussianBlur(4 * S)))
        paste(img, b)
    finish(img, "vernis", 14)


# ---------------------------------------------------------------------------
# 5. Galets et serviette (soins, détente)
# ---------------------------------------------------------------------------
def stone(size, box, top, bottom):
    x0, y0, x1, y1 = box
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    mask = Image.new("L", size, 0)
    ImageDraw.Draw(mask).ellipse(box, fill=255)
    grad = radial(size[0], size[1], int(x0 + (x1 - x0) * 0.38), int(y0 + (y1 - y0) * 0.3), int((x1 - x0) * 0.75), top, bottom, 1.2)
    layer.paste(grad, (0, 0), mask)
    return layer


def galets():
    w, h = W * S, H * S
    img = vgrad(w, h, "#EAD4CA", "#D9B8AA")
    paste(img, radial(w, h, int(w * 0.7), int(h * 0.2), int(w * 0.9), "#FBEFE8B0", "#D9B8AA00", 1.3))
    # Serviette pliée
    tw0, tw1, ty0, ty1 = w * 0.08, w * 0.92, h * 0.64, h * 0.9
    paste(img, soft_shadow((w, h), (tw0, ty0 + 20 * S, tw1, ty1 + 30 * S), int(w * 0.04), 26 * S, 90))
    towel = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    td = ImageDraw.Draw(towel)
    td.rounded_rectangle((tw0, ty0, tw1, ty1), radius=int(w * 0.035), fill=rgb("#F8EEE8"))
    td.rounded_rectangle((tw0, ty0 + (ty1 - ty0) * 0.5, tw1, ty1), radius=int(w * 0.035), fill=rgb("#F1E2DA"))
    for k in range(6):
        yy = ty0 + (ty1 - ty0) * (0.16 + k * 0.14)
        td.line((tw0 + 30 * S, yy, tw1 - 30 * S, yy), fill=rgb("#E6D3CA"), width=int(2 * S))
    td.rectangle((tw0, ty0 + (ty1 - ty0) * 0.78, tw1, ty0 + (ty1 - ty0) * 0.84), fill=rgb("#A24D63", 200))
    paste(img, towel)
    # Pile de galets
    stones = [
        ((0.26, 0.47, 0.74, 0.66), "#6F6662", "#3F3836"),
        ((0.31, 0.35, 0.69, 0.5), "#8A817C", "#4C4542"),
        ((0.36, 0.25, 0.64, 0.37), "#9C938D", "#58504C"),
        ((0.41, 0.17, 0.59, 0.265), "#B0A7A1", "#655C58"),
    ]
    for (fx0, fy0, fx1, fy1), a, b in stones:
        box = (w * fx0, h * fy0, w * fx1, h * fy1)
        paste(img, ellipse_shadow((w, h), (box[0] + 10 * S, box[3] - (box[3] - box[1]) * 0.25, box[2] + 10 * S, box[3] + 14 * S), 14 * S, 120, "#1E1414"))
        paste(img, stone((w, h), box, a, b))
    # Fleur d'orchidée stylisée
    fl = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    fd = ImageDraw.Draw(fl)
    fcx, fcy = w * 0.78, h * 0.6
    for k in range(5):
        ang = math.radians(k * 72 - 90)
        px, py = fcx + math.cos(ang) * w * 0.045, fcy + math.sin(ang) * w * 0.045
        fd.ellipse((px - w * 0.045, py - w * 0.032, px + w * 0.045, py + w * 0.032), fill=rgb("#F6E3EA"))
    fd.ellipse((fcx - w * 0.02, fcy - w * 0.02, fcx + w * 0.02, fcy + w * 0.02), fill=rgb("#A24D63"))
    paste(img, fl.filter(ImageFilter.GaussianBlur(1 * S)))
    finish(img, "galets", 15)


if __name__ == "__main__":
    arche_lumiere()
    flacons()
    tresse()
    vernis()
    galets()
