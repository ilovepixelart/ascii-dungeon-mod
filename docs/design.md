# Design language

The rules every pixel surface follows: the strip, the windows, the map, every sprite and icon. New art and new windows
are held to them; a rule changes here first, then everywhere at once. Code is the source of truth for the values: the
names below point at it.

## The grid

- A terminal cell is one pixel across and two down (`rasterCells`). Text is terminal text in whole cells; pixels are
  half blocks. Anything that carries text lines up with the cell rows; anything that does not is free.
- Every gap is 1 px: between elements, and between an element and the frame. Gaps are never 0 (touching) unless two
  pieces are one shape (belt slots share their frame lines).
- A surface is a whole number of cells: an even number of pixel rows. When the gaps cannot all be 1 px and stay even,
  something changes size by a pixel; a gap never silently takes the slack.

## Shapes

- Slots are 10 by 10: a 1 px frame round an 8 by 8 picture (`SLOT`, `PX`). The portrait, the gear, the portal, the belt
  slots (their count as text on the icon's corner) and the shop's ware tags all use it.
- Pictures in a slot weigh alike: a round or open shape fills its 8 by 8, a dense one (the gear) keeps a pixel of room
  all round, so the gear and the portal look the same size.
- Marks are 5 across: the heart and the star 4 down, the strip's side marks (coin, steps, effects) 5 down.
- Bars are flat, one color, as tall as their mark (4 px), beside it on the same rows; the empty track is the bar's own
  dark (`flatBar`). No gradients on bars.

## Text

- Every word and number in the pane is terminal text, in text boxes over the pixels: sentences in framed boxes
  (`boxShape`), numbers on bars (`barLabel`), buttons' words on their faces (`buttonBox`), labels on art (`artLabel`:
  prices, counts, names, ribbons). Each sits on a whole cell, on the ground the pixels under it are painted. The pixel
  font (3 by 5, `FONT`) is left to the map's floating combat numbers and the saved hero card; `scripts/check-font.mjs`
  fails on any other use.
- Labels of the chrome (titles, tabs, buttons, ribbons) are upper case; sentences are sentence case.
- A count is written in full, its thousands set off by commas (`countText`): gold, kills, calls, everywhere.
- A number on a bar is centred on it, on its middle two rows, each character on the bar's color under it, in the ink
  that reads there (`inkOn`). So a 4 px bar starts on an odd pixel row.
- The pixel font has every character the game asks of it; a missing one is a failing test (`missingGlyphs`).

## Color

- Every color is a palette key (`PAL`, `MARK_INK`) or a named constant; a missing key draws magenta, and magenta on
  any screen is a failing test (`hooks/assets.test.ts`).
- Light comes in 8 steps a tile, colors snapped to the host's 17-step grid (`lightStep`, `lightInt`); a frame stays
  well under the 1024 color pairs the host paints exactly.
- Meaning has one color each: gold `#ffd34d` for gold and keys, green for health and the go-ahead, red for harm and
  closing, blue `c` for magic and the portal, the rarity tiers their own (`RARITY_COLOR`).

## Windows

- One width (`WINDOW_W`), one title bar, a 9 by 9 close box with its X centred, a pixel of room all round.
- A window's parts, top to bottom: title; picture and words; what the window shows (a bar, a stat, wares); its
  actions as buttons that say what they do. A part a window lacks leaves no hole.
- A button says its label, never its key: the composer has the keyboard, and a key reaches the pane only after
  ctrl+x tab (a click on a window does not give it the focus). The keys' row under a window says so first, then lists
  them.
- A choice is a button (`BUTTON_H`, 6 px): its label, framed white when armed or chosen, grey and
  sunken when it cannot act. A choice wider than its words (the deep's marks, the settings, the smith's jobs) is the
  same face, wider (`buttonFace`), its words centred (`wideButtonBox`); buttons stacked in a column share the widest's
  width.
- Popovers (cards, menus, the belt's tiers) stand on what they are about, never over it.

## Sprites

- 8 by 8, outlined in `K` where they stand on the floor, lit from the top left. A big boss alone is 16 by 16
  (`BOSS_ART`), its feet on its tile's bottom edge; the hero beside it is drawn over it.
- A death plays from the sprite itself, no extra art: white, red, then its own end (crumble, burst, topple), held a
  few frames a keyframe (`hooks/fall.ts`).
- Every sprite reads four ways: torchlit, in shadow, as a silhouette (distinct from every other), and sensed out of
  sight (`tools/mock.ts` renders all four).
- A kind keeps its shape across themes; a theme recolors it (`MONSTER_VARIANT`), and a named foe is drawn as its own.
- An item looks like what its name says: one form a kind of consumable (potions, herbs, scrolls, runes, bombs), each
  of its three items drawn for its name.

## Checking

- `uv run --with pillow python tools/shots/shoot.py <out> [name...]` shoots every window as a real Claude Code session
  draws it, not a preview: a renamed copy of the mod (its own save) in a private tmux, each scene of
  `tools/shots/scenes.ts` opened from a save, its keys pressed after ctrl+x tab, the cells captured and painted as
  Ghostty on its defaults shows them, into `<out>/gallery.html` labelled with the commit. Run it from a folder Claude
  Code trusts (`--cwd`); JetBrains Mono is found in the usual font folders or `SHOTS_FONT_DIR`.
- `bun tools/assets.ts <out>` draws every window in every class and rarity and writes them out for review; its test
  fails on magenta or a missing glyph.
- `bun tools/mock.ts <out> [draft]` renders the sprite cast and a scene; visual changes go through it first (see
  `CLAUDE.md`).
