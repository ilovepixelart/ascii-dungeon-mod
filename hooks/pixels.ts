import type { Game, Rarity } from '../types'
import { RARITY_COLOR } from './items'
import { levelOf } from './game'
import { MAP_H, MAP_W, bfs, braziersOf, cellId, isFloor, roomAt, same, themeOf } from './map'
import { hash } from './rng'
import type { Level, Pos } from './map'
import { CANVAS, INK } from './palette'
import { tileAt, visibleSet } from './panels'
import type { Tile } from './panels'
import { TOWN_H, TOWN_W } from './town'
import { TOWN_PX_H, TOWN_PX_W, townImage } from './townpixels'
import { MONSTER_ART, PAL, POPUP_OUTLINE, PX, monsterArt, TERRAIN, THING_ART, UNKNOWN_ART, dropShadow, heroArt, lightPixel, textMask, torch, wallOcclusion } from './pixelart'

const HALF_BLOCK = 0x2580
const SPACE = 0x20
/** Two colors within 8 on every channel: under half the host's rounding step of 17, at most a shade apart on screen. */
const isNear = (a: number, b: number) =>
  Math.abs(((a >> 16) & 255) - ((b >> 16) & 255)) <= 8 && Math.abs(((a >> 8) & 255) - ((b >> 8) & 255)) <= 8 && Math.abs((a & 255) - (b & 255)) <= 8

export const hexToInt = (hex: string) => Number.parseInt(hex.slice(1, 7), 16)

/** A color as 0xRRGGBB, each palette or ink hex parsed once. */
const intOf = new Map<string, number>()
const asInt = (hex: string) => {
  let n = intOf.get(hex)
  if (n === undefined) {
    n = hexToInt(hex)
    intOf.set(hex, n)
  }
  return n
}
const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)))

/** `darken` on 0xRRGGBB: each channel scaled by `k` and rounded. */
const darkenInt = (n: number, k: number) => (k === 1 ? n : (Math.round(((n >> 16) & 0xff) * k) << 16) | (Math.round(((n >> 8) & 0xff) * k) << 8) | Math.round((n & 0xff) * k))

/** The torch's color on the ground, by light level: light, then red, green, blue multipliers, straight between stops. */
const TORCH_RAMP: readonly (readonly [number, number, number, number])[] = [
  [0.15, 0.5, 0.55, 0.75],
  [0.45, 0.95, 0.75, 0.55],
  [0.8, 1.05, 0.95, 0.8],
  [1, 1.1, 1.05, 0.92],
]

/** What the torch multiplies the ground by at `light`: cool at the edge of its reach, orange, then a pale warm core. */
export const torchColor = (light: number): [number, number, number] => {
  const next = TORCH_RAMP.findIndex(stop => stop[0] >= light)
  if (next <= 0) return [...TORCH_RAMP[0]!.slice(1)] as [number, number, number]
  const a = TORCH_RAMP[next - 1]!
  const b = TORCH_RAMP[next]!
  const t = (light - a[0]) / (b[0] - a[0])
  return [a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, a[3] + (b[3] - a[3]) * t]
}

/** Lit 0xRRGGBB: the ground through the torch's color, a creature or item only dimmed, never below 70%. */
const lightInt = (n: number, light: number, isCreature: boolean) => {
  if (!isCreature) {
    const [kr, kg, kb] = torchColor(light)
    return (clamp(((n >> 16) & 0xff) * kr) << 16) | (clamp(((n >> 8) & 0xff) * kg) << 8) | clamp((n & 0xff) * kb)
  }
  const k = Math.max(0.7, light)
  return (clamp(((n >> 16) & 0xff) * k + light * 30) << 16) | (clamp(((n >> 8) & 0xff) * k + light * 18) << 8) | clamp((n & 0xff) * k)
}

/** An open side of a wall: its direction, the light on the floor there, whether the pixel lies within two of it. */
export type OpenSide = { dx: number; dy: number; light: number; near: boolean }

/**
 * A wall's light from the floor beside it, never through it: the brightest open side's, at full where the wall faces
 * `toHero` (the hero's direction from the wall) and 55% where it faces away, at 60% of that away from every open
 * side, never under the torch's floor. Undefined when no side is open.
 */
export const wallFaceLight = (open: readonly OpenSide[], toHero: Pos): number | undefined => {
  if (open.length === 0) return undefined
  const nx = open.reduce((sum, o) => sum + o.dx, 0)
  const ny = open.reduce((sum, o) => sum + o.dy, 0)
  const facing = Math.max(0, (nx * toHero.x + ny * toHero.y) / ((Math.hypot(nx, ny) || 1) * (Math.hypot(toHero.x, toHero.y) || 1)))
  const lit = Math.max(...open.map(o => o.light)) * (0.55 + 0.45 * facing)
  return Math.max(TORCH_FLOOR, open.some(o => o.near) ? lit : lit * 0.6)
}
const TORCH_FLOOR = 0.15

/** `memoryPixel` on 0xRRGGBB. */
const memoryInt = (n: number) => {
  const lum = (0.299 * ((n >> 16) & 0xff) + 0.587 * ((n >> 8) & 0xff) + 0.114 * (n & 0xff)) / 255
  const t = Math.min(1, lum * 1.6)
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t)
  return (mix(0x0e, 0x4a) << 16) | (mix(0x12, 0x5a) << 8) | mix(0x20, 0x8a)
}

/**
 * A tile's ground texture as 0xRRGGBB, PX by PX. Textures depend only on their kind and world pixel, never on the
 * game, so each tile's is worked out once and kept.
 */
/** A torch in its sconce on a wall: flame keys over the wall's own pixels. */
const TORCH_ART: readonly string[] = ['........', '...i....', '..iIi...', '...I....', '..WwW...', '...W....', '........', '........']

