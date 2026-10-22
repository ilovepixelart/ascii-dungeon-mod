// The dashboard strip under the map, all in pixels: the hero's portrait, the HP and XP with their numbers, the settings
// and the portal, the belt, and a line of gold, depth and the running effects; a belt slot's menu of its tiers. From
// ORB_WIDTH_MIN the HP and XP are orbs at the strip's ends, each filled to its share with a rippling surface, the line
// of gold and depth in the top row; narrower, they are bars in the top row, the line beside the belt.
import type { Game } from '../types'
import { xpToLevel } from './balance'
import { depthMod } from './game'
import type { DepthMod } from './game'
import { BELT_SLOT_W, BG, GRID, SLOT, SLOT_BG, art, canvas, fill, frame, put } from './canvas'
import type { Canvas } from './canvas'
import { CURSOR, artLabel, barLabel, beltCounts, beltSlot, clearOf, flatBar, inkOn, mix } from './pieces'
import { TIERS, activeTier, nameOf } from './consumables'
import type { Tier } from './consumables'
import type { Action } from './game'
import { boxShape, drawBox, uncovered } from './window'
import { countText } from './names'
import type { Gesture, OverlayBox } from './window'
import { PAL, PX, TOWN_THING_ART, heroArt } from './pixelart'

export const PORTRAIT = SLOT
/** The top row beside the portrait: two lines of 5 px text a pixel apart, the bars centered on them. */
/** The marks stand a pixel past the portrait. */
export const HEART_X = PORTRAIT + 1
/** The bars start a pixel past their 5 px marks. */
export const BAR_X = HEART_X + 6
/** The marks' tops, and the bars on them, the marks' height: on odd rows of the strip, so each number fills a bar's middle. */
export const HEART_Y = 1
export const STAR_Y = 7
export const HP_Y = HEART_Y
export const HP_H = 4
export const LINE2_Y = 7
export const XP_Y = STAR_Y
/** Where the belt's row starts, under the top row. */
/** The belt's row: a pixel under the top row, whose star reaches a pixel below the portrait. */
export const BELT_BELOW_Y = SLOT + 2
/** Belt slots share their frame lines. */
export const SLOT_STEP = BELT_SLOT_W - 1
/** Gold, depth and the effects, on the belt's row past it: their 5 px marks on the slots' middle, so that their text's
 * row is a whole cell of the framed strip (its content INSET from the top). */
export const SIDE_LINE_Y = BELT_BELOW_Y + 3
export const SIDE_LINE_X = 5 * SLOT_STEP + 1 + 3

/** The orbs' sizes, across and down: the smallest, on the narrowest strip with orbs, and the largest, the strip's
 * height but a pixel of room above and below. Even, so an orb's middle rows are always the same two text rows. */
export const ORB_MIN = 16
export const ORB = 22
/** What lies between the orbs in the top row at its fullest: a pixel each side, the portrait, the gold and the depth
 * with its twist (31 px at six figures and depth 100), the settings and the portal. */
const BETWEEN_ORBS = 69
/** The narrowest strip (content pixels) with orbs: a 105-column pane, its orbs ORB_MIN across. */
export const ORB_WIDTH_MIN = BETWEEN_ORBS + 2 * ORB_MIN
export const hasOrbs = (width: number) => width >= ORB_WIDTH_MIN
/** An orb's size on a strip `width` wide: what the room beside the top row's parts allows, ORB_MIN to ORB. */
export const orbSize = (width: number) => Math.max(ORB_MIN, Math.min(ORB, 2 * Math.floor((width - BETWEEN_ORBS) / 4)))
/** An orb's top: centred down the strip. */
export const orbTop = (size: number) => (BELT_BELOW_Y + SLOT + 2 - size) / 2
/** Where the portrait and the belt start: a pixel past the HP orb, with orbs. */
export const stripLeft = (width: number) => (hasOrbs(width) ? orbSize(width) + 1 : 0)
/** The XP orb's left edge, flush right. */
export const xpOrbX = (width: number) => width - orbSize(width)
/** With orbs, the side line's marks in the top row past the portrait, their text on a whole cell. */
export const ORB_SIDE_Y = 3

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

