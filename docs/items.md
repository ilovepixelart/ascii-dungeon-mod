# Item pool (design, awaiting approval)

Every item has an icon drawn at its bag footprint (`hooks/icons.ts`); each consumable has a PX by PX belt icon. Every wearable also changes how the hero looks on the map: the hero sprite is stacked from layers per class (`HERO_LAYERS` in `hooks/pixelart.ts`): the plain body, then armor, the head bare or in the class's headgear, the weapon and the off-hand piece, each only while its slot holds something. What is equipped is what is seen.

## Classes

The hero is one of three classes, picked when a game starts: the character sheet offers the choice, a line per class saying its ability, stat lean and starting kit (`classAbout` in `hooks/game.ts`, built from the tables below). The class decides the hero's look, the starting kit, a stat lean and which items it can wear. Rings, amulets and consumables are shared by all.

| Class | Plays as | Stat lean | Starting kit | Wears (class items) |
|---|---|---|---|---|
| Knight | tank: blocks and outlasts, keeping half its defense against a blow through armor | +2 Might, +1 Vigor | Short Sword, Buckler, Tunic, Hood | swords, maces, axes; bucklers, kite and tower shields; hoods and helms; tunics, chain and plate |
| Mage | glass cannon: grows fast | +3 Insight, +1 Focus | Ash Staff, Tome of Sparks, Robe, Pointed Hat | staves, wands, scepters; tomes, orbs, grimoires; hats, circlets, hoods; robes, vestments, mantles |
| Rogue | crits and escapes | +3 Focus, +1 Might, +1 Vigor | Dagger, Parrying Dagger, Leather Coat, Cowl | daggers, short bows, rapiers; off-hand daggers, throwing knives, quivers; cowls, masks, bandanas; leather, cloaks and jerkins |

Each class has one ability, always on, each told by a log line when it acts (`counter`, `strike` and `siphon` in `hooks/game.ts`):

| Class | Ability | Does |
|---|---|---|
| Knight | Shield block | the first blow a foe lands in each fight glances off |
| Rogue | Ambush | the first strike of each fight is a sure critical |
| Mage | Siphon | every kill restores a fifth of max HP, never past max |

The light armour carries a little defense so the classes stand about level: the Robe and the Pointed Hat 1 each, the Cowl 1 (every mage item had none); the rogue leans a point to Vigor besides Focus and Might, without which it died a third more often than the others once foes hit harder. Over 300 simulated games (100 a class, about 320 tool calls each; `tools/feel.ts`), deaths per 100 tool calls: knight 0.40, mage 0.61, rogue 0.50; a close call (under a quarter of max HP, and living) one in 400 to 700; bosses won 52 to 54% of the time.

Items of another class still drop (so loot stays exciting), sell for gold, and show "Knight only" (and so on) in red in the bag; they cannot be equipped.

## Rarity

Five tiers. Each tier owns its color and nothing else in the game uses it (gold is its own yellow, consumables their own red). Each tier also owns a frame shape, so the tier reads without color, and the tier word is written in the tooltip.

| Tier | Color | Frame around the icon | Bonuses | Drop weight at depth 1 |
|---|---|---|---|---|
| Common | white `#e8e8e8` | none | base stats only | 55% |
| Uncommon | green `#3ccf4e` | plain 1px frame | 1 affix | 28% |
| Rare | blue `#3b8eea` | frame with bright corners | 2 affixes | 12% |
| Epic | purple `#a85cf0` | double frame | 3 affixes | 4% |
| Legendary | orange `#ff8a1f` | frame that shimmers | fixed stats and one fixed power, no affixes | 1% |

Each depth moves 1 point of weight from Common toward the higher tiers, down to a floor of 30% (`tierWeights` in `hooks/items/loot.ts`). A kill leaves an item 35% of the time plus 1% a depth, at most 55% (`itemChance`). Legendaries keep their stats' shape but grow with depth like any item. Selling pays 2, 5, 6, 12 and 20 per point of worth by tier. Names: "Prefix Base of Suffix" up to Epic; Legendaries have hand-written names.

