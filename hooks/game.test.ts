import { describe, expect, test } from 'claude-code/testing'

import type { Game } from '../types'
import { SAVE_VERSION, SHOP_PRICES, isBossDepth, alongTheWay, foeTierWeights, apply, isOnlyAWalk, championOf, classAbout, critChance, xpGain, levelOf, newGame, normalize, onToolStart, reforgeCost, routeToStairs } from './game'
import { foeAhead, plainHero } from './fixtures'
import { countOf } from './consumables'
import { plainItem } from './items'
import { arrive } from './world'
import { analyze, bfs, cellId, chestAt, floorThing, generate, layoutOf, same, themedRoomOf } from './map'
import { foeRuns, mapRows, statusRuns, tileAt } from './panels'
import { TOWN_ARRIVAL, TOWN_DECOR, TOWN_H, TOWN_SPOTS, TOWN_W, isTownWalkable, pathBeside } from './town'

const text = (rows: ReturnType<typeof mapRows>) => rows.map(r => r.map(run => run.text).join(''))
const stepsLeft = (g: Game) => (routeToStairs(g)?.length ?? 0) - 1

describe('tool calls map to dungeon actions', () => {
  test('reading explores three cells', async () => {
    expect(onToolStart('Read', '/a/b.ts')).toEqual({ kind: 'explore', steps: 3 })
  })
  test('an edit summons a foe named after the file', async () => {
    expect(onToolStart('Edit', '/src/utils.ts')).toEqual({ kind: 'summon', name: 'utils.ts' })
  })
  test('a shell command summons a foe named after its program', async () => {
    expect(onToolStart('Bash', '  npm test')).toEqual({ kind: 'summon', name: 'npm' })
  })
  test('a subagent is an ally', async () => {
    expect(onToolStart('Agent', undefined)).toEqual({ kind: 'ally' })
  })
})

describe('moving through the map', () => {
  test('a new game starts on its level start with the starting room seen', async () => {
    const g = newGame(9)
    expect(same(g, generate(9, 1).start)).toBe(true)
    expect(g.seen[cellId(g)]).toBe('1')
  })

  test('exploring takes the hero exactly that many cells closer to the stairs', async () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const g = newGame(seed)
      const before = stepsLeft(g)
      const after = apply(g, { kind: 'explore', steps: 3 })
      if (after.deaths === 0) expect(stepsLeft(after)).toBe(Math.max(0, before - 3))
    }
  })

  test('on the stairs, exploring says so and stays', async () => {
    const g = newGame(4)
    const { stairs } = levelOf(g)
    const after = apply({ ...g, ...stairs }, { kind: 'walk' })
    expect(same(after, stairs)).toBe(true)
    expect(after.log.at(-1)).toBe('You stand on the stairs. Finish the task to descend.')
  })

  test('walking into rock is refused and keeps the hero in place', async () => {
    let g = newGame(3)
    for (let i = 0; i < 40 && g.log.at(-1) !== 'Solid rock.'; i += 1) g = apply(g, { kind: 'move', dx: 0, dy: -1 })
    const before = { x: g.x, y: g.y }
    expect(g.log.at(-1)).toBe('Solid rock.')
    expect(same(apply(g, { kind: 'move', dx: 0, dy: -1 }), before)).toBe(true)
  })

  test('walking into a foe attacks it instead of moving', async () => {
    const g = newGame(2)
    const foe = foeAhead(g, 1, { hp: 99, maxHp: 99 })
    const after = apply({ ...g, foe }, { kind: 'move', dx: foe.x - g.x, dy: foe.y - g.y })
    expect(same(after, g)).toBe(true)
    expect(after.foe?.hp).toBeLessThan(99)
  })

  test('apply leaves the input game untouched', async () => {
    const g = newGame(7)
    const copy = JSON.parse(JSON.stringify(g)) as Game
    apply(g, { kind: 'summon', name: 'x.ts' })
    apply(g, { kind: 'explore', steps: 5 })
    expect(g).toEqual(copy)
  })
})

describe('combat', () => {
  test('a summoned foe stands three cells along the way to the stairs, inside the view', async () => {
    const g = plainHero(11)
    const after = apply(g, { kind: 'summon', name: 'utils.ts' })
    const route = routeToStairs(g) ?? []
    expect(after.foe).not.toBeNull()
    if (after.foe !== null) expect(same(after.foe, route[Math.min(3, route.length - 1)] ?? g)).toBe(true)
    expect(after.foe?.name).toMatch(/ of utils\.ts$/)
  })

  test('a failed tool call lets the foe hit for its attack', async () => {
    const g = plainHero()
    // The knight's shield already spent on the fight's first blow.
    expect(apply({ ...g, foe: foeAhead(g, 1, { opened: true }) }, { kind: 'outcome', ok: false, what: 'Bash' }).hp).toBe(17)
  })

  test('a failure with no foe is an imp hitting for the depth', async () => {
    const after = apply({ ...plainHero(), depth: 3 }, { kind: 'outcome', ok: false, what: 'Bash' })
    expect(after.hp).toBe(17)
    expect(after.log.at(-1)).toBe('The Bash imp strikes you for 3.')
  })

  test('a success charges up to the foe and slays a weak one', async () => {
    const g = plainHero(6)
    const route = routeToStairs(g) ?? []
    const after = apply({ ...g, foe: foeAhead(g, 3, { hp: 1, maxHp: 1 }) }, { kind: 'outcome', ok: true, what: 'Edit' })
    expect(after.foe).toBeNull()
    expect(after.xp).toBe(10)
    expect(same(after, route[2] ?? g)).toBe(true)
  })

  test('crossing the XP threshold levels up and restores HP', async () => {
    const g = plainHero()
    const after = apply({ ...g, hp: 4, xp: 15, foe: foeAhead(g, 1, { hp: 1 }) }, { kind: 'outcome', ok: true, what: 'Edit' })
    expect(after.level).toBe(2)
    expect(after.xp).toBe(5)
    expect(after.maxHp).toBe(25)
    expect(after.hp).toBe(25)
    expect(after.toast).toBe('Level up! You are now level 2.')
  })

  test('dying sends the hero to the start of the theme\'s first depth: depth 14 to 11, depth 6 to 6, depth 5 to 1', async () => {
    const at = (depth: number) => {
      const g = { ...plainHero(5), depth, deepest: depth, hp: 2 }
      return apply({ ...g, foe: foeAhead(g, 1, { glyph: 'r', opened: true, atk: 99 }) }, { kind: 'outcome', ok: false, what: 'Bash' })
    }
    expect([at(14).depth, at(11).depth, at(6).depth, at(5).depth, at(2).depth]).toEqual([11, 11, 6, 1, 1])
    expect(same(at(14), generate(5, 11).start)).toBe(true)
  })

  test('dying on the first theme sends the hero to the start of depth 1 with half the gold', async () => {
    const g = { ...plainHero(5), depth: 4, hp: 2, gold: 31 }
    // A rat: no goblin's hand in the purse before the blow.
    const after = apply({ ...g, foe: foeAhead(g, 1, { glyph: 'r', opened: true }) }, { kind: 'outcome', ok: false, what: 'Bash' })
    expect(after.depth).toBe(1)
    expect(same(after, generate(5, 1).start)).toBe(true)
    expect(after.deaths).toBe(1)
    expect(after.gold).toBe(15)
    expect(after.hp).toBe(after.maxHp)
    expect(after.foe).toBeNull()
  })

  test('a Health Potion heals 35% of max HP, rounded up, capped at max', async () => {
    expect(apply({ ...plainHero(), hp: 5 }, { kind: 'potion' }).hp).toBe(12)
    const capped = apply({ ...plainHero(), hp: 18 }, { kind: 'potion' })
    expect(capped.hp).toBe(20)
    expect(capped.belt[0]).toBeNull()
  })

  test('the same seed plays the same game', async () => {
    const play = () =>
      [
        { kind: 'summon', name: 'a' },
        { kind: 'attack' },
        { kind: 'explore', steps: 9 },
        { kind: 'attack' },
      ].reduce((g, a) => apply(g, a as never), plainHero(42))
    expect(play()).toEqual(play())
  })
})

describe('descending', () => {
  test('finishing a turn with no foe goes to the next level start and heals a quarter', async () => {
    const after = apply({ ...plainHero(8), hp: 10 }, { kind: 'descend' })
    expect(after.depth).toBe(2)
    expect(same(after, generate(8, 2).start)).toBe(true)
    expect(after.taken).toEqual([])
    expect(after.hp).toBe(15)
    expect(after.deepest).toBe(2)
  })

  test('a living foe guards the stairs', async () => {
    const g = plainHero()
    expect(apply({ ...g, foe: foeAhead(g) }, { kind: 'descend' }).depth).toBe(1)
  })

  test('a save from the side-scrolling version lands on its level start with no foe', async () => {
    const { world, y, seen, taken, ...old } = plainHero(3)
    const legacy = { ...old, x: 40, depth: 2, foe: { glyph: 'g', name: 'g', hp: 1, maxHp: 1, atk: 1, xp: 1, at: 46 } }
    const g = normalize(legacy as unknown as Game)
    expect(g.depth).toBe(2)
    expect(same(g, generate(g.world, 2).start)).toBe(true)
    expect(g.foe).toBeNull()
  })
})

describe('the map drawing', () => {
  test('every row is exactly as wide as asked and the hero is drawn once', async () => {
    for (const cols of [20, 41, 64]) {
      const rows = text(mapRows(newGame(), cols, 12))
      expect(rows.length).toBe(12)
      for (const row of rows) expect(row.length).toBe(cols)
      expect(rows.join('').split('@').length - 1).toBe(1)
    }
  })

  test('unseen cells are blank and the drawing is ASCII only', async () => {
    const g = newGame(12)
    const rows = text(mapRows(g, 64, 18))
    rows.forEach((row, y) => {
      expect(/^[\x20-\x7e]*$/.test(row)).toBe(true)
      for (let x = 0; x < row.length; x += 1) if (g.seen[y * 64 + x] !== '1') expect(row[x]).toBe(' ')
    })
  })

})

test('the foe being fought is drawn even where the hero cannot see', async () => {
  const g = newGame(21)
  const foe = foeAhead(g, 30, { glyph: 'k' })
  const rows = text(mapRows({ ...g, foe }, 64, 18))
  expect(g.seen[cellId(foe)]).toBe('0')
  expect(rows[foe.y]?.[foe.x]).toBe('k')
})

describe('classes', () => {
  const wears = (g: Game) => Object.values(g.gear).map(i => i?.base).sort()

  test('a Knight starts with 30 HP: 20, +3 from 1 Vigor, +4 Tunic, +3 Hood', async () => {
    const g = newGame(1, 'knight')
    expect(g.maxHp).toBe(30)
    expect(g.hp).toBe(30)
    expect(wears(g)).toEqual(['buckler', 'hood', 'sword', 'tunic'])
    expect(g.stats).toEqual({ might: 3, focus: 1, vigor: 2, insight: 0 })
  })

  test('a Mage starts with 25 HP and a staff, tome, robe and hat', async () => {
    const g = newGame(1, 'mage')
    expect(g.maxHp).toBe(25)
    expect(wears(g)).toEqual(['hat', 'robe', 'staff', 'tome'])
    expect(g.stats).toEqual({ might: 1, focus: 2, vigor: 1, insight: 3 })
  })

  test('a Rogue starts with 23 HP and a dagger, parrying dagger, leather coat and cowl', async () => {
    const g = newGame(1, 'rogue')
    // 20, and 3 for the point of Vigor it leans to.
    expect(g.maxHp).toBe(23)
    expect(wears(g)).toEqual(['cowl', 'dagger', 'leather', 'parry'])
    expect(g.stats).toEqual({ might: 2, focus: 4, vigor: 2, insight: 0 })
  })

  test('restarting can pick another class and otherwise keeps the current one', async () => {
    expect(apply(newGame(1, 'rogue'), { kind: 'restart' }).cls).toBe('rogue')
    expect(apply(newGame(1, 'rogue'), { kind: 'restart', cls: 'mage' }).cls).toBe('mage')
  })

  test("a class cannot equip another class's item", async () => {
    const g = newGame(1, 'mage')
    const sword = { ...g.gear.weapon!, id: 77, base: 'sword', name: 'Short Sword', cls: 'knight' as const }
    const after = apply({ ...g, bag: [sword], cursor: 77 }, { kind: 'equip' })
    expect(after.gear.weapon?.base).toBe('staff')
    expect(after.log.at(-1)).toBe('The Short Sword is Knight only.')
  })
})

