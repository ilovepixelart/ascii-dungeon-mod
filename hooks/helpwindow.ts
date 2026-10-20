// The how-it-plays window: what the session's coding does to the hero, a row a rule with the strip's own icon, the work
// it rewards in green, and what is the player's own to choose. Opened from the start screen and settings, it closes back
// to what it was opened over. Pure: the click layer reports whole gestures, this says whether one closes the window.
import type { Run } from './game'
import { MARK, mark } from './hud'
import { canvas } from './canvas'
import { INK, SURFACE } from './ui/tokens'
import { CLICK_SLOP, CLOSE_BOX, WINDOW_W, bodyTop, drawBox, isInside, pixel, windowPixels, word } from './window'
import type { Chrome, Gesture, OverlayBox } from './window'

const CHROME: Chrome = { title: 'HOW IT PLAYS', labels: [] }
const top = bodyTop(CHROME)
const HEAD = 'YOUR CODING PLAYS THE HERO'
const YOURS = 'You pick the gear and the talents, and set the orders.'
/** Each rule takes three rows of the box: what happens, what it comes to, a row of room. */
const RULE_ROWS = 3
/** Cells of room left of the text, for the icons drawn there. */
const ICON_PAD = 8

/** Each rule: its icon, what happens, what it comes to; `work` for what rewards the player's work. */
export const HELP_ROWS: readonly { icon: keyof typeof MARK; when: string; does: string; work?: true }[] = [
  { icon: 'fury', when: 'Every tool call', does: 'A step or a blow' },
  { icon: 'heart', when: 'A failed call', does: 'Lets the foe strike' },
  { icon: 'xp', when: 'Tests that pass', does: 'A sure critical', work: true },
  { icon: 'regen', when: 'A commit', does: 'A shrine and full HP', work: true },
  { icon: 'coin', when: 'A push or a PR', does: 'A cache of loot', work: true },
  { icon: 'stairs', when: 'An answer finished', does: 'The stairs down' },
]

/** The box under the head, in cells: each rule, what happens bold (green for the work it rewards) over what it comes
 * to, then what is the player's own. */
export const helpOverlay = (): OverlayBox[] => {
  const lines: Run[][] = [
    ...HELP_ROWS.flatMap(r => [[{ text: r.when, bold: true, ...(r.work === true ? { color: INK.good } : {}) }], [{ text: r.does, dim: true }], []]),
    [{ text: YOURS, dim: true }],
  ]
  return [{ role: 'about', x: 2, y: top / 2 + 6, w: WINDOW_W - 4, h: lines.length + 2, border: SURFACE.frame, lines, pad: ICON_PAD }]
}

/** The window's height in pixels, title bar and all. */
export const helpHeight = () => {
  const box = helpOverlay()[0]!
  return 2 * (box.y + box.h) + 2
}

/** The window's pixels: title bar, the head, the box, each rule's icon beside its first line. */
export const helpPixels = (): string[][] => {
  const body = canvas(WINDOW_W, helpHeight() - top)
  word(body, HEAD, 3, 3, INK.gold)
  const c = windowPixels(CHROME, body.px)
  const box = helpOverlay()[0]!
  drawBox(c, box)
  HELP_ROWS.forEach((r, i) => mark(c, MARK[r.icon], box.x + 3, 2 * (box.y + 1 + i * RULE_ROWS)))
  return c.px
}

/** Whether a gesture closes the window: a click on its close box. */
export const helpGesture = (gesture: Gesture): boolean => {
  if (gesture.type === 'drag') return false
  const from = pixel(gesture.from)
  const at = pixel(gesture.at)
  if (Math.max(Math.abs(at.x - from.x), Math.abs(at.y - from.y)) >= CLICK_SLOP) return false
  return isInside(at, ...CLOSE_BOX)
}
