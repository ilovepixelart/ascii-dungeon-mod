import { describe, expect, test } from 'claude-code/testing'

import type { Game } from '../types'
import { foeAhead } from './fixtures'
import { depthMod, isBossDepth, newGame } from './game'
import {
  BAR_X, BELT_BELOW_Y, PORTRAIT, FRAME, GOLD_INK, HEART_X, HP_H, HP_TONES, HP_Y, INSET, LEVEL_INK, LINE2_Y, MARK, MARK_INK, NUM_INK, POINTS_INK, SIDE_LINE_X, SIDE_LINE_Y, XP_FILL, XP_Y,
  BELT_W, barsLayout, beltMenuBox, hudBoxes, beltSlotX, contentLayout, hudContent, hudGesture, hudHit, hudHot, hudLayout, hudPixels, portalSlotX, settingsSlotX, hudLabels,
} from './hud'
import type { Gesture } from './window'
import { BELT_SLOT_W, GRID, SLOT, SLOT_BG } from './canvas'
import { MAP_W } from './map'
import { INK } from './ui/tokens'
import { CONSUMABLE_ICONS } from './icons'
import { TIER_INK } from './pieces'
import { PAL, PX, TOWN_THING_ART, heroArt, textMask } from './pixelart'
import { CHAMPION_MARK, FOE_BAR_EMPTY, FOE_BAR_FILL, FOE_BAR_W, frameOf, hexToInt, viewOrigin } from './pixels'

const W = 111
const hero = (over: Partial<Game> = {}): Game => ({ ...newGame(4, 'knight'), ...over })
/**
 * A strip whose bars are exactly 25 pixels long, worked by hand: the bars start 17 in, then the bar, 1 px, the 10 px
 * settings slot, 1 px and the 10 px portal. Their numbers are text on them and take no room.
 */
const BAR25 = 17 + 25 + 1 + 10 + 1 + 10
const ink = (c: { px: string[][] }, x: number, y: number, w: number, h: number) => c.px.slice(y, y + h).flatMap(r => r.slice(x, x + w))
/** Whether `text` is drawn in `color` with its top-left corner at x, y: lit exactly where the font is. */
const hasText = (c: { px: string[][] }, text: string, x: number, y: number, color: string) =>
  textMask(text).every((row, dy) => [...row].every((k, dx) => (c.px[y + dy]?.[x + dx] === color) === (k === '#')))

