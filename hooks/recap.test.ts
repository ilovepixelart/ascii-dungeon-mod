import { describe, expect, test } from 'claude-code/testing'

import type { Game, Recap } from '../types'
import { apply, onToolStart } from './game'
import type { Action } from './game'
import { foeAhead, plainHero } from './fixtures'
import { plainItem } from './items'
import { RECAP_CALLS, noted } from './recap'
import { recapGesture, recapHeight, recapLines, recapOverlay, recapPixels } from './recapwindow'
import { BG } from './canvas'
import { CLOSE_BOX, WINDOW_TOP, WINDOW_W } from './window'
import { BASES, LEGENDARIES, PREFIXES, RARITY_COLOR, SUFFIXES } from './items'

const run = (g: Game, actions: readonly Action[]) => actions.reduce(apply, g)
const outcome = (ok = true, over: Partial<Extract<Action, { kind: 'outcome' }>> = {}): Action => ({ kind: 'outcome', ok, what: 'Edit', ...over })
/** A hero with a one-HP goblin worth 10 XP beside them. */
const facing = (g: Game, over = {}) => ({ ...g, foe: foeAhead(g, 1, { hp: 1, maxHp: 1, xp: 10, opened: true, ...over }) })
const blank: Recap = { calls: 0, depth: 1, level: 1, kills: 0, champions: 0, gold: 0, deaths: 0, tests: 0, commits: 0, pushes: 0, prs: 0 }
const texts = (g: Game) => recapLines(g)

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

  test('says what happened beside the portrait, and the best find beside its box', async () => {
    expect(texts(shown({ ...told, best: helm }))).toEqual([
      '34 tool calls', 'Depth 11 to 14, level 17 to 18.', '21 kills, 2 champions, +412 gold, 0 deaths.', '4 green test runs, 2 commits, 1 push.',
      'Best find', 'Steel Helm of Fast Feedback',
    ])
  })

  test('frames the best find as wide as the portrait over it, the find inside its frame, its box beside it level with its top', async () => {
    // A Legendary sword, 20 px tall: the portrait 20 square at x 2, 2 under the title bar; the find's frame 20 wide at
    // x 2, 22 tall (18 by 20 inside), 2 under the portrait, on a whole cell; the box beside it starts on that row.
    const sword = { ...plainItem({ nextId: 801 }, 'sword', 'legendary'), name: 'Sword' }
    const g = shown({ ...told, best: sword })
    const px = recapPixels(g)
    const face = WINDOW_TOP + 2
    const findTop = face + 20 + 2
    // The frame's sides, in the Legendary's color, at the portrait's columns; bare ground past them.
    const mid = findTop + 10
    expect([px[mid]![2], px[mid]![21], px[mid]![1], px[mid]![22]]).toEqual([RARITY_COLOR.legendary, RARITY_COLOR.legendary, BG, BG])
    // The frame's top and bottom rows are the tier frame's inks alone: the sword's art stays inside.
    const inks = new Set([...px[findTop]!.slice(3, 21), ...px[findTop + 21]!.slice(3, 21)])
    expect(inks.size).toBeLessThanOrEqual(2)
    expect(px[findTop - 1]![12]).toBe(BG)
    expect(findTop % 2).toBe(0)
    expect(recapOverlay(g).find(b => b.lines[0]![0]!.text === 'Best find')!.y).toBe(findTop / 2)
  })

  test('one of a thing is said as one; a depth and a level that did not change are said once', async () => {
    const one = { ...told, calls: 12, depth: 14, level: 18, kills: 1, champions: 1, tests: 1, commits: 1, pushes: 2, prs: 1 }
    expect(texts(shown(one))).toEqual(['12 tool calls', 'Depth 14, level 18.', '1 kill, 1 champion, +412 gold, 0 deaths.', '1 green test run, 1 commit, 2 pushes, 1 PR.'])
  })

  test('a count of a thousand or more has its thousands set off by commas', async () => {
    expect(texts(shown({ ...told, calls: 1234, kills: 1000, gold: 25000 })).slice(0, 3)).toEqual(['1,234 tool calls', 'Depth 11 to 14, level 17 to 18.', '1,000 kills, 2 champions, +25,000 gold, 0 deaths.'])
  })

  test('leaves out work and a find when there were none, and champions when none fell', async () => {
    const quiet = { ...told, champions: 0, tests: 0, commits: 0, pushes: 0, prs: 0 }
    expect(texts(shown(quiet))).toEqual(['34 tool calls', 'Depth 11 to 14, level 17 to 18.', '21 kills, +412 gold, 0 deaths.'])
    expect(recapHeight(shown(quiet))).toBeLessThan(recapHeight(shown({ ...told, best: helm })))
  })

  test('fits in 40 rows at its fullest, the longest name a find can have whole on its line', async () => {
    const longest = (names: readonly string[]) => [...names].sort((a, b) => b.length - a.length)[0]!
    const affixed = [PREFIXES, BASES, SUFFIXES].map(list => longest(list.map(x => x.name))).join(' ')
    const name = longest([affixed, ...LEGENDARIES.map(l => l.name)])
    const g = shown({ ...told, champions: 3, deaths: 2, prs: 3, best: { ...helm, name } })
    expect(recapHeight(g)).toBeLessThanOrEqual(80)
    for (const b of recapOverlay(g)) for (const line of b.lines) expect(line.map(r => r.text).join('').length).toBeLessThanOrEqual(b.w - 4)
  })

  test('Play on and the close box close it; a click elsewhere does nothing', async () => {
    const g = shown({ ...told, best: helm })
    const at = (p: { x: number; y: number }) => recapGesture(g, { type: 'release', from: p, at: p, button: 'left' })
    const h = recapHeight(g)
    expect(at({ x: WINDOW_W / 2, y: (h - 7) / 2 })).toEqual([{ kind: 'panel', panel: 'recap' }])
    expect(at({ x: CLOSE_BOX[0] + 1, y: (CLOSE_BOX[1] + 1) / 2 })).toEqual([{ kind: 'panel', panel: 'recap' }])
    expect(at({ x: 4, y: (h - 7) / 2 })).toEqual([])
  })
})
