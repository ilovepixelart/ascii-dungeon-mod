# ascii-dungeon

A Claude Code mod: a pixel roguelike in a pane, played by your coding session. Each tool call moves the hero, a failure
lets the foe hit back, and real work pays.

![The hero in a room on depth 4, a goblin ahead, the strip with HP, level, belt, gold and depth below](docs/img/dungeon.png)

## What your coding does

| In the session | In the dungeon |
|---|---|
| Every tool call | A step or a blow |
| A failed call | The foe strikes |
| Tests that pass | A sure critical |
| A commit | A shrine and full HP |
| A push or a PR | A cache of loot |
| An answer finished | The stairs down |

The same list is in the game, under How it plays. What stays yours: the gear, the talents, and the standing orders in
settings (when to drink, when to throw smoke, what loot to leave). Through the portal is the town: a merchant, a smith,
a healer, a stash, an elder with quests, a mystic with fortunes, a villager with sealed packs and a guard who trades
three spare pieces for one better.

## Install

```
/plugin install ascii-dungeon --marketplace ilovepixelart/ascii-dungeon-mod
```

That follows `main`. To stay on one release, add the repository at its tag, then install from it:

```
/plugin marketplace add ilovepixelart/ascii-dungeon-mod#ascii-dungeon--v0.4.0
/plugin install ascii-dungeon@ascii-dungeon-mod
```

Run `/reload-plugins` (or start a new session) after installing. Tested on Claude Code 2.1.303. To try it from a clone
without installing: `claude --plugin-dir /path/to/ascii-dungeon-mod`.

## Playing

`/dungeon` opens the pane. The pixel view needs a terminal that draws truecolor half blocks, and the mouse needs the
fullscreen layout (`/tui fullscreen`).

| Pane | Shows |
|---|---|
| 105 columns or wider | the map, the strip and every window in pixels |
| 80 to 104 columns | the map and the strip in pixels, a compact inventory |
| narrower | the game as text |
| 49 rows or taller | every window whole with its keys; a shorter pane scrolls, and says by how much on its top row |

With the mouse: click the map to walk there (a foe, to charge it), and on the strip click the portrait for the
inventory, the HP and XP bars for the character sheet, the gear for settings, the portal to go to town, a belt slot to
drink, and the gold and depth line for the log. Every window lists its keys under it, and `c` closes it.

As text, the keys are `i` inventory, `c` character, `a` attack, `p` potion, `w` explore, `d` descend, `t` portal,
`h` `j` `k` `l` to move, `z` zoom and `r` new game.

<table>
  <tr>
    <td><img src="docs/img/start-knight.png" alt="The start screen: knight, mage and rogue cards"></td>
    <td><img src="docs/img/talent-0.png" alt="The talent window: three talent cards side by side"></td>
  </tr>
  <tr>
    <td><img src="docs/img/deep-brittle-ironclad.png" alt="The deep window: a fork between two marks for the next tier"></td>
    <td><img src="docs/img/talk-mystic.png" alt="The mystic in town with her three fortunes"></td>
  </tr>
</table>

Options in the plugin's config: `sound` (effects) and `music` (the town's tune), both on by default.

## Working on it

| Command | Does |
|---|---|
| `node scripts/gates.mjs --typecheck` | every gate, in its order: release check, colors, font, strict validate, tests, ruff and the unit tests over the Python tools, typecheck (CI runs all but the typecheck, which needs the plugin opened once interactively) |
| `claude plugin test .` | every test |
| `claude plugin validate .` | what the engine would refuse |
| `bun tools/simulate.ts <out> --games 100 --steps 1000` | plays games through the rules, every invariant checked each step, and reports balance |
| `bun tools/feel.ts 100 1000` | danger, pace and variety per class: deaths and close calls per 100 tool calls, quiet stretches, foe kinds |
| `uv run --with pillow python tools/shots/shoot.py <out> [name...]` | every window as a real Claude Code session draws it: a copy of the mod in a private tmux, each scene of `tools/shots/scenes.ts` opened, captured cell for cell and painted as Ghostty shows it, into `<out>/gallery.html` |
| `bun tools/readme.ts` | the README's pictures, into `docs/img/` |
| `python3 tools/sounds.py` | builds the sound clips into `sounds/` and `hooks/clips.ts` |
| `python3 tools/measure.py` | frames as a real terminal receives them, during `/dungeon-bench` |

Rule changes go through the simulator; visual changes through a mockup round first (see `.claude/CLAUDE.md`).

## Docs

`docs/architecture.md` (how the pane plays), `docs/design.md` (the design language every pixel surface follows),
`docs/items.md` (classes, items, foes, loot), `docs/pacing.md` (what keeps a session varied, and the numbers),
`docs/town.md`, `docs/windows.md` (every pixel window), `docs/inventory.md`, `docs/dashboard.md` (the strip). Changes
by version: `CHANGELOG.md`.

## License

MIT, see [LICENSE](LICENSE).
