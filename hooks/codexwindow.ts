// The codex window, the hero's windows' last tab, on two pages: Foes, the uniques and the big bosses; Finds, the
// Legendaries and Card, which shares the hero. Each is lit once slain or found and a dark shape until then; the box
// under them counts them, and on Finds holds the records. Pure: the click layer reports whole gestures, this decides
// the window's page, the game actions they make and whether the card is asked for.
import type { Codex, Game } from '../types'
import type { Action, Run } from './game'
import { BIG_BOSSES, UNIQUES, firstCodex } from './game'
import { LEGENDARIES, baseOf } from './items'
import { CELL, ICONS } from './icons'
import { BOSS_ART, PAL, foeArtOf } from './pixelart'
import { BUTTON_H, button, buttonBox, buttonW, onCell, tierBox } from './pieces'
import { BG, SLOT, art, canvas, fill, frame } from './canvas'
import type { Canvas } from './canvas'
import { heroChrome, heroTabAt } from './herotabs'
import { SURFACE } from './ui/tokens'
import { CLICK_SLOP, CLOSE_BOX, TABS_H, WINDOW_TOP, WINDOW_W, drawBox, isInside, pixel, tabGround, textTabRects, textTabBoxes, windowPixels } from './window'
import type { Chrome, Gesture, OverlayBox, Rect } from './window'
import { countText } from './names'

const CHROME: Chrome = { title: 'CODEX' }
const top = WINDOW_TOP
const PAD = 3
const BOX_BG = SURFACE.sunken
const EDGE = SURFACE.frame
/** What is not yet slain or found: its shape alone, in one dark ink. */
const SHADE = SURFACE.shade
/** A foe's box, its 16 px art and a pixel of frame round it, as the bag's slots; the step from one to the next; a
 * Legendary's narrower, taller box and step. */
const FOE_BOX = 18
const FOE_STEP = 20
const LEG_H = 22
const LEG_GAP = 4
/** Where a row of `n` boxes `w` wide a `step` apart starts, centred in the window (the odd pixel on the right). */
const rowX = (n: number, w: number, step: number) => Math.floor((WINDOW_W - ((n - 1) * step + w)) / 2)
/** The pages' tabs at the body's top; the first row of boxes under them, the second under that. */
const PAGES = [{ label: 'FOES' }, { label: 'FINDS' }] as const
const ROW1_Y = top + TABS_H + 2
/** A unique in a slot, as in the bag: its 8 by 8 a dot a pixel in a frame, centred over its big boss's column. */
const UNIQUE_X = Math.floor((FOE_BOX - SLOT) / 2)
const ROW2_Y = ROW1_Y + SLOT + 2

/** The window's state beyond the game: the page shown. */
export type CodexUi = { page: 'foes' | 'finds' }
export const CODEX_UI: CodexUi = { page: 'foes' }
const pageIndex = (ui: CodexUi) => (ui.page === 'foes' ? 0 : 1)

/** Art at `scale` pixels a dot, in its own colours or all in `ink`. */
const scaled = (c: Canvas, rows: readonly string[], x: number, y: number, scale: number, ink?: string) =>
  rows.forEach((row, dy) =>
    [...row].forEach((k, dx) => {
      if (k !== '.') fill(c, x + dx * scale, y + dy * scale, scale, scale, ink ?? PAL[k] ?? SHADE)
    }),
  )

const box = (c: Canvas, x: number, y: number, w: number, h: number, isLit: boolean, ground: string = BOX_BG) => {
  fill(c, x, y, w, h, ground)
  frame(c, x, y, w, h, isLit ? EDGE : SURFACE.line)
}

const codexOf = (g: Game): Codex => g.codex ?? firstCodex(g)
const uniques = Object.entries(UNIQUES)
const bigs = Object.entries(BIG_BOSSES)

/** The Card button, under the Legendaries on Finds: it saves the hero card and copies it as text. */
export const CARD_KEY = { key: 'K', label: 'CARD' }
const CARD_RECT: Rect = { x: Math.floor((WINDOW_W - buttonW(CARD_KEY.label)) / 2), y: onCell(ROW1_Y + LEG_H + 2), w: buttonW(CARD_KEY.label), h: BUTTON_H }
/** The box under the pages stands 2 px under the lower of the two pages' last rows: Foes' big bosses, Finds' Card (the
 * two end on one row). */
