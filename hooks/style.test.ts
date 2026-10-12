import { describe, expect, test } from 'claude-code/testing'

import type { Game } from '../types'
import { apply, newGame, threat } from './game'
import { foeAhead, plainHero } from './fixtures'
import { GLYPH } from './items'
import { MAP_H, MAP_W, generate, roomAt } from './map'
import { CANVAS, INK, MEMORY_BG, MEMORY_FG, WOOD_BG, contrast, light, mix, shade } from './palette'
import { BAR_FILL, barFill, foeRuns, hpBar, logRuns, mapRows, surfaceOf } from './panels'

const at = (g: Game, x: number, y: number) => {
  let left = 0
  for (const run of mapRows(g, 64, 18)[y] ?? []) {
    if (x < left + run.text.length) return { ...run, text: run.text[x - left] }
    left += run.text.length
  }
  return undefined
}
const known = (seed: number, x = 0, y = 0): Game => ({ ...newGame(seed), seen: '1'.repeat(64 * 18), x, y })
const LEVELS = [0, 0.25, 0.5, 0.75, 1]

describe('what each cell is built of', () => {
  const level = generate(21, 1)
  test('rock touching a room is wall, rock away from rooms is void', async () => {
    const room = roomAt(level, level.start)
    expect(room).toBeDefined()
    if (room === undefined) return
    expect(surfaceOf(level, { x: room.x, y: room.y - 1 })).toBe('wall')
    expect(surfaceOf(level, { x: room.x - 1, y: room.y - 1 })).toBe('wall')
    expect(surfaceOf(level, { x: 0, y: 0 })).toBe('void')
  })

  test('a corridor running straight into a room is a door; one skirting a wall is passage', async () => {
    // A room of 3 by 3, a corridor leaving it to the right, and one running along below it.
    const tiles = ['##########', '#...######', '#.......##', '#...######', '#.....####', '##########']
    const built = { tiles, rooms: [{ x: 1, y: 1, w: 3, h: 3 }], start: { x: 2, y: 2 }, stairs: { x: 7, y: 2 } }
    expect(surfaceOf(built, { x: 4, y: 2 })).toBe('door')
    expect(surfaceOf(built, { x: 6, y: 2 })).toBe('passage')
    expect(surfaceOf(built, { x: 2, y: 4 })).toBe('passage')
  })
})

describe('torchlight', () => {
  test('is full on the hero, gone past its radius, and never grows with distance', async () => {
    expect(light(0, 0)).toBe(1)
    expect(light(20, 0)).toBe(0)
    for (let d = 0; d < 12; d += 1) expect(light(d + 1, 0)).toBeLessThanOrEqual(light(d, 0))
  })

  test('counts a row as two columns, since a cell is twice as tall as wide', async () => {
    expect(light(0, 2)).toBe(light(4, 0))
  })

  test('floor near the hero is painted brighter than floor across the room', async () => {
    const g = newGame(21)
    const room = roomAt(generate(21, 1), g)
    if (room === undefined) throw new Error('the start lies in a room')
    const near = at(g, g.x + 1, g.y)?.bg ?? CANVAS
    const far = at(g, room.x, g.y)?.bg ?? CANVAS
    expect(contrast(near, CANVAS)).toBeGreaterThan(contrast(far, CANVAS))
  })
})

describe('legibility on the dark canvas', () => {
  const grounds = [
    ...LEVELS.flatMap(l => [shade('floorBg', l), shade('passageBg', l)]),
    ...LEVELS.map(l => mix(WOOD_BG, '#000000', 1 - Math.max(0.35, l))),
  ]
  test('the hero stands out at 7:1 or more on every ground it can stand on', async () => {
    for (const bg of [...grounds, MEMORY_BG]) expect(contrast(INK.hero, bg)).toBeGreaterThanOrEqual(7)
  })
  test('foes, gold, potions, traps and stairs reach 4.5:1 on every lit ground', async () => {
    for (const bg of grounds) {
      for (const ink of [INK.foe, INK.gold, INK.potion, INK.trap, INK.stairs]) expect(contrast(ink, bg)).toBeGreaterThanOrEqual(4.5)
    }
  })
  test('a sensed foe reaches 4.5:1 on remembered ground and on the void', async () => {
    expect(contrast(INK.sensed, MEMORY_BG)).toBeGreaterThanOrEqual(4.5)
    expect(contrast(INK.sensed, CANVAS)).toBeGreaterThanOrEqual(4.5)
  })
  test('remembered ground is quieter than lit ground but still readable', async () => {
    expect(contrast(MEMORY_FG, MEMORY_BG)).toBeGreaterThanOrEqual(1.5)
    expect(contrast(MEMORY_FG, MEMORY_BG)).toBeLessThan(contrast(shade('floorFg', 1), shade('floorBg', 1)))
  })
})