/** A wall torch's light at `d` tiles: a warm pool, full at the wall's foot, gone past 4 tiles, never above 85%. */
export const wallTorchLight = (d: number) => {
  const t = Math.max(0, 1 - d / 4)
  return 0.85 * t * t * (3 - 2 * t)
}

const torchesOf = new WeakMap<Level, Pos[]>()

/** The wall torches of a level: on the wall above about half its rooms, in the middle of the room's top side. */
export const wallTorchesOf = (world: number, depth: number, level: Level): Pos[] => {
  const known = torchesOf.get(level)
  if (known !== undefined) return known
  const torches = level.rooms
    .filter(r => hash(world * 7 + depth * 31, r.x, r.y) < 50)
    .map(r => ({ x: r.x + Math.floor(r.w / 2), y: r.y - 1 }))
    .filter(t => level.tiles[t.y]?.[t.x] === '#')
  torchesOf.set(level, torches)
  return torches
}

/** Small things left on the floor: a few pixels on the slab, palette keys as sprites use them. */
export const DECAL_ART: Readonly<Record<'bones' | 'rubble', readonly string[]>> = {
  bones: ['........', '........', '........', '........', '.o..o...', '..oO....', '.O..o...', '........'],
  rubble: ['........', '........', '........', '........', '........', '..e.....', '.eEe.E..', '........'],
}

/**
 * The decal on a room's floor tile, if any: bones or rubble, gathered by the walls, a chance of (rock beside it)^2
 * in 16: never in the open, 1 in 16 beside one wall, 1 in 4 in a corner.
 */
export const decalAt = (world: number, depth: number, level: Level, p: Pos): keyof typeof DECAL_ART | undefined => {
  if (!isFloor(level.tiles, p) || roomAt(level, p) === undefined) return undefined
  const rock = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => !isFloor(level.tiles, { x: p.x + dx!, y: p.y + dy! })).length
  const n = hash(world * 31 + depth * 7919 + 13, p.x, p.y)
  if (n >= (100 * rock * rock) / 16) return undefined
  return n % 2 === 0 ? 'bones' : 'rubble'
}

/** A tile's texture with its decal painted on, a copy; the texture as it is without one. */
const withDecal = (tex: Uint32Array, decal: keyof typeof DECAL_ART | undefined) => {
  if (decal === undefined) return tex
  const out = Uint32Array.from(tex)
  DECAL_ART[decal].forEach((row, y) => [...row].forEach((k, x) => {
    if (k !== '.') out[y * PX + x] = asInt(PAL[k] ?? '#ff00ff')
  }))
  return out
}

export { themeOf } from './map'
export type { Theme } from './map'
import type { Theme } from './map'
/** Each theme's weight on red, green and blue: the crypt as drawn, flooded halls cool and green, the forge red-black. */
const THEME_WEIGHTS: Readonly<Record<Theme, readonly [number, number, number]>> = { crypt: [1, 1, 1], flooded: [0.7, 0.95, 1.05], forge: [1.05, 0.65, 0.55] }
export const themed = (n: number, theme: Theme) => {
  const [r, g, b] = THEME_WEIGHTS[theme]
  return theme === 'crypt' ? n : (clamp(((n >> 16) & 0xff) * r) << 16) | (clamp(((n >> 8) & 0xff) * g) << 8) | clamp((n & 0xff) * b)
}

const groundCache = new Map<string, Uint32Array>()
const groundTexture = (kind: keyof typeof TERRAIN, p: Pos, theme: Theme = 'crypt') => {
  const key = `${kind}:${p.x}:${p.y}:${theme}`
  let tex = groundCache.get(key)
  if (tex === undefined) {
    tex = new Uint32Array(PX * PX)
    for (let ly = 0; ly < PX; ly += 1) for (let lx = 0; lx < PX; lx += 1) tex[ly * PX + lx] = themed(hexToInt(TERRAIN[kind](p.x * PX + lx, p.y * PX + ly)), theme)
    groundCache.set(key, tex)
  }
  return tex
}

const darken = (hex: string, k: number) => {
  if (k === 1) return hex
  const n = hexToInt(hex)
  const ch = (shift: number) => Math.round(((n >> shift) & 0xff) * k)
  return `#${[16, 8, 0].map(s => ch(s).toString(16).padStart(2, '0')).join('')}`
}

/** A remembered pixel: its brightness kept, its color drained to the cold blue of memory. */
export const memoryPixel = (hex: string) => {
  const n = hexToInt(hex)
  const lum = (0.299 * ((n >> 16) & 0xff) + 0.587 * ((n >> 8) & 0xff) + 0.114 * (n & 0xff)) / 255
  const t = Math.min(1, lum * 1.6)
  const mix = (a: number, b: number) => Math.round(a + (b - a) * t)
  return (mix(0x0e, 0x4a) << 16) | (mix(0x12, 0x5a) << 8) | mix(0x20, 0x8a)
}

/** Where a window of `span` pixels starts along an axis of `size`: centered on `at`, clamped to the map, centered on the map when it is the smaller. */
export const windowOrigin = (at: number, span: number, size: number) =>
  size <= span ? Math.floor((size - span) / 2) : Math.max(0, Math.min(at - Math.floor(span / 2), size - span))

type Located = Pick<Game, 'x' | 'y'> & Partial<Pick<Game, 'where'>>

/** The world the hero is in, in pixels: the dungeon level or the town. */
export const worldSize = (g: Partial<Pick<Game, 'where'>>) => (g.where === 'town' ? { w: TOWN_W * PX, h: TOWN_H * PX } : { w: MAP_W * PX, h: MAP_H * PX })

export const viewOrigin = (g: Located, width: number, height: number) => originAt({ x: g.x * PX + PX / 2, y: g.y * PX + PX / 2 }, width, height, worldSize(g))

/** The window's origin around a world-pixel point: what the camera follows while the hero walks. */
export const originAt = (center: Pos, width: number, height: number, size = worldSize({})) => ({
  x: windowOrigin(center.x, width, size.w),
  y: windowOrigin(center.y, height, size.h),
})

