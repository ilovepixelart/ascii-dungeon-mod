# Town

A fixed square of shops, reached by portal: lit by day, no fog, no foes. The ground, who stands where and what stands in the way (`TOWN_DECOR`) are in `hooks/town.ts`; the rules that differ in town are `TOWN` in `hooks/game.ts`.

## Layout

Three shops face a cobbled square across its north side: the merchant (red roof, coin sign, goods outside), the smith (slate roof with a smoking chimney, stone wall, furnace and anvil on an open forge floor) and the healer (teal roof, red-cross sign). The square has a fountain at its center between two flower beds and two lamps, the stash on its west side, and the portal on the road out through the south gate. An overlapping line of trees in two greens frames the town, broken only by the gate. Trees, the fountain, lamps, the goods and the anvil block walking; signs, the furnace and the chimney sit on walls.

## The portal

- `t` (or the portal button) opens it from the dungeon whenever no foe lives on the level, and sets the hero down beside the town's portal. The tile it was opened on is kept in `portal`.
- `t` again, or clicking the town's portal, leads back to that tile. A click walks the hero up to the portal first, the walk drawn in town, and only its end steps through (`isWalkThrough` in `register.tsx`).
- A finished task (the turn ending) still takes the hero down: from town straight to the next depth, the portal closed.

## In town

| Event | In town |
|---|---|
| a tool call that would explore, summon or bring an ally | the hero rests; no foe follows |
| a tool call's outcome | no fight; work is rewarded as in the dungeon (`pacing.md`, Work), a commit marking the depth the portal leads back to |
| attack | "No foes here." |
| explore, descend by hand | the stairs are in the dungeon: take the portal back |
| a click on open ground | walked to |
| a click on a townsfolk, the stash or the portal | walked up to (diagonals count), then visited |

## Who is there

| Spot | Does |
|---|---|
| Healer | restores HP to full, free, and remembers what it mended (`mended`) for the window to say |
| Merchant | sells potions and scrolls, some kinds at more than one tier (`SHOP_PRICES` in `hooks/game.ts`, a ware named by its kind and tier) |
| Smith | tempers a worn item, +1 to its main stat, up to 3 times (`temperItem` in `hooks/items/loot.ts`); reforges a worn Uncommon, Rare or Epic item's affixes (`reforgeCost` in `hooks/game.ts`) |
| Stash | the town's, kept from hero to hero (`hooks/stash.ts`): plain tabs each a grid the bag's size (8 by 6 cells, an item taking its own w by h of them, at the first place it fits as in the bag), the first free and the next three bought in turn for 1,000, 2,500 and 5,000 gold (`TAB_PRICES`), and two of a place each, one for every class set's piece and one for every Legendary, 3,000 each (`SPECIAL_TAB_PRICE`). A set piece or a Legendary stored goes to its own tab once bought and its place there is empty, else to the plain tab shown or the first with room (`whereToStore`). Its window (`hooks/chest.ts`) has the tabs in its title bar and the tab shown over the bag; a tab not bought says its price and why it cannot be bought yet, with a Buy button; the sets' and Legendaries' tabs are boards, a slot a place, each its piece's size, a piece stored in its tier's box, an empty place its piece's shape, dark. A retired hero's successor and a new game keep it all (`townStash`, `restash` re-ids its items). A save from before the grids (version 13) has each tab laid out (`laidOut`): what one cannot hold goes to another with room, then to a plain tab not yet bought, given, then into the bag, then onto the floor by the portal. |
| Elder | one quest at a time (`elder` in `hooks/game.ts`): slay 8 foes on the hero's deepest depth or deeper, slay a champion there or deeper, or reach 3 depths further; a visit says how it stands, and once done pays 15 gold a depth plus 30 and an item of Uncommon or better, waiting while the bag has no room (Claim asks again, the `claim` action). Over 300 simulated games: about 2.5 quests a game |
| Mystic | a visit opens the window; its button reads a fortune for 20 gold and 10 a depth reached (`mystic`, `fortuneCost` in `hooks/game.ts`), one at a time, good until the hero changes depth (down the stairs or slain; the portal keeps it): Luck (+15 crit chance), Riches (half again a kill's gold) or Insight (half again its XP). Over 300 simulated games: about 4 a game |
| Guard | the next guardian when it is a depth off or nearer, else a turn of the halls ahead, else a word for a hero who has fallen; the hero's deepest depth and falls under it; and the trade-in (`tradeIn` in `hooks/game.ts`): three spare pieces of the lowest tier with three to spare, Common to Rare (`tradeInOf`: marked junk first, then the cheapest, never a locked one), for one of the next tier or better, the three given back when it will not fit. Over 90 simulated games of 3,000 steps, trading whenever three are spare, 22 trades a game take items destroyed from 33 to 21 a game and the deepest depth from 40 to 43, deaths unchanged (1.63 to 1.71 per 1,000 steps) |
| Villager | a hint at the first thing in town the hero has not used yet: the stash, the elder, the smith, the mystic; and a sealed pack (`gamble` in `hooks/game.ts`), `gambleCost` gold (50 and 12 a depth of the deepest reached: over 3,000 packs a depth, about what its item fetches on depth 1, 1.8 times on depth 10, 2.4 on depth 30, 2.9 on depth 60) for an item of Uncommon or better rolled as a drop is, nothing paid with no room in the bag. Over 90 simulated games of 3,000 steps, buying with three packs' gold in hand, a hero holds half the gold (4,896 to 2,271) with deaths and depth unchanged |
| Dog | can be petted (`pet`), and counts it (`petted`) |

Every townsperson opens a window when visited: on a pane at least `WINDOW_W` wide a pixel window (`hooks/shop.ts` for the merchant, `hooks/forge.ts` for the smith, `hooks/chest.ts` for the stash, `hooks/talk.ts` for the rest; see `windows.md`), on a narrower one a text window in `register.tsx` with a Close button (`PANEL_ROWS` gives each its rows). Leaving town closes any of them (`TOWN_PANELS` in `hooks/game.ts`).

## Drawing

`hooks/townpixels.ts` draws the whole town once and keeps it: ground from `TOWN_TERRAIN` with each roof's lit ridge, the shadow under the eaves and the road's lit and shaded edges against grass; then `TOWN_DECOR` in order (the tree line, the town's trees and fountain from `TOWN_BIG_ART`, the small things from `TOWN_DECOR_ART`), each tree on an oval shadow and some in `TREE_ALT`; then the townsfolk and the stash and portal. When `where` is `town`, `frameOf` cuts its window from that picture and draws the hero with his shadow. The camera clamps to the town's size (`worldSize`) and recenters on entering it. The character map and the ASCII view both show `townRows`: `#` buildings, `&` trees, `~` the fountain, `!` lamps, `o` goods and the anvil, the townsfolk by initial.

## Rules the simulator checks

`hooks/invariants.ts`: the hero stands on open ground in town, no foe is in town, a portal is kept exactly while in town, and it leads back to dungeon floor. The simulated player goes to town when badly hurt with no potion, visits the healer, wanders, and comes back.
