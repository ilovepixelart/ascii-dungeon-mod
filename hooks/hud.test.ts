import { describe, expect, test } from 'claude-code/testing'

import type { Game } from '../types'
import { foeAhead } from './fixtures'
import { depthMod, isBossDepth, newGame } from './game'
import {
  BAR_X, BELT_BELOW_Y, FRAME, GOLD_INK, HEART_X, HP_H, HP_TONES, HP_Y, INSET, LEVEL_INK, LINE2_Y, MARK, MARK_INK, NUM_INK, POINTS_INK, SIDE_LINE_Y, XP_FILL, XP_Y,
  barsLayout, beltSlotX, contentLayout, hudContent, hudHit, hudLayout, hudPixels, portalSlotX,
} from './hud'
import { BELT_SLOT_W, GRID, SLOT } from './canvas'
import { MAP_W } from './map'
import { CONSUMABLE_ICONS } from './icons'
import { TIER_INK } from './pieces'
import { PAL, PX, TOWN_THING_ART, heroArt, textMask } from './pixelart'
import { CHAMPION_MARK, FOE_BAR_EMPTY, FOE_BAR_FILL, FOE_BAR_W, frameOf, hexToInt, viewOrigin } from './pixels'

const W = 111
const hero = (over: Partial<Game> = {}): Game => ({ ...newGame(4, 'knight'), ...over })
/**
 * A strip whose bars are exactly 25 pixels long for a level 1 hero of 100 HP, worked by hand: the bars start 20 in,
 * then the bar, 2 px, the numbers' room ("100/100": 7 glyphs of 3 px and 6 gaps, 27 px), 3 px and the 10 px portal.
 */
const BAR25 = 20 + 25 + 2 + 27 + 3 + 10
const ink = (c: { px: string[][] }, x: number, y: number, w: number, h: number) => c.px.slice(y, y + h).flatMap(r => r.slice(x, x + w))
/** Whether `text` is drawn in `color` with its top-left corner at x, y: lit exactly where the font is. */
const hasText = (c: { px: string[][] }, text: string, x: number, y: number, color: string) =>
  textMask(text).every((row, dy) => [...row].every((k, dx) => (c.px[y + dy]?.[x + dx] === color) === (k === '#')))

