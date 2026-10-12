# Item pool (design, awaiting approval)

Every item has an icon drawn at its bag footprint (`hooks/icons.ts`); each consumable has a PX by PX belt icon. Every wearable also changes how the hero looks on the map: the hero sprite is stacked from layers per class (`HERO_LAYERS` in `hooks/pixelart.ts`): the plain body, then armor, the head bare or in the class's headgear, the weapon and the off-hand piece, each only while its slot holds something. What is equipped is what is seen.

## Classes

The hero is one of three classes, picked when a game starts: the character sheet offers the choice, a line per class saying its ability, stat lean and starting kit (`classAbout` in `hooks/game.ts`, built from the tables below). The class decides the hero's look, the starting kit, a stat lean and which items it can wear. Rings, amulets and consumables are shared by all.

| Class | Plays as | Stat lean | Starting kit | Wears (class items) |
|---|---|---|---|---|
| Knight | tank: blocks and outlasts | +2 Might, +1 Vigor | Short Sword, Buckler, Tunic, Hood | swords, maces, axes; shields; helms; chain and plate |
| Mage | glass cannon: grows fast | +3 Insight, +1 Focus | Ash Staff, Tome of Sparks, Robe, Pointed Hat | staves, wands; tomes; hats; robes |
| Rogue | crits and escapes | +3 Focus, +1 Might, +1 Vigor | Dagger, Parrying Dagger, Leather Coat, Cowl | daggers, short bows; off-hand daggers; cowls; leather and cloaks |

Each class has one ability, always on, each told by a log line when it acts (`counter`, `strike` and `siphon` in `hooks/game.ts`):

| Class | Ability | Does |
|---|---|---|
| Knight | Shield block | the first blow a foe lands in each fight glances off |
| Rogue | Ambush | the first strike of each fight is a sure critical |
| Mage | Siphon | every kill restores a fifth of max HP, never past max |

The light armour carries a little defense so the classes stand about level: the Robe and the Pointed Hat 1 each, the Cowl 1 (every mage item had none); the rogue leans a point to Vigor besides Focus and Might, without which it died a third more often than the others once foes hit harder. Over 300 simulated games (100 a class, about 320 tool calls each; `tools/feel.ts`), deaths per 100 tool calls: knight 0.77, mage 0.80, rogue 0.70; a close call (under a quarter of max HP, and living) about one in 120; bosses won 67 to 77% of the time.

Items of another class still drop (so loot stays exciting), sell for gold, and show "Knight only" (and so on) in red in the bag; they cannot be equipped.

## Rarity

Five tiers. Each tier owns its color and nothing else in the game uses it (gold is its own yellow, consumables their own red). Each tier also owns a frame shape, so the tier reads without color, and the tier word is written in the tooltip.

| Tier | Color | Frame around the icon | Bonuses | Drop weight at depth 1 |
|---|---|---|---|---|
| Common | white `#e8e8e8` | none | base stats only | 55% |
| Uncommon | green `#3ccf4e` | plain 1px frame | 1 affix | 28% |
| Rare | blue `#3b8eea` | frame with bright corners | 2 affixes | 12% |
| Epic | purple `#a85cf0` | double frame | 3 affixes | 4% |
| Legendary | orange `#ff8a1f` | frame that shimmers | 2 affixes plus one fixed power | 1% |

Each depth moves 1 point of weight from Common toward the higher tiers, down to a floor of 30% (`tierWeights` in `hooks/items/loot.ts`). A kill leaves an item 35% of the time plus 1% a depth, at most 55% (`itemChance`). Legendaries keep their stats' shape but grow with depth like any item. Selling pays 2, 5, 6, 12 and 20 per point of worth by tier. Names: "Prefix Base of Suffix" up to Epic; Legendaries have hand-written names.

## Wearables

Seven slots. Each base has a size in the bag grid (columns x rows) and the classes that can wear it.