/** Half the size of the view's middle, in pixels: while the hero stays inside it, the camera holds still. */
export const deadZone = (width: number, height: number) => ({ x: Math.max(PX, Math.floor(width / 5)), y: Math.max(PX / 2, Math.floor(height / 5)) })

/** The camera's next center: unmoved while `hero` is in the dead zone, else moved just enough to bring him to its edge. */
export const followCamera = (camera: Pos, hero: Pos, width: number, height: number): Pos => {
  const zone = deadZone(width, height)
  const pull = (c: number, h: number, half: number) => (h > c + half ? h - half : h < c - half ? h + half : c)
  return { x: pull(camera.x, hero.x, zone.x), y: pull(camera.y, hero.y, zone.y) }
}

/**
 * The view's camera: it moves only in whole tiles, one at a time, once the hero is half a tile past the middle
 * (`followCamera` rounded to a tile line); `null` starts it on the tile line nearest the hero. Scrolling a pixel or two a
 * frame changes almost every cell on screen, more than the host gets out to the terminal in a frame; a tile at a time
 * leaves the frames between jumps changing only around the hero.
 */
export const tileCamera = (camera: Pos | null, hero: Pos, width: number, height: number): Pos => {
  if (camera === null) return { x: Math.round(hero.x / PX) * PX, y: Math.round(hero.y / PX) * PX }
  const pulled = followCamera(camera, hero, width, height)
  // Whole tiles toward the pull, a pull of half a tile or more counting as one, the same either way.
  const step = (c: number, p: number) => c + Math.sign(p - c) * Math.floor((Math.abs(p - c) + PX / 2) / PX) * PX
  return { x: step(camera.x, pulled.x), y: step(camera.y, pulled.y) }
}

/** A tile takes 4 frames: the hero moves exactly PX / 4 = 2 pixels every frame, never standing still or jumping. */
export const FRAMES_PER_TILE = 4
const STEP_PX = PX / FRAMES_PER_TILE

/** Where along `path` (tiles, first the start) the hero's center is `frame` frames into the walk: straight lines. */
export const walkPosition = (path: readonly Pos[], frame: number) => {
  const legs = Math.max(0, path.length - 1)
  const f = Math.min(legs * FRAMES_PER_TILE, Math.max(0, Math.floor(frame)))
  const leg = Math.min(Math.max(0, legs - 1), Math.floor(f / FRAMES_PER_TILE))
  const from = path[leg] ?? { x: 0, y: 0 }
  const to = path[leg + 1] ?? from
  const k = f - leg * FRAMES_PER_TILE
  return { x: from.x * PX + PX / 2 + (to.x - from.x) * k * STEP_PX, y: from.y * PX + PX / 2 + (to.y - from.y) * k * STEP_PX, isDone: f >= legs * FRAMES_PER_TILE }
}

/**
 * A long walk for measuring: from the hero out to the farthest explored floor and back, as often as it takes, `tiles`
 * single steps. Only explored floor, as a real walk, so the ground scrolls under the camera and the torch moves.
 */
export const benchRoute = (g: Game, tiles: number): Pos[] => {
  const explored = levelOf(g).tiles.map((row, y) => [...row].map((t, x) => (g.seen[y * MAP_W + x] === '1' ? t : '#')).join(''))
  const paths = explored.flatMap((row, y) => [...row].flatMap((t, x) => (t === '.' ? [bfs(explored, g, { x, y })] : [])))
  const there = paths.reduce<Pos[]>((best, p) => (p !== null && p.length > best.length ? p : best), [{ x: g.x, y: g.y }])
  const leg = there.length > 1 ? [...there.slice(1), ...there.slice(0, -1).reverse()] : []
  const route: Pos[] = [{ x: g.x, y: g.y }]
  for (let i = 0; route.length <= tiles && leg.length > 0; i += 1) route.push(leg[i % leg.length]!)
  return route
}

/**
 * The game as drawn `frame` frames into a walk. The game settles a walk at once, its pickups and the strike that ends it
 * included; on screen each pickup stays on the floor until the drawn hero reaches its tile, and the foe stays as it
 * was until the walk is over.
 */
export const walkingGame = (g: Game, start: Pick<Game, 'taken' | 'foe'>, path: readonly Pos[], frame: number): Game => {
  const along = Math.floor(Math.max(0, frame) / FRAMES_PER_TILE)
  if (along >= path.length - 1) return g
  // The same game object for every frame of a tile, so what is drawn from it can be kept for that tile.
  const last = lastWalking
  if (last !== null && last.g === g && last.start === start && last.path === path && last.along === along) return last.drawn
  const ahead = new Set(path.slice(along + 1).map(cellId))
  const drawn = { ...g, taken: g.taken.filter(id => start.taken.includes(id) || !ahead.has(id)), foe: start.foe }
  lastWalking = { g, start, path, along, drawn }
  return drawn
}
/** The last walk state handed out, so every frame on a tile gets the same game and what is drawn of it is kept. */
let lastState: { tile: Game; foe: Game['foe']; state: Game } | null = null

/**
 * The game as a walk stands at `frame`: the start until the hero reaches the first tile, then the game on the last tile
 * he has reached (`tiles`, each tile's own, the last the action's end), with the foe there now, one met mid-walk too.
 */
export const walkState = (start: Game, tiles: readonly Game[], frame: number): Game => {
  const reached = Math.min(Math.floor(Math.max(0, frame) / FRAMES_PER_TILE), tiles.length)
  if (reached === 0) return start
  const tile = tiles[reached - 1]!
  if (tile.foe === start.foe) return tile
  if (lastState !== null && lastState.tile === tile && lastState.foe === start.foe) return lastState.state
  const state = { ...tile, foe: start.foe }
  lastState = { tile, foe: start.foe, state }
  return state
}

