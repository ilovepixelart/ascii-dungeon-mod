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
  slots (15 wide for their count) and the shop's ware tags all use it.
- Pictures in a slot weigh alike: a round or open shape fills its 8 by 8, a dense one (the gear) keeps a pixel of room
  all round, so the gear and the portal look the same size.
- Marks are 5 across: the heart and the star 4 down, the strip's side marks (coin, steps, effects) 5 down.
- Bars are flat, one color, as tall as their mark (4 px), beside it on the same rows; the empty track is the bar's own
  dark (`flatBar`). No gradients on bars.

## Text

- Words and numbers a person reads are terminal text, in text boxes over the pixels (`boxShape`, `barLabel`): the
  terminal's own font, readable at any size. Titles, tabs and buttons are terminal text too; the pixel font (3 by 5,
  `FONT`) is left to labels on art and the counts on slots.
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
  actions as buttons with their key in gold. A part a window lacks leaves no hole.
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

- `bun tools/assets.ts <out>` draws every window in every class and rarity and writes them out for review; its test
  fails on magenta or a missing glyph.
- `bun tools/mock.ts <out> [draft]` renders the sprite cast and a scene; visual changes go through it first (see
  `CLAUDE.md`).
