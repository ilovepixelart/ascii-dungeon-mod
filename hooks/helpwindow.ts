// The how-it-plays window: what the session's coding does to the hero, a row a rule with the strip's own icon, the work
// it rewards in green, and what is the player's own to choose. Opened from the start screen and settings, it closes back
// to what it was opened over. Pure: the click layer reports whole gestures, this says whether one closes the window.
import { MARK, mark } from './hud'
import { canvas, fill } from './canvas'
import { wrap } from './recapwindow'
import { CLICK_SLOP, CLOSE_BOX, WINDOW_W, bodyTop, isInside, pixel, windowPixels, word } from './window'
import type { Chrome, Gesture } from './window'

const CHROME: Chrome = { title: 'HOW IT PLAYS', labels: [] }
const top = bodyTop(CHROME)
const PAD = 3
const LINE = 7
const ICON_X = PAD + 1
const TEXT_X = PAD + 10
const DIM = '#8a8494'
const SAY = '#e8e4dc'
const GOLD = '#ffd34d'
const WORK = '#3ccf4e'
const RULE = '#2c2834'
const HEAD = 'YOUR CODING PLAYS THE HERO'
const YOURS = 'YOU PICK GEAR AND TALENTS AND SET ORDERS'

/** Each rule: its icon, what happens, what it comes to; `work` for what rewards the player's work. */
export const HELP_ROWS: readonly { icon: keyof typeof MARK; when: string; does: string; work?: true }[] = [
  { icon: 'fury', when: 'EVERY TOOL CALL', does: 'A STEP OR A BLOW' },
  { icon: 'heart', when: 'A FAILED CALL', does: 'LETS THE FOE STRIKE' },
  { icon: 'xp', when: 'TESTS THAT PASS', does: 'A SURE CRITICAL', work: true },
  { icon: 'regen', when: 'A COMMIT', does: 'A SHRINE AND FULL HP', work: true },
  { icon: 'coin', when: 'A PUSH OR A PR', does: 'A CACHE OF LOOT', work: true },
  { icon: 'stairs', when: 'AN ANSWER FINISHED', does: 'THE STAIRS DOWN' },
]

export type HelpLine = { text: string; x: number; y: number; ink: string }

/** Where everything goes, in window pixels: the head, a row a rule, the rule line and what is the player's. */
const layout = () => {
  const rowsY = top + 13
  const rowH = 2 * LINE + 2
  const ruleY = rowsY + HELP_ROWS.length * rowH
  const yours = wrap(YOURS, WINDOW_W - 2 * PAD)
  const yoursY = ruleY + 4
  // Even, so the window ends on a whole cell.
  return { rowsY, rowH, ruleY, yours, yoursY, height: Math.ceil((yoursY + yours.length * LINE + 1) / 2) * 2 }
}

/** The lines the window says, where (window pixels) and in what ink. */
export const helpLines = (): HelpLine[] => {
  const l = layout()
  return [
    { text: HEAD, x: PAD, y: top + 3, ink: GOLD },
    ...HELP_ROWS.flatMap((r, i) => [
      { text: r.when, x: TEXT_X, y: l.rowsY + i * l.rowH, ink: r.work === true ? WORK : SAY },
      { text: r.does, x: TEXT_X, y: l.rowsY + i * l.rowH + LINE, ink: DIM },
    ]),
    ...l.yours.map((text, i) => ({ text, x: PAD, y: l.yoursY + i * LINE, ink: DIM })),
  ]
}

/** The window's height in pixels, title bar and all. */
export const helpHeight = () => layout().height

/** The window's pixels: title bar, each rule's icon, the lines, the rule line. */
export const helpPixels = (): string[][] => {
  const l = layout()
  const body = canvas(WINDOW_W, l.height - top)
  HELP_ROWS.forEach((r, i) => mark(body, MARK[r.icon], ICON_X, l.rowsY + i * l.rowH + 1 - top))
  fill(body, PAD, l.ruleY - top, WINDOW_W - 2 * PAD, 1, RULE)
  for (const line of helpLines()) word(body, line.text, line.x, line.y - top, line.ink)
  return windowPixels(CHROME, body.px).px
}

/** Whether a gesture closes the window: a click on its close box. */
export const helpGesture = (gesture: Gesture): boolean => {
  if (gesture.type === 'drag') return false
  const from = pixel(gesture.from)
  const at = pixel(gesture.at)
  if (Math.max(Math.abs(at.x - from.x), Math.abs(at.y - from.y)) >= CLICK_SLOP) return false
  return isInside(at, ...CLOSE_BOX)
}
