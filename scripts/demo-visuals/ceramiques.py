"""
Visuels ORIGINAUX de démonstration : collection « Terres émaillées » — six céramiques
détourées (fond transparent) pour le carrousel « objets en arc » et le récit « objet mis
en scène ». Rendu procédural : profil de révolution, normales exactes (pente du profil
comprise), émail brillant + spéculaire, lèvre et ouverture, pied en terre non émaillée,
cercles de tournage, coulure d'émail. Aucune photographie, aucune ressource tierce :
droits entiers, provenance = ce script.

Toutes les pièces partagent le même cadre et la même ligne de sol : alignées dans un
carrousel, elles « se posent » au même niveau.

Usage : python3 scripts/demo-visuals/ceramiques.py  (nécessite numpy et Pillow)
Sortie : apps/web/public/demo-templates/ceramiques/*.webp
"""
import os
import numpy as np
from PIL import Image

OUT = os.path.join(os.path.dirname(__file__), "../../apps/web/public/demo-templates/ceramiques")
os.makedirs(OUT, exist_ok=True)
SS = 2
W, H, BASE = 520, 760, 736  # cadre commun, ligne de sol
LIGHT = np.array([-0.5, -0.45, 0.74])
LIGHT = LIGHT / np.linalg.norm(LIGHT)
HALF = LIGHT + np.array([0.0, 0.0, 1.0])
HALF = HALF / np.linalg.norm(HALF)
rng = np.random.default_rng(11)


def render(name, height, profile, glaze, clay, gloss=60, spec=0.75, foot=0.06, drip=0.0, mouth=0.55):
    """`profile(t)` : rayon (px) pour t ∈ [0, 1] du haut vers le bas de la pièce."""
    ys, xs = np.mgrid[0 : H * SS, 0 : W * SS].astype(np.float64) / SS
    top = BASE - height
    t = np.clip((ys - top) / height, 0, 1)
    r = profile(t)
    dt = 1e-3
    slope = (profile(np.clip(t + dt, 0, 1)) - profile(np.clip(t - dt, 0, 1))) / (2 * dt * height)
    u = (xs - W / 2) / np.maximum(r, 1e-3)
    inside_u = np.abs(u) <= 1
    cz = np.sqrt(np.clip(1 - u ** 2, 0, 1))
    # Cercles de tournage : légère ondulation du profil.
    ring = 0.012 * np.sin(ys * 0.21 + 0.8 * np.sin(ys * 0.037))
    n = np.dstack([u, -(slope + ring) * 1.0, cz])
    n = n / np.linalg.norm(n, axis=-1, keepdims=True)

    # Émail : teinte + variation verticale, coulure vers le pied, terre nue au pied.
    base = np.ones(xs.shape + (3,)) * np.array(glaze)
    base = base * (1.05 - 0.18 * t[..., None])
    # Lisière d'émail : légèrement irrégulière autour de la pièce (angle de révolution),
    # l'émail s'épaissit et fonce juste au-dessus (coulure).
    ang = np.arcsin(np.clip(u, -1, 1))
    wav = 0.012 * np.sin(3 * ang + 0.7) + 0.008 * np.sin(7 * ang + 2.1)
    edge = 1 - foot + wav
    if drip:
        pool = np.clip(1 - (edge - t) / 0.07, 0, 1) ** 2 * (t < edge)
        base = base * (1 - drip * pool[..., None])
    bare = t > edge
    base[bare] = np.array(clay)

    ndl = np.clip((n * LIGHT).sum(-1), 0, 1)
    ndh = np.clip((n * HALF).sum(-1), 0, 1)
    rim = np.clip(1 - n[..., 2], 0, 1) ** 2.5
    s = np.where(bare, 0.05, spec) * ndh ** np.where(bare, 6, gloss)
    col = base * (0.30 + 0.80 * ndl[..., None]) + s[..., None] + 0.12 * rim[..., None] * np.array([1.0, 0.9, 0.78])
    # Reflet de fenêtre, étroit, sur l'émail (lecture « brillant »).
    win = np.exp(-(((u + 0.42) / 0.07) ** 2)) * np.clip(1 - np.abs(t - 0.45) / 0.4, 0, 1)
    col += (0.35 * win * (~bare))[..., None]
    grain = 1 + np.where(bare, 0.06, 0.012) * rng.normal(0, 1, xs.shape)
    col = np.clip(col * grain[..., None], 0, 1)

    # Silhouette : fond elliptique (vu légèrement de haut), lèvre elliptique au sommet.
    r_top, r_bot = profile(np.array(0.0)), profile(np.array(1.0))
    e_top, e_bot = r_top * 0.2, r_bot * 0.16
    bottom = BASE + e_bot * cz - e_bot
    d_side = (np.abs(u) - 1) * r
    d = np.maximum(d_side, np.maximum(top - ys, ys - bottom))
    # Au-dessus de la lèvre : ellipse de l'ouverture.
    lip_u = (xs - W / 2) / r_top
    lip_v = (ys - top) / e_top
    lip = lip_u ** 2 + lip_v ** 2
    d = np.minimum(d, (np.sqrt(lip) - 1) * e_top)
    alpha = np.clip(0.5 - d / 1.2, 0, 1)
    # Ouverture : intérieur sombre (bord émaillé clair tout autour).
    hole = (lip_u / mouth) ** 2 + (lip_v / mouth) ** 2
    rim_band = (lip <= 1) & (hole > 1)
    col[rim_band] = np.clip(np.array(glaze) * 1.12 + 0.05, 0, 1)
    inner = hole <= 1
    depth = np.clip(1 - hole, 0, 1)
    col[inner] = (np.array(glaze) * (0.18 + 0.55 * mouth ** 3))[None, :] * (0.55 + 0.45 * (1 - depth[inner]))[:, None]

    img = np.dstack([col, alpha]) * 255
    im = Image.fromarray(img.astype(np.uint8), "RGBA").resize((W, H), Image.LANCZOS)
    path = os.path.join(OUT, f"{name}.webp")
    im.save(path, "WEBP", quality=90, method=6)
    print(name, im.size, os.path.getsize(path))


