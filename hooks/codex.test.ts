import { describe, expect, test } from 'claude-code/testing'

import type { Codex, Foe, Game } from '../types'
import { apply, firstCodex } from './game'
import type { Action } from './game'
import { foeAhead, plainHero } from './fixtures'
import { BAG_H, BAG_W, LEGENDARIES, plainItem } from './items'
import { EMPTY_CODEX, recorded } from './codex'
import { codexGesture, codexHeight, codexLit, codexOverlay, codexPixels } from './codexwindow'
import type { CodexUi } from './codexwindow'
import { CLOSE_BOX, TABS_H, WINDOW_TOP, tabRects } from './window'

const hit: Action = { kind: 'outcome', ok: true, what: 'Edit' }
/** The hero at `depth` with a one-HP foe beside them, and the codex `codex`. */
const facing = (over: Partial<Foe>, depth = 3, codex: Codex = EMPTY_CODEX, g: Game = plainHero(3)): Game => {
  const at = { ...g, depth, deepest: depth, codex }
  return { ...at, foe: foeAhead(at, 1, { hp: 1, maxHp: 1, opened: true, ...over }) }
}
const UNIQUE: Partial<Foe> = { glyph: 'D', name: 'Emberjaw', unique: 'ember' }
const BIG: Partial<Foe> = { glyph: '&', name: 'Furnace Wyrm', boss: true, big: 'wyrm' }
const duck = (id: number) => ({ ...plainItem({ nextId: id }, 'amulet', 'legendary'), name: LEGENDARIES[1]!.name })

describe('what the codex records', () => {
  test('a kill: one more kill; a unique its key; a big boss its key and a boss; a guardian a boss alone', async () => {
    const plain = facing({})
    const after = apply(plain, hit)
    expect(after.gold).toBeGreaterThan(plain.gold)
    expect(after.codex).toEqual({ ...EMPTY_CODEX, deepest: 3, kills: 1, gold: after.gold - plain.gold })
    expect(apply(facing(UNIQUE), hit).codex).toMatchObject({ uniques: ['ember'], bigs: [], kills: 1, bosses: 0 })
    expect(apply(facing(BIG, 50), hit).codex).toMatchObject({ uniques: [], bigs: ['wyrm'], kills: 1, bosses: 1 })
    expect(apply(facing({ boss: true }, 5), hit).codex).toMatchObject({ bigs: [], kills: 1, bosses: 1 })
  })

  test('a unique slain again is listed once', async () => {
    const c = apply(facing(UNIQUE, 3, { ...EMPTY_CODEX, uniques: ['ember'] }), hit).codex
    expect(c?.uniques).toEqual(['ember'])
  })

  test('a Legendary come to hand is found by name; one moved to the stash or put on is not found again; a lesser find is nothing', async () => {
    const g = plainHero(3)
    const held = { ...g, bag: [duck(950)] }
    expect(recorded(EMPTY_CODEX, g, held).legendaries).toEqual([LEGENDARIES[1]!.name])
    expect(recorded(EMPTY_CODEX, held, { ...held, bag: [], stashed: [duck(950)] }).legendaries).toEqual([])
    expect(recorded(EMPTY_CODEX, held, { ...held, bag: [], gear: { ...held.gear, amulet: duck(950) } }).legendaries).toEqual([])
    const kept = { ...g, stashed: [duck(950)] }
    expect(recorded(EMPTY_CODEX, kept, { ...kept, stashed: [], bag: [duck(950)] }).legendaries).toEqual([])
    expect(recorded(EMPTY_CODEX, g, { ...g, bag: [{ ...plainItem({ nextId: 951 }, 'amulet', 'epic'), name: 'Rubber Duck of Insight' }] }).legendaries).toEqual([])
  })

  test('a foe gone in the action that felled the hero is not slain, paid or not', async () => {
    const g = facing({})
    expect(recorded(EMPTY_CODEX, g, { ...g, foe: null, xp: g.xp + 10, deaths: g.deaths + 1 })).toMatchObject({ kills: 0, deaths: 1 })
    expect(recorded(EMPTY_CODEX, g, { ...g, foe: null, xp: g.xp + 10 }).kills).toBe(1)
  })

  test('a second of a Legendary already found is listed once', async () => {
    const g = plainHero(3)
    const c = { ...EMPTY_CODEX, legendaries: [LEGENDARIES[1]!.name] }
    expect(recorded(c, g, { ...g, bag: [duck(952)] }).legendaries).toEqual([LEGENDARIES[1]!.name])
  })

  test('a fall is counted; the deepest depth and the top level only ever rise', async () => {
    const g = { ...plainHero(3), hp: 1, codex: { ...EMPTY_CODEX, deepest: 30, level: 20, deaths: 4 } }
    const fell = apply({ ...g, foe: foeAhead(g, 1, { atk: 99, opened: true, hp: 99, maxHp: 99 }) }, { kind: 'outcome', ok: false, what: 'Bash' })
    expect(fell.codex).toMatchObject({ deaths: 5, deepest: 30, level: 20 })
    expect(recorded(EMPTY_CODEX, g, { ...g, deepest: 7, level: 4 })).toMatchObject({ deepest: 7, level: 4 })
  })

  test('gold found in the dungeon is counted; gold lost is not taken back, and gold made in town is not found', async () => {
    const g = plainHero(3)
    expect(recorded(EMPTY_CODEX, { ...g, gold: 10 }, { ...g, gold: 35 }).gold).toBe(25)
    expect(recorded({ ...EMPTY_CODEX, gold: 25 }, { ...g, gold: 35 }, { ...g, gold: 5 }).gold).toBe(25)
    const town = { ...g, where: 'town' as const }
    expect(recorded(EMPTY_CODEX, { ...town, gold: 10 }, { ...town, gold: 90 }).gold).toBe(0)
  })

  test('a new hero keeps the codex', async () => {
    const c: Codex = { ...EMPTY_CODEX, uniques: ['bones'], kills: 120, deepest: 12 }
    expect(apply({ ...plainHero(3), codex: c }, { kind: 'restart', cls: 'mage' }).codex).toEqual(c)
  })
})

