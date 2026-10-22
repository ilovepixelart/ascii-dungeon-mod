// The dash, Diablo's way, on a pane DASH_COLUMNS wide or more: a big glass orb in a carved stone socket at each bottom
// corner, HP on the left and XP on the right, standing high over the map with its numbers on it, a horned gargoyle
// crest on each socket; under the orbs' curves a short stone dash that holds the belt, with the bag and settings
// buttons under the HP orb and the portal under the XP; over the map between the orbs, a carved stone plaque of the
// depth, the gold and the running effects. Its pixels are in one frame: row 0 is the
// dash's top line, rows 0 to DASH_H - 1 the dash the pane draws as the strip, the rows above it, down to -DASH_OVER,
// drawn over the map's bottom. Narrower panes keep the strip of bars (hud.ts). Pure.
import type { Game } from '../types'
import { xpToLevel } from './balance'
import { BELT_SLOT_W, BG, SLOT, canvas, put } from './canvas'
import type { Canvas } from './canvas'
import { beltCounts, beltSlot, inkOn, mix } from './pieces'
import { EFFECTS, FORTUNE_INITIAL, GOLD_INK, HP_TONES, MARK, MARK_INK, NUM_INK, XP_FILL } from './hud'
import { depthMod } from './game'
import { countText } from './names'
import { hexToInt } from './pixels'
import { boxShape } from './window'
import type { Gesture, OverlayBox } from './window'
import { activeTier, nameOf, TIERS } from './consumables'
import type { Tier } from './consumables'
import type { Action } from './game'
import { CURSOR, artLabel } from './pieces'

/** The narrowest pane with the dash: its two orbs and the belt between them. */
export const DASH_COLUMNS = 105
export const isDash = (columns: number) => columns >= DASH_COLUMNS
/** The dash's height: its top band, the belt, its bottom band. Even, a whole number of cells. */
export const DASH_H = 16
/** An orb's glass, across and down, and the carved socket round it. */
const GLASS = 22
const SOCKET = 2
export const ORB_BOX = GLASS + 2 * SOCKET
/** The socket's top: its middle 4.5 px over the dash's top line, high enough that the belt fits under the two orbs'
 * curves on a 105-column pane, its bottom on the dash's row 8. */
const BOX_TOP = -17
const GLASS_TOP = BOX_TOP + SOCKET
/** The belt's top, under the top band. */
export const BELT_Y = 3
/** The belt's five slots a pixel apart, centred between the orbs: where slot `i` starts on a pane `columns` wide. */
const BELT_W = 5 * BELT_SLOT_W + 4
export const dashBeltX = (columns: number, i: number) => Math.floor((columns - BELT_W) / 2) + i * (BELT_SLOT_W + 1)
export const xpBoxX = (columns: number) => columns - ORB_BOX
/** The buttons in the dash's corners under the orbs, each at its icon's left column, a socket cut a pixel round it:
 * the bag and settings under the HP orb, the portal under the XP. */
export const BUTTON_Y = 10
export const dashButtons = (columns: number) => [
  { icon: 'bag' as const, x: 3 },
  { icon: 'settings' as const, x: 11 },
  { icon: 'portal' as const, x: columns - 8 },
]

/** Stone, lit to shaded, and the carving cut into it: on the host's 17-step grid, so the terminal paints these greys
 * as they are, not drifted toward red. */
const STONE_LIT = '#777766'
const STONE = '#555544'
const STONE_DARK = '#333322'
const STONE_EDGE = '#111111'
const CARVE = '#222211'
/** The plaque's face, what its words stand on. */
export const PLAQUE_FACE = '#222222'

/** Sprites, a key a pixel: stone lit, stone, dark; a gargoyle's ember eyes; a bone's white. */
const INK: Readonly<Record<string, string>> = { L: STONE_LIT, S: STONE, K: STONE_EDGE, e: '#ff6a2a', E: '#ffd34d', w: '#d8d2c0', W: '#a89f8a' }
/** A horned gargoyle's head, crowning a socket: horns curving up from a heavy brow, ember eyes under it between its
 * cheekbones, a snout and its nostrils, a row of fangs biting the socket's rim. */
