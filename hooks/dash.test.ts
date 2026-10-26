import { describe, expect, test } from 'claude-code/testing'

import type { Game } from '../types'
import { foeAhead } from './fixtures'
import { newGame } from './game'
import { mix } from './pieces'
import { BG } from './canvas'
import {
  BELT_Y, BUTTON_Y, DASH_H, DASH_OVER, ORB_BOX, ORB_PHASES, PLAQUE_FACE, SKULL_COLUMNS, dashBeltX, dashButtons, dashHit,
  ICON, dashLabels, dashOverGesture, dashOverMap, dashStrip, isDash, overLabels, xpBoxX,
} from './dash'
import { stripHeight } from './strip'
import type { Gesture } from './window'

const hero = (over: Partial<Game> = {}): Game => ({ ...newGame(4, 'knight'), ...over })
/** The narrowest pane with the dash: a 106-column dock gives the pane 105. */
const W = 105
/** HP's red: lit, body, shade. */
const RED = ['#f06a5a', '#c0392b', '#8a231a'] as const
const MAP_GROUND = 0x123456
/** The rows the dash paints over a map `columns` wide, as hex, the map's own ground where it leaves it. */
const overMap = (g: Game, columns: number, phase = 0) => {
  const height = 40
  const frame = new Uint32Array(columns * height).fill(MAP_GROUND)
  dashOverMap(g, columns, phase)(frame, height)
  return Array.from({ length: DASH_OVER }, (_, i) => Array.from({ length: columns }, (__, x) => frame[(height - DASH_OVER + i) * columns + x]!))
}
const text = (b: { lines: { text: string }[][] }) => b.lines[0]!.map(r => r.text).join('')
const tap = (x: number, y: number, button: 'left' | 'right' = 'left'): Gesture => ({ type: 'release', from: { x, y }, at: { x, y }, button })