let lastWalking: { g: Game; start: Pick<Game, 'taken' | 'foe'>; path: readonly Pos[]; along: number; drawn: Game } | null = null

const terrainOf = (level: Level, tile: Tile, p: Pos): keyof typeof TERRAIN => {
  if (same(p, level.stairs)) return 'stairs'
  if (tile.surface === 'wall' || tile.surface === 'door' || tile.surface === 'passage') return tile.surface
  return 'floor'
}

const artOf = (g: Game, tile: Tile): readonly string[] | undefined => {
  const o = tile.occupant
  if (o === undefined) return undefined
  if (o.kind === 'hero') return heroArt(g)
  if (o.kind === 'foe') return monsterArt(o.glyph, themeOf(g.depth)) ?? UNKNOWN_ART
  return THING_ART[o.glyph]
}

type Scene = { g: Game; level: Level; tiles: Map<number, TileInfo>; visible: ReadonlySet<number>; hero: Pos; isLit: boolean; isHeroMoved: boolean; lights: readonly Pos[]; torchIds: ReadonlySet<number> }

/**
 * What every pixel of one tile needs, worked out once a frame per tile so the per-pixel work allocates nothing: the
 * tile, whether its occupant is drawn over the ground, its art, its terrain and texture, and which sides touch rock.
 */
type TileInfo = {
  tile: Tile
  isForeground: boolean
  isShown: boolean
  art: readonly string[] | undefined
  kind: keyof typeof TERRAIN
  tex: Uint32Array
  rock: { left: boolean; right: boolean; up: boolean; down: boolean }
}

const tileInfo = (s: Scene, tx: number, ty: number): TileInfo => {
  const id = ty * MAP_W + tx
  const cached = s.tiles.get(id)
  if (cached !== undefined) return cached
  const p = { x: tx, y: ty }
  const tile = tileAt(s.g, s.level, s.visible, p)
  const isForeground = tile.occupant !== undefined && !(tile.occupant.kind === 'thing' && tile.occupant.glyph === '>') && !(s.isHeroMoved && tile.occupant.kind === 'hero')
  const kind = terrainOf(s.level, tile, p)
  const isRock = (dx: number, dy: number) => !isFloor(s.level.tiles, { x: tx + dx, y: ty + dy })
  const info: TileInfo = {
    tile,
    isForeground,
    isShown: tile.surface !== 'unseen' && tile.surface !== 'void',
    art: isForeground ? artOf(s.g, tile) : undefined,
    kind,
    tex: withDecal(groundTexture(kind, p, themeOf(s.g.depth)), kind === 'floor' ? decalAt(s.g.world, s.g.depth, s.level, p) : undefined),
    rock: { left: isRock(-1, 0), right: isRock(1, 0), up: isRock(0, -1), down: isRock(0, 1) },
  }
  s.tiles.set(id, info)
  return info
}

/** Pixels from a floor pixel to the nearest rock, looking at the four neighbouring cells. */
const rockDistance = (rock: TileInfo['rock'], lx: number, ly: number) =>
  Math.min(rock.left ? lx : 99, rock.right ? PX - 1 - lx : 99, rock.up ? ly : 99, rock.down ? PX - 1 - ly : 99)

const spritePixel = (s: Scene, tile: Tile, key: string, light: number) => {
  const n = asInt(PAL[key] ?? '#ff00ff')
  if (tile.isVisible) return s.isLit ? lightInt(n, light, true) : n
  return tile.occupant?.kind === 'foe' ? asInt(INK.sensed) : memoryInt(n)
}

/** One pixel of the world at world pixel `x`, `y`. */
const worldPixel = (s: Scene, x: number, y: number) => {
  const tx = Math.floor(x / PX)
  const ty = Math.floor(y / PX)
  const isInside = x >= 0 && y >= 0 && tx < MAP_W && ty < MAP_H
  if (!isInside) return asInt(CANVAS)
  const info = tileInfo(s, tx, ty)
  const { tile, isForeground, isShown } = info
  if (!isShown && !(isForeground && tile.occupant?.kind === 'foe')) return asInt(CANVAS)
  const lx = x - tx * PX
  const ly = y - ty * PX
  // The hero's torch and the wall torches together: the brightest of them lights the pixel.
  let light = torch(Math.hypot(x - s.hero.x, y - s.hero.y) / PX)
  for (const l of s.lights) light = Math.max(light, wallTorchLight(Math.hypot(x - l.x, y - l.y) / PX))
  if (s.torchIds.has(ty * MAP_W + tx)) {
    const flame = TORCH_ART[ly]?.[lx] ?? '.'
    if (flame !== '.') return tile.isVisible ? asInt(PAL[flame] ?? '#ff00ff') : memoryInt(asInt(PAL[flame] ?? '#ff00ff'))
  }
  const key = info.art?.[ly]?.[lx] ?? '.'
  if (key !== '.') return spritePixel(s, tile, key, light)
  if (!isShown) return asInt(CANVAS)
  const shade = (isForeground ? dropShadow(lx, ly) : 1) * (info.kind === 'wall' ? 1 : wallOcclusion(rockDistance(info.rock, lx, ly)))
  const ground = darkenInt(info.tex[ly * PX + lx] ?? 0, shade)
  if (!tile.isVisible) return memoryInt(ground)
  if (!s.isLit) return ground
  return lightInt(ground, info.kind === 'wall' ? (wallLight(s, info, tx, ty, lx, ly) ?? light) : light, false)
}

