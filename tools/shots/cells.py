"""A tmux capture (capture-pane -e) read into cells: each its character, its colours and attributes, and its width;
and the dungeon pane cut out of the whole screen. Pure; picture.py paints the cells."""

import re
import unicodedata

# Ghostty's default palette, for the 16 named colours.
ANSI16 = [
    (0x28, 0x2C, 0x34),
    (0xE0, 0x6C, 0x75),
    (0x98, 0xC3, 0x79),
    (0xE5, 0xC0, 0x7B),
    (0x61, 0xAF, 0xEF),
    (0xC6, 0x78, 0xDD),
    (0x56, 0xB6, 0xC2),
    (0xDC, 0xDF, 0xE4),
    (0x5C, 0x63, 0x70),
    (0xE0, 0x6C, 0x75),
    (0x98, 0xC3, 0x79),
    (0xE5, 0xC0, 0x7B),
    (0x61, 0xAF, 0xEF),
    (0xC6, 0x78, 0xDD),
    (0x56, 0xB6, 0xC2),
    (0xFF, 0xFF, 0xFF),
]

SGR = re.compile(r"\x1b\[([0-9;:]*)m")
OTHER = re.compile(r"\x1b(\[[0-9;?]*[A-Za-z]|\][^\x07]*\x07|[()][0-9A-Za-z])")
PLAIN = {
    "fg": None,
    "bg": None,
    "bold": False,
    "dim": False,
    "inverse": False,
    "under": False,
}
# Switched on by one code, off by another.
ON = {1: ("bold", True), 2: ("dim", True), 4: ("under", True), 7: ("inverse", True)}
OFF = {24: ("under", False), 27: ("inverse", False), 39: ("fg", None), 49: ("bg", None)}


def xterm256(n):
    """The colour of xterm's 256-colour code n."""
    if n < 16:
        return ANSI16[n]
    if n < 232:
        n -= 16
        steps = [0, 95, 135, 175, 215, 255]
        return (steps[n // 36], steps[n // 6 % 6], steps[n % 6])
    v = 8 + (n - 232) * 10
    return (v, v, v)


def named(p):
    """A 16-colour code's key and colour, or None."""
    for low, key, base in ((30, "fg", 0), (90, "fg", 8), (40, "bg", 0), (100, "bg", 8)):
        if low <= p <= low + 7:
            return key, ANSI16[base + p - low]
    return None


def apply_sgr(st, params):
    """The state st after the SGR codes in params (`1;38;2;255;0;0`)."""
    ps = [int(p) if p else 0 for p in re.split("[;:]", params)] if params else [0]
    i = 0
    while i < len(ps):
        p = ps[i]
        if p == 0:
            st.update(PLAIN)
        elif p == 22:
            st.update(bold=False, dim=False)
        elif p in ON or p in OFF:
            key, value = ON.get(p) or OFF[p]
            st[key] = value
        elif p in (38, 48):
            key = "fg" if p == 38 else "bg"
            truecolor = ps[i + 1] == 2
            st[key] = tuple(ps[i + 2 : i + 5]) if truecolor else xterm256(ps[i + 2])
            i += 4 if truecolor else 2
        elif named(p) is not None:
            key, colour = named(p)
            st[key] = colour
        i += 1


def parse(text):
    """Rows of cells (character, state, width): a wide character takes two cells, the second of width 0."""
    rows = []
    for line in text.split("\n"):
        st = dict(PLAIN)
        cells = []
        pos = 0
        while pos < len(line):
            m = SGR.match(line, pos) or OTHER.match(line, pos)
            if m:
                if m.re is SGR:
                    apply_sgr(st, m.group(1))
                pos = m.end()
                continue
            ch = line[pos]
            pos += 1
            if unicodedata.combining(ch) or ch in "️‍":
                continue
            wide = unicodedata.east_asian_width(ch) in "WF"
            cells.append((ch, dict(st), 2 if wide else 1))
            if wide:
                cells.append(("", dict(st), 0))
        rows.append(cells)
    while rows and not rows[-1]:
        rows.pop()
    return rows


def blank(cells):
    return all(ch == " " and st["bg"] is None for ch, st, _ in cells)


def crop_pane(rows):
    """The dungeon pane: right of the column divider in the first rows, above the prompt's rule, blank rows trimmed."""
    divider = next(
        (i for cells in rows[:6] for i, (ch, _, _) in enumerate(cells) if ch == "│"),
        None,
    )
    rule = next(
        (
            r
            for r, cells in enumerate(rows)
            if sum(ch == "─" for ch, _, _ in cells) > 40
        ),
        len(rows),
    )
    out = [
        cells[divider + 1 :] if divider is not None else cells for cells in rows[:rule]
    ]
    while out and blank(out[-1]):
        out.pop()
    while out and blank(out[0]):
        out.pop(0)
    return out
