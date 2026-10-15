import { describe, expect, test } from 'claude-code/testing'

import type { Game } from '../types'
import { GOLD_INK } from './pieces'
import { CODEX_RECT, RETIRE_RECT, SHEET_H, TALENT_RECT, plusRect, sheetGesture, sheetOverlay, sheetPixels } from './sheet'
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

  test('Codex opens the codex, under the attribute rows and inside the window', async () => {
    const r = CODEX_RECT
    expect(sheetGesture(hero(), tap(r.x + 2, r.y + 4))).toEqual([{ kind: 'panel', panel: 'codex' }])
    expect(r.y).toBeGreaterThan(plusRect(3).y + 11)
    expect(r.y + r.h).toBeLessThanOrEqual(SHEET_H)
    const lit = sheetPixels(hero()).slice(r.y, r.y + r.h).some(row => row.slice(r.x, r.x + 8).includes(GOLD_INK))
    expect(lit).toBe(true)
  })

  test('Retire opens the retire window once a big boss is slain, lit; before, it is dark and does nothing', async () => {
    const r = RETIRE_RECT
    const lit = (g: Game) => sheetPixels(g).slice(r.y, r.y + r.h).some(row => row.slice(r.x, r.x + 8).includes(GOLD_INK))
    expect(sheetGesture(hero({ bossSlain: 10 }), tap(r.x + 2, r.y + 4))).toEqual([{ kind: 'panel', panel: 'retire' }])
    expect(lit(hero({ bossSlain: 10 }))).toBe(true)
    expect(sheetGesture(hero({ bossSlain: 5 }), tap(r.x + 2, r.y + 4))).toEqual([])
    expect(lit(hero({ bossSlain: 5 }))).toBe(false)
    expect(r.x).toBeGreaterThan(CODEX_RECT.x + CODEX_RECT.w)
    expect(r.x + r.w).toBeLessThanOrEqual(WINDOW_W)
  })

  test('Talent opens the talent window, framed white while one is owed, under Codex and inside the window', async () => {
    const r = TALENT_RECT
    expect(sheetGesture(hero(), tap(r.x + 2, r.y + 4))).toEqual([{ kind: 'panel', panel: 'talent' }])
    const edge = (g: Game) => sheetPixels(g)[r.y]![r.x + 4]
    expect(edge(hero({ level: 10 }))).toBe('#ffffff')
    expect(edge(hero({ level: 9 }))).not.toBe('#ffffff')
    expect(r.y).toBeGreaterThan(CODEX_RECT.y + CODEX_RECT.h)
    expect(r.y + r.h).toBeLessThanOrEqual(SHEET_H)
  })

  test('the + keys are lit only with points to spend', async () => {
    const key = (g: Game) => sheetPixels(g).slice(plusRect(0).y, plusRect(0).y + 11).some(row => row.slice(plusRect(0).x, plusRect(0).x + 8).includes(GOLD_INK))
    expect(key(hero({ points: 1 }))).toBe(true)
    expect(key(hero({ points: 0 }))).toBe(false)
  })

  test('says who the hero is, what they have to spend, and what each attribute does beside its row', async () => {
    const g = hero({ level: 5, points: 3 })
    const [head, effects] = sheetOverlay(g).map(b => b.lines.map(l => l.map(r => r.text).join('')))
    expect(head?.[0]).toMatch(/^Level 5 Knight/)
    expect(head?.[2]).toBe('3 points to spend')
    expect(sheetOverlay(hero({ points: 1 }))[0]!.lines[2]![0]!.text).toBe('1 point to spend')
    // A new knight: half its 3 Might, rounded down, and the Short Sword's 2.
    expect(effects?.filter(l => l !== '')).toEqual(['+3 attack (half Might + gear)', '3% critical hit chance', '+3 max HP per point', '+0% XP from kills'])
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
