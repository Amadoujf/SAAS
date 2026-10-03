"""
Visuels ORIGINAUX de démonstration pour la scène immersive du restaurant (« le yassa se
compose ») : l'assiette au centre et ses ingrédients préparés séparément (citron,
oignons, piment, poulet grillé, herbes) sur fond transparent, plus un halo de braise.
Rendu procédural — aucune photographie, aucune ressource tierce : droits entiers,
provenance = ce script. Illustrations de démonstration, jamais présentées comme les
plats d'un restaurant réel.

Usage : python3 scripts/demo-visuals/scene-yassa.py  (nécessite numpy et Pillow)
Sortie : apps/web/public/demo-templates/scene-yassa/*.webp (fond transparent)
"""
import math
import os
import sys

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, os.path.dirname(__file__))
import importlib

R = importlib.import_module("restaurant")  # fonctions de dessin partagées (assiette, riz, sauces…)

OUT = os.path.join(os.path.dirname(__file__), "../../apps/web/public/demo-templates/scene-yassa")
os.makedirs(OUT, exist_ok=True)
S = R.S


def canvas(w, h):
    return Image.new("RGBA", (w * S, h * S), (0, 0, 0, 0))


def save(img, name, w, h):
    out = img.resize((w, h), Image.LANCZOS)
    box = out.getbbox()
    if box:
        pad = 6
        out = out.crop((max(0, box[0] - pad), max(0, box[1] - pad), min(w, box[2] + pad), min(h, box[3] + pad)))
    out.save(os.path.join(OUT, f"{name}.webp"), "WEBP", quality=88, method=6, lossless=False)
    print("✓", name, out.size)


def assiette():
    w, h = 900, 900
    img = canvas(w, h)
    R.plate(img, 450, 440, 380)
    R.rice(img, 330, 450, 175, 3)
    R.blob(img, 570, 430, 180, 160, "#C98A1E", soft=10, seed=4)
    R.onion_rings(img, 570, 430, 140, 5, n=30)
    for i, (x, y) in enumerate([(560, 400), (630, 480), (520, 500)]):
        R.meat_piece(img, x, y, 58, 44, 20 + i, dark="#6B3A12", mid="#A55E1E", light="#D99040")
    R.herbs(img, 560, 440, 140, 7, n=16)
    R.shine(img, 500, 360, 60, 14, 60)
    save(img, "assiette", w, h)


def citron():
    w, h = 420, 420
    img = canvas(w, h)
    cx, cy, r = 210, 210, 170
    d = ImageDraw.Draw(img)
    d.ellipse([(cx - r) * S, (cy - r) * S, (cx + r) * S, (cy + r) * S], fill=R.rgb("#D9C21F"))
    rr = r * 0.9
    d.ellipse([(cx - rr) * S, (cy - rr) * S, (cx + rr) * S, (cy + rr) * S], fill=R.rgb("#F4EFC2"))
    ri = r * 0.84
    for k in range(10):
        a0 = k * 36 + 3
        d.pieslice([(cx - ri) * S, (cy - ri) * S, (cx + ri) * S, (cy + ri) * S], a0, a0 + 30, fill=R.rgb("#F2DE5C"))
    d.ellipse([(cx - 14) * S, (cy - 14) * S, (cx + 14) * S, (cy + 14) * S], fill=R.rgb("#F6F0C8"))
    R.shine(img, cx - 50, cy - 60, 50, 18, 90)
    save(img, "citron", w, h)


def oignons():
    w, h = 520, 360
    img = canvas(w, h)
    R.onion_rings(img, 260, 180, 150, 11, n=18, color="#EFE3F0", edge="#B786B8")
    save(img, "oignons", w, h)


def piment():
    w, h = 520, 220
    img = canvas(w, h)
    d = ImageDraw.Draw(img)
    pts = []
    for i in range(40):
        t = i / 39
        x = 60 + t * 380
        y = 120 - math.sin(t * math.pi) * 40
        wdt = 34 * (1 - t) ** 0.6 + 3
        pts.append((x, y, wdt))
    for x, y, wd in pts:
        d.ellipse([(x - wd) * S, (y - wd * 0.8) * S, (x + wd) * S, (y + wd * 0.8) * S], fill=R.rgb("#B81E14"))
    for x, y, wd in pts[:30]:
        d.ellipse([(x - wd * 0.5) * S, (y - wd * 0.6) * S, (x + wd * 0.2) * S, (y - wd * 0.2) * S], fill=R.rgb("#E0493A"))
    d.line([(40 * S, 110 * S), (70 * S, 118 * S)], fill=R.rgb("#3D7A2A"), width=14 * S)
    d.ellipse([(52 * S, 96 * S), (86 * S, 138 * S)], fill=R.rgb("#4E8E34"))
    R.shine(img, 170, 90, 60, 8, 110)
    save(img, "piment", w, h)


def poulet():
    w, h = 520, 400
    img = canvas(w, h)
    R.meat_piece(img, 260, 200, 190, 130, 77, dark="#6B3A12", mid="#A55E1E", light="#D99040")
    save(img, "poulet", w, h)


def herbes():
    w, h = 420, 420
    img = canvas(w, h)
    d = ImageDraw.Draw(img)
    rng = np.random.default_rng(3)
    d.line([(210 * S, 390 * S), (210 * S, 80 * S)], fill=R.rgb("#3E6E28"), width=6 * S)
    for k in range(9):
        y = 100 + k * 32
        for side in (-1, 1):
            x = 210 + side * rng.uniform(40, 70)
            R.blob(img, x, y, 42, 22, "#3F8A2E" if k % 2 else "#57A63C", soft=1.2, seed=k * 2 + (side > 0), lumpy=0.3)
    save(img, "herbes", w, h)


def lueur():
    w, h = 900, 600
    y, x = np.mgrid[0 : h * S, 0 : w * S]
    d = np.sqrt(((x - w * S / 2) / (w * S * 0.46)) ** 2 + ((y - h * S / 2) / (h * S * 0.42)) ** 2)
    a = np.clip(1 - d, 0, 1) ** 2.2
    arr = np.zeros((h * S, w * S, 4), np.uint8)
    arr[..., 0], arr[..., 1], arr[..., 2] = 242, 140, 40
    arr[..., 3] = (a * 170).astype(np.uint8)
    save(Image.fromarray(arr, "RGBA"), "lueur", w, h)


if __name__ == "__main__":
    lueur()
    assiette()
    citron()
    oignons()
    piment()
    poulet()
    herbes()
