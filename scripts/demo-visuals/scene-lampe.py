"""
Visuels ORIGINAUX de démonstration pour la section « Hero immersif » (scène composée) :
une lampe sculpturale en éléments séparés (abat-jour, pied, socle, lumière) et deux
objets d'accompagnement (vase, galet). Rendu procédural (éclairage calculé par pixel :
normales, diffus, spéculaire, occlusion douce, grain de matière) — aucune photographie,
aucune ressource tierce : droits entiers, provenance = ce script.

Usage : python3 scripts/demo-visuals/scene-lampe.py  (nécessite numpy et Pillow)
Sortie : apps/web/public/demo-templates/scene-lampe/*.webp (fond transparent)
"""
import os
import numpy as np
from PIL import Image, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "../../apps/web/public/demo-templates/scene-lampe")
os.makedirs(OUT, exist_ok=True)
SS = 2  # suréchantillonnage (anti-crénelage)
LIGHT = np.array([-0.45, -0.55, 0.70])
LIGHT = LIGHT / np.linalg.norm(LIGHT)
VIEW = np.array([0.0, 0.0, 1.0])
rng = np.random.default_rng(7)


def shade(normal, base, spec=0.35, gloss=40, ambient=0.34, grain=0.0):
    """Éclairage : diffus + spéculaire (Blinn) + lumière de rebond chaude."""
    ndl = np.clip((normal * LIGHT).sum(-1), 0, 1)
    h = LIGHT + VIEW
    h = h / np.linalg.norm(h)
    ndh = np.clip((normal * h).sum(-1), 0, 1)
    rim = np.clip(1 - normal[..., 2], 0, 1) ** 3
    col = base * (ambient + 0.78 * ndl[..., None]) + spec * (ndh ** gloss)[..., None] + 0.10 * rim[..., None] * np.array([1.0, 0.86, 0.7])
    if grain:
        col = col * (1 + grain * rng.normal(0, 1, col.shape[:2])[..., None])
    return np.clip(col, 0, 1)


def canvas(w, h):
    ys, xs = np.mgrid[0 : h * SS, 0 : w * SS].astype(np.float64)
    return xs / SS, ys / SS


