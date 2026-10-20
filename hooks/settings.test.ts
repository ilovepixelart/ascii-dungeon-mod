import { describe, expect, test } from 'claude-code/testing'

import type { Game } from '../types'
import { GOLD_INK } from './pieces'
import { SETTINGS_H, SETTINGS_UI, VOLUME_STEPS, nextSound, settingsGesture, settingsPixels, settingsRect, soundFrom } from './settings'
import type { SettingsUi, SoundSettings } from './settings'
import { CLOSE_BOX, WINDOW_TOP, WINDOW_W, tabRects } from './window'
import type { Gesture, Rect } from './window'
import { newGame } from './world'

const ON: SoundSettings = { effects: true, music: true, volume: VOLUME_STEPS }
const hero = (over: Partial<Game> = {}): Game => ({ ...newGame(1, 'knight'), panel: 'settings', ...over })
const tap = (px: number, py: number): Gesture => ({ type: 'release', from: { x: px + 0.5, y: py / 2 + 0.25 }, at: { x: px + 0.5, y: py / 2 + 0.25 }, button: 'left' })
const GAME: SettingsUi = SETTINGS_UI
const ORDERS: SettingsUi = { page: 'orders' }
const middle = (r: Rect) => tap(r.x + Math.floor(r.w / 2), r.y + 4)
const click = (g: Game, ui: SettingsUi, does: Parameters<typeof settingsRect>[3], sound = ON) => settingsGesture(g, sound, ui, middle(settingsRect(g, sound, ui, does)!))

