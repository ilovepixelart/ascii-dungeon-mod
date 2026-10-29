# Changelog

All notable changes to ascii-dungeon are listed here. Versions follow
[Semantic Versioning](https://semver.org/); while the version is 0.x, any
release may change behaviour.

## [Unreleased]

### Changed

- Armor lets a share of each blow through rather than taking its defense off: `K / (K + defense)`, `K` being 0.9 of
  the depth plus 10, never under a quarter. Foe attack no longer grows faster than depth past depth 10; foe HP still
  does. Past depth 100 a blow took a fifth to two fifths of max HP; it now takes about a seventh at every depth.
- A Common item's card, in the bag, the stash, the merchant's and the smith's, is framed in the plain frame rather
  than Common's white, which sat a step from the focus white and made the card look chosen.

## [0.7.0] - 2026-10-27

Saves from 0.6.0 load as they are: the save stays at version 14, and the new fields (the play order, the gold banked,
a unique's wait, a retired hero's gold) start empty. What changes on loading: a hero past a fifth level is owed the
talents that now come every fifth level, the stash's items for the next new hero are their plain heirloom stats, and
the game plays harder past depth 10 and in the shops' prices. Nothing needs doing.

### Added

- A save the store refuses is said in a toast, once until one lands again, with the reason: it was dropped in
  silence, and the game went on unsaved.
- Play by hand, in settings beside Volume (`y`): the session's tool calls and answers no longer move the hero, and a
  walk in the dungeon meets foes as tool calls would summon them, so the game plays from keys and clicks alone. By
  session stays the default; saves from before it play by session.

### Changed

- Two sessions open at once no longer overwrite each other's save: the first keeps it, and one started while another
  has saved in the last 10 minutes plays unsaved and says so. A session gives up its claim as it ends.
- Retiring passes half the hero's gold, rounded down, to the next hero, banked in town and said: retiring wiped it
  all. A new game begun from settings still starts with none.
- Fewer free potions, so the merchant has more to sell: a kill leaves healing at a quarter of its potion chance (half
  before), and a boss leaves a Greater Health Potion, a big boss still an Elixir. Over 30 games a class of 6,000
  steps, potions bought go from 0.7 to 1.2 a game and deaths per 1,000 steps from 1.19 to 1.31; most healing still
  comes from drops deep down and from potions on the floor.
- Gold brought to town is safe: a death takes half, rounded up, of only what was earned since the hero was last in
  town, and spending in the dungeon comes off the safe gold first. A death took half of all the gold carried, so
  saving up for a stash tab only put more at risk.
- The smith's tempering costs once more for every ten depths the hero has reached: 60 gold for the first to depth
  9, 120 from depth 10, 360 from depth 50. It cost the same at depth 50, where a kill pays about 100 gold, as on
  depth 1.
- The merchant asks the shelf price once more for every ten depths the hero has reached: a Health Potion is 25 gold
  to depth 9, 50 from depth 10 and 150 from depth 50. Its prices stood still while a kill's gold grew with the depth.
- A talent comes every fifth level, where it came every tenth: about 6 in a game of 6,000 simulated steps, where it
  was 3. A hero of a save finds the talents now owed waiting.
- A new hero's stash holds its items as an heirloom comes: their base's plain stats, untempered, their lock and junk
  mark kept. Kept at the stats they were found with, they let a level-1 hero start with 51 to 111 attack and no
  death in the first 1,000 steps, on a new game as on retiring.
- Past depth 10 foes grow half a percent more a depth, in HP and attack: a depth-50 foe a fifth over its depth's
  plain sum. The hero's levels and gear outgrew a depth's worth, so depths 11 to 100 slew the hero 0 to 0.29 times
  in 100 tool calls; over 30 games of 6,000 steps they now do 0.10 at depths 21 to 30, 0.49 to 0.93 at 31 to 50 and
  0.27 to 0.96 in the Abyss.
- A knight keeps half their defense, rounded down, against a blow that passes through armor (a wraith's, the
  Drowned Queen's, the Hive Mother's); a mage or a rogue still keeps none. Over 30 knight games of 6,000 steps, big
  bosses slew knights 0.3 times a game, where they did 1.2, the Hive Mother on depth 40 most of all.
- A unique that slays the hero waits for them to gain a level before it rises again. Old Bones, on depths 2 to 4,
  met a hero sent back to depth 1 on every return, and with no one spending points it caused 104 of 261 deaths over
  30 games of about 300 tool calls (56 of 236 now).
- Armor lets at least a quarter of a blow through, rounded up: it took its whole defense off, down to 1, and from
  about depth 11 a hero's defense passed what most foes hit for, so ordinary fights cost nothing and the danger lay
  only in blows that pierce armor. Over 4,000 steps, damage taken a kill goes from 20 to 33 and deaths per 1,000
  steps from 0.51 to 0.59.
- The attributes rebalanced, each worth a point: Might gives a point of attack a point (half before), Focus 5% more
  critical damage a point besides its 3% crit chance, Insight 5% more XP a point (10% before). Foes have 6 HP a
  depth (4 before), so a kill still takes 2 to 3 hits. A hero putting every point in Might or Focus died three to
  four times as often as one in Vigor, and one in Insight levelled twice as fast as any other.
- The green upgrade mark counts a set's two-piece bonus, and never marks a piece that would break a whole set or
  replace a worn Legendary with a piece without a power. It weighed the two items' own stats alone, so a plain
  blade a point better was marked over a whole set's.
- The recap waits out the death window: a click on it kept nothing of what happened unseen, so after a fall the
  recap never showed. The first click after the death window closes opens it.
- The standing orders (drink, smoke, loot) carry over to a retired hero's successor and to a new game: each new hero
  started on the defaults.
- A finished answer leaves a hero in town where they are: it took them through the portal and down a depth, closing
  the shop, the smith or any window mid-visit and dropping the smith's Keep old. The portal is the way back.

### Fixed

- A refused tool call (a No at the permission prompt, or a hook's or a rule's deny) counted as a failure: the foe
  struck, or an imp hit for the depth with no foe near, and it could fell the hero. A refused call deals and takes no
  blow.
- A subagent's tool calls, a workflow's and the engine's own background agents' summoned foes and struck or hurt the
  hero as if the main session had made them. Only the main session's tool calls play now.

## [0.6.0] - 2026-10-27

Saves from 0.5.0 load as they are: the save stays at version 14, and the deep's fates chosen so far are the Abyss's.
Nothing needs doing.

### Changed

- The deep is the Abyss, its tab ABYSS among the hero's tabs: every ten depths past 50 is a circle with a name (the
  Hollow Halls, the Sunken Vaults and on, past the tenth the Nameless Dark) and a warden, the big boss on its last
  depth. A fork offers the next circle's blessing, the easier mark, or its curse, the harder that pays more. The
  marks and their rules are as they were.