/** Small marks, 5 across and 5 down (the heart and the star 4 down): a heart for HP, a star for XP, a coin for gold, steps for depth, one per effect, a crystal ball for a fortune. */
export const MARK: Readonly<Record<'heart' | 'xp' | 'coin' | 'stairs' | 'regen' | 'ward' | 'fury' | 'fortune' | DepthMod, readonly string[]>> = {
  // The heart and the star are 4 px tall, and so are their bars, side by side.
  heart: ['rr.rr', 'rwrrr', '.rrr.', '..r..'],
  xp: ['..x..', 'xXXXx', '.xXx.', '.x.x.'],
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

/** The belt's five slots, sharing their frame lines. */
export const BELT_W = 5 * SLOT_STEP + 1

/** The strip's height: the top row, then the belt and the side line beside it, two pixels of room under them, so the
 * framed strip is a whole number of cells. */
export const contentLayout = (_width: number) => ({ height: BELT_BELOW_Y + SLOT + 2 })

/** The portal slot: flush right in the top row, or a pixel short of the XP orb. */
export const portalSlotX = (width: number) => (hasOrbs(width) ? xpOrbX(width) - 1 : width) - SLOT
/** The settings slot: left of the portal, a pixel apart. */
export const settingsSlotX = (width: number) => portalSlotX(width) - SLOT - 1
/**
 * A gear, for settings, weighing as the portal does: six pixels across in its eight with a pixel of room all round,
 * eight teeth, its top half lit and its bottom half in shade, symmetric, a dark hole for its axle.
 */
const GEAR: readonly string[] = ['........', '.S.SS.S.', '..SSSS..', '.SSKKSS.', '.ssKKss.', '..ssss..', '.s.ss.s.', '........']
const GEAR_INK: Readonly<Record<string, string>> = { S: '#e4e8f0', s: '#a4acb8', K: '#141219' }

/** The bars' length: from after the marks to a pixel short of the settings slot; their numbers are text on them. */
export const barsLayout = (_g: Game, width: number) => {
  const barW = settingsSlotX(width) - 1 - BAR_X
  return { barW }
}

/** The iron frame's thickness, the riveted metal band alone, and how far in the contents sit: it and a pixel of room. */
export const FRAME = 1
export const INSET = FRAME + 1

/** The framed strip at `width`: its contents' layout, `2 * INSET` narrower, and the whole height with the frame. */
export const hudLayout = (width: number) => {
  const inner = contentLayout(width - 2 * INSET)
  return { ...inner, height: inner.height + 2 * INSET }
}

/** Where belt slot `i` starts: from the left edge of the belt's row, past the HP orb when there is one. */
export const beltSlotX = (width: number, i: number) => stripLeft(width) + i * SLOT_STEP

/** The side line's place in `width`: beside the belt, to the strip's end; with orbs, in the top row past the portrait,
 * up to a pixel short of the settings slot. */
export const sideLineAt = (width: number) =>
  hasOrbs(width)
    ? { x: stripLeft(width) + PORTRAIT + 3, y: ORB_SIDE_Y, end: settingsSlotX(width) - 1 }
    : { x: SIDE_LINE_X, y: SIDE_LINE_Y, end: width }

const PORTAL_SHUT = '#2e3440'

/** The top row: heart, HP bar and HP; under them a star, the XP bar and the level, a green + after it while points wait. */
const bars = (c: Canvas, g: Game, width: number) => {
  const { barW } = barsLayout(g, width)
  mark(c, MARK.heart, HEART_X, HEART_Y)
  mark(c, MARK.xp, HEART_X, STAR_Y)
  const share = Math.max(0, g.hp) / g.maxHp
  // One flat color, the tone's body: no lit top or shaded bottom.
  flatBar(c, BAR_X, HP_Y, barW, share, hpTones(share)[1], HP_EMPTY)
  flatBar(c, BAR_X, XP_Y, barW, g.xp / xpToLevel(g.level), XP_FILL, XP_EMPTY)
}

/** The ripple's phases, one every ORB_STEP_MS, round and round. */
export const ORB_PHASES = 8
export const ORB_STEP_MS = 200
export const orbPhase = (now: number) => Math.floor(now / ORB_STEP_MS) % ORB_PHASES
/** The orb's rows its numbers stand on, two text rows on its middle: the surface lies still across them, so their
 * ground holds. */
const stillTop = (size: number) => size / 2 - 2
const isStill = (size: number, y: number) => y >= stillTop(size) && y < stillTop(size) + 4
/** The XP orb's lit surface. */
export const XP_LIGHT = '#f0d070'
const RIM_LIT = '#5a5f6b'
const RIM_SHADE = '#3a3e48'
const GLOSS = '#ffffff'
/** A few pixels of light on the glass, high on the left, placed on the largest orb and scaled to the others. */
const GLOSS_AT: readonly (readonly [number, number])[] = [[5, 4], [6, 4], [5, 5], [4, 6]]

/** An orb's inks: its liquid, the liquid's lit surface, and the empty glass. */
type OrbInks = { liquid: string; surface: string; glass: string }
const hpShare = (g: Game) => Math.max(0, g.hp) / g.maxHp
const xpShare = (g: Game) => g.xp / xpToLevel(g.level)
const hpInks = (g: Game): OrbInks => ({ liquid: hpTones(hpShare(g))[1], surface: hpTones(hpShare(g))[0], glass: HP_EMPTY })
const XP_INKS: OrbInks = { liquid: XP_FILL, surface: XP_LIGHT, glass: XP_EMPTY }

/**
 * A `size` orb's pixel at x, y of its square, `share` full, the ripple at `phase`: undefined outside its round; its
 * rim, lit top left and shaded bottom right; the glass above the surface, the surface lit, the liquid under it. The
 * surface rests on row 1 + (1 - share) * (size - 2), a pixel up or down with the ripple but on its still rows.
 */
export const orbPixel = (size: number, x: number, y: number, share: number, phase: number, inks: OrbInks): string | undefined => {
  const centre = (size - 1) / 2
  const d = Math.hypot(x - centre, y - centre)
  if (d > size / 2) return undefined
  if (d > size / 2 - 1.5) return x + y < size - 1 ? RIM_LIT : RIM_SHADE
  const full = Math.max(0, Math.min(1, share))
  if (full === 0) return inks.glass
  const wave = isStill(size, y) ? 0 : Math.round(Math.sin((x / 7 + phase / ORB_PHASES) * 2 * Math.PI) * 0.9)
  const surface = Math.round(1 + (1 - full) * (size - 2)) + wave
  if (y < surface) return inks.glass
  return y === surface ? inks.surface : inks.liquid
}

/** A `size` orb drawn on `c` at x, centred down the strip, with the gloss on its glass. */
const orb = (c: Canvas, size: number, x: number, share: number, phase: number, inks: OrbInks) => {
  const top = orbTop(size)
  for (let dy = 0; dy < size; dy += 1) for (let dx = 0; dx < size; dx += 1) {
    const p = orbPixel(size, dx, dy, share, phase, inks)
    if (p !== undefined) put(c, x + dx, top + dy, p)
  }
  for (const [gx, gy] of GLOSS_AT) {
    const [dx, dy] = [Math.round((gx * size) / ORB), Math.round((gy * size) / ORB)]
    put(c, x + dx, top + dy, mix(c.px[top + dy]![x + dx]!, GLOSS, 0.45))
  }
}

/** The text row an orb's numbers start on, in the framed strip's cells: the first of its still rows, the same at every size. */
export const ORB_TEXT_ROW = (INSET + orbTop(ORB) + stillTop(ORB)) / 2

/** A line of text centred on a `size` orb at x (content pixels), on its text row `row` (0 or 1), each character on the
 * orb's two pixels under it as near as one ground shows them, in the ink that reads there. */
const orbLabel = (text: string, size: number, x: number, row: number, share: number, inks: OrbInks): OverlayBox<'label'> => {
  const x0 = Math.floor((size - text.length) / 2)
  const y = stillTop(size) + 2 * row
  const runs = [...text].map((ch, i) => {
    const [top, bottom] = [y, y + 1].map(py => orbPixel(size, x0 + i, py, share, 0, inks) ?? BG) as [string, string]
    const ground = top === bottom ? top : mix(top, bottom, 0.5)
    return { text: ch, color: inkOn(ground), bg: ground, bold: true }
  })
  return { role: 'label', x: INSET + x + x0 - 1, y: ORB_TEXT_ROW + row - 1, w: text.length + 2, h: 3, border: runs[0]!.bg, bg: runs[0]!.bg, pad: 0, lines: [runs] }
}

/** A count of `of` as an orb writes it: in full while it fits inside a `size` orb's middle, else as a percent. */
const fitted = (n: number, of: number, size: number) => {
  const full = `${n}/${of}`
  return full.length <= size - 4 ? full : `${Math.floor((100 * n) / of)}%`
}

/** Each orb's numbers on it, in the framed strip's cells: the HP over HP; the XP over the level, a + while points wait. */
const orbLabels = (g: Game, width: number): OverlayBox<'label'>[] => {
  const size = orbSize(width)
  const xpX = xpOrbX(width)
  return [
    orbLabel(fitted(Math.max(0, g.hp), g.maxHp, size), size, 0, 0, hpShare(g), hpInks(g)),
    orbLabel('HP', size, 0, 1, hpShare(g), hpInks(g)),
    orbLabel(fitted(g.xp, xpToLevel(g.level), size), size, xpX, 0, xpShare(g), XP_INKS),
    orbLabel(`LV${g.level}${g.points > 0 ? '+' : ''}`, size, xpX, 1, xpShare(g), XP_INKS),
  ]
}

const EFFECTS = ['fury', 'ward', 'regen'] as const

/** A mark's width, and the cell between a mark and its number. */
const MARK_W = 5
const MARK_GAP = 1

/** The side line, left to right in the content's pixels from `line.x` to `line.end`: each mark, and each number as text
 * a cell a character. Gold (in full, thousands set apart, as the title bar writes it) and depth from the left; the
 * running effects from the right, each left out once it would reach the depth. */
const sideLineParts = (g: Game, line: { x: number; end: number }) => {
  const marks: { rows: readonly string[]; x: number }[] = []
  const words: { text: string; x: number; ink: string }[] = []
  const markThen = (rows: readonly string[], x: number, text: string, ink: string) => {
    marks.push({ rows, x })
    words.push({ text, x: x + MARK_W + MARK_GAP, ink })
    return x + MARK_W + MARK_GAP + text.length
  }
  const goldEnd = markThen(MARK.coin, line.x, countText(g.gold), GOLD_INK)
  let depthEnd = markThen(MARK.stairs, goldEnd + 3, g.where === 'town' ? 'TOWN' : String(g.depth), NUM_INK)
  // The depth's twist, if it has one, right after its number.
  const mod = g.where === 'dungeon' ? depthMod(g.world, g.depth) : undefined
  if (mod !== undefined) {
    marks.push({ rows: MARK[mod], x: depthEnd + 2 })
    depthEnd += 2 + MARK_W
  }
  let right = line.end
  const fromRight = (rows: readonly string[], text: string) => {
    const left = right - (MARK_W + MARK_GAP + text.length)
    if (left < depthEnd + 3) return false
    markThen(rows, left, text, NUM_INK)
    right = left - 3
    return true
  }
  if (g.fortune !== null) fromRight(MARK.fortune, FORTUNE_INITIAL[g.fortune.kind])
  for (const key of EFFECTS) if (g.effects[key] > 0 && !fromRight(MARK[key], String(g.effects[key]))) break
  return { marks, words }
}

const sideLine = (c: Canvas, g: Game) => {
  const line = sideLineAt(c.w)
  for (const m of sideLineParts(g, line).marks) mark(c, m.rows, m.x, line.y)
}

/** The strip, `width` pixels wide and as tall as `contentLayout` says; with orbs, their ripple at `phase`. */
export const hudContent = (g: Game, width: number, phase = 0): Canvas => {
  const c = canvas(width, contentLayout(width).height)
  const left = stripLeft(width)
  fill(c, left + 1, 1, PX, PX, SLOT_BG)
  frame(c, left, 0, PORTRAIT, PORTRAIT, GRID)
  art(c, heroArt(g), left + 1, 1)
  if (hasOrbs(width)) {
    orb(c, orbSize(width), 0, hpShare(g), phase, hpInks(g))
    orb(c, orbSize(width), xpOrbX(width), xpShare(g), phase, XP_INKS)
  } else bars(c, g, width)
  const top = BELT_BELOW_Y
  g.belt.forEach((slot, i) => beltSlot(c, slot, beltSlotX(width, i), top))
  // The portal, dark while a foe lives and it will not open.
  const px = portalSlotX(width)
  frame(c, px, 0, SLOT, SLOT, GRID)
  fill(c, px + 1, 1, PX, PX, SLOT_BG)
  const isShut = g.where !== 'town' && g.foe !== null
  TOWN_THING_ART.portal.forEach((row, dy) => [...row].forEach((k, dx) => {
    // Shut, its inside goes grey; its dark outline stays as it is, so the portal keeps its size.
    if (k !== '.') put(c, px + 1 + dx, 1 + dy, isShut && k !== 'K' ? PORTAL_SHUT : (PAL[k] ?? '#ff00ff'))
  }))
  const sx = settingsSlotX(width)
  frame(c, sx, 0, SLOT, SLOT, GRID)
  fill(c, sx + 1, 1, PX, PX, SLOT_BG)
  GEAR.forEach((row, dy) => [...row].forEach((k, dx) => k !== '.' && put(c, sx + 1 + dx, 1 + dy, GEAR_INK[k] ?? '#ff00ff')))
  sideLine(c, g)
  return c
}

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
  const isLit = d === sides.top || d === sides.left
  const along = d === sides.top || d === sides.bottom ? x : y
  if (along % RIVET_STEP === RIVET_STEP / 2) return RIVET
  return isLit ? IRON_LIT : IRON_SHADE
}