describe('the strip', () => {
  test('is the pane\'s width and the same height at every width: the top row, the belt, the side line', async () => {
    for (const width of [72, W, 140]) {
      const c = hudContent(hero(), width)
      expect(c.px.length).toBe(32)
      for (const row of c.px) expect(row.length).toBe(width)
      expect(contentLayout(width).height).toBe(32)
    }
    expect(beltSlotX(W, 0)).toBe(0)
    expect(portalSlotX(W) + SLOT).toBe(W)
  })

  test('works out the bars by hand: 25 px at the BAR25 width', async () => {
    expect(BAR_X).toBe(20)
    expect(barsLayout(hero({ maxHp: 100, level: 1 }), BAR25)).toEqual({ barW: 25, numX: 20 + 25 + 2 })
  })

  test('draws the portal in its colors when it can open, and dark while a foe lives', async () => {
    const g = hero()
    const x0 = portalSlotX(W) + 1
    const open = hudContent(g, W)
    TOWN_THING_ART.portal.forEach((row, y) => [...row].forEach((k, x) => {
      if (k !== '.') expect(open.px[1 + y]?.[x0 + x]).toBe(PAL[k])
    }))
    const shut = hudContent({ ...g, foe: foeAhead(g, 3) }, W)
    const lit = new Set(Object.values(PAL))
    const inked = TOWN_THING_ART.portal.flatMap((row, y) => [...row].flatMap((k, x) => (k === '.' ? [] : [shut.px[1 + y]?.[x0 + x]])))
    expect(inked.every(p => p !== undefined && !lit.has(p))).toBe(true)
  })

  test('shows the hero\'s own sprite, pixel for pixel, in the portrait', async () => {
    const g = hero()
    const c = hudContent(g, W)
    heroArt(g).forEach((row, y) => [...row].forEach((k, x) => {
      if (k !== '.') expect(c.px[1 + y]?.[1 + x]).toBe(PAL[k])
    }))
  })

  test('puts a heart before the HP bar, and a gold star under it before the XP bar', async () => {
    const c = hudContent(hero(), W)
    MARK.heart.forEach((row, y) => [...row].forEach((k, x) => {
      if (k !== '.') expect(c.px[y]?.[HEART_X + x]).toBe(MARK_INK[k])
    }))
    const star = ink(c, HEART_X, LINE2_Y, 5, 5)
    // A diamond star, worked by hand: its middle row lit across, its corners dark, gold at its edge, pale at its heart.
    expect(star.slice(10, 15).every(p => p === '#e0b84a' || p === '#fff2a8')).toBe(true)
    expect([star[0], star[4], star[20], star[24]].every(p => p !== '#e0b84a' && p !== '#fff2a8')).toBe(true)
    expect(star[2]).toBe('#e0b84a')
    expect(star[12]).toBe('#fff2a8')
  })

  test('fills the HP bar in proportion, green above 70%, amber to 40%, red below', async () => {
    const filledAt = (hp: number) => {
      const row = hudContent(hero({ hp, maxHp: 100 }), BAR25).px[HP_Y + 1] ?? []
      const fill = new Set<string>([...HP_TONES.healthy, ...HP_TONES.hurt, ...HP_TONES.critical])
      return { filled: row.slice(BAR_X, BAR_X + 25).filter(p => fill.has(p)).length, tone: row[BAR_X] }
    }
    expect(filledAt(100)).toEqual({ filled: 25, tone: HP_TONES.healthy[1] })
    expect(filledAt(71)).toEqual({ filled: 18, tone: HP_TONES.healthy[1] })
    expect(filledAt(70)).toEqual({ filled: 18, tone: HP_TONES.hurt[1] })
    expect(filledAt(40)).toEqual({ filled: 10, tone: HP_TONES.critical[1] })
    expect(filledAt(0).filled).toBe(0)
  })

  test('fills the XP bar by the share of the way to the next level', async () => {
    const row = hudContent(hero({ xp: 10, maxHp: 100 }), BAR25).px[XP_Y] ?? []
    expect(row.slice(BAR_X, BAR_X + 25).filter(p => p === XP_FILL).length).toBe(13)
  })

  test('writes the HP after its bar and the level after the XP bar, a green + while points wait', async () => {
    const g = hero({ hp: 86, maxHp: 100, level: 1 })
    const c = hudContent(g, BAR25)
    expect(hasText(c, '86/100', 47, 0, NUM_INK)).toBe(true)
    expect(hasText(c, 'LV1', 47, LINE2_Y, LEVEL_INK)).toBe(true)
    expect(ink(c, 47, LINE2_Y, 30, 5).includes(POINTS_INK)).toBe(false)
    const ready = hudContent({ ...g, points: 2 }, BAR25)
    expect(hasText(ready, '+', 47 + 11 + 1, LINE2_Y, POINTS_INK)).toBe(true)
  })

  test('draws each belt slot\'s icon, and nothing in an empty slot', async () => {
    const g = hero({ belt: [null, null, null, null, { kind: 'smoke', tiers: [2, 0, 0] }] })
    const c = hudContent(g, W)
    const icon = CONSUMABLE_ICONS.smoke
    const x0 = beltSlotX(W, 4) + 1
    icon.forEach((row, y) => [...row].forEach((k, x) => {
      if (k !== '.' && y < 5) expect(c.px[BELT_BELOW_Y + 1 + y]?.[x0 + x]).toBe(PAL[k])
    }))
    // An empty slot is its background and frame only: no key number, as there are no keys.
    const empty = new Set(ink(c, beltSlotX(W, 1) + 1, BELT_BELOW_Y + 1, BELT_SLOT_W - 2, SLOT - 2))
    expect([...empty]).toEqual(['#1a1820'])
  })

  test('marks a slot by the tier it uses next: no pip for the first tier, one for the second, two for the third', async () => {
    const pips = (tiers: [number, number, number]) => {
      const c = hudContent(hero({ belt: [{ kind: 'health', tiers }, null, null, null, null] }), W)
      // The pips sit on the slot's last inner row, right of the icon.
      return ink(c, beltSlotX(W, 0) + 1 + PX, BELT_BELOW_Y + PX, BELT_SLOT_W - 2 - PX, 1).filter(p => p === TIER_INK).length
    }
    expect([pips([1, 0, 0]), pips([3, 1, 0]), pips([1, 1, 1])]).toEqual([0, 1, 2])
  })
})

