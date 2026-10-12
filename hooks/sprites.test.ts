import { describe, expect, test } from 'claude-code/testing'

import type { Game } from '../types'
import { apply, newGame, normalize } from './game'
import { foeAhead } from './fixtures'
import { MAP_H, MAP_W } from './map'
import { mapRows } from './panels'
import { CANVAS, MEMORY_BG, WOOD_BG, contrast, mix, shade } from './palette'
import { SPRITES, STYLES, TILE_H, TILE_W, heroSprite, zoomedRows } from './sprites'
import type { Sprite } from './sprites'

const texts = (rows: ReturnType<typeof zoomedRows>) => rows.map(r => r.map(run => run.text).join(''))
const BESTIARY = ['r', 'g', 'k', 'o', 's', 'T', 'W', 'D']

describe('sprites', () => {
  const heroes = [newGame(), { ...newGame(), gear: {} }, { ...newGame(), gear: { helm: { id: 9, base: 'steelHelm', name: 'Steel Helm', rarity: 'common' as const, slot: 'helm' as const, w: 2, h: 2, atk: 0, def: 1, hp: 0, crit: 0, xp: 0, x: 0, y: 0 } } }]
  const all = (): [string, Sprite][] => [...BESTIARY.map(g => [g, SPRITES[g] as Sprite] as [string, Sprite]), ...heroes.map((h, i) => [`hero${i}`, heroSprite(h)] as [string, Sprite])]

  test('every sprite is one tile of printable ASCII, painted cell by cell with known styles', async () => {
    for (const [name, sprite] of all()) {
      expect(sprite.art.length).toBe(TILE_H)
      expect(sprite.paint.length).toBe(TILE_H)
      sprite.art.forEach((row, y) => {
        expect(row.length).toBe(TILE_W)
        expect(/^[\x20-\x7e]*$/.test(row)).toBe(true)
        const paint = sprite.paint[y] ?? ''
        expect(paint.length).toBe(TILE_W)
        for (const key of paint) if (key !== '.') expect(STYLES[key] !== undefined ? name : `${name}: no style ${key}`).toBe(name)
      })
    }
  })

  test('every monster wears its map letter, so the two zoom levels agree', async () => {
    for (const glyph of BESTIARY) expect(SPRITES[glyph]?.art.join('').includes(glyph)).toBe(true)
  })

  test('every stroke reaches 3:1 against what is behind it, on every ground', async () => {
    const grounds = [0, 0.25, 0.5, 0.75, 1].flatMap(l => [shade('floorBg', l), shade('passageBg', l), mix(WOOD_BG, '#000000', 1 - Math.max(0.35, l))])
    for (const [name, sprite] of all()) {
      sprite.art.forEach((row, y) => {
        ;[...row].forEach((ch, x) => {
          const style = STYLES[sprite.paint[y]?.[x] ?? '.']
          if (ch === ' ' || style?.fg === undefined) return
          const behind = style.bg !== undefined ? [style.bg] : grounds
          const worst = Math.min(...behind.map(bg => contrast(style.fg ?? '', bg)))
          expect(worst >= 3 ? 'ok' : `${name} '${ch}' at ${x},${y}: ${worst.toFixed(2)}`).toBe('ok')
        })
      })
    }
  })

  test('size shows threat: the rat keeps low, the troll fills the tile', async () => {
    const used = (s: Sprite | undefined) => (s?.art ?? []).join('').replace(/ /g, '').length
    expect(SPRITES.r?.art.slice(0, 2).join('').trim()).toBe('')
    expect(used(SPRITES.T)).toBeGreaterThan(used(SPRITES.g))
    expect(used(SPRITES.o)).toBeGreaterThan(used(SPRITES.g))
  })

  test('the wraith has no legs: its last row is a ragged hem', async () => {
    expect(SPRITES.W?.art[TILE_H - 1]).toMatch(/^[\^v ]+$/)
  })

  test('a tile is about square on screen: twice as wide as tall', async () => {
    expect(TILE_W).toBe(TILE_H * 2)
  })

  test('the hero has @ for a face and shows the sword only while a weapon is worn', async () => {
    const armed = newGame()
    const { weapon, ...bare } = armed.gear
    expect(heroSprite(armed).art.join('').includes('@')).toBe(true)
    expect(heroSprite(armed).art.join('').includes('+')).toBe(true)
    expect(heroSprite({ ...armed, gear: bare }).art.join('').includes('+')).toBe(false)
  })

  test('a worn helm turns the hood into a steel helm', async () => {
    expect(heroSprite(heroes[0] as Game).art[0]).toBe(' (@) |')
    expect(heroSprite(heroes[2] as Game).art[0]).toBe(' [@] |'.replace('|', ' '))
  })
})

