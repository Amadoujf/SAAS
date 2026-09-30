"""
Visuel ORIGINAL de démonstration pour le secteur Livraison (template « Trajet ») : plan
de ville imaginaire (îlots, grands axes, littoral), tracé pointillé du retrait à la remise
et repères. Rendu par procédé, sans carte réelle, sans données géographiques tierces,
sans logo : droits entiers, provenance = ce script. Illustration de démonstration.

Usage : python3 scripts/demo-visuals/livraison.py  (nécessite numpy et Pillow)
Sortie : apps/web/public/demo-templates/livraison/*.webp
"""
import math
import os
import random

from PIL import Image, ImageDraw, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "../../apps/web/public/demo-templates/livraison")
os.makedirs(OUT, exist_ok=True)
S = 2


def plan(name, w=1600, h=1000, seed=3):
    random.seed(seed)
    img = Image.new("RGB", (w * S, h * S), (16, 24, 32))
    d = ImageDraw.Draw(img, "RGBA")
    # littoral (océan à gauche et en haut)
    coast = [(0, 0), (int(w * 0.34) * S, 0)]
    for k in range(0, 21):
        y = h * k / 20
        x = w * 0.30 + math.sin(k / 3.2) * w * 0.05 + (k / 20) * -w * 0.18
        coast.append((int(x) * S, int(y) * S))
    coast += [(0, h * S)]
    d.polygon(coast, fill=(22, 44, 58))
    # îlots urbains
    for gx in range(0, w, 70):
        for gy in range(0, h, 58):
            jx, jy = random.randint(-6, 6), random.randint(-6, 6)
            x0, y0 = gx + 8 + jx, gy + 8 + jy
            x1, y1 = x0 + random.randint(40, 56), y0 + random.randint(30, 42)
            shade = random.randint(30, 44)
            d.rounded_rectangle([x0 * S, y0 * S, x1 * S, y1 * S], 4 * S, fill=(shade, shade + 8, shade + 16, 255))
    # recouvre l'océan (les îlots ne débordent pas sur l'eau)
    d.polygon(coast, fill=(22, 44, 58))
    # grands axes
    for pts, wd in [([(0.30, 1.0), (0.42, 0.62), (0.55, 0.45), (1.0, 0.30)], 16), ([(0.36, 0.0), (0.46, 0.35), (0.62, 1.0)], 12), ([(0.40, 0.80), (0.75, 0.70), (1.0, 0.78)], 10)]:
        d.line([(int(x * w) * S, int(y * h) * S) for x, y in pts], fill=(70, 82, 94, 255), width=wd * S, joint="curve")
    # tracé de la course (pointillés jaunes) du retrait (A) à la remise (B)
    route = [(0.47, 0.86), (0.52, 0.66), (0.60, 0.55), (0.70, 0.52), (0.78, 0.40), (0.86, 0.26)]
    pts = []
    for i in range(len(route) - 1):
        (x0, y0), (x1, y1) = route[i], route[i + 1]
        for t in range(0, 30):
            u = t / 30
            pts.append(((x0 + (x1 - x0) * u) * w, (y0 + (y1 - y0) * u) * h))
    glow = Image.new("RGBA", img.size, (0, 0, 0, 0))
    gd = ImageDraw.Draw(glow)
    gd.line([(x * S, y * S) for x, y in pts], fill=(255, 210, 63, 120), width=22 * S, joint="curve")
    img.paste(glow.filter(ImageFilter.GaussianBlur(14 * S)), (0, 0), glow.filter(ImageFilter.GaussianBlur(14 * S)))
    for k in range(0, len(pts) - 1, 3):
        (x0, y0), (x1, y1) = pts[k], pts[min(k + 1, len(pts) - 1)]
        d.line([(x0 * S, y0 * S), (x1 * S, y1 * S)], fill=(255, 210, 63, 255), width=7 * S)
    ax, ay = route[0][0] * w, route[0][1] * h
    bx, by = route[-1][0] * w, route[-1][1] * h
    d.ellipse([(ax - 18) * S, (ay - 18) * S, (ax + 18) * S, (ay + 18) * S], fill=(255, 210, 63, 255))
    d.ellipse([(bx - 22) * S, (by - 22) * S, (bx + 22) * S, (by + 22) * S], outline=(255, 210, 63, 255), width=7 * S)
    d.ellipse([(bx - 7) * S, (by - 7) * S, (bx + 7) * S, (by + 7) * S], fill=(255, 107, 61, 255))
    # livreur en route (repère)
    mx, my = route[3][0] * w, route[3][1] * h
    d.ellipse([(mx - 14) * S, (my - 14) * S, (mx + 14) * S, (my + 14) * S], fill=(255, 255, 255, 255))
    d.ellipse([(mx - 6) * S, (my - 6) * S, (mx + 6) * S, (my + 6) * S], fill=(16, 24, 32, 255))
    out = img.resize((w, h), Image.LANCZOS)
    path = os.path.join(OUT, f"{name}.webp")
    out.save(path, "WEBP", quality=82, method=6)
    print(path, os.path.getsize(path))


if __name__ == "__main__":
    plan("plan-ville")