| Slot | Base | Class | Stats | Bag size | On the hero |
|---|---|---|---|---|---|
| Weapon | Short Sword | Knight | +2 atk | 1x3 | the current sword |
| Weapon | Mace | Knight | +3 atk | 1x3 | flanged head |
| Weapon | War Axe | Knight | +4 atk | 2x3 | broad axe head |
| Weapon | Ash Staff | Mage | +2 atk, +1 Insight | 1x3 | wooden staff, glowing tip |
| Weapon | Wand | Mage | +1 atk, +10% crit | 1x2 | short rod, spark |
| Weapon | Dagger | Rogue | +1 atk, +5% crit | 1x2 | short blade |
| Weapon | Short Bow | Rogue | +3 atk | 1x3 | bow held up |
| Off-hand | Buckler | Knight | +1 def | 2x2 | small round shield |
| Off-hand | Kite Shield | Knight | +2 def | 2x3 | tall, crest in the rarity color |
| Off-hand | Tome of Sparks | Mage | +2 atk | 2x2 | open book |
| Off-hand | Parrying Dagger | Rogue | +1 def, +5% crit | 1x2 | second blade |
| Helm | Hood | Knight | +3 HP | 2x2 | leather hood |
| Helm | Steel Helm | Knight | +1 def | 2x2 | visor slit |
| Helm | Horned Helm | Knight | +2 def | 2x2 | horns |
| Helm | Pointed Hat | Mage | +1 Insight | 2x2 | tall hat |
| Helm | Cowl | Rogue | +1 Focus | 2x2 | dark hood over the eyes |
| Armor | Tunic | Knight | +4 HP | 2x3 | blue cloth (the current look) |
| Armor | Chain Shirt | Knight | +2 def | 2x3 | grey mail |
| Armor | Plate | Knight | +3 def | 2x3 | bright steel, shoulder plates |
| Armor | Robe | Mage | +5 HP | 2x3 | long robe to the feet |
| Armor | Leather Coat | Rogue | +1 def | 2x3 | brown |
| Armor | Shadow Cloak | Rogue | +1 def, +5% crit | 2x3 | dark cloak |
| Boots | Leather Boots | all | +1 def | 2x2 | brown boots |
| Boots | Iron Greaves | Knight | +2 def | 2x2 | steel boots |
| Boots | Silk Slippers | Mage | +1 Insight | 2x2 | purple slippers |
| Boots | Shadow Treads | Rogue | +5% crit | 2x2 | dark boots |
| Ring | Band, Signet | all | by affixes | 1x1 | not drawn |
| Amulet | Charm, Pendant | all | +2 HP | 1x1 | not drawn |

Base stats scale with depth (+1 per 3 depths on the stat a base gives).

Affixes keep the current names (Sharp, Sturdy, Hearty, Linted, Refactored; of the Bear, of Force, of Warding, of Green Builds, of Fast Feedback).

## Legendaries

Fixed names and stats, each with one effect no affix gives.

| Item | Slot | Stats | Effect |
|---|---|---|---|
| Segfault, the Null Blade | weapon | +8 atk | crits deal triple |
| Rubber Duck of Insight | amulet | +2 atk +2 def +10 HP | +50% XP |
| Mantle of the Monorepo | armor | +6 def +10 HP | failed tool calls heal 1 HP |
| Band of the Endless Loop | ring | +4 atk +4 HP | every 5th turn heals 3 HP |
| Aegis of Green Builds | off-hand (Knight) | +4 def | a passing test run (`Bash` that succeeds) blocks the next hit |
| Staff of Stack Traces | weapon (Mage) | +6 atk | a failed tool call deals its damage to the foe as well |
| Whisper of the Linter | weapon (Rogue) | +5 atk | a crit makes the next hit a crit too |

## Consumables

Used from the belt, never worn. Using one always costs a turn, so each is strong. Vital ones are plentiful so they get used, not hoarded.

Five kinds, each with a fixed belt slot (`KINDS` in `hooks/consumables.ts`, keys 1 to 5), so a pile of one kind never takes another's place. Each kind comes in three tiers, each tier stacking to 9 in its slot (`STACK_MAX`). A slot uses its strongest tier first and is drawn with that tier's icon, a gold pip under the count for each tier above the first, and the slot's total count. What each tier does is its entry in `CONSUMABLES`:

| Slot | I | II | III |
|---|---|---|---|
| 1 health | Health Potion | Greater Health Potion | Elixir |
| 2 regeneration | Regeneration Draught | Strong Draught | Troll Blood |
| 3 fury | Scroll of Fury | Battle Hymn | Berserker's Oath |
| 4 ward | Ward Scroll | Greater Ward | Aegis |
| 5 smoke | Smoke Bomb | Shadow Step (heals too) | Scroll of Passage (reveals the level too) |