/** The strip in its iron frame: `width` pixels across, the contents INSET from each edge. */
export const hudPixels = (g: Game, width: number, boxes: readonly OverlayBox[] = [], phase = 0): Canvas => {
  const inner = hudContent(g, width - 2 * INSET, phase)
  const h = inner.h + 2 * INSET
  const c = canvas(width, h)
  for (let y = 0; y < h; y += 1) for (let x = 0; x < width; x += 1) {
    const iron = ironAt(x, y, width, h)
    if (iron !== undefined) put(c, x, y, iron)
  }
  inner.px.forEach((row, y) => row.forEach((p, x) => put(c, INSET + x, INSET + y, p)))
  for (const b of boxes) drawBox(c, b)
  return c
}


/** What a click on the strip does: `x`, `y` in cells of the strip (a cell is one pixel across, two down). */
export const hudHit = (width: number, click: { x: number; y: number }): { kind: 'panel'; panel: 'bag' | 'sheet' | 'settings' } | { kind: 'use'; slot: number } | { kind: 'portal' } | undefined => {
  // Clicks land on the framed strip; the contents start INSET in.
  const px = Math.floor(click.x) - INSET
  const py = Math.floor(click.y * 2) - INSET
  width -= 2 * INSET
  if (px < 0 || py < 0) return undefined
  return topHit(px, py, width) ?? beltHit(px, py, width)
}

