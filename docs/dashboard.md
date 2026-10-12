# Dashboard

The area under the map. It answers the player's questions in this order of urgency; the higher a question, the less it may take to read.

## What it must answer

| Priority | Question | Today | Must be |
|---|---|---|---|
| 1 | Am I about to die? | HP bar in the status line | readable at a glance, without reading digits; color and fill say it |
| 2 | What am I fighting, and is it winning? | a text line | only while a fight is on: the foe, its health, its threat |
| 3 | What can I do right now? | a row of run-together buttons | the actions, with their keys; potions and scrolls with their counts |
| 4 | How do I open the inventory and the character sheet? | "i: Bag" lost in that row | always visible, clearly named |
| 5 | Am I progressing? | level, XP, depth, gold in the status line | present, secondary |
| 6 | Is something running on me? | not shown | only while active: fury, ward, regeneration, with what is left; the mystic's fortune, by its initial |
| 7 | What just happened? | 5 log lines | the latest events; older ones fade |
| 8 | How do I play? | the button labels | learnable, then out of the way |

## Constraints

- Width: from about 100 columns; it must degrade to a narrow pane (text only) without losing priorities 1 to 4.
- Height: every row the dashboard takes is a row the map loses; the budget is set per direction and compared.
- Pixels for everything under the map, numbers in the 3x5 pixel font; what is read as words (what a click came to, a new foe and its threat, level ups) comes as a toast, not as rows the map would lose.
- One visual language with the inventory screen: the same frames, slot backgrounds and colors, each color keeping one meaning (green to red: the hero's health; red: an enemy's; gold: XP and gold; purple: sensed foes and the Epic tier).
- Quarter blocks give 2 x 2 pixels a cell (two colors a cell), twice the pixels across, but each pixel is then half as wide as tall: art drawn for square pixels comes out squeezed. Use them only for art drawn for that shape, or for bars and frames.

## The chosen design: a status strip

Built in `hooks/hud.ts`; the foe's bar in `hooks/pixels.ts`.

- One pixel strip in an iron frame (dark edge, lit top-left, shaded bottom-right, rivets every 12 pixels), the contents `INSET` pixels in; `hudContent` draws the contents, `hudPixels` frames them, and `hudHit` takes clicks on the framed strip. Nothing under it: no text rows, no buttons, no log. Its height is the same at every width.
- Top row: the hero's portrait (the hero's own sprite, so worn gear shows); a heart, the slim HP bar green to amber to red and the HP after it; a gold star under the heart, the thin XP bar beside it and the level after it, a green + while stat points wait; the portal flush right, dark while a foe lives and it will not open. The numbers keep room for full HP and a level with its + (`barsLayout`), so the bars hold still as they change.
- Belt row: a slot a kind, each the icon of the tier it uses next with the count beside it and a gold pip under the count for each tier above the first, blank while empty.
- Side line: gold and depth (or TOWN) from the left; the fortune in force (a crystal ball and L, R or I) flush right, then the running effects (regen, ward, fury, with what is left), an effect left out rather than clipped when it would come within 4 px of the depth.
- The foe's health is a small bar on the map just above the foe, there only while there is one; its name and threat come as a toast when it appears.
- Play is by mouse (it needs the fullscreen layout): the map walks, attacks a foe and takes the stairs; a click on the hero explores a step; the portrait opens the inventory; the level line (XP bar and level) opens the character sheet, which closes with its own button; a belt slot is used; the portal opens (see `town.md`). There is no view key: the map is always pixels.
- Toasts (`toastFor` in `hooks/register.tsx`): the game's own news always; with no log on screen also the newest line a click wrote, and a new foe with its threat. The inventory screen keeps its own log, so its clicks are not toasted.
- The inventory takes the whole pane while it is open (see `inventory.md`).
- Panes without pixels (desktop, narrower than 80 columns) keep the text dashboard, with its keys and log.

Rejected: two strips (the tallest, and half the belt strip empty); an action bar on quarter blocks (they double the pixels across but halve each pixel's width, squeezing art drawn for square pixels); a text status pane (compact, but no longer looks like the game).
