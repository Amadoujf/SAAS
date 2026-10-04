"""
Visuels ORIGINAUX de démonstration pour le secteur Automobile (template « Piste ») :
véhicules génériques vus de profil (SUV, berline, citadine, pick-up, 4×4) rendus par
procédé, en studio sombre ou en lumière du jour, avec la ligne d'horizon lumineuse du
template. Aucune photographie, aucun logo ni dessin de constructeur : silhouettes
génériques, droits entiers, provenance = ce script. Illustrations de démonstration,
jamais présentées comme les véhicules d'une concession réelle.

Usage : python3 scripts/demo-visuals/automobile.py  (nécessite numpy et Pillow)
Sortie : apps/web/public/demo-templates/automobile/*.webp
"""
import math
import os

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "../../apps/web/public/demo-templates/automobile")
os.makedirs(OUT, exist_ok=True)
S = 2
W, H = 1440, 900


def rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i : i + 2], 16) for i in (0, 2, 4))


def blur(img, r):
    return img.filter(ImageFilter.GaussianBlur(r * S))


def chaikin(pts, it=3, closed=True):
    """Arrondit un polygone (coins adoucis, lignes tendues conservées)."""
    for _ in range(it):
        out = []
        n = len(pts)
        for i in range(n if closed else n - 1):
            p, q = pts[i], pts[(i + 1) % n]
            out += [(0.78 * p[0] + 0.22 * q[0], 0.78 * p[1] + 0.22 * q[1]), (0.22 * p[0] + 0.78 * q[0], 0.22 * p[1] + 0.78 * q[1])]
        pts = out
    return pts


# Profils (x, hauteur) en fractions de la LONGUEUR du véhicule ; roues (x) et rayon.
BODIES = {
    "suv": dict(top=[(0, .07), (0, .15), (.01, .19), (.04, .21), (.24, .235), (.30, .245), (.40, .34), (.46, .355), (.86, .36), (.955, .335), (.99, .30), (1, .22), (1, .08), (.98, .05), (.02, .05)], win=[(.315, .252), (.405, .336), (.852, .344), (.935, .262)], belt=.245, wheels=(.175, .80), r=.086, pillar=(.62, .80)),
    "berline": dict(top=[(0, .06), (0, .13), (.015, .165), (.06, .18), (.28, .205), (.44, .29), (.50, .30), (.66, .297), (.80, .225), (.95, .21), (.995, .185), (1, .14), (1, .07), (.98, .05), (.02, .05)], win=[(.325, .208), (.452, .283), (.655, .289), (.765, .214)], belt=.198, wheels=(.18, .80), r=.075, pillar=(.565,)),
    "citadine": dict(top=[(0, .07), (0, .15), (.015, .195), (.05, .218), (.2, .245), (.37, .352), (.43, .368), (.76, .368), (.90, .338), (.985, .29), (1, .21), (1, .08), (.98, .055), (.02, .055)], win=[(.34, .255), (.432, .35), (.755, .356), (.862, .268)], belt=.25, wheels=(.17, .81), r=.086, pillar=(.585,)),
    "pickup": dict(top=[(0, .08), (0, .17), (.01, .215), (.04, .235), (.25, .255), (.31, .27), (.38, .34), (.42, .345), (.58, .345), (.60, .335), (.61, .24), (1, .24), (1, .09), (.98, .06), (.02, .06)], win=[(.325, .273), (.392, .331), (.575, .334), (.592, .252)], belt=.265, wheels=(.175, .80), r=.084, pillar=(.49,), bed=.61),
    "4x4": dict(top=[(0, .08), (0, .19), (.01, .235), (.04, .255), (.24, .275), (.31, .285), (.37, .37), (.40, .385), (.955, .385), (.99, .37), (1, .33), (1, .09), (.98, .06), (.02, .06)], win=[(.325, .292), (.377, .366), (.945, .371), (.962, .292)], belt=.285, wheels=(.18, .80), r=.09, pillar=(.56, .77)),
}