describe('the side line', () => {
  test('gives the gold and the depth, or the town', async () => {
    const c = hudContent(hero({ gold: 214, depth: 7 }), W)
    expect(hasText(c, '214', 7, SIDE_LINE_Y, GOLD_INK)).toBe(true)
    // After the gold (11 px) and 5 px, the steps' mark and 2 px.
    expect(hasText(c, '7', 7 + 11 + 5 + 7, SIDE_LINE_Y, NUM_INK)).toBe(true)
    const town = hudContent(hero({ gold: 214, where: 'town' }), W)
    expect(hasText(town, 'TOWN', 30, SIDE_LINE_Y, NUM_INK)).toBe(true)
  })

  test('shows an effect only while it runs, with what is left, flush right', async () => {
    const line = (g: Game) => new Set(ink(hudContent(g, W), 0, SIDE_LINE_Y, W, 5))
    const none = line(hero())
    for (const color of [MARK_INK.g, MARK_INK.b, MARK_INK.f]) expect(none.has(color!)).toBe(false)
    const c = hudContent(hero({ effects: { regen: 3, ward: 0, fury: 5 } }), W)
    // Fury last: its mark 6 px plus "5" (3 px) ends at the right edge; regen 4 px before it.
    expect(hasText(c, '5', W - 3, SIDE_LINE_Y, NUM_INK)).toBe(true)
    expect(hasText(c, '3', W - 9 - 4 - 3, SIDE_LINE_Y, NUM_INK)).toBe(true)
    expect(line(hero({ effects: { regen: 3, ward: 0, fury: 5 } })).has(MARK_INK.b!)).toBe(false)
  })

  test('shows the fortune in force flush right, a crystal ball and its initial, the effects to its left', async () => {
    const line = (g: Game) => new Set(ink(hudContent(g, W), 0, SIDE_LINE_Y, W, 5))
    expect(line(hero()).has(MARK_INK.c!)).toBe(false)
    const c = hudContent(hero({ fortune: { kind: 'riches', depth: 1 }, effects: { regen: 0, ward: 0, fury: 5 } }), W)
    expect(line(hero({ fortune: { kind: 'riches', depth: 1 } })).has(MARK_INK.c!)).toBe(true)
    // "R" (3 px) ends at the right edge after the ball's 6; fury's "5" ends 4 px before the ball.
    expect(hasText(c, 'R', W - 3, SIDE_LINE_Y, NUM_INK)).toBe(true)
    expect(hasText(c, '5', W - 9 - 4 - 3, SIDE_LINE_Y, NUM_INK)).toBe(true)
  })

  test('leaves out the fortune when it would come within 4 px of the depth', async () => {
    // 12840 gold on depth 12 ends the depth at 45. "L" and the ball take 9 px from the right edge: at 72 px they start
    // at 63 and show; at 57 at 48, 3 px off the depth, and are left out.
    const line = (w: number) => new Set(ink(hudContent(hero({ gold: 12840, depth: 12, fortune: { kind: 'luck', depth: 12 } }), w), 0, SIDE_LINE_Y, w, 5))
    expect(line(72).has(MARK_INK.c!)).toBe(true)
    expect(line(58).has(MARK_INK.c!)).toBe(true)
    expect(line(57).has(MARK_INK.c!)).toBe(false)
  })

  test('leaves out an effect that would run into the depth, never clipping one', async () => {
    // At 72 px with 12840 gold on depth 12, worked by hand: fury from 63, ward from 50, regen would start at 37,
    // before the depth ends at 49.
    const c = hudContent(hero({ gold: 12840, depth: 12, effects: { regen: 3, ward: 2, fury: 5 } }), 72)
    const line = new Set(ink(c, 0, SIDE_LINE_Y, 72, 5))
    expect(line.has(MARK_INK.f!)).toBe(true)
    expect(line.has(MARK_INK.b!)).toBe(true)
    expect(line.has(MARK_INK.g!)).toBe(false)
    expect(hasText(c, '2', 56, SIDE_LINE_Y, NUM_INK)).toBe(true)
  })

  test('keeps 4 px between the depth and an effect', async () => {
    // At 72 px, depth 12 ends at 45: fury "5" from 63; regen "10" would start at 46, 1 px clear of it, so it is left out.
    const line = (g: Partial<Game>) => new Set(ink(hudContent(hero({ gold: 12840, depth: 12, ...g }), 72), 0, SIDE_LINE_Y, 72, 5))
    expect(line({ effects: { regen: 10, ward: 0, fury: 5 } }).has(MARK_INK.g!)).toBe(false)
    // With regen alone it starts at 59, and shows.
    expect(line({ effects: { regen: 10, ward: 0, fury: 0 } }).has(MARK_INK.g!)).toBe(true)
  })
})