## Wearables

Seven slots. Each base has a size in the bag grid (columns x rows) and the classes that can wear it. Each class has three bases of its own in weapon, off-hand, helm and armor and one pair of boots, so its pool (with the shared boots, rings and amulets) is 17 bases, the same for all three: drops come three in four from the hero's own pool, so equal pools give each class the same mix of slots. With the pools even, deaths per 100 tool calls over 200 simulated games a class (`tools/feel.ts`) were knight 0.63, mage 0.71, rogue 0.72, where they had been 0.58, 0.78 and 0.74.

| Slot | Base | Class | Stats | Bag size | On the hero |
|---|---|---|---|---|---|
| Weapon | Short Sword | Knight | +2 atk | 1x3 | the current sword |
| Weapon | Mace | Knight | +3 atk | 1x3 | flanged head |
| Weapon | War Axe | Knight | +4 atk | 2x3 | broad axe head |
| Weapon | Ash Staff | Mage | +2 atk, +10% XP | 1x3 | wooden staff, glowing tip |
| Weapon | Wand | Mage | +1 atk, +10% crit | 1x2 | short rod, spark |
| Weapon | Rune Scepter | Mage | +3 atk | 1x3 | gold rod, violet gem |
| Weapon | Dagger | Rogue | +1 atk, +5% crit | 1x2 | short blade |
| Weapon | Short Bow | Rogue | +3 atk | 1x3 | bow held up |
| Weapon | Rapier | Rogue | +2 atk, +5% crit | 1x3 | thin blade, basket hilt |
| Off-hand | Buckler | Knight | +1 def | 2x2 | small round shield |
| Off-hand | Kite Shield | Knight | +2 def | 2x3 | tall, crest in the rarity color |
| Off-hand | Tower Shield | Knight | +3 def | 2x3 | steel slab, red field, gold cross |
| Off-hand | Tome of Sparks | Mage | +2 atk | 2x2 | open book |
| Off-hand | Crystal Orb | Mage | +10% crit | 2x2 | glass orb on a stand |
| Off-hand | Grimoire | Mage | +15% XP | 2x2 | dark book, gold eye |
| Off-hand | Parrying Dagger | Rogue | +1 def, +5% crit | 1x2 | second blade |
| Off-hand | Throwing Knives | Rogue | +2 atk | 1x2 | a pair of knives |
| Off-hand | Quiver | Rogue | +10% crit | 1x3 | leather quiver |
| Helm | Hood | Knight | +3 HP | 2x2 | leather hood |
| Helm | Steel Helm | Knight | +1 def | 2x2 | visor slit |
| Helm | Horned Helm | Knight | +2 def | 2x2 | horns |
| Helm | Pointed Hat | Mage | +10% XP, +1 def | 2x2 | tall hat |
| Helm | Silver Circlet | Mage | +1 atk, +1 def | 2x2 | silver band, gem |
| Helm | Sage's Hood | Mage | +4 HP | 2x2 | violet hood, gold trim |
| Helm | Cowl | Rogue | +5% crit, +1 def | 2x2 | dark hood over the eyes |
| Helm | Thief's Mask | Rogue | +5% crit, +5% XP | 2x2 | domino mask |
| Helm | Bandana | Rogue | +4 HP | 2x2 | red wrap |
| Armor | Tunic | Knight | +4 HP | 2x3 | blue cloth (the current look) |
| Armor | Chain Shirt | Knight | +2 def | 2x3 | grey mail |
| Armor | Plate | Knight | +3 def | 2x3 | bright steel, shoulder plates |
| Armor | Robe | Mage | +5 HP, +1 def | 2x3 | long robe to the feet |
| Armor | Silk Vestments | Mage | +10% XP, +3 HP | 2x3 | cream and gold robe |
| Armor | Warded Mantle | Mage | +2 def, +2 HP | 2x3 | hooded blue mantle |
| Armor | Leather Coat | Rogue | +1 def | 2x3 | brown |
| Armor | Shadow Cloak | Rogue | +1 def, +5% crit | 2x3 | dark cloak |
| Armor | Studded Jerkin | Rogue | +2 def, +2 HP | 2x3 | studded leather |
| Boots | Leather Boots | all | +1 def | 2x2 | brown boots |
| Boots | Iron Greaves | Knight | +2 def | 2x2 | steel boots |
| Boots | Silk Slippers | Mage | +10% XP | 2x2 | purple slippers |
| Boots | Shadow Treads | Rogue | +5% crit | 2x2 | dark boots |
| Ring | Band, Signet | all | by affixes | 1x1 | not drawn |
| Amulet | Charm, Pendant | all | +2 HP | 1x1 | not drawn |

