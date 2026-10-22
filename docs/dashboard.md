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

Built in `hooks/hud.ts` (bars) and `hooks/dash.ts` (the dash), picked by `hooks/strip.ts`; the foe's bar in `hooks/pixels.ts`.

- One pixel strip in an iron frame (dark edge, lit top-left, shaded bottom-right, rivets every 12 pixels), the contents `INSET` pixels in; `hudContent` draws the contents, `hudPixels` frames them, and `hudHit` takes clicks on the framed strip. Nothing under it: no text rows, no buttons, no log. Its height is the same at every width.
- Top row: the hero's portrait (the hero's own sprite, so worn gear shows); a heart and the slim HP bar in HP's red; a gold star under the heart and the XP bar beside it; the settings gear, then the portal flush right, dark while a foe lives and it will not open. The bars run to the gear (`barsLayout`). The HP and the level (a + after it while stat points wait) are terminal text centred on their bars (`hudLabels`), as the inventory's cards are text: each character on the bar's own color under it, the fill where filled, the empty track beyond. A character takes a cell, one pixel across, where the pixel font took three or four. Both bars are 2 px, one flat color each (HP red, XP gold), on a whole text row of the strip so their text covers them exactly.
- From 105 columns (`DASH_COLUMNS`) the strip is the dash instead, Diablo III's way (`hooks/dash.ts`; `hooks/strip.ts` picks one or the other by width): a big glass orb in a carved stone socket at each bottom corner (22 px of glass, a 26 px box), HP on the left and XP on the right, its middle 4.5 px over the dash so it stands high over the map with its numbers on it (the HP over HP, the XP over the level; an XP count too long as a percent), a horned gargoyle crest with ember eyes biting each socket; under the orbs' curves a dash 16 px tall (`DASH_H`, 8 rows) holding the belt, its five slots a pixel apart, centred; the bag and settings buttons in the dash's corner under the HP orb and the portal under the XP, each in a socket cut round it (`dashButtons`); and over the map between the orbs, a carved stone plaque (its top corners cut, a groove under its lit top edge, a rivet and a horn curling up at each end) with the depth, the gold and the effects, a skull at each end from 120 columns (`SKULL_COLUMNS`). The plaque lays the depth first, then the gold, then the fortune and effects, each left out whole when it would not fit (`plaqueParts`). Each orb is glass: a wall a pixel thick, lit top left and dark bottom right; the dark seen through its empty glass, tinted by the liquid; a curved white highlight and one hot pixel on the light side; its liquid (HP red at every share, XP gold) filled to its share, shaded where the round turns from the light. The surface ripples a pixel up and down, a phase every `ORB_STEP_MS` (200 ms) round `ORB_PHASES`, in the dash's own rows; over the map it holds still, so the orbs' numbers keep their ground and every map frame (walk, blow, idle) is the same whenever drawn. The rows over the map, 22 px (`DASH_OVER`), are painted on the map's frame (`dashOverMap`, the `over` of `pixelMapFrame`), their text written and their clicks taken by the dash's own layer there (`dash-clicks`, `overLabels`, `dashOverGesture`). The ripple repaints the strip alone (`rippleTick` in `register.tsx`), one repaint in flight, none when nothing moved, held still once refused. Either orb, its socket or its crest opens the character sheet; the plaque's words the log. The stone's colors sit on the host's 17-step grid, so the terminal paints them as they are.
- Belt row: a slot a kind, 10 by 10 as every slot, each the icon of the tier it uses next with its count as text on the icon's bottom right and a gold pip along its top for each tier above the first, blank while empty. Beside the belt on the same row, the side line: gold (in full, thousands set apart) and depth (or TOWN) from the left; the fortune in force (a crystal ball and L, R or I) flush right, then the running effects (regen, ward, fury, with what is left), an effect left out rather than clipped when it would come within 3 cells of the depth.
- The foe's health is a small bar on the map just above the foe, there only while there is one; its name and threat come as a toast when it appears.
- Play is by mouse (it needs the fullscreen layout): the map walks, attacks a foe and takes the stairs; a click on the hero explores a step; the portrait opens the inventory; the level line (XP bar and level) opens the character sheet, which closes with its own button; the gear opens settings; a belt slot is used, the tier chosen for it or else its strongest; a right-click on a filled slot opens a popover standing on it, a line a tier it holds with how many, strongest first, the one it uses next marked, and a click on a line chooses that tier for the slot without using anything (`hudGesture`, `beltMenuBox`, the `choose` action; any other click closes it); the portal opens (see `town.md`). There is no view key: the map is always pixels.
- Toasts (`toastFor` in `hooks/register.tsx`): the game's own news always; with no log on screen also the newest line a click wrote, and a new foe with its threat. The inventory screen keeps its own log, so its clicks are not toasted.
- The inventory takes the whole pane while it is open (see `inventory.md`).
- Panes without pixels (desktop, narrower than 80 columns) keep the text dashboard, with its keys and log. A window open under it keeps its own keys (`j` junk, `g` lock, `a` Claim, `p` Pet): a dashboard key the same as one of them is dropped while it is open, its button still there to click (`hotkeysIn`, `dashKeys` in `register.tsx`).

Rejected: two strips (the tallest, and half the belt strip empty); an action bar on quarter blocks (they double the pixels across but halve each pixel's width, squeezing art drawn for square pixels); a text status pane (compact, but no longer looks like the game).
