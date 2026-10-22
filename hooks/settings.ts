// The settings window, opened from the gear in the strip, on two pages. Game: a new game (the start screen), help, the
// sound (effects and music each on or off), the view and the volume of both. Orders: the hero's standing orders. Pure:
// the click layer reports whole gestures, this decides what they do. The sound settings are the session's, not the
// game's; the `sound` and `music` options start them.
import type { Game, Orders } from '../types'
import type { Action } from './game'
import { ordersOf } from './game'
import { BG, canvas, fill } from './canvas'
import { BUTTON_H, buttonBox, buttonFace, buttonW } from './pieces'
import { SPACE, SURFACE } from './ui/tokens'
import { CLICK_SLOP, CLOSE_BOX, TABS_H, WINDOW_TOP, WINDOW_W, isInside, pixel, tabGround, textTabRects, textTabBoxes, windowPixels } from './window'
import type { Chrome, Gesture, OverlayBox, Rect } from './window'

const CHROME: Chrome = { title: 'SETTINGS' }
const top = WINDOW_TOP
const PAD = 3
const VIEW_WORD: Readonly<Record<Game['zoom'], string>> = { 1: 'VIEW MAP', 2: 'VIEW ASCII', 3: 'VIEW PIXEL' }

/** The sound as set: effects and music each on or off, and the volume in quarters, 1 to VOLUME_STEPS. */
export type SoundSettings = { effects: boolean; music: boolean; volume: number }
export const VOLUME_STEPS = 4
/** The share of each clip's own level everything plays at. */
export const volumeShare = (s: SoundSettings) => s.volume / VOLUME_STEPS

type Does = 'new' | 'help' | 'view' | 'effects' | 'music' | 'volume' | keyof Orders

const DRINK_WORD: Readonly<Record<Orders['drink'], string>> = { 25: 'DRINK AT QUARTER HP', 50: 'DRINK AT HALF HP', 0: 'DRINK NEVER' }
const LEAVE_WORD: Readonly<Partial<Record<Orders['leave'], string>>> = { common: 'TAKE ALL LOOT', uncommon: 'LEAVE COMMONS', rare: 'LEAVE BELOW RARE' }

/** The window's state beyond the game: the page shown. */
export type SettingsUi = { page: 'game' | 'orders' }
export const SETTINGS_UI: SettingsUi = { page: 'game' }
const PAGES = [{ label: 'GAME' }, { label: 'ORDERS' }] as const

type Key = { key: string; label: string; does: Does }
/** The page's buttons, a row of them at a time, each with its key, its label for this game and sound, and what it does. */
const rowsOf = (g: Game, sound: SoundSettings, ui: SettingsUi): Key[][] => ui.page === 'game'
  ? [
      [{ key: 'N', label: 'NEW GAME', does: 'new' }, { key: 'H', label: 'HELP', does: 'help' }],
      [{ key: 'E', label: sound.effects ? 'SOUND ON' : 'SOUND OFF', does: 'effects' }, { key: 'M', label: sound.music ? 'MUSIC ON' : 'MUSIC OFF', does: 'music' }],
      [{ key: 'V', label: VIEW_WORD[g.zoom], does: 'view' }, { key: 'L', label: `VOL ${(100 * sound.volume) / VOLUME_STEPS}`, does: 'volume' }],
    ]
  : [[{ key: 'D', label: orderWord(g, 'drink'), does: 'drink' }], [{ key: 'F', label: orderWord(g, 'smoke'), does: 'smoke' }], [{ key: 'K', label: orderWord(g, 'leave'), does: 'leave' }]]

/** The rows' top, under the pages' tabs and their rule. */
const ROWS_Y = top + TABS_H + 4
const ROWS = 3
const ROW_STEP = BUTTON_H + 2
/** Each button of the page and its place, in window pixels: its row's left to right, SPACE.gap apart; a row a cell under
 * the one above, so every row starts on a whole cell. A column's buttons are one width, its widest's, so they line up. */
const placed = (g: Game, sound: SoundSettings, ui: SettingsUi) => {
  const rows = rowsOf(g, sound, ui)
  const widths = rows.reduce<number[]>((w, row) => row.map((k, i) => Math.max(w[i] ?? 0, buttonW(k.key, k.label))), [])
  return rows.flatMap((row, r) => {
    let x = PAD
    return row.map((k, i) => {
      const rect = { x, y: ROWS_Y + r * ROW_STEP, w: widths[i]!, h: BUTTON_H }
      x += rect.w + SPACE.gap
      return { ...k, rect }
    })
  })
}

/** An order's label as the window says it: the order as it stands. */
export const orderWord = (g: Pick<Game, 'orders'>, which: keyof Orders) => {
  const orders = ordersOf(g)
  if (which === 'drink') return DRINK_WORD[orders.drink]
  if (which === 'smoke') return orders.smoke ? 'SMOKE WHEN LOW' : 'SMOKE NEVER'
  return LEAVE_WORD[orders.leave] ?? 'TAKE ALL LOOT'
}

