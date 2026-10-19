import { describe, expect, test } from 'claude-code/testing'

import type { Game } from '../types'
import { alongTheWay, apply, levelOf, newGame } from './game'
import { foeAhead } from './fixtures'
import { arrive } from './world'
import { MAP_H, MAP_W, cellId, floorThing, generate, isFloor, roomAt, same, themedRoomOf, visibleFrom } from './map'
import { CANVAS, INK } from './palette'
import { GROUND, MONSTER_ART, NPC_ART, PAL, PX, TERRAIN, THING_ART, TOWN_BIG_ART, TOWN_TERRAIN, TOWN_THING_ART, TREE_ALT, heroArt, torch } from './pixelart'
import { TOWN_DECOR, TOWN_H, TOWN_SPOTS, TOWN_W } from './town'
import { TOWN_PX_W, townImage } from './townpixels'
import { DECAL_ART, FRAMES_PER_TILE, lightStep, pixelMap, stampCells, stampOf, walkState, hitFramesFor, hitFreeze, isStrideFrame, strideOf, wallTorchesOf, HIT_FRAMES, decalAt, themeOf, themed, benchRoute, hitColor, hitRise, hitsBetween, clickToTile, deadZone, followCamera, tileCamera, frameOf, torchColor, wallFaceLight, hexToInt, originAt, rasterCells, viewOrigin, walkPosition, walkingGame, windowOrigin, worldSize } from './pixels'

const W = 96
const H = 72
const at = (frame: Uint32Array, x: number, y: number) => frame[y * W + x] ?? -1
const screen = (g: Game, wx: number, wy: number) => {
  const o = viewOrigin(g, W, H)
  return { x: wx - o.x, y: wy - o.y }
}
const rgb = (n: number) => [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff] as const
const luma = (n: number) => {
  const [r, g, b] = rgb(n)
  return 0.299 * r + 0.587 * g + 0.114 * b
}

describe('the window', () => {
  test('centers on the hero, clamps to the map, and centers a map smaller than the window', async () => {
    expect(windowOrigin(400, 100, 768)).toBe(350)
    expect(windowOrigin(10, 100, 768)).toBe(0)
    expect(windowOrigin(760, 100, 768)).toBe(668)
    expect(windowOrigin(30, 100, 60)).toBe(-20)
  })
})

describe('the frame', () => {
  test('is width by height pixels', async () => {
    expect(frameOf(newGame(), W, H).length).toBe(W * H)
  })

  test('draws the hero art pixel for pixel on its cell, torchlight off', async () => {
    const g = newGame(21)
    const art = heroArt(g)
    const o = screen(g, g.x * PX, g.y * PX)
    const frame = frameOf(g, W, H, { isLit: false })
    art.forEach((row, y) => {
      ;[...row].forEach((key, x) => {
        if (key !== '.') expect(at(frame, o.x + x, o.y + y)).toBe(hexToInt(PAL[key] ?? ''))
      })
    })
  })

  test('leaves unseen cells as the bare canvas', async () => {
    const g = newGame(21)
    const frame = frameOf(g, W, H)
    const o = viewOrigin(g, W, H)
    for (let y = 0; y < H; y += 6) {
      for (let x = 0; x < W; x += 6) {
        const cell = Math.floor((o.y + y) / PX) * MAP_W + Math.floor((o.x + x) / PX)
        if (g.seen[cell] === '0') expect(at(frame, x, y)).toBe(hexToInt(CANVAS))
      }
    }
  })

  test('paints remembered ground in cold blue', async () => {
    const g: Game = { ...newGame(21), seen: '1'.repeat(64 * 18) }
    const level = levelOf(g)
    const inSight = new Set(visibleFrom(level, g).map(p => `${p.x},${p.y}`))
    // A bare floor cell in the frame but out of the hero's sight.
    const view = viewOrigin(g, W, H)
    const cell = level.tiles.flatMap((row, y) => [...row].map((t, x) => ({ t, x, y }))).find(
      c => c.t === '.' && !inSight.has(`${c.x},${c.y}`) && floorThing(g.world, g.depth, level, c) === ' ' && c.x * PX >= view.x && c.y * PX >= view.y && c.x * PX + PX <= view.x + W && c.y * PX + PX <= view.y + H,
    )!
    const frame = frameOf(g, W, H)
    const o = screen(g, cell.x * PX + 4, cell.y * PX + 4)
    expect(o.x >= 0 && o.x < W && o.y >= 0 && o.y < H).toBe(true)
    const [r, gr, b] = rgb(at(frame, o.x, o.y))
    expect(b).toBeGreaterThan(r)
    expect(b).toBeGreaterThan(gr)
  })

  test('draws a foe out of sight as a flat sensed shape', async () => {
    const g = newGame(21)
    const foe = foeAhead(g, 30)
    const frame = frameOf({ ...g, foe }, MAP_W * PX, 18 * PX)
    const wide = (x: number, y: number) => frame[y * MAP_W * PX + x] ?? -1
    const ox = viewOrigin(g, MAP_W * PX, 18 * PX)
    const pixels = [...Array(PX * PX).keys()].map(i => wide(foe.x * PX - ox.x + (i % PX), foe.y * PX - ox.y + Math.floor(i / PX)))
    expect(pixels).toContain(hexToInt(INK.sensed))
  })

  test('lights floor near the torch brighter than floor across the room', async () => {
    const g = newGame(21)
    const room = roomAt(generate(21, 1), g)
    if (room === undefined) throw new Error('the start lies in a room')
    const frame = frameOf(g, W, H)
    const bare = frameOf(g, W, H, { isLit: false })
    const near = screen(g, (g.x + 1) * PX + 6, g.y * PX + 6)
    const far = screen(g, room.x * PX + 6, g.y * PX + 6)
    // Each pixel's light against its own unlit ground, so the slab's pattern does not decide.
    const lit = (p: { x: number; y: number }) => luma(at(frame, p.x, p.y)) / luma(at(bare, p.x, p.y))
    expect(lit(near)).toBeGreaterThan(lit(far))
  })

  test('a creature casts a shadow on the ground under it', async () => {
    const g = newGame(21)
    const away = { ...g, x: g.x + 1 }
    const groundPixel = (game: Game) => {
      const o = screen(game, g.x * PX + 1, g.y * PX + PX - 1)
      return at(frameOf(game, W, H, { isLit: false }), o.x, o.y)
    }
    expect(heroArt(g)[PX - 1]?.[1]).toBe('.')
    expect(luma(groundPixel(g))).toBeLessThan(luma(groundPixel(away)))
  })
})

test('every theme\'s floor is its own, whatever themes were drawn over the same cells before it', async () => {
  // A depth of each theme, world 5. Before one is checked, every other is drawn with its hero on the same cell, so the
  // same cells pass through the ground's cache under each theme. Torchlight off, a plain floor cell in the hero's room,
  // with nothing on it and floor on all four sides (so no wall shades it), is then its theme's floor (`GROUND`).
  const depths = [2, 7, 12, 17, 22]
  expect(depths.map(d => themeOf(d))).toEqual(['crypt', 'flooded', 'fungal', 'frozen', 'forge'])
  const at5 = (depth: number): Game => {
    const g0 = newGame(5, 'knight')
    return { ...g0, ...arrive(g0.world, depth), depth, deepest: depth }
  }
  for (const depth of depths) {
    const g = at5(depth)
    for (const other of depths) if (other !== depth) frameOf({ ...at5(other), x: g.x, y: g.y, seen: '1'.repeat(g.seen.length) }, W, H, { isLit: false })
    const level = levelOf(g)
    const frame = frameOf(g, W, H, { isLit: false })
    const plain = visibleFrom(level, g).filter(p => roomAt(level, p) !== undefined && (p.x !== g.x || p.y !== g.y) && floorThing(g.world, depth, level, p) === ' ' && decalAt(g.world, depth, level, p) === undefined && [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => isFloor(level.tiles, { x: p.x + dx!, y: p.y + dy! })))
    const inView = plain.filter(p => { const o = screen(g, p.x * PX, p.y * PX); return o.x >= 0 && o.y >= 0 && o.x + PX <= W && o.y + PX <= H })
    expect(inView.length).toBeGreaterThan(0)
    for (const p of inView) {
      const o = screen(g, p.x * PX, p.y * PX)
      for (const [lx, ly] of [[2, 3], [5, 5]] as const) expect(at(frame, o.x + lx, o.y + ly)).toBe(hexToInt(GROUND[themeOf(depth)].floor(p.x * PX + lx, p.y * PX + ly)))
    }
  }
})