describe('the settings window', () => {
  test('Game: New game, Help, the sound, the music, the view and the volume, each doing its own', async () => {
    const g = hero()
    expect(click(g, GAME, 'new')).toEqual({ ui: GAME, actions: [{ kind: 'panel', panel: 'start' }], sound: ON })
    expect(click(g, GAME, 'help')).toEqual({ ui: GAME, actions: [], sound: ON, isHelp: true })
    expect(click(g, GAME, 'effects')).toEqual({ ui: GAME, actions: [], sound: { ...ON, effects: false } })
    expect(click(g, GAME, 'music')).toEqual({ ui: GAME, actions: [], sound: { ...ON, music: false } })
    expect(click(g, GAME, 'view')).toEqual({ ui: GAME, actions: [{ kind: 'zoom' }], sound: ON })
    expect(click(g, GAME, 'volume')).toEqual({ ui: GAME, actions: [], sound: { ...ON, volume: 1 } })
    expect(settingsRect(g, ON, GAME, 'drink')).toBeUndefined()
  })

  test('Orders: Drink, Smoke and Leave, each stepping its order; the game\'s buttons are not on it', async () => {
    const g = hero()
    for (const order of ['drink', 'smoke', 'leave'] as const) expect(click(g, ORDERS, order)).toEqual({ ui: ORDERS, actions: [{ kind: 'order', order }], sound: ON })
    expect(settingsRect(g, ON, ORDERS, 'new')).toBeUndefined()
  })

  test('two buttons to a row on Game, side by side; on Orders one a row; every button inside the window', async () => {
    const g = hero({ zoom: 3 })
    const loud = { ...ON, effects: false, music: false }
    const r = (ui: SettingsUi, does: Parameters<typeof settingsRect>[3]) => settingsRect(g, loud, ui, does)!
    for (const [a, b] of [['new', 'help'], ['effects', 'music'], ['view', 'volume']] as const) {
      expect([r(GAME, a).y === r(GAME, b).y, r(GAME, a).x + r(GAME, a).w < r(GAME, b).x, r(GAME, b).x + r(GAME, b).w <= WINDOW_W - 3]).toEqual([true, true, true])
    }
    expect(r(ORDERS, 'smoke').y).toBeGreaterThan(r(ORDERS, 'drink').y)
    expect(r(ORDERS, 'leave').y).toBeGreaterThan(r(ORDERS, 'smoke').y)
  })

  test('a click on a page\'s tab shows that page', async () => {
    const [game, orders] = tabRects([{ label: 'GAME' }, { label: 'ORDERS' }], WINDOW_TOP)
    expect(settingsGesture(hero(), ON, GAME, middle(orders!)).ui).toEqual(ORDERS)
    expect(settingsGesture(hero(), ON, ORDERS, middle(game!)).ui).toEqual(GAME)
  })

  test('each order button says the order as it stands', async () => {
    const px = (orders: Game['orders']) => settingsPixels(hero({ orders }), ON, ORDERS)
    const base = { drink: 25, smoke: false, leave: 'common' } as const
    expect(px(base)).toEqual(px(undefined))
    expect(px(base)).not.toEqual(px({ ...base, drink: 50 }))
    expect(px(base)).not.toEqual(px({ ...base, smoke: true }))
    expect(px(base)).not.toEqual(px({ ...base, leave: 'rare' }))
  })

  test('the volume steps a quarter up, from full back round to a quarter; effects and music flip and flip back', async () => {
    const steps = [1, 2, 3, 4].map(volume => nextSound({ ...ON, volume }, 'volume').volume)
    expect(steps).toEqual([2, 3, 4, 1])
    expect(nextSound(nextSound(ON, 'effects'), 'effects')).toEqual(ON)
    expect(nextSound(nextSound(ON, 'music'), 'music')).toEqual(ON)
  })

  test('each sound button says how the sound is set', async () => {
    const px = (s: SoundSettings) => settingsPixels(hero(), s)
    expect(px(ON)).not.toEqual(px({ ...ON, effects: false }))
    expect(px(ON)).not.toEqual(px({ ...ON, music: false }))
    expect(px(ON)).not.toEqual(px({ ...ON, volume: 2 }))
  })

  test('Help draws its key in gold where it stands', async () => {
    const r = settingsRect(hero(), ON, GAME, 'help')!
    expect(settingsPixels(hero(), ON).slice(r.y, r.y + r.h).some(row => row.slice(r.x, r.x + r.w).includes(GOLD_INK))).toBe(true)
  })

  test('the close box closes it; a drag or a click on nothing does nothing', async () => {
    const g = hero()
    const [x, y] = CLOSE_BOX
    expect(settingsGesture(g, ON, GAME, tap(x + 2, y + 2)).actions).toEqual([{ kind: 'panel', panel: 'settings' }])
    expect(settingsGesture(g, ON, GAME, { type: 'drag', from: { x: 5, y: 10 }, at: { x: 40, y: 10 } })).toEqual({ ui: GAME, actions: [], sound: ON })
    expect(settingsGesture(g, ON, GAME, tap(WINDOW_W - 4, SETTINGS_H - 4))).toEqual({ ui: GAME, actions: [], sound: ON })
  })

  test('both pages fit in 40 rows, WINDOW_W wide and a whole number of cells tall', async () => {
    for (const ui of [GAME, ORDERS]) {
      const px = settingsPixels(hero(), ON, ui)
      expect(px.length).toBe(SETTINGS_H)
      for (const row of px) expect(row.length).toBe(WINDOW_W)
    }
    expect([SETTINGS_H % 2, SETTINGS_H <= 80]).toEqual([0, true])
  })
})

describe('the sound as saved', () => {
  const OFF: SoundSettings = { effects: false, music: false, volume: 1 }

  test('a saved sound is taken as it was saved', async () => {
    expect(soundFrom({ effects: false, music: true, volume: 2 }, ON)).toEqual({ effects: false, music: true, volume: 2 })
    expect(soundFrom(OFF, ON)).toEqual(OFF)
  })

  test('nothing saved, or anything that is no sound, gives the defaults', async () => {
    for (const saved of [undefined, null, 'loud', [], {}, { effects: false, music: true }, { effects: 'no', music: true, volume: 2 }, { effects: false, music: true, volume: 0 }, { effects: false, music: true, volume: VOLUME_STEPS + 1 }, { effects: false, music: true, volume: 1.5 }]) {
      expect(soundFrom(saved, ON)).toEqual(ON)
    }
  })
})
