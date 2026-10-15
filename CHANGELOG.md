# Changelog

All notable changes to ascii-dungeon are listed here. Versions follow
[Semantic Versioning](https://semver.org/); while the version is 0.x, any
release may change behaviour.

## [0.3.0] - Unreleased

Saves from 0.2.0 load with their belt rearranged (save version 7): nothing is lost, and nothing needs doing. A save
standing on a depth whose layout changed (save version 8), whose theme changed (save version 9) or that is now a big
boss's arena (save version 10, every tenth depth) starts that depth again from its new start, gains kept.

### Changed behaviour

- Legendary powers take effect; they were shown on the item card but did nothing. Segfault triples critical damage,
  the Mantle of the Monorepo mends 1 HP after a failed call, the Band of the Endless Loop heals 3 HP every fifth kill
  (was described as every fifth fight), the Aegis of Green Builds wards off the next hit after a passing test run (was
  described as any successful shell command), the Staff of Stack Traces strikes the foe on a failed call, and the
  Whisper of the Linter makes the blow after a critical one critical too. The Rubber Duck's XP already counted.
- Sounds overlap and are never cut: one sound no longer silences another, and a sound that finds the host's four
  places taken waits for the next instead of being lost. The town tune loops without a second's silence between rounds.
- Closing the dungeon pane pauses the game only when no dungeon pane is left open: reopened with /dungeon, it plays on.
- The belt has a slot a kind, 1 to 5: health, regeneration, fury, ward, smoke. Each kind has three tiers, each tier
  stacking to 9, and a slot uses its strongest tier first. Old stacks move to their kind's slot: a Greater Health
  Potion becomes an Elixir, a Scroll of Mapping a Passage Bomb (it now also escapes the foe).
- Merchant wares are a kind at a tier: `{ kind: 'buy', ware: 'health1' }` where it was `ware: 'health'`. The shelf
  sells Health Potion, Greater Health Potion, Elixir, Healing Herb, Scroll of Fury, Ward Rune, Greater Ward Rune,
  Smoke Bomb and Passage Bomb.
- Bosses leave an Elixir; the lectern gives a Scroll of the Berserker.
- Five themes where there were three: depths 11 to 15 are the fungal deep and 16 to 20 the frozen caverns; the forge
  moves to 21 to 25, and the round starts again at 26.
- Every tenth depth's guardian is a big boss (below) in place of an overlord.
- Foes hit 1.2 times their plain sum (was 1.15), keeping deaths where they were now potions are no longer crowded off
  the belt.
- Light is 8 levels a tile with colors on the terminal's own grid: rooms and corridors redraw fewer cells a step.
- The HP and level after the strip's bars are terminal text, so the bars are longer; the camera pages instead of
  moving a tile at a time.

### Added

- A recap of what happened while you worked: after ten or more tool calls with no click or key on the pane, the next
  one opens a window with the calls, depth and level gained, kills, gold, deaths, the work done and the best find
  instead of doing what was asked. It never opens on its own. New `look` action; saves gain the optional `recap`.
- Work is rewarded: tests that pass make the blow a sure critical; a commit kneels the hero at a shrine (full HP, and a
  fall deeper in the theme wakes on that depth); a push leaves an item of Rare or better, a pull request opened or
  merged one of Epic or better. Commits, pushes and pull requests count once a depth each. The `outcome` action takes
  an optional `work`; saves gain the optional `waypoint` and `boons`, and older saves load as they are.
- Settings, from a gear in the strip: New game (moved off the character sheet), the view, sound effects and music each
  on or off, and the volume.
- A right-click on a belt slot opens a menu of the tiers it holds; a click on one uses that tier. `use` takes an
  optional `tier`.
- Level layouts: about half of depths past the first, boss depths aside, are a great hall, a ring round a core
  of rock, cramped warrens or ragged caverns, each theme favoring its own.
- Tiered consumables, each kind one form: potions (Health Potion, Greater Health Potion, Elixir), herbs (Healing
  Herb, Herbal Salve, Troll Moss), scrolls (Scroll of Fury, of Battle, of the Berserker), runes (Ward Rune, Greater
  Ward Rune, Aegis Rune), bombs (Smoke Bomb, Shadow Bomb, Passage Bomb). Belt slots show a gold pip per tier above
  the first.
- Two themes, the fungal deep and the frozen caverns, each with its own monster colors, favored kinds, layouts and a
  unique: the Rotking and Rimehide.
- Big bosses, one a theme, every tenth depth: the Bone King, the Drowned Queen, the Hive Mother, the Frost Lich and
  the Furnace Wyrm. Each is drawn two tiles wide and two tall, waits in an arena, has its own moves and rages once at
  half its HP, and leaves an Epic or better.
- Every class finds three bases of its own in weapon, off-hand, helm and armor: Tower Shield for the knight; Rune
  Scepter, Crystal Orb, Grimoire, Silver Circlet, Sage's Hood, Silk Vestments and Warded Mantle for the mage;
  Rapier, Throwing Knives, Quiver, Thief's Mask, Bandana and Studded Jerkin for the rogue.
- Sound for every event: blocks, misses, a foe's wind-up and its healing, a big boss's rage and its death, stolen
  gold, each consumable picked up by its form (potions, herbs, scrolls, runes, bombs), gear picked up, selling, gear
  taken off, the stash, destroying, marking, training, every heal, the dog, the mystic, a new quest, a depth's twist,
  walls, and anything refused. A foe's death and the chest have new sounds.
- An action's sounds play in the order they happen, mixed into one clip on their frames: the blow, the foe's answer,
  what a kill leaves, then the fanfare. A walk is one clip: its footsteps and its pickups on their frames.
- Deaths on the map: a slain foe crumbles to dust, a big boss cracks with gold light and bursts, and the hero topples
  away from their killer as the map darkens. Then a death window: the killer's portrait, where, the toll (level,
  deaths, gold lost) and the depth woken on, with Wake (`w`).