describe('raster cells', () => {
  const unpack = (cells: string) => new Uint32Array(Uint8Array.from(atob(cells), c => c.charCodeAt(0)).buffer)

  test('a cell with two different pixels is an upper half block, the top as ink and the bottom as paper', async () => {
    const words = unpack(rasterCells(Uint32Array.of(0x102030, 0xa0b0c0), 1, 1))
    expect([...words]).toEqual([0x2580, 0x102030, 0xa0b0c0])
  })

  test('a cell whose pixels are within 8 on every channel is a space on the bottom color, its unseen ink the left cell\'s', async () => {
    // One row of four cells, worked by hand: the top pixels first, then the bottom ones.
    const frame = Uint32Array.of(0x102030, 0x405060, 0x405060, 0x000000, 0xa0b0c0, 0x405068, 0x405069, 0x000000)
    const words = unpack(rasterCells(frame, 4, 1))
    expect([...words]).toEqual([
      0x2580, 0x102030, 0xa0b0c0,
      // 8 apart in blue: flat; the ink is the half block's to its left, so the host has no color to change.
      0x20, 0x102030, 0x405068,
      // 9 apart: two pixels.
      0x2580, 0x405060, 0x405069,
      0x20, 0x405060, 0x000000,
    ])
  })

  test('a run of flat cells keeps the ink of the half block before it, so the host writes no foreground across the run', async () => {
    const frame = Uint32Array.of(0x102030, 0x505050, 0x606060, 0xa0b0c0, 0x505050, 0x606060)
    const words = unpack(rasterCells(frame, 3, 1))
    expect([...words]).toEqual([0x2580, 0x102030, 0xa0b0c0, 0x20, 0x102030, 0x505050, 0x20, 0x102030, 0x606060])
  })

  test('a flat cell first in its row takes its own color as ink', async () => {
    expect([...unpack(rasterCells(Uint32Array.of(0x111111, 0x111111), 1, 1))]).toEqual([0x20, 0x111111, 0x111111])
  })

  test('every cell of a real frame shows both its pixels within 8 on every channel', async () => {
    const frame = frameOf(newGame(21), W, H)
    const words = unpack(rasterCells(frame, W, H / 2))
    expect(words.length).toBe(W * (H / 2) * 3)
    const close = (a: number, b: number) => [16, 8, 0].every(s => Math.abs(((a >> s) & 255) - ((b >> s) & 255)) <= 8)
    let spaces = 0
    for (let y = 0; y < H / 2; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const i = (y * W + x) * 3
        const isSpace = words[i] === 0x20
        if (isSpace) spaces += 1
        const shownTop = isSpace ? words[i + 2]! : words[i + 1]!
        if (!close(shownTop, frame[2 * y * W + x]!) || words[i + 2] !== frame[(2 * y + 1) * W + x]) throw new Error(`cell ${x},${y} shows another color`)
      }
    }
    expect(spaces).toBeGreaterThan(0)
  })
})

describe('clicks on the map', () => {
  test('a click lands on the tile drawn under it, the top and bottom half of a cell told apart', async () => {
    const g = newGame(21)
    const columns = 96
    const rows = 36
    const o = viewOrigin(g, columns, rows * 2)
    const cellOf = (tx: number, ty: number) => ({ x: tx * PX - o.x + 3, y: (ty * PX - o.y + 5) / 2 })
    for (const [tx, ty] of [[g.x, g.y], [g.x + 1, g.y], [g.x, g.y + 2]] as const) {
      const c = cellOf(tx, ty)
      expect(clickToTile(g, { ...c, columns, rows })).toEqual({ x: tx, y: ty })
    }
    const edge = { x: g.x * PX - o.x, y: (g.y * PX - o.y) / 2 }
    expect(clickToTile(g, { ...edge, columns, rows })).toEqual({ x: g.x, y: g.y })
    expect(clickToTile(g, { x: edge.x, y: edge.y - 0.5, columns, rows })).toEqual({ x: g.x, y: g.y - 1 })
  })
})

test('a cell straddling two tiles: its lower half clicks the lower tile, its upper half the upper one', async () => {
  const g = newGame(21)
  const columns = 96
  const rows = 35
  const o = viewOrigin(g, columns, rows * 2)
  const top = g.y * PX - o.y
  expect(top % 2).toBe(1)
  const cell = (top - 1) / 2
  const x = g.x * PX - o.x + 3
  expect(clickToTile(g, { x, y: cell + 0.75, columns, rows })).toEqual({ x: g.x, y: g.y })
  expect(clickToTile(g, { x, y: cell + 0.25, columns, rows })).toEqual({ x: g.x, y: g.y - 1 })
})

describe('walking between tiles', () => {
  const path = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }]

  test('takes a tile in 4 frames, in a straight line, from tile center to tile center', async () => {
    // Tile centers sit half a tile in: PX / 2, then PX further for each tile.
    const half = PX / 2
    expect(FRAMES_PER_TILE).toBe(4)
    expect(walkPosition(path, 0)).toEqual({ x: half, y: half, isDone: false })
    expect(walkPosition(path, 2)).toEqual({ x: half + 4, y: half, isDone: false })
    expect(walkPosition(path, 4)).toEqual({ x: half + 8, y: half, isDone: false })
    expect(walkPosition(path, 8)).toEqual({ x: half + 16, y: half, isDone: true })
    expect(walkPosition(path, 9999)).toEqual({ x: half + 16, y: half, isDone: true })
  })

  test('moves exactly two pixels every frame: no frame stands still, none jumps', async () => {
    const xs = Array.from({ length: 9 }, (_, f) => walkPosition(path, f).x)
    expect(xs.slice(1).map((x, f) => x - xs[f]!)).toEqual(Array(8).fill(2))
    const down = [{ x: 3, y: 1 }, { x: 3, y: 2 }, { x: 2, y: 2 }]
    const steps = Array.from({ length: 8 }, (_, f) => {
      const a = walkPosition(down, f)
      const b = walkPosition(down, f + 1)
      return Math.abs(b.x - a.x) + Math.abs(b.y - a.y)
    })
    expect(steps).toEqual(Array(8).fill(2))
  })

  test('the hero drawn mid-walk sits at that pixel, not on the tile the rules put him on', async () => {
    const g = newGame(21)
    const w = 96
    const h = 72
    // Half a tile to the left of his own tile's center.
    const half = PX / 2
    const at = { x: g.x * PX + half - half, y: g.y * PX + half }
    const f = frameOf(g, w, h, { isLit: false, heroAt: at })
    const o = viewOrigin({ x: (at.x - half) / PX, y: (at.y - half) / PX }, w, h)
    const art = heroArt(g)
    const y = art.findIndex(r => /[^.]/.test(r))
    const x = art[y]!.search(/[^.]/)
    const k = art[y]![x]!
    expect(f[(at.y - half + y - o.y) * w + (at.x - half + x - o.x)]).toBe(hexToInt(PAL[k]!))
  })
})

describe('the kept ground layer', () => {
  const w = 200
  const h = 88
  /** The frame as a layer drawn afresh would give it: a game on another depth first, so nothing of this one is kept. */
  const fresh = (g: Game, opts: Parameters<typeof frameOf>[3]) => {
    frameOf({ ...g, depth: g.depth + 1 }, w, h, opts)
    return frameOf({ ...g }, w, h, opts)
  }
  const differ = (a: Uint32Array, b: Uint32Array) => a.findIndex((n, i) => n !== b[i])

  test('patched tile by tile, every frame of a long walk is the frame drawn afresh', { timeoutMs: 20000 }, async () => {
    const g = { ...newGame(21), seen: '1'.repeat(64 * 18) }
    const route = benchRoute(g, 40)
    let cam = tileCamera(null, walkPosition(route, 0), w, h)
    for (let f = 0; f < (route.length - 1) * FRAMES_PER_TILE; f += 1) {
      const heroAt = walkPosition(route, f)
      cam = tileCamera(cam, heroAt, w, h)
      const opts = { heroAt, camera: cam, stride: isStrideFrame(f) }
      const game = walkingGame(g, g, route, f)
      const patched = frameOf(game, w, h, opts)
      expect(differ(patched, fresh(game, opts))).toBe(-1)
      // The layer patched from goes on from this frame, as in play.
      frameOf(game, w, h, opts)
    }
  })

  test('patched tile by tile, a game played (fog lifting, pickups taken, a fight) is drawn as afresh', { timeoutMs: 20000 }, async () => {
    let g = newGame(5)
    for (let i = 0; i < 40; i += 1) {
      g = apply(g, i % 7 === 3 ? { kind: 'summon', name: 'x.ts' } : g.foe !== null ? { kind: 'attack' } : { kind: 'explore', steps: 2 })
      for (const opts of [{}, { bob: true }]) {
        const patched = frameOf(g, w, h, opts)
        expect(differ(patched, fresh(g, opts))).toBe(-1)
        frameOf(g, w, h, opts)
      }
    }
  })

  test('a hero standing still who takes off his kit is drawn without it, as afresh', async () => {
    const g = newGame(5)
    const bare = { ...g, gear: {} }
    const kitted = frameOf(g, w, h, {})
    const patched = frameOf(bare, w, h, {})
    expect(differ(kitted, patched)).not.toBe(-1)
    expect(differ(patched, fresh(bare, {}))).toBe(-1)
  })
})