describe('the zoomed map', () => {
  test('fills exactly the size asked for', async () => {
    for (const [cols, rows] of [[60, 20], [41, 13], [130, 40]] as const) {
      const out = texts(zoomedRows(newGame(), cols, rows))
      expect(out.length).toBe(rows)
      for (const row of out) expect(row.length).toBe(cols)
    }
  })

  test('draws the hero sprite once, whole, with its rows stacked in one column', async () => {
    const g = newGame(21)
    const out = texts(zoomedRows(g, 60, 21))
    const sprite = heroSprite(g).art
    const headRow = sprite.findIndex(r => r.includes('@'))
    const row = out.findIndex(r => r.includes('@'))
    expect(out.filter(r => r.includes('@')).length).toBe(1)
    const left = (out[row]?.indexOf('@') ?? -1) - (sprite[headRow]?.indexOf('@') ?? 0)
    sprite.forEach((line, i) => expect(out[row - headRow + i]?.slice(left, left + TILE_W)).toBe(line))
  })

  test('the hero is a knight three rows tall: head, tunic between two hands, the sword raised, two legs', async () => {
    expect(TILE_H).toBe(3)
    expect(heroSprite(newGame()).art).toEqual([' (@) |', 'd[#]-+', ' | |  '])
  })

  test('draws a foe in sight as its sprite', async () => {
    const g = newGame(21)
    const out = texts(zoomedRows({ ...g, foe: foeAhead(g, 1, { glyph: 'k' }) }, 60, 20)).join('\n')
    for (const row of SPRITES.k?.art ?? []) expect(out.includes(row)).toBe(true)
  })

  test('paints every tile block with no creature on it the same background its cell has on the 1x map', async () => {
    let g: Game = { ...newGame(21), seen: '1'.repeat(MAP_W * MAP_H) }
    g = apply(g, { kind: 'explore', steps: 4 })
    const small = mapRows(g, MAP_W, MAP_H)
    const big = zoomedRows(g, MAP_W * TILE_W, MAP_H * TILE_H)
    const bgAt = (rows: typeof small, x: number, y: number) => {
      let left = 0
      for (const run of rows[y] ?? []) {
        if (x < left + run.text.length) return run.bg
        left += run.text.length
      }
      return undefined
    }
    for (let y = 0; y < MAP_H; y += 1) {
      for (let x = 0; x < MAP_W; x += 1) {
        if (x === g.x && y === g.y) continue
        const want = bgAt(small, x, y)
        for (let dy = 0; dy < TILE_H; dy += 1) for (let dx = 0; dx < TILE_W; dx += 1) expect(bgAt(big, x * TILE_W + dx, y * TILE_H + dy)).toBe(want)
      }
    }
  })

  test('keeps the hero inside the window wherever it walks', async () => {
    let g = newGame(30)
    for (let i = 0; i < 25; i += 1) {
      g = apply(g, { kind: 'explore', steps: 2 })
      expect(texts(zoomedRows(g, 48, 12)).some(r => r.includes('@'))).toBe(true)
    }
  })
})

describe('zoom', () => {
  test('starts on pixel art, cycles pixel, overview, ASCII sprites, and old saves get the default', async () => {
    expect(newGame().zoom).toBe(3)
    const cycle = [1, 2, 3].reduce<{ g: Game; seen: number[] }>(acc => {
      const g = apply(acc.g, { kind: 'zoom' })
      return { g, seen: [...acc.seen, g.zoom] }
    }, { g: newGame(), seen: [] })
    expect(cycle.seen).toEqual([1, 2, 3])
    const { zoom, ...old } = newGame()
    expect(normalize(old as Game).zoom).toBe(3)
    // A view that no longer exists (4 was briefly a pixel view) opens on the pixel view, so the pane can label it.
    expect(normalize({ ...newGame(), zoom: 4 } as unknown as Game).zoom).toBe(3)
  })
})

test('wall bricks stagger on every screen row, across tile edges too', async () => {
  const g: Game = { ...newGame(21), seen: '1'.repeat(MAP_W * MAP_H) }
  const out = texts(zoomedRows(g, MAP_W * TILE_W, MAP_H * TILE_H))
  const wall = /^(___\|__|_\|____)$/
  for (let x = 0; x + TILE_W <= out[0]!.length; x += TILE_W) {
    for (let y = 0; y + 1 < out.length; y += 1) {
      const a = out[y]?.slice(x, x + TILE_W) ?? ''
      const b = out[y + 1]?.slice(x, x + TILE_W) ?? ''
      if (wall.test(a) && wall.test(b)) expect(a).not.toBe(b)
    }
  }
})

describe('saves from before pixel art', () => {
  test('a save from before views were versioned opens on pixel art, the new default', async () => {
    const { version, ...old } = newGame()
    expect(normalize({ ...old, zoom: 2 } as Game).zoom).toBe(3)
  })

  test('a view picked under the current save version is kept', async () => {
    expect(normalize({ ...newGame(), zoom: 2 }).zoom).toBe(2)
    expect(normalize({ ...newGame(), zoom: 1 }).zoom).toBe(1)
  })

  test('a migrated save is stamped with the current version', async () => {
    const { version, ...old } = newGame()
    expect(normalize({ ...old, zoom: 2 } as Game).version).toBe(newGame().version)
  })
})