describe('the strip', () => {
  test('is the pane\'s width and the same height at every width: the top row, the belt, the side line', async () => {
    for (const width of [72, W, 140]) {
      const c = hudContent(hero(), width)
      expect(c.px.length).toBe(24)
      for (const row of c.px) expect(row.length).toBe(width)
      expect(contentLayout(width).height).toBe(24)
    }
    expect(beltSlotX(W, 0)).toBe(0)
    expect(portalSlotX(W) + SLOT).toBe(W)
  })

  test('works out the bars by hand: 25 px at the BAR25 width', async () => {
    expect(BAR_X).toBe(17)
    expect(barsLayout(hero({ maxHp: 100, level: 1 }), BAR25)).toEqual({ barW: 25 })
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
    // Its inside: the dark outline keeps its color, so the shut portal is the open one's size.
    const inked = TOWN_THING_ART.portal.flatMap((row, y) => [...row].flatMap((k, x) => (k === '.' || k === 'K' ? [] : [shut.px[1 + y]?.[x0 + x]])))
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
      if (k !== '.') expect(c.px[HP_Y + y]?.[HEART_X + x]).toBe(MARK_INK[k])
    }))
    const star = ink(c, HEART_X, XP_Y, 5, 4)
    // A five-pointed star 4 px tall, worked by hand: its tip, its arms lit across, its body, its two feet; gold at its
    // edge, pale at its heart.
    const isLit = (p: string | undefined) => p === '#e0b84a' || p === '#fff2a8'
    expect([star[2], ...star.slice(5, 10), star[11], star[12], star[13], star[16], star[18]].every(isLit)).toBe(true)
    expect([star[0], star[4], star[15], star[17], star[19]].some(isLit)).toBe(false)
    expect(star[2]).toBe('#e0b84a')
    expect(star[7]).toBe('#fff2a8')
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

  test('writes the HP and the level as text centred on their bars, each character on the bar color under it', async () => {
    const g = hero({ hp: 86, maxHp: 100, level: 1 })
    const [hp, lv] = hudLabels(g, BAR25 + 2 * INSET)
    const text = (b: typeof hp) => b!.lines[0]!.map(r => r.text).join('')
    expect([text(hp), text(lv)]).toEqual(['86/100', 'LV1'])
    expect(text(hudLabels({ ...g, points: 2 }, BAR25 + 2 * INSET)[1])).toBe('LV1+')
    // The + is in the level's own ink, character for character.
    const ready = hudLabels({ ...g, points: 2 }, BAR25 + 2 * INSET)[1]!.lines[0]!
    expect(ready.at(-1)!.color).toBe(ready.at(-2)!.color)
    // "86/100" on 25 px: 19 spare, 9 before it, so from BAR_X + 9; its box starts a cell before (no padding).
    expect(hp!.x + 1).toBe(INSET + BAR_X + 9)
    // On the HP bar's middle and bottom rows, and on the XP bar.
    // Each on its bar's middle two rows: one text row, a bar row above it and one below.
    expect((hp!.y + 1) * 2).toBe(INSET + HP_Y + 1)
    expect((lv!.y + 1) * 2).toBe(INSET + XP_Y + 1)
    // 86% of 25 is 22 px filled: the text's cells from 9 to 14 are all on the fill, in the bar's own green.
    expect(hp!.lines[0]!.every(r => r.bg === HP_TONES.healthy[1])).toBe(true)
    // At 20% only 5 px are filled: the text is on the empty bar.
    expect(hudLabels({ ...g, hp: 20 }, BAR25 + 2 * INSET)[0]!.lines[0]!.every(r => r.bg === '#1e2420')).toBe(true)
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
      // The pips sit on the slot's top inner row from its left, every other pixel, over the icon.
      return [1, 3].filter(dx => c.px[BELT_BELOW_Y + 1]![beltSlotX(W, 0) + dx] === TIER_INK).length
    }
    expect([pips([1, 0, 0]), pips([3, 1, 0]), pips([1, 1, 1])]).toEqual([0, 1, 2])
  })
})

/** The side line's words in a strip of content `w` wide: each its text and its first cell, in content pixels. */
const sideWords = (g: Game, w = W) =>
  hudLabels(g, w + 2 * INSET).filter(b => b.y === (INSET + SIDE_LINE_Y + 1) / 2 - 1).map(b => ({ text: b.lines[0]!.map(r => r.text).join(''), x: b.x + 1 - INSET, color: b.lines[0]![0]!.color }))