describe('the palette a frame sends', () => {
  // The host's Raster paints 1024 color pairs exactly and the rest as their nearest; it rounds each channel to a step of 17.
  const snap = (n: number) => [16, 8, 0].reduce((out, s) => out | (Math.round(((n >>> s) & 255) / 17) * 17 << s), 0)
  const pairsIn = (cells: string) => {
    const words = new Uint32Array(Uint8Array.from(atob(cells), c => c.charCodeAt(0)).buffer)
    const pairs = new Set<number>()
    for (let i = 0; i < words.length; i += 3) pairs.add(snap(words[i + 1]!) * 0x1000000 + snap(words[i + 2]!))
    return pairs.size
  }

  test('a wide pane of any theme, or the town, stays well under the 1024 color pairs the host paints exactly', async () => {
    const most = Math.max(
      ...[1, 3, 7, 12].map(depth => {
        const g = { ...newGame(9), depth, seen: '1'.repeat(64 * 18) }
        return pairsIn(pixelMap(g, 300, 72))
      }),
      pairsIn(pixelMap(apply(newGame(4), { kind: 'portal' }), 300, 72)),
    )
    expect(most).toBeLessThan(768)
    expect(most).toBeGreaterThan(50)
  })
})

describe('the camera', () => {
  const w = 96
  const h = 48
  test('holds still while the hero stays in the middle of the view', async () => {
    const cam = { x: 300, y: 120 }
    expect(followCamera(cam, { x: 310, y: 126 }, w, h)).toEqual(cam)
  })

  test('outside the middle it moves just enough to bring the hero back to its edge', async () => {
    const cam = { x: 300, y: 120 }
    const zone = deadZone(w, h)
    expect(followCamera(cam, { x: 300 + zone.x + 5, y: 120 }, w, h)).toEqual({ x: 305, y: 120 })
    expect(followCamera(cam, { x: 300, y: 120 - zone.y - 3 }, w, h)).toEqual({ x: 300, y: 117 })
  })

  test('the view camera starts on the tile line nearest the hero', async () => {
    // A tile center is 4 px into its tile: 44 rounds up to 48, 28 to 32.
    expect(tileCamera(null, { x: 44, y: 28 }, w, h)).toEqual({ x: 48, y: 32 })
    expect(tileCamera(null, { x: 43, y: 27 }, w, h)).toEqual({ x: 40, y: 24 })
  })

  test('the view camera holds until the hero is half a tile past the dead zone, then pages to leave him half a zone behind the middle', async () => {
    // 96 by 48: a dead zone of 19 by 9 pixels, so it holds to 22 px off the middle across and 12 down.
    const cam = { x: 304, y: 120 }
    expect(deadZone(w, h)).toEqual({ x: 19, y: 9 })
    expect(tileCamera(cam, { x: 326, y: 120 }, w, h)).toEqual(cam)
    // 327 is 23 off: the camera goes to 327 + 9 = 336, a tile line.
    expect(tileCamera(cam, { x: 327, y: 120 }, w, h)).toEqual({ x: 336, y: 120 })
    // 107 is 13 above: 107 - 4 = 103, the nearest tile line 104.
    expect(tileCamera(cam, { x: 304, y: 107 }, w, h)).toEqual({ x: 304, y: 104 })
  })

  test('after a jump a step back holds the view still', async () => {
    const paged = tileCamera({ x: 304, y: 120 }, { x: 327, y: 120 }, w, h)
    expect(tileCamera(paged, { x: 327 - PX, y: 120 }, w, h)).toEqual(paged)
  })

  test('over a long walk the view camera jumps seldom, on tile lines, at least a dead zone at a time, keeping the hero in view', async () => {
    const g = { ...newGame(21), seen: '1'.repeat(64 * 18) }
    const route = benchRoute(g, 60)
    const zone = deadZone(w, h)
    let cam = tileCamera(null, walkPosition(route, 0), w, h)
    let moves = 0
    for (let f = 1; f <= 60 * FRAMES_PER_TILE; f += 1) {
      const hero = walkPosition(route, f)
      const next = tileCamera(cam, hero, w, h)
      const [dx, dy] = [Math.abs(next.x - cam.x), Math.abs(next.y - cam.y)]
      expect((dx === 0 || dx >= zone.x) && (dy === 0 || dy >= zone.y)).toBe(true)
      expect(next.x % PX === 0 && next.y % PX === 0).toBe(true)
      expect(Math.abs(hero.x - next.x) < zone.x + PX / 2 && Math.abs(hero.y - next.y) < zone.y + PX / 2).toBe(true)
      if (dx !== 0 || dy !== 0) moves += 1
      cam = next
    }
    // A camera a tile at a time moved 54 times on this walk in this view; paging, under half as often.
    expect(moves).toBeGreaterThan(0)
    expect(moves).toBeLessThan(27)
  })

  test('with the camera held, a step leaves the map away from the hero where it was', async () => {
    const g = newGame(21)
    const cam = { x: g.x * PX + PX / 2, y: g.y * PX + PX / 2 }
    const before = frameOf(g, w, h, { isLit: false, camera: cam })
    const after = frameOf({ ...g, x: g.x + 1 }, w, h, { isLit: false, camera: cam })
    const o = originAt(cam, w, h)
    const heroLeft = g.x * PX - o.x
    let same = 0
    let far = 0
    for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
      if (Math.abs(x - heroLeft) < 30) continue
      far += 1
      if (before[y * w + x] === after[y * w + x]) same += 1
    }
    expect(same / far).toBeGreaterThan(0.9)
  })

  test('a click lands on the tile drawn under it when the camera is not on the hero', async () => {
    const g = newGame(21)
    const cam = { x: g.x * PX + PX / 2 + 20, y: g.y * PX + PX / 2 }
    const o = originAt(cam, w, h)
    const cell = { x: g.x * PX - o.x + 3, y: (g.y * PX - o.y + 5) / 2 }
    expect(clickToTile(g, { ...cell, columns: w, rows: h / 2 }, cam)).toEqual({ x: g.x, y: g.y })
  })
})

describe('the map while a walk plays', () => {
  // The walk goes a(0,0) to b(1,0) to c(2,0); the game takes its pickups at b and c at once, the coin at z before it.
  const path = [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 2, y: 0 }]
  const [z, b, c] = [5 * MAP_W + 5, 1, 2]
  const g = newGame(2)
  const foe = foeAhead(g, 3, { hp: 9, maxHp: 9 })
  const start = { taken: [z], foe }
  const end: Game = { ...g, taken: [z, b, c], foe: { ...foe, hp: 4 } }

  test('a pickup stays on the floor until the drawn hero reaches its tile', async () => {
    expect(walkingGame(end, start, path, 0).taken).toEqual([z])
    expect(walkingGame(end, start, path, FRAMES_PER_TILE / 2).taken).toEqual([z])
    expect(walkingGame(end, start, path, FRAMES_PER_TILE).taken).toEqual([z, b])
    expect(walkingGame(end, start, path, 2 * FRAMES_PER_TILE).taken).toEqual([z, b, c])
  })

  test('a pickup taken before the walk stays gone when the walk crosses its tile again', async () => {
    expect(walkingGame(end, { ...start, taken: [z, c] }, path, 0).taken).toEqual([z, c])
  })

  test('the foe the walk ends by striking keeps its health until the hero arrives', async () => {
    expect(walkingGame(end, start, path, FRAMES_PER_TILE).foe?.hp).toBe(9)
    expect(walkingGame(end, start, path, 2 * FRAMES_PER_TILE).foe?.hp).toBe(4)
  })

  test('a foe the walk ends by slaying stays drawn until the hero arrives', async () => {
    const slain = { ...end, foe: null }
    expect(walkingGame(slain, start, path, FRAMES_PER_TILE)?.foe).toEqual(foe)
    expect(walkingGame(slain, start, path, 2 * FRAMES_PER_TILE).foe).toBeNull()
  })
})

