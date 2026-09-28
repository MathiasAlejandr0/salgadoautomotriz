"""Clean white smudge from Salgado logo; keep shield + internal text intact."""
from PIL import Image
import numpy as np
from pathlib import Path

base = Path(r"c:\Users\mathi\OneDrive\Escritorio\SalgadoAutomotriz\salgado-web\public")
src = base / "logo-salgado-clear.png"
out = base / "logo-salgado-transparent.png"

im = Image.open(src).convert("RGBA")
a = np.array(im).astype(np.float32)
h, w = a.shape[:2]
alpha = a[:, :, 3]
lum = a[:, :, :3].mean(axis=2)

# Main content bbox (solid logo)
ys, xs = np.where(alpha > 40)
r0, r1 = int(ys.min()), int(ys.max())
c0, c1 = int(xs.min()), int(xs.max())
print("content bbox", c0, r0, c1, r1, "canvas", w, h)

# Smudge is typically OUTSIDE content, bottom-right of canvas
# Clear everything outside padded content box
pad = 2
keep = np.zeros((h, w), dtype=bool)
keep[max(0, r0 - pad) : min(h, r1 + pad + 1), max(0, c0 - pad) : min(w, c1 + pad + 1)] = True
outside = ~keep & (alpha > 0)
print("outside pixels", int(outside.sum()))
a[outside] = 0

# Also clear soft haze inside canvas but detached: bottom strip below tip
# tip = lowest solid row near horizontal center of content
cx = (c0 + c1) // 2
tip_y = r1
for y in range(r1, r0, -1):
    if (alpha[y, max(c0, cx - 40) : min(c1, cx + 40)] > 80).sum() >= 2:
        tip_y = y
        break
print("tip_y", tip_y)

# Clear any pixels below tip
a[tip_y + 1 :, :, :] = 0

# Clear soft bright blobs near bottom-right of content box (protruding smudge)
# Region: right of content mid, below 70% of content height
y_lo = r0 + int((r1 - r0) * 0.70)
x_lo = c0 + int((c1 - c0) * 0.72)
region = np.zeros((h, w), dtype=bool)
region[y_lo : tip_y + 1, x_lo:c1 + 1] = True

# In that region, remove low-alpha soft whites OR thin horizontal streaks
soft = region & (alpha > 0) & (
    ((lum > 100) & (alpha < 200)) | ((alpha > 0) & (alpha < 60))
)
print("soft in BR content", int(soft.sum()))
a[soft] = 0

# Row-wise: in BR, if a row has isolated pixels far from the main right edge of upper rows
for y in range(y_lo, tip_y + 1):
    xs_row = np.where(a[y, :, 3] > 30)[0]
    if len(xs_row) == 0:
        continue
    # expected right bound from content above
    above = a[max(r0, y - 15) : y, :, 3] > 80
    if above.any():
        exp_right = int(np.where(above.any(axis=0))[0].max())
    else:
        exp_right = cx
    for x in xs_row:
        if x > exp_right + 12:
            a[y, x] = 0

clean = Image.fromarray(a.astype(np.uint8))
alpha2 = np.array(clean)[:, :, 3]
ys, xs = np.where(alpha2 > 8)
clean = clean.crop(
    (max(0, xs.min() - 2), max(0, ys.min() - 2), min(w, xs.max() + 3), min(h, ys.max() + 3))
)
clean.save(out, optimize=True)
print("saved", out, clean.size)

# preview
bg = Image.new("RGBA", (480, 400), (5, 10, 20, 255))
logo = clean.copy()
logo.thumbnail((340, 320))
bg.paste(logo, ((480 - logo.size[0]) // 2, (400 - logo.size[1]) // 2), logo)
bg.convert("RGB").save(base / "_logo-preview.jpg", quality=92)
print("preview ok")