type HudAction = ReturnType<typeof hudHit>

/** The strip's top: the portrait for the bag, the portal, the gear for settings; the XP bar's line, or either orb, for
 * the character sheet. */
const topHit = (px: number, py: number, width: number): HudAction => {
  const inside = (x: number, y: number, w: number, h: number) => px >= x && px < x + w && py >= y && py < y + h
  const size = orbSize(width)
  if (hasOrbs(width) && (inside(0, orbTop(size), size, size) || inside(xpOrbX(width), orbTop(size), size, size))) return { kind: 'panel', panel: 'sheet' }
  if (inside(stripLeft(width), 0, PORTRAIT, PORTRAIT)) return { kind: 'panel', panel: 'bag' }
  if (inside(portalSlotX(width), 0, SLOT, SLOT)) return { kind: 'portal' }
  if (inside(settingsSlotX(width), 0, SLOT, SLOT)) return { kind: 'panel', panel: 'settings' }
  if (!hasOrbs(width) && inside(HEART_X, LINE2_Y, settingsSlotX(width) - HEART_X, HP_H)) return { kind: 'panel', panel: 'sheet' }
  return undefined
}

/** A belt slot, used. */
const beltHit = (px: number, py: number, width: number): HudAction => {
  if (py < BELT_BELOW_Y || py >= BELT_BELOW_Y + SLOT) return undefined
  for (let slot = 0; slot < 5; slot += 1) {
    const x = beltSlotX(width, slot)
    if (px >= x && px < x + BELT_SLOT_W) return { kind: 'use', slot }
  }
  return undefined
}