/** A wall pixel's light: its open sides (floor beside it), each lit as the torch lights that floor's center. */
const wallLight = (s: Scene, info: TileInfo, tx: number, ty: number, lx: number, ly: number) => {
  const side = (dx: number, dy: number, isOpen: boolean, near: boolean): OpenSide[] =>
    isOpen ? [{ dx, dy, near, light: torch(Math.hypot((tx + dx) * PX + PX / 2 - s.hero.x, (ty + dy) * PX + PX / 2 - s.hero.y) / PX) }] : []
  const open = [
    ...side(-1, 0, !info.rock.left, lx < 2),
    ...side(1, 0, !info.rock.right, lx > PX - 3),
    ...side(0, -1, !info.rock.up, ly < 2),
    ...side(0, 1, !info.rock.down, ly > PX - 3),
  ]
  return wallFaceLight(open, { x: s.hero.x - (tx * PX + PX / 2), y: s.hero.y - (ty * PX + PX / 2) })
}

/** Room around the window a kept layer covers: a tile each way, as far as the camera can move while the torch holds. */
const LAYER_MARGIN = PX
type Layer = { g: Game; torchX: number; torchY: number; isLit: boolean; isHeroMoved: boolean; lights: readonly Pos[]; x: number; y: number; w: number; h: number; px: Uint32Array }
/** The last layer drawn with the hero in it and the last without, so the bob's two phases each keep theirs. */
const lastLayers = new Map<boolean, Layer>()

/**
 * The lit world around a window, kept while nothing that colors it changes: the same game object (games are never
 * changed in place), the torch on the same tile, the same light. A window inside it is cut from it; else it is redrawn.
 */
const worldLayer = (g: Game, level: Level, torchAt: Pos, isLit: boolean, isHeroMoved: boolean, origin: Pos, width: number, height: number, torches: readonly Pos[]): Layer => {
  const l = lastLayers.get(isHeroMoved)
  const isKept = l !== undefined && l.g === g && l.torchX === torchAt.x && l.torchY === torchAt.y && l.isLit === isLit && l.isHeroMoved === isHeroMoved && l.lights === torches
  if (isKept && origin.x >= l.x && origin.y >= l.y && origin.x + width <= l.x + l.w && origin.y + height <= l.y + l.h) return l
  // Each wall torch lights from the foot of its wall, each brazier from its own tile.
  const lights = [...torches.map(t => ({ x: t.x * PX + PX / 2, y: t.y * PX + PX })), ...braziersOf(g.world, g.depth, level).map(b => ({ x: b.x * PX + PX / 2, y: b.y * PX + PX / 2 }))]
  const s: Scene = { g, level, tiles: new Map(), visible: visibleSet(g, level), hero: torchAt, isLit, isHeroMoved, lights, torchIds: new Set(torches.map(cellId)) }
  const x = origin.x - LAYER_MARGIN
  const y = origin.y - LAYER_MARGIN
  const w = width + 2 * LAYER_MARGIN
  const h = height + 2 * LAYER_MARGIN
  const px = new Uint32Array(w * h)
  for (let ly = 0; ly < h; ly += 1) for (let lx = 0; lx < w; lx += 1) px[ly * w + lx] = worldPixel(s, x + lx, y + ly)
  const layer = { g, torchX: torchAt.x, torchY: torchAt.y, isLit, isHeroMoved, lights: torches, x, y, w, h, px }
  lastLayers.set(isHeroMoved, layer)
  return layer
}

/** Mid-walk the hero is drawn at his pixel, over whatever ground lies there; the rules already put him on his tile. */
/** The stride pose: the hero's art with the two feet of its bottom row a pixel further apart; art without two bare feet as it is. */
export const strideOf = (art: readonly string[]): readonly string[] => {
  const feet = art[PX - 1] ?? ''
  const isTwoFeet = feet[1] === '.' && feet[2] !== '.' && feet[3] === '.' && feet[4] === '.' && feet[5] !== '.' && feet[6] === '.'
  return isTwoFeet ? [...art.slice(0, PX - 1), `.${feet[2]}....${feet[5]}.`] : art
}

/** Two poses held 2 frames each, so a tile's 4 frames are stride, stride, stand, stand; frame 0 stands. */
export const isStrideFrame = (frame: number) => frame > 0 && Math.floor((frame - 1) / 2) % 2 === 0

/** Frames a blow's first frame is held, by kind: a crit and a kill land with weight; a plain hit or a blow taken plays straight on. */
const FREEZE: Readonly<Record<Hit['kind'], number>> = { crit: 3, kill: 4, hit: 0, hurt: 0, loot: 0 }
export const hitFreeze = (hits: readonly Hit[]) => Math.max(0, ...hits.map(h => FREEZE[h.kind]))
/** How many frames an exchange's blows play, its freeze included. */
export const hitFramesFor = (hits: readonly Hit[]) => HIT_FRAMES + hitFreeze(hits)

/** How far the hero lunges toward the foe on each frame of a blow, from frame 1; home after. */
export const LUNGE: readonly number[] = [2, 2, 1]

/** The hero's offset on a frame of a blow they dealt: toward the struck tile; none for a blow taken. */
const lungeOf = (g: Game, hits: readonly Hit[], hitFrame: number): Pos => {
  const blow = hits.find(h => h.kind !== 'hurt' && h.kind !== 'loot')
  const d = LUNGE[hitFrame - 1] ?? 0
  return blow === undefined || d === 0 ? { x: 0, y: 0 } : { x: Math.sign(blow.at.x - g.x) * d, y: Math.sign(blow.at.y - g.y) * d }
}

const drawHeroAt = (frame: Uint32Array, g: Game, width: number, height: number, hero: Pos, origin: Pos, isLit: boolean, stride = false) =>
  (stride ? strideOf(heroArt(g)) : heroArt(g)).forEach((row, dy) => [...row].forEach((key, dx) => {
    const x = hero.x - PX / 2 + dx - origin.x
    const y = hero.y - PX / 2 + dy - origin.y
    if (key !== '.' && x >= 0 && x < width && y >= 0 && y < height) frame[y * width + x] = hexToInt(isLit ? lightPixel(PAL[key] ?? '#ff00ff', 1, true) : (PAL[key] ?? '#ff00ff'))
  }))

