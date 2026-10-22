import { describe, expect, test } from 'claude-code/testing'

import type { Game } from '../types'
import { foeAhead } from './fixtures'
import { newGame } from './game'
import { mix } from './pieces'
import { BG } from './canvas'
import {
  BELT_Y, DASH_H, DASH_OVER, ORB_BOX, ORB_PHASES, PLAQUE_FACE, SKULL_COLUMNS, dashBeltX, dashHit, dashLabels, dashOverGesture,
  dashOverMap, dashStrip, isDash, plaqueIcons, plaqueLabels, plaqueParts, xpBoxX,
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
  test('takes over from the bars at 105 columns, 16 px tall, its orbs 26 px boxes at both ends and the belt beside the HP', async () => {
    expect([isDash(104), isDash(105)]).toEqual([false, true])
    expect([stripHeight(105), stripHeight(104)]).toEqual([DASH_H, 28])
    expect([DASH_H, ORB_BOX, dashBeltX(0), xpBoxX(W)]).toEqual([16, 26, 27, 79])
    // Five slots sharing their frames, 46 px, the last ending clear of the XP orb.
    expect(dashBeltX(4) + 10).toBeLessThan(xpBoxX(W))
    const c = dashStrip(hero(), W)
    expect([c.px.length, c.px[0]!.length]).toEqual([16, W])
  })

  test('stands its orbs, their crests and the plaque over the map, 16 px up, and leaves the map alone elsewhere', async () => {
    const rows = overMap(hero(), W)
    expect(DASH_OVER).toBe(16)
    // The crests' top row is their horns' tips, 11 px apart over each orb (the crest 7 in from the box), the map
    // between them; above the plaque, the map.
    const top = rows[0]!
    expect([top[7], top[17], top[xpBoxX(W) + 7]].every(p => p !== MAP_GROUND)).toBe(true)
    expect([top[13], top[52]]).toEqual([MAP_GROUND, MAP_GROUND])
    // Over the plaque's rows, the plaque's face between its edges.
    expect(rows[DASH_OVER - 4]![40]).not.toBe(MAP_GROUND)
    // The first rows over the map beside a crest are the map.
    expect(rows[0]![1]).toBe(MAP_GROUND)
  })

  test('fills the HP orb red at every share, to its share, the empty glass the dark seen through it', async () => {
    // The box's column 12, just left of the glass's middle, dash row 10: glass row 18 of 22 (the glass 8 px over the
    // dash's top), short of the far side's shade. The surface rests on row 1 + (1 - share) * 20, rounded.
    const at = (hp: number) => dashStrip(hero({ hp, maxHp: 100 }), W).px[10]![12]
    expect([at(100), at(60), at(30)]).toEqual([RED[1], RED[1], RED[1]])
    // At 15%: the surface on row 18, lit. At 10%: on row 19, under row 18, which is glass.
    expect(at(15)).toBe(RED[0])
    expect(at(10)).toBe(mix(BG, RED[1], 0.14))
  })

  test('ripples where a surface lies in the dash, the rows over the map and the numbers\' rows holding still', async () => {
    const g = hero({ hp: 6, maxHp: 30 })
    const strips = Array.from({ length: ORB_PHASES }, (_, phase) => dashStrip(g, W, phase).px)
    const orb = (px: string[][], rows: number[]) => rows.map(y => px[y]!.slice(0, ORB_BOX).join()).join('|')
    expect(new Set(strips.map(px => orb(px, [9, 10, 11, 12, 13]))).size).toBeGreaterThan(1)
    expect(new Set(strips.map(px => orb(px, [4, 5, 6, 7]))).size).toBe(1)
    const full = hero()
    expect(new Set(Array.from({ length: ORB_PHASES }, (_, phase) => JSON.stringify(overMap(full, W, phase)))).size).toBe(1)
  })

  test('writes each orb\'s numbers centred on its glass, on the dash\'s text rows 2 and 3, each on the pixels under it', async () => {
    const g = hero({ hp: 86, maxHp: 100, xp: 12, level: 1 })
    const labels = dashLabels(g, W)
    const orbs = labels.slice(0, 4)
    expect(orbs.map(text)).toEqual(['86/100', 'HP', '12/20', 'LV1'])
    // Centred on 22 columns of glass two in from the box: 86/100 has 8 before it; HP 10; 12/20 8; LV1 9. A box a cell
    // before its text.
    expect(orbs.map(b => [b.x + 1, b.y + 1])).toEqual([[2 + 8, 2], [2 + 10, 3], [xpBoxX(W) + 2 + 8, 2], [xpBoxX(W) + 2 + 9, 3]])
    const px = dashStrip(g, W).px
    for (const b of orbs) b.lines[0]!.forEach((r, i) => {
      const x = b.x + 1 + i
      const [top, bottom] = [px[(b.y + 1) * 2]![x]!, px[(b.y + 1) * 2 + 1]![x]!]
      expect((r as { bg?: string }).bg).toBe(top === bottom ? top : mix(top, bottom, 0.5))
    })
    expect(text(dashLabels({ ...g, points: 1 }, W)[3]!)).toBe('LV1+')
  })
})