const CREST: readonly string[] = [
  'K.........K',
  'SK.......KS',
  '.SLK...KLS.',
  '..SLLLLLS..',
  '.KSeLSLeSK.',
  '..KSSKSSK..',
  '...wKwKw...',
]
/** The horns at the plaque's top corners, curling out over the orbs: the left one, read from its top, the right its
 * mirror. */
const HORN: readonly string[] = ['K...', 'SK..', 'LSS.', '.LLS', '..LS']
/** A skull at each end of the plaque. */
const SKULL: readonly string[] = ['.www.', 'wwwww', 'wKwKw', '.wWw.', '.w.w.']
/** The plaque's buttons, 5 by 5: the bag, the settings gear, the portal. */
const ICON: Readonly<Record<'bag' | 'settings' | 'portal', { rows: readonly string[]; ink: Readonly<Record<string, string>> }>> = {
  bag: { rows: ['.KKK.', 'KbbbK', 'bbBbb', 'bbbbb', '.bbb.'], ink: { K: '#6b4a2a', b: '#a8733e', B: '#e0b070' } },
  settings: { rows: ['.s.s.', 'sSSSs', '.SKS.', 'sSSSs', '.s.s.'], ink: { s: '#a4acb8', S: '#e4e8f0', K: '#141219' } },
  portal: { rows: ['.ccc.', 'cCbCc', 'cb.bc', 'cCbCc', '.ccc.'], ink: { c: '#3a7bd5', C: '#7fe3ff', b: '#1f4a8a' } },
}
const PORTAL_SHUT = '#3a3e48'
/** The crest's top: on the socket, its fangs two rows into it. */
const CREST_Y = BOX_TOP - CREST.length + 2
/** How many rows the dash stands over the map. */
export const DASH_OVER = -CREST_Y
/** The plaque's rows, its marks' and its words' (a whole cell, as the map's rows are). */
/** The plaque's rows: its lit top edge, the groove engraved under it, its face, its dark foot on the dash. */
const PLAQUE_TOP = -10
const PLAQUE_BOTTOM = -1
const MARK_Y = -7
export const PLAQUE_TEXT_Y = -6

/** The ripple: its phases, one every ORB_STEP_MS, round and round. */
export const ORB_PHASES = 8
export const ORB_STEP_MS = 200
export const orbPhase = (now: number) => Math.floor(now / ORB_STEP_MS) % ORB_PHASES
/** The glass's rows over the map, its numbers' among them: the surface lies still across them, so the numbers' ground
 * holds and the map shows the same frame whenever it is drawn. It ripples in the dash's own rows. */
const isStill = (y: number) => GLASS_TOP + y < 0
/** The dash's rows the orbs' numbers stand on, over the map at their middles: two whole cells. */
const ORB_TEXT_Y = -6

/** The glass: its wall a pixel thick, lit where the light comes from (the top left), dark across from it. */
const WALL_LIT = '#9aa4b4'
const WALL_SHADE = '#3a3e48'
const GLINT = '#ffffff'
export const XP_LIGHT = '#f0d070'
const XP_SHADE = '#a88430'

/** An orb's inks: its liquid, the liquid's lit surface, its shade where the round turns from the light, and the empty
 * glass, the dark seen through it, tinted by the liquid. */
type OrbInks = { liquid: string; surface: string; shade: string; glass: string }
const seenThrough = (liquid: string) => mix(BG, liquid, 0.14)
const HP_INKS: OrbInks = { liquid: HP_TONES[1], surface: HP_TONES[0], shade: HP_TONES[2], glass: seenThrough(HP_TONES[1]) }
const XP_INKS: OrbInks = { liquid: XP_FILL, surface: XP_LIGHT, shade: XP_SHADE, glass: seenThrough(XP_FILL) }
const hpShare = (g: Game) => Math.max(0, g.hp) / g.maxHp
const xpShare = (g: Game) => g.xp / xpToLevel(g.level)

/** Where on a round `size` across a pixel is: its distance from the middle, the radius, and its angle, 0 pointing
 * right and -90 up, so the light's side (the top left) is about -135. */