describe('the town on the map', () => {
  const town = () => apply(newGame(4), { kind: 'portal' })
  const W = TOWN_W * PX
  const H = TOWN_H * PX
  const at = (f: Uint32Array, x: number, y: number) => f[y * W + x]

  test('a view as big as the town shows all of it, its ground in its own daylight colors', async () => {
    const f = frameOf(town(), W, H)
    // The middle of a road tile (2,6), a grass tile (1,7) and a roof tile (3,2): no torchlight, no fog, nothing over them.
    const mid = (tx: number, ty: number) => ({ x: tx * PX + 5, y: ty * PX + 5 })
    for (const [tx, ty, kind] of [[2, 6, 'road'], [1, 7, 'grass'], [3, 2, 'roof']] as const) {
      const p = mid(tx, ty)
      expect(at(f, p.x, p.y)).toBe(hexToInt(TOWN_TERRAIN[kind](p.x, p.y)))
    }
  })

  test('draws the townsfolk, the stash, the portal and the hero, each on its tile', async () => {
    const g = town()
    const f = frameOf(g, W, H)
    const drawn = (art: readonly string[], p: { x: number; y: number }) =>
      art.every((row, dy) => [...row].every((k, dx) => k === '.' || at(f, p.x * PX + dx, p.y * PX + dy) === hexToInt(PAL[k]!)))
    expect(drawn(NPC_ART.merchant, TOWN_SPOTS.merchant)).toBe(true)
    expect(drawn(NPC_ART.smith, TOWN_SPOTS.smith)).toBe(true)
    expect(drawn(NPC_ART.healer, TOWN_SPOTS.healer)).toBe(true)
    expect(drawn(TOWN_THING_ART.stash, TOWN_SPOTS.stash)).toBe(true)
    expect(drawn(TOWN_THING_ART.portal, TOWN_SPOTS.portal)).toBe(true)
    expect(drawn(heroArt(g), g)).toBe(true)
  })

  test('draws the fountain and the trees, and shades the ground under a tree', async () => {
    const f = frameOf(town(), W, H)
    const big = (art: readonly string[], p: { x: number; y: number }, swap: Readonly<Record<string, string>> = {}) =>
      art.every((row, dy) => [...row].every((k, dx) => k === '.' || p.x * PX + dx < 0 || p.y * PX + dy < 0 || at(f, p.x * PX + dx, p.y * PX + dy) === hexToInt(swap[k] ?? PAL[k]!)))
    expect(big(TOWN_BIG_ART.fountain, { x: 9, y: 8 })).toBe(true)
    // The tree at (12,1) in its own green; the one at (6,1) in the second green.
    expect(big(TOWN_BIG_ART.tree, { x: 12, y: 1 })).toBe(true)
    expect(big(TOWN_BIG_ART.tree, { x: 6, y: 1 }, TREE_ALT)).toBe(true)
    // Just below and left of the trunk of the tree at (12,1), outside its art, the grass is darker than unshaded grass.
    const gx = 12 * PX + PX / 2
    const gy = 1 * PX + 2 * PX - 1
    expect(at(f, gx, gy)).not.toBe(hexToInt(TOWN_TERRAIN.grass(gx, gy)))
  })

  test('the camera stays inside the town, and a click picks the town tile under it', async () => {
    const g = town()
    // A narrow view: the window is clamped to the town's edges, not the dungeon's.
    const o = originAt({ x: g.x * PX + PX / 2, y: g.y * PX + PX / 2 }, 60, 40, worldSize(g))
    expect(o.x + 60).toBeLessThanOrEqual(W)
    expect(o.y + 40).toBeLessThanOrEqual(H)
    expect(clickToTile(g, { x: 3 * PX + 1, y: (5 * PX + 1) / 2, columns: W, rows: H / 2 })).toEqual({ x: 3, y: 5 })
  })
})

describe('torchlight while walking', () => {
  test('moves tile by tile: a few pixels of walking change only the pixels under the hero', async () => {
    let g = newGame(7, 'knight')
    for (let i = 0; i < 2; i += 1) g = apply(g, { kind: 'explore', steps: 3 })
    const center = { x: g.x * PX + PX / 2, y: g.y * PX + PX / 2 }
    const w = 108
    const h = 64
    // The hero drawn at his tile's center, then 3 pixels on: still nearer this tile than the next.
    const a = frameOf(g, w, h, { heroAt: center, camera: center })
    const b = frameOf(g, w, h, { heroAt: { x: center.x + 3, y: center.y }, camera: center })
    const o = originAt(center, w, h)
    // The two places the sprite is drawn, in window pixels.
    const left = center.x - PX / 2 - o.x
    const top = center.y - PX / 2 - o.y
    const underHero = (x: number, y: number) => y >= top && y < top + PX && x >= left && x < left + PX + 3
    const elsewhere = [...a].filter((p, i) => p !== b[i] && !underHero(i % w, Math.floor(i / w))).length
    expect(elsewhere).toBe(0)
  })
})

describe('a frame never depends on the frame before it', () => {
  // Each pair draws `next` twice: once right after `before`, once after an unrelated game, which leaves nothing kept
  // that `next` could reuse. The two must match pixel for pixel.
  const other = newGame(77)
  const drawnAfter = (before: { g: Game; opts?: Parameters<typeof frameOf>[3] }, next: { g: Game; opts?: Parameters<typeof frameOf>[3] }) => {
    frameOf(before.g, W, H, before.opts)
    const warm = frameOf(next.g, W, H, next.opts)
    frameOf(other, W, H)
    const cold = frameOf(next.g, W, H, next.opts)
    return { warm: [...warm], cold: [...cold] }
  }
  const g = newGame(21)
  const center = { x: g.x * PX + PX / 2, y: g.y * PX + PX / 2 }

  test('a foe appearing is drawn at once', async () => {
    const { warm, cold } = drawnAfter({ g }, { g: { ...g, foe: foeAhead(g, 2) } })
    expect(warm).toEqual(cold)
  })

  test('the torch moving to the next tile relights the ground', async () => {
    const { warm, cold } = drawnAfter({ g, opts: { heroAt: center, camera: center } }, { g, opts: { heroAt: { x: center.x + PX, y: center.y }, camera: center } })
    expect(warm).toEqual(cold)
  })

  test('the light switched off is drawn unlit', async () => {
    const { warm, cold } = drawnAfter({ g }, { g, opts: { isLit: false } })
    expect(warm).toEqual(cold)
  })

  test('the camera moving past what was kept around the window', async () => {
    const { warm, cold } = drawnAfter({ g, opts: { heroAt: center, camera: center } }, { g, opts: { heroAt: center, camera: { x: center.x + 3 * PX, y: center.y } } })
    expect(warm).toEqual(cold)
  })
})

describe('the bench route', () => {
  test('starts on the hero and runs exactly that many single steps over explored floor, out and back as needed', async () => {
    let g = newGame(21)
    for (let i = 0; i < 4; i += 1) g = apply(g, { kind: 'explore', steps: 3 })
    const level = levelOf(g)
    for (const tiles of [1, 5, 60]) {
      const route = benchRoute(g, tiles)
      expect(route.length).toBe(tiles + 1)
      expect(route[0]).toEqual({ x: g.x, y: g.y })
      route.slice(1).forEach((p, i) => {
        const q = route[i]!
        expect(Math.max(Math.abs(p.x - q.x), Math.abs(p.y - q.y))).toBe(1)
        expect(level.tiles[p.y]?.[p.x]).toBe('.')
        expect(g.seen[p.y * MAP_W + p.x]).toBe('1')
      })
    }
    // Out as far as the explored floor reaches: it gets more than a few tiles from where it starts.
    const route = benchRoute(g, 60)
    expect(Math.max(...route.map(p => Math.max(Math.abs(p.x - g.x), Math.abs(p.y - g.y))))).toBeGreaterThan(5)
  })
})

