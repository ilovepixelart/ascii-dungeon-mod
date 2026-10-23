# Pixel windows

Every pixel menu is one window: the same width (`WINDOW_W`, so one pane width shows them all, or none), the same title bar and the same text boxes over it. Every pixel menu is built on it: the inventory (and its compact form), the town's windows, the character sheet and the start screen. A pane narrower than `WINDOW_W` shows each as text instead. The pane's top row says what its size is short of (`hooks/panesize.ts`): on the map, how wide it needs to be (`widthNote` in `register.tsx`), else that it is under the size the game plays best in (`BEST_COLUMNS` by `BEST_ROWS`, the tallest window whole, pinned by a test over every window drawn); on a window it cannot show whole, the rows that window needs (`fitNote`, counting the `UNDER_WINDOW` rows beneath it). The map gives the note its row.

| Module | Holds |
|---|---|
| `hooks/window.ts` | the frame (title or a row of tabs, gold when the window passes it, close box, the body below `WINDOW_TOP`); the title bar's words (title or tabs, gold) as terminal text over it (`chromeBoxes`, kept by the pixels `windowPixels` drew); tabs in terminal text, in the title bar or for a window's pages (`textTabRects`, `textTabsBox`, `tabGround`); text boxes (`boxShape`, `drawBox`); where they go (`coverage`, `place`); gestures (`Gesture`, `pixel`, `CLICK_SLOP`) |
| `hooks/pieces.ts` | what windows are built from: an item in its tier box with its marks (`drawItem`), an item grid (`itemGrid`, `cellBox`), the belt |
| `hooks/ui/tokens.ts`, `hooks/ui/kit.ts` | the interface kit: each color named once by its role, the spacing, the card families; the flat card and its family's ribbon; the hover (`hoveredRect`, `lightUp`). |
| `hooks/windowclient.ts` | the click layer: writes the text boxes it is handed and reports whole gestures |
| `hooks/inventory.ts`, `hooks/bagui.ts` | the inventory (see `inventory.md`) |
| `hooks/shop.ts` | the merchant |
| `hooks/talk.ts` | the healer, elder, mystic, guard, villager and dog |
| `hooks/forge.ts` | the smith |
| `hooks/chest.ts` | the stash |
| `hooks/start.ts` | the start screen |
| `hooks/sheet.ts` | the character sheet |
| `hooks/settings.ts` | settings: New game, effects, music and the volume |
| `hooks/death.ts` | the death window |
| `hooks/compact.ts` | the inventory for a pane `COMPACT_W` (82) to 104 columns wide |

## The merchant

- The wares on a shelf on the left, three to a row, each price under its icon; a price that cannot be paid is grey. The bag and the belt sit where the inventory has them.
- A click chooses a ware or a bag item and shows its card; a second click opens its menu. A right-click buys a ware, or sells a bag item, at once (Undo sale takes a sale back); when it cannot (the gold short, the belt full, the item locked), it opens the menu, which says why. A ware's menu is Buy, and stays open after a buy so each further one is a click; a bag item's is Sell and Equip. What cannot be done says why in the menu (`whyNot`: not enough gold, no room on the belt; the class that can wear it) and does nothing.
- Choosing a ware lets go of the chosen bag item, and the other way round: one card at a time.
- Every action has a key under the window; Sell junk shows how many items are marked before it is pressed.
- Cards go where they hide the least of what the window shows (`cardWithMenu`) and never on what they are about.

## Conventions

Every window keeps these; review them as a real session draws them with `tools/shots/shoot.py` (see `docs/design.md`).