def car_layer(kind, paint, L, rim="#C9CED3", dark_glass="#0E1318", flip=False, spec=1.0):
    """Rend un véhicule de profil sur un calque transparent. Renvoie (calque, sol_y)."""
    b = BODIES[kind]
    pad = int(L * 0.08)
    w, h = int(L + 2 * pad), int(L * 0.62)
    gy = h - pad  # ligne du sol dans le calque
    X = lambda fx: (pad + fx * L) * S
    Y = lambda fh: (gy - fh * L) * S
    img = Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))

    # Carrosserie : masque + dégradé « studio » (épaule claire, bas de caisse sombre).
    poly = [(X(x), Y(y)) for x, y in chaikin(b["top"], 2)]
    mask = Image.new("L", img.size, 0)
    ImageDraw.Draw(mask).polygon(poly, fill=255)
    yy = np.arange(img.size[1])[:, None].astype(float)
    hh = (gy * S - yy) / (L * S)  # hauteur en fraction de L
    belt = b["belt"]
    base = np.array(rgb(paint), float)
    f = 0.74 + 0.28 * np.clip((hh - 0.05) / (belt - 0.05), 0, 1)
    f += 0.2 * np.clip((hh - belt) / 0.08, 0, 1)
    f -= 0.26 * np.exp(-((hh - 0.105) / 0.016) ** 2)
    add = 120 * spec * np.exp(-((hh - (belt - 0.01)) / 0.0035) ** 2) + 34 * spec * np.exp(-((hh - 0.075) / 0.009) ** 2) + 22 * spec * np.exp(-((hh - (belt + 0.035)) / 0.014) ** 2)
    xx = np.arange(img.size[0])[None, :].astype(float) / img.size[0]
    sweep = 0.92 + 0.14 * np.exp(-((xx - 0.42) / 0.3) ** 2)
    col = base[None, None, :] * (f * sweep)[..., None] + add[..., None]
    body = np.dstack([np.clip(col, 0, 255), np.asarray(mask, float)])
    img.alpha_composite(Image.fromarray(body.astype(np.uint8), "RGBA"))
    d = ImageDraw.Draw(img)

    # Vitrages : verre sombre, reflet diagonal, montants.
    wp = [(X(x), Y(y)) for x, y in chaikin(b["win"], 2)]
    glass = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glass)
    gd.polygon(wp, fill=rgb(dark_glass) + (255,))
    refl = Image.new("L", img.size, 0)
    x0, x1 = X(b["win"][0][0]), X(b["win"][-1][0])
    y0, y1 = Y(b["win"][1][1]), Y(b["win"][0][1])
    ImageDraw.Draw(refl).polygon([(x0 + (x1 - x0) * .18, y0), (x0 + (x1 - x0) * .42, y0), (x0 + (x1 - x0) * .30, y1), (x0 + (x1 - x0) * .06, y1)], fill=46)
    gm = Image.new("L", img.size, 0)
    ImageDraw.Draw(gm).polygon(wp, fill=255)
    refl = ImageChops.multiply(refl, gm)
    glass.alpha_composite(Image.merge("RGBA", (Image.new("L", img.size, 255),) * 3 + (refl,)))
    img.alpha_composite(glass)
    for px in b["pillar"]:
        d.polygon([(X(px - .012), Y(b["win"][0][1] - .003)), (X(px + .012), Y(b["win"][0][1] - .003)), (X(px + .008), Y(b["win"][1][1] + .004)), (X(px - .016), Y(b["win"][1][1] + .004))], fill=rgb("#0A0D10") + (255,))
    # Joint de vitrage.
    d.line(wp + [wp[0]], fill=(20, 22, 25, 255), width=int(3 * S))

    # Portes, poignées, rétroviseur, bas de caisse.
    for dx in ([.47, .665] if kind not in ("pickup",) else [.47]):
        d.line([(X(dx), Y(.06)), (X(dx + .004), Y(belt + .002))], fill=(0, 0, 0, 90), width=int(2 * S))
        d.rounded_rectangle([X(dx + .03), Y(belt - .022), X(dx + .07), Y(belt - .03)], radius=3 * S, fill=(0, 0, 0, 110))
    wx0 = b["win"][0][0]
    d.polygon([(X(wx0 + .004), Y(belt + .004)), (X(wx0 + .04), Y(belt + .007)), (X(wx0 + .036), Y(belt + .032)), (X(wx0 + .01), Y(belt + .028))], fill=tuple(int(c * .7) for c in rgb(paint)) + (255,))
    d.line([(X(.24), Y(.056)), (X(.74), Y(.056))], fill=(0, 0, 0, 120), width=int(4 * S))
    if kind == "pickup":
        d.line([(X(b["bed"] + .005), Y(.232)), (X(.995), Y(.232))], fill=(0, 0, 0, 140), width=int(3 * S))
        d.line([(X(b["bed"]), Y(.235)), (X(b["bed"]), Y(.075))], fill=(0, 0, 0, 90), width=int(2 * S))

    # Optiques : phare (avant = gauche) et feu arrière, avec halo.
    glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gdd = ImageDraw.Draw(glow)
    fy = b["top"][2][1] - .012
    gdd.polygon([(X(-.002), Y(fy)), (X(.075), Y(fy + .012)), (X(.07), Y(fy - .006)), (X(.004), Y(fy - .016))], fill=(235, 245, 255, 255))
    ry = belt + .01 if kind != "pickup" else .21
    gdd.rounded_rectangle([X(.987), Y(ry + .03), X(1.003), Y(ry - .012)], radius=2 * S, fill=(200, 16, 40, 255))
    img.alpha_composite(blur(glow, 6))
    img.alpha_composite(glow)

    # Passages de roue et roues.
    r = b["r"]
    for wxf in b["wheels"]:
        cx, cy = X(wxf), Y(r)
        ar = r * 1.16 * L * S
        d.pieslice([cx - ar, cy - ar, cx + ar, cy + ar], 180, 360, fill=(8, 9, 11, 255))
        tr = r * L * S
        tire = Image.new("RGBA", img.size, (0, 0, 0, 0))
        td = ImageDraw.Draw(tire)
        td.ellipse([cx - tr, cy - tr, cx + tr, cy + tr], fill=(20, 21, 23, 255))
        td.ellipse([cx - tr * .9, cy - tr * .9, cx + tr * .9, cy + tr * .9], outline=(38, 40, 43, 255), width=int(3 * S))
        rr = tr * .66
        rc = rgb(rim)
        td.ellipse([cx - rr, cy - rr, cx + rr, cy + rr], fill=rc + (255,))
        td.ellipse([cx - rr * .92, cy - rr * .92, cx + rr * .92, cy + rr * .92], fill=tuple(int(c * .82) for c in rc) + (255,))
        for k in range(5):
            a0 = k * 72 + 18
            td.pieslice([cx - rr * .86, cy - rr * .86, cx + rr * .86, cy + rr * .86], a0, a0 + 44, fill=(14, 15, 17, 255))
        td.ellipse([cx - rr * .3, cy - rr * .3, cx + rr * .3, cy + rr * .3], fill=rc + (255,))
        td.ellipse([cx - rr * .12, cy - rr * .12, cx + rr * .12, cy + rr * .12], fill=(60, 62, 66, 255))
        # Reflet sur la jante.
        td.arc([cx - rr * .95, cy - rr * .95, cx + rr * .95, cy + rr * .95], 200, 260, fill=(255, 255, 255, 150), width=int(3 * S))
        img.alpha_composite(tire)
    if flip:
        img = img.transpose(Image.FLIP_LEFT_RIGHT)
    return img, gy, pad