/** The town by day: its window cut from the town's picture, then the hero with his shadow; no torch and no fog. */
const townFrame = (g: Game, width: number, height: number, heroAt: Pos | undefined, camera: Pos | undefined, stride: boolean, shimmer: boolean) => {
  const hero = heroAt ?? { x: g.x * PX + PX / 2, y: g.y * PX + PX / 2 }
  const origin = originAt(camera ?? hero, width, height, worldSize(g))
  const img = townImage(shimmer)
  const frame = new Uint32Array(width * height)
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const wx = origin.x + x
    const wy = origin.y + y
    const isInside = wx >= 0 && wy >= 0 && wx < TOWN_PX_W && wy < TOWN_PX_H
    frame[y * width + x] = isInside ? (img[wy * TOWN_PX_W + wx] ?? 0) : hexToInt(CANVAS)
  }
  if (heroAt === undefined) {
    // Standing still, the hero casts the same shadow as everyone in town.
    const left = g.x * PX - origin.x
    const top = g.y * PX - origin.y
    for (let ly = 0; ly < PX; ly += 1) for (let lx = 0; lx < PX; lx += 1) {
      const x = left + lx
      const y = top + ly
      const d = dropShadow(lx, ly)
      if (d < 1 && x >= 0 && x < width && y >= 0 && y < height) frame[y * width + x] = hexToInt(darken(`#${(frame[y * width + x] ?? 0).toString(16).padStart(6, '0')}`, d))
    }
  }
  drawHeroAt(frame, g, width, height, hero, origin, false, stride)
  return frame
}

/**
 * The world seen from above at PX pixels a cell, `width` by `height` pixels, the window following the hero:
 * 0xRRGGBB per pixel, row-major. `isLit: false` leaves torchlight off, every visible pixel its own color.
 */
export const frameOf = (
  g: Game,
  width: number,
  height: number,
  { isLit = true, heroAt: walkingAt, camera, hits = [], hitFrame: rawHitFrame = 0, lights, stride: isStriding = false, bob = false, shimmer = false }: { isLit?: boolean; heroAt?: Pos; camera?: Pos; hits?: readonly Hit[]; hitFrame?: number; lights?: readonly Pos[]; stride?: boolean; bob?: boolean; shimmer?: boolean } = {},
) => {
  // Standing idle, the bob lifts the hero a pixel off their tile.
  const idleAt = walkingAt ?? (bob ? { x: g.x * PX + PX / 2, y: g.y * PX + PX / 2 - 1 } : undefined)
  if (g.where === 'town') return townFrame(g, width, height, idleAt, camera, isStriding, shimmer)
  const level = levelOf(g)
  // The freeze holds the blow's first frame, then plays the rest as it would have.
  const freeze = hitFreeze(hits)
  const hitFrame = rawHitFrame <= freeze ? Math.min(1, rawHitFrame) : rawHitFrame - freeze
  // A lunge draws the hero off their tile, in the stride, as a walk does.
  const lunge = walkingAt === undefined ? lungeOf(g, hits, hitFrame) : { x: 0, y: 0 }
  const isLunging = lunge.x !== 0 || lunge.y !== 0
  const heroAt = isLunging ? { x: g.x * PX + PX / 2 + lunge.x, y: g.y * PX + PX / 2 + lunge.y } : idleAt
  const stride = isStriding || isLunging
  const hero = heroAt ?? { x: g.x * PX + PX / 2, y: g.y * PX + PX / 2 }
  const origin = originAt(camera ?? walkingAt ?? { x: g.x * PX + PX / 2, y: g.y * PX + PX / 2 }, width, height)
  // The torch sits on the tile nearest the drawn hero, so a walk re-lights the ground once a tile, not every frame.
  // In a room it stands at the room's middle: the room is lit as a whole and holds still while the hero crosses it, where
  // a torch moving with him re-lit some 1,100 cells a tile, four times a corridor's.
  const heroTile = { x: Math.floor(hero.x / PX), y: Math.floor(hero.y / PX) }
  const inRoom = roomAt(level, heroTile)
  const torchAt = inRoom === undefined
    ? { x: heroTile.x * PX + PX / 2, y: heroTile.y * PX + PX / 2 }
    : { x: (inRoom.x + Math.floor(inRoom.w / 2)) * PX + PX / 2, y: (inRoom.y + Math.floor(inRoom.h / 2)) * PX + PX / 2 }
  const layer = worldLayer(g, level, torchAt, isLit, heroAt !== undefined, origin, width, height, lights ?? wallTorchesOf(g.world, g.depth, level))
  const frame = new Uint32Array(width * height)
  for (let y = 0; y < height; y += 1) {
    const from = (origin.y - layer.y + y) * layer.w + (origin.x - layer.x)
    frame.set(layer.px.subarray(from, from + width), y * width)
  }
  if (heroAt !== undefined) drawHeroAt(frame, g, width, height, hero, origin, isLit, stride)
  const isNemesis = g.foe?.nemesis === true
  if (g.foe !== null) foeBar(frame, width, height, g.foe.x * PX - origin.x, g.foe.y * PX - origin.y, g.foe.hp / g.foe.maxHp, g.foe.champion !== undefined || g.foe.boss === true || g.foe.unique !== undefined, isNemesis ? NEMESIS_MARK : CHAMPION_MARK)
  // A crown over a boss, a unique and (in red) a nemesis: the foes that are someone.
  if (g.foe !== null && (g.foe.boss === true || g.foe.unique !== undefined || isNemesis)) drawCrown(frame, width, height, g.foe.x * PX - origin.x, g.foe.y * PX - origin.y, isNemesis ? NEMESIS_MARK : undefined)
  // A beam first, so the kill's number stands over it.
  for (const hit of [...hits.filter(h => h.kind === 'loot'), ...hits.filter(h => h.kind !== 'loot')]) drawHit(frame, width, height, g, hit, hitFrame, origin)
  return frame
}

