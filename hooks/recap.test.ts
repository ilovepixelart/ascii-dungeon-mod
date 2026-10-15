import { describe, expect, test } from 'claude-code/testing'

import type { Game, Recap } from '../types'
import { apply, onToolStart } from './game'
import type { Action } from './game'
import { foeAhead, plainHero } from './fixtures'
import { plainItem } from './items'
import { RECAP_CALLS, noted } from './recap'
import { recapGesture, recapHeight, recapLines } from './recapwindow'
import { CLOSE_BOX, WINDOW_W } from './window'
import { MAP_H } from './map'
import { PX, textMask } from './pixelart'
import { BASES, LEGENDARIES, PREFIXES, SUFFIXES } from './items'

const run = (g: Game, actions: readonly Action[]) => actions.reduce(apply, g)
const outcome = (ok = true, over: Partial<Extract<Action, { kind: 'outcome' }>> = {}): Action => ({ kind: 'outcome', ok, what: 'Edit', ...over })
/** A hero with a one-HP goblin worth 10 XP beside them. */
const facing = (g: Game, over = {}) => ({ ...g, foe: foeAhead(g, 1, { hp: 1, maxHp: 1, xp: 10, opened: true, ...over }) })
const blank: Recap = { calls: 0, depth: 1, level: 1, kills: 0, champions: 0, gold: 0, deaths: 0, tests: 0, commits: 0, pushes: 0, prs: 0 }
const texts = (g: Game) => recapLines(g).map(l => l.text)

describe('what the recap counts', () => {
  test('a tool call that slays a foe: one call, one kill, the gold it paid, from the depth and level it began on', async () => {
    const g = { ...plainHero(3), depth: 4, deepest: 4, level: 2 }
    const after = apply(facing(g), outcome())
    expect(after.recap).toEqual({ ...blank, calls: 1, depth: 4, level: 2, kills: 1, gold: after.gold - g.gold })
    expect(after.gold).toBeGreaterThan(g.gold)
  })

  test('a champion slain counts as a kill and a champion', async () => {
    const after = apply(facing(plainHero(3), { champion: 'tough' }), outcome())
    expect([after.recap?.kills, after.recap?.champions]).toEqual([1, 1])
  })

  test('only tool calls count: a start, its outcome and a turn\'s end do; clicks and keys do not', async () => {
    const g = plainHero(3)
    expect(run(g, [onToolStart('Read', '/a.ts'), outcome(), { kind: 'descend' }]).recap?.calls).toBe(1)
    expect(run(g, [{ kind: 'move', dx: 1, dy: 0 }, { kind: 'zoom' }, { kind: 'panel', panel: 'bag' }]).recap).toBeUndefined()
  })

  test('work that succeeded, by kind; failed work is nothing', async () => {
    const r = run(plainHero(3), [outcome(true, { work: 'tests' }), outcome(true, { work: 'tests' }), outcome(true, { work: 'commit' }), outcome(true, { work: 'push' }), outcome(true, { work: 'pr' }), outcome(false, { work: 'commit' })]).recap
    expect([r?.calls, r?.tests, r?.commits, r?.pushes, r?.prs]).toEqual([6, 2, 1, 1, 1])
  })

  test('a fall: counted, its lost gold not taken from what was gained', async () => {
    const g = { ...plainHero(3), hp: 1, gold: 40 }
    const r = apply({ ...g, foe: foeAhead(g, 1, { atk: 99, opened: true, glyph: 'r' }) }, outcome(false)).recap
    expect([r?.deaths, r?.gold]).toEqual([1, 0])
  })

  test('the best find is the rarest item gained, Rare or better, the stronger of two alike; a lesser one never replaces it', async () => {
    const item = (id: number, rarity: 'common' | 'rare' | 'epic', atk: number) => ({ ...plainItem({ nextId: id }, 'sword', rarity), atk })
    const g = plainHero(3)
    const gaining = (from: Game, ...items: ReturnType<typeof item>[]) => noted(from, { ...from, bag: [...from.bag, ...items] }, { kind: 'explore', steps: 1 }).best
    expect(gaining(g, item(700, 'common', 50))).toBeUndefined()
    expect(gaining(g, item(701, 'rare', 2), item(702, 'epic', 1))?.id).toBe(702)
    expect(gaining(g, item(703, 'rare', 2), item(704, 'rare', 5))?.id).toBe(704)
    const held = { ...g, recap: { ...blank, best: item(705, 'epic', 1) } }
    expect(gaining(held, item(706, 'rare', 40))?.id).toBe(705)
  })

  test('a push brings its cache in as the best find', async () => {
    const after = apply(plainHero(3), outcome(true, { work: 'push' }))
    expect(after.recap?.best?.id).toBe(after.bag.at(-1)?.id)
  })
})