const roundAt = (size: number, x: number, y: number) => {
  const centre = (size - 1) / 2
  return { d: Math.hypot(x - centre, y - centre), r: size / 2, angle: (Math.atan2(y - centre, x - centre) * 180) / Math.PI }
}

/** The glass's light over whatever it shows: a short curved highlight inside the wall on the light's side and one hot
 * pixel in it; undefined elsewhere. */
const glint = (x: number, y: number) => {
  const { d, r, angle } = roundAt(GLASS, x, y)
  if (d > r - 3 && d <= r - 2 && angle > -165 && angle < -105) return mix(GLINT, WALL_LIT, 0.25)
  const hot = Math.round(GLASS * 0.3)
  return x === hot && y === hot ? GLINT : undefined
}

/** The liquid at a pixel: its body, shaded where the round turns from the light, a thin light through the glass there. */
const liquidAt = (x: number, y: number, inks: OrbInks) => {
  const { d, r, angle } = roundAt(GLASS, x, y)
  const isFar = angle > 0 && angle < 90
  if (isFar && d > r - 2) return mix(inks.liquid, GLINT, 0.22)
  return isFar && d > r - 3.5 ? inks.shade : inks.liquid
}

/** Where an orb `share` full has its surface, a row of its glass, at rest. */
const surfaceRow = (share: number) => Math.round(1 + (1 - Math.max(0, Math.min(1, share))) * (GLASS - 2))

/**
 * The glass's pixel at x, y of its square, `share` full, the ripple at `phase`: undefined outside its round; its wall;
 * the glass above the surface, the surface lit, the liquid under it; the glass's light over all. The surface rests on
 * surfaceRow, a pixel up or down with the ripple but on the still rows.
 */
export const glassPixel = (x: number, y: number, share: number, phase: number, inks: OrbInks): string | undefined => {
  const { d, r } = roundAt(GLASS, x, y)
  if (d > r) return undefined
  if (d > r - 1) return x + y < GLASS - 1 ? WALL_LIT : WALL_SHADE
  const light = glint(x, y)
  if (light !== undefined) return light
  if (share <= 0) return inks.glass
  const wave = isStill(y) ? 0 : Math.round(Math.sin((x / 7 + phase / ORB_PHASES) * 2 * Math.PI) * 0.9)
  const surface = surfaceRow(share) + wave
  if (y < surface) return inks.glass
  return y === surface ? inks.surface : liquidAt(x, y, inks)
}

/** The socket's pixel at x, y of the orb's box: the carved stone ring round the glass, lit on the light's side, its
 * outer edge dark, notched every 30 degrees; undefined inside the ring and outside it. */
const socketPixel = (x: number, y: number) => {
  const { d, r, angle } = roundAt(ORB_BOX, x, y)
  if (d > r || d <= r - SOCKET) return undefined
  if (d > r - 0.8) return STONE_EDGE
  if (Math.abs(((angle + 375) % 30) - 15) < 2.5) return CARVE
  return x + y < ORB_BOX - 1 ? STONE_LIT : STONE
}

/** A pixel set in the dash's frame, `y` its row (negative over the map). */
type Pixel = { x: number; y: number; ink: string }

/** A sprite's pixels at x, y, by its inks. */
const sprite = (rows: readonly string[], x: number, y: number, ink: Readonly<Record<string, string>>): Pixel[] =>
  rows.flatMap((row, dy) => [...row].flatMap((k, dx) => (k === '.' ? [] : [{ x: x + dx, y: y + dy, ink: ink[k] ?? '#ff00ff' }])))

/** An orb at the box's left edge `bx`: its socket, its glass, its crest. */
const orbPixels = (bx: number, share: number, phase: number, inks: OrbInks): Pixel[] => {
  const out: Pixel[] = []
  for (let dy = 0; dy < ORB_BOX; dy += 1) for (let dx = 0; dx < ORB_BOX; dx += 1) {
    const ink = socketPixel(dx, dy) ?? glassPixel(dx - SOCKET, dy - SOCKET, share, phase, inks)
    if (ink !== undefined) out.push({ x: bx + dx, y: BOX_TOP + dy, ink })
  }
  return [...out, ...sprite(CREST, bx + Math.floor((ORB_BOX - CREST[0]!.length) / 2), CREST_Y, INK)]
}