/** What one action did, to show: a blow on the foe (a hit, a crit, a kill) or the hero hurt, where and how much. */
/** A blow, or (`loot`) a drop of Rare or better from the foe slain there, `tier` its rarity. */
export type Hit = { at: Pos; amount: number; kind: 'hit' | 'crit' | 'kill' | 'hurt' | 'loot'; tier?: Rarity }

/**
 * The blows between two games in the same place: the foe's HP lost (a crit when the hero's last lines say so), the
 * foe slain, the hero's HP lost. Nothing across a change of place, where there is nothing left to point at.
 */
export const hitsBetween = (before: Game, after: Game): Hit[] => {
  if (before.where !== after.where || before.depth !== after.depth) return []
  const lines = after.log.slice(-4)
  const hits: Hit[] = []
  const foe = before.foe
  if (foe !== null && after.foe !== null && after.foe.hp < foe.hp) {
    hits.push({ at: { x: foe.x, y: foe.y }, amount: foe.hp - after.foe.hp, kind: lines.some(l => l.startsWith('You CRITICALLY hit')) ? 'crit' : 'hit' })
  }
  if (foe !== null && after.foe === null && lines.some(l => l.startsWith('You slay'))) {
    hits.push({ at: { x: foe.x, y: foe.y }, amount: foe.hp, kind: 'kill' })
    // The best drop of the kill, Rare or better, stands as a beam where the foe fell.
    const fresh = after.log.slice(after.log.length - after.fresh)
    const tier = BEAM_TIERS.find(t => fresh.some(l => l.startsWith('Loot: ') && l.endsWith(` (${t[0]!.toUpperCase()}${t.slice(1)}).`)))
    if (tier !== undefined) hits.push({ at: { x: foe.x, y: foe.y }, amount: 0, kind: 'loot', tier })
  }
  if (after.hp < before.hp) hits.push({ at: { x: after.x, y: after.y }, amount: before.hp - after.hp, kind: 'hurt' })
  return hits
}

/** How long a blow shows, in frames: about 0.6 s at 30 frames a second. */
export const HIT_FRAMES = 18
const HIT_COLOR: Readonly<Record<Hit['kind'], string>> = { hit: '#ffffff', crit: '#ffd34d', kill: '#ffd34d', hurt: '#ff4a4a', loot: '#ffffff' }
export const hitColor = (kind: Hit['kind']) => HIT_COLOR[kind]

/** How far the number has risen at `frame`: a pixel every 2 frames, after a 3-frame hold on a crit or a kill. */
export const hitRise = (kind: Hit['kind'], frame: number) => Math.max(0, Math.floor((frame - (kind === 'crit' || kind === 'kill' ? 3 : 0)) / 2))

/** A blow on the frame: the foe white for its first 2 frames when struck, then the number rising over the tile. */
/** The tiers that raise a beam, best first, and each beam's width in pixels: wider the rarer. */
const BEAM_TIERS: readonly Rarity[] = ['legendary', 'epic', 'rare']
export const BEAM_W: Readonly<Partial<Record<Rarity, number>>> = { rare: 2, epic: 4, legendary: 6 }
/** How tall a beam grows, a few pixels a frame, and the frames it fades over at the end. */
export const BEAM_H = 28
const BEAM_GROW = 4
const BEAM_FADE = 6

const blend = (under: number, over: number, t: number) => {
  const ch = (c: number, s: number) => Math.round(((c >> s) & 0xff) * (1 - t) + ((over >> s) & 0xff) * t)
  return (ch(under, 16) << 16) | (ch(under, 8) << 8) | ch(under, 0)
}

/** A beam of light in the tier's color rising from the tile, its core brighter, a spark at its top; fading at the end. */
const drawBeam = (frame: Uint32Array, width: number, height: number, hit: Hit, hitFrame: number, left: number, top: number) => {
  const tier = hit.tier ?? 'rare'
  const w = BEAM_W[tier] ?? 2
  const color = hexToInt(RARITY_COLOR[tier])
  const core = blend(color, 0xffffff, 0.6)
  const tall = Math.min(BEAM_H, hitFrame * BEAM_GROW)
  const fade = Math.max(0, Math.min(1, (HIT_FRAMES - hitFrame) / BEAM_FADE))
  const x0 = left + Math.floor((PX - w) / 2)
  const bottom = top + PX - 1
  for (let dy = 0; dy < tall; dy += 1) {
    // Strongest at the ground, thinning as it rises.
    const strength = fade * (0.85 - (0.45 * dy) / BEAM_H)
    for (let dx = 0; dx < w; dx += 1) {
      const x = x0 + dx
      const y = bottom - dy
      if (x < 0 || x >= width || y < 0 || y >= height) continue
      const isCore = w > 2 && (dx === Math.floor(w / 2) - 1 || dx === Math.floor(w / 2))
      frame[y * width + x] = blend(frame[y * width + x]!, isCore ? core : color, strength)
    }
  }
  const sparkY = bottom - tall
  if (fade > 0 && hitFrame % 4 < 2) for (const [dx, dy] of [[0, 0], [-1, 1], [1, 1], [0, 2]] as const) {
    const x = x0 + Math.floor(w / 2) + dx - (w % 2 === 0 ? 1 : 0)
    const y = sparkY + dy
    if (x >= 0 && x < width && y >= 0 && y < height) frame[y * width + x] = blend(frame[y * width + x]!, 0xffffff, fade)
  }
}

