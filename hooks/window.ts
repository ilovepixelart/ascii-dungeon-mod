// The pixel window every menu is drawn in: the title bar (title or tabs, gold, close box), the body below,
// and text boxes laid over it where they hide the least. Pure: a window says what it holds, this draws and places it.
import type { Run } from './game'
import { GRID, art, canvas, fill, frame, put } from './canvas'
import type { Canvas } from './canvas'
import { textMask } from './pixelart'
import type { Pos } from './map'
import { coin, mix } from './pieces'
import { GLOW } from './ui/glow'
import { INK, SURFACE } from './ui/tokens'

/** Every window is this many pixels (and columns) wide: one pane width shows them all, or none. */
export const WINDOW_W = 105
/** The title bar's height. */
export const HEAD_H = 11
/** Where a window's body starts: just under the title bar, on an even row so text boxes stay on whole cells. */
export const WINDOW_TOP = HEAD_H + 3
export const TITLE_X = 3
export const TITLE_Y = 3
export const TITLE_INK = INK.text
export const LABEL_INK = INK.dim
const HEAD_BG = SURFACE.titleBar
const GOLD_INK = INK.gold
/** The gold this far left of the window's right edge. */
const GOLD_FROM_RIGHT = 41

/** The close box (x, y, w, h) at the title bar's right end of a window `width` wide: 7 px square, two pixels from the
 * edge, centred in the bar; its X 3 px across with a pixel of room round it. */
export const closeBoxOf = (width: number) => [width - 9, 2, 7, 7] as const
export const CLOSE_BOX = closeBoxOf(WINDOW_W)
export const CLOSE_INK = INK.danger
const CLOSE_BG = SURFACE.closeGround
const CLOSE_EDGE = SURFACE.frame
/** A text box's fill: the click layer writes its text on the same color, inside the frame. */
export const POPOVER_BG = SURFACE.popover

/** A rectangle in window pixels; `look` how a hover lights it: by default an outline and a tint, `fill` a tint alone,
 * for a place with no frame of its own (a tab). */
export type Rect = { x: number; y: number; w: number; h: number; look?: 'fill' }
/** A tab in a window's title bar: its label, and a gold mark beside it while what it opens waits on the player. */
export type Tab = { label: string; isMarked?: boolean }
/** What a window shows around its body: its title (or, with tabs, the tabs in its place, `chosen` the one shown, their
 * labels in terminal text), and the gold when it matters there. */
export type Chrome = { title: string; gold?: number; tabs?: { items: readonly Tab[]; chosen: number } }

export const isInside = (p: Pos, x: number, y: number, w: number, h: number) => p.x >= x && p.x < x + w && p.y >= y && p.y < y + h

const TAB_BG = SURFACE.tab
/** A row of tabs' height: the title bar's, less its line. */
export const TABS_H = HEAD_H - 1

/** A row of tabs labelled in terminal text (a column a letter, where the pixel font takes four), its top at y (the
 * title bar's, 0, unless said; an even row, as text sits on whole cells): each tab's place in window pixels, its label
 * with a column of room each side, a column between tabs. What a click on one covers. */
export const textTabRects = (tabs: readonly Tab[], y = 0): Rect[] => {
  let x = TITLE_X - 1
  return tabs.map(t => {
    const r = { x, y, w: t.label.length + 2, h: TABS_H, look: 'fill' as const }
    x += r.w + 1
    return r
  })
}

/** A row of tabs at y in pixels: the chosen one's lighter ground and gold rule, a marked one's gold dot at its top
 * right; their labels are `textTabsBox`'s. In the title bar, or a window's pages in its body. */
export const tabGround = (c: Canvas, items: readonly Tab[], chosen: number, y = 0) => {
  textTabRects(items, y).forEach((r, i) => {
    if (i === chosen) {
      fill(c, r.x, r.y, r.w, r.h, TAB_BG)
      fill(c, r.x, r.y + r.h - 1, r.w, 1, GOLD_INK)
    }
    if (items[i]!.isMarked === true) fill(c, r.x + r.w - 2, r.y + 1, 2, 2, GOLD_INK)
  })
}