describe('a save kept before the codex', () => {
  test('begins it from what the hero did: uniques by band, every big boss up to the deepest boss slain, Legendaries owned, depth, level and falls', async () => {
    const g: Game = { ...plainHero(3), uniquesSlain: [0, 2, 5], bossSlain: 25, deepest: 27, level: 19, deaths: 6, bag: [duck(953)], stashed: [duck(954)] }
    expect(firstCodex(g)).toEqual({
      uniques: ['bones', 'rot'],
      bigs: ['queen', 'lich'],
      legendaries: [LEGENDARIES[1]!.name],
      deepest: 27, level: 19, kills: 0, bosses: 5, deaths: 6, gold: 0,
    })
  })

  test('its first action records onto it', async () => {
    const g = { ...plainHero(3), uniquesSlain: [0], deepest: 3, depth: 3 }
    const after = apply({ ...g, foe: foeAhead(g, 1, { hp: 1, maxHp: 1, opened: true }) }, hit)
    expect(after.codex).toMatchObject({ uniques: ['bones'], kills: 1 })
  })
})

describe('sets made whole', () => {
  const FOUR: Codex = { ...EMPTY_CODEX, uniques: ['bones', 'mire', 'rot', 'rime'], bigs: ['king', 'queen', 'hive', 'lich'] }
  const gained = (before: Game, after: Game) => after.bag.filter(i => !before.bag.some(b => b.id === i.id))

  test('the fifth unique slain pays an Epic or better, said and toasted', async () => {
    const before = facing(UNIQUE, 23, FOUR)
    const after = apply(before, hit)
    const prize = gained(before, after).filter(i => i.rarity === 'epic' || i.rarity === 'legendary')
    expect(prize.length).toBeGreaterThanOrEqual(2)
    expect(after.log.some(l => l.startsWith('Every unique is slain. The codex pays: '))).toBe(true)
    expect(after.toast).toBe('Every unique is slain!')
  })

  test('the fifth big boss slain pays a Legendary, found in the codex', async () => {
    const before = facing(BIG, 50, FOUR)
    const after = apply(before, hit)
    const prize = gained(before, after).filter(i => i.rarity === 'legendary')
    expect(prize.length).toBeGreaterThanOrEqual(1)
    expect(after.log.some(l => l.startsWith('Every big boss is slain. The codex pays: '))).toBe(true)
    expect(after.codex?.legendaries).toEqual(expect.arrayContaining(prize.map(i => i.name)))
  })

  test('the fourth pays nothing, and a set already whole pays nothing again', async () => {
    const three = { ...FOUR, uniques: FOUR.uniques.slice(0, 3) }
    expect(apply(facing(UNIQUE, 23, three), hit).log.some(l => l.startsWith('Every unique'))).toBe(false)
    const whole = { ...FOUR, uniques: [...FOUR.uniques, 'ember' as const] }
    expect(apply(facing(UNIQUE, 23, whole), hit).log.some(l => l.startsWith('Every unique'))).toBe(false)
  })

  test('with the bag full the prize waits in the stash in town, said', async () => {
    const full = { ...plainHero(3), bag: Array.from({ length: BAG_W }, (_, i) => ({ ...plainItem({ nextId: 2000 + i }, 'chain'), w: 1, h: BAG_H, x: i, y: 0 })) }
    const after = apply(facing(UNIQUE, 23, FOUR, full), hit)
    const paid = after.log.find(l => l.startsWith('Every unique is slain. The codex pays: '))
    expect(paid?.endsWith('Your bag is full: it waits in your stash in town.')).toBe(true)
    expect(after.stashed.some(i => paid!.includes(i.name))).toBe(true)
  })
})

