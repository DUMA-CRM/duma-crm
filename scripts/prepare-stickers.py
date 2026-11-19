"""Trim the cat stickers for the web: `pnpm stickers`.

The drawings in public/stickers/*.png are the source art, kept as drawn. Each
is written to public/stickers/web/<name>.png cropped to the drawing, squared,
512px and with the faint specks around it cleared, so it fills its box at
96px. next/image then serves it as AVIF or WebP at the size a page asks for.
Run it again after adding a sticker; then register it in lib/stickers.ts.
"""

from pathlib import Path

from PIL import Image

SOURCE = Path(__file__).resolve().parent.parent / 'public' / 'stickers'
OUT = SOURCE / 'web'
SIZE = 512
# Below this alpha a pixel is generator noise, not drawing.
SPECK = 48
# Breathing room around the drawing, as a share of its longer side.
PAD = 0.04

OUT.mkdir(exist_ok=True)
for path in sorted(SOURCE.glob('*.png')):
    image = Image.open(path).convert('RGBA')
    alpha = image.getchannel('A').point(lambda value: 0 if value < SPECK else value)
    image.putalpha(alpha)
    box = alpha.getbbox()
    if not box:
        continue
    drawing = image.crop(box)
    side = round(max(drawing.size) * (1 + 2 * PAD))
    square = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    square.paste(drawing, ((side - drawing.width) // 2, (side - drawing.height) // 2))
    square.resize((SIZE, SIZE), Image.LANCZOS).save(OUT / path.name, optimize=True)
    print(f'{path.name}: {(OUT / path.name).stat().st_size // 1024} KB')
