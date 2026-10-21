import { describe, expect, test } from 'claude-code/testing'

import type { Game } from '../types'
import { BAG_UI_IDLE, bagGesture, inventoryHot } from './bagui'
import { heroTabsBox } from './herotabs'
import { inventoryScreenPixels } from './inventory'
import { plainItem } from './items'
import { sheetGesture } from './sheet'
import { codexGesture } from './codexwindow'
import { CLOSE_BOX, WINDOW_W } from './window'
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
  test('read HERO, BAG, TALENT, DEEP and CODEX in terminal text, the one shown bright, the row clear of the gold and the close box', async () => {
    const box = heroTabsBox(hero(), 'bag')
    const line = box.lines[0]!
    expect(line.map(r => r.text).join('')).toBe(' HERO   BAG   TALENT   DEEP   CODEX ')
    expect(line.filter(r => r.bold === true).map(r => r.text)).toEqual([' BAG '])
    // Its text from column 2 on the bar's middle row (pixels 4 and 5), as the click layer writes a box's.
    expect([box.x + 1, box.y + 1, box.x + box.w - 1]).toEqual([2, 2, 38])
    // The bag's gold starts 41 pixels from the right edge; the close box after it.
    expect(box.x + box.w - 1).toBeLessThan(WINDOW_W - 41)
    expect(box.x + box.w - 1).toBeLessThan(CLOSE_BOX[0])
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
})
