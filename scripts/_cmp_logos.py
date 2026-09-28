from PIL import Image
from pathlib import Path

base = Path(r"c:\Users\mathi\OneDrive\Escritorio\SalgadoAutomotriz\salgado-web\public")

for name in ["logo-salgado-clear.png", "logo-salgado.png", "logo-salgado-nav-clear.png"]:
    im = Image.open(base / name).convert("RGBA")
    bg = Image.new("RGBA", (420, 340), (5, 10, 20, 255))
    logo = im.copy()
    logo.thumbnail((320, 300))
    bg.paste(logo, ((420 - logo.size[0]) // 2, (340 - logo.size[1]) // 2), logo)
    out = base / f"_cmp-{name.replace('.png', '')}.jpg"
    bg.convert("RGB").save(out, quality=92)
    print(name, im.size, "->", out.name)