const isOrder = (does: Does): does is keyof Orders => does === 'drink' || does === 'smoke' || does === 'leave'

/** The sound as saved, or `defaults` when nothing was saved or what was is no sound: each switch on or off, the volume a step of VOLUME_STEPS. */
export const soundFrom = (saved: unknown, defaults: SoundSettings): SoundSettings => {
  const s = saved as Partial<SoundSettings> | null | undefined
  const isSound = typeof s?.effects === 'boolean' && typeof s.music === 'boolean' && Number.isInteger(s.volume) && s.volume! >= 1 && s.volume! <= VOLUME_STEPS
  return isSound ? { effects: s.effects!, music: s.music!, volume: s.volume! } : defaults
}

/** The sound after a sound button: effects or music flipped, or the volume a quarter up, from full back to a quarter. */
export const nextSound = (s: SoundSettings, does: 'effects' | 'music' | 'volume'): SoundSettings =>
  does === 'effects' ? { ...s, effects: !s.effects } : does === 'music' ? { ...s, music: !s.music } : { ...s, volume: (s.volume % VOLUME_STEPS) + 1 }

/** The window's height in pixels: three rows of buttons on either page and a cell of room under them. */
export const SETTINGS_H = ROWS_Y + ROWS * ROW_STEP

/** Where a button is on its page, in window pixels, by what it does. */
export const settingsRect = (g: Game, sound: SoundSettings, ui: SettingsUi, does: Does): Rect | undefined => placed(g, sound, ui).find(k => k.does === does)?.rect

/** The window's pixels: the title bar, the pages' tabs, the page's buttons. */
export const settingsPixels = (g: Game, sound: SoundSettings, ui: SettingsUi = SETTINGS_UI): string[][] => {
  const body = canvas(WINDOW_W, SETTINGS_H - top)
  tabGround(body, PAGES, ui.page === 'game' ? 0 : 1, 0)
  fill(body, PAD, TABS_H, WINDOW_W - 2 * PAD, 1, SURFACE.line)
  for (const k of placed(g, sound, ui)) buttonFace(body, k.rect.x, k.rect.y - top, k.rect.w, 'ready')
  return windowPixels(CHROME, body.px).px
}

/** The text over the window: its pages' tab labels, its buttons' words. */
export const settingsOverlay = (g: Game, sound: SoundSettings, ui: SettingsUi = SETTINGS_UI): OverlayBox[] => [
  ...textTabBoxes(PAGES, ui.page === 'game' ? 0 : 1, top, BG),
  ...placed(g, sound, ui).map(k => ({ ...buttonBox(k.key, k.label, k.rect.x, k.rect.y, 'ready'), w: k.rect.w })),
]

/** What a gesture does: the page shown, game actions, and the sound as it now is. */
export type SettingsOutcome = { ui: SettingsUi; actions: Action[]; sound: SoundSettings; isHelp?: true }

/** A page's tab shows it; a button clicked: New game opens the start screen, Help the how-it-plays window, the view
 * steps to the next, a sound button sets the sound, an order steps; the close box closes. */
export const settingsGesture = (g: Game, sound: SoundSettings, ui: SettingsUi, gesture: Gesture): SettingsOutcome => {
  const none = { ui, actions: [], sound }
  if (gesture.type === 'drag') return none
  const from = pixel(gesture.from)
  const at = pixel(gesture.at)
  if (Math.max(Math.abs(at.x - from.x), Math.abs(at.y - from.y)) >= CLICK_SLOP) return none
  const page = textTabRects(PAGES, top).findIndex(r => isInside(at, r.x, r.y, r.w, r.h))
  if (page >= 0) return { ...none, ui: { page: page === 0 ? 'game' : 'orders' } }
  const hit = placed(g, sound, ui).find(k => isInside(at, k.rect.x, k.rect.y, k.rect.w, k.rect.h))
  if (hit === undefined) return isInside(at, ...CLOSE_BOX) ? { ...none, actions: [{ kind: 'panel', panel: 'settings' }] } : none
  const does = hit.does
  if (does === 'help') return { ...none, isHelp: true }
  if (does === 'new') return { ...none, actions: [{ kind: 'panel', panel: 'start' }] }
  if (does === 'view') return { ...none, actions: [{ kind: 'zoom' }] }
  return isOrder(does) ? { ...none, actions: [{ kind: 'order', order: does }] } : { ...none, sound: nextSound(sound, does) }
}

/** What a click acts on, in window pixels: the page not shown, and the page's buttons. */
export const settingsHot = (g: Game, sound: SoundSettings, ui: SettingsUi): Rect[] => [
  ...textTabRects(PAGES, top).filter((_, i) => i !== (ui.page === 'game' ? 0 : 1)),
  ...placed(g, sound, ui).map(k => k.rect),
]
