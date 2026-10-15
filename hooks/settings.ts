// The settings window, opened from the gear in the strip: a new game (the start screen), the view, and the sound:
// effects and music each on or off, and the volume of both; under them, the hero's standing orders. Pure: the click layer reports whole gestures, this decides
// what they do. The sound settings are the session's, not the game's; the `sound` and `music` options start them.
import type { Game, Orders } from '../types'
import type { Action } from './game'
import { ordersOf } from './game'
import { canvas, fill } from './canvas'
import { BUTTON_H, button, buttonW } from './pieces'
import { CLICK_SLOP, CLOSE_BOX, LABEL_INK, WINDOW_W, bodyTop, isInside, pixel, windowPixels, word } from './window'
import type { Chrome, Gesture, Rect } from './window'

const CHROME: Chrome = { title: 'SETTINGS', labels: [] }
const top = bodyTop(CHROME)
const PAD = 3
const GAP = 3
const VIEW_WORD: Readonly<Record<Game['zoom'], string>> = { 1: 'VIEW MAP', 2: 'VIEW ASCII', 3: 'VIEW PIXEL' }

/** The sound as set: effects and music each on or off, and the volume in quarters, 1 to VOLUME_STEPS. */
export type SoundSettings = { effects: boolean; music: boolean; volume: number }
export const VOLUME_STEPS = 4
/** The share of each clip's own level everything plays at. */
export const volumeShare = (s: SoundSettings) => s.volume / VOLUME_STEPS

type Does = 'new' | 'view' | 'effects' | 'music' | 'volume' | keyof Orders

const DRINK_WORD: Readonly<Record<Orders['drink'], string>> = { 25: 'DRINK AT QUARTER HP', 50: 'DRINK AT HALF HP', 0: 'DRINK NEVER' }
const LEAVE_WORD: Readonly<Partial<Record<Orders['leave'], string>>> = { common: 'TAKE ALL LOOT', uncommon: 'LEAVE COMMONS', rare: 'LEAVE BELOW RARE' }

/** The buttons in order, each with its key, its label for this game and sound, and what it does. */
const buttons = (g: Game, sound: SoundSettings): { key: string; label: string; does: Does }[] => {
  return [
    { key: 'N', label: 'NEW GAME', does: 'new' },
    { key: 'V', label: VIEW_WORD[g.zoom], does: 'view' },
    { key: 'E', label: sound.effects ? 'EFFECTS ON' : 'EFFECTS OFF', does: 'effects' },
    { key: 'M', label: sound.music ? 'MUSIC ON' : 'MUSIC OFF', does: 'music' },
    { key: 'L', label: `VOLUME ${(100 * sound.volume) / VOLUME_STEPS}`, does: 'volume' },
    { key: 'D', label: orderWord(g, 'drink'), does: 'drink' },
    { key: 'F', label: orderWord(g, 'smoke'), does: 'smoke' },
    { key: 'K', label: orderWord(g, 'leave'), does: 'leave' },
  ]
}
/** An order's label as the window says it: the order as it stands. */
export const orderWord = (g: Pick<Game, 'orders'>, which: keyof Orders) => {
  const orders = ordersOf(g)
  if (which === 'drink') return DRINK_WORD[orders.drink]
  if (which === 'smoke') return orders.smoke ? 'SMOKE WHEN LOW' : 'SMOKE NEVER'
  return LEAVE_WORD[orders.leave] ?? 'TAKE ALL LOOT'
}

/** The buttons above the orders; the orders start below a rule and their label. */
const SOUND_ROWS = 5
const ORDER_ROWS = 3
const RULE_GAP = 4
const LABEL_H = 9
const RULE = '#2c2834'
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

/** Each button's place, in window pixels: a row each, down the left. */
const buttonRect = (key: string, label: string, i: number): Rect => ({ x: PAD, y: rowY(i), w: buttonW(key, label), h: BUTTON_H })
/** The top of row `i` in window pixels, the orders' rows past their rule and label. */
const rowY = (i: number) => top + 2 + i * (BUTTON_H + GAP) + (i >= SOUND_ROWS ? RULE_GAP + LABEL_H : 0)
/** Where the rule over the orders lies, in window pixels. */
const RULE_Y = top + 2 + SOUND_ROWS * (BUTTON_H + GAP)

/** The window's height in pixels: the buttons and a pixel of room, a whole number of cells. */
export const SETTINGS_H = Math.ceil((rowY(SOUND_ROWS + ORDER_ROWS) + 1) / 2) * 2

/** The window's pixels: the title bar and the buttons. */
export const settingsPixels = (g: Game, sound: SoundSettings): string[][] => {
  const body = canvas(WINDOW_W, SETTINGS_H - top)
  buttons(g, sound).forEach((b, i) => button(body, b.key, b.label, PAD, buttonRect(b.key, b.label, i).y - top, b.does === 'new' ? 'armed' : 'ready'))
  fill(body, PAD, RULE_Y - top, WINDOW_W - 2 * PAD, 1, RULE)
  word(body, 'HERO ORDERS', PAD, RULE_Y - top + RULE_GAP, LABEL_INK)
  return windowPixels(CHROME, body.px).px
}

/** What a gesture does: game actions, and the sound as it now is. */
export type SettingsOutcome = { actions: Action[]; sound: SoundSettings }

/** A button clicked: New game opens the start screen, the view steps to the next, a sound button sets the sound; the close box closes. */
export const settingsGesture = (g: Game, sound: SoundSettings, gesture: Gesture): SettingsOutcome => {
  const none = { actions: [], sound }
  if (gesture.type === 'drag') return none
  const from = pixel(gesture.from)
  const at = pixel(gesture.at)
  if (Math.max(Math.abs(at.x - from.x), Math.abs(at.y - from.y)) >= CLICK_SLOP) return none
  const hit = buttons(g, sound).find((b, i) => {
    const r = buttonRect(b.key, b.label, i)
    return isInside(at, r.x, r.y, r.w, r.h)
  })
  if (hit === undefined) return isInside(at, ...CLOSE_BOX) ? { actions: [{ kind: 'panel', panel: 'settings' }], sound } : none
  const does = hit.does
  if (does === 'new') return { actions: [{ kind: 'panel', panel: 'start' }], sound }
  if (does === 'view') return { actions: [{ kind: 'zoom' }], sound }
  return isOrder(does) ? { actions: [{ kind: 'order', order: does }], sound } : { actions: [], sound: nextSound(sound, does) }
}
