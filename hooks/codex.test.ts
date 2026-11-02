import { describe, expect, test } from 'claude-code/testing'

import type { Codex, Foe, Game } from '../types'
import { apply, firstCodex } from './game'
import type { Action } from './game'
import { foeAhead, plainHero } from './fixtures'
import { BAG_H, BAG_W, LEGENDARIES, plainItem } from './items'
import { EMPTY_CODEX, recorded } from './codex'
import { codexCardRect, codexGesture, codexHeight, codexLit, codexOverlay, codexPixels } from './codexwindow'
import type { CodexUi } from './codexwindow'
import { CLOSE_BOX, TABS_H, WINDOW_TOP } from './window'
import { PAL, UNIQUE_ART, bigArtOf } from './pixelart'
import { SURFACE } from './ui/tokens'
import { BG } from './canvas'

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

  test('a warden slain adds its circle, listed once; a big boss above the Abyss adds none', async () => {
    expect(apply(facing({ ...BIG, warden: 2 }, 70), hit).codex).toMatchObject({ bigs: ['wyrm'], wardens: [2], bosses: 1 })
    expect(apply(facing({ ...BIG, warden: 2 }, 70, { ...EMPTY_CODEX, wardens: [2] }), hit).codex?.wardens).toEqual([2])
    expect(apply(facing(BIG, 50), hit).codex?.wardens).toEqual([])
  })

  test('a unique slain again is listed once', async () => {
    const c = apply(facing(UNIQUE, 3, { ...EMPTY_CODEX, uniques: ['ember'] }), hit).codex
    expect(c?.uniques).toEqual(['ember'])
  })

  test('a Legendary come to hand is found by name; one moved to the stash or put on is not found again; a lesser find is nothing', async () => {
    const g = plainHero(3)
    const held = { ...g, bag: [duck(950)] }
    expect(recorded(EMPTY_CODEX, g, held).legendaries).toEqual([LEGENDARIES[1]!.name])
    expect(recorded(EMPTY_CODEX, held, { ...held, bag: [], stashed: [[duck(950)]] }).legendaries).toEqual([])
    expect(recorded(EMPTY_CODEX, held, { ...held, bag: [], gear: { ...held.gear, amulet: duck(950) } }).legendaries).toEqual([])
    const kept = { ...g, stashed: [[duck(950)]] }
    expect(recorded(EMPTY_CODEX, kept, { ...kept, stashed: [[]], bag: [duck(950)] }).legendaries).toEqual([])
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

  test('a sale in the dungeon is no gold found: selling and buying back a hundred times leaves the record as it was', async () => {
    let g: Game = { ...plainHero(2), gold: 0, cursor: plainHero(2).gear.weapon!.id }
    g = apply(g, { kind: 'unequip', slot: 'weapon' })
    const before = g.codex?.gold
    for (let i = 0; i < 100; i += 1) g = apply(apply({ ...g, cursor: g.bag[0]!.id }, { kind: 'sell' }), { kind: 'buyBack' })
    expect(g.bag.length).toBe(1)
    expect(g.codex?.gold).toBe(before)
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

  test('the heroes retired stay counted through every action after', async () => {
    const g = { ...plainHero(3), codex: { ...EMPTY_CODEX, retired: 2 } }
    expect(apply(g, hit).codex?.retired).toBe(2)
    expect(apply(apply(g, hit), hit).codex?.retired).toBe(2)
  })
})

describe('a save kept before the codex', () => {
  test('begins it from what the hero did: uniques by band, every big boss up to the deepest boss slain, Legendaries owned, depth, level and falls', async () => {
    const g: Game = { ...plainHero(3), uniquesSlain: [0, 2, 5], bossSlain: 25, deepest: 27, level: 19, deaths: 6, bag: [duck(953)], stashed: [[duck(954)]] }
    expect(firstCodex(g)).toEqual({
      uniques: ['bones', 'rot'],
      bigs: ['queen', 'lich'],
      legendaries: [LEGENDARIES[1]!.name],
      // No save from before the codex met a warden: they came later.
      wardens: [],
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
    expect(after.stashed[0]!.some(i => paid!.includes(i.name))).toBe(true)
  })
})

describe('the codex window', () => {
  const shown = (c: Codex): Game => ({ ...plainHero(3), panel: 'codex', codex: c })
  const told: Codex = { uniques: ['rot', 'bones', 'rime'], bigs: ['king'], legendaries: [LEGENDARIES[1]!.name, LEGENDARIES[4]!.name], deepest: 34, level: 22, kills: 1240, bosses: 12, deaths: 9, gold: 18450, retired: 2 }

  const said = (g: Game, page: CodexUi['page']) => codexOverlay(g, { page })[0]!.lines.map(l => l.map(r => r.text).join(''))
  const FINDS = { page: 'finds' as const }
  const FOES = { page: 'foes' as const }
  const ABYSS = { page: 'abyss' as const }

  test('Foes counts the uniques and big bosses slain, Finds the Legendaries found, each then the records', async () => {
    expect(said(shown(told), 'foes')).toEqual([
      'Uniques slain 3 of 5, big bosses 1 of 5.',
      'Deepest 34, level 22, kills 1,240, bosses 12.',
      'Deaths 9, heroes retired 2, gold found 18,450.',
    ])
    expect(said(shown(told), 'finds')).toEqual([
      'Legendaries found 2 of 10.',
      'Deepest 34, level 22, kills 1,240, bosses 12.',
      'Deaths 9, heroes retired 2, gold found 18,450.',
    ])
  })

  test('Abyss counts the ten circles\' wardens slain, and apart those of the Nameless Dark, then the records', async () => {
    expect(said(shown({ ...told, wardens: [1, 4, 12] }), 'abyss')).toEqual([
      'Wardens slain 2 of 10, of the Nameless Dark 1.',
      'Deepest 34, level 22, kills 1,240, bosses 12.',
      'Deaths 9, heroes retired 2, gold found 18,450.',
    ])
    expect(said(shown(told), 'abyss')[0]).toBe('Wardens slain 0 of 10, of the Nameless Dark 0.')
  })

  test('each page as tall as its rows, the records under each the same', async () => {
    const g = shown(told)
    // From the first row's top: Foes' big bosses end 30 down (a unique's slot 10, 2, a box 18), Abyss's wardens 38
    // (a box, 2, a box), Finds' deep Legendaries and Card 40. The box 2 under that: Abyss 8 px taller than Foes,
    // Finds 10.
    expect(codexHeight(g, ABYSS)).toBe(codexHeight(g, FOES) + 8)
    expect(codexHeight(g, FINDS)).toBe(codexHeight(g, FOES) + 10)
    for (const ui of [FINDS, ABYSS]) expect(said(g, ui.page).slice(1)).toEqual(said(g, 'foes').slice(1))
  })

  test('a click on a page\'s tab shows that page', async () => {
    const g = shown(told)
    // In terminal text from column 2 under the title bar: FOES on columns 2 to 7, FINDS on 9 to 15, the row TABS_H tall.
    const tap = (x: number, y: number) => codexGesture(g, FOES, { type: 'release', from: { x: x + 0.5, y: y / 2 + 0.25 }, at: { x: x + 0.5, y: y / 2 + 0.25 }, button: 'left' })
    expect(tap(9, WINDOW_TOP + 4)).toEqual({ ui: FINDS, actions: [], isCard: false })
    expect(tap(15, WINDOW_TOP + TABS_H - 1)).toEqual({ ui: FINDS, actions: [], isCard: false })
    expect(tap(2, WINDOW_TOP + 4)).toEqual({ ui: FOES, actions: [], isCard: false })
    expect(tap(16, WINDOW_TOP + 4).ui).toEqual(FOES)
    // ABYSS on columns 17 to 23.
    expect(tap(17, WINDOW_TOP + 4).ui).toEqual(ABYSS)
    expect(tap(23, WINDOW_TOP + 4).ui).toEqual(ABYSS)
    expect(tap(24, WINDOW_TOP + 4).ui).toEqual(FOES)
    const pages = codexOverlay(g, FOES).filter(b => b.role === 'tabs')
    expect(pages.map(b => b.lines[0]!.map(r => r.text).join(''))).toEqual(['FOES', 'FINDS', 'ABYSS'])
  })

  test('lights what is slain or found, in the themes\' order and the Legendaries\' own', async () => {
    expect(codexLit(shown(told))).toEqual({
      uniques: [true, false, true, true, false],
      bigs: [true, false, false, false, false],
      legendaries: [false, true, false, false, true, false, false, false, false, false],
      wardens: [false, false, false, false, false, false, false, false, false, false],
    })
    expect(codexLit(shown({ ...told, wardens: [1, 4, 12] })).wardens).toEqual([true, false, false, true, false, false, false, false, false, false])
  })

  test('each warden stands in its circle\'s box, in its own colours once slain and a dark shape until then', async () => {
    // Circles I to V on the first row under the page tabs, VI to X 20 under them, a column every 20 from x 3: each
    // circle's theme is the one five circles before or after it, so a column is one boss remade. Each box 18 square,
    // the warden's 16 px art a pixel in.
    const row1 = WINDOW_TOP + TABS_H + 2
    const slain = codexPixels(shown({ ...EMPTY_CODEX, wardens: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] }), ABYSS)
    const dark = codexPixels(shown(EMPTY_CODEX), ABYSS)
    // The circles' bosses, by the depth each warden guards (60, 70, ... 150): flooded, frozen, crypt, fungal, forge.
    const bigs = ['queen', 'lich', 'king', 'hive', 'wyrm'] as const
    for (let tier = 1; tier <= 10; tier++) {
      const x = 3 + ((tier - 1) % 5) * 20 + 1
      const y = row1 + Math.floor((tier - 1) / 5) * 20 + 1
      const art = bigArtOf({ big: bigs[(tier - 1) % 5]!, warden: tier })
      const drawn = art.flatMap((r, dy) => [...r].map((k, dx) => [k, slain[y + dy]![x + dx], dark[y + dy]![x + dx]] as const)).filter(([k]) => k !== '.')
      expect(drawn.every(([k, lit]) => lit === PAL[k])).toBe(true)
      expect(new Set(drawn.map(([, , shade]) => shade))).toEqual(new Set([SURFACE.shade]))
    }
  })

  test('a lit entry is drawn in its colours, one not yet found in the one dark ink', async () => {
    const full: Codex = { ...told, uniques: ['bones', 'mire', 'rot', 'rime', 'ember'], bigs: ['king', 'queen', 'hive', 'lich', 'wyrm'], legendaries: LEGENDARIES.map(l => l.name) }
    const inks = (px: string[][]) => new Set(px.flat()).size
    for (const ui of [FOES, FINDS]) expect(inks(codexPixels(shown(full), ui))).toBeGreaterThan(inks(codexPixels(shown(EMPTY_CODEX), ui)) + 10)
  })

  test('a unique is drawn at its size on the map, a dot a pixel, in a slot as the bag\'s, centred over its column', async () => {
    // A column every 20 from x 3, 18 wide for a big boss; a unique's slot 10 square, 4 in, the first row under the page
    // tabs; its 8 by 8 inside the slot's frame, on the map's floor.
    const top = WINDOW_TOP + TABS_H + 2
    const lit = codexPixels(shown({ ...EMPTY_CODEX, uniques: ['bones', 'mire', 'rot', 'rime', 'ember'] }), FOES)
    const dark = codexPixels(shown(EMPTY_CODEX), FOES)
    for (const [i, key] of (['bones', 'mire', 'rot', 'rime', 'ember'] as const).entries()) {
      const left = 3 + i * 20 + 4
      const drawn: [number, number][] = []
      for (let y = top + 1; y < top + 9; y++) for (let x = left + 1; x < left + 9; x++) if (lit[y]![x] !== SURFACE.floor) drawn.push([x, y])
      expect(drawn.length).toBe(UNIQUE_ART[key].join('').replace(/\./g, '').length)
      // The slot's frame round it: lit, it is not the dark one's.
      expect([lit[top]![left] !== dark[top]![left], lit[top + 9]![left + 9] !== dark[top + 9]![left + 9]]).toEqual([true, true])
    }
  })

  test('a found entry is framed as a portrait is, on the death screen and the townsfolk\'s; one not found in the rule\'s line', async () => {
    const top = WINDOW_TOP + TABS_H + 2
    const left = 3 + 4
    const lit = codexPixels(shown({ ...EMPTY_CODEX, uniques: ['bones'] }), FOES)
    const dark = codexPixels(shown(EMPTY_CODEX), FOES)
    expect([lit[top]![left], lit[top + 9]![left + 9], dark[top]![left]]).toEqual([SURFACE.frame, SURFACE.frame, SURFACE.line])
  })

  /** A colour as the terminal paints it: each channel on the host's 17-step grid. */
  const painted = (hex: string) => [1, 3, 5].map(i => Math.round(Number.parseInt(hex.slice(i, i + 2), 16) / 17)).join()

  test('a shape not yet slain or found is painted apart from its frame and the box\'s ground', async () => {
    // The first unique's slot: its frame on the first row under the page tabs, 7 in; the shape inside it.
    const top = WINDOW_TOP + TABS_H + 2
    const dark = codexPixels(shown(EMPTY_CODEX), FOES)
    const inside = new Set(dark.slice(top + 1, top + 9).flatMap(row => row.slice(8, 16)))
    expect(inside.size).toBe(2)
    expect(new Set([...inside, dark[top]![7]!].map(painted)).size).toBe(3)
  })

  test('a unique slain stands on the map\'s floor, so its outline shows as it does there', async () => {
    const top = WINDOW_TOP + TABS_H + 2
    const lit = codexPixels(shown({ ...EMPTY_CODEX, uniques: ['bones'] }), FOES)
    // The bones' art, its top row '..KKKK.o': the slot's first two pixels inside the frame are its ground.
    expect([lit[top + 1]![8], lit[top + 1]![9]]).toEqual([SURFACE.floor, SURFACE.floor])
    expect(painted(lit[top + 1]![10]!)).not.toBe(painted(SURFACE.floor))
  })

  test('a big boss\'s box is its 16 px art and a pixel of frame round it, the row centred in the window', async () => {
    // Five boxes 18 wide, a column every 20: 98 across, from x 3 in a window 105 wide (3 left, 4 right: the odd pixel
    // on the right); the second row 12 under the first.
    const y = WINDOW_TOP + TABS_H + 2 + 12
    const dark = codexPixels(shown(EMPTY_CODEX), FOES)
    expect([dark[y]![3], dark[y]![20], dark[y]![21], dark[y]![83], dark[y]![100], dark[y]![101]]).toEqual([SURFACE.line, SURFACE.line, BG, SURFACE.line, SURFACE.line, BG])
  })

  test('a Legendary\'s box is its art and a pixel of frame round it, as in the bag, the row centred in the window', async () => {
    // Sword, amulet, chain, ring, kite, staff, dagger: art 6, 6, 13, 6, 13, 6 and 6 wide, so boxes 8, 8, 15, 8, 15, 8
    // and 8, 4 apart: 94 across, from x 5 in a window 105 wide. Each box's left column is its frame, the one before
    // it bare ground.
    const y = WINDOW_TOP + TABS_H + 2
    const dark = codexPixels(shown(EMPTY_CODEX), FINDS)
    const starts = [5, 17, 29, 48, 60, 79, 91]
    // Read on the row's bottom line, where every box stands.
    const foot = y + 21
    expect(starts.map(x => [dark[foot]![x - 1], dark[foot]![x]])).toEqual(starts.map(() => [BG, SURFACE.line]))
    expect([dark[foot]![98], dark[foot]![99]]).toEqual([SURFACE.line, BG])
    // Each box as tall as its piece's cells, as in the bag: the amulet (1 by 1) and the ring 8, the dagger (1 by 2) 15,
    // the rest 22; their tops on the row's bottom less that.
    const tops = starts.map(x => dark.findIndex((row, ry) => ry >= y && row[x] === SURFACE.line) - y)
    expect(tops).toEqual([0, 14, 0, 14, 0, 0, 7])
  })

  test('the deep Legendaries stand in a row of their own under the rest, Card beside them', async () => {
    // Boots, signet, pendant: 15, 8, 8 wide, 4 apart, then Card 8 past them, 8 wide: 55 across, from x 25. Their
    // bottom line, and Card's, 40 under the first row's top: at least 22, 2 and the boots' 15, on a cell row (the first
    // row's top is one). The boots 15 tall, so 25 down, the rings 8; Card 6.
    const y = WINDOW_TOP + TABS_H + 2
    const dark = codexPixels(shown(EMPTY_CODEX), FINDS)
    const starts = [25, 44, 56]
    expect(starts.map(x => [dark[y + 39]![x - 1], dark[y + 39]![x]])).toEqual(starts.map(() => [BG, SURFACE.line]))
    const tops = starts.map(x => dark.findIndex((row, ry) => ry >= y + 23 && row[x] === SURFACE.line) - y)
    expect(tops).toEqual([25, 32, 32])
    expect(codexCardRect(FINDS)).toEqual({ x: 72, y: y + 34, w: 8, h: 6 })
  })

  test('each row lights on its own: its entries found, the rest of the codex empty, add their colours', async () => {
    const inks = (c: Codex, ui: CodexUi = FOES) => new Set(codexPixels(shown(c), ui).flat()).size
    expect(inks({ ...EMPTY_CODEX, uniques: ['bones', 'mire', 'rot', 'rime', 'ember'] })).toBeGreaterThan(inks(EMPTY_CODEX) + 5)
    expect(inks({ ...EMPTY_CODEX, bigs: ['king', 'queen', 'hive', 'lich', 'wyrm'] })).toBeGreaterThan(inks(EMPTY_CODEX) + 5)
    expect(inks({ ...EMPTY_CODEX, legendaries: LEGENDARIES.map(l => l.name) }, FINDS)).toBeGreaterThan(inks(EMPTY_CODEX, FINDS) + 5)
  })

  test('a name the Legendaries do not hold is not counted', async () => {
    expect(said(shown({ ...told, legendaries: ['Sword of Long Ago'] }), 'finds')[0]).toBe('Legendaries found 0 of 10.')
  })

  test('each page fits in 40 rows, and its close box closes it; a click elsewhere does nothing', async () => {
    const g = shown(told)
    for (const ui of [FOES, FINDS, ABYSS]) {
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
