# ascii-dungeon

A Claude Code mod: the session's coding activity drives a pixel roguelike drawn in a pane. Each tool call moves the
hero: a read explores, an edit or a shell command meets a foe, a failure lets it hit back, a turn's end takes the stairs.
Click the map to walk, open the inventory from the hero's portrait, and visit the town through the portal: a merchant,
a smith, a healer, a stash, an elder with quests, a mystic with fortunes.

## Running it

It loads from this folder as a Claude Code mod; `/dungeon` opens the pane. The pixel view needs a terminal that draws
truecolor half blocks; playing by mouse needs the fullscreen layout (`/tui fullscreen`). A pane at least 105 columns
wide shows every pixel window, 80 the strip and a compact inventory; narrower, the game draws as text.

Options in the plugin's config: `sound` (effects) and `music` (the town's tune), both on by default.

## Working on it

| Command | Does |
|---|---|
| `claude plugin test .` | every test |
| `claude plugin validate .` | what the engine would refuse |
| `bun tools/simulate.ts <out> --games 100 --steps 1000` | plays games through the rules, every invariant checked each step, and reports balance |
| `bun tools/feel.ts 100 1000` | danger, pace and variety per class: deaths and close calls per 100 tool calls, quiet stretches, foe kinds |
| `python3 tools/sounds.py` | builds the sound clips into `sounds/` and `hooks/clips.ts` |
| `python3 tools/measure.py` | frames as a real terminal receives them, during `/dungeon-bench` |

Rule changes go through the simulator; visual changes through a mockup round first (see `CLAUDE.md`).

## Docs

`docs/architecture.md` (how the pane plays), `docs/items.md` (classes, items, foes, loot), `docs/pacing.md` (what
keeps a session varied, and the numbers), `docs/town.md`, `docs/windows.md` (every pixel window), `docs/inventory.md`,
`docs/dashboard.md` (the strip). Changes by version: `CHANGELOG.md`.