describe('a living foe blocks the way', () => {
  const nextTo = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) <= 1

  test('exploring never carries the hero past a living foe toward the stairs', async () => {
    for (let seed = 1; seed <= 120; seed += 1) {
      let g = apply(newGame(seed), { kind: 'summon', name: 'x' })
      if (g.foe === null) continue
      const foeLeft = routeToStairs({ ...g, x: g.foe.x, y: g.foe.y, foe: null })?.length ?? 0
      for (let i = 0; i < 6; i += 1) g = apply(g, { kind: 'explore', steps: 3 })
      if (g.foe === null || g.deaths > 0) continue
      const heroLeft = routeToStairs({ ...g, foe: null })?.length ?? 0
      expect(heroLeft >= foeLeft ? 'ok' : `seed ${seed}: hero ${heroLeft} steps from the stairs, foe ${foeLeft}`).toBe('ok')
    }
  })

  test('next to a living foe, exploring stops and says the foe blocks the way', async () => {
    const g = newGame(2)
    const foe = foeAhead(g, 1, { hp: 99, maxHp: 99 })
    const after = apply({ ...g, foe }, { kind: 'explore', steps: 3 })
    expect(nextTo(after, foe)).toBe(true)
    expect(same(after, g)).toBe(true)
    expect(after.log.at(-1)).toBe('The goblin of x blocks your way.')
  })

  test('the hero still walks up to a foe further along, and stops beside it', async () => {
    const g = newGame(2)
    const foe = foeAhead(g, 4, { hp: 99, maxHp: 99 })
    const after = apply({ ...g, foe }, { kind: 'explore', steps: 9 })
    expect(nextTo(after, foe)).toBe(true)
    expect(same(after, foe)).toBe(false)
  })

  test('a foe beside the route, not on it, still stops the hero as he passes', async () => {
    let checked = 0
    for (let seed = 1; seed <= 80 && checked < 10; seed += 1) {
      const g = newGame(seed)
      const level = levelOf(g)
      const route = routeToStairs(g) ?? []
      const onRoute = new Set(route.map(p => `${p.x},${p.y}`))
      const at = route.slice(2, 8).findIndex(p => [[0, 1], [0, -1], [1, 0], [-1, 0]].some(([dx, dy]) => {
        const side = { x: p.x + dx!, y: p.y + dy! }
        return level.tiles[side.y]?.[side.x] === '.' && !onRoute.has(`${side.x},${side.y}`)
      }))
      if (at < 0) continue
      const p = route[at + 2]!
      const side = [[0, 1], [0, -1], [1, 0], [-1, 0]].map(([dx, dy]) => ({ x: p.x + dx!, y: p.y + dy! })).find(c => level.tiles[c.y]?.[c.x] === '.' && !onRoute.has(`${c.x},${c.y}`))!
      const foe = { ...foeAhead(g, 1, { hp: 99, maxHp: 99 }), ...side }
      const after = apply({ ...g, foe }, { kind: 'explore', steps: 20 })
      expect(nextTo(after, foe) ? 'stopped' : `seed ${seed}: walked on to ${after.x},${after.y}`).toBe('stopped')
      checked += 1
    }
    expect(checked).toBeGreaterThan(3)
  })

  test('moving by hand is not blocked, and moving into the foe attacks it', async () => {
    const g = newGame(2)
    const foe = foeAhead(g, 1, { hp: 99, maxHp: 99 })
    const back = apply({ ...g, foe }, { kind: 'move', dx: g.x - foe.x, dy: g.y - foe.y })
    expect(same(back, g)).toBe(false)
  })
})

describe('the hero and a living foe never share a cell', () => {
  const nearStairs = (seed: number) => {
    const g = newGame(seed)
    const route = routeToStairs(g) ?? []
    const near = route[Math.max(0, route.length - 3)] ?? g
    return { ...g, x: near.x, y: near.y }
  }

  test('a foe never appears on the stairs or on the hero', async () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      const g = apply(nearStairs(seed), { kind: 'summon', name: 'x' })
      if (g.foe === null) continue
      expect(same(g.foe, levelOf(g).stairs)).toBe(false)
      expect(same(g.foe, g)).toBe(false)
    }
  })

  test('a foe standing on the stairs blocks them: exploring never walks onto it', async () => {
    const g = nearStairs(9)
    const foe = { ...foeAhead(g, 1), ...levelOf(g).stairs }
    let after: Game = { ...g, foe }
    for (let i = 0; i < 3; i += 1) after = apply(after, { kind: 'explore', steps: 3 })
    expect(same(after, foe)).toBe(false)
  })

  test('over random play the hero never stands on a living foe', async () => {
    const moves = [
      { kind: 'explore', steps: 3 },
      { kind: 'summon', name: 'x' },
      { kind: 'outcome', ok: true, what: 'Edit' },
      { kind: 'outcome', ok: false, what: 'Bash' },
      { kind: 'move', dx: 1, dy: 0 },
      { kind: 'move', dx: -1, dy: 0 },
      { kind: 'move', dx: 0, dy: 1 },
      { kind: 'move', dx: 0, dy: -1 },
      { kind: 'walk' },
    ] as const
    for (let seed = 1; seed <= 40; seed += 1) {
      let g = newGame(seed)
      for (let i = 0; i < 80; i += 1) {
        g = apply(g, moves[(seed * 7 + i * 13) % moves.length]!)
        if (g.foe !== null) expect(same(g, g.foe) ? `seed ${seed} step ${i}` : 'apart').toBe('apart')
      }
    }
  })
})

describe('fights are exchanges', () => {
  test('a successful tool call hits the foe, and a foe that survives hits back', async () => {
    const g = plainHero()
    const foe = foeAhead(g, 1, { hp: 999, maxHp: 999, atk: 3, opened: true })
    const after = apply({ ...g, foe }, { kind: 'outcome', ok: true, what: 'Edit' })
    expect(after.foe?.hp).toBeLessThan(999)
    expect(after.hp).toBe(17)
  })

  test('a foe slain by the hit does not hit back', async () => {
    const g = plainHero()
    const after = apply({ ...g, foe: foeAhead(g, 1, { hp: 1, maxHp: 1, atk: 3 }) }, { kind: 'outcome', ok: true, what: 'Edit' })
    expect(after.foe).toBeNull()
    expect(after.hp).toBe(20)
  })

  test('with no foe about, a successful call costs nothing', async () => {
    expect(apply(plainHero(), { kind: 'outcome', ok: true, what: 'Read' }).hp).toBe(20)
  })
})

describe('going where the player clicks', () => {
  const room = (seed: number) => {
    const g = newGame(seed)
    const level = levelOf(g)
    const r = level.rooms.find(rm => g.x >= rm.x && g.x < rm.x + rm.w && g.y >= rm.y && g.y < rm.y + rm.h)!
    return { g, level, r }
  }

  test('a seen floor tile: the hero walks there along the shortest path', async () => {
    const { g, r } = room(5)
    const target = { x: r.x, y: r.y }
    const after = apply(g, { kind: 'goto', x: target.x, y: target.y })
    expect(same(after, target)).toBe(true)
  })

  test('an unseen tile or rock: nothing happens, and the hero says so', async () => {
    const g = newGame(5)
    const after = apply(g, { kind: 'goto', x: 0, y: 0 })
    expect(same(after, g)).toBe(true)
    expect(after.log.at(-1)).toBe("You can't get there.")
  })

  test('a living foe: the hero walks up to it and attacks', async () => {
    const g = newGame(2)
    const foe = foeAhead(g, 3, { hp: 99, maxHp: 99 })
    const after = apply({ ...g, foe, seen: '1'.repeat(g.seen.length) }, { kind: 'goto', x: foe.x, y: foe.y })
    expect(Math.max(Math.abs(after.x - foe.x), Math.abs(after.y - foe.y))).toBe(1)
    expect(after.foe?.hp).toBeLessThan(99)
  })

  test('a tile past a living foe: the hero stops beside the foe, as exploring does', async () => {
    const g = { ...newGame(2), seen: '1'.repeat(64 * 18) }
    const foe = foeAhead(g, 2, { hp: 99, maxHp: 99 })
    const stairs = levelOf(g).stairs
    const after = apply({ ...g, foe }, { kind: 'goto', x: stairs.x, y: stairs.y })
    expect(Math.max(Math.abs(after.x - foe.x), Math.abs(after.y - foe.y))).toBe(1)
    expect(after.log.at(-1)).toBe(`The ${foe.name} blocks your way.`)
  })

  test('a foe on the shortest way is walked around', async () => {
    const { g, r } = room(5)
    expect(r.w >= 4 && r.h >= 3).toBe(true)
    const hero = { ...g, x: r.x, y: r.y + 1, seen: '1'.repeat(64 * 18) }
    const foe = { ...foeAhead(g, 1, { hp: 99, maxHp: 99 }), x: r.x + 1, y: r.y + 1 }
    const after = apply({ ...hero, foe }, { kind: 'goto', x: r.x + 2, y: r.y + 1 })
    expect({ x: after.x, y: after.y }).toEqual({ x: r.x + 2, y: r.y + 1 })
  })

  test('a foe that bars the only way stops the hero, and he says so', async () => {
    const start = { ...newGame(2), seen: '1'.repeat(64 * 18) }
    const route = routeToStairs(start)!
    const { tiles, stairs } = levelOf(start)
    // A corridor along the way to the stairs: a foe one step on there leaves no way around it.
    const k = route.findIndex((p, i) => i + 2 < route.length && bfs(tiles, p, stairs, route[i + 1]) === null)
    expect(k).toBeGreaterThanOrEqual(0)
    const g = { ...start, ...route[k]! }
    const foe = { ...foeAhead(start, 1, { hp: 99, maxHp: 99 }), ...route[k + 1]! }
    const after = apply({ ...g, foe }, { kind: 'goto', ...route[k + 2]! })
    expect(same(after, g)).toBe(true)
    expect(after.log.at(-1)).toBe(`The ${foe.name} blocks your way.`)
  })

  test('a far seen tile is reached in one click, however long the way', async () => {
    const g = { ...newGame(3), seen: '1'.repeat(64 * 18) }
    const level = levelOf(g)
    const far = level.rooms.flatMap(r => [{ x: r.x, y: r.y }]).map(p => ({ p, len: bfs(level.tiles, g, p)?.length ?? 0 })).sort((a, b) => b.len - a.len)[0]!
    expect(far.len).toBeGreaterThan(30)
    const after = apply(g, { kind: 'goto', ...far.p })
    expect(same(after, far.p)).toBe(true)
  })
})

test('a click on the hero explores: the same step toward the stairs as the explore action', async () => {
  const g = newGame(5)
  const clicked = apply(g, { kind: 'goto', x: g.x, y: g.y })
  const explored = apply(g, { kind: 'walk' })
  expect({ x: clicked.x, y: clicked.y }).not.toEqual({ x: g.x, y: g.y })
  expect({ x: clicked.x, y: clicked.y, log: clicked.log }).toEqual({ x: explored.x, y: explored.y, log: explored.log })
})

describe('going downstairs yourself', () => {
  test('on the stairs, the descend action takes the hero down a level', async () => {
    const g = newGame(4)
    const after = apply({ ...g, ...levelOf(g).stairs }, { kind: 'stairs' })
    expect(after.depth).toBe(2)
  })

  test('away from the stairs it says to find them first', async () => {
    const after = apply(newGame(4), { kind: 'stairs' })
    expect(after.depth).toBe(1)
    expect(after.log.at(-1)).toBe('Find the stairs > first.')
  })

  test('clicking the stairs walks there and goes down', async () => {
    const g = { ...newGame(4), seen: '1'.repeat(64 * 18) }
    const { stairs } = levelOf(g)
    const steps = (routeToStairs(g)?.length ?? 99) - 1
    const near = steps > 20 ? { ...g, ...(routeToStairs(g) ?? [])[steps - 5]! } : g
    expect(apply(near, { kind: 'goto', x: stairs.x, y: stairs.y }).depth).toBe(2)
  })

  test('a living foe still guards the stairs', async () => {
    const g = newGame(4)
    const on = { ...g, ...levelOf(g).stairs }
    const after = apply({ ...on, foe: foeAhead(g, 1, { hp: 9, maxHp: 9 }) }, { kind: 'stairs' })
    expect(after.depth).toBe(1)
  })
})