describe('the torch\'s color', () => {
  test('runs from cool at the edge through orange to a pale warm core, straight between its stops', async () => {
    expect(torchColor(0.15)).toEqual([0.5, 0.55, 0.75])
    expect(torchColor(0.45)).toEqual([0.95, 0.75, 0.55])
    expect(torchColor(1)).toEqual([1.1, 1.05, 0.92])
    // Halfway from 0.15 to 0.45, worked by hand: (0.5 + 0.95) / 2, (0.55 + 0.75) / 2, (0.75 + 0.55) / 2.
    const mid = torchColor(0.3)
    expect(mid.map(k => Math.round(k * 1000) / 1000)).toEqual([0.725, 0.65, 0.65])
    // Below the light's floor it stays at the edge color.
    expect(torchColor(0)).toEqual([0.5, 0.55, 0.75])
  })
})

describe('a wall\'s light', () => {
  const below = (light: number, near: boolean) => [{ dx: 0, dy: 1, light, near }]
  /** To six decimals, for values worked out in floating point. */
  const r6 = (n: number | undefined) => (n === undefined ? n : Math.round(n * 1e6) / 1e6)
  test('comes from the floor beside it, full where it faces the hero, 55% where it faces away', async () => {
    expect(r6(wallFaceLight(below(0.8, true), { x: 0, y: 5 }))).toBe(0.8)
    expect(r6(wallFaceLight(below(0.8, true), { x: 0, y: -5 }))).toBe(0.44)
    // Side on: 0.55 + 0.45 * 0.
    expect(r6(wallFaceLight(below(0.8, true), { x: 5, y: 0 }))).toBe(0.44)
  })

  test('is 60% away from the open side, never below the light\'s floor, and the brightest open side counts', async () => {
    expect(r6(wallFaceLight(below(0.8, false), { x: 0, y: 5 }))).toBe(0.48)
    expect(r6(wallFaceLight(below(0.2, false), { x: 0, y: -5 }))).toBe(0.15)
    expect(r6(wallFaceLight([{ dx: 0, dy: 1, light: 0.3, near: true }, { dx: 1, dy: 0, light: 0.9, near: false }], { x: 3, y: 3 }))).toBe(0.9)
  })

  test('on screen: a wall facing the hero takes the light of the floor before it, its far rows 60% of that', async () => {
    const g = newGame(21)
    const level = levelOf(g)
    // The wall straight below the hero in the starting room, worked by hand: three tiles down, its open side up.
    expect([level.tiles[g.y + 2]?.[g.x], level.tiles[g.y + 3]?.[g.x]]).toEqual(['.', '#'])
    const w = 200
    const h = 200
    const camera = { x: g.x * PX + PX / 2, y: g.y * PX + PX / 2 }
    const lit = frameOf(g, w, h, { camera })
    const bare = frameOf(g, w, h, { camera, isLit: false })
    const o = originAt(camera, w, h)
    // The floor before the wall is two tiles from the torch; facing the hero square on, the wall gets all of its light.
    const near = torch(2)
    const red = (frame: Uint32Array, lx: number, ly: number) => (frame[((g.y + 3) * PX + ly - o.y) * w + g.x * PX + lx - o.x]! >> 16) & 255
    for (let lx = 0; lx < PX; lx += 1) {
      for (const [ly, light] of [[0, near], [1, near], [2, Math.max(0.15, near * 0.6)], [7, Math.max(0.15, near * 0.6)]] as const) {
        // At the light's level of LIGHT_STEPS, snapped to the host's step of 17.
        expect(red(lit, lx, ly)).toBe(Math.round(Math.min(255, Math.round(red(bare, lx, ly) * torchColor(lightStep(light))[0])) / 17) * 17)
      }
    }
  })

  test('with no open side there is none: the wall keeps the torch\'s own falloff', async () => {
    expect(wallFaceLight([], { x: 0, y: 5 })).toBeUndefined()
  })
})

describe('hit feedback', () => {
  const g = newGame(21)
  const foe = foeAhead(g, 2, { hp: 10, maxHp: 10 })

  test('reads what a blow did from the game before and after: the damage, a crit, a kill, the hero hurt', async () => {
    const hit = { ...g, foe: { ...foe, hp: 6 }, log: ['You hit the goblin of x for 4.'] }
    expect(hitsBetween({ ...g, foe }, hit)).toEqual([{ at: { x: foe.x, y: foe.y }, amount: 4, kind: 'hit' }])
    const crit = { ...g, foe: { ...foe, hp: 2 }, log: ['You CRITICALLY hit the goblin of x for 8.'] }
    expect(hitsBetween({ ...g, foe }, crit)).toEqual([{ at: { x: foe.x, y: foe.y }, amount: 8, kind: 'crit' }])
    const slain = { ...g, foe: null, xp: g.xp + 10, log: ['You slay the goblin of x! +10 XP, +3 gold.'] }
    // A kill keeps the foe as it stood, to show it fall.
    expect(hitsBetween({ ...g, foe }, slain)).toEqual([{ at: { x: foe.x, y: foe.y }, amount: 10, kind: 'kill', foe }])
    const hurt = { ...g, hp: g.hp - 3, foe }
    expect(hitsBetween({ ...g, foe }, hurt)).toEqual([{ at: { x: g.x, y: g.y }, amount: 3, kind: 'hurt' }])
    expect(hitsBetween({ ...g, foe }, { ...g, foe })).toEqual([])
    // Another place (a new depth, the town): nothing to show.
    expect(hitsBetween({ ...g, foe }, { ...g, depth: 2, foe: null })).toEqual([])
  })

  test('a kill reads as one however much is said after it; a foe lost in smoke is no kill', async () => {
    const slain = { ...g, foe: null, xp: g.xp + 10, log: ['Loot: Elixir.', 'Loot: Hearty Tunic (Epic).', 'Level 2!', 'Level 3!', 'Level 4!'] }
    expect(hitsBetween({ ...g, foe }, slain).map(h => h.kind)).toEqual(['kill'])
    const fled = { ...g, foe: null, log: ['You vanish in smoke. The goblin of x loses you.'] }
    expect(hitsBetween({ ...g, foe }, fled)).toEqual([])
  })

  test('a number rises from the tile: white for a hit, gold for a crit or a kill, red over the hurt hero; it holds still for 3 frames on a crit or a kill', async () => {
    expect(hitColor('hit')).toBe('#ffffff')
    expect(hitColor('crit')).toBe('#ffd34d')
    expect(hitColor('kill')).toBe('#ffd34d')
    expect(hitColor('hurt')).toBe('#ff4a4a')
    // Its rise in pixels by frame: a pixel every 2 frames; a crit or a kill waits 3 frames first.
    expect([1, 2, 3, 4, 5].map(f => hitRise('hit', f))).toEqual([0, 1, 1, 2, 2])
    expect([1, 2, 3, 4, 5, 6].map(f => hitRise('crit', f))).toEqual([0, 0, 0, 0, 1, 1])
    expect(HIT_FRAMES).toBe(18)
  })

  test('drawn on the frame: the number in its color over the tile, the struck foe white for its first 2 frames', async () => {
    const width = MAP_W * PX
    const height = 18 * PX
    const shown = { ...g, foe: { ...foe, hp: 6 } }
    const hits = [{ at: { x: foe.x, y: foe.y }, amount: 4, kind: 'hit' as const }]
    const o = viewOrigin(g, width, height)
    const plain = frameOf(shown, width, height)
    const first = frameOf(shown, width, height, { hits, hitFrame: 1 })
    const third = frameOf(shown, width, height, { hits, hitFrame: 3 })
    const left = foe.x * PX - o.x
    const top = foe.y * PX - o.y
    const tile = (f: Uint32Array) => Array.from({ length: PX * PX }, (_, i) => f[(top + Math.floor(i / PX)) * width + left + (i % PX)])
    const art = MONSTER_ART[foe.glyph]!
    const isInk = (i: number) => art[Math.floor(i / PX)]![i % PX] !== '.'
    // The flash: every inked pixel of the sprite white on frame 1, back to its own colors by frame 3 (where the number is not).
    tile(first).forEach((p, i) => isInk(i) && expect(p).toBe(0xffffff))
    expect(tile(third).some((p, i) => isInk(i) && p !== 0xffffff)).toBe(true)
    // The number: white digits somewhere over the tile and the row above it, not on the plain frame.
    const above = (f: Uint32Array) => Array.from({ length: PX * 2 * PX }, (_, i) => f[(top - PX + Math.floor(i / PX)) * width + left + (i % PX)])
    expect(above(third).filter(p => p === 0xffffff).length).toBeGreaterThan(3)
    expect(above(plain).filter(p => p === 0xffffff).length).toBe(0)
  })
})