- Frame stamps on the bench walk, and `tools/measure.py` reporting skipped, repeated and late frames and jitter.

## [0.2.0] - 2026-10-12

Saves from 0.1.0 load as they were: every new field of the game starts at its default.

### Changed behaviour

- `r` on the text dashboard, and the character sheet's New game, open the start screen instead of starting over at
  once; the sheet's three class buttons are gone. A first game opens on the start screen, the dungeon waiting behind it.
- Harder: deaths about 1 per 130 tool calls (were 1 per 550), bosses won about 7 times in 10 (were 9 in 10). Foes hit
  1.15 times their plain sum, bosses 1.45 times their kind.
- Dying wakes the hero on the first depth of the theme (1, 6, 11 and on), not depth 1.
- In a room the hero's light stands at the room's middle and holds still; in corridors it moves with the hero.

### Added

- Pixel windows for every menu: merchant, smith, stash, the townsfolk, the character sheet, the start screen, and a
  compact inventory for panes 80 to 104 columns wide.
- Townsfolk lines chosen from how the hero stands; the dog can be petted; the elder's Claim.
- Pacing: tension that builds to an announced champion, then a short calm.
- Depth twists: Gloom, Horde, Champions' den, Barren, Bloodlust, Hoard. A vault room in every theme.
- Foes from every kind a depth has unlocked, the theme's favorites more often, and theme variants (bog rat, cinder
  goblin, forge drake and more).
- Named uniques, one a band of five depths: Old Bones, Mother Mire, Emberjaw.
- A nemesis: the champion that slays the hero comes back for them deeper, stronger for each win.
- Good loot within 12 kills, and a beam of light where a Rare or better drops.
- Undo sale at the merchant, Keep old at the smith, locks on items.
- Sounds for good loot, a nemesis, a peak and the calm.

### Fixed

- Two doors no longer stand side by side where rooms two cells apart meet.
- A belt slot answers clicks over all it draws.
- A foe placed with nowhere open in sight no longer takes the hero's HP as its own.
- The healer's restored HP no longer breaks a rule check when max HP falls after the visit.
- Frames the same as the one the terminal already shows are not sent again.