describe('drawing the map', () => {
  test('the hero and the foe are one character each, bold, in their own ink', async () => {
    const g = newGame(21)
    expect(at(g, g.x, g.y)).toMatchObject({ text: '@', color: INK.hero, bold: true })
    const near = foeAhead(g, 1)
    expect(at({ ...g, foe: near }, near.x, near.y)).toMatchObject({ text: 'g', color: INK.foe, bold: true })
  })

  test('a foe out of sight is sensed: its own ink, not bold', async () => {
    const g = newGame(21)
    const far = foeAhead(g, 30)
    const cell = at({ ...g, foe: far }, far.x, far.y)
    expect(cell).toMatchObject({ text: 'g', color: INK.sensed })
    expect(cell?.bold).toBeUndefined()
  })

  test('unseen cells are the bare canvas', async () => {
    const g = newGame(12)
    for (let y = 0; y < 18; y += 1) {
      for (let x = 0; x < 64; x += 1) if (g.seen[y * 64 + x] === '0' && !(x === g.x && y === g.y)) expect(at(g, x, y)).toEqual({ text: ' ', bg: CANVAS })
    }
  })

  test('cells seen before but out of sight now are painted in memory colors', async () => {
    const level = generate(21, 1)
    const g = known(21, level.start.x, level.start.y)
    // Another room's middle is out of sight from the start; a cell beside the hero in his own room is in sight.
    const home = roomAt(level, level.start)
    const other = level.rooms.find(r => r !== home)!
    expect(at(g, other.x + Math.floor(other.w / 2), other.y + Math.floor(other.h / 2))?.bg).toBe(MEMORY_BG)
    const beside = level.tiles[level.start.y]![level.start.x + 1] === '.' ? level.start.x + 1 : level.start.x - 1
    expect(at(g, beside, level.start.y)?.bg).not.toBe(MEMORY_BG)
  })

  test('items in the bag use the class punctuation', async () => {
    expect(GLYPH).toEqual({ weapon: ')', offhand: '(', helm: '[', armor: '[', boots: '_', amulet: '"', ring: '=' })
  })
})

describe('the HP bar', () => {
  const bar = (hp: number) => hpBar({ ...newGame(), hp, maxHp: 20 })
  const textOf = (hp: number) => bar(hp).map(r => r.text).join('')
  const filled = (hp: number) => bar(hp).filter(r => r.bg !== undefined && r.bg === barFill(hp / 20)).reduce((n, r) => n + r.text.length, 0)

  test('is 20 cells between brackets with its label inside', async () => {
    expect(textOf(20)).toBe('[      HP 20/20      ]')
    expect(textOf(7)).toBe('[      HP  7/20      ]')
  })

  test('paints a share of its cells in proportion to HP', async () => {
    expect(filled(20)).toBe(20)
    expect(filled(10)).toBe(10)
    expect(filled(0)).toBe(0)
  })

  test('is healthy above 70%, hurt at 70% and below, critical at 40% and below', async () => {
    expect(barFill(15 / 20)).toBe(BAR_FILL.healthy)
    expect(barFill(14 / 20)).toBe(BAR_FILL.hurt)
    expect(barFill(9 / 20)).toBe(BAR_FILL.hurt)
    expect(barFill(8 / 20)).toBe(BAR_FILL.critical)
  })

  test('its label stays readable on every fill', async () => {
    for (const fill of Object.values(BAR_FILL)) expect(contrast('#ffffff', fill)).toBeGreaterThanOrEqual(4.5)
  })
})

describe('threat', () => {
  test('rates a foe by how many hits it needs to drop the hero', async () => {
    const g = plainHero()
    expect(threat({ ...g, foe: foeAhead(g, 1, { atk: 7 }) })).toBe('deadly')
    expect(threat({ ...g, foe: foeAhead(g, 1, { atk: 4 }) })).toBe('tough')
    expect(threat({ ...g, foe: foeAhead(g, 1, { atk: 1 }) })).toBe('easy')
  })

  test('the foe line says its threat in words, not only in color', async () => {
    const g = plainHero()
    const text = foeRuns({ ...g, foe: foeAhead(g, 1, { atk: 7 }) }).map(r => r.text).join('')
    expect(text).toBe('g goblin of x (deadly)  [##########] 5/5')
  })
})

describe('the message log', () => {
  test('a repeated message is counted instead of repeated', async () => {
    let g = newGame()
    for (let i = 0; i < 3; i += 1) g = apply(g, { kind: 'attack' })
    expect(g.log.at(-1)).toBe('You swing at the darkness. (x3)')
    expect(g.log.filter(line => line.startsWith('You swing')).length).toBe(1)
  })

  test('older lines are drawn faded, the latest action\'s at full strength', async () => {
    const g = apply(apply(newGame(), { kind: 'potion' }), { kind: 'attack' })
    const runs = logRuns(g)
    expect(g.fresh).toBeGreaterThan(0)
    expect(runs.map(r => r.dim)).toEqual([...Array(runs.length - g.fresh).fill(true), ...Array(g.fresh).fill(undefined)])
  })

  test('only the lines of the latest action are fresh', async () => {
    const g = apply(apply(newGame(), { kind: 'potion' }), { kind: 'summon', name: 'a.ts' })
    expect(g.fresh).toBe(1)
    expect(apply(g, { kind: 'panel', panel: 'bag' }).fresh).toBe(0)
  })
})

describe('doors', () => {
  test('never stand side by side: of two rooms two cells apart, one door and a passage join them', async () => {
    let pairs = 0
    let joined = 0
    for (let world = 1; world <= 20; world += 1) for (let depth = 1; depth <= 10; depth += 1) {
      const level = generate(world, depth)
      for (let y = 0; y < MAP_H; y += 1) for (let x = 0; x < MAP_W; x += 1) {
        const here = surfaceOf(level, { x, y })
        for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
          const next = surfaceOf(level, { x: x + dx, y: y + dy })
          if (here === 'door' && next === 'door') pairs += 1
          // The short corridors that made the pairs still show their door, a passage behind it.
          if (here === 'door' && next === 'passage' && roomAt(level, { x: x - dx, y: y - dy }) !== undefined && roomAt(level, { x: x + 2 * dx, y: y + 2 * dy }) !== undefined) joined += 1
        }
      }
    }
    expect(pairs).toBe(0)
    expect(joined).toBeGreaterThan(20)
  })
})