describe('the plaque', () => {
  const line = (columns: number) => {
    const words = plaqueLabels(hero(), columns)
    return words
  }

  test('says the depth first, then the gold, each left out whole when it would not fit, never clipped', async () => {
    const said = (g: Game, columns = W) => plaqueParts(g, { x: 29, end: plaqueIcons(columns).at(-1)!.x - 2 }).words.map(w => w.text)
    expect(said(hero({ depth: 12, gold: 12345 }))).toEqual(['12', '12,345'])
    // 28 px for the words at 105: depth 100 and its mark take 9 and 3 of room, so gold of 9 characters fits to the
    // last pixel and of 11 does not: the depth stays.
    expect(said(hero({ depth: 100, gold: 1234567 }))).toEqual(['100', '1,234,567'])
    expect(said(hero({ depth: 100, gold: 123456789 }))).toEqual(['100'])
    expect(said(hero({ where: 'town' } as Partial<Game>))[0]).toBe('TOWN')
  })

  test('writes its words in its own layer\'s cells, on the plaque\'s face', async () => {
    const words = line(W)
    expect(words.map(text)).toEqual([String(hero().depth), String(hero().gold)])
    // Row 0 of the layer is 16 px over the dash's top; the words on its 10th pixel row, cell 5.
    expect(words.every(b => b.y + 1 === 5 && b.bg === PLAQUE_FACE)).toBe(true)
  })

  test('has a skull at each end from 120 columns, its room given to the words narrower', async () => {
    const at = (columns: number) => overMap(hero(), columns)[DASH_OVER - 5]![ORB_BOX + 2]
    expect(SKULL_COLUMNS).toBe(120)
    // The skull's white beside its eye, a pixel in from the plaque's first column, at 120; the face at 105.
    expect(at(120)).toBe(0xd8d2c0)
    expect(at(W)).toBe(0x1b1915)
  })

  test('draws the portal dark while a foe lives', async () => {
    const g = hero()
    const portal = plaqueIcons(W).find(i => i.icon === 'portal')!
    const at = (x: Game) => overMap(x, W)[DASH_OVER - 6]![portal.x + 1]
    expect(at(g)).not.toBe(at({ ...g, foe: foeAhead(g, 3) }))
  })
})

describe('clicks on the dash', () => {
  test('an orb, its socket or its crest opens the sheet; a belt slot is used; a plaque button acts; its words open the log', async () => {
    for (const bx of [0, xpBoxX(W)]) for (const y of [-14, -4, 8]) expect(dashHit(W, bx + 13, y)).toEqual({ kind: 'panel', panel: 'sheet' })
    for (let i = 0; i < 5; i += 1) expect(dashHit(W, dashBeltX(i) + 5, BELT_Y + 5)).toEqual({ kind: 'use', slot: i })
    const icon = (name: 'bag' | 'settings' | 'portal') => plaqueIcons(W).find(i => i.icon === name)!.x + 2
    expect([dashHit(W, icon('bag'), -5), dashHit(W, icon('settings'), -5), dashHit(W, icon('portal'), -5)]).toEqual([{ kind: 'panel', panel: 'bag' }, { kind: 'panel', panel: 'settings' }, { kind: 'portal' }])
    expect(dashHit(W, 30, -5)).toBe('log')
    // The dash's band past the belt, and the map above the plaque: nothing.
    expect([dashHit(W, 76, 8), dashHit(W, 50, -12)]).toEqual([undefined, undefined])
  })

  test('its layer over the map reads a click by its cell: row 0 is 16 px up', async () => {
    const bag = plaqueIcons(W).find(i => i.icon === 'bag')!.x + 2.5
    expect(dashOverGesture(tap(bag, (DASH_OVER - 5) / 2 + 0.25), W)).toEqual({ actions: [{ kind: 'panel', panel: 'bag' }] })
    expect(dashOverGesture(tap(30.5, (DASH_OVER - 5) / 2 + 0.25), W)).toEqual({ actions: [], isLog: true })
    expect(dashOverGesture(tap(bag, 5.75, 'right'), W)).toEqual({ actions: [] })
  })
})