def scene(kind, paint, name, mood="studio", rim="#C9CED3", flip=False, crop=None, spec=1.0, size=(W, H)):
    w, h = size
    cw, ch = w * S, h * S
    gy = int(h * 0.74)
    yy, xx = np.mgrid[0:ch, 0:cw].astype(float)
    if mood == "studio":
        top, mid, floor0, floor1 = rgb("#2B3238"), rgb("#141A1F"), rgb("#171C21"), rgb("#07090B")
    else:
        top, mid, floor0, floor1 = rgb("#E4E7E9"), rgb("#CDD2D5"), rgb("#B7BDC1"), rgb("#9EA5AA")
    t = np.clip(yy / (gy * S), 0, 1)[..., None]
    wall = np.array(top) * (1 - t) + np.array(mid) * t
    tf = np.clip((yy - gy * S) / ((h - gy) * S), 0, 1)[..., None]
    fl = np.array(floor0) * (1 - tf) + np.array(floor1) * tf
    arr = np.where(yy[..., None] < gy * S, wall, fl)
    # Halo derrière le véhicule.
    halo = np.exp(-(((xx - cw * .5) / (cw * .38)) ** 2 + ((yy - gy * S * .72) / (ch * .38)) ** 2))[..., None]
    arr = arr + (halo * (40 if mood == "studio" else 18))
    if mood != "studio":
        for k in range(1, 6):
            px = int(cw * k / 6)
            arr[: gy * S, px : px + 2 * S] *= 0.965
    rng = np.random.default_rng(len(name))
    arr += rng.normal(0, 2.5, (ch, cw))[..., None]
    bg = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGB").convert("RGBA")

    L = w * 0.74
    car, cgy, pad = car_layer(kind, paint, L, rim=rim, flip=flip, spec=spec)
    ox = int((cw - car.size[0]) / 2)
    oy = int(gy * S - cgy * S)
    # Ligne d'horizon lumineuse (signature « Piste »), sous le véhicule.
    line = Image.new("RGBA", bg.size, (0, 0, 0, 0))
    ld = ImageDraw.Draw(line)
    ld.rectangle([cw * .08, gy * S - 2 * S, cw * .92, gy * S + 1 * S], fill=(255, 90, 31, 255 if mood == "studio" else 170))
    bg.alpha_composite(blur(line, 14))
    bg.alpha_composite(line)
    # Ombre de contact.
    sh = Image.new("RGBA", bg.size, (0, 0, 0, 0))
    ImageDraw.Draw(sh).ellipse([ox + pad * S * .6, gy * S - 16 * S, ox + car.size[0] - pad * S * .6, gy * S + 22 * S], fill=(0, 0, 0, 200))
    bg.alpha_composite(blur(sh, 16))
    # Reflet au sol.
    refl = car.transpose(Image.FLIP_TOP_BOTTOM)
    fade = np.linspace(0.32 if mood == "studio" else 0.16, 0, refl.size[1]) ** 1.4
    a = np.asarray(refl.split()[3], float) * fade[:, None]
    refl.putalpha(Image.fromarray(a.astype(np.uint8)))
    bg.alpha_composite(blur(refl, 2), (ox, int(gy * S - (car.size[1] - cgy * S))))
    bg.alpha_composite(car, (ox, oy))
    # Vignettage.
    d = np.sqrt(((xx - cw / 2) / (cw * .75)) ** 2 + ((yy - ch / 2) / (ch * .75)) ** 2)
    v = np.clip(1.12 - d * .45, .55, 1)[..., None]
    out = np.asarray(bg.convert("RGB"), float) * v
    im = Image.fromarray(np.clip(out, 0, 255).astype(np.uint8)).resize((w, h), Image.LANCZOS)
    if crop:
        x0, y0, x1, y1 = crop
        im = im.crop((int(x0 * w), int(y0 * h), int(x1 * w), int(y1 * h))).resize((w, h), Image.LANCZOS)
    noise = np.random.default_rng(7).normal(0, 2.2, (h, w))[..., None]
    im = Image.fromarray(np.clip(np.asarray(im, np.int16) + noise, 0, 255).astype(np.uint8))
    im.save(os.path.join(OUT, f"{name}.webp"), "WEBP", quality=84, method=6)
    print("✓", name)
    return im