const BOX_ABOVE = Math.max(ROW2_Y + FOE_BOX, CARD_RECT.y + BUTTON_H)
/** The Card button's place, in window pixels, on the page it is on: Finds; none on Foes. */
export const codexCardRect = (ui: CodexUi = { page: 'finds' }): Rect | undefined => (ui.page === 'finds' ? CARD_RECT : undefined)

const foundLegendaries = (c: Codex) => c.legendaries.filter(n => LEGENDARIES.some(l => l.name === n)).length

/** The box under the page, in cells: on Foes how many of each are slain; on Finds how many Legendaries are found, then
 * the records. Then the pages' tab labels, and on Finds the Card button's words. */
export const codexOverlay = (g: Game, ui: CodexUi = CODEX_UI): OverlayBox[] => {
  const c = codexOf(g)
  // The page's count, then the records, on both pages, so the box and the window are one height on both.
  const lines: Run[][] = [
    ui.page === 'foes' ? [{ text: `Uniques slain ${c.uniques.length} of ${uniques.length}, big bosses ${c.bigs.length} of ${bigs.length}.` }] : [{ text: `Legendaries found ${foundLegendaries(c)} of ${LEGENDARIES.length}.` }],
    [{ text: `Deepest ${c.deepest}, level ${c.level}, kills ${countText(c.kills)}, bosses ${countText(c.bosses)}.`, dim: true }],
    [{ text: `Deaths ${countText(c.deaths)}, heroes retired ${c.retired ?? 0}, gold found ${countText(c.gold)}.`, dim: true }],
  ]
  const card = ui.page === 'finds' ? [buttonBox(CARD_KEY.label, CARD_RECT.x, CARD_RECT.y, 'ready')] : []
  return [{ role: 'about', x: 2, y: Math.ceil((BOX_ABOVE + 2) / 2), w: WINDOW_W - 4, h: lines.length + 2, border: SURFACE.frame, lines }, ...textTabBoxes(PAGES, pageIndex(ui), top, BG), ...card]
}

/** The window's height in pixels, title bar and all. */
export const codexHeight = (g: Game, ui: CodexUi = CODEX_UI) => {
  const box = codexOverlay(g, ui)[0]!
  return 2 * (box.y + box.h) + 2
}

/** Whether each of a row's entries is lit: the uniques, the big bosses and the Legendaries, in their order. */
export const codexLit = (g: Game) => {
  const c = codexOf(g)
  return {
    uniques: uniques.map(([, u]) => c.uniques.includes(u.key)),
    bigs: bigs.map(([, b]) => c.bigs.includes(b.key)),
    legendaries: LEGENDARIES.map(l => c.legendaries.includes(l.name)),
  }
}

const drawFoes = (body: Canvas, lit: ReturnType<typeof codexLit>) => {
  const x0 = rowX(bigs.length, FOE_BOX, FOE_STEP)
  uniques.forEach(([theme, one], i) => {
    const x = x0 + i * FOE_STEP
    // A unique slain on the map's floor, as it stands there, so its dark outline shows.
    box(body, x + UNIQUE_X, ROW1_Y - top, SLOT, SLOT, lit.uniques[i]!, lit.uniques[i] ? SURFACE.floor : BOX_BG)
    scaled(body, foeArtOf({ glyph: one.glyph, unique: one.key }, theme), x + UNIQUE_X + 1, ROW1_Y - top + 1, 1, lit.uniques[i] ? undefined : SHADE)
  })
  bigs.forEach(([, one], i) => {
    const x = x0 + i * FOE_STEP
    box(body, x, ROW2_Y - top, FOE_BOX, FOE_BOX, lit.bigs[i]!)
    scaled(body, BOSS_ART[one.key], x + 1, ROW2_Y - top + 1, 1, lit.bigs[i] ? undefined : SHADE)
  })
}