describe('the walk an action made', () => {
  test('records each tile stepped through, in order', async () => {
    const g = newGame(6)
    const route = routeToStairs(g) ?? []
    const after = apply(g, { kind: 'explore', steps: 3 })
    expect(after.walked).toEqual(route.slice(1, 4))
  })

  test('is empty for an action that does not move the hero, and starts over each action', async () => {
    const moved = apply(newGame(6), { kind: 'explore', steps: 2 })
    expect(apply(moved, { kind: 'potion' }).walked).toEqual([])
  })

  test('is empty after taking the stairs: a new level is not walked to', async () => {
    const g = newGame(4)
    expect(apply({ ...g, ...levelOf(g).stairs }, { kind: 'stairs' }).walked).toEqual([])
  })
})

describe('picking an item with the mouse', () => {
  test('select makes that bag item the selected one; an id not in the bag changes nothing', async () => {
    const g = plainHero(3)
    const blade = g.gear.weapon!
    const withBag = { ...g, bag: [{ ...blade, id: 1, x: 0, y: 0 }, { ...blade, id: 2, x: 2, y: 0 }], cursor: 1 }
    expect(apply(withBag, { kind: 'select', id: 2 }).cursor).toBe(2)
    expect(apply(withBag, { kind: 'select', id: 99 }).cursor).toBe(1)
  })
})

describe('organizing the bag', () => {
  // A 1x3 blade at 0,0 and another at 2,0; the bag is BAG_W by BAG_H.
  const setup = () => {
    const g = plainHero(3)
    const blade = g.gear.weapon!
    return { ...g, bag: [{ ...blade, id: 1, x: 0, y: 0 }, { ...blade, id: 2, x: 2, y: 0 }], cursor: 1 }
  }

  test('an item placed on free cells moves there', async () => {
    const after = apply(setup(), { kind: 'place', id: 1, x: 5, y: 3 })
    expect(after.bag.find(i => i.id === 1)).toMatchObject({ x: 5, y: 3 })
  })

  test('an item can be moved onto cells it already partly covers', async () => {
    const after = apply(setup(), { kind: 'place', id: 1, x: 0, y: 1 })
    expect(after.bag.find(i => i.id === 1)).toMatchObject({ x: 0, y: 1 })
  })

  test('a place over another item or past the edge leaves it where it was, and says so', async () => {
    for (const to of [{ x: 2, y: 1 }, { x: 0, y: 4 }, { x: -1, y: 0 }]) {
      const after = apply(setup(), { kind: 'place', id: 1, ...to })
      expect(after.bag.find(i => i.id === 1)).toMatchObject({ x: 0, y: 0 })
      expect(after.log.at(-1)).toBe("It doesn't fit there.")
    }
  })

  test('destroy removes the selected item for good and says so; the selection moves on', async () => {
    const g = setup()
    const after = apply(g, { kind: 'destroy' })
    expect(after.bag.map(i => i.id)).toEqual([2])
    expect(after.cursor).toBe(2)
    expect(after.log.at(-1)).toBe(`You destroy the ${g.bag[0]!.name}.`)
  })

  test('destroy with nothing selected changes nothing', async () => {
    const g = { ...setup(), cursor: null }
    expect(apply(g, { kind: 'destroy' }).bag.length).toBe(2)
  })
})

describe('the town', () => {
  const inDungeon = () => ({ ...newGame(4), seen: '1'.repeat(64 * 18) })
  const inTown = () => apply(inDungeon(), { kind: 'portal' })
  const beside = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) === 1

  test('the portal takes the hero to town, next to its portal, and remembers where it was opened', async () => {
    const g = inDungeon()
    const after = apply(g, { kind: 'portal' })
    expect(after.where).toBe('town')
    expect({ x: after.x, y: after.y }).toEqual(TOWN_ARRIVAL)
    expect(after.portal).toEqual({ x: g.x, y: g.y })
    expect(after.depth).toBe(g.depth)
    expect(after.log.at(-1)).toBe('You step through the portal into town.')
  })

  test('the portal will not open while a foe lives on the level', async () => {
    const g = inDungeon()
    const foe = foeAhead(g, 3)
    const after = apply({ ...g, foe }, { kind: 'portal' })
    expect(after.where).toBe('dungeon')
    expect(after.log.at(-1)).toBe(`The portal will not open while the ${foe.name} lives.`)
  })

  test('back through the portal, by key or by clicking it, the hero stands where it was opened', async () => {
    // Opened a few steps from the level's start, so the way back is told apart from a fresh arrival.
    const g = apply(inDungeon(), { kind: 'explore', steps: 3 })
    expect({ x: g.x, y: g.y }).not.toEqual(levelOf(g).start)
    for (const back of [{ kind: 'portal' } as const, { kind: 'goto', ...TOWN_SPOTS.portal } as const]) {
      const after = apply(apply(g, { kind: 'portal' }), back)
      expect(after.where).toBe('dungeon')
      expect({ x: after.x, y: after.y }).toEqual({ x: g.x, y: g.y })
      expect(after.portal).toBeNull()
    }
  })

  test('the town is safe: tool calls bring no foe and cost nothing; the hero rests', async () => {
    const t = inTown()
    let after = t
    for (const a of [{ kind: 'summon', name: 'auth.ts' }, { kind: 'outcome', ok: false, what: 'Bash' }, { kind: 'explore', steps: 3 }] as const) after = apply(after, a)
    expect(after.foe).toBeNull()
    expect(after.hp).toBe(t.hp)
    expect({ x: after.x, y: after.y }).toEqual({ x: t.x, y: t.y })
    expect(after.log.at(-1)).toMatch(/^You rest in town\./)
  })

  test('a finished task still takes the hero down: from town to the next depth', async () => {
    const t = inTown()
    const after = apply(t, { kind: 'descend' })
    expect(after.where).toBe('dungeon')
    expect(after.depth).toBe(t.depth + 1)
    expect(after.portal).toBeNull()
  })

  test('clicking open ground walks there; a building cannot be walked into', async () => {
    const t = inTown()
    const road = { x: 2, y: 6 }
    const after = apply(t, { kind: 'goto', ...road })
    expect({ x: after.x, y: after.y }).toEqual(road)
    expect(after.walked.length).toBeGreaterThan(0)
    const wall = apply(t, { kind: 'goto', x: 2, y: 1 })
    expect({ x: wall.x, y: wall.y }).toEqual({ x: t.x, y: t.y })
    expect(wall.log.at(-1)).toBe("You can't get there.")
  })

  test('the healer, clicked, is walked up to and mends the hero to full; at full health there is nothing to mend', async () => {
    const hurt = { ...inTown(), hp: 5 }
    const after = apply(hurt, { kind: 'goto', ...TOWN_SPOTS.healer })
    expect(beside(after, TOWN_SPOTS.healer)).toBe(true)
    expect(after.hp).toBe(after.maxHp)
    expect(after.log.at(-1)).toBe('The healer tends your wounds. HP full.')
    expect(apply(after, { kind: 'goto', ...TOWN_SPOTS.healer }).log.at(-1)).toBe('The healer finds nothing to mend.')
  })

  test('the merchant, the smith and the stash are walked up to', async () => {
    for (const spot of ['merchant', 'smith', 'stash'] as const) {
      const after = apply(inTown(), { kind: 'goto', ...TOWN_SPOTS[spot] })
      expect(beside(after, TOWN_SPOTS[spot])).toBe(true)
    }
  })

  test('in town there is nothing to attack and no stairs to take', async () => {
    expect(apply(inTown(), { kind: 'attack' }).log.at(-1)).toBe('No foes here.')
    for (const kind of ['walk', 'stairs'] as const) expect(apply(inTown(), { kind }).log.at(-1)).toBe('The stairs are in the dungeon: take the portal back (t).')
  })

  test('a step in town goes onto open ground; a building or a townsfolk stops it', async () => {
    const t = inTown()
    expect(apply(t, { kind: 'move', dx: -1, dy: 0 })).toMatchObject({ x: t.x - 1, y: t.y })
    // On the road under the merchant's counter: a step north meets the counter.
    const under = { ...t, x: 2, y: TOWN_SPOTS.merchant.y + 1 }
    expect(apply(under, { kind: 'move', dx: 0, dy: -1 })).toMatchObject({ x: 2, y: TOWN_SPOTS.merchant.y + 1 })
  })

  test('trees, the fountain, lamps and the goods outside the shop stand in the way: they cannot be walked onto', async () => {
    for (const thing of TOWN_DECOR) for (let dy = 0; dy < thing.size; dy += 1) for (let dx = 0; dx < thing.size; dx += 1) {
      const p = { x: thing.x + dx, y: thing.y + dy }
      if (p.x < 0 || p.y < 0 || p.x >= TOWN_W || p.y >= TOWN_H) continue
      expect(isTownWalkable(p) ? `${thing.art} at ${p.x},${p.y} is walkable` : 'blocked').toBe('blocked')
    }
    expect(TOWN_DECOR.some(d => d.art === 'fountain')).toBe(true)
    expect(TOWN_DECOR.filter(d => d.art === 'tree').length).toBeGreaterThan(20)
  })

  test('every townsfolk, the stash and the portal can be walked up to from where the hero arrives', async () => {
    for (const spot of Object.keys(TOWN_SPOTS) as (keyof typeof TOWN_SPOTS)[]) expect(pathBeside(TOWN_ARRIVAL, TOWN_SPOTS[spot]) !== null ? spot : `${spot} cut off`).toBe(spot)
    expect(isTownWalkable(TOWN_ARRIVAL)).toBe(true)
  })
})

test('a version 3 save, from before the town, loads in the dungeon with no portal open', async () => {
  const { where: _w, portal: _p, ...v3 } = { ...newGame(4), version: 3 }
  const g = normalize(v3 as unknown as Game)
  expect(g.where).toBe('dungeon')
  expect(g.portal).toBeNull()
  expect(g.version).toBe(SAVE_VERSION)
})

describe('a version 4 save, from before the levels were rebuilt', () => {
  // Version 4 saves hold a position and explored map for a layout that no longer exists.
  const earned = { gold: 517, level: 7, xp: 12, depth: 3 }
  const v4 = (over: Partial<Game> = {}) => ({ ...newGame(4), ...earned, x: 62, y: 16, seen: '1'.repeat(64 * 18), taken: [5, 6], version: 4, ...over }) as Game

  test('in the dungeon, re-enters its depth at the new level\'s start, its fog and pickups fresh, its gains kept', async () => {
    const g = normalize(v4())
    const level = generate(g.world, 3)
    expect({ x: g.x, y: g.y }).toEqual(level.start)
    expect(g.taken).toEqual([])
    expect(g.seen).not.toBe('1'.repeat(64 * 18))
    expect({ gold: g.gold, level: g.level, xp: g.xp, depth: g.depth, version: g.version }).toEqual({ ...earned, version: SAVE_VERSION })
  })

  test('in town, stays in town, its portal now leading to the new level\'s start', async () => {
    const g = normalize(v4({ where: 'town', x: 9, y: 11, portal: { x: 62, y: 16 } }))
    expect({ where: g.where, x: g.x, y: g.y }).toEqual({ where: 'town', x: 9, y: 11 })
    expect(g.portal).toEqual(generate(g.world, 3).start)
    expect(g.gold).toBe(517)
  })

  test('a version 5 save, from before rooms took shapes, re-enters its depth at the start too', async () => {
    const g = normalize(v4({ version: 5 }))
    expect({ x: g.x, y: g.y }).toEqual(generate(g.world, 3).start)
    expect(g.taken).toEqual([])
    expect(g.version).toBe(SAVE_VERSION)
  })

  test('a version 7 save re-enters its depth at the start where the layout changed, and stays put where it did not', async () => {
    const depthOf = (changed: boolean) => {
      for (let d = 2; d < 30; d += 1) if (!isBossDepth(d) && (layoutOf(4, d) !== 'rooms') === changed) return d
      throw new Error('no such depth')
    }
    // The middle of a room the hero does not start in: floor whatever the room's shape.
    const spotOn = (depth: number) => {
      const level = generate(4, depth)
      return level.rooms.map(r => ({ x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) })).find(p => !same(p, level.start))!
    }
    const at = (depth: number) => normalize({ ...newGame(4), world: 4, depth, ...spotOn(depth), seen: '1'.repeat(64 * 18), version: 7 } as Game)
    const moved = at(depthOf(true))
    expect({ x: moved.x, y: moved.y }).toEqual(generate(4, moved.depth).start)
    const kept = at(depthOf(false))
    expect({ x: kept.x, y: kept.y, seen: kept.seen }).toEqual({ ...spotOn(kept.depth), seen: '1'.repeat(64 * 18) })
  })

  test('a current save loads as it is', async () => {
    const now = newGame(4)
    expect(normalize(now)).toEqual({ ...now })
  })
})