- The hero has no dark outline on the map: the floor shows right up to its sprite again. Nor does the town's art:
  its townsfolk, trees, fountain, portal, stash, anvil, lamps, signs and the rest.
- The town redrawn: the merchant wears a hat and the smith a cap, with two eyes over his beard; the fountain is a
  stone basin seen from above and in front, its rim lit, its water rippling round a raised bowl; the dog stands on
  the grass.
- The stash is the dungeon's wooden chest and stands on the smith's forge floor, past the anvil, instead of on the
  square's west side. The villager's hint says so.
- The Rotking is a kobold under a red toadstool cap in a purple robe; it read as scattered pink dots.
- The dog stands from the top of its tile to the bottom, with an ear, an eye, a nose and a raised tail.
- The dash's bag button is a tied sack and the settings gear has a tooth on each side and corner.
- The talents taken are named each in its family's ink.
- Settings name each button bright in the box under them and what it does dimmed; the loot order reads Loot:.
- Windows keep one gap of 2 px over their box and one between buttons; cards and the worn slots line up with the
  boxes and frames beside them; the chosen worn piece is framed white over its tier's frame.
- Each Legendary's codex box is its piece's size; the codex keeps one height on both pages, Card listed on Finds.

### Fixed

- On a pane with the dash, a hero near the level's bottom walked under the dash's plaque, and the level's last rows
  could not be seen there, nor clicked to walk to. The camera keeps the hero above the dash, and at the level's bottom
  the map runs past it, its last rows shown above the dash.
- In town, the view past the town's bottom edge, shown above the dash, was empty black. The forest goes on there,
  the road from the gate running south through it.
- An orb's number showed a lighter box behind it where the liquid's lit surface line cut through its text cell.

## [0.5.0] - 2026-10-23