describe("the depth's twist on the side line", () => {
  const world = hero().world
  const twisted = (mod: string) => {
    for (let d = 10; d < 400; d += 1) if (depthMod(world, d) === mod) return d
    throw new Error(mod)
  }
  const plain = () => {
    for (let d = 10; d < 400; d += 1) if (depthMod(world, d) === undefined && !isBossDepth(d)) return d
    throw new Error('plain')
  }
  const line = (g: Game, w = W) => new Set(ink(hudContent(g, w), 0, SIDE_LINE_Y, w, 5))

  test('a twisted depth has its mark after its number; a plain one, or the town, none', async () => {
    expect(line(hero({ depth: twisted('gloom') })).has(MARK_INK.m!)).toBe(true)
    expect(line(hero({ depth: plain() })).has(MARK_INK.m!)).toBe(false)
    expect(line(hero({ depth: twisted('gloom'), where: 'town' })).has(MARK_INK.m!)).toBe(false)
    expect(line(hero({ depth: twisted('horde') })).has(MARK_INK.h!)).toBe(true)
  })

  test('the mark takes room from the effects: one that clears a plain depth by 4 px is left out beside a twist', async () => {
    // At 60 px with 12840 gold: the depth's two digits end at 45, its mark at 52; regen "3" starts at 51.
    const g = (depth: number) => hero({ gold: 12840, depth, effects: { regen: 3, ward: 0, fury: 0 } })
    expect(line(g(plain()), 60).has(MARK_INK.g!)).toBe(true)
    expect(line(g(twisted('horde')), 60).has(MARK_INK.g!)).toBe(false)
  })
})