- A right-click moves an item between a window's two sides at once: the stash stores and takes, the merchant buys and sells. Where there is no other side (the bag), it opens the item's menu.
- Colors by role from `hooks/ui/tokens.ts`, never a code of a window's own: `scripts/check-colors.mjs`, a gate, fails on a raw color (any quotes, three, four, six or eight digits) in any module that draws a window, takes the tokens or draws the pane's text (a `.tsx`); a click layer, which cannot import the tokens, may hold only a copy of a token's value. The strip (`hooks/hud.ts`) is pixel art outside the gate; its text inks are copies of `INK.text`, `INK.dim` and `INK.gold`, held to them by a test.
- At most 41 rows (`BEST_ROWS` in `hooks/panesize.ts`, pinned by a test over every window drawn), so a pane of 49 shows any window whole with its keys and how to reach them, its hint and the log under it, and no button is scrolled out of reach.
- A title bar with the close box, and the body right under it. Its words are terminal text, a column a letter where the pixel font takes four: the title, or the hero's tabs (`hooks/herotabs.ts`, all five beside the gold), and the gold in full after its pixel coin. The pane and the previews write them over every window from `chromeBoxes`, so no window lists them among its own boxes. A window with pages shows them as tabs at the top of its body, in terminal text too.
- Text over pixels: the terminal's Raster paints every color at 4 bits a channel (the nearest multiple of 17), and text as given, so a text cell given a pixel ground's own token shows as a band of another shade. Every box the pane hands a click layer goes through `onPixels` (`hooks/window.ts`): each ground as the Raster paints it (`painted`), and a box whose text lies inside the hovered place on the glow's inside (a tab's, bright on its tint).
- What is read as information (sentences, heads, lists, a stat before and after) goes in a text box, full width under the window's content, or beside a portrait: a line of terminal text is 2 px tall where one of the pixel font takes 7. Labels, names and numbers on art are terminal text too (`artLabel`); see docs/design.md. A box's frame says what it holds: what the window says in `SURFACE.frame`; an item's card in its tier's color (a ware is a Common), the worn piece it is weighed against in `SURFACE.frame`; a menu in white.
- Choosing among cards or pieces: a click (or the card's number key) chooses it, framed white; a second click or the window's main button acts. The main button is framed white (`armed`): Take, Start, Retire, Wake, Play on. A row of buttons under the content is centered.
- The hover: the click layer reports where the pointer is while no button is held (`windowclient.ts`), and the window lights what it is over, its outline half way to white and its inside a tenth (`glow` in `hooks/ui/kit.ts`, its shares `GLOW` in `hooks/ui/glow.ts`). A place with no frame of its own, a tab (`look: 'fill'` on its `Rect`, from `textTabRects`), is lit by a tint alone, 15% of the way, its word bright: a pixel of outline is a whole cell wide, and round a tab it stood apart as two grey bars. A drag's target in the bag glows the same way, in white where the item fits and in red where it will not go. Each window lists what a click acts on as drawn (`startHot`, `talentHot` and the like, the hero's tabs from `heroTabsHot`), what cannot act now left out (a press that would change nothing, `wouldAct` in `talk.ts`), and so is what lies under a box that takes clicks, an open card or menu (`uncovered` in `window.ts`); with an item's menu open nothing is lit, the close box included, as a click anywhere but on the menu only closes it; the pane adds the close box and redraws only when what is lit changes (`litWindow` in `register.tsx`). The strip under the map lights the same way (`hudHot`), and so does the map: the tile under the pointer while a click there would act (`isClickable` in `register.tsx`: a seen floor tile; in town open ground or a townsperson), lit in the map's frame by `pixelMap`'s `lit`, not while the hero walks.
- Close is `c` in every window, and the close box. Later where something stays owed (talents), Back only where a window returns to another (the start screen, retire).
- The keys under a window fit one row: a key's label is short, the detail in the window.

## Gotchas