Tier I does what each kind did before tiers, so a belt saved before them (version 7, `toVersion7` in `hooks/save.ts`) keeps its strength: the old Greater Health Potion became an Elixir, and the Scroll of Mapping a Scroll of Passage.

## Finding things

- Kills drop equipment with the rarity weights above (the current 40% + 2% per depth chance), scattered onto the tiles around the kill. About 75% of equipment rolls for the hero's class; the rest is sell fodder and the odd surprise.
- Good loot is never long in coming: the 12th kill in a row with nothing Rare or better leaves a Rare at least, whatever it would have left (`RARE_KILLS`, counted in `Game.sinceRare`). Counting items instead barely shortened the long waits: those are stretches of few kills (calms, deaths, town), not of bad rolls. In the simulated games the longest wait for one in a game is 91 tool calls or less nine times in ten, where it was 145.
- A Rare or better from a kill rises as a beam of its tier's color where the foe fell, wider the rarer (Rare 2 px, Epic 4, Legendary 6; `drawBeam` in `hooks/pixels.ts`), for the blow's frames.
- Bad-luck protection: after 10 items in a row without an Epic or better, each more raises the Epic and Legendary weights by a tenth, up to double at 20; the 30th is an Epic or better. One dropping resets the count.
- Health potions keep a steady supply: a kill has a 40% potion chance, 10 points lower after a potion drops, 10 points higher after a kill without one. Otherwise 15% of kills leave one of the other kinds (smoke from depth 3).
- A drop's tier goes by depth (`tierFor`): tier III 1 in 100 at depth 1, 2 more a depth, up to 30; tier II 4 a depth, up to 45; the rest tier I. A floor potion is tier I; the lectern gives a Scroll of Passage.
- With fixed slots no other kind crowds potions off a full belt, which makes the hero last longer; foes hit 1.2 times their plain sum (`FOE_ATK_SCALE`) to match. Over 300 simulated games of 1,000 steps that is 0.62, 0.81 and 0.74 deaths per 100 tool calls (Knight, Mage, Rogue). Making the higher tiers rarer barely moves it.
- Which foe: any kind the depth has unlocked, up to two tiers past it (`foeTierWeights` in `hooks/game.ts`), so from depth 6 every kind can come. The theme's favorites come three times as often (the crypt rats, skeletons and wraiths; the flooded halls kobolds, rats and trolls; the forge goblins, orcs and dragons), the newest three kinds twice. Stats grow with depth whatever the kind (`foeHp`, `foeAtk` in `hooks/balance.ts`), so an old kind deep down is fodder beside a new one, not harmless. Over the simulated games a depth shows 3 kinds of foe, where picking by depth alone gave 1.5 and from depth 8 down nothing but dragons.
- Death: the hero wakes on the first depth of the theme (1, 6, 11 and on) with half the gold and no fortune; the depths above are not walked again. Waking on depth 1 instead had a fifth more of a session spent below depths already reached.
- Theme variants: the flooded halls and the forge draw some monsters their own way and name them so (a bog rat, a cinder goblin, a forge drake; `MONSTER_VARIANT` in `hooks/pixelart.ts`, `VARIANT_NAME` in `hooks/game.ts`): the art with palette keys swapped, the kind's trait unchanged.
- Uniques: each band of five depths has one named monster of its theme on one of its middle depths (`UNIQUES`, `uniqueDepth`): Old Bones (crypt skeleton, pulls itself back together once), Mother Mire (flooded troll, rises whole by a sixth of her HP every third turn), Emberjaw (forge drake, glows one turn and breathes the next). The first foe on its depth, announced, half again its kind's HP and a tenth more attack, a gold crown; slain, it leaves an Epic or better and its band's is done (`Game.uniquesSlain`). At twice the HP and a third more attack deaths rose by half: one that wins is still there when the hero comes back.
- Champions: from depth 2, one foe in ten (`championOf` in `hooks/game.ts`) carries one modifier, named first: Tough (60% more HP), Savage (half again as hard), Shielded (turns the first blow aside), Vampiric (heals by what it deals). Every champion has 1.5 times the HP and 1.25 times the attack of its kind, double XP, three times the gold, and always leaves an item: the better of two rolls, Uncommon at least. On the map its bar ends in a gold pip each side.
- Bosses: every 5th depth (`isBossDepth` in `hooks/game.ts`) the first try to descend raises the stairs' guardian beside the hero instead (`bossOf`): the kind two tiers past the depth, at its strongest roll, 2.5 times the HP, 1.45 times its kind's attack (`BOSS_ATK`), 4 times the XP, its kind's trait at a boss's strength (below), gold pips on its bar like a champion and a gold crown over its head. The stairs stay shut while it lives; a task done in town steps back through the portal to meet it. It leaves five times the gold, an Elixir and the best of three item rolls, Rare at least. `Game.bossSlain` keeps the deepest one slain, so a hero who dies and climbs back down never meets it twice. 
- How each kind fights (`foeTurn` and `heroBlowOn` in `hooks/patterns.ts`), one trait a kind, the heavy blows announced a turn before:

| Kind | Trait |
|---|---|
| Rat | dodges about one blow in five |
| Goblin | its first blow that lands takes 2 gold a depth, given back when it falls |
| Kobold | once, at half HP, drinks back 30% of its max HP instead of striking |
| Orc | at 40% HP or less hits a quarter harder |
| Skeleton | each of the hero's blows does 1 less, never below 1 |
| Troll | knits 2% of its max HP each turn |
| Wraith | every third blow passes through armor; an overlord also fades every fourth turn, the hero's blow passing through |
| Dragon | every third turn: "draws a deep breath" on the second, breathes fire on the third for half again its attack, an overlord two and a half times |

  Over 300 simulated games of 1,000 steps: 2.1 deaths and 13.9 potions a game.
- Drops are announced by toast only when they matter: a Legendary or an Epic by name, a champion's prize; a level-up takes precedence. Lesser drops are left to the bag.
- Chests stand at the dead ends of the side branches (`chestAt` in `hooks/map.ts`), one each, seen from the room the branch leaves; walking onto one opens it (`openChest` in `hooks/game.ts`) and it stays open. Wooden: gold and, 60% of the time, an item. Iron, from depth 2: more gold and an item of Uncommon or better. Gilded, from depth 4 and likelier deeper: the most gold and an item of Rare or better. Auto-explore never passes them: they are the reward for a click.
- The themed room: most levels give one room (`themedRoomOf` in `hooks/map.ts`; at least 5 wide, never the start's or the stairs') a purpose. A shrine: an altar in the middle, a brazier two cells each side; walking onto the altar heals a quarter of the hero's max HP, once. A library: a lectern in the middle, shelves along the top wall; walking onto the lectern gives a Scroll of Passage, once, and leaves it for later when the belt is full. The flooded halls (depths 6 to 10 and every 15 after) may have a spring instead, a third of the time each: a pool in the middle, reeds two cells each side; walking into it restores all HP, once, kept while the hero is unhurt. The forge (depths 11 to 15 and on) may have an old anvil: the town's anvil in the middle, embers two cells each side that light the room like braziers; walking up to it tempers the worn weapon once for nothing, waiting while it cannot take one. An unhurt hero passes the altar by in the same way. The furnishings stay drawn once used.
- Gold lies on floors in three sizes (coin, pile, bar by amount), is picked up by walking over it and never takes bag space.
- Epic and Legendary drops send a short beam of their color up from the tile; a Legendary also gets its own log line. Nothing else ever beams.
- The smith's tempering is the gold sink: each worn item takes up to 3 temperings, each +1 attack (a weapon, or a base made to strike) or +1 defense (the rest), for 60, 240, then 540 gold (`temperCost`). A reforge keeps the temper. Over 300 simulated games it takes about 18 temperings a game, leaves about 680 gold of the 2,800 earned, and cuts potions drunk from about 13 to about 9.
- Junk: any bag item can be marked junk; "sell junk" sells every marked item at once.

## Save format

Items gain new tiers and slots, so the save version goes from 2 to 3. Old items map onto the new tiers: common to Common, enchanted to Uncommon, forged to Rare, legendary to Legendary.

## Art this needs (each through the mock workbench)

1. Layered heroes: three class bodies plus their armors, helms, off-hands and weapons (combined on the fly).
2. Icons: 24 wearable bases, 7 legendaries, 5 consumables, 3 gold sizes.
3. Rarity frames for the bag and the floor glow.