describe('the town in words', () => {
  const town = () => apply(newGame(4), { kind: 'portal' })
  const text = (rows: { text: string }[][]) => rows.map(r => r.map(c => c.text).join(''))

  test('the character map shows the town: buildings, the townsfolk by initial, the portal and the hero', async () => {
    const g = town()
    const rows = text(mapRows(g, TOWN_W, TOWN_H))
    expect(rows[g.y]![g.x]).toBe('@')
    expect(rows[TOWN_SPOTS.merchant.y]![TOWN_SPOTS.merchant.x]).toBe('M')
    expect(rows[TOWN_SPOTS.smith.y]![TOWN_SPOTS.smith.x]).toBe('S')
    expect(rows[TOWN_SPOTS.healer.y]![TOWN_SPOTS.healer.x]).toBe('H')
    expect(rows[TOWN_SPOTS.portal.y]![TOWN_SPOTS.portal.x]).toBe('O')
    expect(rows[3]![1 + 1]).toBe('#')
    expect(rows[0]![0]).toBe('&')
    expect(rows[8]![9]).toBe('~')
    expect(rows[7]![6]).toBe('!')
  })

  test('the status lines say the hero is in town and where the portal leads', async () => {
    const g = town()
    expect(text([statusRuns(g)])[0]).toMatch(/Town \(depth 1\)/)
    expect(text([foeRuns(g)])[0]).toBe('You are in town. The portal (t) leads back to depth 1.')
  })
})

describe('the people of the town', () => {
  const inTown = () => apply(newGame(4), { kind: 'portal' })
  const beside = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)) === 1

  test('the elder, the mystic, the guard, the villager and the dog are walked up to, and each has a word', async () => {
    const said = {
      elder: /^The elder: "(Slay|Reach) /,
      mystic: 'The mystic gazes into the crystal. "A fortune costs 30 gold."',
      guard: 'The guard: "The dungeon is through the portal. Mind the stairs."',
      villager: 'A villager waves. "Fine day for it."',
      dog: 'The dog wags its tail.',
    } as const
    for (const [who, line] of Object.entries(said) as [keyof typeof said, string | RegExp][]) {
      const after = apply(inTown(), { kind: 'goto', ...TOWN_SPOTS[who] })
      expect(beside(after, TOWN_SPOTS[who]) ? who : `${who} not reached`).toBe(who)
      expect(after.log.at(-1)).toMatch(line)
    }
  })
})

test('a shell command summons a foe named after the program it runs, past any variables set before it', async () => {
  expect(onToolStart('Bash', 'npm test')).toEqual({ kind: 'summon', name: 'npm' })
  expect(onToolStart('Bash', 'S=/private/tmp/x; cd $S && bun run.ts')).toEqual({ kind: 'summon', name: 'cd' })
  expect(onToolStart('Bash', 'FOO=1 BAR=two /usr/local/bin/node script.js')).toEqual({ kind: 'summon', name: 'node' })
  expect(onToolStart('Bash', '   ')).toEqual({ kind: 'summon', name: 'the shell' })
})

describe('opening a chest', () => {
  /** A game standing next to a chest of `kind`, everything explored, found by scanning worlds at `depth`. */
  const besideChest = (kind: string, depth: number) => {
    for (let world = 1; world <= 200; world += 1) {
      const level = generate(world, depth)
      for (const end of analyze(level).deadEnds) {
        if (chestAt(world, depth, level, end) !== kind) continue
        const next = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }].map(d => ({ x: end.x + d.x, y: end.y + d.y })).find(p => level.tiles[p.y]?.[p.x] === '.')!
        const g = normalize({ ...newGame(world), world, depth, ...next, seen: '1'.repeat(64 * 18), taken: [], foe: null })
        return { g, chest: end }
      }
    }
    throw new Error(`no ${kind} chest`)
  }

  test('walking onto it opens it once: gold and an item, said in one line; it stays open', async () => {
    const { g, chest } = besideChest('wooden', 1)
    const opened = apply(g, { kind: 'goto', ...chest })
    expect(opened.gold).toBeGreaterThan(g.gold)
    expect(opened.taken).toContain(cellId(chest))
    expect(opened.log.at(-1)).toMatch(/^You open the wooden chest: \d+ gold/)
    const back = apply(apply(opened, { kind: 'goto', x: g.x, y: g.y }), { kind: 'goto', ...chest })
    expect(back.gold).toBe(opened.gold)
    const opens = (log: string[]) => log.filter(l => /^You open/.test(l)).length
    expect(opens(back.log)).toBe(opens(opened.log))
  })

  test('on the map it shows closed until opened, then open where it stood', async () => {
    const { g, chest } = besideChest('iron', 3)
    const level = levelOf(g)
    const glyph = (game: typeof g) => tileAt(game, level, new Set([cellId(chest)]), chest).occupant
    expect(glyph(g)).toMatchObject({ kind: 'thing', glyph: 'H' })
    // Opened, and the hero stepped back off it.
    expect(glyph(apply(apply(g, { kind: 'goto', ...chest }), { kind: 'goto', x: g.x, y: g.y }))?.glyph).toBe('c')
  })

  test('an Epic from a chest is announced as any Epic is', async () => {
    const { g, chest } = besideChest('gilded', 6)
    const epic = Array.from({ length: 300 }, (_, i) => apply({ ...g, seed: i + 1, bag: [] }, { kind: 'goto', ...chest })).find(o => o.bag.at(-1)?.rarity === 'epic')!
    expect(epic.toast).toBe(`Epic! ${epic.bag.at(-1)!.name}`)
  })

  test('an iron chest gives Uncommon or better, a gilded one Rare or better, every time', async () => {
    const rank = ['common', 'uncommon', 'rare', 'epic', 'legendary']
    for (const [kind, depth, least] of [['iron', 3, 'uncommon'], ['gilded', 6, 'rare']] as const) {
      const { g, chest } = besideChest(kind, depth)
      for (let seed = 1; seed <= 30; seed += 1) {
        const opened = apply({ ...g, seed, bag: [] }, { kind: 'goto', ...chest })
        const found = opened.bag.at(-1)!
        expect(rank.indexOf(found.rarity)).toBeGreaterThanOrEqual(rank.indexOf(least))
      }
    }
  })
})

describe('champions', () => {
  const base = { glyph: 'g', name: 'goblin of x', hp: 10, maxHp: 10, atk: 4, xp: 6, x: 0, y: 0 }

  test('each modifier, worked by hand: its name first, double XP, 1.5x HP, 1.25x attack, and its one strength', async () => {
    // 10 HP -> 15, attack 4 -> 5; tough: 15 -> 24; savage: 5 -> 8 (7.5 rounded up).
    const champ = { ...base, hp: 15, maxHp: 15, atk: 5, xp: 12 }
    expect(championOf(base, 'tough')).toEqual({ ...champ, name: 'Tough goblin of x', hp: 24, maxHp: 24, champion: 'tough' })
    expect(championOf(base, 'savage')).toEqual({ ...champ, name: 'Savage goblin of x', atk: 8, champion: 'savage' })
    expect(championOf(base, 'shielded')).toEqual({ ...champ, name: 'Shielded goblin of x', champion: 'shielded', shield: 1 })
    expect(championOf(base, 'vampiric')).toEqual({ ...champ, name: 'Vampiric goblin of x', champion: 'vampiric' })
    // Attack 10: 12.5 rounds up to 13.
    expect(championOf({ ...base, atk: 10 }, 'shielded').atk).toBe(13)
  })

  test('about one foe in ten is a champion from depth 2, none at depth 1', { timeoutMs: 20000 }, async () => {
    const share = (depth: number) => {
      let champions = 0
      for (let seed = 1; seed <= 800; seed += 1) {
        const g = apply({ ...newGame(seed), depth, foe: null }, { kind: 'summon', name: 'a.ts' })
        if (g.foe?.champion !== undefined) champions += 1
      }
      return champions / 800
    }
    expect(share(1)).toBe(0)
    const deep = share(5)
    expect(deep).toBeGreaterThan(0.06)
    expect(deep).toBeLessThan(0.15)
  })

  test('a shielded champion turns the first blow aside, then takes them', async () => {
    const g = plainHero()
    const foe = championOf(foeAhead(g, 1, { hp: 30, maxHp: 30 }), 'shielded')
    const once = apply({ ...g, foe }, { kind: 'outcome', ok: true, what: 'Edit' })
    expect(once.foe?.hp).toBe(foe.hp)
    expect(once.foe?.shield).toBe(0)
    expect(once.log).toContain(`The ${foe.name}'s shield turns your blow.`)
    const twice = apply(once, { kind: 'outcome', ok: true, what: 'Edit' })
    expect(twice.foe!.hp).toBeLessThan(foe.hp)
  })

  test('a vampiric champion heals by what it deals, never past its full HP', async () => {
    const g = plainHero()
    const hurtFoe = championOf(foeAhead(g, 1, { hp: 10, maxHp: 30, atk: 5, opened: true }), 'vampiric')
    const after = apply({ ...g, foe: hurtFoe }, { kind: 'outcome', ok: false, what: 'Bash' })
    const dealt = g.hp - after.hp
    expect(dealt).toBeGreaterThan(0)
    expect(after.foe!.hp).toBe(hurtFoe.hp + dealt)
    const full = apply({ ...g, foe: { ...hurtFoe, hp: hurtFoe.maxHp } }, { kind: 'outcome', ok: false, what: 'Bash' })
    expect(full.foe!.hp).toBe(hurtFoe.maxHp)
  })

  test('a champion slain always leaves an item of Uncommon or better, the best of two rolls', async () => {
    const rank = ['common', 'uncommon', 'rare', 'epic', 'legendary']
    for (let seed = 1; seed <= 40; seed += 1) {
      const g = { ...plainHero(seed), bag: [] }
      const foe = championOf(foeAhead(g, 1, { hp: 1, maxHp: 1 }), 'savage')
      const after = apply({ ...g, foe }, { kind: 'outcome', ok: true, what: 'Edit' })
      expect(after.foe).toBeNull()
      expect(rank.indexOf(after.bag.at(-1)!.rarity)).toBeGreaterThanOrEqual(1)
    }
  })
})

describe('drops worth announcing', () => {
  test('an Epic is toasted by name; a Legendary keeps its own toast; lesser drops are not', async () => {
    const seen: Record<string, string | null> = {}
    for (let seed = 1; seed <= 3000 && !('epic' in seen && 'legendary' in seen && 'rare' in seen && 'common' in seen); seed += 1) {
      const g = { ...plainHero(seed), depth: 8, bag: [] }
      // A foe worth 1 XP, so no level-up toast takes the place of a drop's.
      const after = apply({ ...g, foe: foeAhead(g, 1, { hp: 1, maxHp: 1, xp: 1 }) }, { kind: 'outcome', ok: true, what: 'Edit' })
      const item = after.bag.at(-1)
      if (item !== undefined && !(item.rarity in seen)) seen[item.rarity] = after.toast
    }
    expect(seen.epic).toMatch(/^Epic! .+$/)
    expect(seen.legendary).toMatch(/^Legendary! .+$/)
    expect(seen.rare ?? null).toBeNull()
    expect(seen.common ?? null).toBeNull()
  })

  test('a champion slain is toasted with what it left; a level-up it brings is toasted instead', async () => {
    const g = { ...plainHero(3), bag: [] }
    const foe = { ...championOf(foeAhead(g, 1, { hp: 1, maxHp: 1 }), 'savage'), xp: 1 }
    const after = apply({ ...g, foe }, { kind: 'outcome', ok: true, what: 'Edit' })
    const item = after.bag.at(-1)!
    expect(after.toast).toMatch(new RegExp(`^(Champion slain: ${foe.name} left ${item.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.|Epic! .+|Legendary! .+)$`))
    const levels = apply({ ...g, foe: { ...foe, xp: 500 } }, { kind: 'outcome', ok: true, what: 'Edit' })
    expect(levels.toast).toMatch(/^Level up!/)
  })
})