/** The plaque's place between the orbs, its first and last columns, a pixel clear of their sockets. */
const plaqueSpan = (columns: number) => ({ x0: ORB_BOX + 1, x1: xpBoxX(columns) - 2 })
/** The narrowest pane whose plaque has a skull at each end: narrower, the room goes to the gold and the depth. */
export const SKULL_COLUMNS = 120
/** How far in from each end of the plaque its words and buttons start: past a skull, or its stone edge. */
const plaqueEnd = (columns: number) => (columns >= SKULL_COLUMNS ? SKULL[0]!.length + 3 : 2)
/** Where the plaque's words run: between its two ends. */
const plaqueLine = (columns: number) => ({ x: plaqueSpan(columns).x0 + plaqueEnd(columns), end: plaqueSpan(columns).x1 - plaqueEnd(columns) + 1 })

/** A mark's width, and the cell between a mark and its word. */
const MARK_W = 5
const MARK_GAP = 1

/** The plaque's words and marks, left to right from `line.x`, each laid only while it fits whole before `line.end`,
 * three cells apart: the depth (or TOWN) with its twist first, as it always fits; then the gold, in full; then the
 * fortune and the running effects. What does not fit is left out, never clipped. */
export const plaqueParts = (g: Game, line: { x: number; end: number }) => {
  const mod = g.where === 'dungeon' ? depthMod(g.world, g.depth) : undefined
  const wanted: { rows: readonly string[]; text: string; ink: string; twist?: readonly string[] }[] = [
    { rows: MARK.stairs, text: g.where === 'town' ? 'TOWN' : String(g.depth), ink: NUM_INK, ...(mod === undefined ? {} : { twist: MARK[mod] }) },
    { rows: MARK.coin, text: countText(g.gold), ink: GOLD_INK },
    ...(g.fortune === null ? [] : [{ rows: MARK.fortune, text: FORTUNE_INITIAL[g.fortune.kind], ink: NUM_INK }]),
    ...EFFECTS.filter(k => g.effects[k] > 0).map(k => ({ rows: MARK[k], text: String(g.effects[k]), ink: NUM_INK })),
  ]
  const marks: { rows: readonly string[]; x: number }[] = []
  const words: { text: string; x: number; ink: string }[] = []
  let x = line.x
  for (const part of wanted) {
    const wide = MARK_W + MARK_GAP + part.text.length + (part.twist === undefined ? 0 : 2 + MARK_W)
    if (x + wide > line.end) continue
    marks.push({ rows: part.rows, x })
    words.push({ text: part.text, x: x + MARK_W + MARK_GAP, ink: part.ink })
    if (part.twist !== undefined) marks.push({ rows: part.twist, x: x + MARK_W + MARK_GAP + part.text.length + 2 })
    x += wide + 3
  }
  return { marks, words }
}

/** The plaque's stone at x, y: its top edge lit with its corners cut, the groove under it, its face's sides lit on the
 * left and shaded on the right, its dark foot; undefined at a cut corner, where the map shows. */
const plaqueStone = (x: number, y: number, x0: number, x1: number) => {
  const inset = Math.max(0, PLAQUE_TOP + 2 - y)
  if (x < x0 + inset || x > x1 - inset) return undefined
  if (y === PLAQUE_TOP) return STONE_LIT
  if (y === PLAQUE_TOP + 1) return x === x0 + 1 ? STONE_LIT : x === x1 - 1 ? STONE : STONE_EDGE
  if (y === PLAQUE_BOTTOM) return STONE_EDGE
  if (x === x0) return STONE_LIT
  return x === x1 ? STONE : PLAQUE_FACE
}

/** A button's socket, cut into the stone a pixel round its icon at x, y: dark, its bottom and right lips catching the
 * light from the top left. */
const socketAround = (x: number, y0: number): Pixel[] => {
  const out: Pixel[] = []
  for (let y = y0 - 1; y <= y0 + 5; y += 1) for (let dx = -1; dx <= 5; dx += 1) {
    const isLip = y === y0 + 5 || dx === 5
    out.push({ x: x + dx, y, ink: isLip ? STONE : STONE_EDGE })
  }
  return out
}

