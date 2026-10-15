# Pixel windows

Every pixel menu is one window: the same width (`WINDOW_W`, so one pane width shows them all, or none), the same title bar and the same text boxes over it. Every pixel menu is built on it: the inventory (and its compact form), the town's windows, the character sheet and the start screen. A pane narrower than `WINDOW_W` shows each as text instead (`widthNote` in `register.tsx` says why).

| Module | Holds |
|---|---|
| `hooks/window.ts` | the frame (title, gold when the window passes it, close box, section labels, the body below `BODY_TOP`); text boxes (`boxShape`, `drawBox`); where they go (`coverage`, `place`); gestures (`Gesture`, `pixel`, `CLICK_SLOP`) |
| `hooks/pieces.ts` | what windows are built from: an item in its tier box with its marks (`drawItem`), an item grid (`itemGrid`, `cellBox`), the belt |
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
- The title, then a card a hero: its portrait in its starting kit, its name, a pip a point of each attribute it starts with. The chosen card is framed white, its ability, lean and kit in the box under the cards.
- A card chooses its hero; the chosen card clicked again, or Start (`s`), begins a new game as it. Back (`b`) and the close box leave the game as it was; Back shows only with a game under way (`isUnderWay`), since a first game has nothing to go back to. Keys `1` to `3` choose.

## The character sheet

- The hero's portrait in what they wear; who they are, their HP, attack, defense and crit, and the points to spend; the XP bar; a row an attribute with its value, a `+` (lit while there are points) and what it does. New game is in settings.

## Settings

- Opened from the gear in the strip, or Settings on the text dashboard. New game opens the start screen; View steps the view; Effects and Music each turn on or off; Volume steps a quarter at a time, from full round to a quarter, for every clip and the tune (`SoundSettings`, `nextSound`). Music turned on or off, or a new volume, restarts the tune at its level. The sound settings are kept across sessions; the `sound` and `music` options give them until the player sets them.
- Hero orders, under a rule below the sound (`Game.orders`, kept with the game; `obey` and `ORDER_STEPS` in `hooks/game.ts`), each stepped by its button. Drink: a healing potion after a blow that leaves the hero under a quarter of max HP (the default), under half, or never. Smoke: never (the default), or when low, a smoke bomb under a quarter of max HP with no healing potion left and a foe near. Leave: take every item (the default), leave Commons, or leave anything below Rare; a kill's item below it stays on the floor, said. The orders' hotkeys (d, f, k) work only in the pixel window: on the text dashboard d descends and k moves up.
- What the drink order is for: the hero plays mostly while no one watches. Over 60 simulated games a class with a player who never drinks by hand, deaths per 1,000 steps are 4.73 with it off and 2.57 at a quarter; a player who drinks at 40% by hand sees no change (2.24 to 2.26).

## The death window

- Opened by the rules on every death (`die` sets `Game.fallen` and the `death` panel), but drawn only once the hero's fall has played on the map (`isFalling` in `register.tsx`); without the pixel map it shows at once. The killer's portrait as it stood (a big boss its 16 by 16 at its own size, `killerArt`), who and on which depth, the level, the deaths and the gold lost, the depth woken on, and Wake (`w`), which closes it like the close box.
- A unique's name carries its own article ("the Rotking"), so the window names the killer from the kept foe (`killerName`), not from `Fallen.by`, the log's wording.

## The recap

- What the tool calls came to since the player last clicked or pressed a key (`Game.recap`, counted by `noted` in `hooks/recap.ts` in `apply`, for tool-driven actions only). The next click or key is a look (`isRecapShown` in `register.tsx`): after `RECAP_CALLS` calls or more it opens the `recap` panel instead of doing what was asked; after fewer, what was counted is forgotten. It never opens on its own, and never over the death window.
- Drawn by `hooks/recapwindow.ts`: the hero's portrait, tool calls, depth and level from and to, kills, gold gained, champions and deaths, the work done (green test runs, commits, pushes, pull requests), and the best find of Rare or better with its name wrapped to even lines. A section with nothing to say is left out. Play on (`p`) and the close box close it; closing it, or any window opened over it, forgets what it told.

## The compact inventory

- A pane 80 to 104 columns wide cannot hold the worn slots beside the bag. There the bag and the belt are pixels as in the full screen and what is worn is a text list beside them, two rows a slot; a click on a worn row takes it off. Bag items are chosen, compared, opened and dragged as in the full screen; there is no drag onto the list (Equip is in the menu).
- The window takes its width (`windowPixels`, `coverage`, `place` and `cardWithMenu` all take one); the gold moves clear of the title when the usual spot is too near it.

## The merchant, the smith, the bag: undoing and keeping

- Undo sale (`u` at the merchant): the last sale, one item or a whole sale of junk, bought back for what it fetched while there is the gold and the room (`buyBack`, `Game.lastSold`); gone with the next sale, a change of depth or the portal.
- Keep old (`k` at the smith): the piece as it was before the last reforge worn again, the gold staying paid (`keepOld`, `Game.reforgedFrom`); gone with the next job, once the piece is no longer worn, or on leaving town.
- Lock (`g`, or the item's menu): a locked item is not sold, marked as junk or destroyed until unlocked, and wears a small padlock; locking clears junk.