describe("the foe's bar on the map", () => {
  test('sits just above the foe, filled by its share of HP, and is gone with the foe', async () => {
    const g = newGame(2)
    const foe = foeAhead(g, 2, { hp: 3, maxHp: 10 })
    const width = MAP_W * PX
    const height = 18 * PX
    const o = viewOrigin(g, width, height)
    const at = (frame: Uint32Array, x: number, y: number) => frame[y * width + x]
    const left = foe.x * PX - o.x
    const top = foe.y * PX - o.y
    const withFoe = frameOf({ ...g, foe }, width, height)
    const without = frameOf(g, width, height)
    // No box around the bar: the rows above and below it show the ground as without the foe.
    expect(at(withFoe, left + 1, top - 4)).toBe(at(without, left + 1, top - 4))
    expect(at(withFoe, left + 1, top - 2)).toBe(at(without, left + 1, top - 2))
    // 3 of 10 HP across a bar of FOE_BAR_W pixels.
    const fills = Array.from({ length: FOE_BAR_W }, (_, i) => at(withFoe, left + 1 + i, top - 3))
    const filled = Math.round((3 / 10) * FOE_BAR_W)
    expect(fills).toEqual([...Array(filled).fill(hexToInt(FOE_BAR_FILL)), ...Array(FOE_BAR_W - filled).fill(hexToInt(FOE_BAR_EMPTY))])
    expect(at(without, left + 1, top - 3)).not.toBe(hexToInt(FOE_BAR_FILL))
  })
})

describe("a champion's mark on the map", () => {
  test('a gold pip at each end of its bar; a plain foe has none', async () => {
    const g = newGame(2)
    const width = MAP_W * PX
    const height = 18 * PX
    const o = viewOrigin(g, width, height)
    const plain = foeAhead(g, 2, { hp: 3, maxHp: 10 })
    const champion = { ...plain, champion: 'tough' as const }
    const at = (frame: Uint32Array, x: number, y: number) => frame[y * width + x]
    const left = plain.x * PX - o.x
    const top = plain.y * PX - o.y
    const marked = frameOf({ ...g, foe: champion }, width, height)
    const bare = frameOf({ ...g, foe: plain }, width, height)
    for (const x of [left, left + FOE_BAR_W + 1]) {
      expect(at(marked, x, top - 3)).toBe(hexToInt(CHAMPION_MARK))
      expect(at(bare, x, top - 3)).not.toBe(hexToInt(CHAMPION_MARK))
    }
  })

  test('a boss wears the same gold pips', async () => {
    const g = newGame(2)
    const width = MAP_W * PX
    const height = 18 * PX
    const o = viewOrigin(g, width, height)
    const boss = { ...foeAhead(g, 2, { hp: 3, maxHp: 10 }), boss: true as const }
    const frame = frameOf({ ...g, foe: boss }, width, height)
    for (const x of [boss.x * PX - o.x, boss.x * PX - o.x + FOE_BAR_W + 1]) expect(frame[(boss.y * PX - o.y - 3) * width + x]).toBe(hexToInt(CHAMPION_MARK))
  })
})

describe('the strip at any pane width', () => {
  test('nothing ever lands on the HP bar, and it keeps 10 px or more, from 80 to 140 columns', async () => {
    for (let columns = 80; columns <= 140; columns += 1) {
      const width = columns - 2 * INSET
      const g = hero({ hp: 27, maxHp: 105 })
      const { barW, numX } = barsLayout(g, width)
      const row = hudContent(g, width).px[HP_Y + 1] ?? []
      const tones = new Set<string>([...HP_TONES.critical, '#1e2420'])
      expect(row.slice(BAR_X, BAR_X + barW).every(p => tones.has(p)) ? 'clear' : `${columns}: something drawn over the bar`).toBe('clear')
      expect(barW).toBeGreaterThanOrEqual(10)
      expect(numX + 27).toBeLessThan(portalSlotX(width))
    }
  })
})