describe('the merchant', () => {
  const inTown = (over: Partial<Game> = {}): Game => ({ ...apply(newGame(4), { kind: 'portal' }), gold: 100, belt: [null, null, null, null, null], ...over })

  test('visiting opens the shop; visiting the smith opens the forge', async () => {
    expect(apply(inTown(), { kind: 'goto', ...TOWN_SPOTS.merchant }).panel).toBe('shop')
    expect(apply(inTown(), { kind: 'goto', ...TOWN_SPOTS.smith }).panel).toBe('forge')
  })

  test('sells potions and scrolls at fixed prices, onto the belt at their tier', async () => {
    expect(SHOP_PRICES).toEqual({ health1: 25, health3: 80, regen1: 45, fury1: 50, ward1: 50, smoke1: 35, smoke3: 60 })
    const g = apply(inTown(), { kind: 'buy', ware: 'health1' })
    expect(g.gold).toBe(75)
    expect(g.belt[0]).toEqual({ kind: 'health', tiers: [1, 0, 0] })
    expect(g.log.at(-1)).toBe('You buy a Health Potion for 25 gold.')
    const passage = apply(inTown(), { kind: 'buy', ware: 'smoke3' })
    expect({ gold: passage.gold, slot: passage.belt[4] }).toEqual({ gold: 40, slot: { kind: 'smoke', tiers: [0, 0, 1] } })
  })

  test('a ware the merchant does not stock is not sold, and costs nothing', async () => {
    const g = apply(inTown(), { kind: 'buy', ware: 'fury3' })
    expect({ gold: g.gold, slot: g.belt[2] }).toEqual({ gold: 100, slot: null })
    expect(g.log.at(-1)).toBe("The merchant has no Berserker's Oath to sell.")
  })

  test('refuses what you cannot pay for, or have no room for, and takes nothing', async () => {
    const poor = apply(inTown({ gold: 20 }), { kind: 'buy', ware: 'health1' })
    expect({ gold: poor.gold, belt: poor.belt[0] }).toEqual({ gold: 20, belt: null })
    expect(poor.log.at(-1)).toBe('Not enough gold: a Health Potion costs 25.')
    const full = inTown({ belt: [{ kind: 'health', tiers: [9, 0, 0] }, null, null, null, null] })
    const refused = apply(full, { kind: 'buy', ware: 'health1' })
    expect(refused.gold).toBe(100)
    expect(refused.log.at(-1)).toBe('Your belt has no room for a Health Potion.')
  })

  test('the shop closes when the hero leaves town', async () => {
    const shopping = apply(inTown(), { kind: 'goto', ...TOWN_SPOTS.merchant })
    expect(apply(shopping, { kind: 'portal' }).panel).toBe('none')
  })

  test('trades only in town', async () => {
    const g = apply({ ...newGame(4), gold: 100 }, { kind: 'buy', ware: 'health1' })
    expect(g.gold).toBe(100)
    expect(g.log.at(-1)).toBe('The merchant is in town.')
  })
})

describe('the smith', () => {
  const rare = (g: Game) => ({ ...plainItem(g, 'sword', 'rare'), name: 'Sharp Short Sword of Force', atk: 5 })
  const inTown = (gold = 1000): Game => {
    const g = apply(newGame(4), { kind: 'portal' })
    return { ...g, gold, gear: { ...g.gear, weapon: rare(g) } }
  }

  test('reforges a worn item: new affixes, the same base, tier and id, for a price that rises each time', async () => {
    const g = inTown()
    const before = g.gear.weapon!
    const once = apply(g, { kind: 'reforge', slot: 'weapon' })
    const after = once.gear.weapon!
    expect({ base: after.base, rarity: after.rarity, id: after.id, slot: after.slot }).toEqual({ base: before.base, rarity: before.rarity, id: before.id, slot: before.slot })
    expect(once.gold).toBe(1000 - reforgeCost(g))
    expect(once.log.at(-1)).toBe(`The smith reforges your ${before.name} into ${after.name} for ${reforgeCost(g)} gold.`)
    expect(reforgeCost(once)).toBeGreaterThan(reforgeCost(g))
    // Worked by hand: 40 gold, then 40 more for each reforge before, plus 10 a depth.
    expect(reforgeCost({ ...g, reforges: 0, depth: 1 })).toBe(50)
    expect(reforgeCost({ ...g, reforges: 2, depth: 3 })).toBe(150)
  })

  test('cannot reforge a Common (no affixes) or a Legendary (fixed), nor without the gold', async () => {
    const g = inTown()
    const plain = apply({ ...g, gear: { ...g.gear, weapon: plainItem(g, 'sword') } }, { kind: 'reforge', slot: 'weapon' })
    expect(plain.log.at(-1)).toBe('The smith has nothing to reforge on a Common item.')
    const poor = apply(inTown(10), { kind: 'reforge', slot: 'weapon' })
    expect(poor.gold).toBe(10)
    expect(poor.log.at(-1)).toMatch(/^Not enough gold: reforging costs \d+\.$/)
    expect(apply({ ...newGame(4), gold: 1000 }, { kind: 'reforge', slot: 'weapon' }).log.at(-1)).toBe('The smith is in town.')
  })

  test('tempers a worn weapon three times: +1 attack each, for 60, then 240, then 540 gold, and no further', async () => {
    const g = inTown()
    const once = apply(g, { kind: 'temper', slot: 'weapon' })
    expect(once.gear.weapon!.atk).toBe(6)
    expect(once.gold).toBe(940)
    expect(once.log.at(-1)).toBe('The smith tempers your Sharp Short Sword of Force: +1 attack, for 60 gold.')
    const twice = apply(once, { kind: 'temper', slot: 'weapon' })
    expect([twice.gear.weapon!.atk, twice.gold]).toEqual([7, 700])
    const thrice = apply(twice, { kind: 'temper', slot: 'weapon' })
    expect([thrice.gear.weapon!.atk, thrice.gold, thrice.gear.weapon!.temper]).toEqual([8, 160, 3])
    const more = apply({ ...thrice, gold: 1000 }, { kind: 'temper', slot: 'weapon' })
    expect([more.gear.weapon!.atk, more.gold]).toEqual([8, 1000])
    expect(more.log.at(-1)).toBe('Your Sharp Short Sword of Force is tempered as far as it will go.')
  })

  test('tempering armor raises its defense; an offhand that strikes raises its attack', async () => {
    const g = inTown()
    const helm = apply({ ...g, gear: { ...g.gear, helm: plainItem(g, 'steelHelm') } }, { kind: 'temper', slot: 'helm' })
    expect([helm.gear.helm!.def, helm.gear.helm!.atk]).toEqual([2, 0])
    expect(helm.log.at(-1)).toBe('The smith tempers your Steel Helm: +1 defense, for 60 gold.')
    const tome = apply({ ...g, gear: { ...g.gear, offhand: plainItem(g, 'tome') } }, { kind: 'temper', slot: 'offhand' })
    expect([tome.gear.offhand!.atk, tome.gear.offhand!.def]).toEqual([3, 0])
  })

  test('cannot temper an empty slot, nor without the gold, nor outside town', async () => {
    const g = inTown()
    const bare = apply({ ...g, gear: { ...g.gear, ring: undefined } }, { kind: 'temper', slot: 'ring' })
    expect(bare.log.at(-1)).toBe('Nothing worn there to temper.')
    const poor = apply(inTown(59), { kind: 'temper', slot: 'weapon' })
    expect([poor.gold, poor.gear.weapon!.atk]).toEqual([59, 5])
    expect(poor.log.at(-1)).toBe('Not enough gold: tempering costs 60.')
    expect(apply({ ...newGame(4), gold: 1000 }, { kind: 'temper', slot: 'weapon' }).log.at(-1)).toBe('The smith is in town.')
  })

  test('a tempered item comes back from a save as it went in', async () => {
    const tempered = apply(inTown(), { kind: 'temper', slot: 'weapon' })
    const loaded = normalize(JSON.parse(JSON.stringify(tempered)))
    expect([loaded.gear.weapon!.temper, loaded.gear.weapon!.atk]).toEqual([1, 6])
  })

  test('a reforge keeps the temper: the reforged item has as much more attack as it was tempered', async () => {
    const g = inTown()
    const tempered = apply(apply(g, { kind: 'temper', slot: 'weapon' }), { kind: 'temper', slot: 'weapon' })
    // The same game, gold and all, but the weapon untempered: the reforge rolls the same affixes.
    const plain = { ...tempered, gear: { ...tempered.gear, weapon: g.gear.weapon } }
    const a = apply(tempered, { kind: 'reforge', slot: 'weapon' }).gear.weapon!
    const b = apply(plain, { kind: 'reforge', slot: 'weapon' }).gear.weapon!
    expect(a.name).toBe(b.name)
    expect([a.atk - b.atk, a.temper]).toEqual([2, 2])
  })
})

describe('the themed room in play', () => {
  /** A game standing beside the middle of a themed room of `kind`, everything explored. */
  const beside = (kind: 'shrine' | 'library') => {
    for (let world = 1; world <= 200; world += 1) {
      const level = generate(world, 3)
      const themed = themedRoomOf(world, 3, level)
      if (themed?.kind !== kind) continue
      const r = themed.room
      const mid = { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) }
      const next = { x: mid.x, y: mid.y + 1 < r.y + r.h ? mid.y + 1 : mid.y - 1 }
      return { g: normalize({ ...newGame(world), world, depth: 3, ...next, seen: '1'.repeat(64 * 18), taken: [], foe: null }), mid, room: r }
    }
    throw new Error(`no ${kind}`)
  }

  test("praying at the altar restores a quarter of the hero's HP, once", async () => {
    const { g, mid } = beside('shrine')
    const hurt = { ...g, hp: 4, maxHp: 40 }
    const prayed = apply(hurt, { kind: 'goto', ...mid })
    expect(prayed.hp).toBe(14)
    expect(prayed.log.at(-1)).toBe('You pray at the altar. +10 HP')
    const again = apply(apply({ ...prayed, hp: 4 }, { kind: 'goto', x: g.x, y: g.y }), { kind: 'goto', ...mid })
    expect(again.hp).toBe(4)
  })

  test('at full HP the altar is passed by, kept for when the hero is hurt', async () => {
    const { g, mid } = beside('shrine')
    const passed = apply(g, { kind: 'goto', ...mid })
    expect(passed.taken).not.toContain(cellId(mid))
    expect(passed.log.some(l => l.startsWith('You pray'))).toBe(false)
    const hurt = apply(apply({ ...passed, hp: 4, maxHp: 40 }, { kind: 'goto', x: g.x, y: g.y }), { kind: 'goto', ...mid })
    expect(hurt.hp).toBe(14)
  })

  test('reading at the lectern gives a Scroll of Passage, once', async () => {
    const { g, mid } = beside('library')
    const read = apply({ ...g, belt: [null, null, null, null, null] }, { kind: 'goto', ...mid })
    expect(read.belt[4]).toEqual({ kind: 'smoke', tiers: [0, 0, 1] })
    expect(read.log.at(-1)).toBe('You read at the lectern and copy out a Scroll of Passage.')
    const again = apply(apply(read, { kind: 'goto', x: g.x, y: g.y }), { kind: 'goto', ...mid })
    expect(again.belt[4]).toEqual({ kind: 'smoke', tiers: [0, 0, 1] })
  })

  test('braziers and shelves are furnishings: walking past them takes nothing', async () => {
    const { g, mid } = beside('shrine')
    const brazier = { x: mid.x + 2, y: mid.y }
    const after = apply(g, { kind: 'goto', ...brazier })
    expect(after.taken).not.toContain(cellId(brazier))
  })
})

