// The dashboard strip under the map, all in pixels: the hero's portrait, the HP and XP bars with their numbers, the
// portal, the belt, and a line of gold, depth and the running effects.
import type { Game } from '../types'
import { xpToLevel } from './balance'
import { depthMod } from './game'
import type { DepthMod } from './game'
import { BELT_SLOT_W, GRID, SLOT, SLOT_BG, art, canvas, canvasCells, digits, fill, frame, put } from './canvas'
import type { Canvas } from './canvas'
import { bar } from './pieces'
import { CONSUMABLE_ICONS } from './icons'
import { PAL, PX, TOWN_THING_ART, heroArt, textMask } from './pixelart'

export const PORTRAIT = SLOT
/** The top row beside the portrait: two lines of 5 px text a pixel apart, the bars centered on them. */
export const HEART_X = PORTRAIT + 3
export const BAR_X = HEART_X + 7
export const HP_Y = 1
export const HP_H = 3
export const LINE2_Y = 6
export const XP_Y = LINE2_Y + 2
/** Where the belt's row starts, under the top row. */
export const BELT_BELOW_Y = 14
/** Gold, depth and the effects, on a line under the belt. */
export const SIDE_LINE_Y = BELT_BELOW_Y + SLOT + 2
/** Belt slots share their frame lines. */
export const SLOT_STEP = BELT_SLOT_W - 1

/** Each tone set is a bar's lit top, base and shaded bottom. Healthy above 70%, hurt down to 40%, critical below. */
export const HP_TONES = {
  healthy: ['#5ccf6a', '#2e9a3e', '#1f6e2b'],
  hurt: ['#f0c04a', '#c9971e', '#8e6a12'],
  critical: ['#f06a5a', '#c0392b', '#8a231a'],
} as const
export const hpTones = (share: number) => (share <= 0.4 ? HP_TONES.critical : share <= 0.7 ? HP_TONES.hurt : HP_TONES.healthy)
export const HP_EMPTY = '#1e2420'
export const XP_FILL = '#e0b84a'
export const XP_EMPTY = '#2a2618'
export const NUM_INK = '#e8e4dc'
export const LEVEL_INK = '#8a8494'
export const GOLD_INK = '#ffd34d'
/** The + after the level while stat points wait to be spent. */
export const POINTS_INK = '#5ccf6a'

/** Small 5 by 5 marks: a heart for HP, a star for XP, a coin for gold, steps for depth, one per effect, a crystal ball for a fortune. */
export const MARK: Readonly<Record<'heart' | 'xp' | 'coin' | 'stairs' | 'regen' | 'ward' | 'fury' | 'fortune' | DepthMod, readonly string[]>> = {
  heart: ['.r.r.', 'rwrrr', 'rrrrr', '.rrr.', '..r..'],
  xp: ['..x..', '.xXx.', 'xXXXx', '.xXx.', '..x..'],
  coin: ['.yyy.', 'yYyyy', 'yYyyy', 'yyyyo', '.yoo.'],
  stairs: ['....s', '...ss', '..sss', '.ssss', 'sssss'],
  regen: ['..g..', '..g..', 'ggggg', '..g..', '..g..'],
  ward: ['bbbbb', 'bBbbb', 'bBbbb', '.bbb.', '..b..'],
  fury: ['..f..', '.ff..', '.fFf.', 'fFFff', '.fff.'],
  fortune: ['.ccc.', 'cCccc', 'ccccc', '.ccc.', 'nnnnn'],
  gloom: ['.mm..', 'mm...', 'mm...', 'mm...', '.mm..'],
  horde: ['h.h.h', 'h.h.h', '.....', 'hhhhh', 'hhhhh'],
  den: ['y.y.y', 'yyyyy', 'yYyYy', 'yyyyy', '.....'],
  barren: ['..s..', '.s.s.', 's...s', 's...s', '.sss.'],
  bloodlust: ['..r..', '.rrr.', 'rrwrr', 'rrrrr', '.rrr.'],
  hoard: ['.yyy.', 'yYYYy', '.....', '.yyy.', 'yYYYy'],
}
export const MARK_INK: Readonly<Record<string, string>> = {
  r: '#e04a5a', w: '#ffb0b8', y: '#ffd34d', Y: '#fff2a8', o: '#b08a1e', s: '#9a9aa4', g: '#5ccf6a', b: '#7fe3ff', B: '#d8f8ff', f: '#f06a5a', F: '#ffd34d', x: '#e0b84a', X: '#fff2a8', c: '#8a6cf0', C: '#e4dcff', n: '#6b6258', m: '#a88ae0', h: '#e08a5a',
}
/** The fortune in force, by its initial beside the crystal ball. */
const FORTUNE_INITIAL: Readonly<Record<NonNullable<Game['fortune']>['kind'], string>> = { luck: 'L', riches: 'R', insight: 'I' }
export const mark = (c: Canvas, rows: readonly string[], x: number, y: number) =>
  rows.forEach((row, dy) => [...row].forEach((k, dx) => k !== '.' && put(c, x + dx, y + dy, MARK_INK[k] ?? '#ff00ff')))
