"""Cells painted to a PNG as a Ghostty on its defaults shows them: JetBrains Mono, its background and its block
elements drawn as exact rectangles. Needs Pillow (`uv run --with pillow`)."""

import glob
import os

from PIL import Image, ImageDraw, ImageFont

CW, CH = 10, 22
SIZE = 16.6
BG = (0x28, 0x2C, 0x34)
FG = (0xFF, 0xFF, 0xFF)
FONT_DIRS = [
    os.environ.get("SHOTS_FONT_DIR", ""),
    "~/Library/Fonts",
    "/Library/Fonts",
    "~/.local/share/fonts",
    "/usr/share/fonts",
]

# Block elements as Ghostty draws them: exact rectangles, no font, no seams. Quadrant bits: 1 upper left, 2 upper
# right, 4 lower left, 8 lower right.
HALVES = {
    "▀": (0, 0, 1, 0.5),
    "▄": (0, 0.5, 1, 1),
    "█": (0, 0, 1, 1),
    "▌": (0, 0, 0.5, 1),
    "▐": (0.5, 0, 1, 1),
}
QUADS = {
    "▘": 1,
    "▝": 2,
    "▖": 4,
    "▗": 8,
    "▚": 9,
    "▞": 6,
    "▛": 7,
    "▜": 11,
    "▙": 13,
    "▟": 14,
}


def font_file(style):
    """JetBrains Mono in `style` (Regular, Bold) from the first font folder holding it; SHOTS_FONT_DIR goes first."""
    for folder in filter(None, FONT_DIRS):
        found = sorted(
            glob.glob(
                os.path.join(
                    os.path.expanduser(folder), "**", f"JetBrainsMono*-{style}.ttf"
                ),
                recursive=True,
            )
        )
        if found:
            return found[0]
    raise SystemExit(
        f"JetBrains Mono {style} not found; set SHOTS_FONT_DIR to the folder holding it"
    )


def inks(st):
    fg = st["fg"] or FG
    bg = st["bg"] or BG
    if st["inverse"]:
        fg, bg = bg, fg
    if st["dim"]:
        fg = tuple((a + b) // 2 for a, b in zip(fg, bg, strict=True))
    return fg, bg


def paint_cell(d, fonts, x, y, cell):
    ch, st, width = cell
    fg, bg = inks(st)
    w = CW * width
    d.rectangle([x, y, x + w - 1, y + CH - 1], fill=bg)
    if ch in HALVES:
        a, b, c, e = HALVES[ch]
        d.rectangle(
            [
                x + round(a * CW),
                y + round(b * CH),
                x + round(c * CW) - 1,
                y + round(e * CH) - 1,
            ],
            fill=fg,
        )
    elif ch in QUADS:
        for k, (qa, qb) in enumerate([(0, 0), (1, 0), (0, 1), (1, 1)]):
            if QUADS[ch] & (1 << k):
                d.rectangle(
                    [
                        x + qa * CW // 2,
                        y + qb * CH // 2,
                        x + (qa + 1) * CW // 2 - 1,
                        y + (qb + 1) * CH // 2 - 1,
                    ],
                    fill=fg,
                )
    elif ch.strip():
        d.text((x, y + 2), ch, font=fonts[st["bold"]], fill=fg)
    if st["under"]:
        d.line([x, y + CH - 3, x + w - 1, y + CH - 3], fill=fg)


def render(rows):
    """The cells' rows as an image, CW by CH pixels a cell."""
    fonts = {
        False: ImageFont.truetype(font_file("Regular"), SIZE),
        True: ImageFont.truetype(font_file("Bold"), SIZE),
    }
    width = max((len(r) for r in rows), default=1)
    img = Image.new("RGB", (width * CW, len(rows) * CH), BG)
    d = ImageDraw.Draw(img)
    for r, cells in enumerate(rows):
        for c, cell in enumerate(cells):
            if cell[2]:
                paint_cell(d, fonts, c * CW, r * CH, cell)
    return img