Saves from 0.4.0 load as they are, brought to save version 14: each stash tab, a list of ten, is laid out on a grid
the bag's size, largest first; what a tab cannot hold goes to another tab with room, then onto a plain tab not yet
bought, given, then into the bag, then onto the floor by the portal, so no item is lost. The pane plays best 62 rows
tall (49 before): the stash's window is 54 rows. The view toggle is gone from settings: with the pixel strip or dash
the map is always pixels. Nothing else needs doing.

### Added

- From 105 columns the strip is a dash in the manner of Diablo III's: an HP orb and an XP orb of glass, their liquid
  filled to the share and rippling, their numbers on them, standing high over the map with a horned gargoyle crest
  each; the belt between them; the bag, settings and the portal in sockets in its corners; and over the map between
  the orbs a carved plaque of the depth, the gold and the effects. Either orb opens the character sheet and the
  plaque the log; a click or the pointer between its parts reaches the map under it.
- The stash's plain tabs are grids the bag's size, 8 by 6 cells: an item lies at its cells as in the bag, stored at
  the first place it fits, and room is cells, not items. The sets' and the Legendaries' tabs are boards, a slot a
  place, each its piece's size, an empty place its piece's shape. Items are dragged between and within the tab's grid
  and the bag's, framed white where they fit and red where they do not; a right-click moves one at once.
- A right-click buys or sells at the merchant at once.
- Leave all loot, a fourth step of the loot order: a kill's item is left on the floor, said; a prize still comes.

### Changed behaviour

- HP is red at every share, in the orb, the strip's bar and the healer's.
- Every count and gold amount has its thousands set off by commas, in the windows, the log and the price tags.
- The keys under a pixel window say its buttons' words, read alike in every window, Close among them.
- Every window keeps its content 2 px clear of its sides, its title bar and its bottom; a portrait's box stands 3 px
  from it; a row, stack or grid of buttons is centred under what it acts on or in the window.
- The talent cards are flat, as the start screen's, and name their talent under its icon, the chosen one in gold.
- The codex frames a found entry as a portrait is framed; each box is its art and a pixel of frame, each row centred,
  a shape not yet found painted apart from its frame, a unique slain on the map's floor.
- The retire window is laid out as the smith's.
- The townsfolk's windows lay their parts out alike; the villager's shows the gold it takes, and a price on a button
  is upper case ("GAMBLE 62 GOLD").
- Settings say under their buttons what each does.
- The title bar's gold has the strip's round coin; the sheet's XP star stands on its bar's rows; an empty worn
  slot's shape shows; a trap has a portrait of its own on the death window; the recap frames its best find as wide as
  the portrait.
- The hero is outlined on the map, so a hood or a helm the colour of the floor stands out from it.

- A belt slot's count sits clear over its icon, each digit on the icon's own colors, where a dark badge was cut
  into the icon's corner under it.
- A pile's names show what beats what you wear first, with a green arrow; past five, four a page and a row
  (`< 1-4 of 13 >`) whose click shows the next; the row under the pointer shows its item's card beside them, as the
  bag compares it.
- Below 105 columns the strip is a row shorter: the gold, depth and effects sit beside the belt, the gold written in
  full with its thousands set apart. Belt slots are 10 by 10 like every slot, their counts on the icon's corner, in the bag, the
  compact bag and the merchant too.
- The stash has tabs and is the town's, kept from hero to hero: four plain tabs, the first free and the rest bought in
  turn for 1,000, 2,500 and 5,000 gold, and a sets' tab and a Legendaries' tab of a place each, 3,000 gold each. Its
  window has the tabs and the gold in its title bar, the tab shown over the bag, a tab's price and Buy where it is not
  bought. Saves of version 12 keep their stash as tab 1.
- The talent families are named Craft, Combat and Survival, where they were Work, Fight and Road.
- Buttons say what they do, without a key letter: a key reaches the pane only after ctrl+x tab, the prompt having the
  keyboard otherwise, so a key on a button promised what a press there would not do. The keys' row under a window
  now has "ctrl+x tab for keys:" on a line over it.
- Window titles, the gold in a title bar and the codex's and settings' page tabs are written in terminal text, where
  they were in the pixel font.
- The pointer over several items lying on one tile names them a row each, each in its tier's color, the rarest
  first, where one line joined them all in the rarest one's color; past five rows, the last says how many more.
