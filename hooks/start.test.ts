import { describe, expect, test } from 'claude-code/testing'

import type { Game } from '../types'
import { apply } from './game'
import { CURSOR, buttonW } from './pieces'
import { buttonsIn } from './fixtures'
import { openingGame } from './save'
import { CLASSES, STATS_LINE, cardRect, isFirstGame, isUnderWay, startGesture, startHeight, startOverlay, startPixels } from './start'
import { plainItem } from './items'
import { CLOSE_BOX, HEAD_H, WINDOW_W, windowPixels } from './window'
import type { Gesture } from './window'
import { newGame } from './world'

const onStart = (over: Partial<Game> = {}): Game => ({ ...newGame(3, 'knight'), panel: 'start', ...over })
const tap = (px: number, py: number): Gesture => ({ type: 'release', from: { x: px + 0.5, y: py / 2 + 0.25 }, at: { x: px + 0.5, y: py / 2 + 0.25 }, button: 'left' })
const onCard = (i: number) => tap(cardRect(i).x + 5, cardRect(i).y + 5)
/** The buttons' row: its top, and each button's left, in window pixels. */
const keyColumns = (g: Game) => {
  const buttons = buttonsIn(startOverlay(g, { cls: 'knight' }))
  return buttons.length === 0 ? undefined : { y: buttons[0]!.y, xs: buttons.map(b => b.x) }
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

  test('the buttons sit in a centered row: Start and Help, then Back only with a game under way', async () => {
    const first = onStart()
    expect(isUnderWay(first)).toBe(false)
    expect(isUnderWay({ ...first, xp: 3 })).toBe(true)
    expect(isUnderWay({ ...first, deepest: 2 })).toBe(true)
    const [s, h, b] = [buttonW('S', 'START'), buttonW('H', 'HELP'), buttonW('B', 'BACK')]
    // A first game: Start, 3 pixels, Help, the pair centered, 3 pixels under the cards.
    const x0 = Math.floor((WINDOW_W - s - 3 - h) / 2)
    const keys = keyColumns(first)!
    expect(buttonsIn(startOverlay(first, { cls: 'knight' })).map(b => b.text)).toEqual(['S START', 'H HELP'])
    expect(keys.xs).toEqual([x0, x0 + s + 3])
    expect(keys.y).toBe(cardRect(0).y + cardRect(0).h + 3)
    expect(startGesture(first, { cls: 'mage' }, tap(x0 + 1, keys.y + 2)).actions).toEqual([{ kind: 'restart', cls: 'mage' }])
    // Under way: Start, Help and Back, the three centered.
    const going = { ...first, xp: 3 }
    const y0 = Math.floor((WINDOW_W - s - h - b - 6) / 2)
    const back = y0 + s + 3 + h + 3
    expect(startGesture(going, { cls: 'knight' }, tap(back + 1, keys.y + 2)).actions).toEqual([{ kind: 'panel', panel: 'start' }])
    expect(startGesture(first, { cls: 'knight' }, tap(back + 1, keys.y + 2)).actions).toEqual([])
    const [x, y] = CLOSE_BOX
    expect(startGesture(first, { cls: 'knight' }, tap(x + 2, y + 2)).actions).toEqual([{ kind: 'panel', panel: 'start' }])
  })

  test('Help asks for the how-it-plays window and leaves the game and the chosen hero as they were', async () => {
    for (const g of [onStart(), onStart({ xp: 3 })]) {
      const s = buttonW('S', 'START')
      const left = Math.floor((WINDOW_W - s - 3 - buttonW('H', 'HELP') - (isUnderWay(g) ? 3 + buttonW('B', 'BACK') : 0)) / 2)
      expect(startGesture(g, { cls: 'rogue' }, tap(left + s + 3 + 2, keyColumns(g)!.y + 2))).toEqual({ ui: { cls: 'rogue' }, actions: [], isHelp: true })
    }
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
      expect(px.length).toBe(startHeight(onStart(), { cls }))
      expect(px.length % 2).toBe(0)
      for (const row of px) expect(row.length).toBe(WINDOW_W)
    }
  })

  test('is titled ASCII DUNGEON in its title bar', async () => {
    const px = startPixels(onStart(), { cls: 'knight' })
    const bar = windowPixels({ title: 'ASCII DUNGEON' }, []).px
    expect(px.slice(0, HEAD_H)).toEqual(bar.slice(0, HEAD_H))
  })

  test('fits in 40 rows: every hero, a first game or one under way, with an heirloom or none', async () => {
    const g0 = onStart()
    const heirloom = { ...plainItem(g0, 'ring', 'rare'), name: 'Band of Old Days' }
    for (const g of [g0, onStart({ xp: 3 }), onStart({ heirloom })]) for (const cls of CLASSES) expect(startHeight(g, { cls })).toBeLessThanOrEqual(80)
  })

  test('frames Help white on a first game only', async () => {
    const helpEdge = (g: Game) => {
      const s = buttonW('S', 'START')
      const left = Math.floor((WINDOW_W - s - 3 - buttonW('H', 'HELP') - (isUnderWay(g) ? 3 + buttonW('B', 'BACK') : 0)) / 2)
      return startPixels(g, { cls: 'knight' })[cardRect(0).y + cardRect(0).h + 3]![left + s + 3 + 4]
    }
    const first = onStart()
    expect(isFirstGame(first)).toBe(true)
    expect(helpEdge(first)).toBe(CURSOR)
    const later = onStart({ codex: apply(onStart({ panel: 'none' }), { kind: 'restart', cls: 'mage' }).codex })
    expect(later.codex).toBeDefined()
    expect(isFirstGame(later)).toBe(false)
    expect(helpEdge(later)).not.toBe(CURSOR)
    expect(helpEdge(onStart({ xp: 3 }))).not.toBe(CURSOR)
  })

  test('says what each attribute does, under the hero\'s lines', async () => {
    const lines = startOverlay(onStart(), { cls: 'mage' })[0]!.lines.map(l => l.map(r => r.text).join(''))
    expect(lines.at(-1)).toBe('Might: harder hits. Focus: crits. Vigor: HP. Insight: XP.')
    expect(STATS_LINE).toBe(lines.at(-1))
  })

  test('names a retired hero\'s heirloom: worn from the start, or in the bag when the class cannot wear it', async () => {
    const g0 = onStart()
    const ring = { ...plainItem(g0, 'ring', 'rare'), name: 'Band of Old Days' }
    const plate = { ...plainItem(g0, 'plate', 'rare'), name: 'Plate of Old Days', cls: 'knight' as const }
    const last = (g: Game, cls: 'knight' | 'mage') => startOverlay(g, { cls })[0]!.lines.at(-1)!.map(r => r.text).join('')
    expect(last({ ...g0, heirloom: ring }, 'mage')).toBe('Heirloom: Band of Old Days, worn from the start.')
    expect(last({ ...g0, heirloom: plate }, 'knight')).toBe('Heirloom: Plate of Old Days, worn from the start.')
    expect(last({ ...g0, heirloom: plate }, 'mage')).toBe('Heirloom: Plate of Old Days, in the bag from the start.')
    expect(last(g0, 'mage')).toBe(STATS_LINE)
    // The heirloom takes the attributes' line: a veteran knows them.
    expect(startOverlay({ ...g0, heirloom: ring }, { cls: 'mage' })[0]!.lines.map(l => l.map(r => r.text).join(''))).toEqual([
      'Mage: Siphon, each kill restores a fifth of max HP.',
      '+3 Insight, +1 Focus. Ash Staff, Tome of Sparks, Robe, Pointed Hat.',
      'Heirloom: Band of Old Days, worn from the start.',
    ])
  })
})