Base stats scale with depth (+1 per 3 depths on the stat a base gives).

Affixes keep the current names (Sharp, Sturdy, Hearty, Linted, Refactored; of the Bear, of Force, of Warding, of Green Builds, of Fast Feedback).

## Legendaries

Fixed names and stats, each with one effect no affix gives (`wornPower` in `hooks/items/equipment.ts`, read by the rules in `hooks/game.ts`).

| Item | Slot | Stats | Effect |
|---|---|---|---|
| Segfault, the Null Blade | weapon | +8 atk | crits deal triple |
| Rubber Duck of Insight | amulet | +2 atk +2 def +10 HP | +50% XP |
| Mantle of the Monorepo | armor | +6 def +10 HP | failed tool calls heal 1 HP |
| Band of the Endless Loop | ring | +4 atk +4 HP | every fifth kill heals 3 HP |
| Aegis of Green Builds | off-hand (Knight) | +4 def | a passing test run wards off the next hit |
| Staff of Stack Traces | weapon (Mage) | +6 atk | a failed tool call strikes the foe first; a foe it slays hits no more |
| Whisper of the Linter | weapon (Rogue) | +5 atk | a crit makes the next hit a crit too; that one chains no further |

## Triggers

A Rare or Epic may carry a trigger, a rule it changes while worn (`TRIGGERS` in `hooks/items/catalog.ts`, `wornTrigger` in `hooks/items/equipment.ts`, read by the rules in `hooks/game.ts`). Every Epic carries one and about a third of Rares (`RARE_TRIGGER_SHARE`); Commons, Uncommons and Legendaries none. The same trigger on two worn pieces counts once, and the card says so of a piece whose trigger another worn slot already has.

| Trigger | Effect | Read in |
|---|---|---|
| Thorns | a foe whose blow lands takes a tenth of it back, rounded up, never the last of its HP | `thorns` |
| Leeching | a kill heals 1 HP | `slay` |
| Momentum | after a kill, the next blow deals a quarter more (`Game.momentum`) | `slay`, `strike` |
| Bulwark | the first blow that lands each fight is halved, rounded up (`Foe.landed`); a knight's shield turns the first before it | `counter` |
| Executioner | a blow on a foe under a quarter HP deals half again | `triggerTimes` |
| Prospector | kills pay a fifth more gold | `killPay` |
| Quick Study | a passing test run gives 1 XP a depth | `greenBuild` |
| Fresh Start | a commit's shrine also gives 1 blow of fury | `shrine` |

- A new item's trigger is drawn from its id and the world (`hash`), not the game's dice, so every roll after it falls as it did before triggers existed. A reforge rolls it anew with the dice; an heirloom keeps it. A trigger adds 3 to an item's worth when sold.
- The card shows its name in the item's tier color and what it does wrapped under it (`triggerLines` in `hooks/bagui.ts`); as text, on one line.
- Balance: each trigger forced on from the first step (60 simulated games a class, 3,000 steps), deaths a depth reached are 0.125 with none, 0.110 Thorns, 0.117 Bulwark and Quick Study, 0.119 Executioner and Fresh Start, 0.125 Leeching, 0.127 Momentum, 0.130 Prospector; rolled as they drop, 0.120.

## Class sets

Each class has a set of three Epic pieces (`SETS` in `hooks/items/catalog.ts`), each with its own name, its affixes' stats rolled as any Epic's, and no trigger: the set is its power. Two worn add a stat (in `gearBonus`); three strengthen the class's ability (`isSetWhole` in `hooks/items/equipment.ts`).