- The names over a tile are written on the map under them, darkened, where they sat on a black box. Moved from the
  tile onto them, the pointer keeps them there and lights the row it is on; a click on a row picks that item, first of
  what lies there, so with room for one it is the one taken.
- The bag is one of the hero's tabs: Hero, Bag, Talent, Deep and Codex share the title bar of each of those windows,
  so a click moves between them. The tabs' labels are written in terminal text, which fits all five beside the bag's
  gold.
- The last words and numbers drawn in the pixel font are terminal text: the shop's prices, the belt's counts in the
  bag, the compact bag, the shop and the strip, the strip's gold, depth and effects, the start screen's class names,
  the talent cards' ribbons and the dog's pets. The deep's two marks are buttons.
- Settings' buttons line up in columns: a column's buttons are one width, its widest's.
- Buttons are written in terminal text on a face 6 pixels tall, where their key and label were the pixel font on one
  11 tall; the windows are shorter for it. The hero sheet's attributes are written the same way.
- The codex draws each unique at its size on the map, half a big boss's each way, in a slot as the bag's centred
  over its big boss's column, where it was doubled to a big boss's size.

### Fixed

- An item's card, the worn piece's beside it and a menu could stand on a slot's frame, the bag's grid, the window's
  edge or one another; each keeps a pixel of bare ground round it. The stash's card has room under the tab.
- The smith and the retire windows drew the chosen piece's white frame against the pane's edge, and a worn piece
  still the bag's choice with the bag's brackets; the chosen slot's frame is white on the slot itself.
- The chosen item's white frame was drawn before the rest of its grid, which cut it into an L.
- The codex dropped the count of heroes retired after the next action.
- A card's layout is made once for a window's state: the hover and the clicks no longer lay it out again each time.

- A click on a belt slot's count, or on a ware's price, did nothing: the window took the label for a card and kept
  the click. A click on a label goes through to what it labels.
- Hovering a pile of more than five items blanked the whole pane: the row counting the rest gave the map's click layer
  an id that was undefined, and the engine refuses a tree holding one. That row has no id now.
- A vampiric champion healed by all it dealt, so one hitting harder than the hero healed more each round than it lost,
  while the hero's potions kept the hero up: the fight never ended. It now heals by at most half of what it took since
  its last blow.