def save(rgb, alpha, name, blur=0.0):
    img = np.dstack([rgb, alpha]) * 255
    im = Image.fromarray(img.astype(np.uint8), "RGBA")
    if blur:
        im = im.filter(ImageFilter.GaussianBlur(blur * SS))
    w, h = im.size
    im = im.resize((w // SS, h // SS), Image.LANCZOS)
    im.save(os.path.join(OUT, name), "WEBP", quality=90, method=6)
    print(name, im.size, os.path.getsize(os.path.join(OUT, name)))


def smooth_mask(d, edge=1.2):
    """Masque doux à partir d'une distance signée (négative = intérieur)."""
    return np.clip(0.5 - d / edge, 0, 1)


# --- Abat-jour : demi-sphère aplatie en céramique émaillée sable ---------------------
def shade_dome():
    W, H = 900, 560
    x, y = canvas(W, H)
    cx, cy, rx, ry = W / 2, 470, 400, 400
    u, v = (x - cx) / rx, (y - cy) / ry
    r2 = u ** 2 + v ** 2
    inside = (r2 <= 1) & (v <= 0)
    nz = np.sqrt(np.clip(1 - r2, 0, 1))
    normal = np.dstack([u, v, nz])
    base = np.array([0.93, 0.86, 0.74])
    rgb = shade(normal, base, spec=0.22, gloss=18, grain=0.018)
    # dégradé vers la lèvre : la base du dôme reçoit la lumière de l'ampoule
    rgb = np.clip(rgb + (np.clip(1 + v, 0, 1) ** 6)[..., None] * np.array([0.10, 0.07, 0.02]), 0, 1)
    # lèvre inférieure : ourlet plus clair, puis intérieur lumineux (la lampe est allumée)
    lip = (np.abs(v) < 0.045) & (r2 <= 1.0)
    rgb[lip] = rgb[lip] * 0.85 + np.array([1.0, 0.93, 0.8]) * 0.15
    d = np.maximum(np.sqrt(r2) - 1, v) * rx
    alpha = smooth_mask(d)
    save(rgb, alpha, "abat-jour.webp")


# --- Pied : cylindre de laiton brossé -------------------------------------------------
def stem():
    W, H = 160, 620
    x, y = canvas(W, H)
    cx, rad = W / 2, 34
    u = (x - cx) / rad
    inside = np.abs(u) <= 1
    nz = np.sqrt(np.clip(1 - u ** 2, 0, 1))
    normal = np.dstack([u, np.zeros_like(u), nz])
    base = np.array([0.78, 0.60, 0.33])
    rgb = shade(normal, base, spec=0.8, gloss=24, ambient=0.28)
    brushed = 1 + 0.05 * np.sin(y * 1.7 + rng.normal(0, 0.4, y.shape))
    rgb = np.clip(rgb * brushed[..., None], 0, 1)
    d = np.maximum((np.abs(u) - 1) * rad, np.maximum(8 - y, y - (H - 8)))
    save(rgb, smooth_mask(d), "pied.webp")


# --- Socle : disque de pierre (tranche + dessus elliptique) --------------------------
def base_stone():
    W, H = 760, 300
    x, y = canvas(W, H)
    cx, rx, ry, top, bottom = W / 2, 340, 80, 100, 190
    u = (x - cx) / rx
    ut, vt = u, (y - top) / ry
    top_face = ut ** 2 + vt ** 2 <= 1
    side = (np.abs(u) <= 1) & (y >= top) & (y <= bottom + ry * np.sqrt(np.clip(1 - u ** 2, 0, 1)))
    nside = np.dstack([u, np.full_like(u, 0.15), np.sqrt(np.clip(1 - u ** 2, 0, 1))])
    ntop = np.dstack([ut * 0.25, -np.ones_like(u) * 0.95, np.full_like(u, 0.35)])
    ntop = ntop / np.linalg.norm(ntop, axis=-1, keepdims=True)
    stone = np.array([0.80, 0.77, 0.72])
    rgb = np.where(top_face[..., None], shade(ntop, stone * 1.04, spec=0.12, gloss=10, grain=0.05), shade(nside, stone * 0.9, spec=0.1, gloss=8, grain=0.06))
    d_side = np.maximum((np.abs(u) - 1) * rx, np.maximum(top - y, y - (bottom + ry * np.sqrt(np.clip(1 - u ** 2, 0, 1)))))
    d_top = (np.sqrt(ut ** 2 + vt ** 2) - 1) * ry
    save(rgb, smooth_mask(np.minimum(d_side, d_top)), "socle.webp")


# --- Lumière : halo chaud diffus (calque additionnel) ---------------------------------
def glow():
    W, H = 800, 520
    x, y = canvas(W, H)
    u, v = (x - W / 2) / 360, (y - 120) / 380
    r = np.sqrt(u ** 2 + v ** 2)
    a = np.clip(1 - r, 0, 1) ** 2.2
    rgb = np.ones(x.shape + (3,)) * np.array([1.0, 0.86, 0.6])
    save(rgb, a * 0.85, "lumiere.webp", blur=6)


# --- Vase : céramique bleu profond (profil de révolution) -----------------------------
def vase():
    W, H = 420, 640
    x, y = canvas(W, H)
    t = np.clip((y - 20) / (H - 40), 0, 1)
    prof = 60 + 120 * np.sin(np.pi * (0.15 + 0.8 * t)) ** 1.4 * (1 - 0.35 * t) + 18 * (t < 0.08)
    u = (x - W / 2) / prof
    nz = np.sqrt(np.clip(1 - u ** 2, 0, 1))
    normal = np.dstack([u, np.full_like(u, -0.1), nz])
    normal = normal / np.linalg.norm(normal, axis=-1, keepdims=True)
    base = np.array([0.13, 0.25, 0.62])
    rgb = shade(normal, base, spec=0.65, gloss=70, ambient=0.3, grain=0.02)
    d = np.maximum((np.abs(u) - 1) * prof, np.maximum(20 - y, y - (H - 20)))
    save(rgb, smooth_mask(d), "vase.webp")


# --- Galet : ellipsoïde de pierre polie ----------------------------------------------
def pebble():
    W, H = 360, 240
    x, y = canvas(W, H)
    u, v = (x - W / 2) / 160, (y - H / 2) / 100
    r2 = u ** 2 + v ** 2
    nz = np.sqrt(np.clip(1 - r2, 0, 1))
    normal = np.dstack([u, v, nz])
    rgb = shade(normal, np.array([0.36, 0.33, 0.31]), spec=0.45, gloss=35, grain=0.04)
    save(rgb, smooth_mask((np.sqrt(r2) - 1) * 100), "galet.webp")


if __name__ == "__main__":
    shade_dome()
    stem()
    base_stone()
    glow()
    vase()
    pebble()