describe('the boss of every fifth depth', () => {
  const atDepth = (depth: number, bossSlain = 0): Game => {
    const g = newGame(4)
    return { ...g, ...arrive(g.world, depth), deepest: depth, bossSlain }
  }

  test('on depth 5 the first try to descend raises its guardian instead: two tiers up, two and a half times the HP', async () => {
    const g = apply(atDepth(5), { kind: 'descend' })
    expect(g.depth).toBe(5)
    // Its attack: (5 + 3 + 4 + 1) times 1.2 is 15.6, rounded to 16; times BOSS_ATK 1.45 is 23.2, rounded up to 24.
    expect(g.foe).toMatchObject({ glyph: 'W', name: 'wraith overlord', hp: 105, maxHp: 105, atk: 24, xp: 108, boss: true })
    expect(g.log.at(-1)).toBe('The wraith overlord (W) rises to bar the way down!')
    expect(apply(g, { kind: 'descend' }).log.at(-1)).toBe('The wraith overlord guards the stairs.')
  })

  test('once it falls the way down is open, and it does not rise again', async () => {
    const met = apply(atDepth(5), { kind: 'descend' })
    const slain = apply({ ...met, foe: { ...met.foe!, hp: 1 } }, { kind: 'attack' })
    expect([slain.foe, slain.bossSlain]).toEqual([null, 5])
    const down = apply(slain, { kind: 'descend' })
    expect([down.depth, down.foe]).toEqual([6, null])
  })

  test('off a boss depth, or with its guardian already slain, the stairs open at once; depth 10 has its own', async () => {
    expect(apply(atDepth(4), { kind: 'descend' }).depth).toBe(5)
    expect(apply(atDepth(5, 5), { kind: 'descend' }).depth).toBe(6)
    const ten = apply(atDepth(10, 5), { kind: 'descend' })
    expect([ten.depth, ten.foe?.boss]).toEqual([10, true])
  })

  test('a boss leaves five times the gold, an Elixir and an item of Rare or better', async () => {
    const met = apply(atDepth(5), { kind: 'descend' })
    const before = { ...met, foe: { ...met.foe!, hp: 1 }, gold: 0, belt: [null, null, null, null, null] }
    const slain = apply(before, { kind: 'attack' })
    expect([25, 50, 75]).toContain(slain.gold)
    expect(slain.belt[0]).toEqual({ kind: 'health', tiers: [0, 0, 1] })
    const found = slain.bag.filter(item => !before.bag.some(b => b.id === item.id))
    expect(found).toHaveLength(1)
    expect(['rare', 'epic', 'legendary']).toContain(found[0]!.rarity)
  })

  test('a task done in town with a guardian waiting: back through the portal to meet it', async () => {
    const town = apply(atDepth(5), { kind: 'portal' })
    const g = apply(town, { kind: 'descend' })
    expect([g.where, g.depth, g.x, g.y, g.foe?.boss]).toEqual(['dungeon', 5, town.portal!.x, town.portal!.y, true])
  })
})

describe('the stash', () => {
  /** In town beside the stash, with a sword and a helm in the bag, the sword selected. */
  const inTown = (): Game => {
    const g = apply(newGame(4), { kind: 'portal' })
    const sword = { ...plainItem(g, 'sword', 'rare'), x: 0, y: 0 }
    const helm = { ...plainItem(g, 'steelHelm'), x: 2, y: 0 }
    return { ...g, bag: [sword, helm], cursor: sword.id }
  }

  test('visiting it opens its panel and says how full it is', async () => {
    const g = apply(inTown(), { kind: 'goto', ...TOWN_SPOTS.stash })
    expect(g.panel).toBe('stash')
    expect(g.log.at(-1)).toBe('Your stash holds 0 of 10 items.')
  })

  test('stores the selected bag item and gives it back, the bag the same as before', async () => {
    const g = inTown()
    const [sword, helm] = g.bag
    const stored = apply(g, { kind: 'store' })
    expect(stored.bag.map(i => i.id)).toEqual([helm!.id])
    expect(stored.stashed.map(i => i.id)).toEqual([sword!.id])
    expect(stored.log.at(-1)).toBe('You store the Short Sword in your stash.')
    const back = apply(stored, { kind: 'retrieve', id: sword!.id })
    expect(back.stashed).toEqual([])
    expect(back.bag.map(i => i.id).sort()).toEqual([sword!.id, helm!.id].sort())
    expect(back.log.at(-1)).toBe('You take the Short Sword from your stash.')
  })

  test('holds ten items at most; without a selection, or outside town, it stores nothing', async () => {
    const g = inTown()
    const full = { ...g, stashed: Array.from({ length: 10 }, () => plainItem(g, 'boots')) }
    const refused = apply(full, { kind: 'store' })
    expect([refused.bag.length, refused.stashed.length]).toEqual([2, 10])
    expect(refused.log.at(-1)).toBe('Your stash is full: 10 items.')
    expect(apply({ ...g, cursor: null }, { kind: 'store' }).log.at(-1)).toBe('Select an item in your bag to store.')
    const away = apply({ ...newGame(4), cursor: newGame(4).bag[0]?.id ?? null }, { kind: 'store' })
    expect(away.log.at(-1)).toBe('Your stash is in town.')
  })

  test('an item with no room in the bag stays in the stash', async () => {
    const stored = apply(inTown(), { kind: 'store' })
    const swordId = stored.stashed[0]!.id
    // Twelve 2 by 2 boots tile the 8 by 6 bag.
    const full = Array.from({ length: 12 }, (_, i) => ({ ...plainItem(stored, 'boots'), x: (i % 4) * 2, y: Math.floor(i / 4) * 2 }))
    const kept = apply({ ...stored, bag: full }, { kind: 'retrieve', id: swordId })
    expect(kept.stashed.map(i => i.id)).toEqual([swordId])
    expect(kept.bag).toHaveLength(12)
    expect(kept.log.at(-1)).toBe('No room in your bag for the Short Sword.')
  })

  test('stays in town: leaving closes its panel', async () => {
    const open = apply(inTown(), { kind: 'goto', ...TOWN_SPOTS.stash })
    expect(apply(open, { kind: 'portal' }).panel).toBe('none')
  })

  test('a stashed item comes back from a save, and an older save has an empty stash', async () => {
    const stored = apply(inTown(), { kind: 'store' })
    expect(normalize(JSON.parse(JSON.stringify(stored))).stashed).toEqual(stored.stashed)
    const { stashed: _, ...older } = stored
    expect(normalize(older as Game).stashed).toEqual([])
  })
})

describe('class abilities', () => {
  /** A hero of `cls` with a foe two cells ahead: 200 HP, attack 10, no XP. */
  const fight = (cls: 'knight' | 'mage' | 'rogue'): Game => {
    const g = newGame(4, cls)
    return { ...g, foe: foeAhead(g, 2, { hp: 200, maxHp: 200, atk: 10, xp: 0 }) }
  }

  test("the knight's shield turns the first blow of each fight; the next one lands", async () => {
    const g = fight('knight')
    const once = apply(g, { kind: 'outcome', ok: false, what: 'Bash' })
    expect(once.hp).toBe(g.hp)
    expect(once.log.at(-1)).toBe(`Your shield turns the ${g.foe!.name}'s blow.`)
    const twice = apply(once, { kind: 'outcome', ok: false, what: 'Bash' })
    expect(twice.hp).toBeLessThan(g.hp)
    const mage = fight('mage')
    expect(apply(mage, { kind: 'outcome', ok: false, what: 'Bash' }).hp).toBeLessThan(mage.hp)
  })

  test("the rogue's first strike of each fight is a sure critical; the next is not, with no crit chance", async () => {
    const g = { ...fight('rogue'), gear: {}, stats: { ...fight('rogue').stats, focus: 0 } }
    const once = apply(g, { kind: 'attack' })
    expect(once.log.find(l => l.includes(`the ${g.foe!.name} for`))).toMatch(/^You CRITICALLY hit /)
    const twice = apply({ ...once, log: [] }, { kind: 'attack' })
    expect(twice.log.find(l => l.includes(`the ${g.foe!.name} for`))).toMatch(/^You hit /)
    const knight = { ...fight('knight'), gear: {}, stats: { ...fight('knight').stats, focus: 0 } }
    expect(apply(knight, { kind: 'attack' }).log.find(l => l.includes(`the ${knight.foe!.name} for`))).toMatch(/^You hit /)
  })

  test('the mage draws a fifth of max HP from every kill, never past max', async () => {
    const g = fight('mage')
    const hurt = { ...g, hp: g.maxHp - 20, foe: { ...g.foe!, hp: 1 } }
    const slain = apply(hurt, { kind: 'attack' })
    expect(slain.hp).toBe(hurt.hp + Math.ceil(g.maxHp / 5))
    expect(slain.log).toContain(`You draw on the fallen ${g.foe!.name}. +${Math.ceil(g.maxHp / 5)} HP`)
    expect(apply({ ...hurt, hp: g.maxHp }, { kind: 'attack' }).hp).toBe(g.maxHp)
    const knight = fight('knight')
    const knightHurt = { ...knight, hp: knight.maxHp - 20, foe: { ...knight.foe!, hp: 1 } }
    expect(apply(knightHurt, { kind: 'attack' }).hp).toBe(knightHurt.hp)
  })
})

describe('a death on the way to a blow', () => {
  test('a trap that kills the hero charging a foe ends the exchange: no blow lands, no foe follows to depth 1', async () => {
    // A trap with open floor either side along a row: the hero on one side, the foe on the other.
    for (let world = 1; world <= 200; world += 1) {
      const level = generate(world, 3)
      for (let y = 1; y < level.tiles.length - 1; y += 1) for (let x = 1; x < level.tiles[0]!.length - 1; x += 1) {
        const open = (dx: number, dy: number) => level.tiles[y + dy]?.[x + dx] === '.' && floorThing(world, 3, level, { x: x + dx, y: y + dy }) === ' '
        if (floorThing(world, 3, level, { x, y }) !== '^' || !open(-1, 0) || !open(1, 0) || open(0, -1) || open(0, 1)) continue
        const g = { ...newGame(world), world, depth: 3, x: x - 1, y, hp: 1, taken: [], foe: { glyph: 'g', name: 'goblin of x', hp: 99, maxHp: 99, atk: 1, xp: 0, x: x + 1, y } }
        const after = apply(g, { kind: 'outcome', ok: true, what: 'Edit' })
        expect(after.log.some(l => l.startsWith('You were slain by a trap'))).toBe(true)
        expect([after.depth, after.foe]).toEqual([1, null])
        expect(after.log.some(l => l.startsWith('You hit the goblin'))).toBe(false)
        return
      }
    }
    throw new Error('no trap in a corridor')
  })
})

