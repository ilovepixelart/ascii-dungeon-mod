# Inventory screen

Opened by clicking the portrait (`i` on the text dashboard). On a terminal at least `INV_W` columns wide it takes the whole pane while it is open; the map and dashboard return when it closes. Narrower, the text bag shows instead, and the pane says how wide it would need to be for the pixel views (`widthNote` in `register.tsx`: 80 columns for the strip, `INV_W` for the inventory). Mouse input needs the fullscreen layout, like map clicks; every mouse action also has a key.

| Module | Holds |
|---|---|
| `hooks/inventory.ts` | the bag's layout on the window: worn slots, bag grid, belt, the target frames, a drag; `dropTarget` |
| `hooks/bagui.ts` | which popovers and menu the bag shows, and `bagGesture`: what a click or drag does |
| `hooks/window.ts`, `hooks/pieces.ts`, `hooks/windowclient.ts` | the window system the bag is built on (see `windows.md`) |

## The screen

- A pixel title bar: INVENTORY, the gold, and a close box.
- Worn slots on the left, each sized to the largest footprint its items have, so the same icon art serves the bag and the slot. An empty slot shows a faint outline of what goes there.
- The bag grid on the right (`BAG_W` x `BAG_H` in `hooks/items/bag.ts`), 7 px cells. An item covers its whole footprint; the frame around it shows its tier (see `items.md`).
- The belt along the bottom, a slot a kind, as the dashboard draws it (`beltSlot` in `hooks/pieces.ts`).
- Off-class items carry a small red mark in a corner; a small green up mark means an upgrade for this hero.

Colors keep one meaning each: white is "this one, and where it goes"; red is "cannot". Green is not used for targets, because it is the Uncommon tier's color.

## Selecting and comparing

- The selected item gets a white frame outside its tier frame. The worn slot it goes to is framed white too, or red when this hero cannot wear it.
- Two popovers open, each on its own item: the selected item beside itself, and what is worn in that slot under the slot, titled Equipped. They never overlap; `bagOverlay` tries beside, below, then above the item.
- A popover lists the name and tier, the slot (with the class in red when off-class), one stat a line with its change against what is worn (`+7 def  +7 ^`; a stat only the worn item has shows as a loss, `HP  -4 v`), the Legendary power, and the price.

## The mouse

| Gesture | Does |
|---|---|
| click a bag item | selects it |
| click the selected item, or right-click any item | opens its menu: Equip, then Destroy |
| click worn gear | takes it off into the bag |
| click a belt slot | uses it |
| click the close box | closes the inventory |
| click a popover | nothing: it covers what is under it |
| click anywhere with the menu open | closes the menu, and does nothing else |
| drag a bag item onto free cells | moves it there |
| drag a bag item onto its worn slot | equips it |
| drag worn gear onto free bag cells | takes it off into that spot |
| drag onto anything else | nothing; the item stays where it was |

- Equip is greyed, with the reason in red, for gear this hero cannot wear.
- Destroy asks first: the entry turns into "Destroy? click again", and only the second click destroys the item for good.
- While dragging, the item's old place shows a ghost, the item follows the pointer, and the cells under it are framed white where it fits and red with a checker where it does not.
- The click layer holds the press itself and posts whole gestures (a drag still held, a release with where it began), because a Client posts at most once a frame and a later post replaces an undelivered one.

## Keys

- `n`: select the next item; `e`: equip; `s`: sell; `j`: mark junk; `x`: sell all junk; `o`: auto-arrange (packs largest first, only when asked); `d`: destroy, pressed twice; `c`: close.
- `1` to `5`: use the belt slot, also with the bag closed.

## Narrow panes and the desktop

Below `INV_W` columns, or off the terminal, the bag is a text grid with the worn slots listed beside it, the card and the buttons under it, below the map.

## Popovers

The item's card, the Equipped card and the menu go where they hide the least (`bagOverlay` in `hooks/bagui.ts`): every position on the screen is scored by the bag items, worn pieces and belt slots it would cover, the two items being compared counting so heavily that they are never covered, and the cheapest spot nearest its item wins. Their frames are pixels in the box's color (rarity for the item, grey for Equipped) drawn into the screen's Raster (`inventoryScreenPixels`); the click layer writes only the text inside. A click on empty space lets go of the selected item.
