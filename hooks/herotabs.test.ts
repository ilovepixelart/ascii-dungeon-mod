import { describe, expect, test } from 'claude-code/testing'

import type { Game } from '../types'
import { BAG_UI_IDLE, bagGesture, bagOverlay, inventoryHot } from './bagui'
import { inventoryScreenPixels } from './inventory'
import { plainItem } from './items'
import { BASES } from './items/catalog'
import { sheetGesture } from './sheet'
import { codexGesture } from './codexwindow'
import { CLOSE_BOX, WINDOW_W, chromeBoxes } from './window'
import type { Gesture } from './window'
import { SURFACE } from './ui/tokens'
import { newGame } from './world'

const hero = (over: Partial<Game> = {}): Game => ({ ...newGame(1, 'knight'), ...over })
/** A click on the pixel at px, py, as the click layer reports it: in cells, a cell a pixel across and two down. */
const tap = (px: number, py: number): Gesture => ({ type: 'release', from: { x: px + 0.5, y: py / 2 + 0.25 }, at: { x: px + 0.5, y: py / 2 + 0.25 }, button: 'left' })
/** Each tab's first and last column, worked by hand: from column 2, a label with a column each side, a column between. */
const COLUMNS = { HERO: [2, 7], BAG: [9, 13], TALENT: [15, 22], DEEP: [24, 29], CODEX: [31, 37] } as const
const onTab = (label: keyof typeof COLUMNS) => tap(COLUMNS[label][0] + 1, 4)

describe('the hero\'s tabs', () => {
  test('read HERO, BAG, TALENT, DEEP and CODEX in terminal text, the one shown bright, each over its letters alone, clear of the gold and the close box', async () => {
    const tabs = chromeBoxes(inventoryScreenPixels(hero())).filter(b => b.role === 'title')
    const text = (b: (typeof tabs)[number]) => b.lines[0]!.map(r => r.text).join('')
    expect(tabs.map(text)).toEqual(['HERO', 'BAG', 'TALENT', 'DEEP', 'CODEX'])
    expect(tabs.filter(b => b.lines[0]![0]!.bold === true).map(text)).toEqual(['BAG'])
    // Each label's letters, as the click layer writes a box's, on the bar's middle row: a tab's first and last columns
    // are left to the pixels.
    expect(tabs.map(b => [b.x + 1, b.x + b.w - 2, b.y + 1])).toEqual(Object.values(COLUMNS).map(([from, to]) => [from + 1, to - 1, 2]))
    // The bag's gold starts 41 pixels from the right edge; the close box after it.
    const end = tabs.at(-1)!.x + tabs.at(-1)!.w - 1
    expect(end).toBeLessThan(WINDOW_W - 41)
    expect(end).toBeLessThan(CLOSE_BOX[0])
  })

  test('in the bag, a click on another tab opens its window; on BAG itself, nothing', async () => {
    const g = hero()
    const on = (label: keyof typeof COLUMNS) => bagGesture(g, BAG_UI_IDLE, onTab(label)).actions
    expect([on('HERO'), on('TALENT'), on('DEEP'), on('CODEX')]).toEqual([
      [{ kind: 'panel', panel: 'sheet' }],
      [{ kind: 'panel', panel: 'talent' }],
      [{ kind: 'panel', panel: 'deep' }],
      [{ kind: 'panel', panel: 'codex' }],
    ])
    expect(on('BAG')).toEqual([])
  })

  test('the sheet\'s and the codex\'s BAG tab opens the bag', async () => {
    expect(sheetGesture(hero(), onTab('BAG'))).toEqual([{ kind: 'panel', panel: 'bag' }])
    expect(codexGesture(hero(), { page: 'foes' }, onTab('BAG')).actions).toEqual([{ kind: 'panel', panel: 'bag' }])
  })

  test('the bag draws its own tab chosen: the tab\'s ground over BAG\'s columns, the bar\'s over HERO\'s', async () => {
    const px = inventoryScreenPixels(hero())
    expect(px[1]![COLUMNS.BAG[0]]).toBe(SURFACE.tab)
    expect(px[1]![COLUMNS.HERO[0]]).not.toBe(SURFACE.tab)
  })

  test('the bag lights its other four tabs, and none with an item\'s menu open', async () => {
    const g = hero()
    const tops = inventoryHot(g, BAG_UI_IDLE).filter(r => r.y === 0).map(r => [r.x, r.x + r.w - 1])
    expect(tops).toEqual([COLUMNS.HERO, COLUMNS.TALENT, COLUMNS.DEEP, COLUMNS.CODEX])
    const item = { ...plainItem(g, 'steelHelm', 'common'), x: 0, y: 0 }
    expect(inventoryHot({ ...g, bag: [item], cursor: item.id }, { menu: { id: item.id, confirm: false }, drag: null })).toEqual([])
  })

  test('in the bag, no card or menu over an item at the bag\'s top left covers the tabs', async () => {
    // The tabs' row in cells: rows 0 to 4, columns 2 to 37.
    const onTabs = (b: { x: number; y: number; w: number; h: number }) => b.y < 5 && b.x < 38 && b.x + b.w > 2
    const covering = BASES.flatMap(base => {
      const g = hero()
      const item = { ...plainItem(g, base.key, 'epic'), x: 0, y: 0 }
      const bag = { ...g, bag: [item], cursor: item.id }
      return [...bagOverlay(bag, BAG_UI_IDLE), ...bagOverlay(bag, { menu: { id: item.id, confirm: false }, drag: null })].filter(onTabs).map(b => `${base.key} ${b.role}`)
    })
    expect(covering).toEqual([])
  })
})