/** A row of tabs' labels at y as text boxes, a box a label over its letters alone (the tab's edge columns stay
 * pixels, whole under a hover's outline), on `ground`: the chosen one bright on its tab's, the others dim. One row, the
 * third of the tab's five, as the frame of a box takes the row above. */
export const textTabBoxes = (items: readonly Tab[], chosen: number, y = 0, ground: string = HEAD_BG): OverlayBox<'tabs'>[] =>
  textTabRects(items, y).map((r, i) => {
    const isOn = i === chosen
    const bg = isOn ? TAB_BG : ground
    const label = items[i]!.label
    return { role: 'tabs', x: r.x, y: y / 2 + 1, w: label.length + 2, h: 3, border: bg, bg, pad: 0, lines: [[{ text: label, color: isOn ? TITLE_INK : LABEL_INK, bold: isOn }]] }
  })

/** Gold as the title bar writes it: in full, thousands set apart by commas. */
export const goldText = (gold: number) => String(gold).replace(/\B(?=(\d{3})+(?!\d))/g, ',')

/** Where the title bar's gold starts, its coin's left: clear of the title or tabs in a narrow window. */
const goldX = (chrome: Chrome, width: number) => {
  const tabs = chrome.tabs === undefined ? undefined : textTabRects(chrome.tabs.items).at(-1)
  const headEnd = tabs === undefined ? TITLE_X + chrome.title.length : tabs.x + tabs.w
  return Math.max(headEnd + 5, width - GOLD_FROM_RIGHT)
}

/** The text a window's title bar holds, as boxes over it, on the bar's ground: its title, or its tabs' labels (role
 * `title` either way); and its gold (`gold`), after the coin `windowPixels` draws. */
const chromeText = (chrome: Chrome, width: number): OverlayBox[] => {
  const head: OverlayBox[] = chrome.tabs !== undefined
    ? textTabBoxes(chrome.tabs.items, chrome.tabs.chosen).map(b => ({ ...b, role: 'title' }))
    : [{ role: 'title', x: TITLE_X - 1, y: 1, w: chrome.title.length + 2, h: 3, border: HEAD_BG, bg: HEAD_BG, pad: 0, lines: [[{ text: chrome.title, color: TITLE_INK, bold: true }]] }]
  if (chrome.gold === undefined) return head
  const text = goldText(chrome.gold)
  return [...head, { role: 'gold', x: goldX(chrome, width) + 5, y: 1, w: text.length + 2, h: 3, border: HEAD_BG, bg: HEAD_BG, pad: 0, lines: [[{ text, color: GOLD_INK, bold: true }]] }]
}

/** Each window's title-bar text, by the pixels `windowPixels` drew it on: the pane and the previews write it over
 * whatever a window hands them, so no window lists it among its own boxes. */
const chromes = new WeakMap<readonly (readonly string[])[], OverlayBox[]>()

/** The title-bar text of the window drawn on `px`; none for pixels `windowPixels` did not draw. */
export const chromeBoxes = (px: readonly (readonly string[])[]): OverlayBox[] => chromes.get(px) ?? []

/**
 * A color as the terminal's Raster paints it: each channel at 4 bits, the nearest multiple of 17 (the engine rounds
 * every raster color so; text it paints as given). Text written over pixels takes this ground, or it shows as a band.
 */
export const painted = (hex: string) =>
  `#${[1, 3, 5].map(i => (Math.round(Number.parseInt(hex.slice(i, i + 2), 16) / 17) * 17).toString(16).padStart(2, '0')).join('')}`

/**
 * Text boxes as the click layer writes them over pixels: every ground the color the pixels under it are painted (a box
 * with none, a text box's fill); a box whose text lies inside `lit`, the place the hover lights, on that place's lit
 * ground, as the glow lights the pixels round it.
 */