/** The dash's buttons in their sockets, the portal dark while a foe lives. */
const buttonPixels = (g: Game, columns: number): Pixel[] => {
  const isShut = g.where !== 'town' && g.foe !== null
  return dashButtons(columns).flatMap(({ icon, x }) => {
    const { rows, ink } = ICON[icon]
    return [...socketAround(x, BUTTON_Y), ...sprite(rows, x, BUTTON_Y, icon === 'portal' && isShut ? { c: PORTAL_SHUT, C: PORTAL_SHUT, b: STONE_EDGE } : ink)]
  })
}

/** The plaque: its carved stone, a rivet at each end, horns curling up from its top corners, a skull at each end on
 * a wide pane, and its marks. */
const plaquePixels = (g: Game, columns: number): Pixel[] => {
  const { x0, x1 } = plaqueSpan(columns)
  const out: Pixel[] = []
  for (let y = PLAQUE_TOP; y <= PLAQUE_BOTTOM; y += 1) for (let x = x0; x <= x1; x += 1) {
    const ink = plaqueStone(x, y, x0, x1)
    if (ink !== undefined) out.push({ x, y, ink })
  }
  for (const x of [x0 + 1, x1 - 1]) out.push({ x, y: PLAQUE_TEXT_Y, ink: STONE_LIT }, { x, y: PLAQUE_TEXT_Y + 1, ink: STONE_EDGE })
  const hornY = PLAQUE_TOP - HORN.length + 1
  out.push(...sprite(HORN, x0 - 2, hornY, INK), ...sprite(HORN.map(r => [...r].reverse().join('')), x1 - 1, hornY, INK))
  if (columns >= SKULL_COLUMNS) out.push(...sprite(SKULL, x0 + 2, MARK_Y, INK), ...sprite(SKULL, x1 - 1 - SKULL[0]!.length, MARK_Y, INK))
  for (const m of plaqueParts(g, plaqueLine(columns)).marks) out.push(...sprite(m.rows, m.x, MARK_Y, MARK_INK))
  return out
}

/** The dash's own rows' stone: its top band lit, the belt's row carved, its bottom band shaded to a dark edge. */
const bandInk = (x: number, y: number) => {
  if (y === 0) return STONE_LIT
  if (y === 1 || y === DASH_H - 3) return STONE
  if (y === 2 || y === DASH_H - 1) return STONE_EDGE
  if (y === DASH_H - 2) return STONE_DARK
  return (x * 3 + y * 5) % 11 === 0 ? CARVE : STONE_DARK
}

/** Every pixel the dash sets, the plaque and the crests over the map among them, the orbs' ripple at `phase`. */
const dashPixels = (g: Game, columns: number, phase: number): Pixel[] => [
  ...plaquePixels(g, columns),
  ...buttonPixels(g, columns),
  ...orbPixels(0, hpShare(g), phase, HP_INKS),
  ...orbPixels(xpBoxX(columns), xpShare(g), phase, XP_INKS),
]

/** The dash itself, the strip's rows: its stone, the belt, the orbs' lower parts. */
export const dashStrip = (g: Game, columns: number, phase = 0): Canvas => {
  const c = canvas(columns, DASH_H)
  for (let y = 0; y < DASH_H; y += 1) for (let x = 0; x < columns; x += 1) put(c, x, y, bandInk(x, y))
  g.belt.forEach((slot, i) => beltSlot(c, slot, dashBeltX(columns, i), BELT_Y))
  for (const p of dashPixels(g, columns, phase)) if (p.y >= 0 && p.y < DASH_H) put(c, p.x, p.y, p.ink)
  return c
}

/** The dash's rows over a map `columns` wide and `height` pixels tall: painted on its bottom rows, what the map shows
 * between them left as it is. */
export const dashOverMap = (g: Game, columns: number, phase: number) => (frame: Uint32Array, height: number) => {
  for (const p of dashPixels(g, columns, phase)) {
    const y = height + p.y
    if (p.y < 0 && y >= 0 && p.x >= 0 && p.x < columns) frame[y * columns + p.x] = hexToInt(p.ink)
  }
}

