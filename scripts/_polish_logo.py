"""Final logo polish: remove edge frame lines + bottom-right speck only."""
from PIL import Image
import numpy as np
from pathlib import Path

base = Path(r"c:\Users\mathi\OneDrive\Escritorio\SalgadoAutomotriz\salgado-web\public")
# Start again from clear source
src = base / "logo-salgado-clear.png"
path = base / "logo-salgado-transparent.png"

im = Image.open(src).convert("RGBA")
a = np.array(im).astype(np.float32)
h, w = a.shape[:2]

# Clear thin crop frame on top/left edges
a[: max(3, int(h * 0.02)), :, :] = 0
a[:, : max(3, int(w * 0.015)), :] = 0

alpha = a[:, :, 3]
ys, xs = np.where(alpha > 50)
cx = int(xs.mean())

# Tip of shield
tip_y = int(ys.max())
for y in range(h - 1, -1, -1):
    if (a[y, max(0, cx - 50) : min(w, cx + 50), 3] > 80).sum() >= 2:
        tip_y = y
        break
print("tip", tip_y, "cx", cx)

# Everything below the tip
a[tip_y + 1 :, :, :] = 0

# Tiny BR pocket ONLY in the empty corner (below tip-8, right of 78% width)
# This is where the white streak lives without touching the shield arms
a[tip_y - 8 :, int(w * 0.78) :, :] = 0

# Full canvas bottom-right empty zone (below 92% height, right of 70%)
a[int(h * 0.92) :, int(w * 0.65) :, :] = 0

# Remove isolated speckles globally
alpha2 = a[:, :, 3].copy()
for y in range(1, h - 1):
    xs_row = np.where(alpha2[y] > 15)[0]
    for x in xs_row:
        if x == 0 or x == w - 1:
            a[y, x] = 0
            continue
        neigh = alpha2[y - 1 : y + 2, x - 1 : x + 2]
        if (neigh > 60).sum() <= 2:
            a[y, x] = 0

clean = Image.fromarray(a.astype(np.uint8))
alpha3 = np.array(clean)[:, :, 3]
ys, xs = np.where(alpha3 > 8)
clean = clean.crop(
    (max(0, int(xs.min()) - 1), max(0, int(ys.min()) - 1), min(w, int(xs.max()) + 2), min(h, int(ys.max()) + 2))
)
clean.save(path, optimize=True)
print("saved", clean.size)

bg = Image.new("RGBA", (480, 400), (5, 10, 20, 255))
logo = clean.copy()
logo.thumbnail((340, 320))
bg.paste(logo, ((480 - logo.size[0]) // 2, (400 - logo.size[1]) // 2), logo)
bg.convert("RGB").save(base / "_logo-preview.jpg", quality=92)
print("preview ok")