describe('the codex window', () => {
  const shown = (c: Codex): Game => ({ ...plainHero(3), panel: 'codex', codex: c })
  const told: Codex = { uniques: ['rot', 'bones', 'rime'], bigs: ['king'], legendaries: [LEGENDARIES[1]!.name, LEGENDARIES[4]!.name], deepest: 34, level: 22, kills: 1240, bosses: 12, deaths: 9, gold: 18450, retired: 2 }

  const said = (g: Game, page: 'foes' | 'finds') => codexOverlay(g, { page })[0]!.lines.map(l => l.map(r => r.text).join(''))
  const FINDS = { page: 'finds' as const }
  const FOES = { page: 'foes' as const }

  test('Foes counts the uniques and big bosses slain; Finds the Legendaries found, then the records', async () => {
    expect(said(shown(told), 'foes')).toEqual(['Uniques slain 3 of 5, big bosses 1 of 5.'])
    expect(said(shown(told), 'finds')).toEqual([
      'Legendaries found 2 of 7.',
      'Deepest 34, level 22, kills 1240, bosses 12.',
      'Deaths 9, heroes retired 2, gold found 18450.',
    ])
  })

  test('a click on a page\'s tab shows that page', async () => {
    const g = shown(told)
    const [foes, finds] = tabRects([{ label: 'FOES' }, { label: 'FINDS' }], WINDOW_TOP)
    const tap = (r: { x: number; y: number }) => codexGesture(g, FOES, { type: 'release', from: { x: r.x + 2.5, y: (r.y + 3) / 2 }, at: { x: r.x + 2.5, y: (r.y + 3) / 2 }, button: 'left' })
    expect(tap(finds!)).toEqual({ ui: FINDS, actions: [], isCard: false })
    expect(tap(foes!)).toEqual({ ui: FOES, actions: [], isCard: false })
    expect(finds!.h).toBe(TABS_H)
  })

  test('lights what is slain or found, in the themes\' order and the Legendaries\' own', async () => {
    expect(codexLit(shown(told))).toEqual({
      uniques: [true, false, true, true, false],
      bigs: [true, false, false, false, false],
      legendaries: [false, true, false, false, true, false, false],
    })
  })

  test('a lit entry is drawn in its colours, one not yet found in the one dark ink', async () => {
    const full: Codex = { ...told, uniques: ['bones', 'mire', 'rot', 'rime', 'ember'], bigs: ['king', 'queen', 'hive', 'lich', 'wyrm'], legendaries: LEGENDARIES.map(l => l.name) }
    const inks = (px: string[][]) => new Set(px.flat()).size
    for (const ui of [FOES, FINDS]) expect(inks(codexPixels(shown(full), ui))).toBeGreaterThan(inks(codexPixels(shown(EMPTY_CODEX), ui)) + 10)
  })

  test('each row lights on its own: its entries found, the rest of the codex empty, add their colours', async () => {
    const inks = (c: Codex, ui: CodexUi = FOES) => new Set(codexPixels(shown(c), ui).flat()).size
    expect(inks({ ...EMPTY_CODEX, uniques: ['bones', 'mire', 'rot', 'rime', 'ember'] })).toBeGreaterThan(inks(EMPTY_CODEX) + 5)
    expect(inks({ ...EMPTY_CODEX, bigs: ['king', 'queen', 'hive', 'lich', 'wyrm'] })).toBeGreaterThan(inks(EMPTY_CODEX) + 5)
    expect(inks({ ...EMPTY_CODEX, legendaries: LEGENDARIES.map(l => l.name) }, FINDS)).toBeGreaterThan(inks(EMPTY_CODEX, FINDS) + 5)
  })

  test('a name the Legendaries do not hold is not counted', async () => {
    expect(said(shown({ ...told, legendaries: ['Sword of Long Ago'] }), 'finds')[0]).toBe('Legendaries found 0 of 7.')
  })

  test('each page fits in 40 rows, and its close box closes it; a click elsewhere does nothing', async () => {
    const g = shown(told)
    for (const ui of [FOES, FINDS]) {
      expect(codexHeight(g, ui)).toBeLessThanOrEqual(80)
      expect(codexPixels(g, ui).length).toBe(codexHeight(g, ui))
    }
    const at = (p: { x: number; y: number }) => codexGesture(g, FOES, { type: 'release', from: p, at: p, button: 'left' })
    expect(at({ x: CLOSE_BOX[0] + 1, y: (CLOSE_BOX[1] + 1) / 2 })).toEqual({ ui: FOES, actions: [{ kind: 'panel', panel: 'codex' }], isCard: false })
    expect(at({ x: 20, y: 30 })).toEqual({ ui: FOES, actions: [], isCard: false })
  })

  test('before its first action an older save shows the codex begun from it', async () => {
    const g: Game = { ...plainHero(3), uniquesSlain: [0], panel: 'codex' }
    expect(said(g, 'foes')[0]).toBe('Uniques slain 1 of 5, big bosses 0 of 5.')
  })
})
