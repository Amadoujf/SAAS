"""
Visuels ORIGINAUX de démonstration pour le secteur Voyage : paysages rendus par
procédé (ciel en dégradé, soleil et halo, reliefs par bruit fractal, perspective
atmosphérique, reflets dans l'eau, silhouettes). Aucune photographie, aucune ressource
tierce : droits entiers, provenance = ce script. Ce sont des illustrations de
démonstration, jamais présentées comme les voyages d'une agence réelle.

Usage : python3 scripts/demo-visuals/voyage.py  (nécessite numpy et Pillow)
Sortie : apps/web/public/demo-templates/voyage/*.webp (+ recadrages -mobile)
"""
import os
import numpy as np
from PIL import Image, ImageFilter

OUT = os.path.join(os.path.dirname(__file__), "../../apps/web/public/demo-templates/voyage")
os.makedirs(OUT, exist_ok=True)
W, H = 1600, 1000


def hexrgb(h):
    h = h.lstrip("#")
    return np.array([int(h[i : i + 2], 16) for i in (0, 2, 4)], dtype=np.float64) / 255


def lerp(a, b, t):
    return a + (b - a) * t


def smooth(t):
    t = np.clip(t, 0, 1)
    return t * t * (3 - 2 * t)


def ridge(rng, n, base, amp, octaves=5, rough=0.5, freq=2.0):
    """Ligne de crête 1D (fBm par sinusoïdes à phases aléatoires)."""
    x = np.linspace(0, 1, n)
    y = np.zeros(n)
    a, f = amp, freq
    for _ in range(octaves):
        y += a * np.sin(2 * np.pi * (f * x + rng.random())) * (0.6 + 0.4 * rng.random())
        a *= rough
        f *= 2.1
    return base + y