describe('when the recap opens', () => {
  const due = (g: Game, calls: number): Game => ({ ...g, recap: { ...blank, calls } })

  test(`a look after ${RECAP_CALLS} tool calls or more opens it, keeping what it tells`, async () => {
    const after = apply(due(plainHero(3), RECAP_CALLS), { kind: 'look' })
    expect(after.panel).toBe('recap')
    expect(after.recap?.calls).toBe(RECAP_CALLS)
  })

  test('a look after fewer forgets them, opening nothing', async () => {
    const after = apply(due(plainHero(3), RECAP_CALLS - 1), { kind: 'look' })
    expect(after.panel).toBe('none')
    expect(after.recap).toBeUndefined()
  })

  test('the death window is not covered: the look forgets instead', async () => {
    const after = apply({ ...due(plainHero(3), 40), panel: 'death' }, { kind: 'look' })
    expect(after.panel).toBe('death')
    expect(after.recap).toBeUndefined()
  })

  test('closing it, or opening another window over it, forgets what it told', async () => {
    const open = apply(due(plainHero(3), 20), { kind: 'look' })
    const closed = apply(open, { kind: 'panel', panel: 'recap' })
    expect([closed.panel, closed.recap]).toEqual(['none', undefined])
    const bag = apply(open, { kind: 'panel', panel: 'bag' })
    expect([bag.panel, bag.recap]).toEqual(['bag', undefined])
  })
})

describe('the recap window', () => {
  const told: Recap = { calls: 34, depth: 11, level: 17, kills: 21, champions: 2, gold: 412, deaths: 0, tests: 4, commits: 2, pushes: 1, prs: 0 }
  const shown = (r: Recap, over: Partial<Game> = {}): Game => ({ ...plainHero(3), depth: 14, level: 18, panel: 'recap', recap: r, ...over })
  const helm = { ...plainItem({ nextId: 800 }, 'steelHelm', 'epic'), name: 'Steel Helm of Fast Feedback' }

  test('says what happened, as the approved mock does', async () => {
    expect(texts(shown({ ...told, best: helm }))).toEqual([
      '34 TOOL CALLS', 'DEPTH 11 TO 14', 'LEVEL 17 TO 18',
      'KILLS 21', 'GOLD +412', '2 CHAMPIONS', 'DEATHS 0',
      '4 GREEN TEST RUNS', '2 COMMITS  1 PUSH',
      'BEST FIND', 'STEEL HELM OF', 'FAST FEEDBACK',
    ])
  })

  test('one of a thing is said as one; a depth and a level that did not change are said once', async () => {
    const one = { ...told, calls: 12, depth: 14, level: 18, kills: 1, champions: 1, tests: 1, commits: 1, pushes: 2, prs: 1 }
    expect(texts(shown(one))).toEqual(['12 TOOL CALLS', 'DEPTH 14', 'LEVEL 18', 'KILLS 1', 'GOLD +412', '1 CHAMPION', 'DEATHS 0', '1 GREEN TEST RUN', '1 COMMIT  2 PUSHES  1 PR'])
  })

  test('leaves out work and a find when there were none, and champions when none fell', async () => {
    const quiet = { ...told, champions: 0, tests: 0, commits: 0, pushes: 0, prs: 0 }
    expect(texts(shown(quiet))).toEqual(['34 TOOL CALLS', 'DEPTH 11 TO 14', 'LEVEL 17 TO 18', 'KILLS 21', 'GOLD +412', 'DEATHS 0'])
    expect(recapHeight(shown(quiet))).toBeLessThan(recapHeight(shown({ ...told, best: helm })))
  })

  test('fits over the map at its fullest, with the longest name a find can have', async () => {
    const widest = (names: readonly string[]) => [...names].sort((a, b) => textMask(b.toUpperCase())[0]!.length - textMask(a.toUpperCase())[0]!.length)[0]!
    const affixed = [PREFIXES, BASES, SUFFIXES].map(list => widest(list.map(x => x.name))).join(' ')
    const longest = widest([affixed, ...LEGENDARIES.map(l => l.name)])
    const g = shown({ ...told, prs: 3, best: { ...helm, name: longest } })
    expect(recapHeight(g)).toBeLessThanOrEqual(MAP_H * PX)
    const label = recapLines(g).find(m => m.text === 'BEST FIND')!
    const name = recapLines(g).filter(l => l.y > label.y)
    expect(name.map(l => l.text).join(' ')).toBe(longest.toUpperCase())
    expect(Math.max(...name.map(l => textMask(l.text)[0]!.length + l.x))).toBeLessThanOrEqual(WINDOW_W - 3)
  })

  test('Play on and the close box close it; a click elsewhere does nothing', async () => {
    const g = shown({ ...told, best: helm })
    const at = (p: { x: number; y: number }) => recapGesture(g, { type: 'release', from: p, at: p, button: 'left' })
    const h = recapHeight(g)
    expect(at({ x: 6, y: (h - 7) / 2 })).toEqual([{ kind: 'panel', panel: 'recap' }])
    expect(at({ x: CLOSE_BOX[0] + 1, y: (CLOSE_BOX[1] + 1) / 2 })).toEqual([{ kind: 'panel', panel: 'recap' }])
    expect(at({ x: 90, y: (h - 7) / 2 })).toEqual([])
  })
})