- Every bar is flat, one color, 2 px tall on a whole cell's top (`flatBar` in `hooks/pieces.ts`), its numbers text centred on it (`barLabel`): each character on the bar's color under it, in the ink that reads there (`inkOn`). The strip's HP and XP, the sheet's XP, the healer's HP and the elder's quest. The foe's bar on the map is 1 px and too short for a number.
- Text goes in text boxes, not pixels: the pixel font is 5 px tall, fine for titles, labels and numbers, not for sentences. The window draws a box's frame and fill in pixels; the click layer writes its text on the same fill.
- The pixel font has no full stop or comma (`drawable` in `hooks/window.ts` drops them from a card's text), nor a colon or an apostrophe: text drawn in a window is written without them, which the assets test holds every window in `hooks/screens.ts` to.
- A text box is placed in cells (one pixel across, two down), so its frame lands on even pixel rows.
- A button is its frame and face in pixels (`button` in `hooks/pieces.ts`, `BUTTON_H` 6 px) and its words a text box on the face (`buttonBox`), which the window's overlay lists with its other boxes. Its top goes on an even pixel row (`onCell`), so its words' row is a whole cell; rows of buttons step `BUTTON_H + 2`.
- `place` scores a spot by what it hides (`coverage`, weights the window chooses) a thousand times over its distance from what the box is about: hiding less always wins over being nearer. The bag weighs every slot, filled or empty, and its grid: a slot is the window's shape whether it holds anything, so a card goes on open ground first; the compact bag, the shop and the stash weigh the grid too (`gridBox`). A card about an item keeps a pixel of bare ground round it, off every weighed thing and the window's edges (`clearance`), and off the chosen item's brackets (`bracketed`). The stash is the bag window's height, so a card has room under its list.

## The townsfolk

- A portrait (the sprite at three times its size), what they say in a text box beside it, under that what they show (the healer the hero's HP, the elder the quest's progress, the dog how often it has been petted) and at most one button: the mystic's Fortune, the elder's Claim, the dog's Pet. The mystic's box ends with the three fortunes, the one in force marked `>` in gold.
- What they say is chosen from how the hero stands, first match wins (`WORDS` in `talk.ts`), so it changes with the game rather than repeating one line.
- A button that cannot act now is drawn grey and does nothing; a price that cannot be paid is grey. The elder's Claim is lit white once the quest is done.

## The smith

- The worn slots on the left, as in the inventory; the piece being worked on framed white on its slot's own frame, as the bag frames the slot an item would fill. It is the first worn until another is clicked (`chosenSlot`).
- On the right its card, what the smith works on (`workCard`): name, tier, its stats on one line, its power, trigger or set by name alone (the bag's card says what each does), what it was before a reforge (name, then stats), then what each job costs or why it cannot be done (`whyNotTemper`, `whyNotReforge`), the Temper line with the stat now and after one more (`DEF 4 > 5`). Under it Temper with a pip a tempering beside it, Reforge, and after a reforge Keep old, grey when they cannot act. So with Keep old the window still fits 41 rows.
- The buttons carry no price: a reforge's runs to three digits, too wide for the work side with the key and label. The prices are in the card.

## The stash

- The chest on the left as a list, a row a stored item in its tier's color (the chosen one marked `>`); the title counts the tab shown, what it holds of its room (none for a tab not bought); the bag on the right.
- A row or a bag item is chosen with a click and shows its card; a second click opens Take or Store, which says why when the chest is full or the bag has no room (`whyNotStore`, `whyNotTake`). A right-click moves it at once: a row's item into the bag, a bag item onto the tab shown (or its own special tab); when it cannot, the right-click opens the menu, which says why.
- The chest is a list, not a grid: its ten items keep no places, and a grid with room for ten of the largest would not fit beside the bag.

## The start screen

- The `start` panel: a first game opens on it (`openingGame` in `hooks/save.ts`), and New game in settings (or `r` on the text dashboard) opens it. While it is open the dungeon waits: `apply` lets through only a new game, closing it and the view key, so tool calls change nothing.
- Titled ASCII DUNGEON, a card a hero: its portrait in its starting kit at twice the sprite's size, its name. The chosen card is framed white; the box under the buttons holds its ability, then its lean and kit, then what each attribute does (`STATS_LINE`) or, after a retirement, the heirloom and whether the chosen class wears it or carries it in the bag in its place.
- A card chooses its hero; the chosen card clicked again, or Start (`s`), begins a new game as it. Help (`h`) opens the how-it-plays window over the screen, framed white on a first game (`isFirstGame`: none under way and no codex yet). Back (`b`) and the close box leave the game as it was; Back shows only with a game under way (`isUnderWay`), since a first game has nothing to go back to. The buttons sit in one centered row. Keys `1` to `3` choose.

## The character sheet

- The first of the hero's tabs (`hooks/herotabs.ts`: Hero, Bag, Talent, Deep, Codex, in the title bar; Talent and Deep marked gold while a talent is owed or a fork waits). The hero's portrait in what they wear, beside it who they are, their HP, attack, defense and crit, what Vigor and Insight give, and the points to spend; the XP bar; the attributes two to a row, each its value and a `+` (lit while there are points); Retire (`r`) under them, lit once the hero has slain a big boss (`canRetire`). New game is in settings.

## Settings

- Opened from the gear in the strip, or Settings on the text dashboard. Two pages (`SettingsUi`), each a tab under the title bar and `p` under the window. Game: New game opens the start screen; Help beside it the how-it-plays window; Sound (the effects) and Music each turn on or off; Volume steps a quarter at a time, from full round to a quarter, for every clip and the tune (`SoundSettings`, `nextSound`). Music turned on or off, or a new volume, restarts the tune at its level. The sound settings are kept across sessions; the `sound` and `music` options give them until the player sets them.
- Orders, the second page: the hero's standing orders (`Game.orders`, kept with the game; `obey` and `ORDER_STEPS` in `hooks/game.ts`), each stepped by its button. Drink: a healing potion after a blow that leaves the hero under a quarter of max HP (the default), under half, or never. Smoke: never (the default), or when low, a smoke bomb under a quarter of max HP with no healing potion left and a foe near. Leave: take every item (the default), leave Commons, leave anything below Rare, or leave all loot; a kill's item it leaves is said and not taken. A prize (a unique's, a boss's, the codex's) comes whatever the order. The orders' hotkeys (d, f, k) work only in the pixel window: on the text dashboard d descends and k moves up.
- What the drink order is for: the hero plays mostly while no one watches. Over 60 simulated games a class with a player who never drinks by hand, deaths per 1,000 steps are 4.73 with it off and 2.57 at a quarter; a player who drinks at 40% by hand sees no change (2.24 to 2.26).

## The log

- The game keeps its last 30 log lines (`LOG_KEPT` in `hooks/game.ts`); the text dashboard shows the last 5 (`LOG_SHOWN`), a window's tail the last 2. The log window (`hooks/logwindow.ts`) shows them oldest first, the latest action's at full strength, each broken at its spaces into rows of `LOG_ROW` (a word longer than a row wraps). Its box holds 30 rows: when the lines take more, it shows the newest whole, never one begun part way, under a row saying how many earlier ones do not fit. It is the pane's own state (`isLogOpen`), as How it plays is: it opens over whatever is open and closes back to it. With the strip it opens from the strip's gold and depth line (`hudGesture`'s `isLog`), as text from the log's latest line (`g`), and from any window's tail by a click.

## How it plays

- What the session's coding does to the hero, in one text box: a rule each with the strip's own icon beside it (`HELP_ROWS` in `hooks/helpwindow.ts`), what happens over what it comes to: every tool call a step or a blow, a failed call the foe's strike, passing tests a sure critical, a commit a shrine and full HP, a push or a pull request a cache, a finished answer the stairs; the work it rewards in green. Last, what is the player's: gear, talents, orders.
- Opened by Help (`h`) beside New game in settings, and How it plays on the text dashboard's settings. It is the pane's own state (`isHelpOpen` in `register.tsx`), not a game panel, so it opens over whatever is open and closes back to it; first in the window lists, it draws over every other. As text, a line a rule and where the bag, the sheet and settings are.

## The death window

- Opened by the rules on every death (`die` sets `Game.fallen` and the `death` panel), but drawn only once the hero's fall has played on the map (`isFalling` in `register.tsx`); without the pixel map it shows at once. The killer's portrait as it stood (a big boss its 16 by 16 at its own size, `killerArt`), who and on which depth, the level, the deaths and the gold lost, the depth woken on, and Wake (`w`), which closes it like the close box.
- A unique's name carries its own article ("the Rotking"), so the window names the killer from the kept foe (`killerName`), not from `Fallen.by`, the log's wording.

## The recap

- What the tool calls came to since the player last clicked or pressed a key (`Game.recap`, counted by `noted` in `hooks/recap.ts` in `apply`, for tool-driven actions only). The next click or key is a look (`isRecapShown` in `register.tsx`): after `RECAP_CALLS` calls or more it opens the `recap` panel instead of doing what was asked; after fewer, what was counted is forgotten. It never opens on its own, and never over the death window.
- Drawn by `hooks/recapwindow.ts`: the hero's portrait and beside it the tool calls, depth and level from and to, kills, champions, gold gained and deaths, and the work done (green test runs, commits, pushes, pull requests); under it the best find of Rare or better in its box, its name beside it. What has nothing to say is left out. Play on (`p`, framed white) and the close box close it; closing it, or any window opened over it, forgets what it told.

## The codex

- What every hero of the save has done (`Game.codex`, kept through a new game by `apply`'s `restart`): the uniques and big bosses slain and the Legendaries come to hand, and the records: deepest depth, top level, kills, bosses slain, deaths and gold found in the dungeon. `recorded` in `hooks/codex.ts` adds what each action did, compared before and after, so no rule has to report to it. A Legendary counts once it is in the bag, the stash or worn; one left on the floor of a full bag is not found.
- A save from before the codex begins one at its first action (`firstCodex` in `hooks/game.ts`): uniques from `uniquesSlain`, every big boss up to `bossSlain` (each guards the way down), the Legendaries owned, the deepest depth, level and deaths. Kills and gold were never counted, so they start at 0. `Codex.retired` counts the heroes retired; a codex from before retiring has none.
- A set made whole pays once a save, the moment it is (`paySets`): all five uniques an Epic or better, all five big bosses a Legendary. A save whose set was whole when the codex began is not paid for it. Over 30 simulated games a class at 8,000 steps the prizes take deaths per 1,000 steps from 2.72 to 2.27 and the deepest depth from 74 to 79; a run that rolls the prizes and withholds them stays at 2.74. Below depth 25 nothing changes.
- Drawn by `hooks/codexwindow.ts`, the hero's last tab, on two pages (`CodexUi`, a tab each, `p` under the window): Foes, the uniques and the big bosses; Finds, the Legendaries and Card (`k`). An entry is lit once slain or found and a dark shape until then (`SURFACE.shade`, painted apart from the frames' `line` on the host's 17-step grid), a Legendary found in its tier's box as in the bag. Each box is its art and a pixel of frame round it, as the bag's slots: a big boss's 18 px, a Legendary's as wide as its own art; each row is centred in the window. A unique slain stands on the map's floor, as it does there, so its dark outline shows. The box under them counts them, and on Finds holds the records. The close box and Close (`c`) close it. As text, each row names what is in it.

## The hero card

- Card (`k`) in the codex, as a button on the text dashboard too, saves the hero as a picture and copies them as text, for the player to share where they like; nothing leaves the machine on its own. `hooks/herocard.ts` draws it (`cardPixels`): the portrait in what they wear, level and class, the deepest depth and its tier, kills and deaths, heroes retired (none, left out), the worn pieces in their tier boxes, the codex's counts, gold found and the talents; `cardText` writes the same in five lines.
- A plugin writes text, not bytes (`$.fs.write`), so the picture is an SVG (`svgOf`): a rectangle a run of one color along a row, drawn at four times. `saveCard` in `register.tsx` writes `ascii-dungeon-hero.svg` to `~/Downloads` (`$.env.get('HOME')`, `$.fs.exists`), or the home folder without one, copies the text (`$.ui.copy`) and toasts what came of each, a refusal of either said.

## Retiring and the heirloom

- A hero who has slain a big boss may retire (`retire` action, `whyNotRetire` in `hooks/game.ts`), passing down one piece they wear as the save's heirloom (`Game.heirloom`, `heirloomOf` in `hooks/items/loot.ts`). The game becomes a new one on the start screen with the codex (one more retired) and the heirloom; no Back, as nothing is under way.
- Every new hero after that, by the start screen or New game, sets out with the heirloom (`newHero`): worn when the class can wear it, its kit piece going to the bag, at full HP; in the bag when it cannot. The next retirement replaces it.
- An heirloom keeps its name, tier, look, Legendary power and trigger; its stats are its base's plain ones, untempered, unlocked, not junk. The Rubber Duck's power is its +50% XP, so that stat stays. With the stats as found on depth 1, simulated deaths in the first 1,000 steps (60 games a class) fell from 2.26 to 0.50 with the Duck; as built they are 1.92 with the Duck, 2.17 with the Band of the Endless Loop and 2.06 with a Rare chain.
- Drawn by `hooks/retirewindow.ts`, laid out as the smith's: what the hero wears on the left as in the inventory, the chosen piece framed white (the first worn until one is clicked; `w` steps through them); on the right the box of what it asks with the chosen piece's name, what passing it down means, and the hero's level, class, deepest depth and big bosses slain, then Retire (`r`, dark until a big boss is slain) and Back (`b`, to the sheet) under it. As text, a button a worn piece retires passing it down.

## Talents

- A talent is earned at every tenth level (`owed` in `hooks/talents.ts`), and picked from three offered (`offer`): none already taken, the three fixed by the world and the picks so far, so reopening shows the same cards. The `talent` action takes one on offer; reaching a tenth level says one is waiting, and so does every session's start while any are owed, with an open fork too (`greet` in `hooks/game.ts`, from `beginSession`): a hero who earned them before talents and tiers existed, or while no one watched, would otherwise hear of neither. Each talent is read where its rule lives (`hasTalent`): Test Driven and Clean Commit in `greenBuild` and `shrine`, Ship It in `cache`, Rubber Ducking in `fail`, Second Wind in `hurt` (`Game.wind`, once a depth), Opener and Grudge in `talentTimes`, Bloodletting in `strike`, Scavenger and Iron Stomach in `consumables.ts`, Haggler in `priceOfWare`, Pathfinder in `sightOf` (corridor sight, `visibleFrom`'s `reach`).
- Balance: simulated with each talent from the first step (30 games a class, 1,000 steps), deaths per 1,000 steps are 2.28 with none and 1.8 to 2.4 with any one. Grudge and Opener at half again the damage gave 1.1 and 1.3, so they give a quarter. With the simulated player picking at random, 8,000-step games are 2.27 without talents and 2.37 with (noise), the deepest depth 79 and 82.
- Drawn by `hooks/talentwindow.ts`: while one is owed, the three offered as cards side by side, each its family's ribbon (`familyOf`: work green, fight red, road gold) and its icon (`TALENT_ICON` in `pixelart.ts`) and its name under it, the chosen card's in gold on a flat card as the start screen's; the chosen card (`TalentUi`, the pane's) framed white, its line in the box below. A card clicked is chosen, clicked again (or Take, `t`) taken; its number takes it at once; Later (`l`) and the close box leave it owed. The last owed taken closes the window; with more owed it offers the next three. With none owed, a box with the level of the next and each talent taken with what it does. As text, a button each offered talent.
- It opens on its own (`offerTalent` in `hooks/game.ts`, after every action) once a talent is owed, no other window is open and no foe is alive: once for each talent earned (`Game.talentOffered`), so Later leaves it closed until the next.

## The deep

- Drawn by `hooks/deepwindow.ts`: while a fork waits, the next tier's two marks as cards side by side (`A` the easier, `B` the harder; the chosen one framed white), a click or its letter choosing one (`mark` action). The box under them heads with the depth and its tier, lists the last three tiers reached with their depths and marks (the one the hero is in marked `>`, its mark green if easier, orange if harder), says what each card does and how the fork is chosen; without a fork, the depth of the next. As text, a button each mark of the fork. The rules are in [pacing.md](pacing.md#tiers-past-depth-50).

## The compact inventory

- A pane 80 to 104 columns wide cannot hold the worn slots beside the bag. There the bag and the belt are pixels as in the full screen and what is worn is a text list beside them, two rows a slot: the slot's name, then the piece; a name too long for a row takes both rows, and one too long for both shows as its base's name (`slotLines`). A click on a worn row takes it off. Bag items are chosen, compared, opened and dragged as in the full screen; there is no drag onto the list (Equip is in the menu).
- The window takes its width (`windowPixels`, `coverage`, `place` and `cardWithMenu` all take one); the gold moves clear of the title when the usual spot is too near it.

## The merchant, the smith, the bag: undoing and keeping

- Undo sale (`u` at the merchant): the last sale, one item or a whole sale of junk, bought back for what it fetched while there is the gold and the room (`buyBack`, `Game.lastSold`); gone with the next sale, a change of depth or the portal.
- Keep old (`k` at the smith): the piece as it was before the last reforge worn again, the gold staying paid (`keepOld`, `Game.reforgedFrom`); gone with the next job, once the piece is no longer worn, or on leaving town.
- Lock (`g`, or the item's menu): a locked item is not sold, marked as junk or destroyed until unlocked, and wears a small padlock; locking clears junk.