describe("the elder's quests", () => {
  /** In town next to the elder, `deepest` reached, with the quest given. */
  const atElder = (over: Partial<Game> = {}): Game => {
    const g = apply({ ...newGame(4), deepest: 6 }, { kind: 'portal' })
    return { ...g, ...over }
  }
  const visit = (g: Game) => apply(g, { kind: 'goto', ...TOWN_SPOTS.elder })

  test('with no quest the elder gives one of three: slay 8 at your deepest, a champion at your deepest, or 3 depths further', async () => {
    const seen = new Map<string, Game['quest']>()
    for (let seed = 1; seed <= 40 && seen.size < 3; seed += 1) {
      const g = visit(atElder({ seed }))
      if (g.quest !== null) seen.set(g.quest.kind, g.quest)
    }
    expect(seen.get('slay')).toEqual({ kind: 'slay', depth: 6, need: 8, have: 0 })
    expect(seen.get('champion')).toEqual({ kind: 'champion', depth: 6, need: 1, have: 0 })
    expect(seen.get('depth')).toEqual({ kind: 'depth', depth: 9, need: 1, have: 0 })
  })

  test('says how a quest stands', async () => {
    expect(visit(atElder({ quest: { kind: 'slay', depth: 6, need: 8, have: 3 } })).log.at(-1)).toBe('The elder: "3 of 8 slain on depth 6 or deeper. Keep at it."')
    expect(visit(atElder({ quest: { kind: 'depth', depth: 9, need: 1, have: 0 } })).log.at(-1)).toBe('The elder: "Depth 9 is still ahead of you."')
    expect(visit(atElder({ quest: { kind: 'champion', depth: 6, need: 1, have: 0 } })).log.at(-1)).toBe('The elder: "No champion slain on depth 6 or deeper yet."')
  })

  test('kills count on the quest depth or deeper, and the last one says to go back', async () => {
    const g = newGame(4)
    const fight = (depth: number, champion?: 'tough') => ({ ...g, depth, deepest: 9, quest: { kind: 'slay' as const, depth: 6, need: 8, have: 7 }, foe: { ...foeAhead(g, 1, { hp: 1, maxHp: 1, xp: 0 }), ...(champion ? { champion } : {}) } })
    expect(apply(fight(5), { kind: 'attack' }).quest?.have).toBe(7)
    const done = apply(fight(6), { kind: 'attack' })
    expect(done.quest?.have).toBe(8)
    expect(apply({ ...fight(6), quest: { kind: 'slay' as const, depth: 6, need: 8, have: 8 } }, { kind: 'attack' }).quest?.have).toBe(8)
    expect(done.log).toContain('Quest done: go back to the elder in town.')
    const champ = { ...fight(7, 'tough'), quest: { kind: 'champion' as const, depth: 6, need: 1, have: 0 } }
    expect(apply(champ, { kind: 'attack' }).quest?.have).toBe(1)
    expect(apply({ ...champ, foe: { ...champ.foe, champion: undefined } }, { kind: 'attack' }).quest?.have).toBe(0)
  })

  test('reaching the depth fulfils a descend quest', async () => {
    const g = { ...newGame(4), depth: 8, deepest: 8, quest: { kind: 'depth' as const, depth: 9, need: 1, have: 0 } }
    const down = apply(g, { kind: 'descend' })
    expect([down.depth, down.quest?.have]).toEqual([9, 1])
    expect(down.log).toContain('Quest done: go back to the elder in town.')
  })

  test('a quest done pays 15 gold a depth and 30 more, and an item of Uncommon or better; then the elder has a new one', async () => {
    const g = atElder({ gold: 0, quest: { kind: 'slay', depth: 6, need: 8, have: 8 }, bag: [] })
    const paid = visit(g)
    expect(paid.gold).toBe(120)
    expect(paid.bag).toHaveLength(1)
    expect(['uncommon', 'rare', 'epic', 'legendary']).toContain(paid.bag[0]!.rarity)
    expect(paid.log.at(-1)).toBe(`The elder pays you 120 gold and a ${paid.bag[0]!.name} for your trouble.`)
    expect([paid.quest, paid.questsDone]).toEqual([null, 1])
    expect(visit(paid).quest).not.toBeNull()
  })

  test('the reward is never Common, over many seeds', async () => {
    const rarities = new Set(Array.from({ length: 40 }, (_, seed) => visit(atElder({ seed, quest: { kind: 'slay', depth: 6, need: 8, have: 8 }, bag: [] })).bag[0]?.rarity))
    expect(rarities.has('common')).toBe(false)
    expect(rarities.has('uncommon')).toBe(true)
  })

  test('with no room in the bag for the reward the elder waits', async () => {
    const g = atElder({ gold: 0, quest: { kind: 'slay', depth: 6, need: 8, have: 8 } })
    const full = Array.from({ length: 12 }, (_, i) => ({ ...plainItem(g, 'boots'), x: (i % 4) * 2, y: Math.floor(i / 4) * 2 }))
    const waited = visit({ ...g, bag: full })
    expect([waited.gold, waited.quest?.have, waited.bag.length]).toEqual([0, 8, 12])
    expect(waited.log.at(-1)).toBe('The elder: "Make room in your bag for your reward."')
  })

  test('a quest comes back from a save; an older save has none', async () => {
    const g = visit(atElder())
    expect(normalize(JSON.parse(JSON.stringify(g))).quest).toEqual(g.quest)
    const { quest: _q, questsDone: _d, ...older } = g
    expect(normalize(older as Game).quest).toBeNull()
  })
})

describe("the mystic's fortunes", () => {
  const atMystic = (over: Partial<Game> = {}): Game => ({ ...apply({ ...newGame(4), deepest: 6 }, { kind: 'portal' }), gold: 500, ...over })
  const visit = (g: Game) => apply(apply(g, { kind: 'goto', ...TOWN_SPOTS.mystic }), { kind: 'fortune' })

  test('a fortune costs 20 gold and 10 a depth reached, and is one of luck, riches and insight', async () => {
    const seen = new Set<string>()
    for (let seed = 1; seed <= 40 && seen.size < 3; seed += 1) {
      const g = visit(atMystic({ seed }))
      expect(g.gold).toBe(500 - 80)
      expect(g.fortune?.depth).toBe(g.depth)
      seen.add(g.fortune!.kind)
    }
    expect([...seen].sort()).toEqual(['insight', 'luck', 'riches'])
  })

  test('says it, and holds while it lasts; without the gold there is none', async () => {
    const g = visit(atMystic({ seed: 1 }))
    expect(g.log.at(-1)).toMatch(/^The mystic reads your fortune for 80 gold: (Luck|Riches|Insight)\. .+ until you change depth\.$/)
    const again = visit(g)
    expect([again.gold, again.fortune]).toEqual([g.gold, g.fortune])
    // Said on the visit and again by the button: once in the log, counted twice.
    expect(again.log.at(-1)).toBe('The mystic: "Your fortune holds until you change depth." (x2)')
    const poor = visit(atMystic({ gold: 79 }))
    expect([poor.gold, poor.fortune]).toEqual([79, null])
    expect(poor.log.at(-1)).toBe('The mystic: "A fortune costs 80 gold."')
  })

  test('luck adds 15 points of crit chance, riches half again the gold of a kill, insight half again its XP', async () => {
    const g = { ...plainHero(), depth: 3 }
    const fortune = (kind: 'luck' | 'riches' | 'insight') => ({ kind, depth: 3 })
    expect(critChance({ ...g, fortune: fortune('luck') }) - critChance(g)).toBe(15)
    expect(xpGain({ ...g, fortune: fortune('insight') }, 20)).toBe(Math.floor(xpGain(g, 20) * 1.5))
    const kill = (over: Partial<Game>) => apply({ ...g, ...over, foe: foeAhead(g, 1, { hp: 1, maxHp: 1, xp: 0 }) }, { kind: 'attack' })
    const plain = kill({})
    const rich = kill({ fortune: fortune('riches') })
    expect(rich.gold - g.gold).toBe(Math.floor((plain.gold - g.gold) * 1.5))
  })

  test('a change of depth ends it: going down, or dying; the portal does not', async () => {
    const f = { kind: 'luck' as const, depth: 3 }
    const g = { ...newGame(4), depth: 3, deepest: 3, fortune: f }
    expect(apply(g, { kind: 'descend' }).fortune).toBeNull()
    expect(apply({ ...g, hp: 1, foe: foeAhead(g, 1, { atk: 50, opened: true }) }, { kind: 'outcome', ok: false, what: 'Bash' }).fortune).toBeNull()
    expect(apply(apply(g, { kind: 'portal' }), { kind: 'portal' }).fortune).toEqual(f)
  })
})

describe('the pacing: tension, a peak, a calm', () => {
  // Its unique already slain: depth 3 may be where the band's waits.
  const hero = (over: Partial<Game> = {}): Game => ({ ...plainHero(4), depth: 3, deepest: 3, uniquesSlain: [0], ...over })

  test('a blow adds its share of max HP to the tension, in percent; a kill adds 4', async () => {
    const g = hero({ maxHp: 40, hp: 40, tension: 10 })
    // A rat whose 10 lands whole on a hero with no defense from the plain kit, ward or shield: 25% of 40.
    const hit = apply({ ...g, cls: 'mage', gear: {}, foe: foeAhead(g, 1, { glyph: 'r', atk: 10, opened: true }) }, { kind: 'outcome', ok: false, what: 'Bash' })
    expect(hit.hp).toBe(30)
    expect(hit.tension).toBe(35)
    // An orc: no dodge, so the blow lands.
    const kill = apply({ ...g, foe: foeAhead(g, 1, { hp: 1, maxHp: 1, glyph: 'o' }) }, { kind: 'attack' })
    expect(kill.foe).toBeNull()
    expect(kill.tension).toBe(14)
  })

  test('at the peak the next foe is a champion, announced; the tension starts over and a calm waits behind it', async () => {
    const g = apply(hero({ tension: 100, hp: 30, maxHp: 40 }), { kind: 'summon', name: 'ls' })
    expect(g.foe?.champion).toBeDefined()
    expect([g.tension, g.calm, g.toast]).toEqual([0, 2, 'Something strong is near.'])
    expect(g.log).toContain('The air grows heavy. Something strong is near.')
  })

  test('no peak for a hero under 60% of max HP, nor on depth 1: a plain foe, the tension kept', async () => {
    const low = apply(hero({ tension: 120, hp: 23, maxHp: 40 }), { kind: 'summon', name: 'ls' })
    expect([low.calm, low.tension]).toEqual([0, 120])
    const first = apply(hero({ depth: 1, deepest: 1, tension: 120, hp: 40, maxHp: 40 }), { kind: 'summon', name: 'ls' })
    expect([first.calm, first.tension]).toEqual([0, 120])
  })

  test('the calm: its summons bring no foe, each gives back a tenth of max HP; then foes come again', async () => {
    const one = apply(hero({ calm: 2, hp: 10, maxHp: 40 }), { kind: 'summon', name: 'ls' })
    expect([one.foe, one.calm, one.hp]).toEqual([null, 1, 14])
    expect(one.log.slice(-2)).toEqual(['The dungeon falls quiet.', 'You catch your breath. +4 HP'])
    const two = apply(one, { kind: 'summon', name: 'ls' })
    expect([two.foe, two.calm, two.hp]).toEqual([null, 0, 18])
    expect(apply(two, { kind: 'summon', name: 'ls' }).foe).not.toBeNull()
  })

  test('a death lets the pressure go: no tension, no calm', async () => {
    const g = hero({ hp: 1, tension: 80, calm: 1 })
    const dead = apply({ ...g, foe: foeAhead(g, 1, { glyph: 'r', atk: 50, opened: true }) }, { kind: 'outcome', ok: false, what: 'Bash' })
    expect(dead.deaths).toBe(1)
    expect([dead.tension, dead.calm]).toEqual([0, 0])
  })
})

describe('where a foe appears', () => {
  test('with nowhere open in sight it stands on the hero\'s place, and carries nothing of the game but that', async () => {
    // A hero in rock on a depth they never arrived on: no route, nothing open in sight.
    const g = { ...plainHero(4), world: 4, depth: 41, deepest: 41, x: 0, y: 0 }
    const foe = apply(g, { kind: 'summon', name: 'ls' }).foe!
    expect(Object.keys(foe).sort()).toEqual(['atk', 'glyph', 'hp', 'maxHp', 'name', 'x', 'xp', 'y', ...(foe.champion === undefined ? [] : ['champion'])].sort())
    expect(foe.maxHp).toBeGreaterThan(100)
  })
})

describe('which foes a depth holds', () => {
  test('any kind unlocked so far, up to two tiers past the depth; the theme\'s favorites three times, the newest three twice', async () => {
    // Depth 1, the crypt: rat, goblin, kobold, all among the newest; the rat a crypt favorite.
    expect(foeTierWeights(1)).toEqual([6, 2, 2])
    // Depth 12, the forge: every kind; goblin, orc and dragon favored, troll, wraith and dragon the newest.
    expect(foeTierWeights(12)).toEqual([1, 3, 1, 3, 1, 2, 2, 6])
    // Depth 7, the flooded halls: up to the dragon; kobold, rat and troll favored.
    expect(foeTierWeights(7)).toEqual([3, 1, 3, 1, 1, 6, 2, 2])
  })

  test('deep down the foes are of many kinds, not all the deepest one', async () => {
    // The band's unique slain: on its depth it would come first, every time.
    let g = { ...plainHero(9), depth: 14, deepest: 14, uniquesSlain: [2] }
    const kinds = new Set<string>()
    for (let i = 0; i < 200; i += 1) {
      g = apply({ ...g, foe: null }, { kind: 'summon', name: 'ls' })
      kinds.add(g.foe!.glyph)
    }
    expect(kinds.size).toBeGreaterThanOrEqual(6)
  })
})