VEHICLES = [
    ("rav4", "suv", "#E9ECEE", "#B9BEC4"),
    ("hilux", "pickup", "#A9AFB5", "#2C3035"),
    ("tucson", "suv", "#1E3557", "#C9CED3"),
    ("picanto", "citadine", "#B3202A", "#C9CED3"),
    ("prado", "4x4", "#15181B", "#8D949B"),
    ("508", "berline", "#5B6168", "#2C3035"),
    ("swift", "citadine", "#E0A417", "#2C3035"),
    ("l200", "pickup", "#F1F2F3", "#9AA1A8"),
    ("santafe", "suv", "#4A5A52", "#C9CED3"),
    ("corolla", "berline", "#EEF0F1", "#B9BEC4"),
]

if __name__ == "__main__":
    for slug, kind, paint, rim in VEHICLES:
        spec = 0.55 if sum(rgb(paint)) > 600 else 1.0
        scene(kind, paint, f"{slug}-1", "studio", rim=rim, spec=spec)
        scene(kind, paint, f"{slug}-2", "jour", rim=rim, flip=True, spec=spec)
        scene(kind, paint, f"{slug}-3", "studio", rim=rim, spec=spec, crop=(0.02, 0.36, 0.52, 0.86))
    # Accueil : le véhicule vedette en grand, et un recadrage vertical pour le téléphone.
    hero = scene("suv", "#1E3557", "showroom", "studio", rim="#C9CED3", size=(1600, 1000))
    hero.crop((260, 120, 260 + 800, 120 + 1000)).resize((640, 800), Image.LANCZOS).save(os.path.join(OUT, "showroom-mobile.webp"), "WEBP", quality=82, method=6)
    print("✓ showroom-mobile")
