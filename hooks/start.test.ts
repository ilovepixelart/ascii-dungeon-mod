import { describe, expect, test } from 'claude-code/testing'

import type { Game } from '../types'
import { apply } from './game'
import { CURSOR, GOLD_INK, buttonW } from './pieces'
import { openingGame } from './save'
import { CLASSES, cardRect, isUnderWay, startGesture, startHeight, startPixels } from './start'
import { CLOSE_BOX, WINDOW_W } from './window'
import type { Gesture } from './window'
import { newGame } from './world'

const onStart = (over: Partial<Game> = {}): Game => ({ ...newGame(3, 'knight'), panel: 'start', ...over })
const tap = (px: number, py: number): Gesture => ({ type: 'release', from: { x: px + 0.5, y: py / 2 + 0.25 }, at: { x: px + 0.5, y: py / 2 + 0.25 }, button: 'left' })
const onCard = (i: number) => tap(cardRect(i).x + 5, cardRect(i).y + 5)
/** The Start and Back buttons' row: the first rows inked in a button key's gold under the cards. */
const keyColumns = (g: Game) => {
  const px = startPixels(g, { cls: 'knight' })
  const y0 = cardRect(0).y + cardRect(0).h + 3
  for (let y = y0; y < y0 + 11; y += 1) {
    const xs = px[y]!.flatMap((p, x) => (p === GOLD_INK ? [x] : []))
    if (xs.length > 0) return { y, xs }
  }
  return undefined
}

describe('opening a session', () => {
  test('a first game opens on the start screen; a saved one as it was saved; a game already set is left alone', async () => {
    const fresh = newGame(1)
    expect(openingGame(fresh, 0, undefined)?.panel).toBe('start')
    const saved = { ...newGame(2, 'rogue'), panel: 'none' as const, gold: 40 }
    expect(openingGame(fresh, 0, saved)).toBe(saved)
    expect(openingGame(fresh, 3, undefined)).toBeUndefined()
    expect(openingGame(fresh, 3, saved)).toBeUndefined()
  })
})

describe('the dungeon behind it', () => {
  test('waits: tool calls, fights, walks and descents change nothing while it is open', async () => {
    const g = onStart()
    for (const action of [{ kind: 'summon', name: 'ls' }, { kind: 'outcome', ok: false, what: 'Bash' }, { kind: 'explore', steps: 3 }, { kind: 'descend' }, { kind: 'portal' }] as const) {
      expect(apply(g, action)).toBe(g)
    }
  })

  test('lets through a new game, closing it, and the view key', async () => {
    const g = onStart()
    expect(apply(g, { kind: 'restart', cls: 'mage' })).toMatchObject({ cls: 'mage', panel: 'none' })
    expect(apply(g, { kind: 'panel', panel: 'start' }).panel).toBe('none')
    expect(apply(g, { kind: 'zoom' }).zoom).not.toBe(g.zoom)
  })

  test('with it closed, a tool call plays again', async () => {
    const g = { ...onStart(), panel: 'none' as const }
    expect(apply(g, { kind: 'summon', name: 'ls' }).foe).not.toBeNull()
  })
})

describe('choosing', () => {
  test('a card chooses its hero; the chosen one clicked again starts a new game as it', async () => {
    const g = onStart()
    expect(startGesture(g, { cls: 'knight' }, onCard(1))).toEqual({ ui: { cls: 'mage' }, actions: [] })
    expect(startGesture(g, { cls: 'mage' }, onCard(1))).toEqual({ ui: { cls: 'mage' }, actions: [{ kind: 'restart', cls: 'mage' }] })
    expect(startGesture(g, { cls: 'knight' }, onCard(2)).ui).toEqual({ cls: 'rogue' })
  })

  test('Start starts as the chosen hero', async () => {
    const g = onStart()
    const keys = keyColumns(g)!
    expect(startGesture(g, { cls: 'rogue' }, tap(keys.xs[0]! + 1, keys.y + 2)).actions).toEqual([{ kind: 'restart', cls: 'rogue' }])
  })

  test('Back is there only with a game under way, and leaves it as it was; the close box too', async () => {
    const first = onStart()
    expect(isUnderWay(first)).toBe(false)
    expect(isUnderWay({ ...first, xp: 3 })).toBe(true)
    expect(isUnderWay({ ...first, deepest: 2 })).toBe(true)
    // A first game: Start alone, centered; under way, Start and Back.
    const alone = keyColumns(first)!
    const both = keyColumns({ ...first, xp: 3 })!
    const span = (k: { xs: number[] }) => Math.max(...k.xs) - Math.min(...k.xs)
    expect(span(both)).toBeGreaterThan(span(alone) + 20)
    // Back's left edge: Start is 31 wide from x 2, Back 3 past it; on a first game Start, centered, begins one further on.
    const back = 2 + buttonW('S', 'START') + 3
    expect(startGesture({ ...first, xp: 3 }, { cls: 'knight' }, tap(back, both.y + 2)).actions).toEqual([{ kind: 'panel', panel: 'start' }])
    expect(startGesture(first, { cls: 'knight' }, tap(back, both.y + 2)).actions).toEqual([])
    // Where Back would sit beside a centered Start: nothing there on a first game.
    const centered = Math.floor((WINDOW_W - buttonW('S', 'START')) / 2)
    expect(startGesture(first, { cls: 'knight' }, tap(centered + buttonW('S', 'START') + 5, both.y + 2)).actions).toEqual([])
    const [x, y] = CLOSE_BOX
    expect(startGesture(first, { cls: 'knight' }, tap(x + 2, y + 2)).actions).toEqual([{ kind: 'panel', panel: 'start' }])
  })

  test('a drag, or a click on nothing, does nothing', async () => {
    const g = onStart()
    expect(startGesture(g, { cls: 'knight' }, { type: 'drag', from: { x: 10, y: 20 }, at: { x: 40, y: 20 } }).actions).toEqual([])
    expect(startGesture(g, { cls: 'knight' }, tap(WINDOW_W - 3, 20))).toEqual({ ui: { cls: 'knight' }, actions: [] })
  })
})

describe('the screen', () => {
  test('frames the chosen hero\'s card white, the others not', async () => {
    for (const cls of CLASSES) {
      const px = startPixels(onStart(), { cls })
      CLASSES.forEach((other, i) => {
        const r = cardRect(i)
        expect(px[r.y]?.[r.x + 5] === CURSOR).toBe(other === cls)
      })
    }
  })

  test('is WINDOW_W wide and a whole number of cells tall', async () => {
    for (const cls of CLASSES) {
      const px = startPixels(onStart(), { cls })
      expect(px.length).toBe(startHeight({ cls }))
      expect(px.length % 2).toBe(0)
      for (const row of px) expect(row.length).toBe(WINDOW_W)
    }
  })
})