describe('clicks on the strip', () => {
  test('the portrait opens the inventory, the level line the sheet; a belt slot uses that slot; the portal opens; the rest does nothing', async () => {
    for (const width of [80, 111]) {
      // A click in the content's pixels, as it lands on the framed strip: INSET in, rows two pixels a cell.
      const hit = (x: number, y: number) => hudHit(width, { x: INSET + x, y: (INSET + y) / 2 })
      const inner = width - 2 * INSET
      expect(hit(5, 3)).toEqual({ kind: 'panel', panel: 'bag' })
      expect(hit(BAR_X + 4, HP_Y)).toBeUndefined()
      expect(hit(BAR_X + 4, LINE2_Y + 2)).toEqual({ kind: 'panel', panel: 'sheet' })
      expect(hit(barsLayout(hero(), inner).numX + 2, LINE2_Y + 2)).toEqual({ kind: 'panel', panel: 'sheet' })
      for (let i = 0; i < 5; i += 1) expect(hit(beltSlotX(inner, i) + 6, BELT_BELOW_Y + 6)).toEqual({ kind: 'use', slot: i })
      expect(hit(portalSlotX(inner) + 6, 6)).toEqual({ kind: 'portal' })
      expect(hit(5, SIDE_LINE_Y + 2)).toBeUndefined()
      // On the iron itself: nothing.
      expect(hudHit(width, { x: 1, y: 1 })).toBeUndefined()
    }
  })
})

test('the bars have no frame: the pixels around them are the strip itself', async () => {
  const c = hudContent(hero({ hp: 50, maxHp: 100 }), BAR25)
  const around = [...c.px[HP_Y - 1]!.slice(BAR_X, BAR_X + 25), ...c.px[XP_Y + 1]!.slice(BAR_X, BAR_X + 25), c.px[HP_Y]![BAR_X - 1], c.px[HP_Y]![BAR_X + 25]]
  expect(around.filter(p => p === GRID)).toEqual([])
  expect(HP_H).toBe(3)
})

describe('the iron frame', () => {
  test('surrounds the strip: a dark edge, rivets along it, and the contents INSET in, unchanged', async () => {
    const width = 110
    const g = hero({ hp: 50, maxHp: 100 })
    const framed = hudPixels(g, width)
    const inner = hudContent(g, width - 2 * INSET)
    expect(framed.px.length).toBe(inner.h + 2 * INSET)
    expect(hudLayout(width).height).toBe(framed.px.length)
    // The outermost ring is all one dark edge color.
    const ring = [...framed.px[0]!, ...framed.px[framed.h - 1]!, ...framed.px.map(r => r[0]!), ...framed.px.map(r => r[width - 1]!)]
    expect(new Set(ring).size).toBe(1)
    // Rivets along the top, in the frame's middle row.
    expect(framed.px[1]!.filter(p => p === '#c8ccd4').length).toBeGreaterThanOrEqual(Math.floor(width / 12) - 1)
    // The contents unchanged, INSET from the edges.
    inner.px.forEach((row, y) => row.forEach((p, x) => {
      if (framed.px[INSET + y]![INSET + x] !== p) throw new Error(`content moved at ${x},${y}`)
    }))
    expect(FRAME).toBeLessThan(INSET)
  })
})

describe("a boss's crown", () => {
  test('three gold points and a band in the two rows over its tile; no crown on a champion or a plain foe', async () => {
    const g = newGame(2)
    const width = MAP_W * PX
    const height = 18 * PX
    const o = viewOrigin(g, width, height)
    const plain = foeAhead(g, 2, { hp: 3, maxHp: 10 })
    const at = (frame: Uint32Array, x: number, y: number) => frame[y * width + x]
    const left = plain.x * PX - o.x
    const top = plain.y * PX - o.y
    const gold = hexToInt(PAL.y!)
    const crowned = frameOf({ ...g, foe: { ...plain, boss: true } }, width, height)
    // The crown as drawn: points over columns 1, 3, 4 and 6, a band over 1 to 6.
    expect([1, 3, 4, 6].map(x => at(crowned, left + x, top - 2))).toEqual([gold, gold, gold, gold])
    expect([1, 2, 3, 4, 5, 6].map(x => at(crowned, left + x, top - 1))).toEqual(Array(6).fill(gold))
    expect(at(crowned, left + 2, top - 2)).not.toBe(gold)
    for (const foe of [plain, { ...plain, champion: 'tough' as const }]) {
      const bare = frameOf({ ...g, foe }, width, height)
      expect(at(bare, left + 3, top - 1)).not.toBe(gold)
    }
  })
})