describe('themes by depth', () => {
  test('five depths each: crypt, flooded halls, fungal deep, frozen caverns, the forge, then round again', async () => {
    expect([1, 5, 6, 10, 11, 15, 16, 20, 21, 25, 26, 31].map(themeOf)).toEqual(['crypt', 'crypt', 'flooded', 'flooded', 'fungal', 'fungal', 'frozen', 'frozen', 'forge', 'forge', 'crypt', 'flooded'])
  })

  test('a theme recolors the ground by its channel weights, worked by hand on one color; the crypt keeps it', async () => {
    // 0x605040: red 96, green 80, blue 64.
    expect(themed(0x605040, 'crypt')).toBe(0x605040)
    // Flooded: red x0.7, green x0.95, blue x1.05: 67, 76, 67.
    expect(themed(0x605040, 'flooded')).toBe((67 << 16) | (76 << 8) | 67)
    // Forge: red x1.05, green x0.65, blue x0.55: 101, 52, 35.
    expect(themed(0x605040, 'forge')).toBe((101 << 16) | (52 << 8) | 35)
  })

  test('on screen: a floor pixel of a flooded depth is the flooded halls\' own floor', async () => {
    const level = generate(newGame(21).world, 7)
    const g = { ...newGame(21), depth: 7, ...level.start, seen: '1'.repeat(64 * 18) }
    // A floor tile beside the hero with floor all round, so no wall shading reaches its middle.
    const open = (x: number, y: number) => level.tiles[y]?.[x] === '.'
    const t = [{ x: g.x + 1, y: g.y }, { x: g.x - 1, y: g.y }, { x: g.x, y: g.y + 1 }, { x: g.x, y: g.y - 1 }].find(p => [-1, 0, 1].every(dy => [-1, 0, 1].every(dx => open(p.x + dx, p.y + dy))))!
    const frame = frameOf(g, W, H, { isLit: false })
    const o = viewOrigin(g, W, H)
    const wx = t.x * PX + 3
    const wy = t.y * PX + 3
    expect(frame[(wy - o.y) * W + wx - o.x]).toBe(hexToInt(GROUND.flooded.floor(wx, wy)))
  })
})

describe('decals', () => {
  const sides = (level: ReturnType<typeof generate>, x: number, y: number) =>
    [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => level.tiles[y + dy!]?.[x + dx!] !== '.').length

  test('decals gather by walls: never on open floor, likelier the more rock beside a tile', async () => {
    const byRock: Record<number, { tiles: number; decals: number }> = {}
    for (let world = 1; world <= 60; world += 1) {
      const level = generate(world, 1)
      level.tiles.forEach((row, y) => [...row].forEach((t, x) => {
        if (t !== '.') return
        // Corridors stay bare: decals belong to rooms.
        if (roomAt(level, { x, y }) === undefined) {
          expect(decalAt(world, 1, level, { x, y })).toBeUndefined()
          return
        }
        const n = sides(level, x, y)
        byRock[n] ??= { tiles: 0, decals: 0 }
        byRock[n]!.tiles += 1
        if (decalAt(world, 1, level, { x, y }) !== undefined) byRock[n]!.decals += 1
      }))
    }
    expect(byRock[0]!.decals).toBe(0)
    // The chance is the rock count squared over 16: 1 in 16 beside one wall, 1 in 4 in a corner.
    const share = (n: number) => byRock[n]!.decals / byRock[n]!.tiles
    expect(share(1)).toBeGreaterThan(0.03)
    expect(share(1)).toBeLessThan(0.1)
    expect(share(2)).toBeGreaterThan(0.17)
    expect(share(2)).toBeLessThan(0.33)
  })

  test('each theme lays its own two and no other: bones and cobwebs, algae and sprigs, tufts and spores, frost and shards, slag and soot', async () => {
    const expected: Record<string, readonly string[]> = { 2: ['bones', 'cobweb'], 7: ['algae', 'sprigs'], 12: ['tuft', 'spores'], 17: ['frost', 'shards'], 22: ['slag', 'soot'] }
    for (const [depth, pair] of Object.entries(expected)) {
      const found = new Set<string>()
      for (let world = 1; world <= 30; world += 1) {
        const level = generate(world, Number(depth))
        level.tiles.forEach((row, y) => [...row].forEach((_, x) => {
          const d = decalAt(world, Number(depth), level, { x, y })
          if (d !== undefined) found.add(d)
        }))
      }
      expect([...found].sort()).toEqual([...pair].sort())
    }
  })

  test("drawn on its tile: the decal's pixels in its own colors, over the floor", async () => {
    for (let world = 1; world <= 60; world += 1) {
      const level = generate(world, 1)
      // A decal tile with nothing standing or lying on it, nor the stairs or the start.
      const spot = level.tiles.flatMap((row, y) => [...row].map((_, x) => ({ x, y }))).find(p => decalAt(world, 1, level, p) !== undefined && floorThing(world, 1, level, p) === ' ' && !same(p, level.start) && !same(p, level.stairs))
      if (spot === undefined) continue
      const kind = decalAt(world, 1, level, spot)!
      // The hero in the decal's room, so it is in sight and not drawn in memory's blue.
      const room = roomAt(level, spot)!
      const stand = [{ x: room.x + Math.floor(room.w / 2), y: room.y + Math.floor(room.h / 2) }, { x: room.x, y: room.y }].find(p => !same(p, spot))!
      const g = { ...newGame(world), world, depth: 1, ...stand, seen: '1'.repeat(64 * 18) }
      const frame = frameOf(g, 64 * PX, 18 * PX, { isLit: false, camera: { x: 256, y: 72 } })
      const o = originAt({ x: 256, y: 72 }, 64 * PX, 18 * PX)
      DECAL_ART[kind].forEach((row, dy) => [...row].forEach((k, dx) => {
        if (k === '.') return
        const p = frame[(spot.y * PX + dy - o.y) * 64 * PX + spot.x * PX + dx - o.x]!
        // Its own color, darkened at most by the wall's shade beside it.
        const want = hexToInt(PAL[k]!)
        expect([(p >> 16) & 255, (p >> 8) & 255, p & 255].every((c, i) => c <= [(want >> 16) & 255, (want >> 8) & 255, want & 255][i]! && c > 0)).toBe(true)
      }))
      return
    }
    throw new Error('no decal in 60 levels')
  })
})

describe('wall torches', () => {
  test('hang on the wall above about half the rooms that have one there, in the middle of the room\'s top side', async () => {
    let rooms = 0
    let lit = 0
    for (let world = 1; world <= 60; world += 1) {
      const level = generate(world, 2)
      const torches = wallTorchesOf(world, 2, level)
      rooms += level.rooms.filter(r => level.tiles[r.y - 1]?.[r.x + Math.floor(r.w / 2)] === '#').length
      lit += torches.length
      for (const t of torches) {
        expect(level.tiles[t.y]?.[t.x]).toBe('#')
        expect(level.rooms.some(r => t.y === r.y - 1 && t.x === r.x + Math.floor(r.w / 2))).toBe(true)
      }
      expect(wallTorchesOf(world, 2, level)).toEqual(torches)
    }
    expect(lit / rooms).toBeGreaterThan(0.4)
    expect(lit / rooms).toBeLessThan(0.62)
  })

  test('light the floor around them: brighter by a torch than without its light, the same far from every light', async () => {
    for (let world = 1; world <= 400; world += 1) {
      const level = generate(world, 2)
      const g0 = { ...newGame(world), world, depth: 2, seen: '1'.repeat(64 * 18) }
      const torch = wallTorchesOf(world, 2, level).find(t => Math.abs(t.x - level.start.x) + Math.abs(t.y - level.start.y) > 14)
      if (torch === undefined) continue
      // The hero in the torch's room, so its floor is in sight, but far from the torch's tile is not needed: the
      // room's floor just under the torch.
      const room = level.rooms.find(r => torch.y === r.y - 1 && torch.x === r.x + Math.floor(r.w / 2))!
      // A room lit from its middle outshines a wall torch near it: a tall room, its torch's floor far from the middle.
      if (room.h < 5) continue
      const g = { ...g0, ...{ x: room.x + room.w - 1, y: room.y + room.h - 1 } }
      const w = 64 * PX
      const h = 18 * PX
      const camera = { x: 256, y: 72 }
      const o = originAt(camera, w, h)
      const withLight = frameOf(g, w, h, { camera })
      const without = frameOf(g, w, h, { camera, lights: [] })
      const below = (f: Uint32Array) => f[(torch.y * PX + PX + 4 - o.y) * w + torch.x * PX + 4 - o.x]!
      const luma = (n: number) => ((n >> 16) & 255) + ((n >> 8) & 255) + (n & 255)
      expect(luma(below(withLight))).toBeGreaterThan(luma(below(without)))
      return
    }
    throw new Error('no torch over a tall room far from a start in 80 levels')
  })

  test('in a room the light stands at its middle and holds still: walking across it changes nothing but the hero', async () => {
    const g0 = { ...newGame(3), seen: '1'.repeat(64 * 18) }
    const level = generate(g0.world, g0.depth)
    const big = [...level.rooms].sort((a, b) => b.w * b.h - a.w * a.h)[0]!
    const y = big.y + Math.floor(big.h / 2)
    const camera = { x: (big.x + big.w / 2) * PX, y: y * PX }
    const w = 140
    const h = 90
    const at = (x: number) => frameOf({ ...g0, x, y }, w, h, { camera })
    // A pixel of floor far from both spots the hero stands on: lit the same wherever he is in the room.
    const corner = { x: big.x * PX + 2, y: big.y * PX + 2 }
    const o = originAt(camera, w, h)
    const pixel = (f: Uint32Array) => f[(corner.y - o.y) * w + corner.x - o.x]
    expect(pixel(at(big.x + 2))).toBe(pixel(at(big.x + big.w - 2)))
  })
})