- A nemesis grew a fifth stronger with every win, without end. One that kept winning went deeper and grew again each
  time, until no hero could beat it (18 wins: four and a half times a champion's HP and attack). It now grows by its
  first three wins alone.
- A hovered tab was outlined like a button: its sides, a pixel each, showed as two thick grey bars round the word. A
  tab is lit by a tint alone now, its word bright.
- How it plays drew its rules' icons where its text box's fill covered them, and a text box's blank rows took no
  room, so the rules ran together over an empty bottom. The icons have a column of their own and every blank row keeps
  its row.
- The bag's cards stood on empty worn slots, empty grid cells and the chosen item's white brackets; they go on open
  ground first. The compact bag's brackets and worn list touched the window's edges; it has a pixel of room each side,
  and needs a pane 82 columns wide (80 before).
- Text over a window's pixels, the hero's tabs first, sat on a band of a slightly different shade: the terminal paints
  pixels at 4 bits a channel and text in full. Text grounds take the pixels' painted color, and a hovered tab's label
  the glow's, so the hover's outline is no longer cut by the label's row.
- A hero stopped on the stairs by a foe can go down by clicking them once it is gone; the click said to finish the
  task, so the hero had to step off the stairs and back.
- On a big boss depth the arena often grows over a room beside the stairs, or right up against one with no wall
  between. Standing in the smaller room, the hero saw only it, the rest of the arena dark and drawn without its walls, a
  foe beside the hero included; standing in the arena, the smaller room stayed dark, and a click on its floor said
  "You can't get there." Each now shows the other whole. The levels are as they were.
- A cache earned in town with the bag and the stash full waits by the portal on the depth below, but stepping back
  through the portal onto it did not pick it up, and an answer finished in town walked down from that tile without it:
  the cache was lost. The same befell an item lying under the hero when a walk began. Arriving on a tile and starting
  any walk (a click, an explore, an answer finished) now pick up what lies there, room allowing.
- The smith's window after a reforge was 84 to 92 pixels tall, past the 41 rows every window fits, and cut the line
  saying what was worn before. The smith's card now shows what smithing changes: stats on one line, a power, trigger
  or set by name (the bag's card says what each does), and what it was before on two lines; the temper pips sit beside
  Temper. With Keep old it is at most 40 rows.
- The log window kept the newest 30 rows rather than lines, so long lines (a trade-in's run past 120 characters) pushed
  earlier ones out and the top row could start part way through a line; a word longer than a row was cut. It now shows
  the newest lines whole, as many as its 30 rows hold, under a row saying how many earlier ones do not fit, and wraps a
  long word.
- The compact inventory (a pane 80 to 104 columns wide) cut a worn piece's name at 16 characters, which most rolled
  names pass ("Refactored Leath"). A name too long for a row now takes both of its slot's rows, and one too long for
  both shows as its base's name ("Leather Boots"), in its tier's color.
- The hover now lights everything a click acts on, and nothing a click there cannot do: a belt slot holding something
  in the bag, the compact bag and the merchant; a stored item's row in the stash; a worn row in the compact bag; the
  merchant's chosen ware, which a second click opens. A worn piece the full bag has no room for, the deep's mark
  already chosen, and the elder's Claim, the villager's Gamble and the guard's Trade in when the bag has no room for
  what they give are dark: a press would change nothing, and so is what lies under an open item card, where a click
  lands on the card. A talent card acts exactly where it is lit.
- The stash's item card could lie over its list by a row, a tall card chosen on the list's last rows with a full bag;
  it now keeps clear of the list. A stored name too long for its row (over 38 characters) shows as its base's name,
  where it was cut.
- The name of an item lying on the map ran past the map's right edge on a map narrower than the name, and below the
  map on a map four rows tall. It is held inside the map, cut to fit with an ellipsis.
- Gold of 1,000,000 or more ran under the close box in a window's title bar. It is written in full, its thousands
  set apart by commas, and ends short of the close box at any amount.
- The text dashboard names its colors by role: the points to spend on the Character button are drawn in the
  sheet's green, where they were a gold of their own.
- A quest's pay refused for want of bag room rolled its item first: each press of Claim used up an item and a roll
  of the drop luck. A refusal now leaves the game as it was.
- A corridor passing a room's cut corner (a cross, an L or a ragged room), rock between, showed the whole room from
  there, its foes and items included: 4.5% of levels have such a spot. A corridor cell now opens onto a room only
  beside that room's own floor.
- A prompt's first 48 characters, quoted in the log as a quest, were written to the save on disk, a pasted token
  included; the save now says "A new quest." there, the quote kept for the session. Only what a person types, at the
  prompt or through Remote Control, is a quest: not a slash command's line, a prompt the engine adds unseen, a task's
  notification, a scheduled prompt, another session's message or the SDK host's turn.
- A blow landing while a window covered the map (the bag open, the pane resized) stopped the idle motion until the
  next blow, and a fall then never opened the death window. A blow whose map the host refuses now ends there.
- Closing the pane mid-walk left the walk's click waiting: the next tool call jumped the hero to its end with no walk
  played, and a click or blow waiting on the walk went off at the end of a later walk, on another depth too. Closing
  the pane now ends the walk where the hero is drawn and drops what waited on it.
- A hero killed by a trap made the champion up elsewhere on the depth their nemesis, or gave the nemesis up a win and
  a fifth more strength. Only the foe that struck the killing blow is remembered now.
- With an item's menu open in the bag, the compact bag, the merchant or the stash, the hover still lit the items, the
  belt and the close box, where a click only closes the menu. Nothing is lit there now.
- With a belt slot's menu open on the strip, the hover lit the portrait or the XP line under it, where a click lands
  on the menu. What the menu covers is left unlit.
- A champion's prize was toasted only when the kill's line was the last said: a mage's siphon, a quest's count or a
  potion found after it, and no toast came (a mage never had one). The champion's name now reaches the toast directly.
- Selling an item in the dungeon and buying it back counted the sale's gold in the codex's gold found every time: a
  hundred rounds made 600 gold of nothing. A sale is no gold found.
- A commit's shrine, a push's cache and a pull request's hoard, once a depth, paid twice on a depth reached again: a
  push on depth 7, one on depth 6 after a death, and another back on depth 7 gave three caches. Every depth paid is
  kept now; a save from before keeps the depth it last paid on (save version 12).
- A save from a newer version of the mod (an older one installed after it) was opened and written back stamped older,
  so the next upgrade ran its migration again. It is now left as it is: the session plays a new game unsaved, and says
  so.
- A save the mod could not read (not a game, or a bag, log or gear of the wrong kind) made every action fail, for
  good: the game never moved and the save was never replaced. Such a save is now kept aside, under `save-unreadable` in the plugin's store, and gives way to a new game.
- On about one big boss depth in a thousand the arena, grown over a room listed before it, became the themed room, its
  furnishings drawn only in part: a library without its lectern, a shrine with one brazier and no altar. A room
  holding the start or the stairs is never themed now; on those levels another room is, the map itself unchanged.
- On the text dashboard one key did two things while a window was open under it: `j` moved down and marked junk, `g`
  opened the log and locked, and in town `a` was attack and Claim, `p` potion and Pet. A window's own key wins now;
  the dashboard's button stays, to be clicked.
- In town the barrel and crate beside the shop walled in three tiles of the lane above them: a click there said "You
  can't get there." They stand at the top of the lane now.
- With several items left on one tile, the map's hover named only the first, and the text map's `*` took its color:
  what lay under it went unseen until stepped on. The hover now says how many and names them all, in the rarest one's
  color, as the `*` is drawn.

## [0.4.0] - 2026-10-20

Saves from 0.3.0 load as they are: one standing on a depth that now has a rounded, alcoved or island room (save
version 11) starts that depth again from its new start, gains kept. Keys that moved: Close is `c` in every window
(the inventory and the town's windows took `i`), the elder's Claim is `a` (it was `c`), and in the talent window a
number chooses its card where it took the talent at once (Take, `t`, takes it). Nothing else needs doing.

### Changed behaviour

- The windows are redone on one set of rules, and each fits in 41 rows, so the game plays best in a pane 105 columns
  by 48 rows, where it was 78:
  - Sentences sit in a text box under a window's content (or beside a portrait), where several windows wrote them in
    the pixel font; a box's frame says what it holds, an item's card in its tier's color. The talents taken, the
    mystic's fortunes, the deep's depth and tiers, the retire window's ask, How it plays' head and the stat a temper
    raises are text in their boxes too: the mystic's window is 24 rows where it was 41, the deep's at a fork 25
    where it was 34.
  - The character sheet, the talents, the deep and the codex are tabs of one window, named in its title bar, the
    talents and the deep marked with a gold dot while one waits; the sheet's attributes sit two to a row, its Codex,
    Talent and Deep buttons gone to the tabs. The codex has two pages, Foes and Finds (the Legendaries, the records
    and Card); settings two, Game and Orders; `p` turns the page.
  - Talents are picked from three cards side by side, each with its family's ribbon (work, fight, road) and its own
    icon, the chosen one lifted; the window opens on its own when a talent is earned, once no window is open and no
    foe is alive, and Later leaves it owed until the next. Saves gain the optional `talentOffered`.
  - The start screen is titled in its title bar, a portrait and a name a card; the deep's two marks sit side by side;
    the retire window, the recap and How it plays put their words in boxes. The inventory, the merchant, the smith and
    the stash drop the labels under their title bars; the stash's count is in its title.
  - Each window's main button is framed white (Take, Start, Retire, Wake, Play on) and a row of buttons is centered;
    the keys under a window fit one row.
- What the pointer is over lights up before a click, in every window, on the strip and on the map: a button, a card,
  a tab, a worn piece or an item in the bag, a ware, the close box, a belt slot, the tile a click would walk to. What
  cannot act now (a dark button, the chosen tab, rock or what is unseen) does not.
- The character sheet's train buttons show a plus alone, where each showed its key, 1 to 4, beside it; the keys still
  train. A button with a key and no label sits centered.
- The log keeps its last 30 lines, where it kept 5, so a busy moment (a kill that levels the hero and drops loot)
  no longer pushes its first lines out. A log window shows them all: from the strip's gold and depth line, from the
  text dashboard's latest line (`g`), or from the lines under any window. Saves keep up to 30 log lines.
- The guard in town trades in (`t`): three spare pieces of a tier, Common to Rare, for one of the next tier or
  better. Pieces marked junk go first, then the cheapest; a locked one never. With no room for what it gives, the
  three stay. Over 90 simulated games items thrown away fall from 33 to 21 a game, and the deepest depth rises from
  40 to 43 with deaths unchanged.
- The villager in town sells a sealed pack (`g`): 50 gold and 12 a depth of the deepest reached, for an item of
  Uncommon or better rolled as a drop is, about 1 in 20 an Epic and 1 in 70 a Legendary. With no room in the bag
  nothing is paid. Over 90 simulated games of 3,000 steps the gold a hero holds halves (4,896 to 2,271) with deaths
  and depth unchanged.
- An item found with the bag full lies where it fell, drawn on the map, and stepping onto it with room picks it up;
  it was lost, though the log said it stayed on the floor. It waits through a trip to town, and going down leaves it
  behind, said. The pointer over it on the map names it, in its tier's color. A prize goes to the stash in town
  while it has room: a nemesis's trophy, a unique's or a boss's item, the codex's, and a push's or pull request's
  cache. A full belt says it has no room, where it said the potion stayed on the floor. Saves gain the optional
  `floor`.
- An answer finished walks the hero to the stairs on screen, picking up what lies on the way, then down, where the
  hero appeared on the next depth from wherever he stood. Simulated deaths per descent are unchanged (0.097 and
  0.099); the hero gets down a little sooner, so deaths per 1,000 steps go from 1.60 to 1.71.
- A corridor shows at once when the hero steps into it, along its floor through its next junction, so one click walks
  its length; a chest at a dead end, the next door and the room past it show only once the hero is beside them. A
  room shows whole from its door, and no longer through a gap from a room beside it; from a room the hero no longer
  sees a chest down a corridor.
- Kills drop healing potions half as often, where three healing finds in four went to waste. Simulated deaths rise
  from 1.46 to 1.55 per 1,000 steps, the deepest depth reached unchanged; the hero buys potions and uses herbs and
  runes about a third more.
- Each theme has its own floor and walls, where all five drew one slab and one brick in different tints: the crypt
  irregular flagstones and ashlar, the flooded halls worn slabs with puddles and mossy stone, the fungal deep packed
  earth with mycelium and porous rock with glowing caps, the frozen caverns sheet ice and snow-capped rock with icicles,
  the forge riveted iron plates, some cracked and glowing, and basalt with a line of heat.
- What lies by the walls is the theme's own, where every theme had bones and rubble: bones and cobwebs in the crypt,
  algae and reed sprigs in the flooded halls, mushroom tufts and spores in the fungal deep, frost and ice shards in the
  frozen caverns, slag and soot in the forge.
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

- A blow that comes to nothing shows it: MISS over a foe that darts aside or that the blow passes through, BLOCK over
  whoever's shield turns it, WARD over the hero when a ward absorbs it.
- The pane's top row says when it is short of the size the game plays best in, 105 columns by 48 rows, and how big it
  is; a window it cannot show whole says how many rows it needs. The note on a pane too narrow for the pixel windows
  moves there from under the map.
- Things to gather, one a theme, about one a level by a room's wall: a warding stone in the crypt and a rime crystal
  in the frozen caverns (ward runes), reeds in the flooded halls and glowing caps in the fungal deep (herbs), a powder
  keg in the forge (smoke bombs). Stepped onto, each goes onto the belt at a tier for the depth.
- The start screen is titled ASCII DUNGEON and has Help beside Start, framed white on a first game. Under the chosen
  hero it says what each attribute does or, after a retirement, the heirloom and whether the hero wears it.
- How it plays, from Help in settings or on the start screen: what the session's coding does to the hero (tool calls, failed calls, passing
  tests, commits, pushes and pull requests, finished answers), a row each, and what is the player's to choose.
- A session that starts with talents owed or a fork open says so in the log ("9 talents to choose: open the character
  sheet."), so a hero who earned them before they existed, or while no one watched, hears of them.

### Fixed

- A blow's number no longer stays on the map after its frames end, a kill's included: the pane sends the ordinary
  map at the end, where it left the host to repaint a map it might already have had.
- A blow on the hero shows its damage even when a potion, a heal or a shrine on the same action leaves the HP no
  lower; it showed nothing, as if the blow had missed.
- A click on the stairs walks the hero to them on screen before the descent, where the hero appeared on the next
  depth at once.
- The fungal deep and the frozen caverns draw their own floors and walls. Their ground shared a place in the drawing
  cache, so one could show the colors of the other, or of the forge, depending on what had been drawn before in the
  session.
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
