# Pixel windows

Every pixel menu is one window: the same width (`WINDOW_W`, so one pane width shows them all, or none), the same title bar and the same text boxes over it. Every pixel menu is built on it: the inventory (and its compact form), the town's windows, the character sheet and the start screen. A pane narrower than `WINDOW_W` shows each as text instead. The pane's top row says what its size is short of (`hooks/panesize.ts`): on the map, how wide it needs to be (`widthNote` in `register.tsx`), else that it is under the size the game plays best in (`BEST_COLUMNS` by `BEST_ROWS`, the tallest window whole, pinned by a test over every window drawn); on a window it cannot show whole, the rows that window needs (`fitNote`, counting the `UNDER_WINDOW` rows beneath it). The map gives the note its row.

| Module | Holds |
|---|---|
| `hooks/window.ts` | the frame (title, gold when the window passes it, close box, section labels, the body below `BODY_TOP`); text boxes (`boxShape`, `drawBox`); where they go (`coverage`, `place`); gestures (`Gesture`, `pixel`, `CLICK_SLOP`) |
| `hooks/pieces.ts` | what windows are built from: an item in its tier box with its marks (`drawItem`), an item grid (`itemGrid`, `cellBox`), the belt |
| `hooks/ui/tokens.ts`, `hooks/ui/kit.ts` | the interface kit: each color named once by its role, the spacing, the card families; flat and beveled cards with their ribbon, gem and sparkles. `tools/ui.ts` draws them all on one sheet |
| `hooks/windowclient.ts` | the click layer: writes the text boxes it is handed and reports whole gestures |
| `hooks/inventory.ts`, `hooks/bagui.ts` | the inventory (see `inventory.md`) |
| `hooks/shop.ts` | the merchant |
| `hooks/talk.ts` | the healer, elder, mystic, guard, villager and dog |
| `hooks/forge.ts` | the smith |
| `hooks/chest.ts` | the stash |
| `hooks/start.ts` | the start screen |
| `hooks/sheet.ts` | the character sheet |
| `hooks/settings.ts` | settings: New game, the view, effects, music and the volume |
| `hooks/death.ts` | the death window |
| `hooks/compact.ts` | the inventory for a pane 80 to 104 columns wide |

## The merchant

- The wares on a shelf on the left, three to a row, each price under its icon; a price that cannot be paid is grey. The bag and the belt sit where the inventory has them.
- A click chooses a ware or a bag item and shows its card; a second click (or a right-click) opens its menu. A ware's menu is Buy, and stays open after a buy so each further one is a click; a bag item's is Sell and Equip. What cannot be done says why in the menu (`whyNot`: not enough gold, no room on the belt; the class that can wear it) and does nothing.
- Choosing a ware lets go of the chosen bag item, and the other way round: one card at a time.
- Every action has a key under the window; Sell junk shows how many items are marked and what they come to before it is pressed.
- Cards go where they hide the least of what the window shows (`cardWithMenu`) and never on what they are about.

## Gotchas