| Set | Class | Pieces | Two worn | Three worn |
|---|---|---|---|---|
| Oathbound | Knight | Blade (sword), Plate, Helm (horned helm) | +2 def | the shield turns the first blow of a fight and halves the second |
| Archivist's | Mage | Scepter, Vestments, Circlet | +10% XP | siphon restores a quarter of max HP, not a fifth |
| Nightglass | Rogue | Rapier, Cloak, Cowl | +5% crit | Ambush makes the first two strikes of a fight sure criticals |

- A whole set's two openings: the first marks the foe `braced`, the second `opened` (`openingPlayed`, `foeBlow` in `hooks/game.ts`). Simulated with each whole set from the first step (60 games a class, 3,000 steps), deaths a depth reached go from 0.118 to 0.095 for the knight, 0.117 to 0.102 for the mage, 0.125 to 0.106 for the rogue; with the shield turning the first two blows the knight's fell to 0.085. Unforced 8,000-step games (20 a class): 2.24 deaths per 1,000 steps before sets, 2.29 with.
- Half a big boss's Epics are a piece of the hero's class's set (`SET_SHARE`, drawn from the depth and the world, so the dice fall as before), one the hero has nowhere first (`setPiece` in `hooks/items/loot.ts`). A reforge rolls its stats and keeps its name and set; an heirloom keeps its set.
- The card shows the set in its own color (`SET_COLOR`, teal, no tier's), how many pieces are worn, and each bonus, in the set's color once reached and dim until then (`setLines` in `hooks/bagui.ts`).

## Consumables

Used from the belt, never worn. Using one always costs a turn, so each is strong. Vital ones are plentiful so they get used, not hoarded.

Five kinds, each with a fixed belt slot (`KINDS` in `hooks/consumables.ts`, keys 1 to 5), so a pile of one kind never takes another's place. Each kind comes in three tiers, each tier stacking to 99 in its slot (`STACK_MAX`). A slot uses the tier chosen for it (`choose`, from its popover on the strip, kept in `BeltSlot.chosen` while the slot holds one of that tier), else its strongest, and is drawn with that tier's icon (`activeTier`), a gold pip under the count for each tier above the first, and the count of that tier (at most 99, so two digits; the slot's menu lists each tier's count). What each tier does is its entry in `CONSUMABLES`:

| Slot | Form | I | II | III |
|---|---|---|---|---|
| 1 health | potions | Health Potion | Greater Health Potion | Elixir |
| 2 regeneration | herbs | Healing Herb | Herbal Salve | Troll Moss |
| 3 fury | scrolls | Scroll of Fury | Scroll of Battle | Scroll of the Berserker |
| 4 ward | runes | Ward Rune | Greater Ward Rune | Aegis Rune |
| 5 smoke | bombs | Smoke Bomb | Shadow Bomb (heals too) | Passage Bomb (reveals the level too) |

Each kind is one form, its own icon, so no form is split across two slots: every potion is in slot 1, every scroll in slot 3.

Tier I does what each kind did before tiers, so a belt saved before them (version 7, `toVersion7` in `hooks/save.ts`) keeps its strength: the old Greater Health Potion became an Elixir, and the Scroll of Mapping a Passage Bomb.

## Finding things

- Kills drop equipment with the rarity weights above (35% and 1 more a depth, at most 55%: `itemChance` in `hooks/game.ts`) into the bag. About 75% of equipment rolls for the hero's class; the rest is sell fodder and the odd surprise.
- With the bag full, a find lies where it fell (`Game.floor`, `leaveOnFloor`): a kill's on the foe's tile, a chest's on the chest's, drawn as a sack on the pixel map and `*` in its tier's color on the text one; the pointer over it names it there, in its tier's color (`onMapHover` in `register.tsx`, written by `clicks.ts`); several on one tile are named a row each, each in its tier's color, what beats what is worn first with a green arrow, then the rarest, stacked over the tile (under it with no room above); past five, four a page and a row saying which (`< 1-4 of 13 >`) that a click turns (`lyingLabel` in `panels.ts`, `mapLabelAt` in `pixels.ts`); the row the pointer is on shows its item's card beside the names, as the bag's compares it (`mapBlocks` in `register.tsx`); the text map's `*` takes the rarest one's color. Each cell of the label is written on the map under it, darkened (`labelGrounds` in `pixels.ts`). The pointer moved from the tile onto its label keeps the label there (`pinned` in `register.tsx`), the row under it lit; a click on a row picks that item (`pick` in `game.ts`): it goes first of what lies there and the hero walks onto the tile, so with room for one, it is the one taken. Stepping onto it with room picks it up (`pickUpFloor`, every item on the tile, in the floor's order); it waits through a trip to town, and going down leaves it behind, said. Slain, the hero keeps it when waking on the same depth; waking on another, it is lost, said. A prize is never left lying while there is room in the stash in town (`keepPrize`): a trophy, a unique's or a boss's item, the codex's, and work's cache; earned in town with the bag and the stash full, it waits by the portal on the depth below.
- Good loot is never long in coming: the 12th kill in a row with nothing Rare or better leaves a Rare at least, whatever it would have left (`RARE_KILLS`, counted in `Game.sinceRare`). Counting items instead barely shortened the long waits: those are stretches of few kills (calms, deaths, town), not of bad rolls. In the simulated games the longest wait for one in a game is 91 tool calls or less nine times in ten, where it was 145.
- A Rare or better from a kill rises as a beam of its tier's color where the foe fell, wider the rarer (Rare 2 px, Epic 4, Legendary 6; `drawBeam` in `hooks/pixels.ts`), for the blow's frames.
- Bad-luck protection: after 10 items in a row without an Epic or better, each more raises the Epic and Legendary weights by a tenth, up to double at 20; the 30th is an Epic or better. One dropping resets the count.
- Health potions keep a steady supply: a kill's potion chance (`potionChance`) starts at 40%, 10 points lower after a potion drops, 10 points higher after a kill without one, and a kill takes a quarter of it (`HEALING_DROP_SHARE` in `hooks/balance.ts`, which says how it was judged). Otherwise 15% of kills leave one of the other kinds (smoke from depth 3).
- Each theme has a thing to gather (`GATHERABLE` in `hooks/map.ts`), lying in rooms by a wall, about one a level: the crypt's warding stone and the frozen caverns' rime crystal give a ward rune, the flooded halls' reeds and the fungal deep's glowing caps herbs, the forge's powder keg a smoke bomb. Stepped onto, it goes onto the belt at a tier for the depth (`tierAt`, drawn from the world and the cell); with that tier full it stays where it lies until there is room.
- A drop's tier goes by depth (`tierFor`, rolling `tierAt`): tier III 1 in 100 at depth 1, 2 more a depth, up to 30; tier II 4 a depth, up to 45; the rest tier I. A floor potion is tier I; the lectern gives a Scroll of the Berserker.
- With fixed slots no other kind crowds potions off a full belt, which makes the hero last longer; foes hit 1.2 times their plain sum (`FOE_ATK_SCALE`) to match. Over 300 simulated games of 1,000 steps that is 0.62, 0.81 and 0.74 deaths per 100 tool calls (Knight, Mage, Rogue). Making the higher tiers rarer barely moves it.
- Which foe: any kind the depth has unlocked, up to two tiers past it (`foeTierWeights` in `hooks/game.ts`), so from depth 6 every kind can come. The theme's favorites come three times as often (the crypt rats, skeletons and wraiths; the flooded halls kobolds, rats and trolls; the forge goblins, orcs and dragons), the newest three kinds twice. Stats grow with depth whatever the kind (`foeHp`, `foeAtk` in `hooks/balance.ts`), so an old kind deep down is fodder beside a new one, not harmless. Over the simulated games a depth shows 3 kinds of foe, where picking by depth alone gave 1.5 and from depth 8 down nothing but dragons.
- Death: the hero wakes on the first depth of the theme (1, 6, 11 and on), or on the depth a commit marked in it (`Game.waypoint`, `pacing.md`), with half the gold earned since the hero was last in town gone, rounded up (`Game.banked`: in town all the gold carried is banked, and in the dungeon a spend lowers it), and no fortune; the depths above are not walked again. Waking on depth 1 instead had a fifth more of a session spent below depths already reached.
- Theme variants: the flooded halls and the forge draw some monsters their own way and name them so (a bog rat, a cinder goblin, a forge drake; `MONSTER_VARIANT` in `hooks/pixelart.ts`, `VARIANT_NAME` in `hooks/game.ts`): the art with palette keys swapped, the kind's trait unchanged.
- Uniques: each band of five depths has one named monster of its theme on one of its middle depths (`UNIQUES`, `uniqueDepth`): Old Bones (crypt skeleton, pulls itself back together once), Mother Mire (flooded troll, rises whole by a sixth of her HP every third turn), the Rotking (fungal kobold, his spores slip past armor every other turn), Rimehide (frozen orc, gathers frost one turn and strikes double the next), Emberjaw (forge drake, glows one turn and breathes the next). Each is drawn as its own (`UNIQUE_ART`), its silhouette its own. The first foe on its depth, announced, half again its kind's HP and a tenth more attack, a gold crown; slain, it leaves an Epic or better and its band's is done (`Game.uniquesSlain`). At twice the HP and a third more attack deaths rose by half: one that wins is still there when the hero comes back.
- Champions: from depth 2, one foe in ten (`championOf` in `hooks/game.ts`) carries one modifier, named first: Tough (60% more HP), Savage (half again as hard), Shielded (turns the first blow aside), Vampiric (heals by what it deals, up to half of what it took since its last blow, so a fight against one always ends). Every champion has 1.5 times the HP and 1.25 times the attack of its kind, double XP, three times the gold, and always leaves an item: the better of two rolls, Uncommon at least. On the map its bar ends in a gold pip each side.
- Bosses: every 5th depth (`isBossDepth` in `hooks/game.ts`) the first try to descend raises the stairs' guardian beside the hero instead (`bossOf`): the kind two tiers past the depth, at its strongest roll, 2.5 times the HP, 1.45 times its kind's attack (`BOSS_ATK`), 4 times the XP, its kind's trait at a boss's strength (below), gold pips on its bar like a champion and a gold crown over its head. The stairs stay shut while it lives; a task done in town steps back through the portal to meet it. It leaves five times the gold, a Greater Health Potion (a big boss an Elixir) and the best of three item rolls, Rare at least. `Game.bossSlain` keeps the deepest one slain, so a hero who dies and climbs back down never meets it twice. 
- Big bosses: every tenth depth (`isBigBossDepth`, `BIG_EVERY` in `hooks/map.ts`) the guardian is the theme's big boss (`BIG_BOSSES`, `bigBossOf`), drawn `&` on the text map and as a 16 by 16 sprite on the pixel map (`BOSS_ART`), standing on its tile with half a tile out each side and a tile up, a bar as wide over its head. The stairs room is grown to an arena of at least 14 by 8 (`arenaOf`), except on the few levels (about 1 in 200) where that would take in the start. Against the top kind at its strongest roll it has 4.5 times the HP (`BIG_HP`), 1.5 times the attack (`BIG_ATK`) and 8 times the XP; slain, it leaves what a guardian does with Epic at least. At half its HP it rages once (`phase: 2`), a turn spent roaring with no blow, and its moves (`MOVES` in `hooks/patterns.ts`) harden:

| Boss | Moves | Raging |
|---|---|---|
| Bone King (crypt) | raises his greatsword, brings it down double the next turn | bones shield him as he raises it |
| Drowned Queen (flooded) | the tide mends a tenth of her HP every third turn | drags the hero under, past armor, every other turn |
| Hive Mother (fungal) | spores slip past armor every other turn | the swarm bites half again as hard |
| Frost Lich (frozen) | the air freezes, then a frost nova double | ice armor every fourth turn |
| Furnace Wyrm (forge) | draws a breath, then fire at two and a half times its attack, every third turn | every other turn |

  Over 90 simulated games of 3,000 steps (`tools/simulate.ts`, `bigMet`, `bigSlain`, `bigDeaths`) a big boss slew the hero 0.35 times a meeting, against 0.25 for an overlord, with deaths per 1,000 steps and the deepest depth reached level with overlords in their place.
- How each kind fights (`foeTurn` and `heroBlowOn` in `hooks/patterns.ts`), one trait a kind, the heavy blows announced a turn before. A heavy blow (a breath, a nova, a greatsword, a rage: any blow its turn makes harder) takes at most `HEAVY_BLOW_MAX` (60%) of max HP, before Bulwark and the knight's shield halve it; the turn before, the log says about what it will take (`warnHeavy`). A foe's threat (`threat`) counts its plain blows through armor to max HP (3 or fewer deadly, 6 or fewer tough) and is deadly too when a heavy blow within 4 turns could take the hero's HP now:

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
- Chests stand at the dead ends of the side branches (`chestAt` in `hooks/map.ts`), one each, seen from the room the branch leaves; walking onto one opens it (`openChest` in `hooks/game.ts`) and it stays open. Wooden: gold and, 60% of the time, an item. Iron, from depth 2: more gold and an item of Uncommon or better. Gilded, from depth 4 and likelier deeper: the most gold and an item of Rare or better. Auto-explore never passes them: they are the reward for a click. All three are drawn on one chest shape and told apart by make (brass knob on wood, steel on iron, gold trim and a gem on gilt), each opened kind with its own sprite and knob (`C`/`c`, `H`/`h`, `G`/`j`, `OPENED_GLYPH` in `hooks/map.ts`); the pixel-art test lets only the chests share a silhouette.
- The themed room: most levels give one room (`themedRoomOf` in `hooks/map.ts`; at least 5 wide, never the start's or the stairs') a purpose. A shrine: an altar in the middle, a brazier two cells each side; walking onto the altar heals a quarter of the hero's max HP, once. A library: a lectern in the middle, shelves along the top wall; walking onto the lectern gives a Scroll of the Berserker, once, and leaves it for later when the belt is full. The flooded halls (depths 6 to 10 and every 15 after) may have a spring instead, a third of the time each: a pool in the middle, reeds two cells each side; walking into it restores all HP, once, kept while the hero is unhurt. The forge (depths 11 to 15 and on) may have an old anvil: the town's anvil in the middle, embers two cells each side that light the room like braziers; walking up to it tempers the worn weapon once for nothing, waiting while it cannot take one. An unhurt hero passes the altar by in the same way. The furnishings stay drawn once used.
- Gold lies on floors in three sizes (coin, pile, bar by amount), is picked up by walking over it and never takes bag space.
- Epic and Legendary drops send a short beam of their color up from the tile; a Legendary also gets its own log line. Nothing else ever beams.
- The smith's tempering is a gold sink, with the gamble's sealed packs, the mystic's fortunes, reforging, the stash's tabs and a death's half of the gold carried past the bank: each worn item takes up to 3 temperings, each +1 attack (a weapon, or a base made to strike) or +1 defense (the rest), for 60, 240, then 540 gold, each times one more for every ten depths the hero has reached (`temperCost`). A reforge keeps the temper. Over 300 simulated games of 1,000 steps it takes about 14 temperings a game, the hero ending with about 910 gold and having drunk about 8 potions.
- Junk: any bag item can be marked junk; "sell junk" sells every marked item at once.

## Save format

Items gain new tiers and slots, so the save version goes from 2 to 3. Old items map onto the new tiers: common to Common, enchanted to Uncommon, forged to Rare, legendary to Legendary.

## Art this needs (each through the mock workbench)

1. Layered heroes: three class bodies plus their armors, helms, off-hands and weapons (combined on the fly).
2. Icons: 24 wearable bases, 7 legendaries, 5 consumables, 3 gold sizes.
3. Rarity frames for the bag and the floor glow.