const drawHit = (frame: Uint32Array, width: number, height: number, g: Game, hit: Hit, hitFrame: number, origin: Pos) => {
  const put = (x: number, y: number, color: number) => {
    if (x >= 0 && x < width && y >= 0 && y < height) frame[y * width + x] = color
  }
  const left = hit.at.x * PX - origin.x
  const top = hit.at.y * PX - origin.y
  if (hit.kind === 'loot') {
    drawBeam(frame, width, height, hit, hitFrame, left, top)
    return
  }
  const foe = g.foe
  if ((hit.kind === 'hit' || hit.kind === 'crit') && hitFrame <= 2 && foe !== null && same(foe, hit.at)) {
    const art = monsterArt(foe.glyph, themeOf(g.depth)) ?? UNKNOWN_ART
    art.forEach((row, dy) => [...row].forEach((k, dx) => k !== '.' && put(left + dx, top + dy, 0xffffff)))
  }
  const mask = textMask(String(hit.amount))
  const w = mask[0]?.length ?? 0
  const x0 = left + Math.floor((PX - w) / 2)
  // Clear of the foe's bar (3 px over the tile) from the first frame, outline included.
  const y0 = top - 9 - hitRise(hit.kind, hitFrame)
  const on = (x: number, y: number) => mask[y]?.[x] === '#'
  const ink = hexToInt(hitColor(hit.kind))
  const outline = hexToInt(POPUP_OUTLINE)
  mask.forEach((row, y) => [...row].forEach((_, x) => {
    if (!on(x, y)) return
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) if (!on(x + ox, y + oy)) put(x0 + x + ox, y0 + y + oy, outline)
  }))
  mask.forEach((row, y) => [...row].forEach((k, x) => k === '#' && put(x0 + x, y0 + y, ink)))
}

export const FOE_BAR_FILL = '#e05a4a'
export const FOE_BAR_EMPTY = '#3a1e22'
/** The foe's bar spans the tile less a pixel each side. */
export const FOE_BAR_W = PX - 2

/** The foe's health, 10 px across on a dark backing, just above its tile: there only while there is a foe. */
/** A nemesis's marks, its pips and its crown: red, where a champion's pips and a boss's crown are gold. */
export const NEMESIS_MARK = '#ff4a4a'

const foeBar = (frame: Uint32Array, width: number, height: number, left: number, top: number, share: number, isChampion: boolean, pip = CHAMPION_MARK) => {
  const put = (x: number, y: number, hex: string) => {
    if (x >= 0 && x < width && y >= 0 && y < height) frame[y * width + x] = hexToInt(hex)
  }
  const filled = Math.round(Math.max(0, Math.min(1, share)) * FOE_BAR_W)
  for (let i = 0; i < FOE_BAR_W; i += 1) put(left + 1 + i, top - 3, i < filled ? FOE_BAR_FILL : FOE_BAR_EMPTY)
  // A champion's bar ends in a gold pip each side: a foe worth the fight.
  if (isChampion) for (const x of [left, left + FOE_BAR_W + 1]) put(x, top - 3, pip)
}

/** A boss's crown, in the two pixel rows between its tile and its bar. */
const BOSS_CROWN: readonly string[] = ['.y.yy.y.', '.yyyyyy.']

const drawCrown = (frame: Uint32Array, width: number, height: number, left: number, top: number, ink?: string) =>
  BOSS_CROWN.forEach((row, dy) => [...row].forEach((k, dx) => {
    const x = left + dx
    const y = top - BOSS_CROWN.length + dy
    if (k !== '.' && x >= 0 && x < width && y >= 0 && y < height) frame[y * width + x] = hexToInt(ink ?? PAL[k] ?? '#ff00ff')
  }))

/** The pips that mark a champion's bar. */
export const CHAMPION_MARK = '#ffd34d'

/**
 * Packs a frame `columns` wide and `2 * rows` tall into Raster cells: an upper half block per cell, top pixel as ink,
 * bottom as paper. A cell whose two pixels are near the same color is a space on the bottom one instead, its unseen
 * ink the left cell's: the host writes a color only where it differs from the cell before, so flat cells cost it
 * neither a foreground nor a glyph's three bytes.
 */
export const rasterCells = (frame: Uint32Array, columns: number, rows: number) => {
  const words = new Uint32Array(columns * rows * 3)
  for (let y = 0; y < rows; y += 1) {
    let ink = frame[2 * y * columns] ?? 0
    for (let x = 0; x < columns; x += 1) {
      const at = (y * columns + x) * 3
      const top = frame[2 * y * columns + x] ?? 0
      const bottom = frame[(2 * y + 1) * columns + x] ?? 0
      const isFlat = isNear(top, bottom)
      words[at] = isFlat ? SPACE : HALF_BLOCK
      words[at + 1] = isFlat ? ink : top
      words[at + 2] = bottom
      ink = words[at + 1]!
    }
  }
  const bytes = new Uint8Array(words.buffer)
  // The runtime's own encoder, as the Raster docs use it; built by hand where a runtime has none.
  const native = (bytes as unknown as { toBase64?: () => string }).toBase64
  if (native !== undefined) return native.call(bytes)
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}

/** The map as a Raster's cells, `columns` by `rows` terminal cells. */
export type Ambient = { bob: boolean; shimmer: boolean }
export const STILL: Ambient = { bob: false, shimmer: false }

export const pixelMap = (g: Game, columns: number, rows: number, heroAt?: Pos, camera?: Pos, hits: readonly Hit[] = [], hitFrame = 0, stride = false, ambient: Ambient = STILL) =>
  rasterCells(frameOf(g, columns, rows * 2, { heroAt, camera, hits, hitFrame, stride, ...ambient }), columns, rows)

/**
 * The map tile under a click on the pixel map: `x`, `y` in cells of the map's region (fractions where the terminal
 * reports them), `columns` by `rows` that region's size. A cell is one pixel across and two down.
 */
export const clickToTile = (g: Located, click: { x: number; y: number; columns: number; rows: number }, camera?: Pos) => {
  const origin = camera === undefined ? viewOrigin(g, click.columns, click.rows * 2) : originAt(camera, click.columns, click.rows * 2, worldSize(g))
  const px = origin.x + Math.floor(click.x)
  const py = origin.y + Math.floor(click.y * 2)
  return { x: Math.floor(px / PX), y: Math.floor(py / PX) }
}