def smooth(x):
    return x * x * (3 - 2 * x)


def bell(t, a, b, p=1.0):
    return np.sin(np.pi * (a + (b - a) * t)) ** p


if __name__ == "__main__":
    # Jarre Indigo : panse ronde, col court.
    render("jarre-indigo", 520, lambda t: 70 + 150 * bell(t, 0.08, 0.92, 1.3) - 20 * t, glaze=(0.10, 0.20, 0.55), clay=(0.72, 0.56, 0.42), drip=0.35)
    # Bouteille Céladon : haute, col étroit.
    render("bouteille-celadon", 640, lambda t: 34 + 120 * smooth(np.clip((t - 0.30) / 0.30, 0, 1)) * (1 - 0.18 * np.clip((t - 0.6) / 0.4, 0, 1) ** 2) + 6 * (t < 0.04), glaze=(0.55, 0.72, 0.62), clay=(0.78, 0.66, 0.52), gloss=80, drip=0.2, mouth=0.7)
    # Vase Terracotta : ovoïde, émail mat.
    render("vase-terracotta", 560, lambda t: 58 + 128 * bell(t, 0.12, 0.95, 0.9) * (1 - 0.25 * t), glaze=(0.70, 0.32, 0.18), clay=(0.62, 0.40, 0.28), gloss=14, spec=0.25)
    # Amphore Ocre : épaule haute, base resserrée.
    render("amphore-ocre", 600, lambda t: 48 + 150 * np.sin(np.pi * np.clip(0.06 + t * 0.9, 0, 1)) ** 0.9 * (1 - 0.6 * t ** 1.6) + 30 * t ** 3, glaze=(0.76, 0.54, 0.16), clay=(0.72, 0.56, 0.42), drip=0.45)
    # Soliflore Nuit : fin et haut, émail noir brillant.
    render("soliflore-nuit", 660, lambda t: 26 + 72 * bell(t, 0.28, 0.98, 0.7), glaze=(0.10, 0.10, 0.14), clay=(0.70, 0.60, 0.50), gloss=110, spec=0.9, mouth=0.65)
    # Coupe Sable : large et basse sur petit pied.
    render("coupe-sable", 300, lambda t: 210 - 150 * t ** 1.8 + 0 * t, glaze=(0.86, 0.76, 0.58), clay=(0.74, 0.62, 0.48), gloss=40, spec=0.4, foot=0.12, mouth=0.9)