/** A count of `of` as an orb writes it: in full while it fits inside the glass, else as a percent. */
const fitted = (n: number, of: number) => {
  const full = `${n}/${of}`
  return full.length <= GLASS - 4 ? full : `${Math.floor((100 * n) / of)}%`
}

/** A line of text centred on the orb whose box starts at `bx`, on its text row 0 or 1 over the map, in the cells of
 * the dash's layer there; each character on the glass's two pixels under it as near as one ground shows them, in the
 * ink that reads there. */
const orbLabel = (text: string, bx: number, row: 0 | 1, share: number, inks: OrbInks): OverlayBox<'label'> => {
  const x0 = Math.floor((GLASS - text.length) / 2)
  const y = ORB_TEXT_Y - GLASS_TOP + 2 * row
  const runs = [...text].map((ch, i) => {
    const [top, bottom] = [y, y + 1].map(py => glassPixel(x0 + i, py, share, 0, inks) ?? BG) as [string, string]
    const ground = top === bottom ? top : mix(top, bottom, 0.5)
    return { text: ch, color: inkOn(ground), bg: ground, bold: true }
  })
  return { role: 'label', x: bx + SOCKET + x0 - 1, y: (ORB_TEXT_Y + DASH_OVER) / 2 + row - 1, w: text.length + 2, h: 3, border: runs[0]!.bg, bg: runs[0]!.bg, pad: 0, lines: [runs] }
}

/** The dash's text on its own rows, in its cells: the belt's counts. The orbs' numbers and the plaque's words stand
 * over the map (`overLabels`). */
export const dashLabels = (g: Game, columns: number): OverlayBox<'label'>[] => beltCounts(g, i => dashBeltX(columns, i), BELT_Y)

/** The rows of cells the dash stands over the map, which its own click layer covers there. */
export const OVER_ROWS = DASH_OVER / 2

/** The dash's text over the map, in the cells of its layer there (row 0 the first the dash stands over): each orb's
 * numbers (the HP over HP; the XP over the level, a + while points wait), then the plaque's words on its face. */
export const overLabels = (g: Game, columns: number): OverlayBox<'label'>[] => [
  orbLabel(fitted(Math.max(0, g.hp), g.maxHp), 0, 0, hpShare(g), HP_INKS),
  orbLabel('HP', 0, 1, hpShare(g), HP_INKS),
  orbLabel(fitted(g.xp, xpToLevel(g.level)), xpBoxX(columns), 0, xpShare(g), XP_INKS),
  orbLabel(`LV${g.level}${g.points > 0 ? '+' : ''}`, xpBoxX(columns), 1, xpShare(g), XP_INKS),
  ...plaqueParts(g, plaqueLine(columns)).words.map(w => artLabel(w.text, w.x, PLAQUE_TEXT_Y + DASH_OVER, w.ink, PLAQUE_FACE)),
]

/** A gesture on the dash's layer over the map (its cells): an orb or its crest for the sheet, a plaque button, the
 * plaque's words for the log; a left click on none of it, to the map under it; a drag or a right-click, nothing. */
export const dashOverGesture = (gesture: Gesture, columns: number): { actions: Action[]; isLog?: true; toMap?: { x: number; y: number } } => {
  if (gesture.type === 'drag' || gesture.button !== 'left') return { actions: [] }
  const hit = dashHit(columns, Math.floor(gesture.at.x), Math.floor(gesture.at.y * 2) - DASH_OVER)
  if (hit === 'log') return { actions: [], isLog: true }
  return hit === undefined ? { actions: [], toMap: gesture.at } : { actions: [hit] }
}

/** What a click on the dash does, at x, y of its frame (y negative over the map): either orb, its socket or its crest,
 * the character sheet; a belt slot, using it; a plaque button, the bag, settings or the portal; the plaque's words,
 * the log. */