def noise2d(rng, w, h, scale):
    small = rng.random((max(2, h // scale), max(2, w // scale)))
    img = Image.fromarray((small * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
    return np.asarray(img, dtype=np.float64) / 255


def sky(stops):
    """Dégradé vertical : liste de (position 0..1, couleur)."""
    ys = np.linspace(0, 1, H)[:, None]
    img = np.zeros((H, W, 3))
    for (p0, c0), (p1, c1) in zip(stops[:-1], stops[1:]):
        t = smooth((ys - p0) / max(1e-6, p1 - p0))
        mask = (ys >= p0) & (ys <= p1)
        img = np.where(mask[..., None], lerp(hexrgb(c0), hexrgb(c1), t[..., None]) * np.ones((1, W, 1)), img)
    # Au-delà du dernier arrêt : dernière couleur jusqu'en bas (jamais de bande vide).
    img = np.where((ys > stops[-1][0])[..., None], hexrgb(stops[-1][1]) * np.ones((H, W, 3)), img)
    return img


def sun(img, cx, cy, r, color, glow=6.0, strength=1.0, horizon=None):
    ys, xs = np.mgrid[0:H, 0:W]
    d = np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2)
    halo = np.exp(-(d / (r * glow)) ** 1.4) * 0.55 * strength
    disc = smooth((r - d) / 2.0) * strength
    if horizon is not None:
        above = smooth((horizon - ys) / 3.0)
        disc = disc * above
        halo = halo * (0.35 + 0.65 * above)
    c = hexrgb(color)
    img = img + halo[..., None] * c
    img = lerp(img, c * 1.05 + 0.05, disc[..., None])
    return img


def layer(img, top, color, haze=0.0, haze_color=None, shade=None):
    """Remplit sous la crête `top` (par colonne) ; brume vers la couleur du ciel."""
    ys = np.arange(H)[:, None]
    mask = smooth((ys - top[None, :]) + 0.5)
    c = hexrgb(color) * np.ones((H, W, 3))
    if shade is not None:
        c = c * shade[..., None]
    if haze and haze_color is not None:
        c = lerp(c, hexrgb(haze_color), haze)
    return lerp(img, c, mask[..., None])


def water(img, horizon, tint, ripple=0.012, rng=None, darken=0.85):
    """Reflet du haut de l'image sous l'horizon, ondulé et teinté."""
    out = img.copy()
    rows = np.arange(horizon, H)
    src = np.clip(2 * horizon - rows, 0, horizon - 1)
    for i, (r, s) in enumerate(zip(rows, src)):
        depth = (r - horizon) / max(1, H - horizon)
        shift = (np.sin(np.arange(W) * (0.02 + 0.05 * depth) + r * 0.9) * ripple * W * (0.2 + depth)).astype(int)
        line = img[s, (np.arange(W) + shift) % W]
        out[r] = lerp(line * darken, hexrgb(tint), 0.25 + 0.45 * depth)
    return out


def shimmer(img, horizon, cx, width, color, strength=0.55, rng=None):
    """Traînée de lumière du soleil sur l'eau, en éclats horizontaux."""
    ys, xs = np.mgrid[0:H, 0:W]
    depth = np.clip((ys - horizon) / max(1, H - horizon), 0, 1)
    spread = width * (0.6 + 2.2 * depth)
    band = np.exp(-((xs - cx) / spread) ** 2) * (ys > horizon)
    sparkle = (np.sin(xs * 0.21 + ys * 1.7) * np.sin(ys * 0.93 + xs * 0.05) > 0.35).astype(np.float64)
    m = band * (0.35 + 0.65 * sparkle) * (1 - 0.7 * depth) * strength
    return img + m[..., None] * hexrgb(color)


def palm(img, x, base, height, lean, color, rng, scale=1.0):
    """Silhouette de palmier : tronc courbe + palmes."""
    from PIL import ImageDraw

    mask = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(mask)
    pts = []
    for t in np.linspace(0, 1, 40):
        px = x + lean * height * (t ** 1.6)
        py = base - height * t
        pts.append((px, py))
    for i in range(len(pts) - 1):
        w = (10 - 5 * i / len(pts)) * scale
        d.line([pts[i], pts[i + 1]], fill=255, width=max(2, int(w)))
    tx, ty = pts[-1]
    n_fronds = 12
    for k in range(n_fronds):
        ang = -np.pi / 2 + (k - (n_fronds - 1) / 2) * (2.9 / n_fronds) + rng.normal(0, 0.07)
        length = height * (0.34 + 0.1 * rng.random()) * (1.0 if abs(np.cos(ang)) > 0.3 else 0.8)
        droop = length * (0.5 + 0.35 * abs(np.cos(ang)))
        spine = []
        for t in np.linspace(0, 1, 26):
            spine.append((tx + np.cos(ang) * length * t, ty + np.sin(ang) * length * t + droop * t * t))
        for i in range(len(spine) - 1):
            d.line([spine[i], spine[i + 1]], fill=255, width=max(2, int((5 - 4 * i / 26) * scale)))
        # Folioles : de part et d'autre de la nervure, pendantes, plus longues au milieu.
        for i in range(2, len(spine) - 1):
            t = i / (len(spine) - 1)
            (x0, y0), (x1, y1) = spine[i - 1], spine[i]
            dx, dy = x1 - x0, y1 - y0
            norm = max(1e-6, np.hypot(dx, dy))
            nx, ny = -dy / norm, dx / norm
            leaf = (34 * np.sin(np.pi * min(1, t * 1.15)) + 6) * scale
            for sgn in (-1, 1):
                ex = x1 + sgn * nx * leaf * 0.55 + dx / norm * leaf * 0.5
                ey = y1 + sgn * ny * leaf * 0.55 + dy / norm * leaf * 0.5 + leaf * 0.55
                d.line([(x1, y1), (ex, ey)], fill=255, width=max(2, int(3.2 * scale)))
    m = np.asarray(mask.filter(ImageFilter.GaussianBlur(0.8)), dtype=np.float64) / 255
    return lerp(img, hexrgb(color) * np.ones_like(img), m[..., None])


def finish(img, name, grain=0.018, vignette=0.22, seed=0, mobile_center=0.5):
    rng = np.random.default_rng(seed + 99)
    ys, xs = np.mgrid[0:H, 0:W]
    v = 1 - vignette * (((xs - W / 2) / (W / 2)) ** 2 + ((ys - H / 2) / (H / 2)) ** 2) / 2
    img = img * v[..., None]
    img = img + rng.normal(0, grain, img.shape)
    im = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))
    im.save(os.path.join(OUT, f"{name}.webp"), quality=86, method=6)
    cw = int(H * 0.8)
    x0 = int(np.clip(W * mobile_center - cw / 2, 0, W - cw))
    im.crop((x0, 0, x0 + cw, H)).resize((640, 800), Image.LANCZOS).save(os.path.join(OUT, f"{name}-mobile.webp"), quality=84, method=6)
    print("ok", name)


def dune_line(rng, base, amp, freq):
    x = np.linspace(0, 1, W)
    y = np.zeros(W)
    for k, a in enumerate([1.0, 0.45, 0.2]):
        ph = rng.random()
        f = freq * (1 + 1.3 * k)
        wave = np.sin(2 * np.pi * (f * x + ph))
        y += a * (np.abs(wave) ** 0.7 * np.sign(wave))
    return base - amp * (y - y.min()) / max(1e-6, y.max() - y.min())


def desert(seed=1):
    rng = np.random.default_rng(seed)
    horizon = 600
    img = sky([(0, "#2B2F5A"), (0.28, "#C8646A"), (0.5, "#F2A65A"), (0.62, "#F8D9A0")])
    img = sun(img, 1080, 575, 46, "#FFE3A6", glow=7, horizon=horizon)
    far = dune_line(rng, horizon + 12, 30, 0.8)
    img = layer(img, far, "#D08A5E", haze=0.5, haze_color="#F4B982")
    for i, (base, amp, light, dark, hz) in enumerate([(700, 70, "#D9955F", "#9C5A3A", 0.3), (800, 100, "#CF854F", "#86472A", 0.15), (930, 120, "#C4773F", "#6E3920", 0.0)]):
        top = dune_line(rng, base, amp, 0.55 + 0.25 * i)
        slope = np.gradient(top)
        # Versant éclairé (soleil à droite) / versant à l'ombre, fondu doux.
        lit = smooth(0.5 + np.tanh(slope * 0.35) * 0.5)
        ys = np.arange(H)[:, None]
        depth = np.clip((ys - top[None, :]) / 260, 0, 1)
        col = lerp(hexrgb(dark), hexrgb(light), lit[None, :, None]) * (1 - 0.22 * depth[..., None])
        col = lerp(col, hexrgb("#F4B982"), hz)
        mask = smooth((ys - top[None, :]) + 0.5)
        img = lerp(img, col, mask[..., None])
    finish(img, "dunes-lompoul", seed=seed, mobile_center=0.66)


def ocean(seed=2):
    rng = np.random.default_rng(seed)
    horizon = 560
    img = sky([(0, "#1D2A4F"), (0.3, "#6C4C7A"), (0.47, "#E0775E"), (0.56, "#FBC47C")])
    img = water(img, horizon, "#1F3355", ripple=0.006, rng=rng)
    img = sun(img, 820, 530, 40, "#FFD89A", glow=8, horizon=horizon)
    img = shimmer(img, horizon, 820, 40, "#FFC98A")
    beach = ridge(rng, W, 900, 18, freq=0.6)
    img = layer(img, beach, "#2A1E22")
    for x, h, lean, s in [(180, 520, 0.18, 1.2), (330, 430, -0.12, 1.0), (1420, 470, -0.22, 1.1)]:
        img = palm(img, x, 960, h, lean, "#1A1216", rng, s)
    finish(img, "ocean-saly", seed=seed, mobile_center=0.5)


def casamance(seed=3):
    rng = np.random.default_rng(seed)
    horizon = 590
    img = sky([(0, "#9FC4C8"), (0.35, "#D8E6D6"), (0.59, "#F3EBD2")])
    img = sun(img, 420, 360, 36, "#FFF4D2", glow=9, strength=0.6, horizon=520)
    for base, amp, col, hz, fr in [(520, 16, "#4F7E6A", 0.55, 4.0), (560, 22, "#2F5E48", 0.3, 5.5), (600, 26, "#1E4533", 0.1, 7.0)]:
        top = ridge(rng, W, base, amp, octaves=6, rough=0.62, freq=fr)
        top = np.minimum(top, horizon + 4)
        img = layer(img, top, col, haze=hz, haze_color="#D8E6D6")
    img = water(img, horizon, "#56806E", ripple=0.004, rng=rng, darken=0.9)
    from PIL import ImageDraw

    mask = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(mask)
    d.polygon([(880, 760), (1240, 760), (1210, 784), (910, 784)], fill=255)
    d.line([(1010, 760), (1020, 690)], fill=255, width=4)
    d.ellipse([(1003, 676), (1027, 700)], fill=255)
    d.line([(1015, 705), (1070, 650)], fill=255, width=3)
    m = np.asarray(mask.filter(ImageFilter.GaussianBlur(0.8)), dtype=np.float64) / 255
    img = lerp(img, hexrgb("#1A2A24") * np.ones_like(img), m[..., None] * 0.95)
    finish(img, "casamance-bolong", seed=seed, mobile_center=0.62)


def city(seed=4):
    rng = np.random.default_rng(seed)
    img = sky([(0, "#15183A"), (0.4, "#4B2F6B"), (0.66, "#D06A6E"), (0.78, "#F2A873")])
    img = sun(img, 1250, 760, 30, "#FFD1A0", glow=10, strength=0.7, horizon=860)
    base = 860
    from PIL import ImageDraw

    for layer_i, (col, hmax, alpha) in enumerate([("#3A2A56", 330, 0.7), ("#1E1834", 520, 1.0)]):
        mask = Image.new("L", (W, H), 0)
        lights = Image.new("L", (W, H), 0)
        d = ImageDraw.Draw(mask)
        dl = ImageDraw.Draw(lights)
        x = -20
        while x < W:
            bw = int(rng.integers(40, 110))
            bh = int(rng.integers(80, hmax))
            if layer_i == 1 and 700 < x < 800:
                bh, bw = 720, 70
                d.polygon([(x, base - bh), (x + bw // 2, base - bh - 120), (x + bw, base - bh)], fill=255)
            d.rectangle([x, base - bh, x + bw, base], fill=255)
            if layer_i == 1:
                for wy in range(base - bh + 14, base - 10, 16):
                    for wx in range(x + 8, x + bw - 6, 12):
                        if rng.random() < 0.28:
                            dl.rectangle([wx, wy, wx + 4, wy + 6], fill=255)
            x += bw + int(rng.integers(4, 20))
        m = np.asarray(mask, dtype=np.float64) / 255 * alpha
        img = lerp(img, hexrgb(col) * np.ones_like(img), m[..., None])
        if layer_i == 1:
            lm = np.asarray(lights.filter(ImageFilter.GaussianBlur(0.6)), dtype=np.float64) / 255
            img = img + lm[..., None] * hexrgb("#FFC978") * 0.9
    img = water(img, base, "#1C1A36", ripple=0.004, rng=rng, darken=0.7)
    finish(img, "ville-crepuscule", seed=seed, mobile_center=0.48)


def palmeraie(seed=5):
    rng = np.random.default_rng(seed)
    img = sky([(0, "#27305C"), (0.35, "#8C6C8E"), (0.6, "#F0B98C"), (0.72, "#FBE3C2")])
    img = sun(img, 800, 720, 42, "#FFF0D0", glow=8, strength=0.9, horizon=760)
    hz = ridge(rng, W, 760, 4, freq=2)
    img = layer(img, hz, "#B98A8E", haze=0.3, haze_color="#F0B98C")
    from PIL import ImageDraw

    mask = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(mask)
    base = 760
    # Silhouette lointaine générique : coupoles et tours (ville à l'horizon).
    for cx, r in [(560, 60), (700, 40), (980, 70), (1120, 44)]:
        d.rectangle([cx - r, base - r * 0.9, cx + r, base], fill=255)
        d.ellipse([cx - r, base - r * 0.9 - r, cx + r, base - r * 0.9 + r], fill=255)
    for tx, th in [(470, 240), (860, 280), (1240, 250)]:
        d.rectangle([tx - 9, base - th, tx + 9, base], fill=255)
        d.polygon([(tx - 12, base - th), (tx, base - th - 40), (tx + 12, base - th)], fill=255)
    m = np.asarray(mask.filter(ImageFilter.GaussianBlur(1.2)), dtype=np.float64) / 255
    img = lerp(img, lerp(hexrgb("#6E4E68"), hexrgb("#F0B98C"), 0.35) * np.ones_like(img), m[..., None] * 0.9)
    ground = dune_line(rng, 870, 40, 0.6)
    img = layer(img, ground, "#4A3040")
    for x, h, lean, s in [(120, 560, 0.1, 1.2), (260, 470, -0.15, 1.0), (1330, 520, -0.12, 1.15), (1480, 430, 0.1, 0.95)]:
        img = palm(img, x, 900, h, lean, "#1C1420", rng, s)
    finish(img, "palmeraie-aube", seed=seed, mobile_center=0.5)


def island(seed=6):
    rng = np.random.default_rng(seed)
    horizon = 540
    img = sky([(0, "#3F8FC4"), (0.4, "#9CCFE6"), (0.54, "#E6F3F4")])
    ys = np.arange(H)[:, None]
    # Nuages : bruit doux, contraste faible, seulement dans le haut du ciel.
    cl = noise2d(rng, W, H, 160) * 0.6 + noise2d(rng, W, H, 55) * 0.4
    cloud = Image.fromarray((smooth((cl - 0.52) * 4) * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(10))
    cmask = np.asarray(cloud, dtype=np.float64) / 255 * smooth((430 - ys) / 220)
    img = lerp(img, np.ones_like(img) * np.array([0.99, 0.99, 1.0]), cmask[..., None] * 0.75)
    # Île : bande entre sa crête et l'horizon uniquement.
    x = np.arange(W)
    hill = np.clip(np.sin(np.pi * (x - 360) / 980), 0, None) ** 0.8
    top = horizon - 8 - hill * (70 + 12 * np.sin(x * 0.02)) - ridge(rng, W, 0, 6, freq=6)
    island_mask = smooth((ys - top[None, :]) + 0.5) * (ys < horizon + 6) * (hill[None, :] > 0.02)
    green = lerp(hexrgb("#4B7A55"), hexrgb("#7DA36A"), noise2d(rng, W, H, 18)[..., None] * 0.6)
    img = lerp(img, lerp(green, hexrgb("#9CCFE6"), 0.18), island_mask[..., None])
    # Mer turquoise : du bleu profond à l'horizon au lagon clair au premier plan.
    t = np.clip((ys - horizon) / (H - horizon), 0, 1)
    sea = lerp(hexrgb("#1B7F9E"), hexrgb("#43D0C6"), (t ** 0.9)[..., None]) * np.ones((1, W, 1))
    waves = 1 + 0.05 * np.sin(x[None, :] * (0.02 + 0.03 * t) + ys * 0.45) * (0.3 + t)
    sea = sea * waves[..., None]
    img = np.where((ys >= horizon)[..., None], sea, img)
    from PIL import ImageDraw

    colors = ["#E9B44C", "#D9534F", "#F4E6CC", "#C0674A", "#E8D5A8", "#B85C38", "#F0C27B"]
    im = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))
    d = ImageDraw.Draw(im)
    for i in range(34):
        hx = int(rng.integers(560, 1180))
        hy = int(min(horizon + 2, top[hx] + rng.integers(30, 70)))
        hw, hh = int(rng.integers(16, 30)), int(rng.integers(12, 22))
        d.rectangle([hx, hy - hh, hx + hw, hy], fill=colors[i % len(colors)])
        d.polygon([(hx - 2, hy - hh), (hx + hw // 2, hy - hh - 9), (hx + hw + 2, hy - hh)], fill="#9A4330")
    d.rectangle([540, horizon - 3, 1200, horizon + 3], fill="#E7DCC0")
    img = np.asarray(im, dtype=np.float64) / 255
    finish(img, "ile-turquoise", seed=seed, grain=0.012, vignette=0.12, mobile_center=0.52)


def bridge(seed=7):
    rng = np.random.default_rng(seed)
    horizon = 640
    img = sky([(0, "#2A335E"), (0.35, "#B2667A"), (0.58, "#F6A96A"), (0.64, "#FBD49A")])
    town = ridge(rng, W, 620, 6, freq=3)
    img = layer(img, town, "#5B3A4E", haze=0.35, haze_color="#F6A96A")
    img = water(img, horizon, "#3A2E4E", ripple=0.005, rng=rng)
    img = sun(img, 420, 590, 44, "#FFE0A8", glow=7, horizon=612)
    img = shimmer(img, horizon, 420, 44, "#FFCF94", strength=0.45)
    from PIL import ImageDraw

    mask = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(mask)
    deck = 600
    d.rectangle([0, deck, W, deck + 14], fill=255)
    for span in range(5):
        x0 = span * 340 - 40
        x1 = x0 + 340
        d.line([(x0, deck), ((x0 + x1) / 2, deck - 90), (x1, deck)], fill=255, width=6)
        for k in range(1, 8):
            xx = x0 + k * (x1 - x0) / 8
            yy = deck - 90 * (1 - abs((xx - (x0 + x1) / 2) / ((x1 - x0) / 2)))
            d.line([(xx, deck), (xx, yy)], fill=255, width=3)
            d.line([(xx, deck), (xx + (x1 - x0) / 8, yy)], fill=255, width=2)
        d.rectangle([x0 - 8, deck, x0 + 8, horizon + 30], fill=255)
    m = np.asarray(mask.filter(ImageFilter.GaussianBlur(0.7)), dtype=np.float64) / 255
    img = lerp(img, hexrgb("#221726") * np.ones_like(img), m[..., None])
    finish(img, "pont-saint-louis", seed=seed, mobile_center=0.3)


def mountains(seed=8):
    rng = np.random.default_rng(seed)
    img = sky([(0, "#7FA7C9"), (0.45, "#CFE0E6"), (0.6, "#EEF1E6")])
    img = sun(img, 1180, 260, 34, "#FFF8E0", glow=9, strength=0.5)
    for base, amp, col, hz, fr in [(430, 90, "#7F9FB0", 0.6, 1.1), (520, 110, "#5E8494", 0.42, 1.4), (620, 120, "#3D6A63", 0.22, 1.8), (760, 130, "#244C3C", 0.06, 2.4)]:
        top = ridge(rng, W, base, amp, octaves=6, rough=0.52, freq=fr)
        img = layer(img, top, col, haze=hz, haze_color="#DDE8E6")
    ys, xs = np.mgrid[0:H, 0:W]
    fall = np.exp(-((xs - 980) / 16) ** 2) * ((ys > 560) & (ys < 900))
    fall = np.asarray(Image.fromarray((fall * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3)), dtype=np.float64) / 255
    img = lerp(img, np.ones_like(img) * np.array([0.9, 0.95, 0.96]), fall[..., None] * 0.6)
    mist = smooth((ys - 640) / 140) * smooth((980 - ys) / 200) * noise2d(rng, W, H, 120)
    img = lerp(img, np.ones_like(img) * 0.95, mist[..., None] * 0.35)
    finish(img, "fouta-djallon", seed=seed, mobile_center=0.6)


if __name__ == "__main__":
    desert()
    ocean()
    casamance()
    city()
    palmeraie()
    island()
    bridge()
    mountains()