describe('the themed room drawn', () => {
  /** A game on depth 3 of the first world with a shrine, standing just below its altar, everything explored. */
  const atShrine = () => {
    for (let world = 1; world <= 200; world += 1) {
      const level = generate(world, 3)
      const themed = themedRoomOf(world, 3, level)
      if (themed?.kind !== 'shrine') continue
      const r = themed.room
      const mid = { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) }
      if (mid.y + 1 >= r.y + r.h) continue
      return { g: { ...newGame(world), world, depth: 3, x: mid.x, y: mid.y + 1, seen: '1'.repeat(MAP_W * MAP_H), taken: [], foe: null }, mid }
    }
    throw new Error('no shrine')
  }
  /** A tile's mean luma in a frame whose window starts at `origin`. */
  const tileLuma = (frame: Uint32Array, origin: { x: number; y: number }, p: { x: number; y: number }) => {
    let sum = 0
    for (let y = 0; y < PX; y += 1) for (let x = 0; x < PX; x += 1) sum += luma(at(frame, p.x * PX + x - origin.x, p.y * PX + y - origin.y))
    return sum / (PX * PX)
  }

  test('a brazier lights the floor beside it, out of the reach of the hero\'s torch, as a wall torch would', async () => {
    // A wide shrine, the hero at its west end: the floor east of the east brazier lies over 6.5 tiles from his torch.
    for (let world = 1; world <= 600; world += 1) {
      const level = generate(world, 3)
      const themed = themedRoomOf(world, 3, level)
      if (themed?.kind !== 'shrine' || themed.room.w < 11 || themed.room.h < 6) continue
      const r = themed.room
      const mid = { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) }
      const g = { ...newGame(world), world, depth: 3, x: r.x, y: mid.y, seen: '1'.repeat(MAP_W * MAP_H), taken: [], foe: null }
      // The window looks at the east brazier, the hero off it to the west.
      const camera = { x: (mid.x + 3) * PX, y: mid.y * PX }
      const frame = frameOf(g, W, H, { lights: [], camera })
      const origin = originAt(camera, W, H)
      const besideBrazier = { x: mid.x + 3, y: mid.y }
      const farCorner = { x: r.x + r.w - 1, y: r.y }
      expect(tileLuma(frame, origin, besideBrazier)).toBeGreaterThan(tileLuma(frame, origin, farCorner) * 1.5)
      return
    }
    throw new Error('no wide shrine')
  })

  test('the altar still stands once prayed at, drawn as it was', async () => {
    const { g, mid } = atShrine()
    const before = frameOf(g, W, H, { isLit: false })
    const after = frameOf({ ...g, taken: [cellId(mid)] }, W, H, { isLit: false })
    const o = screen(g, mid.x * PX + 2, mid.y * PX + 4)
    expect(THING_ART.A?.[4]?.[2]).toBe('W')
    expect(at(before, o.x, o.y)).toBe(hexToInt(PAL.W!))
    expect(at(after, o.x, o.y)).toBe(hexToInt(PAL.W!))
  })
})

describe('the walk cycle and the lunge', () => {
  test('the stride sets the feet a pixel further apart each side; a robe that hides the feet stays as it is', async () => {
    const knight = heroArt(newGame(1, 'knight'))
    expect(knight[7]).toBe('..n..N..')
    expect(strideOf(knight)[7]).toBe('.n....N.')
    expect(strideOf(knight).slice(0, 7)).toEqual(knight.slice(0, 7))
    const mage = heroArt(newGame(1, 'mage'))
    expect(strideOf(mage)).toEqual(mage)
    const three = [...knight.slice(0, 7), '..n.nN..']
    expect(strideOf(three)).toEqual(three)
  })

  test('two poses, 2 frames each: a tile of 4 frames is stride, stride, stand, stand; standing still is standing', async () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 8].map(isStrideFrame)).toEqual([false, true, true, false, false, true, true, false, false])
  })

  test('a walking frame draws the stride: the feet one pixel out', async () => {
    const g = newGame(21)
    const heroAt = { x: g.x * PX + PX / 2 + 2, y: g.y * PX + PX / 2 }
    // The window follows the drawn hero.
    const o = originAt(heroAt, W, H)
    const left = heroAt.x - PX / 2 - o.x
    const foot = heroAt.y - PX / 2 + 7 - o.y
    const stride = frameOf(g, W, H, { isLit: false, heroAt, stride: true })
    const stand = frameOf(g, W, H, { isLit: false, heroAt })
    expect(at(stride, left + 1, foot)).toBe(hexToInt(PAL.n!))
    expect(at(stand, left + 1, foot)).not.toBe(hexToInt(PAL.n!))
    expect(at(stand, left + 2, foot)).toBe(hexToInt(PAL.n!))
  })

  test('a blow lunges the hero toward the foe: 2 px on its first 2 frames, 1 px on the third, then home', async () => {
    const g = newGame(21)
    const foe = { ...foeAhead(g, 1), x: g.x + 1, y: g.y }
    const hits = [{ at: { x: foe.x, y: foe.y }, amount: 3, kind: 'hit' as const }]
    const o = viewOrigin(g, W, H)
    // The plume: row 0, column 4 of the knight's art.
    expect(heroArt(g)[0]?.[4]).toBe('r')
    const plume = (frame: Uint32Array, dx: number) => at(frame, g.x * PX + 4 + dx - o.x, g.y * PX - o.y)
    const shiftOn = (hitFrame: number) => [0, 1, 2].find(dx => plume(frameOf({ ...g, foe }, W, H, { isLit: false, hits, hitFrame }), dx) === hexToInt(PAL.r!))
    expect([1, 2, 3, 4, 5].map(shiftOn)).toEqual([2, 2, 1, 0, 0])
    const hurt = [{ at: { x: g.x, y: g.y }, amount: 3, kind: 'hurt' as const }]
    expect(plume(frameOf({ ...g, foe }, W, H, { isLit: false, hits: hurt, hitFrame: 1 }), 0)).toBe(hexToInt(PAL.r!))
    // The hero hurt and the foe hit in one exchange: still the lunge.
    expect(plume(frameOf({ ...g, foe }, W, H, { isLit: false, hits: [...hurt, ...hits], hitFrame: 1 }), 2)).toBe(hexToInt(PAL.r!))
    // Lunging, the hero is in the stride: the left foot a pixel out.
    const lunged = frameOf({ ...g, foe }, W, H, { isLit: false, hits, hitFrame: 1 })
    expect(at(lunged, g.x * PX + 2 + 1 - o.x, g.y * PX + 7 - o.y)).toBe(hexToInt(PAL.n!))
  })

  test('walking in town strides too', async () => {
    const town = apply(newGame(21), { kind: 'portal' })
    const heroAt = { x: town.x * PX + PX / 2 + 2, y: town.y * PX + PX / 2 }
    const stride = frameOf(town, W, H, { heroAt, stride: true })
    const stand = frameOf(town, W, H, { heroAt })
    expect(stride).not.toEqual(stand)
  })
})