/** What a click on the strip acts on, in its pixels, as `hudHit` reads them: the portrait, the XP line or the orbs, the
 * gear, the portal while it can open, each belt slot holding something, and the side line, which opens the log. What
 * lies under an open belt menu (among `boxes`) is not lit: a click there lands on the menu. */
export const hudHot = (g: Game, width: number, boxes: readonly OverlayBox[] = []) => {
  const w = width - 2 * INSET
  const at = (x: number, y: number, rw: number, rh: number) => ({ x: INSET + x, y: INSET + y, w: rw, h: rh })
  const line = sideLineAt(w)
  return uncovered([
    at(stripLeft(w), 0, PORTRAIT, PORTRAIT),
    ...(hasOrbs(w) ? [0, xpOrbX(w)].map(x => at(x, orbTop(orbSize(w)), orbSize(w), orbSize(w))) : [at(HEART_X, LINE2_Y, settingsSlotX(w) - HEART_X, HP_H)]),
    at(settingsSlotX(w), 0, SLOT, SLOT),
    ...(g.foe === null ? [at(portalSlotX(w), 0, SLOT, SLOT)] : []),
    ...g.belt.flatMap((s, i) => (s === null ? [] : [at(beltSlotX(w, i), BELT_BELOW_Y, BELT_SLOT_W, SLOT)])),
    at(line.x, line.y, line.end - line.x, SIDE_LINE_H),
  ], boxes.filter(b => b.role === 'belt'))
}