export const textW = (text: string) => textMask(text)[0]?.length ?? 0
/** Plain pixel text, no outline, its top-left corner at x, y. */
const label = (c: Canvas, text: string, x: number, y: number, ink: string) =>
  textMask(text).forEach((row, dy) => [...row].forEach((k, dx) => k === '#' && put(c, x + dx, y + dy, ink)))

/** The belt's five slots, sharing their frame lines. */
export const BELT_W = 5 * SLOT_STEP + 1

/** The strip's height at any width: the top row, the belt, the side line. */
export const contentLayout = (_width: number) => ({ height: SIDE_LINE_Y + 6 })

/** The portal slot: flush right in the top row. */
export const portalSlotX = (width: number) => width - SLOT

/**
 * The bars' length and where their numbers go: the numbers keep room for full HP and a level with its +, so the bars
 * hold still as the numbers change.
 */
export const barsLayout = (g: Game, width: number) => {
  const numW = Math.max(textW(`${g.maxHp}/${g.maxHp}`), textW(`LV${g.level}+`))
  const barW = portalSlotX(width) - 3 - numW - 2 - BAR_X
  return { barW, numX: BAR_X + barW + 2 }
}

/** The iron frame's thickness, and how far in the contents sit: the frame and a pixel of room. */
export const FRAME = 3
export const INSET = FRAME + 1

/** The framed strip at `width`: its contents' layout, `2 * INSET` narrower, and the whole height with the frame. */
export const hudLayout = (width: number) => {
  const inner = contentLayout(width - 2 * INSET)
  return { ...inner, height: inner.height + 2 * INSET }
}

/** Where belt slot `i` starts: from the left edge of the belt's row. */
export const beltSlotX = (_width: number, i: number) => i * SLOT_STEP

const PORTAL_SHUT = '#2e3440'

/** The top row: heart, HP bar and HP; under them a star, the XP bar and the level, a green + after it while points wait. */
const bars = (c: Canvas, g: Game, width: number) => {
  const { barW, numX } = barsLayout(g, width)
  mark(c, MARK.heart, HEART_X, 0)
  mark(c, MARK.xp, HEART_X, LINE2_Y)
  const share = Math.max(0, g.hp) / g.maxHp
  bar(c, BAR_X, HP_Y, barW, HP_H, share, hpTones(share), HP_EMPTY)
  label(c, `${Math.max(0, g.hp)}/${g.maxHp}`, numX, 0, NUM_INK)
  bar(c, BAR_X, XP_Y, barW, 1, g.xp / xpToLevel(g.level), [XP_FILL, XP_FILL, XP_FILL], XP_EMPTY)
  label(c, `LV${g.level}`, numX, LINE2_Y, LEVEL_INK)
  if (g.points > 0) label(c, '+', numX + textW(`LV${g.level}`) + 1, LINE2_Y, POINTS_INK)
}

const EFFECTS = ['fury', 'ward', 'regen'] as const

/** Gold and depth from the left; the running effects from the right, each left out once it would reach the depth. */
const sideLine = (c: Canvas, g: Game) => {
  const gold = String(g.gold)
  mark(c, MARK.coin, 0, SIDE_LINE_Y)
  label(c, gold, 7, SIDE_LINE_Y, GOLD_INK)
  const x = 7 + textW(gold) + 5
  const depth = g.where === 'town' ? 'TOWN' : String(g.depth)
  mark(c, MARK.stairs, x, SIDE_LINE_Y)
  label(c, depth, x + 7, SIDE_LINE_Y, NUM_INK)
  // The depth's twist, if it has one, right after its number.
  const mod = g.where === 'dungeon' ? depthMod(g.world, g.depth) : undefined
  if (mod !== undefined) mark(c, MARK[mod], x + 7 + textW(depth) + 2, SIDE_LINE_Y)
  const depthEnd = x + 7 + textW(depth) + (mod === undefined ? 0 : 7)
  let right = c.w
  if (g.fortune !== null) {
    const n = FORTUNE_INITIAL[g.fortune.kind]
    const left = right - (6 + textW(n))
    if (left >= depthEnd + 4) {
      mark(c, MARK.fortune, left, SIDE_LINE_Y)
      label(c, n, left + 6, SIDE_LINE_Y, NUM_INK)
      right = left - 4
    }
  }
  for (const key of EFFECTS) {
    if (g.effects[key] <= 0) continue
    const n = String(g.effects[key])
    const left = right - (6 + textW(n))
    if (left < depthEnd + 4) break
    mark(c, MARK[key], left, SIDE_LINE_Y)
    label(c, n, left + 6, SIDE_LINE_Y, NUM_INK)
    right = left - 4
  }
}