export const onPixels = (boxes: readonly OverlayBox[], lit?: Rect): OverlayBox[] =>
  boxes.map(b => {
    const isLit = lit !== undefined && b.x + 1 >= lit.x && b.x + b.w - 1 <= lit.x + lit.w && (b.y + 1) * 2 >= lit.y && (b.y + b.h - 1) * 2 <= lit.y + lit.h
    const ground = (hex: string) => painted(isLit ? mix(hex, INK.focus, lit.look === 'fill' ? GLOW.fill : GLOW.inside) : hex)
    // A lit tab's label is written bright, as the chosen one's.
    const ink = (r: Run) => (isLit && lit.look === 'fill' ? { ...r, color: TITLE_INK } : r)
    return { ...b, bg: ground(b.bg ?? POPOVER_BG), lines: b.lines.map(l => l.map(r => ink(r.bg === undefined ? r : { ...r, bg: ground(r.bg) }))) }
  })

/** Words in the pixel font, their top-left at x, y. */
export const word = (c: Canvas, text: string, x: number, y: number, ink: string) =>
  textMask(text).forEach((row, dy) => [...row].forEach((k, dx) => k === '#' && put(c, x + dx, y + dy, ink)))

/** Text as the font can draw it: without the full stops and commas it lacks. */
export const drawable = (text: string) => text.replace(/[.,]/g, '')

/** A window: its title bar, then the body's pixel rows laid in at WINDOW_TOP, as tall as the body. The title bar's
 * words are terminal text over it (`chromeBoxes`); its pixels are the ground, a chosen tab's, the coin, the close box. */
export const windowPixels = (chrome: Chrome, body: readonly (readonly string[])[], width = WINDOW_W): Canvas => {
  const top = WINDOW_TOP
  const c = canvas(width, top + body.length)
  fill(c, 0, 0, width, HEAD_H - 1, HEAD_BG)
  fill(c, 0, HEAD_H - 1, width, 1, GRID)
  if (chrome.tabs !== undefined) tabGround(c, chrome.tabs.items, chrome.tabs.chosen)
  if (chrome.gold !== undefined) coin(c, goldX(chrome, width), TITLE_Y)
  const [cx, cy, cw, ch] = closeBoxOf(width)
  fill(c, cx, cy, cw, ch, CLOSE_BG)
  frame(c, cx, cy, cw, ch, CLOSE_EDGE)
  art(c, ['w.w', '.w.', 'w.w'], cx + 2, cy + 2, CLOSE_INK)
  body.forEach((row, y) => row.forEach((p, x) => put(c, x, top + y, p)))
  chromes.set(c.px, chromeText(chrome, width))
  return c
}

/** A text box over the window, in cells from its top-left (one pixel across, two down), and its frame's color. */
/** A text box over pixels: its place in cells, its frame's color, its lines; `bg`, a ground of its own under the text; `pad`, cells of room each side of the text (1 unless said). */
export type OverlayBox<Role extends string = string> = { role: Role; x: number; y: number; w: number; h: number; border: string; lines: Run[][]; bg?: string; pad?: number }

/** A text box's frame in pixels: a 1 px frame in its color round the dark fill, on the cells the box covers. */
export const drawBox = (c: Canvas, b: Pick<OverlayBox, 'x' | 'y' | 'w' | 'h' | 'border'>) => {
  fill(c, b.x, b.y * 2, b.w, b.h * 2, POPOVER_BG)
  frame(c, b.x, b.y * 2, b.w, b.h * 2, b.border)
}

const textWidth = (line: Run[]) => line.reduce((n, r) => n + r.text.length, 0)

/** A box sized to its lines: two cells of frame and padding each side, one row of frame above and below. */
export const boxShape = <Role extends string>(role: Role, lines: Run[][], border: string): OverlayBox<Role> =>
  ({ role, x: 0, y: 0, w: Math.max(...lines.map(textWidth)) + 4, h: lines.length + 2, border, lines })

/** What would be hidden under the window: rectangles, each pixel of one weighing `weight`. */
export type Weighted = { rect: Rect; weight: number }