/** The strip's text boxes: its numbers, less any a box over it (the belt's menu) covers, then those boxes on top. */
export const hudBoxes = (g: Game, width: number, over: readonly OverlayBox[]): OverlayBox[] => [
  ...clearOf(hudLabels(g, width), over),
  ...over,
]

/** The belt slot whose menu is open on the strip, or none. */
export type BeltMenu = number | null

/** The tiers a slot holds, strongest first: what its menu lists. */
const heldTiers = (g: Game, slot: number): Tier[] => {
  const s = g.belt[slot]
  return s === null || s === undefined ? [] : [...TIERS].reverse().filter(t => (s.tiers[t - 1] ?? 0) > 0)
}

/**
 * A belt slot's menu, in cells of the strip: a line a tier it holds, strongest first, each its name and how many, the
 * one the slot uses next marked; a
 * popover standing on the slot, its left edge on the slot's, just above the belt, kept inside the strip. None for an
 * empty slot.
 */
export const beltMenuBox = (g: Game, slot: number, width: number): OverlayBox<'belt'> | undefined => {
  const s = g.belt[slot]
  const tiers = heldTiers(g, slot)
  if (s === null || s === undefined || tiers.length === 0) return undefined
  const active = activeTier(s)
  const box = boxShape('belt', tiers.map(t => [t === active ? { text: '> ', color: CURSOR, bold: true } : { text: '  ' }, { text: nameOf(s.kind, t), bold: t === active }, { text: ` x${s.tiers[t - 1]}`, dim: true }]), CURSOR)
  return { ...box, x: Math.max(0, Math.min(INSET + beltSlotX(width - 2 * INSET, slot), width - box.w)), y: Math.max(0, Math.floor((INSET + BELT_BELOW_Y) / 2) - box.h) }
}