describe('the hit freeze', () => {
  const at = (kind: 'hit' | 'crit' | 'kill' | 'hurt') => ({ at: { x: 1, y: 1 }, amount: 9, kind })

  test('a crit holds 3 frames, a kill 4, a plain hit or a blow taken none; the biggest of an exchange counts', async () => {
    expect([hitFreeze([at('crit')]), hitFreeze([at('kill')]), hitFreeze([at('hit')]), hitFreeze([at('hurt')]), hitFreeze([at('hurt'), at('kill')])]).toEqual([3, 4, 0, 0, 4])
    expect(hitFramesFor([at('crit')])).toBe(HIT_FRAMES + 3)
    expect(hitFramesFor([at('hit')])).toBe(HIT_FRAMES)
  })

  test("a crit's first frame is held, then the blow plays on as before; a plain hit moves on at once", async () => {
    const g = newGame(21)
    const foe = { ...foeAhead(g, 1), x: g.x + 1, y: g.y }
    const blow = (kind: 'hit' | 'crit') => [{ at: { x: foe.x, y: foe.y }, amount: 9, kind }]
    const frame = (kind: 'hit' | 'crit', hitFrame: number) => frameOf({ ...g, foe }, W, H, { hits: blow(kind), hitFrame })
    // Held: raw frames 1 to 4 all show the first frame.
    for (const raw of [2, 3, 4]) expect(frame('crit', raw)).toEqual(frame('crit', 1))
    // Then on as before: raw 6 shows frame 3, the lunge eased to 1 px, unlike the held frame.
    expect(frame('crit', 6)).not.toEqual(frame('crit', 1))
    // A plain hit is at frame 3 on raw 3 already.
    expect(frame('hit', 3)).not.toEqual(frame('hit', 1))
  })
})

describe('idle motion', () => {
  test('the bob lifts the hero a pixel, the plume and all; without it the hero stands on the tile', async () => {
    const g = newGame(21)
    const o = viewOrigin(g, W, H)
    const plume = (frame: Uint32Array, dy: number) => at(frame, g.x * PX + 4 - o.x, g.y * PX + dy - o.y)
    expect(heroArt(g)[0]?.[4]).toBe('r')
    const up = frameOf(g, W, H, { isLit: false, bob: true })
    expect(plume(up, -1)).toBe(hexToInt(PAL.r!))
    const down = frameOf(g, W, H, { isLit: false })
    expect(plume(down, 0)).toBe(hexToInt(PAL.r!))
    expect(plume(down, -1)).not.toBe(hexToInt(PAL.r!))
    // Back down, the frame is exactly as it was.
    expect(frameOf(g, W, H, { isLit: false })).toEqual(down)
  })

  test("the shimmer swaps the fountain's and the portal's two blues; the rest of town is as it was", async () => {
    const still = townImage()
    const shimmer = townImage(true)
    const b = hexToInt(PAL.b!)
    const c = hexToInt(PAL.c!)
    // The fountain's 2 by 2 tiles and the portal's one.
    const fountain = TOWN_DECOR.find(d => d.art === 'fountain')!
    const isWater = (x: number, y: number) => (x >= fountain.x && x < fountain.x + 2 && y >= fountain.y && y < fountain.y + 2) || (x === TOWN_SPOTS.portal.x && y === TOWN_SPOTS.portal.y)
    let swapped = 0
    for (let i = 0; i < still.length; i += 1) {
      if (still[i] === shimmer[i]) continue
      expect([still[i], shimmer[i]].sort()).toEqual([b, c].sort())
      expect(isWater(Math.floor((i % TOWN_PX_W) / PX), Math.floor(Math.floor(i / TOWN_PX_W) / PX))).toBe(true)
      swapped += 1
    }
    expect(swapped).toBeGreaterThan(20)
    // And the town frame draws the phase it is given.
    const town = apply(newGame(21), { kind: 'portal' })
    expect(frameOf(town, W, H, { shimmer: true })).not.toEqual(frameOf(town, W, H))
  })
})

describe('the spring and the old anvil drawn', () => {
  test('each still stands once used, drawn as it was', async () => {
    for (const [kind, depth, key, row, col] of [['spring', 7, 'S', 1, 2], ['anvil', 22, 'N', 4, 1]] as const) {
      let found: { g: Game; mid: { x: number; y: number } } | undefined
      for (let world = 1; world <= 200 && found === undefined; world += 1) {
        const t = themedRoomOf(world, depth, generate(world, depth))
        if (t?.kind !== kind) continue
        const r = t.room
        const mid = { x: r.x + Math.floor(r.w / 2), y: r.y + Math.floor(r.h / 2) }
        found = { g: { ...newGame(world), world, depth, x: mid.x, y: mid.y + 1 < r.y + r.h ? mid.y + 1 : mid.y - 1, seen: '1'.repeat(MAP_W * MAP_H), taken: [cellId(mid)], foe: null }, mid }
      }
      const { g, mid } = found!
      const ink = THING_ART[key]?.[row]?.[col]
      expect(ink).not.toBe('.')
      const o = screen(g, mid.x * PX + col, mid.y * PX + row)
      expect(at(frameOf(g, W, H, { isLit: false }), o.x, o.y)).toBe(hexToInt(PAL[ink!]!))
    }
  })
})

describe('the game as the walk stands', () => {
  // On depth 1 of world 1, the row y 4 holds gold at x 50 and a potion at x 51: a walk east over both.
  const g = { ...newGame(), seen: '1'.repeat(64 * 18), x: 48, y: 4 }
  const plan = apply(g, { kind: 'goto', x: 55, y: 4 })
  const tiles = alongTheWay(g, plan)!

  test("each frame shows the game as of the tile the hero has reached: the start until the first, the action's end at the last", async () => {
    const at = (frame: number) => walkState(g, tiles, frame)
    expect([0, 1, 3].map(f => at(f).gold)).toEqual([g.gold, g.gold, g.gold])
    expect(at(FRAMES_PER_TILE).x).toBe(tiles[0]!.x)
    expect(at(2 * FRAMES_PER_TILE).gold).toBe(tiles[1]!.gold)
    expect(at(2 * FRAMES_PER_TILE).gold).toBeGreaterThan(g.gold)
    expect(at(2 * FRAMES_PER_TILE - 1).gold).toBe(g.gold)
    expect(at(tiles.length * FRAMES_PER_TILE)).toMatchObject({ x: plan.x, y: plan.y, gold: plan.gold })
    expect(at(99 * FRAMES_PER_TILE)).toMatchObject({ x: plan.x, y: plan.y })
  })

  test('the foe is the one there now, met mid-walk or not', async () => {
    const foe = foeAhead(g, 2)
    expect(walkState({ ...g, foe }, tiles, 2 * FRAMES_PER_TILE).foe).toEqual(foe)
  })

  test('one frame and the next on the same tile are the same game, so what is drawn of it is kept', async () => {
    expect(walkState(g, tiles, 2 * FRAMES_PER_TILE)).toBe(walkState(g, tiles, 2 * FRAMES_PER_TILE + 1))
  })
})

describe('frame stamps', () => {
  test('a frame stamped with its number reads back that number modulo 16, on the host\'s step of 17; an unstamped one reads none; the rest of the frame is untouched', async () => {
    const g = newGame(3)
    const cells = pixelMap(g, 40, 10)
    for (const n of [1, 15, 16, 17, 159]) {
      const stamped = stampCells(cells, n)
      expect(stampOf(stamped)).toBe(n % 16)
      // Only the first cell's 12 bytes change: 16 base64 characters, the rest identical.
      expect(stamped.slice(16)).toBe(cells.slice(16))
    }
    expect(stampOf(cells)).toBeUndefined()
  })
})

describe('light in steps', () => {
  test('every lit pixel is on the host\'s step of 17, and a tile is lit the same all over', async () => {
    const g = { ...newGame(3), seen: '1'.repeat(64 * 18) }
    const frame = frameOf(g, 120, 80, {})
    const off = [...frame].filter(n => [16, 8, 0].some(sh => ((n >> sh) & 0xff) % 17 !== 0))
    // Memory, the canvas and unlit sprites are not lit: only what the light touched is held to the step.
    const lit = frameOf(g, 120, 80, { isLit: false })
    expect([...frame].filter((n, i) => n !== lit[i] && [16, 8, 0].some(sh => ((n >> sh) & 0xff) % 17 !== 0)).length).toBe(0)
    expect(off.length).toBeLessThan(frame.length)
  })

  test('a light level is one of LIGHT_STEPS, none to full', async () => {
    expect(lightStep(0)).toBe(0)
    expect(lightStep(1)).toBe(1)
    // 0.5 of 7 steps up is 3.5, rounded to 4: four sevenths.
    expect(Math.abs(lightStep(0.5) - 4 / 7)).toBeLessThan(1e-9)
    expect(lightStep(2)).toBe(1)
  })
})
