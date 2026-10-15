// The settings window, opened from the gear in the strip: a new game (the start screen), the view, and the sound:
// effects and music each on or off, and the volume of both. Pure: the click layer reports whole gestures, this decides
// what they do. The sound settings are the session's, not the game's; the `sound` and `music` options start them.
import type { Game } from '../types'
import type { Action } from './game'
import { canvas } from './canvas'
import { BUTTON_H, button, buttonW } from './pieces'
import { CLICK_SLOP, CLOSE_BOX, WINDOW_W, bodyTop, isInside, pixel, windowPixels } from './window'
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

type Does = 'new' | 'view' | 'effects' | 'music' | 'volume'

/** The buttons in order, each with its key, its label for this game and sound, and what it does. */
const buttons = (g: Game, sound: SoundSettings): { key: string; label: string; does: Does }[] => [
  { key: 'N', label: 'NEW GAME', does: 'new' },
  { key: 'V', label: VIEW_WORD[g.zoom], does: 'view' },
  { key: 'E', label: sound.effects ? 'EFFECTS ON' : 'EFFECTS OFF', does: 'effects' },
  { key: 'M', label: sound.music ? 'MUSIC ON' : 'MUSIC OFF', does: 'music' },
  { key: 'L', label: `VOLUME ${(100 * sound.volume) / VOLUME_STEPS}`, does: 'volume' },
]

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
const buttonRect = (key: string, label: string, i: number): Rect => ({ x: PAD, y: top + 2 + i * (BUTTON_H + GAP), w: buttonW(key, label), h: BUTTON_H })

/** The window's height in pixels: the buttons and a pixel of room, a whole number of cells. */
export const SETTINGS_H = Math.ceil((top + 2 + 5 * (BUTTON_H + GAP) + 1) / 2) * 2

/** The window's pixels: the title bar and the buttons. */
export const settingsPixels = (g: Game, sound: SoundSettings): string[][] => {
  const body = canvas(WINDOW_W, SETTINGS_H - top)
  buttons(g, sound).forEach((b, i) => button(body, b.key, b.label, PAD, buttonRect(b.key, b.label, i).y - top, b.does === 'new' ? 'armed' : 'ready'))
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
  if (hit?.does === 'new') return { actions: [{ kind: 'panel', panel: 'start' }], sound }
  if (hit?.does === 'view') return { actions: [{ kind: 'zoom' }], sound }
  if (hit !== undefined) return { actions: [], sound: nextSound(sound, hit.does) }
  return isInside(at, ...CLOSE_BOX) ? { actions: [{ kind: 'panel', panel: 'settings' }], sound } : none
}
