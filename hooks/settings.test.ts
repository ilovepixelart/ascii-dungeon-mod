import { describe, expect, test } from 'claude-code/testing'

import type { Game } from '../types'
import { buttonsIn } from './fixtures'
import { SETTINGS_H, SETTINGS_UI, VOLUME_STEPS, nextSound, settingsGesture, settingsOverlay, settingsPixels, settingsRect, soundFrom } from './settings'
import type { SettingsUi, SoundSettings } from './settings'
import { CLOSE_BOX, WINDOW_TOP, WINDOW_W } from './window'
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
  test('Game: New game, Help, the sound, the music and the volume, each doing its own; no view to step', async () => {
    const g = hero()
    expect(click(g, GAME, 'new')).toEqual({ ui: GAME, actions: [{ kind: 'panel', panel: 'start' }], sound: ON })
    expect(click(g, GAME, 'help')).toEqual({ ui: GAME, actions: [], sound: ON, isHelp: true })
    expect(click(g, GAME, 'effects')).toEqual({ ui: GAME, actions: [], sound: { ...ON, effects: false } })
    expect(click(g, GAME, 'music')).toEqual({ ui: GAME, actions: [], sound: { ...ON, music: false } })
    expect(settingsRect(g, ON, GAME, 'view' as never)).toBeUndefined()
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
    for (const [a, b] of [['new', 'help'], ['effects', 'music']] as const) {
      expect([r(GAME, a).y === r(GAME, b).y, r(GAME, a).x + r(GAME, a).w < r(GAME, b).x, r(GAME, b).x + r(GAME, b).w <= WINDOW_W - 3]).toEqual([true, true, true])
    }
    // The volume alone on the third row, under the first column.
    expect([r(GAME, 'volume').y > r(GAME, 'effects').y, r(GAME, 'volume').x]).toEqual([true, r(GAME, 'new').x])
    expect(r(ORDERS, 'smoke').y).toBeGreaterThan(r(ORDERS, 'drink').y)
    expect(r(ORDERS, 'leave').y).toBeGreaterThan(r(ORDERS, 'smoke').y)
  })

  test('a click on a page\'s tab shows that page', async () => {
    // In terminal text from column 2 under the title bar: GAME on columns 2 to 7, ORDERS on 9 to 16.
    expect(settingsGesture(hero(), ON, GAME, tap(12, WINDOW_TOP + 4)).ui).toEqual(ORDERS)
    expect(settingsGesture(hero(), ON, ORDERS, tap(4, WINDOW_TOP + 4)).ui).toEqual(GAME)
    expect(settingsOverlay(hero(), ON, ORDERS).filter(b => b.role === 'tabs').map(b => b.lines[0]!.map(r => r.text).join(''))).toEqual(['GAME', 'ORDERS'])
  })

  test('a column\'s buttons line up: one left edge and one width, the widest\'s, on either page', async () => {
    const OFF = { ...ON, effects: false, music: false }
    for (const [ui, sound] of [[GAME, ON], [GAME, OFF], [ORDERS, ON]] as const) {
      const buttons = buttonsIn(settingsOverlay(hero(), sound, ui))
      // Two to a row on Game (left then right), one on Orders.
      const perRow = ui === GAME ? 2 : 1
      for (let col = 0; col < perRow; col += 1) {
        const column = buttons.filter((_, i) => i % perRow === col)
        expect([...new Set(column.map(b => `${b.x},${b.w}`))]).toHaveLength(1)
      }
    }
    // Orders' widest, DRINK AT QUARTER HP: 19 cells, with the room and the frame 23.
    expect(buttonsIn(settingsOverlay(hero(), ON, ORDERS)).map(b => b.w)).toEqual([23, 23, 23])
  })

  test('each order button says the order as it stands', async () => {
    const said = (orders: Game['orders']) => buttonsIn(settingsOverlay(hero({ orders }), ON, ORDERS)).map(b => b.text)
    const base = { drink: 25, smoke: false, leave: 'common', play: 'session' } as const
    expect(said(undefined)).toEqual(['DRINK AT QUARTER HP', 'SMOKE NEVER', 'TAKE ALL LOOT'])
    expect(said(base)).toEqual(said(undefined))
    expect(said({ drink: 50, smoke: true, leave: 'rare', play: 'session' })).toEqual(['DRINK AT HALF HP', 'SMOKE WHEN LOW', 'LEAVE BELOW RARE'])
  })

  test('the volume steps a quarter up, from full back round to a quarter; effects and music flip and flip back', async () => {
    const steps = [1, 2, 3, 4].map(volume => nextSound({ ...ON, volume }, 'volume').volume)
    expect(steps).toEqual([2, 3, 4, 1])
    expect(nextSound(nextSound(ON, 'effects'), 'effects')).toEqual(ON)
    expect(nextSound(nextSound(ON, 'music'), 'music')).toEqual(ON)
  })

  test('each sound button says how the sound is set', async () => {
    const said = (s: SoundSettings) => buttonsIn(settingsOverlay(hero(), s)).map(b => b.text).filter(t => /^(SOUND|MUSIC|VOL) /.test(t))
    expect(said(ON)).toEqual(['SOUND ON', 'MUSIC ON', `VOL ${(100 * ON.volume) / VOLUME_STEPS}`])
    expect(said({ ...ON, effects: false, music: false, volume: 2 })).toEqual(['SOUND OFF', 'MUSIC OFF', 'VOL 50'])
  })

  test('Help draws its key in gold where it stands', async () => {
    const r = settingsRect(hero(), ON, GAME, 'help')!
    expect(buttonsIn(settingsOverlay(hero(), ON)).find(b => b.x === r.x && b.y === r.y)).toMatchObject({ text: 'HELP', isLit: true })
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

describe('the settings window\'s words', () => {
  const g = newGame(4)
  const sound: SoundSettings = { effects: true, music: true, volume: VOLUME_STEPS }
  const about = (ui: SettingsUi) => settingsOverlay(g, sound, ui).find(b => b.role === 'about')
  const said = (ui: SettingsUi) => about(ui)?.lines.map(l => l.map(r => r.text).join('')).join(' ') ?? ''

  test('say under the buttons what each of the page\'s does', async () => {
    for (const word of ['New game', 'Help', 'Sound', 'Music', 'Volume']) expect(said({ page: 'game' })).toContain(word)
    for (const word of ['Drink', 'Smoke', 'Loot']) expect(said({ page: 'orders' })).toContain(word)
  })

  test('name each button bright and say what it does dimmed, as the other windows\' boxes do', async () => {
    const lead = (page: SettingsUi['page']) => about({ page })!.lines.map(l => [l[0]!.text, l[0]!.dim === true, l.slice(1).every(r => r.dim === true)])
    expect(lead('game')).toEqual([['New game', false, true], ['Help', false, true], ['Sound', false, true], ['Volume', false, true]])
    expect(lead('orders').slice(1)).toEqual([['Drink:', false, true], ['Smoke:', false, true], ['Loot:', false, true]])
  })

  test('stand 2 px under the last row of buttons, across the window, the window one height on both pages', async () => {
    for (const page of ['game', 'orders'] as const) {
      const box = about({ page })!
      const buttons = settingsOverlay(g, sound, { page }).filter(b => b.role === 'button')
      const bottom = Math.max(...buttons.map(b => b.y + b.h)) * 2
      expect([page, box.y * 2, box.x, box.w]).toEqual([page, bottom + 2, 2, WINDOW_W - 4])
      expect(settingsPixels(g, sound, { page }).length).toBe(SETTINGS_H)
    }
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
