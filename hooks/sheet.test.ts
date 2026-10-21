import { describe, expect, test } from 'claude-code/testing'

import type { Game } from '../types'
import { GOLD_INK } from './pieces'
import { textMask } from './pixelart'
import { RETIRE_RECT, SHEET_H, plusRect, sheetGesture, sheetOverlay, sheetPixels } from './sheet'
import { CLOSE_BOX, WINDOW_W } from './window'
import type { Gesture } from './window'
import { newGame } from './world'

const hero = (over: Partial<Game> = {}): Game => ({ ...newGame(1, 'knight'), ...over })
const tap = (px: number, py: number): Gesture => ({ type: 'release', from: { x: px + 0.5, y: py / 2 + 0.25 }, at: { x: px + 0.5, y: py / 2 + 0.25 }, button: 'left' })
const onPlus = (i: number) => tap(plusRect(i).x + 2, plusRect(i).y + 4)

describe('the character sheet', () => {
  test('a + trains its attribute while there are points; with none it does nothing', async () => {
    const stats = ['might', 'focus', 'vigor', 'insight'] as const
    stats.forEach((stat, i) => expect(sheetGesture(hero({ points: 2 }), onPlus(i))).toEqual([{ kind: 'train', stat }]))
    expect(sheetGesture(hero({ points: 0 }), onPlus(0))).toEqual([])
  })

  test('the close box closes the sheet; a drag does nothing; New game is not here but in settings', async () => {
    const g = hero()
    const [x, y] = CLOSE_BOX
    expect(sheetGesture(g, tap(x + 2, y + 2))).toEqual([{ kind: 'panel', panel: 'sheet' }])
    expect(sheetGesture(g, { type: 'drag', from: { x: 5, y: 30 }, at: { x: 40, y: 30 } })).toEqual([])
    for (let py = 0; py < SHEET_H; py += 2) expect(sheetGesture(g, tap(5, py))).not.toContainEqual({ kind: 'panel', panel: 'start' })
  })

  /** Each tab's first and last column, worked by hand: from column 2, a label with a column each side, a column between. */
  const TABS = [[2, 7], [9, 13], [15, 22], [24, 29], [31, 37]] as const
  const onTab = (i: number) => tap(TABS[i]![0] + 1, 4)

  test('its tabs open the bag, the talents, the deep and the codex; its own tab does nothing', async () => {
    expect([1, 2, 3, 4].map(i => sheetGesture(hero(), onTab(i)))).toEqual([
      [{ kind: 'panel', panel: 'bag' }],
      [{ kind: 'panel', panel: 'talent' }],
      [{ kind: 'panel', panel: 'deep' }],
      [{ kind: 'panel', panel: 'codex' }],
    ])
    expect(sheetGesture(hero(), onTab(0))).toEqual([])
  })

  test('the talents\' tab is marked in gold while one is owed; the deep\'s while a fork waits', async () => {
    // The mark: two gold pixels at the tab's top right, above its label, clear of the next tab.
    const marked = (g: Game, i: number) => sheetPixels(g)[1]![TABS[i]![1] - 1] === GOLD_INK
    expect([marked(hero({ level: 10 }), 2), marked(hero({ level: 9 }), 2)]).toEqual([true, false])
    expect([marked(hero({ bossSlain: 60, deepest: 60 }), 3), marked(hero({ bossSlain: 60, deepest: 60, marks: { 2: 'mild' } }), 3)]).toEqual([true, false])
  })

  test('fits in 40 rows', async () => {
    expect(SHEET_H).toBeLessThanOrEqual(80)
  })

  test('Retire opens the retire window once a big boss is slain, lit; before, it is dark and does nothing', async () => {
    const r = RETIRE_RECT
    const lit = (g: Game) => sheetPixels(g).slice(r.y, r.y + r.h).some(row => row.slice(r.x, r.x + 8).includes(GOLD_INK))
    expect(sheetGesture(hero({ bossSlain: 10 }), tap(r.x + 2, r.y + 4))).toEqual([{ kind: 'panel', panel: 'retire' }])
    expect(lit(hero({ bossSlain: 10 }))).toBe(true)
    expect(sheetGesture(hero({ bossSlain: 5 }), tap(r.x + 2, r.y + 4))).toEqual([])
    expect(lit(hero({ bossSlain: 5 }))).toBe(false)
    expect([r.y > plusRect(3).y + 11, r.x + r.w <= WINDOW_W, r.y + r.h <= SHEET_H]).toEqual([true, true, true])
  })

  test('each + key is the plus alone, centered, no digit beside it', async () => {
    const plus = textMask('+')
    const g = hero({ points: 1 })
    const px = sheetPixels(g)
    for (let i = 0; i < 4; i += 1) {
      const r = plusRect(i)
      expect(r.w).toBe(3 + plus[0]!.length + 3)
      const gold = new Set<string>()
      for (let y = r.y; y < r.y + r.h; y += 1) for (let x = r.x; x < r.x + r.w; x += 1) if (px[y]![x] === GOLD_INK) gold.add(`${x - r.x},${y - r.y}`)
      const want = new Set(plus.flatMap((row, dy) => [...row].flatMap((k, dx) => (k === '#' ? [`${3 + dx},${3 + dy}`] : []))))
      expect([...gold].sort()).toEqual([...want].sort())
    }
  })

  test('the + keys are lit only with points to spend', async () => {
    const key = (g: Game) => sheetPixels(g).slice(plusRect(0).y, plusRect(0).y + 11).some(row => row.slice(plusRect(0).x, plusRect(0).x + 8).includes(GOLD_INK))
    expect(key(hero({ points: 1 }))).toBe(true)
    expect(key(hero({ points: 0 }))).toBe(false)
  })

  test('says who the hero is, how they stand, what Vigor and Insight give, and what they have to spend', async () => {
    const g = hero({ level: 5, points: 3 })
    const head = sheetOverlay(g)[0]!.lines.map(l => l.map(r => r.text).join(''))
    // A new knight: half its 3 Might, rounded down, and the Short Sword's 2; a 3% crit.
    expect(head).toEqual([`Level 5 Knight   HP ${g.hp}/${g.maxHp}`, `Attack +3  Defense ${head[1]!.match(/Defense (\d+)/)![1]}  Crit 3%`, 'Vigor +3 max HP a point, Insight +0% XP', '3 points to spend'])
    expect(sheetOverlay(hero({ points: 1 }))[0]!.lines[3]![0]!.text).toBe('1 point to spend')
  })

  test('is WINDOW_W wide and SHEET_H tall, a whole number of cells', async () => {
    const px = sheetPixels(hero())
    expect(px.length).toBe(SHEET_H)
    expect(SHEET_H % 2).toBe(0)
    for (const row of px) expect(row.length).toBe(WINDOW_W)
  })
})

test('the XP is text on its flat bar, not pixels beside it', async () => {
  const g = hero({ xp: 12 })
  const label = sheetOverlay(g).find(b => b.role === 'label')!
  expect(label.lines[0]!.map(r => r.text).join('')).toMatch(/^12\/\d+$/)
  expect(label.lines[0]!.every(r => r.bg !== undefined)).toBe(true)
})
