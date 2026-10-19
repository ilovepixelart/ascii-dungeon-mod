# Changelog

All notable changes to ascii-dungeon are listed here. Versions follow
[Semantic Versioning](https://semver.org/); while the version is 0.x, any
release may change behaviour.

## [Unreleased]

Saves from 0.3.0 standing on a depth that now has a rounded, alcoved or island room (save version 11) start that depth
again from its new start, gains kept. Nothing else needs doing.

### Changed behaviour

- Each tier of a belt slot stacks to 99, where it stacked to 9: a potion, herb, scroll, rune or bomb found with its
  tier at 9 is kept, where it was left on the floor. Simulated deaths are unchanged (1.65 and 1.64 per 1,000 steps).
- A belt slot shows how many it holds of the tier it uses next, where it showed the total of all its tiers; the
  slot's menu still lists each tier.
- A pillar in a room (rock with floor on all four sides, as in a hall's rows of them) is drawn as a stone column
  standing on the floor, where it was drawn as a block of wall: seen alone, a row of them read as a tunnel paved with
  bricks.
- More rooms take a shape: rounded (corners cut), alcoves (notches along the long walls) and an island (bars of rock
  either side of the middle) join the L, the cross and the pillared hall, so about a third of rooms are shaped where
  one in eight was. A rounded room may be the themed one.
- The three chests share one shape, told apart by what they are made of: wooden with a brass knob, iron-bound with
  steel corners, edges and knob, gilded with gold trim and a gem. The gilded one was a gold lump with no lid, the iron
  one stood on feet. Each opened kind is drawn as its own, its knob kept, where every opened chest looked wooden; on
  the text map an opened iron chest is `h` and an opened gilded one `j`.

### Added

- The start screen is titled ASCII DUNGEON and has Help beside Start, framed white on a first game. Under the chosen
  hero it says what each attribute does and, after a retirement, the heirloom and whether the hero wears it.
- How it plays, from Help in settings or on the start screen: what the session's coding does to the hero (tool calls, failed calls, passing
  tests, commits, pushes and pull requests, finished answers), a row each, and what is the player's to choose.
- A session that starts with talents owed or a fork open says so in the log ("9 talents to choose: open the character
  sheet."), so a hero who earned them before they existed, or while no one watched, hears of them.

### Fixed

- A prompt that is only a pasted image no longer becomes a quest quoting the host's stand-in for it ("A new quest:
  "[Image #16]""): attachment placeholders are left out, and a prompt with no words left is no quest. A long prompt is
  cut at a word and ends in "...", where it was cut mid-word.

## [0.3.0] - 2026-10-19

Saves from 0.2.0 load with their belt rearranged (save version 7): nothing is lost, and nothing needs doing. A save
standing on a depth whose layout changed (save version 8), whose theme changed (save version 9) or that is now a big
boss's arena (save version 10, every tenth depth) starts that depth again from its new start, gains kept.

### Changed behaviour

- A unique is named by its own name in the log, toasts and the death window: "Old Bones strikes you", "The Rotking
  loses you", where it read "The Old Bones strikes you" and "The the Rotking loses you".
- The hero drinks a healing potion on their own after a blow that leaves them under a quarter of max HP. Turn it off
  with the Drink order in settings.
- The game is saved after every change, where it was saved only when a turn ended: stats trained, gear changed,
  potions drunk or wares bought by hand between turns survive the session's end.
- Sound settings (effects, music, volume) are kept across sessions and reloads; they went back to the defaults every
  time the mod loaded.
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

- A codex, from Codex on the character sheet: the uniques, big bosses and Legendaries met so far, lit, with what is
  still missing drawn as a dark shape, and records (deepest depth, top level, kills, bosses, deaths, gold found). It
  is kept through a new game. Slaying all five uniques pays an Epic or better, all five big bosses a Legendary, once a
  save. Saves gain the optional `codex`; an older save begins it from its uniques, bosses and Legendaries, with kills
  and gold from 0.
- Retiring, from Retire on the character sheet once a big boss is slain: the hero passes down one piece they wear as
  the heirloom, and every new hero sets out wearing it (in the bag when the class cannot wear it), its name, look and
  Legendary power kept, its stats its base's plain ones. The next retirement replaces it; the codex counts heroes
  retired. New `retire` action; saves gain the optional `heirloom` and `codex.retired`.
- Talents, from Talent on the character sheet: one picked of three at every tenth level, twelve in all. Test Driven,
  Clean Commit, Ship It and Rubber Ducking reward work (fury on passing tests, a ward with a commit's shrine, a push's
  or pull request's item rolled four times, XP from a failed call); Second Wind, Opener, Bloodletting, Grudge,
  Scavenger, Iron Stomach, Haggler and Pathfinder change fights, potions, prices and sight. A hero already past level
  10 has the picks it earned waiting. New `talent` action; saves gain the optional `talents` and `wind`.
- A hero card, from Card in the codex: the hero saved as a picture to `~/Downloads/ascii-dungeon-hero.svg` (the home
  folder without a Downloads folder) and copied as five lines of text, for sharing. Nothing is sent anywhere.
- Class sets: three Epic pieces a class, half a big boss's Epics being one of the hero's class. Two worn add a stat
  (Oathbound +2 def, Archivist's +10% XP, Nightglass +5% crit); three strengthen the class's ability (the knight's
  shield turns the first blow of a fight and halves the second, the mage's siphon restores a quarter of max HP, the
  rogue's first two strikes of a fight are sure criticals). The card shows the set and its bonuses. Saves gain the
  optional `set` on items and `braced` on the foe.
- Triggers on Rares and Epics: every Epic and about a third of Rares carry one of eight rules while worn (Thorns,
  Leeching, Momentum, Bulwark, Executioner, Prospector, and Quick Study and Fresh Start for passing tests and
  commits), shown on the item card. The same trigger on two pieces counts once. Items already in a save carry none
  until the smith reforges them. Saves gain the optional `trigger` on items and `momentum`.
- Tiers past depth 50: ten depths each, ending at a big boss, each with a mark. When a tier's big boss falls, the next
  tier's mark is chosen from Deep on the character sheet, of two offered: an easier (Steady, Mild, Brittle) and a
  harder that pays more (Ironclad, Frenzied, Lean). Unchosen when the hero takes the stairs into the tier, it takes the
  easier. A tier a hero went into before this release is Steady. New `mark` action; saves gain the optional `marks`.
- Hero orders in settings: drink a healing potion under a quarter of max HP (on by default), under half, or never;
  throw a smoke bomb when low with no healing left (off by default); leave a kill's Commons, or anything below Rare, on
  the floor (off by default). New `order` action; saves gain the optional `orders`, older saves taking the defaults.
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
