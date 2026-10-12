# Changelog

## 0.3.0

Saves from 0.2.0 load with their belt rearranged (save version 7): nothing is lost, and nothing needs doing. A save
standing on a depth whose layout changed (save version 8) starts that depth again from its new start, gains kept.

### Changed behaviour

- The belt has a slot a kind, 1 to 5: health, regeneration, fury, ward, smoke. Each kind has three tiers, each tier
  stacking to 9, and a slot uses its strongest tier first. Old stacks move to their kind's slot: a Greater Health
  Potion becomes an Elixir, a Scroll of Mapping a Scroll of Passage (it now also escapes the foe).
- Merchant wares are a kind at a tier: `{ kind: 'buy', ware: 'health1' }` where it was `ware: 'health'`. The shelf
  sells Health Potion, Elixir, Regeneration Draught, Scroll of Fury, Ward Scroll, Smoke Bomb and Scroll of Passage.
- Bosses leave an Elixir; the lectern gives a Scroll of Passage.
- Foes hit 1.2 times their plain sum (was 1.15), keeping deaths where they were now potions are no longer crowded off
  the belt.
- Light is 8 levels a tile with colors on the terminal's own grid: rooms and corridors redraw fewer cells a step.

### Added

- Level layouts: about half of depths past the first, boss depths aside, are a great hall, a ring round a core
  of rock, cramped warrens or ragged caverns, each theme favoring its own.
- Tiered consumables: Greater Health Potion, Strong Draught, Troll Blood, Battle Hymn, Berserker's Oath, Greater Ward,
  Aegis, Shadow Step. Belt slots show a gold pip per tier above the first.
- Frame stamps on the bench walk, and `tools/measure.py` reporting skipped, repeated and late frames and jitter.

## 0.2.0

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