describe('the side line', () => {
  test('gives the gold and the depth, or the town, as text after their marks', async () => {
    // Past the belt (five slots sharing their frames, 46 px) and 3 px: the coin's 5 px from 49, a cell, the gold; 3 cells;
    // the steps' 5 px, a cell, the depth.
    expect(sideWords(hero({ gold: 214, depth: 7 }))).toEqual([{ text: '214', x: 55, color: GOLD_INK }, { text: '7', x: 67, color: NUM_INK }])
    expect(sideWords(hero({ gold: 214, where: 'town' }))[1]).toEqual({ text: 'TOWN', x: 67, color: NUM_INK })
    // The gold in full, thousands set apart, as the title bar writes it.
    expect(sideWords(hero({ gold: 251952, depth: 7 }))[0]!.text).toBe('251,952')
    // Its row is the whole cell on the marks' middle rows.
    expect(hudLabels(hero(), W + 2 * INSET).some(b => b.y * 2 + 2 === INSET + SIDE_LINE_Y + 1)).toBe(true)
  })

  test('shows an effect only while it runs, with what is left, flush right', async () => {
    const line = (g: Game) => new Set(ink(hudContent(g, W), SIDE_LINE_X, SIDE_LINE_Y, W - SIDE_LINE_X, 5))
    const none = line(hero())
    for (const color of [MARK_INK.g, MARK_INK.b, MARK_INK.f]) expect(none.has(color!)).toBe(false)
    // Fury last: its mark, a cell and "5" end at the right edge; regen 3 cells before it.
    const words = sideWords(hero({ effects: { regen: 3, ward: 0, fury: 5 } })).slice(2)
    expect(words.map(w => [w.text, w.x])).toEqual([['5', W - 1], ['3', W - 11]])
    expect(line(hero({ effects: { regen: 3, ward: 0, fury: 5 } })).has(MARK_INK.b!)).toBe(false)
  })

  test('shows the fortune in force flush right, a crystal ball and its initial, the effects to its left', async () => {
    const line = (g: Game) => new Set(ink(hudContent(g, W), SIDE_LINE_X, SIDE_LINE_Y, W - SIDE_LINE_X, 5))
    expect(line(hero()).has(MARK_INK.c!)).toBe(false)
    expect(line(hero({ fortune: { kind: 'riches', depth: 1 } })).has(MARK_INK.c!)).toBe(true)
    const words = sideWords(hero({ fortune: { kind: 'riches', depth: 1 }, effects: { regen: 0, ward: 0, fury: 5 } })).slice(2)
    expect(words.map(w => [w.text, w.x])).toEqual([['R', W - 1], ['5', W - 11]])
  })

  test('leaves out the fortune when it would come within 3 cells of the depth', async () => {
    // 12840 gold on depth 12: "12,840" from 55 to 60, the depth from 70 to 71, ending at 72. The ball and "L" take 7
    // from the right edge: at 82 they start at 75 and show; at 81 at 74, and are left out.
    const line = (w: number) => new Set(ink(hudContent(hero({ gold: 12840, depth: 12, fortune: { kind: 'luck', depth: 12 } }), w), SIDE_LINE_X, SIDE_LINE_Y, w - SIDE_LINE_X, 5))
    expect(line(82).has(MARK_INK.c!)).toBe(true)
    expect(line(81).has(MARK_INK.c!)).toBe(false)
  })

  test('leaves out an effect that would run into the depth, never clipping one', async () => {
    // At 92 with 12840 gold on depth 12, worked by hand: fury from 85, ward from 75, 3 clear of the depth's end at 72;
    // regen would start at 65.
    const g = hero({ gold: 12840, depth: 12, effects: { regen: 3, ward: 2, fury: 5 } })
    const line = new Set(ink(hudContent(g, 92), SIDE_LINE_X, SIDE_LINE_Y, 92 - SIDE_LINE_X, 5))
    expect([line.has(MARK_INK.f!), line.has(MARK_INK.b!), line.has(MARK_INK.g!)]).toEqual([true, true, false])
    expect(sideWords(g, 92).slice(2).map(w => [w.text, w.x])).toEqual([['5', 91], ['2', 81]])
    // A cell narrower, the ward would start 2 clear: left out.
    expect(new Set(ink(hudContent(g, 91), SIDE_LINE_X, SIDE_LINE_Y, 91 - SIDE_LINE_X, 5)).has(MARK_INK.b!)).toBe(false)
  })

  test('keeps 3 cells between the depth and an effect', async () => {
    // At 90, fury from 83; regen "10" would start at 72, on the depth's end, so it is left out; alone it starts at 82.
    const line = (g: Partial<Game>) => new Set(ink(hudContent(hero({ gold: 12840, depth: 12, ...g }), 90), SIDE_LINE_X, SIDE_LINE_Y, 90 - SIDE_LINE_X, 5))
    expect(line({ effects: { regen: 10, ward: 0, fury: 5 } }).has(MARK_INK.g!)).toBe(false)
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
  const line = (g: Game, w = W) => new Set(ink(hudContent(g, w), SIDE_LINE_X, SIDE_LINE_Y, w - SIDE_LINE_X, 5))

  test('a twisted depth has its mark after its number; a plain one, or the town, none', async () => {
    expect(line(hero({ depth: twisted('gloom') })).has(MARK_INK.m!)).toBe(true)
    expect(line(hero({ depth: plain() })).has(MARK_INK.m!)).toBe(false)
    expect(line(hero({ depth: twisted('gloom'), where: 'town' })).has(MARK_INK.m!)).toBe(false)
    expect(line(hero({ depth: twisted('horde') })).has(MARK_INK.h!)).toBe(true)
  })

  test('the mark takes room from the effects: one that clears a plain depth by 3 cells is left out beside a twist', async () => {
    // At 37 with 12840 gold and a two-digit depth: the depth ends at 22, a twist's mark from 24 to 28; regen "3"
    // starts at 30, 8 clear of a plain depth and 1 of the mark.
    const g = (depth: number) => hero({ gold: 12840, depth, effects: { regen: 3, ward: 0, fury: 0 } })
    expect(line(g(plain()), 87).has(MARK_INK.g!)).toBe(true)
    expect(line(g(twisted('horde')), 87).has(MARK_INK.g!)).toBe(false)
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
      const { barW } = barsLayout(g, width)
      const row = hudContent(g, width).px[HP_Y + 1] ?? []
      const tones = new Set<string>([...HP_TONES.critical, '#1e2420'])
      expect(row.slice(BAR_X, BAR_X + barW).every(p => tones.has(p)) ? 'clear' : `${columns}: something drawn over the bar`).toBe('clear')
      expect(barW).toBeGreaterThanOrEqual(10)
      // "105/105" as text, a cell a character, lies on the bar.
      const [label] = hudLabels(g, columns)
      expect(label!.x + 1 >= INSET + BAR_X && label!.x + 1 + 7 <= INSET + BAR_X + barW).toBe(true)
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
      expect(hit(BAR_X + barsLayout(hero(), inner).barW - 2, LINE2_Y + 2)).toEqual({ kind: 'panel', panel: 'sheet' })
      for (let i = 0; i < 5; i += 1) expect(hit(beltSlotX(inner, i) + 6, BELT_BELOW_Y + 6)).toEqual({ kind: 'use', slot: i })
      expect(hit(portalSlotX(inner) + 6, 6)).toEqual({ kind: 'portal' })
      expect(hit(settingsSlotX(inner) + 5, 5)).toEqual({ kind: 'panel', panel: 'settings' })
      // Between the belt and the side line: nothing.
      expect(hit(SIDE_LINE_X - 2, SIDE_LINE_Y + 2)).toBeUndefined()
      // On the iron itself: nothing.
      expect(hudHit(width, { x: 1, y: 1 })).toBeUndefined()
    }
  })

  test('settings is a slot left of the portal at every width, the bars ending before it and keeping 10 px', async () => {
    for (let columns = 80; columns <= 140; columns += 1) {
      const inner = columns - 2 * INSET
      const g = hero({ hp: 105, maxHp: 105, level: 12, points: 1 })
      expect(BAR_X + barsLayout(g, inner).barW).toBeLessThan(settingsSlotX(inner))
      expect(barsLayout(g, inner).barW).toBeGreaterThanOrEqual(10)
      expect(settingsSlotX(inner) + SLOT).toBeLessThan(portalSlotX(inner))
    }
  })
})

describe('a belt slot\'s menu', () => {
  const width = 111
  const inner = width - 2 * INSET
  const at = (x: number, y: number) => ({ x: x + 0.5, y: y + 0.25 })
  const click = (p: { x: number; y: number }, button: 'left' | 'right' = 'left'): Gesture => ({ type: 'release', from: p, at: p, button })
  const onSlot = (i: number) => at(INSET + beltSlotX(inner, i) + 6, (INSET + BELT_BELOW_Y + 6) / 2)
  const potions = hero({ belt: [{ kind: 'health', tiers: [4, 0, 1] }, null, null, null, { kind: 'smoke', tiers: [1, 0, 0] }] })

  test('a right-click on a filled slot opens its menu: a line a tier held, strongest first, with how many', async () => {
    expect(hudGesture(potions, null, click(onSlot(0), 'right'), width)).toEqual({ menu: 0, actions: [] })
    const box = beltMenuBox(potions, 0, width)!
    expect(box.lines.map(l => l.map(r => r.text).join(''))).toEqual(['> Elixir x1', '  Health Potion x4'])
    // The tier chosen for the slot is the one marked.
    const chose = hero({ belt: [{ kind: 'health', tiers: [4, 0, 1], chosen: 1 }, null, null, null, null] })
    expect(beltMenuBox(chose, 0, width)!.lines.map(l => l[0]!.text)).toEqual(['  ', '> '])
  })

  test('a right-click on an empty slot opens nothing, and a left-click still uses the strongest', async () => {
    expect(hudGesture(potions, null, click(onSlot(1), 'right'), width)).toEqual({ menu: null, actions: [] })
    expect(hudGesture(potions, null, click(onSlot(0)), width)).toEqual({ menu: null, actions: [{ kind: 'use', slot: 0 }] })
  })

  test('a click on a line chooses that tier for the slot, using nothing, and closes the menu; a click elsewhere closes it and does what it does', async () => {
    const box = beltMenuBox(potions, 0, width)!
    expect(hudGesture(potions, 0, click(at(box.x + 2, box.y + 2)), width)).toEqual({ menu: null, actions: [{ kind: 'choose', slot: 0, tier: 1 }] })
    expect(hudGesture(potions, 0, click(at(box.x + 2, box.y + 1)), width)).toEqual({ menu: null, actions: [{ kind: 'choose', slot: 0, tier: 3 }] })
    // Its frame: nothing, the menu stays.
    expect(hudGesture(potions, 0, click(at(box.x + 2, box.y)), width)).toEqual({ menu: 0, actions: [] })
    expect(hudGesture(potions, 0, click(onSlot(4)), width)).toEqual({ menu: null, actions: [{ kind: 'use', slot: 4 }] })
  })

  test('with it open, nothing under it is lit: a click there lands on the menu', async () => {
    for (const w of [80, 111, 200]) {
      for (const slot of [0, 4]) {
        const box = beltMenuBox(potions, slot, w)!
        const under = hudHot(potions, w, [box]).filter(r => {
          const c = at(r.x + Math.floor(r.w / 2), (r.y + Math.floor(r.h / 2)) / 2)
          return c.x >= box.x && c.x < box.x + box.w && c.y >= box.y && c.y < box.y + box.h
        })
        expect(under).toEqual([])
      }
    }
    // With no menu open, the portrait is lit as ever.
    expect(hudHot(potions, width, []).length).toBe(hudHot(potions, width).length)
  })

  test('stands on its slot: just above the belt, its left edge on the slot\'s, inside the strip', async () => {
    const beltTop = Math.floor((INSET + BELT_BELOW_Y) / 2)
    for (const w of [80, 111, 200]) {
      for (const slot of [0, 4]) {
        const box = beltMenuBox(potions, slot, w)!
        expect(box.y + box.h).toBe(beltTop)
        expect(box.x).toBe(Math.min(INSET + beltSlotX(w - 2 * INSET, slot), w - box.w))
        expect(box.x >= 0 && box.x + box.w <= w && box.y >= 0).toBe(true)
      }
    }
    expect(beltMenuBox(potions, 1, width)).toBeUndefined()
  })
})

test('the bars have no frame: the pixels around them are the strip itself', async () => {
  const c = hudContent(hero({ hp: 50, maxHp: 100 }), BAR25)
  const around = [...c.px[HP_Y + 2]!.slice(BAR_X, BAR_X + 25), ...c.px[XP_Y + 2]!.slice(BAR_X, BAR_X + 25), c.px[HP_Y]![BAR_X - 1], c.px[HP_Y]![BAR_X + 25]]
  expect(around.filter(p => p === GRID)).toEqual([])
})

test('the HP bar is four rows of one flat color, its mark\'s height', async () => {
  expect(HP_H).toBe(4)
  expect(HP_H).toBe(MARK.heart.length)
  for (const hp of [100, 60, 30]) {
    const c = hudContent(hero({ hp, maxHp: 100 }), BAR25)
    const rows = [0, 1, 2, 3].map(dy => c.px[HP_Y + dy]!.slice(BAR_X, BAR_X + 5).join())
    expect(new Set(rows).size).toBe(1)
    expect(new Set(c.px[HP_Y]!.slice(BAR_X, BAR_X + 5)).size).toBe(1)
  }
})

describe('the iron frame', () => {
  test('surrounds the strip: a metal band, rivets along it, and the contents INSET in, unchanged', async () => {
    const width = 110
    const g = hero({ hp: 50, maxHp: 100 })
    const framed = hudPixels(g, width)
    const inner = hudContent(g, width - 2 * INSET)
    expect(framed.px.length).toBe(inner.h + 2 * INSET)
    expect(hudLayout(width).height).toBe(framed.px.length)
    // Rivets along the top, in the band.
    expect(framed.px[0]!.filter(p => p === '#c8ccd4').length).toBeGreaterThanOrEqual(Math.floor(width / 12) - 1)
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

test('a belt menu open over the strip hides the numbers it covers, and leaves those it does not', async () => {
  const g = hero({ hp: 87, maxHp: 105, level: 7, belt: [{ kind: 'health', tiers: [4, 0, 1] }, null, null, null, null] })
  const menu = beltMenuBox(g, 0, 111)!
  const shown = hudBoxes(g, 111, [menu])
  const covers = (b: (typeof shown)[number]) => b.x < menu.x + menu.w && menu.x < b.x + b.w && b.y < menu.y + menu.h && menu.y < b.y + b.h
  expect(shown.filter(b => b.role === 'label').some(covers)).toBe(false)
  expect(shown.at(-1)).toBe(menu)
  // With none open: the HP and the level on their bars, the slot's count, the gold and the depth.
  expect(hudBoxes(g, 111, []).filter(b => b.role === 'label')).toHaveLength(5)
})

test('the shut portal is the open one\'s size: its outline stays dark, only its inside goes grey', async () => {
  const width = 111 - 2 * INSET
  const g = hero()
  const open = hudContent(g, width)
  const shut = hudContent({ ...g, foe: foeAhead(g, 2) }, width)
  const x0 = portalSlotX(width) + 1
  const lit = (c: typeof open) => TOWN_THING_ART.portal.flatMap((row, y) => [...row].flatMap((k, x) => (k !== '.' && c.px[1 + y]![x0 + x] !== PAL.K ? [`${x},${y}`] : [])))
  expect(lit(shut)).toEqual(lit(open))
  expect(shut.px[1 + 3]![x0 + 3]).not.toBe(open.px[1 + 3]![x0 + 3])
})

test('the heart and the star are the same size: five pixels across, four down, a pixel either side of their bars', async () => {
  for (const m of [MARK.heart, MARK.xp]) {
    expect(m).toHaveLength(4)
    const xs = m.flatMap(row => [...row].flatMap((k, x) => (k === '.' ? [] : [x])))
    expect([Math.min(...xs), Math.max(...xs)]).toEqual([0, 4])
    expect(m[0]!.includes('.') && m.every(row => row.length === 5)).toBe(true)
  }
})

test('a pixel stands between the settings slot and the portal', async () => {
  const width = 111 - 2 * INSET
  expect(portalSlotX(width) - (settingsSlotX(width) + SLOT)).toBe(1)
})

test('each bar stands beside its mark on the same four rows, on an odd row of the strip', async () => {
  const c = hudContent(hero(), 111 - 2 * INSET)
  const rowsOf = (ink: string) => c.px.flatMap((row, y) => (row.slice(HEART_X, HEART_X + 5).includes(ink) ? [y] : []))
  const heart = rowsOf(MARK_INK.r!)
  const star = rowsOf(MARK_INK.x!)
  expect([Math.min(...heart), Math.max(...heart)]).toEqual([HP_Y, HP_Y + 3])
  expect([Math.min(...star), Math.max(...star)]).toEqual([XP_Y, XP_Y + 3])
  expect([(INSET + HP_Y) % 2, (INSET + XP_Y) % 2]).toEqual([1, 1])
})

test('a pixel stands between the bars and the settings slot', async () => {
  const width = 111 - 2 * INSET
  expect(settingsSlotX(width) - (BAR_X + barsLayout(hero(), width).barW)).toBe(1)
})

test('a pixel stands between the marks and their bars', async () => {
  expect(BAR_X - (HEART_X + 5)).toBe(1)
})

test('a pixel stands between the portrait and the marks', async () => {
  expect(HEART_X - PORTRAIT).toBe(1)
})

test('a slot\'s count lies clear over its icon: the icon drawn whole under it, the count\'s cells on its pixels', async () => {
  const width = 111 - 2 * INSET
  const g = hero({ belt: [{ kind: 'health', tiers: [12, 0, 0] }, null, null, null, null] })
  const c = hudContent(g, width)
  const icon = CONSUMABLE_ICONS.health
  // The icon's every pixel where its art has one, the count's corner included: no badge cut into it.
  icon.forEach((row, y) => [...row].forEach((k, x) => {
    if (k !== '.') expect(c.px[BELT_BELOW_Y + 1 + y]![beltSlotX(width, 0) + 1 + x]).toBe(PAL[k])
  }))
  const count = hudLabels(g, width + 2 * INSET).find(b => b.lines[0]!.map(r => r.text).join('') === '12')!
  expect(count.lines[0]!.some(r => r.bg !== SLOT_BG)).toBe(true)
})

test('a slot counts the tier it uses next, as its icon and pips show it; the other tiers are not counted', async () => {
  const count = (tiers: [number, number, number]) => {
    const g = hero({ belt: [null, null, { kind: 'fury', tiers }, null, null] })
    return hudLabels(g, 111).filter(b => b.y === 9).map(b => ({ text: b.lines[0]!.map(r => r.text).join(''), x: b.x + 1 }))
  }
  // On the icon's bottom right, against the slot's frame; on the strip's row 20, the last whole cell inside the slot.
  const right = INSET + beltSlotX(111, 2) + BELT_SLOT_W - 1
  expect(count([3, 0, 0])).toEqual([{ text: '3', x: right - 1 }])
  expect(count([2, 1, 0])).toEqual([{ text: '1', x: right - 1 }])
  // 99 of each tier: the 99 Scrolls of the Berserker, two digits, where all 297 would cover the icon.
  expect(count([99, 99, 99])).toEqual([{ text: '99', x: right - 2 }])
})

test('a pixel under the star; the side line\'s marks on the belt\'s middle; two pixels under the belt; one between the content and the metal', async () => {
  expect(BELT_BELOW_Y - (XP_Y + 4)).toBe(1)
  // A 10 px slot and 5 px marks: 3 rows down, so the text's row (the marks' second and third) is a whole cell framed.
  expect([SIDE_LINE_Y - BELT_BELOW_Y, (INSET + SIDE_LINE_Y + 1) % 2]).toEqual([3, 0])
  expect(contentLayout(100).height - (BELT_BELOW_Y + SLOT)).toBe(2)
  expect(INSET - FRAME).toBe(1)
})

test('the iron frame is the riveted metal band alone, one pixel: no dark edge, no inner line', async () => {
  const width = 110
  const framed = hudPixels(hero(), width)
  expect(FRAME).toBe(1)
  const ring = new Set([...framed.px[0]!, ...framed.px[framed.h - 1]!, ...framed.px.map(r => r[0]!), ...framed.px.map(r => r[width - 1]!)])
  expect([...ring].every(p => ['#5a5f6b', '#3a3e48', '#c8ccd4'].includes(p))).toBe(true)
  expect([...ring]).not.toContain('#0e0c12')
  expect([...ring]).not.toContain('#1a1820')
})

test('the side line lights over just the rows a click on it opens the log from', async () => {
  const width = 100
  const g = hero()
  const line = hudHot(g, width).at(-1)!
  expect([line.y, line.h]).toEqual([INSET + SIDE_LINE_Y, 5])
  const x = INSET + SIDE_LINE_X + 2
  const tap = (py: number) => hudGesture(g, null, { type: 'release', from: { x, y: py / 2 }, at: { x, y: py / 2 }, button: 'left' }, width)
  expect([tap(line.y).isLog, tap(line.y + line.h - 1).isLog, tap(line.y - 1).isLog, tap(line.y + line.h).isLog]).toEqual([true, true, undefined, undefined])
})

test('the strip\'s text inks are the interface\'s: its numbers, its level line and its gold', async () => {
  // The strip is pixel art outside the colors gate; these three are copies of tokens, held to them here.
  expect([NUM_INK, LEVEL_INK, GOLD_INK]).toEqual([INK.text, INK.dim, INK.gold])
})