- Every bar is flat, one color, 2 px tall on a whole cell's top (`flatBar` in `hooks/pieces.ts`), its numbers text centred on it (`barLabel`): each character on the bar's color under it, in the ink that reads there (`inkOn`). The strip's HP and XP, the sheet's XP, the healer's HP and the elder's quest. The foe's bar on the map is 1 px and too short for a number.
- Text goes in text boxes, not pixels: the pixel font is 5 px tall, fine for titles, labels and numbers, not for sentences. The window draws a box's frame and fill in pixels; the click layer writes its text on the same fill.
- The pixel font has no full stop or comma (`drawable` in `hooks/window.ts` drops them from a card's text), nor a colon or an apostrophe: text drawn in a window is written without them, which the assets test holds every window in `hooks/screens.ts` to.
- A text box is placed in cells (one pixel across, two down), so its frame lands on even pixel rows.
- `place` scores a spot by what it hides (`coverage`, weights the window chooses) a thousand times over its distance from what the box is about: hiding less always wins over being nearer.

## The townsfolk

- A portrait (the sprite at three times its size), what they say in a text box beside it, under that what they show (the healer the hero's HP, the elder the quest's progress, the dog how often it has been petted) and at most one button: the mystic's Fortune, the elder's Claim, the dog's Pet. The mystic's window lists the three fortunes under it, the one in force framed white.
- What they say is chosen from how the hero stands, first match wins (`WORDS` in `talk.ts`), so it changes with the game rather than repeating one line.
- A button that cannot act now is drawn grey and does nothing; a price that cannot be paid is grey. The elder's Claim is lit white once the quest is done.
- The pixel font has capitals, digits and `+ - ! /` only: the fortunes' rows say what they do in those (`+1/2 GOLD`); the exact words are in the text box.

## The smith

- The worn slots on the left, as in the inventory; the piece being worked on framed white just outside its frame, where its tier frame cannot cover it. It is the first worn until another is clicked (`chosenSlot`).
- On the right its card, ending in what each job costs or why it cannot be done (`whyNotTemper`, `whyNotReforge`); a pip a tempering, and the stat now and after one more (`DEF 4 > 5`, or `MAX`); then the Temper and Reforge buttons, grey when they cannot act.
- The buttons carry no price: a reforge's runs to three digits, too wide for the work side with the key and label. The prices are in the card.

## The stash

- The chest on the left as a list, a row a stored item in its tier's color (the chosen one marked `>`), its count in the label; the bag on the right.
- A row or a bag item is chosen with a click and shows its card; a second click (or a right-click) opens Take or Store, which says why when the chest is full or the bag has no room (`whyNotStore`, `whyNotTake`).
- The chest is a list, not a grid: its ten items keep no places, and a grid with room for ten of the largest would not fit beside the bag.

## The start screen

- The `start` panel: a first game opens on it (`openingGame` in `hooks/save.ts`), and New game in settings (or `r` on the text dashboard) opens it. While it is open the dungeon waits: `apply` lets through only a new game, closing it and the view key, so tool calls change nothing.
- The title, ASCII DUNGEON, then a card a hero: its portrait in its starting kit, its name, a pip a point of each attribute it starts with. The chosen card is framed white; the box under the cards holds its ability, lean and kit, what each attribute does (`STATS_LINE`), and after a retirement the heirloom and whether the chosen class wears it or carries it in the bag.
- A card chooses its hero; the chosen card clicked again, or Start (`s`), begins a new game as it. Help (`h`) opens the how-it-plays window over the screen, framed white on a first game (`isFirstGame`: none under way and no codex yet). Back (`b`) and the close box leave the game as it was; Back shows only with a game under way (`isUnderWay`), since a first game has nothing to go back to. The buttons sit in one centered row. Keys `1` to `3` choose.

## The character sheet

- The hero's portrait in what they wear; who they are, their HP, attack, defense and crit, and the points to spend; the XP bar; a row an attribute with its value, a `+` (lit while there are points) and what it does; Codex (`x`) under the rows opens the codex, Retire (`r`) beside it the retire window, lit once the hero has slain a big boss (`canRetire`), and Talent (`t`) under them the talent window, framed white while a talent is owed, Deep (`d`) beside it the deep window, framed white while a fork waits. New game is in settings.

## Settings

- Opened from the gear in the strip, or Settings on the text dashboard. New game opens the start screen; Help beside it the how-it-plays window; View steps the view; Effects and Music each turn on or off; Volume steps a quarter at a time, from full round to a quarter, for every clip and the tune (`SoundSettings`, `nextSound`). Music turned on or off, or a new volume, restarts the tune at its level. The sound settings are kept across sessions; the `sound` and `music` options give them until the player sets them.
- Hero orders, under a rule below the sound (`Game.orders`, kept with the game; `obey` and `ORDER_STEPS` in `hooks/game.ts`), each stepped by its button. Drink: a healing potion after a blow that leaves the hero under a quarter of max HP (the default), under half, or never. Smoke: never (the default), or when low, a smoke bomb under a quarter of max HP with no healing potion left and a foe near. Leave: take every item (the default), leave Commons, or leave anything below Rare; a kill's item below it stays on the floor, said. The orders' hotkeys (d, f, k) work only in the pixel window: on the text dashboard d descends and k moves up.
- What the drink order is for: the hero plays mostly while no one watches. Over 60 simulated games a class with a player who never drinks by hand, deaths per 1,000 steps are 4.73 with it off and 2.57 at a quarter; a player who drinks at 40% by hand sees no change (2.24 to 2.26).

## How it plays

- What the session's coding does to the hero, a row a rule with the strip's own icon (`HELP_ROWS` in `hooks/helpwindow.ts`): every tool call a step or a blow, a failed call the foe's strike, passing tests a sure critical, a commit a shrine and full HP, a push or a pull request a cache, a finished answer the stairs; the work it rewards in green. Under a rule, what is the player's: gear, talents, orders.
- Opened by Help (`h`) beside New game in settings, and How it plays on the text dashboard's settings. It is the pane's own state (`isHelpOpen` in `register.tsx`), not a game panel, so it opens over whatever is open and closes back to it; first in the window lists, it draws over every other. As text, a line a rule and where the bag, the sheet and settings are.

## The death window

- Opened by the rules on every death (`die` sets `Game.fallen` and the `death` panel), but drawn only once the hero's fall has played on the map (`isFalling` in `register.tsx`); without the pixel map it shows at once. The killer's portrait as it stood (a big boss its 16 by 16 at its own size, `killerArt`), who and on which depth, the level, the deaths and the gold lost, the depth woken on, and Wake (`w`), which closes it like the close box.
- A unique's name carries its own article ("the Rotking"), so the window names the killer from the kept foe (`killerName`), not from `Fallen.by`, the log's wording.

## The recap

- What the tool calls came to since the player last clicked or pressed a key (`Game.recap`, counted by `noted` in `hooks/recap.ts` in `apply`, for tool-driven actions only). The next click or key is a look (`isRecapShown` in `register.tsx`): after `RECAP_CALLS` calls or more it opens the `recap` panel instead of doing what was asked; after fewer, what was counted is forgotten. It never opens on its own, and never over the death window.
- Drawn by `hooks/recapwindow.ts`: the hero's portrait, tool calls, depth and level from and to, kills, gold gained, champions and deaths, the work done (green test runs, commits, pushes, pull requests), and the best find of Rare or better with its name wrapped to even lines. A section with nothing to say is left out. Play on (`p`) and the close box close it; closing it, or any window opened over it, forgets what it told.

## The codex

- What every hero of the save has done (`Game.codex`, kept through a new game by `apply`'s `restart`): the uniques and big bosses slain and the Legendaries come to hand, and the records: deepest depth, top level, kills, bosses slain, deaths and gold found in the dungeon. `recorded` in `hooks/codex.ts` adds what each action did, compared before and after, so no rule has to report to it. A Legendary counts once it is in the bag, the stash or worn; one left on the floor of a full bag is not found.
- A save from before the codex begins one at its first action (`firstCodex` in `hooks/game.ts`): uniques from `uniquesSlain`, every big boss up to `bossSlain` (each guards the way down), the Legendaries owned, the deepest depth, level and deaths. Kills and gold were never counted, so they start at 0. `Codex.retired` counts the heroes retired; a codex from before retiring has none.
- A set made whole pays once a save, the moment it is (`paySets`): all five uniques an Epic or better, all five big bosses a Legendary. A save whose set was whole when the codex began is not paid for it. Over 30 simulated games a class at 8,000 steps the prizes take deaths per 1,000 steps from 2.72 to 2.27 and the deepest depth from 74 to 79; a run that rolls the prizes and withholds them stays at 2.74. Below depth 25 nothing changes.
- Drawn by `hooks/codexwindow.ts`: a row each with its count, an entry lit once slain or found and a dark shape until then, a Legendary found in its tier's box as in the bag; the records under a rule, four lines of them ending the window on the map's height, with Card (`k`) beside the last. The close box and Close (`c`) close it. As text, each row names what is in it.

## The hero card

- Card (`k`) in the codex, as a button on the text dashboard too, saves the hero as a picture and copies them as text, for the player to share where they like; nothing leaves the machine on its own. `hooks/herocard.ts` draws it (`cardPixels`): the portrait in what they wear, level and class, the deepest depth and its tier, kills and deaths, heroes retired (none, left out), the worn pieces in their tier boxes, the codex's counts, gold found and the talents; `cardText` writes the same in five lines.
- A plugin writes text, not bytes (`$.fs.write`), so the picture is an SVG (`svgOf`): a rectangle a run of one color along a row, drawn at four times. `saveCard` in `register.tsx` writes `ascii-dungeon-hero.svg` to `~/Downloads` (`$.env.get('HOME')`, `$.fs.exists`), or the home folder without one, copies the text (`$.ui.copy`) and toasts what came of each, a refusal of either said.

## Retiring and the heirloom

- A hero who has slain a big boss may retire (`retire` action, `whyNotRetire` in `hooks/game.ts`), passing down one piece they wear as the save's heirloom (`Game.heirloom`, `heirloomOf` in `hooks/items/loot.ts`). The game becomes a new one on the start screen with the codex (one more retired) and the heirloom; no Back, as nothing is under way.
- Every new hero after that, by the start screen or New game, sets out with the heirloom (`newHero`): worn when the class can wear it, its kit piece going to the bag, at full HP; in the bag when it cannot. The next retirement replaces it.
- An heirloom keeps its name, tier, look, Legendary power and trigger; its stats are its base's plain ones, untempered, unlocked, not junk. The Rubber Duck's power is its +50% XP, so that stat stays. With the stats as found on depth 1, simulated deaths in the first 1,000 steps (60 games a class) fell from 2.26 to 0.50 with the Duck; as built they are 1.92 with the Duck, 2.17 with the Band of the Endless Loop and 2.06 with a Rare chain.
- Drawn by `hooks/retirewindow.ts`: the portrait, level, class, deepest depth and big bosses slain; the worn pieces in a row, the chosen one framed white (the first worn until one is clicked; `w` steps through them); its name and what passing it down means; Retire (`r`, dark until a big boss is slain) and Back (`b`, to the sheet). As text, a button a worn piece retires passing it down.

## Talents

- A talent is earned at every tenth level (`owed` in `hooks/talents.ts`), and picked from three offered (`offer`): none already taken, the three fixed by the world and the picks so far, so reopening shows the same cards. The `talent` action takes one on offer; reaching a tenth level says one is waiting, and so does every session's start while any are owed, with an open fork too (`greet` in `hooks/game.ts`, from `beginSession`): a hero who earned them before talents and tiers existed, or while no one watched, would otherwise hear of neither. Each talent is read where its rule lives (`hasTalent`): Test Driven and Clean Commit in `greenBuild` and `shrine`, Ship It in `cache`, Rubber Ducking in `fail`, Second Wind in `hurt` (`Game.wind`, once a depth), Opener and Grudge in `talentTimes`, Bloodletting in `strike`, Scavenger and Iron Stomach in `consumables.ts`, Haggler in `priceOfWare`, Pathfinder in `sightOf` (corridor sight, `visibleFrom`'s `reach`).
- Balance: simulated with each talent from the first step (30 games a class, 1,000 steps), deaths per 1,000 steps are 2.28 with none and 1.8 to 2.4 with any one. Grudge and Opener at half again the damage gave 1.1 and 1.3, so they give a quarter. With the simulated player picking at random, 8,000-step games are 2.27 without talents and 2.37 with (noise), the deepest depth 79 and 82.
- Drawn by `hooks/talentwindow.ts`: while one is owed, the three offered as cards side by side, each its family's ribbon (`familyOf`: work green, fight red, road gold) and its icon (`TALENT_ICON` in `pixelart.ts`) on a face in the family's tint; the chosen card (`TalentUi`, the pane's) lifted and rimmed white, its line in the box below. A card clicked is chosen, clicked again (or Take, `t`) taken; its number takes it at once; Later (`l`) and the close box leave it owed. The last owed taken closes the window; with more owed it offers the next three. With none owed, the talents taken and the level of the next. As text, a button each offered talent.
- It opens on its own (`offerTalent` in `hooks/game.ts`, after every action) once a talent is owed, no other window is open and no foe is alive: once for each talent earned (`Game.talentOffered`), so Later leaves it closed until the next.

## The deep

- Drawn by `hooks/deepwindow.ts`: the depth and its tier, the tiers reached with their depths and marks (the last three, two while a fork waits; the one the hero is in framed white, its mark green if easier, orange if harder), and while a fork waits the next tier's two marks as cards (`A` the easier, `B` the harder; the chosen one framed white), a click or its letter choosing one (`mark` action). Without a fork it names the depth of the next. As text, a button each mark of the fork. The rules are in [pacing.md](pacing.md#tiers-past-depth-50).

## The compact inventory

- A pane 80 to 104 columns wide cannot hold the worn slots beside the bag. There the bag and the belt are pixels as in the full screen and what is worn is a text list beside them, two rows a slot; a click on a worn row takes it off. Bag items are chosen, compared, opened and dragged as in the full screen; there is no drag onto the list (Equip is in the menu).
- The window takes its width (`windowPixels`, `coverage`, `place` and `cardWithMenu` all take one); the gold moves clear of the title when the usual spot is too near it.

## The merchant, the smith, the bag: undoing and keeping

- Undo sale (`u` at the merchant): the last sale, one item or a whole sale of junk, bought back for what it fetched while there is the gold and the room (`buyBack`, `Game.lastSold`); gone with the next sale, a change of depth or the portal.
- Keep old (`k` at the smith): the piece as it was before the last reforge worn again, the gold staying paid (`keepOld`, `Game.reforgedFrom`); gone with the next job, once the piece is no longer worn, or on leaving town.
- Lock (`g`, or the item's menu): a locked item is not sold, marked as junk or destroyed until unlocked, and wears a small padlock; locking clears junk.