/** The strip, `width` pixels wide and as tall as `contentLayout` says. */
export const hudContent = (g: Game, width: number): Canvas => {
  const c = canvas(width, contentLayout(width).height)
  fill(c, 1, 1, PX, PX, SLOT_BG)
  frame(c, 0, 0, PORTRAIT, PORTRAIT, GRID)
  art(c, heroArt(g), 1, 1)
  bars(c, g, width)
  const top = BELT_BELOW_Y
  g.belt.forEach((slot, i) => {
    const x = beltSlotX(width, i)
    frame(c, x, top, BELT_SLOT_W, SLOT, GRID)
    fill(c, x + 1, top + 1, BELT_SLOT_W - 2, PX, SLOT_BG)
    // A filled slot shows its icon with the count beside it.
    if (slot === null) return
    art(c, CONSUMABLE_ICONS[slot.kind], x + 1, top + 1)
    digits(c, String(slot.count), x + BELT_SLOT_W - 2, top + SLOT / 2 + 2)
  })
  // The portal, dark while a foe lives and it will not open.
  const px = portalSlotX(width)
  frame(c, px, 0, SLOT, SLOT, GRID)
  fill(c, px + 1, 1, PX, PX, SLOT_BG)
  const isShut = g.where !== 'town' && g.foe !== null
  TOWN_THING_ART.portal.forEach((row, dy) => [...row].forEach((k, dx) => {
    if (k !== '.') put(c, px + 1 + dx, 1 + dy, isShut ? PORTAL_SHUT : (PAL[k] ?? '#ff00ff'))
  }))
  sideLine(c, g)
  return c
}

const IRON_EDGE = '#0e0c12'
const IRON_INNER = '#1a1820'
const IRON_LIT = '#5a5f6b'
const IRON_SHADE = '#3a3e48'
const RIVET = '#c8ccd4'
/** Rivets along the frame, this many pixels apart. */
const RIVET_STEP = 12

/** The iron frame's pixel at x, y of a `w` by `h` strip; undefined inside it. */
const ironAt = (x: number, y: number, w: number, h: number) => {
  const sides = { top: y, left: x, bottom: h - 1 - y, right: w - 1 - x }
  const d = Math.min(sides.top, sides.left, sides.bottom, sides.right)
  if (d >= FRAME) return undefined
  if (d === 0) return IRON_EDGE
  if (d === FRAME - 1) return IRON_INNER
  const isLit = d === sides.top || d === sides.left
  const along = d === sides.top || d === sides.bottom ? x : y
  if (along % RIVET_STEP === RIVET_STEP / 2) return RIVET
  return isLit ? IRON_LIT : IRON_SHADE
}

/** The strip in its iron frame: `width` pixels across, the contents INSET from each edge. */
export const hudPixels = (g: Game, width: number): Canvas => {
  const inner = hudContent(g, width - 2 * INSET)
  const h = inner.h + 2 * INSET
  const c = canvas(width, h)
  for (let y = 0; y < h; y += 1) for (let x = 0; x < width; x += 1) {
    const iron = ironAt(x, y, width, h)
    if (iron !== undefined) put(c, x, y, iron)
  }
  inner.px.forEach((row, y) => row.forEach((p, x) => put(c, INSET + x, INSET + y, p)))
  return c
}

export const hudCells = (g: Game, width: number) => canvasCells(hudPixels(g, width))

/** What a click on the strip does: `x`, `y` in cells of the strip (a cell is one pixel across, two down). */
export const hudHit = (width: number, click: { x: number; y: number }): { kind: 'panel'; panel: 'bag' | 'sheet' } | { kind: 'use'; slot: number } | { kind: 'portal' } | undefined => {
  // Clicks land on the framed strip; the contents start INSET in.
  const px = Math.floor(click.x) - INSET
  const py = Math.floor(click.y * 2) - INSET
  width -= 2 * INSET
  if (px < 0 || py < 0) return undefined
  if (px < PORTRAIT && py < PORTRAIT) return { kind: 'panel', panel: 'bag' }
  if (px >= portalSlotX(width) && px < width && py < SLOT) return { kind: 'portal' }
  // The XP bar's line, the level at its end: the character sheet.
  if (px >= HEART_X && px < portalSlotX(width) && py >= LINE2_Y && py < LINE2_Y + 5) return { kind: 'panel', panel: 'sheet' }
  if (py < BELT_BELOW_Y || py >= BELT_BELOW_Y + SLOT) return undefined
  for (let slot = 0; slot < 5; slot += 1) {
    const x = beltSlotX(width, slot)
    if (px >= x && px < x + BELT_SLOT_W) return { kind: 'use', slot }
  }
  return undefined
}