describe('the dash', () => {
  test('takes over from the bars at 105 columns: 12 px tall, its orbs 26 px boxes at both ends, the belt centred between', async () => {
    expect([isDash(104), isDash(105)]).toEqual([false, true])
    expect([stripHeight(105), stripHeight(104)]).toEqual([DASH_H, 28])
    expect([DASH_H, ORB_BOX, xpBoxX(W)]).toEqual([12, 26, 79])
    // Five 10 px slots a pixel apart, 54 px, from (105 - 54) / 2: the last ends at 79.
    expect([0, 1, 2, 3, 4].map(i => dashBeltX(W, i))).toEqual([25, 36, 47, 58, 69])
    const c = dashStrip(hero(), W)
    expect([c.px.length, c.px[0]!.length]).toEqual([12, W])
  })

  test('stands its orbs high over the map, their middles 8.5 px over the dash, 26 px with their crests', async () => {
    const rows = overMap(hero(), W)
    expect(DASH_OVER).toBe(26)
    // The crests' top row is their horns' tips, 10 px apart, 7 in from each box; the map between them.
    const top = rows[0]!
    expect([top[7], top[17], top[xpBoxX(W) + 7]].every(p => p !== MAP_GROUND)).toBe(true)
    expect([top[12], top[52]]).toEqual([MAP_GROUND, MAP_GROUND])
    // Over the plaque's rows, its face between its edges.
    expect(rows[DASH_OVER - 4]![40]).not.toBe(MAP_GROUND)
  })

  test('tucks the belt under the orbs\' curves: the sockets stop short of the slots on the belt\'s top row', async () => {
    const px = dashStrip(hero(), W).px
    // On row 1, the belt's top, 9.5 below the sockets' middles: the pixel before the first slot (24) is 14.9 from the HP's
    // (12.5) and the one after the last (79) 15.7 from the XP's (91.5), both past the socket's 13: the dash's carved stone.
    const band = new Set(['#333322', '#222211'])
    expect([px[1]![24], px[1]![79]].every(p => band.has(p!))).toBe(true)
  })

  test('fills the HP orb red at every share, to its share, the empty glass the dark seen through it', async () => {
    // Over the map 10 px up (glass row 9 of 22, its top 19 up), box column 11: the surface rests on row 1 + (1 - share) * 20.
    const at = (hp: number) => overMap(hero({ hp, maxHp: 100 }), W)[DASH_OVER - 10]![11]
    const int = (hex: string) => Number.parseInt(hex.slice(1), 16)
    expect([at(100), at(70)]).toEqual([int(RED[1]), int(RED[1])])
    // At 60%: the surface on row 9, lit. At 55%: on row 10, which shares a cell of the numbers with row 9: the cell lit
    // whole. Row 8 over them, at 55%, is glass.
    expect(at(60)).toBe(int(RED[0]))
    expect(at(55)).toBe(int(RED[0]))
    expect(overMap(hero({ hp: 55, maxHp: 100 }), W)[DASH_OVER - 11]![11]).toBe(int(mix(BG, RED[1], 0.14)))
  })

  test('ripples where a surface lies in the dash\'s own rows; over the map the orbs hold still', async () => {
    const low = hero({ hp: 2, maxHp: 30 })
    const strips = Array.from({ length: ORB_PHASES }, (_, phase) => dashStrip(low, W, phase).px)
    expect(new Set(strips.map(px => px.slice(0, 7).map(r => r.slice(0, ORB_BOX).join()).join('|'))).size).toBeGreaterThan(1)
    for (const g of [low, hero()]) expect(new Set(Array.from({ length: ORB_PHASES }, (_, phase) => JSON.stringify(overMap(g, W, phase)))).size).toBe(1)
  })

  test('writes each orb\'s numbers centred on its glass over the map, two rows, each on the pixels under it', async () => {
    const g = hero({ hp: 86, maxHp: 100, xp: 12, level: 1 })
    const orbs = overLabels(g, W).slice(0, 4)
    expect(orbs.map(text)).toEqual(['86/100', 'HP', '12/20', 'LV1'])
    // Centred on 22 columns of glass two in from the box: 86/100 has 8 before it; HP 10; 12/20 8; LV1 9. Rows 8
    // and 9 of the dash's layer over the map, 26 px tall: 10 and 8 px over the dash.
    expect(orbs.map(b => [b.x + 1, b.y + 1])).toEqual([[10, 8], [12, 9], [89, 8], [90, 9]])
    const rows = overMap(g, W)
    const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`
    for (const b of orbs) b.lines[0]!.forEach((r, i) => {
      const x = b.x + 1 + i
      const [top, bottom] = [hex(rows[(b.y + 1) * 2]![x]!), hex(rows[(b.y + 1) * 2 + 1]![x]!)]
      expect((r as { bg?: string }).bg).toBe(top === bottom ? top : mix(top, bottom, 0.5))
    })
    expect(text(overLabels({ ...g, points: 1 }, W)[3]!)).toBe('LV1+')
  })

  test('never cuts a cell of the orbs\' numbers across the liquid\'s surface line, at any fill: each is one ground', async () => {
    const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`
    const cut: string[] = []
    for (let n = 0; n <= 100; n += 1) {
      const g = hero({ hp: Math.max(1, n), maxHp: 100, xp: n, level: 1 })
      const rows = overMap(g, W)
      for (const b of overLabels(g, W).slice(0, 4)) b.lines[0]!.forEach((_, i) => {
        const x = b.x + 1 + i
        const [top, bottom] = [rows[(b.y + 1) * 2]![x]!, rows[(b.y + 1) * 2 + 1]![x]!]
        if (top !== bottom) cut.push(`${n}% ${x},${b.y + 1}: ${hex(top)} over ${hex(bottom)}`)
      })
    }
    expect(cut.slice(0, 5)).toEqual([])
  })

  test('writes the belt\'s counts on its own rows', async () => {
    expect(dashLabels(hero(), W).map(text)).toEqual(['1'])
  })
})

describe('the plaque', () => {
  const words = (g: Game, columns = W) => overLabels(g, columns).slice(4)

  test('says the depth, then the gold, then the effects, each left out whole when it would not fit, never clipped', async () => {
    // 47 px for the words at 105 (29 to 75): depth 12 takes 8 and 3 of room, the gold 12 and 3, fury and ward 7 and
    // 3 each, to 75; regen would end at 82, past 76: left out.
    const g = hero({ depth: 12, gold: 12345, effects: { ...hero().effects, fury: 3, ward: 2, regen: 5 } })
    expect(words(g).map(text)).toEqual(['12', '12,345', '3', '2'])
    expect(words(hero({ where: 'town' } as Partial<Game>)).map(text)[0]).toBe('TOWN')
  })

  test('writes its words in its own layer\'s cells, on the plaque\'s face', async () => {
    const said = words(hero())
    expect(said.map(text)).toEqual([String(hero().depth), String(hero().gold)])
    // Row 0 of the layer is 26 px over the dash's top; the words 6 px over it, on its 20th pixel row, cell 10.
    expect(said.every(b => b.y + 1 === 10 && b.bg === PLAQUE_FACE)).toBe(true)
  })

  test('has a skull at each end from 120 columns, its room given to the words narrower', async () => {
    const at = (columns: number) => overMap(hero(), columns)[DASH_OVER - 7]![ORB_BOX + 4]
    expect(SKULL_COLUMNS).toBe(120)
    // The skull's crown, its top row's first white, two in from the plaque's first column past the rivet, at 120;
    // the face at 105, where the words start there.
    expect(at(120)).toBe(0xd8d2c0)
    expect(at(W)).toBe(0x222222)
  })

  test('curls a horn up from each top corner', async () => {
    const rows = overMap(hero(), W)
    // Four rows over the plaque's top (its row 10 over the dash): two left of its first column, and two right of its last.
    expect([rows[DASH_OVER - 14]![ORB_BOX - 1], rows[DASH_OVER - 14]![xpBoxX(W)]]).toEqual([0x111111, 0x111111])
  })
})

