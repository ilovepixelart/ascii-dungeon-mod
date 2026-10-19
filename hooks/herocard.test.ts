import { describe, expect, test } from 'claude-code/testing'

import type { Game } from '../types'
import { CARD_W, cardHead, cardPixels, cardText, svgOf } from './herocard'
import { plainHero } from './fixtures'
import { plainItem } from './items'
import { CARD_KEY, codexCardRect, codexGesture, codexHeight, codexPixels } from './codexwindow'
import { MAP_H } from './map'
import { PX } from './pixelart'
import { missingGlyphs } from './pixelart'
import { WINDOW_W } from './window'

/** A hero with a record worth a card: deep in tier VI, a codex with some found, two talents, three pieces worn. */
const hero = (over: Partial<Game> = {}): Game => {
  const g = plainHero(3)
  return {
    ...g,
    level: 88,
    deepest: 105,
    marks: { 6: 'lean' },
    talents: ['grudge', 'haggler'],
    gear: { ...g.gear, armor: { ...plainItem(g, 'plate', 'epic'), name: 'Oathbound Plate' }, ring: { ...plainItem(g, 'ring', 'rare'), name: 'Sharp Band' } },
    codex: { uniques: ['rot', 'bones'], bigs: ['king'], legendaries: ['Band of the Endless Loop'], deepest: 105, level: 88, kills: 4210, bosses: 19, deaths: 30, gold: 54702, retired: 2 },
    ...over,
  }
}

describe('the card as text', () => {
  test('who, how deep and in which tier, the records, the codex counts, what is worn and the talents', async () => {
    expect(cardText(hero()).split('\n')).toEqual([
      'ASCII Dungeon: Level 88 Knight, deepest depth 105 (tier VI, Lean)',
      'Kills 4210, deaths 30, gold found 54,702, heroes retired 2',
      'Uniques 2 of 5, big bosses 1 of 5, Legendaries 1 of 7',
      `Wearing: ${plainHero(3).gear.weapon!.name} (Common), Oathbound Plate (Epic), Sharp Band (Rare)`,
      'Talents: Grudge, Haggler',
    ])
  })

  test('above the tiers, no tier; none retired, none said; no talents, none yet', async () => {
    const lines = cardText(hero({ deepest: 30, talents: [], codex: { ...hero().codex!, retired: 0 } })).split('\n')
    expect(lines[0]).toBe('ASCII Dungeon: Level 88 Knight, deepest depth 30')
    expect(lines[1]).toBe('Kills 4210, deaths 30, gold found 54,702')
    expect(lines[4]).toBe('Talents: none yet')
  })
})

describe('the card as a picture', () => {
  test('beside the portrait: level and class, the deepest depth and its tier, kills and deaths, the heroes retired', async () => {
    expect(cardHead(hero()).map(l => l.text)).toEqual(['LEVEL 88 KNIGHT', 'DEEPEST 105  TIER VI', 'KILLS 4210  DEATHS 30', '2 HEROES RETIRED'])
  })

  test('above the tiers, no tier; one retired, one hero; none, no line', async () => {
    const one = cardHead(hero({ deepest: 50, codex: { ...hero().codex!, retired: 1 } })).map(l => l.text)
    expect([one[1], one[3]]).toEqual(['DEEPEST 50', '1 HERO RETIRED'])
    expect(cardHead(hero({ codex: { ...hero().codex!, retired: 0 } })).length).toBe(3)
  })

  test('its width, and one pixel row a line; every letter one the font has', async () => {
    missingGlyphs.clear()
    const px = cardPixels(hero())
    expect(px.every(row => row.length === CARD_W)).toBe(true)
    expect([...missingGlyphs]).toEqual([])
  })

  test('a line more for each three talents past the first three', async () => {
    const three = cardPixels(hero({ talents: ['grudge', 'haggler', 'opener'] })).length
    expect(cardPixels(hero({ talents: ['grudge', 'haggler', 'opener', 'scavenger'] })).length).toBe(three + 8)
    expect(cardPixels(hero({ talents: [] })).length).toBe(three)
  })
})

describe('as an SVG', () => {
  test('a rectangle a run of one color along a row, each pixel scaled', async () => {
    const svg = svgOf([['#000000', '#000000', '#ffffff'], ['#ff0000', '#ff0000', '#ff0000']], 4)
    expect(svg).toContain('width="12" height="8" viewBox="0 0 3 2"')
    expect(svg.match(/<rect /g)?.length).toBe(3)
    expect(svg).toContain('<rect x="0" y="0" width="2" height="1" fill="#000000"/>')
    expect(svg).toContain('<rect x="2" y="0" width="1" height="1" fill="#ffffff"/>')
    expect(svg).toContain('<rect x="0" y="1" width="3" height="1" fill="#ff0000"/>')
  })

  test('the runs cover every pixel of the card exactly once', async () => {
    const px = cardPixels(hero())
    const runs = [...svgOf(px).matchAll(/<rect x="(\d+)" y="(\d+)" width="(\d+)" height="1" fill="(#[0-9a-f]{6})"\/>/g)]
    const covered = runs.reduce((n, r) => n + Number(r[3]), 0)
    expect(covered).toBe(px.length * CARD_W)
    for (const r of runs.slice(0, 200)) expect(px[Number(r[2])]![Number(r[1])]).toBe(r[4])
  })
})

describe('Card in the codex', () => {
  const g = { ...hero(), panel: 'codex' as const }
  const tap = (x: number, y: number) => codexGesture(g, { type: 'release', from: { x: x + 0.5, y: y / 2 + 0.25 }, at: { x: x + 0.5, y: y / 2 + 0.25 }, button: 'left' })

  test('a click on it asks for the card, and only that', async () => {
    const r = codexCardRect(g)
    expect(tap(r.x + 2, r.y + 4)).toEqual({ actions: [], isCard: true })
    expect(tap(r.x - 4, r.y + 4).isCard).toBe(false)
  })

  test('it sits inside the window, which still fits over the map', async () => {
    const r = codexCardRect(g)
    expect([r.x + r.w <= WINDOW_W, r.y + r.h <= codexHeight(g)]).toEqual([true, true])
    expect(codexHeight(g)).toBeLessThanOrEqual(MAP_H * PX)
    expect(CARD_KEY).toEqual({ key: 'K', label: 'CARD' })
    // The button's gold key letter is drawn where the button is.
    expect(codexPixels(g).slice(r.y, r.y + r.h).some(row => row.slice(r.x, r.x + r.w).includes('#ffd34d'))).toBe(true)
  })
})
