import { describe, expect, test } from 'claude-code/testing'

import type { Game } from '../types'
import { GOLD_INK } from './pieces'
import { SETTINGS_H, VOLUME_STEPS, nextSound, settingsGesture, settingsPixels } from './settings'
import type { SoundSettings } from './settings'
import { CLOSE_BOX, WINDOW_W } from './window'
import type { Gesture } from './window'
import { newGame } from './world'

const ON: SoundSettings = { effects: true, music: true, volume: VOLUME_STEPS }
const hero = (over: Partial<Game> = {}): Game => ({ ...newGame(1, 'knight'), panel: 'settings', ...over })
const tap = (px: number, py: number): Gesture => ({ type: 'release', from: { x: px + 0.5, y: py / 2 + 0.25 }, at: { x: px + 0.5, y: py / 2 + 0.25 }, button: 'left' })
/** Each button's row: the rows a button key's gold first shows on, top to bottom. */
const keyRows = (px: string[][]) => {
  const rows: number[] = []
  px.forEach((row, y) => {
    if (row.slice(3, 12).includes(GOLD_INK) && !px[y - 1]?.slice(3, 12).includes(GOLD_INK)) rows.push(y)
  })
  return rows
}

describe('the settings window', () => {
  test('has five buttons, top to bottom: New game, View, Effects, Music, Volume, each doing its own', async () => {
    const g = hero()
    const rows = keyRows(settingsPixels(g, ON))
    expect(rows).toHaveLength(5)
    const at = (i: number) => settingsGesture(g, ON, tap(6, rows[i]! + 1))
    expect(at(0)).toEqual({ actions: [{ kind: 'panel', panel: 'start' }], sound: ON })
    expect(at(1)).toEqual({ actions: [{ kind: 'zoom' }], sound: ON })
    expect(at(2)).toEqual({ actions: [], sound: { ...ON, effects: false } })
    expect(at(3)).toEqual({ actions: [], sound: { ...ON, music: false } })
    expect(at(4)).toEqual({ actions: [], sound: { ...ON, volume: 1 } })
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

  test('the close box closes it; a drag or a click on nothing does nothing', async () => {
    const g = hero()
    const [x, y] = CLOSE_BOX
    expect(settingsGesture(g, ON, tap(x + 2, y + 2)).actions).toEqual([{ kind: 'panel', panel: 'settings' }])
    expect(settingsGesture(g, ON, { type: 'drag', from: { x: 5, y: 10 }, at: { x: 40, y: 10 } })).toEqual({ actions: [], sound: ON })
    expect(settingsGesture(g, ON, tap(WINDOW_W - 4, SETTINGS_H - 4))).toEqual({ actions: [], sound: ON })
  })

  test('is WINDOW_W wide and a whole number of cells tall', async () => {
    const px = settingsPixels(hero(), ON)
    expect(px.length).toBe(SETTINGS_H)
    expect(SETTINGS_H % 2).toBe(0)
    for (const row of px) expect(row.length).toBe(WINDOW_W)
  })
})
