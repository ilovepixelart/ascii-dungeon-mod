// The how-it-plays window, on four pages: what the session's coding does to the hero (a row a rule with the strip's own
// icon, the work it rewards in green), play by hand, the town, how the hero grows. Opened from the start screen and
// settings, it closes back to what it was opened over. Pure: the click layer reports whole gestures, this says what one
// does: a tab shows its page, the close box closes it.
import type { Run } from './game'
import { MARK, mark } from './hud'
import { BG, canvas, fill } from './canvas'
import { INK, SURFACE } from './ui/tokens'
import { CLICK_SLOP, CLOSE_BOX, TABS_H, WINDOW_TOP, WINDOW_W, drawBox, isInside, pixel, tabGround, textTabBoxes, textTabRects, windowPixels } from './window'
import type { Chrome, Gesture, OverlayBox } from './window'

const CHROME: Chrome = { title: 'HOW IT PLAYS' }
const top = WINDOW_TOP
/** The head and the row of room under it, above the rules. */
const HEAD_ROWS = 2
/** Each rule takes three rows of the box: what happens, what it comes to, a row of room. */
const RULE_ROWS = 3
/** The icons' column, left of the text: the text's box starts past it, so its fill leaves the icons' pixels showing. */
const ICON_X = 5
const TEXT_X = 11

type Rule = { icon?: keyof typeof MARK; when: string; does: string; work?: true }

/** Each rule: its icon, what happens, what it comes to; `work` for what rewards the player's work. */
export const HELP_ROWS: readonly Rule[] = [
  { icon: 'fury', when: 'Every tool call', does: 'A step or a blow' },
  { icon: 'heart', when: 'A failed call', does: 'Lets the foe strike' },
  { icon: 'xp', when: 'Tests that pass', does: 'A sure critical', work: true },
  { icon: 'regen', when: 'A commit', does: 'A shrine and full HP', work: true },
  { icon: 'coin', when: 'A push or a PR', does: 'A cache of loot', work: true },
  { icon: 'stairs', when: 'An answer finished', does: 'The stairs down, after 3 calls' },
]

export type HelpPage = 'coding' | 'hand' | 'town' | 'growth'

/** Each page: its tab, its head, its rules, and a last line. */
export const HELP_PAGES: Readonly<Record<HelpPage, { label: string; head: string; rows: readonly Rule[]; foot?: string }>> = {
  coding: { label: 'CODING', head: 'Your coding plays the hero.', rows: HELP_ROWS, foot: 'You pick the gear and the talents, and set the orders.' },
  hand: {
    label: 'BY HAND',
    head: 'You play the hero yourself.',
    rows: [
      { when: 'A walk', does: 'May meet a foe' },
      { when: 'A foe met', does: 'Hits twice as hard as its kind' },
      { when: 'A click on a foe', does: 'Walks up and strikes' },
      { when: 'A click on the stairs', does: 'Walks there and down' },
      { when: 'Tool-call talents and gear', does: 'Never offered' },
      { when: 'Orders, in Settings', does: 'Hand or session play' },
    ],
  },
  town: {
    label: 'TOWN',
    head: 'The town, through the portal.',
    rows: [
      { when: 'The portal (t)', does: 'To town and back, no foe alive' },
      { when: 'The healer', does: 'Full HP, free' },
      { when: 'The merchant', does: 'Potions and scrolls' },
      { when: 'The smith', does: 'Tempers and reforges gear' },
      { when: 'The stash', does: 'Kept for your next hero' },
      { when: '5 calls, no window open', does: 'Back to the dungeon' },
    ],
  },
  growth: {
    label: 'GROWTH',
    head: 'How the hero grows.',
    rows: [
      { when: 'Every 5th level', does: 'A talent, one of three' },
      { when: 'Every 5th depth', does: 'A guardian bars the stairs' },
      { when: 'Every 10th depth', does: 'A big boss instead' },
      { when: 'Past depth 50', does: 'The Abyss: a mark each circle' },
      { when: 'The codex', does: 'All you found and slew' },
    ],
  },
}
const PAGES = Object.keys(HELP_PAGES) as HelpPage[]
const TABS = PAGES.map(p => ({ label: HELP_PAGES[p].label }))

/** The rules' box under the tabs and their rule, in cells. */
const BOX_Y = (top + TABS_H + 2) / 2

const linesOf = (page: HelpPage): Run[][] => {
  const { head, rows, foot } = HELP_PAGES[page]
  return [
    [{ text: head, bold: true, color: INK.gold }],
    [],
    ...rows.flatMap(r => [[{ text: r.when, bold: true, ...(r.work === true ? { color: INK.good } : {}) }], [{ text: r.does, dim: true }], []]),
    ...(foot === undefined ? [] : [[{ text: foot, dim: true }]]),
  ]
}

/** The box's height in cells: the tallest page's, so every page is one window. */
const BOX_H = Math.max(...PAGES.map(p => linesOf(p).length)) + 2

/** The text over the window, in cells: the pages' tabs; the page's head, each rule, what happens bold (green for the
 * work it rewards) over what it comes to, then its last line. */
export const helpOverlay = (page: HelpPage = 'coding'): OverlayBox[] => [
  ...textTabBoxes(TABS, PAGES.indexOf(page), top, BG),
  { role: 'about', x: TEXT_X, y: BOX_Y, w: WINDOW_W - 2 - TEXT_X, h: BOX_H, border: SURFACE.frame, lines: linesOf(page) },
]

/** The box's frame, in cells: round the icons' column and the text, the width of every window's box. */
const frameOf = (box: OverlayBox) => ({ ...box, x: 2, w: WINDOW_W - 4 })

/** The window's height in pixels, title bar and all: one for every page. */
export const helpHeight = () => 2 * (BOX_Y + BOX_H) + 2

/** Where each page's tab is, in window pixels. */
export const helpTabRects = () => textTabRects(TABS, top)

/** The window's pixels: title bar, the pages' tabs, the box, each rule's icon beside its first line. */
export const helpPixels = (page: HelpPage = 'coding'): string[][] => {
  const body = canvas(WINDOW_W, helpHeight() - top)
  tabGround(body, TABS, PAGES.indexOf(page), 0)
  fill(body, 2, TABS_H, WINDOW_W - 4, 1, SURFACE.line)
  const c = windowPixels(CHROME, body.px)
  const box = helpOverlay(page).find(b => b.role === 'about')!
  drawBox(c, frameOf(box))
  HELP_PAGES[page].rows.forEach((r, i) => {
    if (r.icon !== undefined) mark(c, MARK[r.icon], ICON_X, 2 * (box.y + 1 + HEAD_ROWS + i * RULE_ROWS))
  })
  return c.px
}

/** What a gesture does: a click on the close box closes the window, on a tab shows its page; anything else, nothing. */
export const helpGesture = (gesture: Gesture): HelpPage | 'close' | undefined => {
  if (gesture.type === 'drag') return undefined
  const from = pixel(gesture.from)
  const at = pixel(gesture.at)
  if (Math.max(Math.abs(at.x - from.x), Math.abs(at.y - from.y)) >= CLICK_SLOP) return undefined
  if (isInside(at, ...CLOSE_BOX)) return 'close'
  const tab = helpTabRects().findIndex(r => isInside(at, r.x, r.y, r.w, r.h))
  return tab >= 0 ? PAGES[tab] : undefined
}