export type DashAction = { kind: 'panel'; panel: 'bag' | 'sheet' | 'settings' } | { kind: 'use'; slot: number } | { kind: 'portal' } | 'log' | undefined
export const dashHit = (columns: number, x: number, y: number): DashAction => {
  const inside = (rx: number, ry: number, w: number, h: number) => x >= rx && x < rx + w && y >= ry && y < ry + h
  if ([0, xpBoxX(columns)].some(bx => inside(bx, CREST_Y, ORB_BOX, BOX_TOP + ORB_BOX - CREST_Y))) return { kind: 'panel', panel: 'sheet' }
  for (let slot = 0; slot < 5; slot += 1) if (inside(dashBeltX(columns, slot), BELT_Y, BELT_SLOT_W, SLOT)) return { kind: 'use', slot }
  const icon = dashButtons(columns).find(i => inside(i.x - 1, BUTTON_Y - 1, 7, 7))?.icon
  if (icon === 'portal') return { kind: 'portal' }
  if (icon !== undefined) return { kind: 'panel', panel: icon }
  const line = plaqueLine(columns)
  return inside(line.x, PLAQUE_TOP, line.end - line.x, PLAQUE_BOTTOM - PLAQUE_TOP + 1) ? 'log' : undefined
}

/** What a click on the dash's strip rows acts on, in its pixels: the orbs' lower parts and each belt slot holding
 * something; what an open belt menu (among `boxes`) covers is left out. */
export const dashHot = (g: Game, columns: number) => [
  ...[0, xpBoxX(columns)].map(x => ({ x, y: 0, w: ORB_BOX, h: BOX_TOP + ORB_BOX })),
  ...dashButtons(columns).filter(b => b.icon !== 'portal' || g.foe === null || g.where === 'town').map(b => ({ x: b.x - 1, y: BUTTON_Y - 1, w: 7, h: 7 })),
  ...g.belt.flatMap((s, i) => (s === null ? [] : [{ x: dashBeltX(columns, i), y: BELT_Y, w: BELT_SLOT_W, h: SLOT }])),
]

/** The tiers a slot holds, strongest first: what its menu lists. */
const heldTiers = (g: Game, slot: number): Tier[] => {
  const s = g.belt[slot]
  return s === null || s === undefined ? [] : [...TIERS].reverse().filter(t => (s.tiers[t - 1] ?? 0) > 0)
}

/** A belt slot's menu on the dash, in its cells: a line a tier, strongest first, the one used next marked, standing on
 * the slot from the dash's top. None for an empty slot. */
export const dashBeltMenu = (g: Game, slot: number, columns: number): OverlayBox<'belt'> | undefined => {
  const s = g.belt[slot]
  const tiers = heldTiers(g, slot)
  if (s === null || s === undefined || tiers.length === 0) return undefined
  const active = activeTier(s)
  const box = boxShape('belt', tiers.map(t => [t === active ? { text: '> ', color: CURSOR, bold: true } : { text: '  ' }, { text: nameOf(s.kind, t), bold: t === active }, { text: ` x${s.tiers[t - 1]}`, dim: true }]), CURSOR)
  return { ...box, x: Math.max(0, Math.min(dashBeltX(columns, slot), columns - box.w)), y: 0 }
}

/** A gesture on the dash's strip rows (cells of the strip): the belt menu as it now is, the game actions, and whether
 * the log is asked for. A right-click on a filled slot opens its menu; a click on a line of it chooses that tier. */
export const dashGesture = (g: Game, menu: number | null, gesture: Gesture, columns: number): { menu: number | null; actions: Action[]; isLog?: true } => {
  if (gesture.type === 'drag') return { menu, actions: [] }
  const box = menu === null ? undefined : dashBeltMenu(g, menu, columns)
  const at = gesture.at
  if (box !== undefined && menu !== null && at.x >= box.x && at.x < box.x + box.w && at.y >= box.y && at.y < box.y + box.h) {
    const tier = heldTiers(g, menu)[Math.floor(at.y) - box.y - 1]
    return tier === undefined ? { menu, actions: [] } : { menu: null, actions: [{ kind: 'choose', slot: menu, tier }] }
  }
  const hit = dashHit(columns, Math.floor(at.x), Math.floor(at.y * 2))
  if (gesture.button === 'right') return hit !== undefined && hit !== 'log' && hit.kind === 'use' && heldTiers(g, hit.slot).length > 0 ? { menu: hit.slot, actions: [] } : { menu: null, actions: [] }
  if (hit === 'log') return { menu: null, actions: [], isLog: true }
  return { menu: null, actions: hit === undefined ? [] : [hit] }
}
