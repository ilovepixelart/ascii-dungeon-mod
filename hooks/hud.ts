// The dashboard strip under the map, all in pixels: the hero's portrait, the HP and XP bars with their numbers, the
// settings and the portal, the belt, and a line of gold, depth and the running effects; a belt slot's menu of its tiers.
import type { Game } from '../types'
import { xpToLevel } from './balance'
import { depthMod } from './game'
import type { DepthMod } from './game'
import { BELT_SLOT_W, BG, GRID, SLOT, SLOT_BG, art, canvas, digits, fill, frame, put } from './canvas'
import type { Canvas } from './canvas'
import { CURSOR, barLabel, beltSlot, flatBar } from './pieces'
import { TIERS, activeTier, nameOf } from './consumables'
import type { Tier } from './consumables'
import type { Action } from './game'
import { boxShape, drawBox } from './window'
import type { Gesture, OverlayBox } from './window'
import { PAL, PX, TOWN_THING_ART, heroArt, textMask } from './pixelart'

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
/** Gold, depth and the effects, on a line under the belt. */
export const SIDE_LINE_Y = BELT_BELOW_Y + SLOT + 1
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
export const textW = (text: string) => textMask(text)[0]?.length ?? 0
/** Plain pixel text, no outline, its top-left corner at x, y. */
const label = (c: Canvas, text: string, x: number, y: number, ink: string) =>
  textMask(text).forEach((row, dy) => [...row].forEach((k, dx) => k === '#' && put(c, x + dx, y + dy, ink)))

/** The belt's five slots, sharing their frame lines. */
export const BELT_W = 5 * SLOT_STEP + 1

/** The strip's height at any width: the top row, the belt, the side line. */
/** The strip's height: the side line its last 5 px, a pixel of room and the metal under it. */
export const contentLayout = (_width: number) => ({ height: SIDE_LINE_Y + 5 })

/** The portal slot: flush right in the top row. */
export const portalSlotX = (width: number) => width - SLOT
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

/** Where belt slot `i` starts: from the left edge of the belt's row. */
export const beltSlotX = (_width: number, i: number) => i * SLOT_STEP

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
export const hudPixels = (g: Game, width: number, boxes: readonly OverlayBox[] = []): Canvas => {
  const inner = hudContent(g, width - 2 * INSET)
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

/** The strip's top: the portrait for the bag, the portal, the gear for settings, the XP bar's line for the character sheet. */
const topHit = (px: number, py: number, width: number): HudAction => {
  if (px < PORTRAIT && py < PORTRAIT) return { kind: 'panel', panel: 'bag' }
  if (px >= portalSlotX(width) && px < width && py < SLOT) return { kind: 'portal' }
  if (px >= settingsSlotX(width) && px < settingsSlotX(width) + SLOT && py < SLOT) return { kind: 'panel', panel: 'settings' }
  if (px >= HEART_X && px < settingsSlotX(width) && py >= LINE2_Y && py < LINE2_Y + HP_H) return { kind: 'panel', panel: 'sheet' }
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

/** What a click on the strip acts on, in its pixels, as `hudHit` reads them: the portrait, the XP line, the gear, the
 * portal while it can open, each belt slot holding something, and the side line, which opens the log. */
export const hudHot = (g: Game, width: number) => {
  const w = width - 2 * INSET
  const at = (x: number, y: number, rw: number, rh: number) => ({ x: INSET + x, y: INSET + y, w: rw, h: rh })
  return [
    at(0, 0, PORTRAIT, PORTRAIT),
    at(HEART_X, LINE2_Y, settingsSlotX(w) - HEART_X, HP_H),
    at(settingsSlotX(w), 0, SLOT, SLOT),
    ...(g.foe === null ? [at(portalSlotX(w), 0, SLOT, SLOT)] : []),
    ...g.belt.flatMap((s, i) => (s === null ? [] : [at(beltSlotX(w, i), BELT_BELOW_Y, BELT_SLOT_W, SLOT)])),
    at(0, SIDE_LINE_Y, w, SIDE_LINE_H),
  ]
}

/** Two boxes, in cells, that share a cell. */
const overlaps = (a: OverlayBox, b: OverlayBox) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h

/** The strip's text boxes: its numbers, less any a box over it (the belt's menu) covers, then those boxes on top. */
export const hudBoxes = (g: Game, width: number, over: readonly OverlayBox[]): OverlayBox[] => [
  ...hudLabels(g, width).filter(l => !over.some(b => overlaps(l, b))),
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
  return { ...box, x: Math.max(0, Math.min(INSET + beltSlotX(width, slot), width - box.w)), y: Math.max(0, Math.floor((INSET + BELT_BELOW_Y) / 2) - box.h) }
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
  return px >= 0 && px < width - 2 * INSET && py >= SIDE_LINE_Y && py < SIDE_LINE_Y + SIDE_LINE_H
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

/**
 * The HP and the level as text on their bars, in the strip's cells, like the inventory's cards: the HP on the HP bar's
 * middle, the level (a + while points wait, in the level's own ink) on the XP bar, each character on the bar's color under it.
 */
export const hudLabels = (g: Game, width: number): OverlayBox<'label'>[] => {
  const { barW } = barsLayout(g, width - 2 * INSET)
  const share = Math.max(0, g.hp) / g.maxHp
  const level = `LV${g.level}${g.points > 0 ? '+' : ''}`
  return [
    barLabel(INSET + BAR_X, INSET + HP_Y, barW, share, hpTones(share)[1], HP_EMPTY, `${Math.max(0, g.hp)}/${g.maxHp}`),
    barLabel(INSET + BAR_X, INSET + XP_Y, barW, g.xp / xpToLevel(g.level), XP_FILL, XP_EMPTY, level),
  ]
}