/** Each Legendary's art, and its box: the art and a pixel of frame round it across, as in the bag, LEG_H down. */
const legendaryBoxes = () => {
  const icons = LEGENDARIES.map(one => ICONS[one.base]?.art ?? [])
  // Its piece's cells framed, as the bag holds it: w by h cells of CELL, a frame line round them.
  const sizes = LEGENDARIES.map(one => ({ w: (baseOf(one.base)?.w ?? 1) * CELL + 1, h: (baseOf(one.base)?.h ?? 1) * CELL + 1 }))
  const across = sizes.reduce((n, s) => n + s.w, 0) + LEG_GAP * (sizes.length - 1)
  let x = Math.floor((WINDOW_W - across) / 2)
  return icons.map((icon, i) => {
    const at = { icon, x, ...sizes[i]! }
    x += sizes[i]!.w + LEG_GAP
    return at
  })
}

const drawFinds = (body: Canvas, lit: ReturnType<typeof codexLit>) => {
  const y = ROW1_Y - top
  legendaryBoxes().forEach(({ icon, x, w, h }, i) => {
    // Each stands on the row's bottom line. A Legendary found sits in its tier's box, as in the bag; one not yet found
    // is a shape in a plain one.
    const top = y + LEG_H - h
    if (lit.legendaries[i]) tierBox(body, x + 1, top + 1, w - 2, h - 2, 'legendary')
    else box(body, x, top, w, h, false)
    art(body, icon, x + 1 + Math.floor((w - 2 - (icon[0]?.length ?? 0)) / 2), top + 1 + Math.floor((h - 2 - icon.length) / 2), lit.legendaries[i] ? undefined : SHADE)
  })
  button(body, CARD_KEY.label, CARD_RECT.x, CARD_RECT.y - top, 'ready')
}

/** The window's pixels: the hero's tabs, the pages' tabs, the page's boxes (and on Finds, Card), the box under them. */
export const codexPixels = (g: Game, ui: CodexUi = CODEX_UI): string[][] => {
  const lit = codexLit(g)
  const body = canvas(WINDOW_W, codexHeight(g, ui) - top)
  tabGround(body, PAGES, pageIndex(ui), 0)
  fill(body, PAD, TABS_H, WINDOW_W - 2 * PAD, 1, SURFACE.line)
  if (ui.page === 'foes') drawFoes(body, lit)
  else drawFinds(body, lit)
  const c = windowPixels(heroChrome(g, 'codex'), body.px)
  for (const b of codexOverlay(g, ui)) if (b.role === 'about') drawBox(c, b)
  return c.px
}

/** What a gesture on the codex comes to: the page shown, the game actions, and whether the hero card is asked for. */
export type CodexOutcome = { ui: CodexUi; actions: Action[]; isCard: boolean }

/** A hero tab opens its window; a page's tab shows it; Card asks for the hero card; the close box closes; anything
 * else, nothing. */
export const codexGesture = (g: Game, ui: CodexUi, gesture: Gesture): CodexOutcome => {
  const none = { ui, actions: [], isCard: false }
  if (gesture.type === 'drag') return none
  const from = pixel(gesture.from)
  const at = pixel(gesture.at)
  if (Math.max(Math.abs(at.x - from.x), Math.abs(at.y - from.y)) >= CLICK_SLOP) return none
  const tab = heroTabAt(g, 'codex', at)
  if (tab !== undefined) return { ...none, actions: tab }
  const page = textTabRects(PAGES, top).findIndex(r => isInside(at, r.x, r.y, r.w, r.h))
  if (page >= 0) return { ...none, ui: { page: page === 0 ? 'foes' : 'finds' } }
  const card = codexCardRect(ui)
  if (card !== undefined && isInside(at, card.x, card.y, card.w, card.h)) return { ...none, isCard: true }
  return isInside(at, ...CLOSE_BOX) ? { ...none, actions: [{ kind: 'panel', panel: 'codex' }] } : none
}

/** What a click acts on, in window pixels: the page not shown, and on Finds Card. */
export const codexHot = (ui: CodexUi): Rect[] => [...textTabRects(PAGES, top).filter((_, i) => i !== pageIndex(ui)), ...(ui.page === 'finds' ? [CARD_RECT] : [])]