/**
 * The strip's next menu and the game actions for one gesture: a right-click on a filled belt slot opens its menu; a
 * click on a line of it chooses that tier for the slot, using nothing; any other click closes it and does what it does
 * on the strip.
 */
/** The side line, gold to the effects, as `hudHit` reads clicks: a click on it opens the log. */
const SIDE_LINE_H = 5
const isOnSideLine = (width: number, click: { x: number; y: number }) => {
  const px = Math.floor(click.x) - INSET
  const py = Math.floor(click.y * 2) - INSET
  const line = sideLineAt(width - 2 * INSET)
  return px >= line.x && px < line.end && py >= line.y && py < line.y + SIDE_LINE_H
}

/** A gesture on the strip: the belt menu as it now is, the game actions, and whether the log is asked for (the side line). */
export const hudGesture = (g: Game, menu: BeltMenu, gesture: Gesture, width: number): { menu: BeltMenu; actions: Action[]; isLog?: true } => {
  if (gesture.type === 'drag') return { menu, actions: [] }
  const box = menu === null ? undefined : beltMenuBox(g, menu, width)
  const at = gesture.at
  if (box !== undefined && menu !== null && at.x >= box.x && at.x < box.x + box.w && at.y >= box.y && at.y < box.y + box.h) {
    const tier = heldTiers(g, menu)[Math.floor(at.y) - box.y - 1]
    return tier === undefined ? { menu, actions: [] } : { menu: null, actions: [{ kind: 'choose', slot: menu, tier }] }
  }
  if (gesture.button === 'left' && isOnSideLine(width, at)) return { menu: null, actions: [], isLog: true }
  const hit = hudHit(width, at)
  if (gesture.button === 'right') return hit?.kind === 'use' && heldTiers(g, hit.slot).length > 0 ? { menu: hit.slot, actions: [] } : { menu: null, actions: [] }
  return { menu: null, actions: hit === undefined ? [] : [hit] }
}

/** The strip's text, in its cells: the HP and the level on their bars or the orbs, the belt's counts, and the side
 * line's gold, depth and effects. */
export const hudLabels = (g: Game, width: number): OverlayBox<'label'>[] => {
  const w = width - 2 * INSET
  const line = sideLineAt(w)
  return [
    ...(hasOrbs(w) ? orbLabels(g, w) : barLabels(g, w)),
    ...beltCounts(g, i => INSET + beltSlotX(w, i), INSET + BELT_BELOW_Y),
    ...sideLineParts(g, line).words.map(word => artLabel(word.text, INSET + word.x, INSET + line.y + 1, word.ink, BG)),
  ]
}

/** The HP and the level as text on their bars, in the strip's cells: the HP on the HP bar's middle, the level (a +
 * while points wait, in the level's own ink) on the XP bar, each character on the bar's color under it. */
const barLabels = (g: Game, width: number): OverlayBox<'label'>[] => {
  const { barW } = barsLayout(g, width)
  const share = Math.max(0, g.hp) / g.maxHp
  const level = `LV${g.level}${g.points > 0 ? '+' : ''}`
  return [
    barLabel(INSET + BAR_X, INSET + HP_Y, barW, share, hpTones(share)[1], HP_EMPTY, `${Math.max(0, g.hp)}/${g.maxHp}`),
    barLabel(INSET + BAR_X, INSET + XP_Y, barW, g.xp / xpToLevel(g.level), XP_FILL, XP_EMPTY, level),
  ]
}