describe('the townsfolk windows', () => {
  const inTown = (over: Partial<Game> = {}): Game => ({ ...apply({ ...newGame(4), deepest: 6 }, { kind: 'portal' }), gold: 500, ...over })
  const visit = (g: Game, spot: keyof typeof TOWN_SPOTS) => apply(g, { kind: 'goto', ...TOWN_SPOTS[spot] })

  test('each of the townsfolk opens a window of their own when visited', async () => {
    for (const who of ['healer', 'elder', 'mystic', 'guard', 'villager', 'dog'] as const) expect(visit(inTown(), who).panel).toBe(who)
  })

  test('the mystic no longer reads a fortune for a visit: the window offers one, and its button reads it', async () => {
    const opened = visit(inTown({ seed: 1 }), 'mystic')
    expect([opened.gold, opened.fortune]).toEqual([500, null])
    expect(opened.log.at(-1)).toBe('The mystic gazes into the crystal. "A fortune costs 80 gold."')
    const read = apply(opened, { kind: 'fortune' })
    expect(read.gold).toBe(420)
    expect(read.fortune?.depth).toBe(read.depth)
    expect(read.log.at(-1)).toMatch(/^The mystic reads your fortune for 80 gold: (Luck|Riches|Insight)\. .+ until you change depth\.$/)
    expect(apply(read, { kind: 'fortune' }).log.at(-1)).toBe('The mystic: "Your fortune holds until you change depth."')
    expect(apply({ ...opened, gold: 79 }, { kind: 'fortune' }).log.at(-1)).toBe('The mystic: "A fortune costs 80 gold."')
    expect(apply({ ...newGame(4), gold: 500 }, { kind: 'fortune' }).log.at(-1)).toBe('The mystic is in town.')
  })

  test('the healer remembers what the visit mended: all the HP missing, none for an unhurt hero', async () => {
    const hurt = visit(inTown({ hp: 10, maxHp: 42 }), 'healer')
    expect([hurt.hp, hurt.mended]).toEqual([42, 32])
    expect(visit(hurt, 'healer').mended).toBe(0)
    expect(apply(hurt, { kind: 'portal' }).mended).toBe(0)
  })

  test('the dog, petted, counts it; in the dungeon there is no dog to pet', async () => {
    const once = apply(visit(inTown(), 'dog'), { kind: 'pet' })
    expect(once.petted).toBe(1)
    expect(once.log.at(-1)).toBe('The dog wags its tail and leans into your hand.')
    expect(apply(once, { kind: 'pet' }).petted).toBe(2)
    const below = apply({ ...newGame(4), petted: 3 }, { kind: 'pet' })
    expect([below.petted, below.log.at(-1)]).toEqual([3, 'The dog is in town.'])
  })

  test('a quest done but unpaid for want of bag room is paid by Claim once there is room; in the dungeon Claim says where the elder is', async () => {
    const done = { kind: 'slay' as const, depth: 6, need: 8, have: 8 }
    const g = inTown({ quest: done, gold: 0 })
    const ring = { ...plainItem(g, 'ring', 'common'), w: 8, h: 6, x: 0, y: 0 }
    const full = apply({ ...g, bag: [ring] }, { kind: 'claim' })
    expect([full.quest, full.gold, full.log.at(-1)]).toEqual([done, 0, 'The elder: "Make room in your bag for your reward."'])
    const paid = apply({ ...full, bag: [] }, { kind: 'claim' })
    // 15 a depth of the quest and 30: 6 deep pays 120.
    expect([paid.quest, paid.gold, paid.questsDone, paid.bag.length]).toEqual([null, 120, 1, 1])
    expect(apply({ ...newGame(4), quest: done }, { kind: 'claim' }).log.at(-1)).toBe('The elder is in town.')
  })

  test('leaving town closes any of their windows', async () => {
    for (const who of ['healer', 'elder', 'mystic', 'guard', 'villager', 'dog'] as const) expect(apply(visit(inTown(), who), { kind: 'portal' }).panel).toBe('none')
  })
})

describe('the classes described', () => {
  test('each line says the ability, the stat lean and the starting kit', async () => {
    expect(classAbout('knight')).toBe("Knight: Shield block, a foe's first blow each fight glances off. +2 Might, +1 Vigor. Short Sword, Buckler, Tunic, Hood.")
    expect(classAbout('mage')).toBe('Mage: Siphon, each kill restores a fifth of max HP. +3 Insight, +1 Focus. Ash Staff, Tome of Sparks, Robe, Pointed Hat.')
    expect(classAbout('rogue')).toBe('Rogue: Ambush, the first strike of each fight is a sure critical. +3 Focus, +1 Might, +1 Vigor. Dagger, Parrying Dagger, Leather Coat, Cowl.')
  })
})

describe('the spring and the old anvil in play', () => {
  const beside = (kind: 'spring' | 'anvil') => {
    for (let world = 1; world <= 200; world += 1) for (const depth of [7, 12]) {
      const level = generate(world, depth)
      const themed = themedRoomOf(world, depth, level)
      if (themed?.kind !== kind) continue
      const r = themed.room
      const mid = { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) }
      const next = { x: mid.x, y: mid.y + 1 < r.y + r.h ? mid.y + 1 : mid.y - 1 }
      return { g: normalize({ ...newGame(world), world, depth, deepest: depth, ...next, seen: '1'.repeat(64 * 18), taken: [], foe: null }), mid }
    }
    throw new Error(`no ${kind}`)
  }

  test('drinking from the spring restores all HP, once; unhurt, the hero passes it by', async () => {
    const { g, mid } = beside('spring')
    const passed = apply(g, { kind: 'goto', ...mid })
    expect(passed.taken).not.toContain(cellId(mid))
    const back = apply(passed, { kind: 'goto', x: g.x, y: g.y })
    const drank = apply({ ...back, hp: 3 }, { kind: 'goto', ...mid })
    expect(drank.hp).toBe(drank.maxHp)
    expect(drank.log.at(-1)).toBe('You drink from the spring. HP full.')
    const again = apply(apply({ ...drank, hp: 3 }, { kind: 'goto', x: g.x, y: g.y }), { kind: 'goto', ...mid })
    expect(again.hp).toBe(3)
  })

  test('the old anvil tempers the worn weapon once, for nothing; with nothing to temper it waits', async () => {
    const { g, mid } = beside('anvil')
    const weapon = g.gear.weapon!
    const done = apply({ ...g, gold: 0 }, { kind: 'goto', ...mid })
    expect([done.gear.weapon!.atk, done.gear.weapon!.temper, done.gold]).toEqual([weapon.atk + 1, 1, 0])
    expect(done.log.at(-1)).toBe(`The old anvil still rings: your ${weapon.name} is tempered, +1 attack.`)
    const full = { ...g, gear: { ...g.gear, weapon: { ...weapon, temper: 3 } } }
    const waited = apply(full, { kind: 'goto', ...mid })
    expect(waited.taken).not.toContain(cellId(mid))
    expect(waited.gear.weapon!.atk).toBe(weapon.atk)
  })
})

describe('a walk tile by tile', () => {
  // On depth 1 of world 1, the row y 4 holds gold at x 50 and a potion at x 51.
  const g = { ...newGame(), seen: '1'.repeat(64 * 18), x: 48, y: 4 }
  const action = { kind: 'goto' as const, x: 55, y: 4 }
  const plan = apply(g, action)
  const healing = (s: Game) => countOf(s.belt[0])

  test('each tile holds the game as it stands when the hero reaches it: the gold on the second, the potion on the third', async () => {
    const tiles = alongTheWay(g, plan)!
    expect(tiles.map(t => [t.x, t.y])).toEqual(plan.walked.map(p => [p.x, p.y]))
    expect(tiles.map(t => t.gold > g.gold)).toEqual([false, true, true, true, true, true, true])
    expect(tiles.map(t => healing(t) > healing(g))).toEqual([false, false, true, true, true, true, true])
    expect(tiles[1]!.log.at(-1)).toMatch(/^You pick up \d+ gold\.$/)
    expect({ gold: tiles.at(-1)!.gold, hp: tiles.at(-1)!.hp, belt: tiles.at(-1)!.belt }).toEqual({ gold: plan.gold, hp: plan.hp, belt: plan.belt })
  })

  test('a walk in town only moves the hero tile by tile: nothing lies on its streets, and the dungeon under the same cells is not there', async () => {
    const town = apply(newGame(1), { kind: 'portal' })
    const plan = apply(town, { kind: 'goto', ...TOWN_SPOTS.healer })
    const tiles = alongTheWay(town, plan)!
    expect(tiles.map(t => [t.x, t.y])).toEqual(plan.walked.map(p => [p.x, p.y]))
    for (const t of tiles.slice(0, -1)) expect([t.taken, t.hp, t.gold, t.log, t.where]).toEqual([town.taken, town.hp, town.gold, town.log, 'town'])
    expect(tiles.at(-1)).toBe(plan)
  })

  test('a walk of one tile is that tile, the action\'s end', async () => {
    const plan = apply(g, { kind: 'goto', x: 49, y: 4 })
    expect(plan.walked).toHaveLength(1)
    expect(alongTheWay(g, plan)).toEqual([plan])
  })

  test('a walk that cannot be cut into tiles the same way (a foe in the way) has none', async () => {
    const blocked = { ...g, foe: { glyph: 'r', name: 'rat', hp: 5, maxHp: 5, atk: 1, xp: 1, x: 52, y: 3 } }
    const p = apply(blocked, action)
    const tiles = alongTheWay(blocked, p)
    expect(tiles === null || tiles.every((t, i) => t.x === p.walked[i]!.x && t.y === p.walked[i]!.y)).toBe(true)
  })
})

describe('a walk cut where the hero stands', () => {
  // On depth 1 of world 1, the row y 4 holds gold at x 50 and a potion at x 51.
  const g = { ...newGame(), seen: '1'.repeat(64 * 18), x: 48, y: 4 }
  const plan = apply(g, { kind: 'goto', x: 55, y: 4 })
  const healing = (s: Game) => countOf(s.belt[0])

  test('walking the first tiles of a walk takes up only what lies on them', async () => {
    const cut = apply(g, { kind: 'trail', path: plan.walked.slice(0, 2) })
    expect([cut.x, cut.y]).toEqual([50, 4])
    expect(cut.gold).toBeGreaterThan(g.gold)
    expect(healing(cut)).toBe(healing(g))
    expect(cut.walked).toEqual(plan.walked.slice(0, 2))
  })

  test('the tiles walked hold the same game as the walk had there', async () => {
    const tiles = alongTheWay(g, plan)!
    for (const k of [1, 2, 3]) {
      const cut = apply(g, { kind: 'trail', path: plan.walked.slice(0, k) })
      expect({ x: cut.x, y: cut.y, gold: cut.gold, taken: cut.taken, belt: cut.belt, seen: cut.seen }).toEqual({ x: tiles[k - 1]!.x, y: tiles[k - 1]!.y, gold: tiles[k - 1]!.gold, taken: tiles[k - 1]!.taken, belt: tiles[k - 1]!.belt, seen: tiles[k - 1]!.seen })
    }
  })

  test('a trap that slays the hero on the way ends it: he wakes at the entrance and walks no further', async () => {
    // On depth 1 of world 1 a trap lies at x 40 of row y 13.
    const hurt = { ...newGame(), seen: '1'.repeat(64 * 18), x: 38, y: 13, hp: 2 }
    const cut = apply(hurt, { kind: 'trail', path: [{ x: 39, y: 13 }, { x: 40, y: 13 }, { x: 41, y: 13 }, { x: 42, y: 13 }] })
    expect(cut.deaths).toBe(1)
    expect({ x: cut.x, y: cut.y }).toEqual(generate(cut.world, 1).start)
  })

  test('in town it only moves the hero', async () => {
    const town = apply(newGame(1), { kind: 'portal' })
    const walk = apply(town, { kind: 'goto', ...TOWN_SPOTS.healer })
    const cut = apply(town, { kind: 'trail', path: walk.walked.slice(0, 2) })
    expect([cut.x, cut.y, cut.where]).toEqual([walk.walked[1]!.x, walk.walked[1]!.y, 'town'])
    expect([cut.taken, cut.hp, cut.gold, cut.panel]).toEqual([town.taken, town.hp, town.gold, town.panel])
  })
})

describe('which walks are only walks', () => {
  const g = { ...newGame(), seen: '1'.repeat(64 * 18), x: 48, y: 4 }

  test('a walk over floor, picking up on the way, is only a walk', async () => {
    expect(isOnlyAWalk(g, apply(g, { kind: 'goto', x: 55, y: 4 }))).toBe(true)
  })
  test('a walk up to a foe and a blow is more', async () => {
    const foe = { glyph: 'r', name: 'rat', hp: 50, maxHp: 50, atk: 1, xp: 1, x: 53, y: 4, opened: true as const }
    const at = { ...g, foe }
    expect(isOnlyAWalk(at, apply(at, { kind: 'goto', x: 53, y: 4 }))).toBe(false)
  })
  test('a walk up to the healer and a visit is more', async () => {
    const town = apply(newGame(1), { kind: 'portal' })
    expect(isOnlyAWalk(town, apply(town, { kind: 'goto', ...TOWN_SPOTS.healer }))).toBe(false)
    expect(isOnlyAWalk(town, apply(town, { kind: 'goto', x: TOWN_SPOTS.portal.x - 2, y: TOWN_SPOTS.portal.y - 1 }))).toBe(true)
  })
})