describe('the dash\'s buttons', () => {
  test('sit in sockets in the corners under the orbs: the bag and settings under the HP, the portal under the XP', async () => {
    const px = dashStrip(hero(), W).px
    expect(dashButtons(W).map(b => [b.icon, b.x])).toEqual([['bag', 3], ['settings', 11], ['portal', 97]])
    // Each socket's top-left corner a pixel round its icon, dark; its bottom lip catching the light.
    for (const { x } of dashButtons(W)) expect([px[BUTTON_Y - 1]![x - 1], px[BUTTON_Y + 5]![x + 2]]).toEqual(['#111111', '#555544'])
  })

  test('draws the portal dark while a foe lives', async () => {
    const g = hero()
    const portal = dashButtons(W).find(b => b.icon === 'portal')!
    const at = (x: Game) => dashStrip(x, W).px[BUTTON_Y + 1]![portal.x + 1]
    expect(at(g)).not.toBe(at({ ...g, foe: foeAhead(g, 3) }))
  })
})

describe('clicks on the dash', () => {
  test('an orb, its socket or its crest opens the sheet; a belt slot is used; a button acts; the plaque\'s words open the log', async () => {
    for (const bx of [0, xpBoxX(W)]) for (const y of [-20, -5, 2]) expect(dashHit(W, bx + 13, y)).toEqual({ kind: 'panel', panel: 'sheet' })
    for (let i = 0; i < 5; i += 1) expect(dashHit(W, dashBeltX(W, i) + 5, BELT_Y + 5)).toEqual({ kind: 'use', slot: i })
    const at = (name: 'bag' | 'settings' | 'portal') => dashHit(W, dashButtons(W).find(b => b.icon === name)!.x + 2, BUTTON_Y + 2)
    expect([at('bag'), at('settings'), at('portal')]).toEqual([{ kind: 'panel', panel: 'bag' }, { kind: 'panel', panel: 'settings' }, { kind: 'portal' }])
    expect(dashHit(W, 33, -5)).toBe('log')
    // The band under the XP orb left of the portal, a gap between two slots, and the map above the plaque: nothing.
    expect([dashHit(W, 85, 8), dashHit(W, 35, 8), dashHit(W, 50, -14)]).toEqual([undefined, undefined, undefined])
  })

  test('its layer over the map reads a click by its cell: row 0 is 26 px up', async () => {
    expect(dashOverGesture(tap(33.5, (DASH_OVER - 5) / 2 + 0.25), W)).toEqual({ actions: [], isLog: true })
    expect(dashOverGesture(tap(13.5, (DASH_OVER - 7) / 2 + 0.25), W)).toEqual({ actions: [{ kind: 'panel', panel: 'sheet' }] })
    expect(dashOverGesture(tap(13.5, 5.75, 'right'), W)).toEqual({ actions: [] })
  })

  test('hands a click on its layer that lands on none of it to the map under it, in the layer\'s cells', async () => {
    // Cell 50, 1: 24 px up, x 50, between the crests' horns and over the plaque: the map.
    expect(dashOverGesture(tap(50.5, 1.25), W)).toEqual({ actions: [], toMap: { x: 50.5, y: 1.25 } })
    expect(dashOverGesture(tap(50.5, 1.25, 'right'), W)).toEqual({ actions: [] })
  })
})

describe('the dash\'s button icons', () => {
  const widths = (rows: readonly string[]) => rows.map(r => r.replace(/^\.+|\.+$/g, '').length)
  test('the bag is a sack: a narrow tied neck over a wider body', async () => {
    const w = widths(ICON.bag.rows)
    expect(w[1]).toBe(1)
    expect(Math.max(...w.slice(2))).toBeGreaterThan(w[1]! + 2)
  })

  test('the gear has a tooth on each side and corner round its dark hole, its shape the same mirrored either way', async () => {
    const shape = ICON.settings.rows.map(r => r.replace(/[^.]/g, '#'))
    expect(shape).toEqual([...shape].reverse())
    expect(shape.map(r => [...r].reverse().join(''))).toEqual(shape)
    expect(ICON.settings.rows[2]![2]).toBe('K')
    expect([shape[0]![0], shape[0]![2], shape[0]![4], shape[2]![0], shape[2]![4]]).toEqual(['#', '#', '#', '#', '#'])
  })
})