/** What a box would hide, as a summed-area table over the window's cells; the result is the weight under a box. */
export const coverage = (rows: number, weighted: readonly Weighted[], width = WINDOW_W) => {
  const weight = new Float64Array(width * rows)
  for (const { rect: r, weight: k } of weighted) {
    for (let py = Math.max(0, r.y); py < Math.min(rows * 2, r.y + r.h); py += 1) {
      for (let px = Math.max(0, r.x); px < Math.min(width, r.x + r.w); px += 1) {
        const at = Math.floor(py / 2) * width + px
        weight[at] = weight[at]! + k
      }
    }
  }
  const W = width + 1
  const sum = new Float64Array(W * (rows + 1))
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < width; x += 1) sum[(y + 1) * W + x + 1] = weight[y * width + x]! + sum[y * W + x + 1]! + sum[(y + 1) * W + x]! - sum[y * W + x]!
  }
  const at = (x: number, y: number) => sum[y * W + x]!
  return (x: number, y: number, w: number, h: number) => at(x + w, y + h) - at(x, y + h) - at(x + w, y) + at(x, y)
}

/**
 * Where a box goes: of all the places it fits in the window's `rows` without overlapping `others`, the one hiding the
 * least, nearest `near` among those.
 */
export const place = (cost: ReturnType<typeof coverage>, rows: number, others: readonly OverlayBox[], near: Rect, w: number, h: number, width = WINDOW_W): Pos => {
  const cx = near.x + near.w / 2
  const cy = near.y + near.h / 2
  let best: { x: number; y: number; score: number } | null = null
  for (let y = 0; y + h <= rows; y += 1) {
    for (let x = 0; x + w <= width; x += 1) {
      if (others.some(o => x < o.x + o.w && o.x < x + w && y < o.y + o.h && o.y < y + h)) continue
      const away = Math.hypot(x + w / 2 - cx, (y + h / 2) * 2 - cy)
      const score = cost(x, y, w, h) * 1000 + away
      if (best === null || score < best.score) best = { x, y, score }
    }
  }
  return best ?? { x: 0, y: 0 }
}

/** A gesture in the click layer's cells, to the fraction: a drag still held, or a release (a click when it barely moved). */
export type Gesture = { type: 'drag'; from: Pos; at: Pos } | { type: 'release'; from: Pos; at: Pos; button: 'left' | 'middle' | 'right' }
/** Moves under this many pixels are a click, not a drag. */
export const CLICK_SLOP = 2
/** A point in cells as the window pixel under it. */
export const pixel = (p: Pos): Pos => ({ x: Math.floor(p.x), y: Math.floor(p.y * 2) })

/**
 * The clickable places whose middle no box over them covers: a click on a card or a menu lands on it, not on what it
 * covers, so what lies under one is not lit. `boxes` are the ones that take a click.
 */
export const uncovered = (hot: readonly Rect[], boxes: readonly OverlayBox[]): Rect[] =>
  hot.filter(r => !boxes.some(b => isInside({ x: r.x + Math.floor(r.w / 2) + 0.5, y: (r.y + Math.floor(r.h / 2)) / 2 }, b.x, b.y, b.w, b.h)))

/** Covering what a card is about costs this much against one pixel of anything else: it is never worth it. */
export const KEEP = 100000

/**
 * A card near what it is about, never on it, where it hides the least of what the window shows (`shown`); its menu,
 * when open, under it the same way. `rows` is the window's height in cells.
 */
export const cardWithMenu = <Role extends string>(rows: number, shown: readonly Weighted[], near: Rect, card: OverlayBox<Role>, menu?: OverlayBox<Role>, width = WINDOW_W, others: readonly OverlayBox[] = []): OverlayBox<Role>[] => {
  const cost = coverage(rows, [...shown, { rect: near, weight: KEEP }], width)
  const at = place(cost, rows, others, near, card.w, card.h, width)
  const placed = { ...card, x: at.x, y: at.y }
  if (menu === undefined) return [placed]
  const under = place(cost, rows, [...others, placed], { x: placed.x, y: (placed.y + placed.h) * 2, w: placed.w, h: 2 }, menu.w, menu.h, width)
  return [placed, { ...menu, x: under.x, y: under.y }]
}
