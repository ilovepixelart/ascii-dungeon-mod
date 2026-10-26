import type { Foe, Game, Rarity } from '../types'
import { RARITY_COLOR } from './items'
import { levelOf } from './game'
import { MAP_H, MAP_W, bfs, braziersOf, cellId, isFloor, roomAt, same, themeOf } from './map'
import { hash } from './rng'
import type { Level, Pos } from './map'
import { CANVAS, INK } from './palette'
import { tileAt, visibleSet } from './panels'
import type { Tile } from './panels'
import { TOWN_H, TOWN_W } from './town'
import { TOWN_PX_H, TOWN_PX_W, townImage, wildsPixel } from './townpixels'
import { BOSS_HOLD, BOSS_KEYS, FOE_HOLD, FOE_KEYS, HERO_HOLD, HERO_KEYS, HERO_REST, bossFall, fallDim, foeFall, heroFall } from './fall'
import type { Pixel } from './fall'
import { MONSTER_ART, PAL, POPUP_OUTLINE, PX, foeArtOf, GROUND, TERRAIN, pillarShaft, THING_ART, BOSS_ART, UNKNOWN_ART, dropShadow, heroArt, lightPixel, textMask, torch, wallOcclusion } from './pixelart'

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
/**
 * Light in LIGHT_STEPS levels, from none to full: a torch moving a tile changes only the tiles whose level changes, and
 * every shade comes from a table. Each shade is snapped to the host's step of 17 a channel, what the terminal shows.
 */
export const LIGHT_STEPS = 8
export const lightStep = (light: number) => Math.round(Math.max(0, Math.min(1, light)) * (LIGHT_STEPS - 1)) / (LIGHT_STEPS - 1)
const HOST_STEP = 17
const snap = (n: number) => (Math.round(((n >> 16) & 0xff) / HOST_STEP) * HOST_STEP << 16) | (Math.round(((n >> 8) & 0xff) / HOST_STEP) * HOST_STEP << 8) | (Math.round((n & 0xff) / HOST_STEP) * HOST_STEP)
const shades = new Map<number, number>()
/** A color at a light level, from the table: worked out once for each color, level and kind of thing lit. */
const lightInt = (n: number, light: number, isCreature: boolean) => {
  const level = Math.round(Math.max(0, Math.min(1.2, light)) * (LIGHT_STEPS - 1))
  const key = (n * 32 + level) * 2 + (isCreature ? 1 : 0)
  let out = shades.get(key)
  if (out === undefined) {
    out = snap(shadeInt(n, level / (LIGHT_STEPS - 1), isCreature))
    shades.set(key, out)
  }
  return out
}
const shadeInt = (n: number, light: number, isCreature: boolean) => {
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
export const DECAL_ART = {
  bones: ['........', '........', '........', '........', '.o..o...', '..oO....', '.O..o...', '........'],
  cobweb: ['EeE.....', 'eE......', 'E.e.....', '..E.....', '........', '........', '........', '........'],
  algae: ['........', '........', '........', '...L....', '.LlL.L..', '..L.LlL.', '...L.L..', '........'],
  sprigs: ['........', '........', '........', '........', '.l...l..', '.lL.lL..', '..L..L..', '........'],
  tuft: ['........', '........', '........', '........', '.p...F..', 'pFp.FvF.', '.o...o..', '........'],
  spores: ['........', '........', '........', '...P....', '.P.xP...', '..xPx.c.', '...P....', '........'],
  frost: ['........', '........', '........', '..h.....', '.hHh.h..', '..h.hHh.', '.....h..', '........'],
  shards: ['........', '........', '........', '........', '..c.....', '.cC..c..', '.CC.cC..', '........'],
  slag: ['........', '........', '........', '........', '..EE....', '.EkEI...', '.kEEk...', '........'],
  soot: ['........', '........', '........', '........', '.K.K....', 'KkKkK...', '.KkK....', '........'],
} as const satisfies Readonly<Record<string, readonly string[]>>
type Decal = keyof typeof DECAL_ART

/** Each theme's two decals: bones and cobwebs in the crypt, algae and reed sprigs in the flooded halls, mushroom tufts
 * and spores in the fungal deep, frost and ice shards in the frozen caverns, slag and soot in the forge. */
export const THEME_DECALS: Readonly<Record<Theme, readonly [Decal, Decal]>> = {
  crypt: ['bones', 'cobweb'],
  flooded: ['algae', 'sprigs'],
  fungal: ['tuft', 'spores'],
  frozen: ['frost', 'shards'],
  forge: ['slag', 'soot'],
}

/**
 * The decal on a room's floor tile, if any: one of its theme's two, gathered by the walls, a chance of (rock beside
 * it)^2 in 16: never in the open, 1 in 16 beside one wall, 1 in 4 in a corner.
 */
export const decalAt = (world: number, depth: number, level: Level, p: Pos): Decal | undefined => {
  if (!isFloor(level.tiles, p) || roomAt(level, p) === undefined) return undefined
  const rock = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => !isFloor(level.tiles, { x: p.x + dx!, y: p.y + dy! })).length
  const n = hash(world * 31 + depth * 7919 + 13, p.x, p.y)
  if (n >= (100 * rock * rock) / 16) return undefined
  return THEME_DECALS[themeOf(depth)][n % 2]
}

/** A tile's texture with its decal painted on, a copy; the texture as it is without one. */
const withDecal = (tex: Uint32Array, decal: Decal | undefined) => {
  if (decal === undefined) return tex
  const out = Uint32Array.from(tex)
  DECAL_ART[decal].forEach((row, y) => [...row].forEach((k, x) => {
    if (k !== '.') out[y * PX + x] = asInt(PAL[k] ?? '#ff00ff')
  }))
  return out
}

export { themeOf } from './map'
export type { Theme } from './map'
import { GLOW } from './ui/glow'
import type { Theme } from './map'
/** Each theme's weight on red, green and blue: the crypt as drawn, flooded halls cool and green, the fungal deep
 * purple, the frozen caverns icy blue, the forge red-black. */
const THEME_WEIGHTS: Readonly<Record<Theme, readonly [number, number, number]>> = { crypt: [1, 1, 1], flooded: [0.7, 0.95, 1.05], fungal: [0.95, 0.8, 1.05], frozen: [0.8, 0.95, 1.2], forge: [1.05, 0.65, 0.55] }
export const themed = (n: number, theme: Theme) => {
  const [r, g, b] = THEME_WEIGHTS[theme]
  return theme === 'crypt' ? n : (clamp(((n >> 16) & 0xff) * r) << 16) | (clamp(((n >> 8) & 0xff) * g) << 8) | clamp((n & 0xff) * b)
}

const groundCache = new Map<number, Uint32Array>()
const TERRAIN_KINDS = Object.keys(TERRAIN) as (keyof typeof TERRAIN)[]
const THEME_ORDER: readonly Theme[] = ['crypt', 'flooded', 'fungal', 'frozen', 'forge']
/** A ground pixel in its theme: floor and wall the theme's own (`GROUND`), a pillar standing on its floor, the rest tinted. */
export const groundPixel = (kind: keyof typeof TERRAIN, x: number, y: number, theme: Theme) => {
  if (kind === 'floor' || kind === 'wall') return hexToInt(GROUND[theme][kind](x, y))
  if (kind !== 'pillar') return themed(hexToInt(TERRAIN[kind](x, y)), theme)
  const shaft = pillarShaft(x, y)
  return shaft === undefined ? hexToInt(GROUND[theme].floor(x, y)) : themed(hexToInt(shaft), theme)
}

const groundTexture = (kind: keyof typeof TERRAIN, p: Pos, theme: Theme = 'crypt') => {
  // A number for the kind, the cell (one tile of room each way past the map) and the theme.
  const key = ((((p.y + 1) * (MAP_W + 2) + p.x + 1) * TERRAIN_KINDS.length + TERRAIN_KINDS.indexOf(kind)) * THEME_ORDER.length) + THEME_ORDER.indexOf(theme)
  let tex = groundCache.get(key)
  if (tex === undefined) {
    tex = new Uint32Array(PX * PX)
    for (let ly = 0; ly < PX; ly += 1) for (let lx = 0; lx < PX; lx += 1) tex[ly * PX + lx] = groundPixel(kind, p.x * PX + lx, p.y * PX + ly, theme)
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

export const viewOrigin = (g: Located, width: number, height: number, covered = 0) => originAt({ x: g.x * PX + PX / 2, y: g.y * PX + PX / 2 }, width, height, worldSize(g), covered)

/** The window's origin around a world-pixel point: what the camera follows while the hero walks. `covered` pixels at
 * its bottom are hidden (the dash over the map): the window is centred and clamped on what stays seen, so it may run
 * past the world's bottom by them, its last row seen above them. */
export const originAt = (center: Pos, width: number, height: number, size = worldSize({}), covered = 0) => ({
  x: windowOrigin(center.x, width, size.w),
  y: windowOrigin(center.y, height - covered, size.h),
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
 * The view's camera: it holds while the hero is within the dead zone and half a tile, then pages: it jumps on a tile
 * line ahead of him, leaving him half a zone behind the middle, so he crosses a zone and a half before the next jump
 * and a step back does not jump it back. `null` starts it on the tile line nearest the hero. Every cell under a moving
 * camera changes: a tile at a time the bench walk jumped on 34 of 159 frames, 87% of its bytes; paging, on 5.
 */
export const tileCamera = (camera: Pos | null, hero: Pos, width: number, height: number): Pos => {
  if (camera === null) return { x: Math.round(hero.x / PX) * PX, y: Math.round(hero.y / PX) * PX }
  const zone = deadZone(width, height)
  const page = (c: number, h: number, half: number) =>
    Math.abs(h - c) < half + PX / 2 ? c : Math.round((h + Math.sign(h - c) * Math.floor(half / 2)) / PX) * PX
  return { x: page(camera.x, hero.x, zone.x), y: page(camera.y, hero.y, zone.y) }
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
export const walkingGame = (g: Game, start: Pick<Game, 'taken' | 'foe' | 'floor'>, path: readonly Pos[], frame: number): Game => {
  const along = Math.floor(Math.max(0, frame) / FRAMES_PER_TILE)
  if (along >= path.length - 1) return g
  // The same game object for every frame of a tile, so what is drawn from it can be kept for that tile.
  const last = lastWalking
  if (last !== null && last.g === g && last.start === start && last.path === path && last.along === along) return last.drawn
  const ahead = new Set(path.slice(along + 1).map(cellId))
  // An item picked up off the floor along the way lies there too until the hero reaches it.
  const pickedAhead = (start.floor ?? []).filter(f => !(g.floor ?? []).includes(f) && ahead.has(cellId(f)))
  const drawn = { ...g, taken: g.taken.filter(id => start.taken.includes(id) || !ahead.has(id)), floor: [...(g.floor ?? []), ...pickedAhead], foe: start.foe }
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

let lastWalking: { g: Game; start: Pick<Game, 'taken' | 'foe' | 'floor'>; path: readonly Pos[]; along: number; drawn: Game } | null = null

/** Rock with floor on all four sides: a pillar in a room, drawn as a column rather than a wall. */
export const isPillar = (level: Level, p: Pos) => !isFloor(level.tiles, p) && [[1, 0], [-1, 0], [0, 1], [0, -1]].every(([dx, dy]) => isFloor(level.tiles, { x: p.x + dx!, y: p.y + dy! }))

export const terrainOf = (level: Level, tile: Tile, p: Pos): keyof typeof TERRAIN => {
  if (same(p, level.stairs)) return 'stairs'
  if (tile.surface === 'wall' && isPillar(level, p)) return 'pillar'
  if (tile.surface === 'wall' || tile.surface === 'door' || tile.surface === 'passage') return tile.surface
  return 'floor'
}

/** The foe's art: a named foe its own, else its kind as the theme draws it. */
const foeArt = (g: Game): readonly string[] => (g.foe === null ? UNKNOWN_ART : foeArtOf({ ...g.foe, big: undefined }, themeOf(g.depth)))

/**
 * The foe as drawn over its tile: its art and where the art's top-left stands from the tile's. A big boss is 16 by 16,
 * its feet on its tile's bottom edge, half a tile out each side and a tile up; any other foe fills its tile.
 */
const foeSprite = (g: Game): { art: readonly string[]; dx: number; dy: number } =>
  g.foe?.big !== undefined ? { art: BOSS_ART[g.foe.big], dx: -PX / 2, dy: -PX } : { art: foeArt(g), dx: 0, dy: 0 }

/** A big boss over the ground, lit as the hero is: drawn after the ground, so the tiles round it do not cut it off. */
const drawBigBoss = (frame: Uint32Array, g: Game, width: number, height: number, origin: Pos, isLit: boolean) => {
  if (g.foe === null) return
  const { art, dx, dy } = foeSprite(g)
  art.forEach((row, y) => [...row].forEach((key, x) => {
    const px = g.foe!.x * PX + dx + x - origin.x
    const py = g.foe!.y * PX + dy + y - origin.y
    if (key !== '.' && px >= 0 && px < width && py >= 0 && py < height) frame[py * width + px] = hexToInt(isLit ? lightPixel(PAL[key] ?? '#ff00ff', 1, true) : (PAL[key] ?? '#ff00ff'))
  }))
}

const artOf = (g: Game, tile: Tile): readonly string[] | undefined => {
  const o = tile.occupant
  if (o === undefined) return undefined
  if (o.kind === 'hero') return heroArt(g)
  // A big boss is drawn over the ground in one piece, not in its tile.
  if (o.kind === 'foe') return g.foe?.big !== undefined ? undefined : foeArt(g)
  return THING_ART[o.glyph]
}

type Scene = { g: Game; level: Level; tiles: Map<number, TileInfo>; visible: ReadonlySet<number>; hero: Pos; isLit: boolean; isHeroMoved: boolean; lights: readonly Pos[]; torchIds: ReadonlySet<number>; tileLight: Map<number, number> }

/** A tile's light, the same over all its pixels: the brightest of the hero's light and the wall torches at its middle, in steps. */
const lightOfTile = (s: Scene, tx: number, ty: number) => {
  const id = ty * MAP_W + tx
  const known = s.tileLight.get(id)
  if (known !== undefined) return known
  const cx = tx * PX + PX / 2
  const cy = ty * PX + PX / 2
  let light = torch(Math.hypot(cx - s.hero.x, cy - s.hero.y) / PX)
  for (const l of s.lights) light = Math.max(light, wallTorchLight(Math.hypot(cx - l.x, cy - l.y) / PX))
  const stepped = lightStep(light)
  s.tileLight.set(id, stepped)
  return stepped
}

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

/** What never changes about a cell of a level: which sides touch rock, and its floor texture with any decal on it. */
type Cell = { rock: TileInfo['rock']; floor: Uint32Array }
const cellsOf = new WeakMap<Level, { world: number; depth: number; cells: Cell[] }>()
const cellOf = (g: Game, level: Level, tx: number, ty: number): Cell => {
  let known = cellsOf.get(level)
  if (known === undefined || known.world !== g.world || known.depth !== g.depth) {
    known = { world: g.world, depth: g.depth, cells: [] }
    cellsOf.set(level, known)
  }
  const id = (ty + 1) * (MAP_W + 2) + tx + 1
  const cached = known.cells[id]
  if (cached !== undefined) return cached
  const p = { x: tx, y: ty }
  const isRock = (dx: number, dy: number) => !isFloor(level.tiles, { x: tx + dx, y: ty + dy })
  const cell = {
    rock: { left: isRock(-1, 0), right: isRock(1, 0), up: isRock(0, -1), down: isRock(0, 1) },
    floor: withDecal(groundTexture('floor', p, themeOf(g.depth)), decalAt(g.world, g.depth, level, p)),
  }
  known.cells[id] = cell
  return cell
}

const tileInfo = (s: Scene, tx: number, ty: number): TileInfo => {
  const id = ty * MAP_W + tx
  const cached = s.tiles.get(id)
  if (cached !== undefined) return cached
  const p = { x: tx, y: ty }
  const tile = tileAt(s.g, s.level, s.visible, p, false)
  const isForeground = tile.occupant !== undefined && !(tile.occupant.kind === 'thing' && tile.occupant.glyph === '>') && !(s.isHeroMoved && tile.occupant.kind === 'hero')
  const kind = terrainOf(s.level, tile, p)
  const cell = cellOf(s.g, s.level, tx, ty)
  const info: TileInfo = {
    tile,
    isForeground,
    isShown: tile.surface !== 'unseen' && tile.surface !== 'void',
    art: isForeground ? artOf(s.g, tile) : undefined,
    kind,
    tex: kind === 'floor' ? cell.floor : groundTexture(kind, p, themeOf(s.g.depth)),
    rock: cell.rock,
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
  // The hero's torch and the wall torches together, a level a tile: the brightest of them at the tile's middle.
  const light = lightOfTile(s, tx, ty)
  const flame = s.torchIds.has(ty * MAP_W + tx) ? flamePixel(tile, lx, ly) : undefined
  if (flame !== undefined) return flame
  const key = info.art?.[ly]?.[lx] ?? '.'
  if (key !== '.') return spritePixel(s, tile, key, light)
  return isShown ? groundAt(s, info, tx, ty, lx, ly, light) : asInt(CANVAS)
}

/** A wall torch's flame at a pixel of its tile, in memory's colors out of sight; none where the flame is not. */
const flamePixel = (tile: Tile, lx: number, ly: number) => {
  const flame = TORCH_ART[ly]?.[lx] ?? '.'
  if (flame === '.') return undefined
  const color = asInt(PAL[flame] ?? '#ff00ff')
  return tile.isVisible ? color : memoryInt(color)
}

/**
 * The ground at a pixel of a shown tile: its texture, shaded by a foreground thing's shadow and by the rock beside it,
 * remembered out of sight, else lit, a wall by the light falling on its face.
 */
const groundAt = (s: Scene, info: ReturnType<typeof tileInfo>, tx: number, ty: number, lx: number, ly: number, light: number) => {
  const shade = (info.isForeground ? dropShadow(lx, ly) : 1) * (info.kind === 'wall' ? 1 : wallOcclusion(rockDistance(info.rock, lx, ly)))
  const ground = darkenInt(info.tex[ly * PX + lx] ?? 0, shade)
  if (!info.tile.isVisible) return memoryInt(ground)
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
/** A layer's pixels, and each tile's key (`tileKey`) as it was drawn, by its place counted from one tile outside the map. */
type Layer = { g: Game; level: Level; torchX: number; torchY: number; isLit: boolean; isHeroMoved: boolean; lights: readonly Pos[]; x: number; y: number; w: number; h: number; px: Uint32Array; keys: Map<number, string> }
/** The last layer drawn with the hero in it and the last without, so the bob's two phases each keep theirs. */
const lastLayers = new Map<boolean, Layer>()
let layerBuilds = 0
/** How many times the ground layer has been drawn afresh, for measuring what a frame that rebuilds it costs. */
export const layerBuildCount = () => layerBuilds

/** A number for each piece of art: art is kept, a look or a kind one array, so the same art is the same number. */
const artIds = new WeakMap<readonly string[], number>()
let artCount = 0
const artId = (art: readonly string[] | undefined) => {
  if (art === undefined) return 0
  const known = artIds.get(art)
  if (known !== undefined) return known
  artCount += 1
  artIds.set(art, artCount)
  return artCount
}

/** Everything a tile's pixels are worked out from in a layer, so a tile whose key is unchanged keeps its pixels. */
const tileKey = (s: Scene, tx: number, ty: number) => {
  if (tx < 0 || ty < 0 || tx >= MAP_W || ty >= MAP_H) return ''
  const info = tileInfo(s, tx, ty)
  const { tile } = info
  const o = tile.occupant
  // A wall's face reads the torch's place while a lit floor touches it; with none lit, its face is the floor light alone.
  const face = info.kind === 'wall' && tile.isVisible && s.isLit ? wallKey(s, info, tx, ty) : ''
  const occupant = o === undefined ? '' : `${o.kind}${o.glyph}`
  return `${tile.surface}${tile.isVisible ? 1 : 0}|${occupant}|${artId(info.art)}|${lightOfTile(s, tx, ty)}|${face}`
}

const wallKey = (s: Scene, info: TileInfo, tx: number, ty: number) => {
  const sides = [[-1, 0, info.rock.left], [1, 0, info.rock.right], [0, -1, info.rock.up], [0, 1, info.rock.down]] as const
  const lit = sides.map(([dx, dy, isRock]) => (isRock ? 0 : torch(Math.hypot((tx + dx) * PX + PX / 2 - s.hero.x, (ty + dy) * PX + PX / 2 - s.hero.y) / PX)))
  return lit.some(l => l > 0) ? `${lit.join(',')}@${s.hero.x},${s.hero.y}` : '-'
}

/**
 * The lit world around a window. Kept whole while nothing that colors it changes: the same game object (games are
 * never changed in place), the torch on the same tile, the same light, the window inside it. Otherwise it is drawn
 * again tile by tile: a tile whose key (`tileKey`) is what it was, inside the last layer, keeps its pixels; only the
 * rest are worked out afresh, so a step that moves the torch or the fog redraws only the tiles they touch.
 */
/** Whether the last layer serves as it is: the same game, torch, light and wall torches, and the window inside it. */
const isLayerKept = (l: Layer | undefined, g: Game, torchAt: Pos, isLit: boolean, torches: readonly Pos[], origin: Pos, width: number, height: number) =>
  l !== undefined && l.g === g && l.torchX === torchAt.x && l.torchY === torchAt.y && l.isLit === isLit && l.lights === torches &&
  origin.x >= l.x && origin.y >= l.y && origin.x + width <= l.x + l.w && origin.y + height <= l.y + l.h

/**
 * One tile of a new layer over its part of the window: copied a row at a time from the last layer when that holds it
 * whole under the same key, else drawn pixel by pixel.
 */
const fillTile = (px: Uint32Array, box: { x: number; y: number; w: number; h: number }, s: Scene, tx: number, ty: number, from: Layer | undefined, isSame: boolean) => {
  const { x, y, w, h } = box
  const x0 = Math.max(x, tx * PX)
  const x1 = Math.min(x + w, tx * PX + PX)
  const y0 = Math.max(y, ty * PX)
  const y1 = Math.min(y + h, ty * PX + PX)
  const isKeptTile = from !== undefined && isSame && x0 >= from.x && y0 >= from.y && x1 <= from.x + from.w && y1 <= from.y + from.h
  for (let wy = y0; wy < y1; wy += 1) {
    const at = (wy - y) * w - x
    // A plain copy: a row is 8 pixels, too few for a view of it to pay.
    if (isKeptTile) {
      const old = (wy - from.y) * from.w - from.x
      for (let wx = x0; wx < x1; wx += 1) px[at + wx] = from.px[old + wx]!
    } else for (let wx = x0; wx < x1; wx += 1) px[at + wx] = worldPixel(s, wx, wy)
  }
}

const worldLayer = (g: Game, level: Level, torchAt: Pos, isLit: boolean, isHeroMoved: boolean, origin: Pos, width: number, height: number, torches: readonly Pos[]): Layer => {
  const l = lastLayers.get(isHeroMoved)
  if (l !== undefined && isLayerKept(l, g, torchAt, isLit, torches, origin, width, height)) return l
  // Each wall torch lights from the foot of its wall, each brazier from its own tile.
  const lights = [...torches.map(t => ({ x: t.x * PX + PX / 2, y: t.y * PX + PX })), ...braziersOf(g.world, g.depth, level).map(b => ({ x: b.x * PX + PX / 2, y: b.y * PX + PX / 2 }))]
  const s: Scene = { g, level, tiles: new Map(), visible: visibleSet(g, level), hero: torchAt, isLit, isHeroMoved, lights, torchIds: new Set(torches.map(cellId)), tileLight: new Map() }
  const x = origin.x - LAYER_MARGIN
  const y = origin.y - LAYER_MARGIN
  const w = width + 2 * LAYER_MARGIN
  const h = height + 2 * LAYER_MARGIN
  const px = new Uint32Array(w * h)
  layerBuilds += 1
  const from = l !== undefined && l.level === level && l.isLit === isLit && l.lights === torches ? l : undefined
  const keys = new Map<number, string>()
  // Tile by tile over the window, each kept from the last layer where it can be (`fillTile`).
  const box = { x, y, w, h }
  for (let ty = Math.floor(y / PX); ty * PX < y + h; ty += 1) {
    for (let tx = Math.floor(x / PX); tx * PX < x + w; tx += 1) {
      const id = (ty + 1) * (MAP_W + 2) + tx + 1
      const key = tileKey(s, tx, ty)
      keys.set(id, key)
      fillTile(px, box, s, tx, ty, from, from?.keys.get(id) === key)
    }
  }
  const layer = { g, level, torchX: torchAt.x, torchY: torchAt.y, isLit, isHeroMoved, lights: torches, x, y, w, h, px, keys }
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
const FREEZE: Readonly<Record<Hit['kind'], number>> = { crit: 3, kill: 4, hit: 0, hurt: 0, loot: 0, death: 0, miss: 0, block: 0, ward: 0 }
export const hitFreeze = (hits: readonly Hit[]) => Math.max(0, ...hits.map(h => FREEZE[h.kind]))
/** The frames a death plays: a foe's crumble, a big boss's burst, the hero's fall and its rest; none for a blow. */
const deathFrames = (h: Hit) =>
  h.kind === 'death' ? HERO_KEYS * HERO_HOLD + HERO_REST : h.kind !== 'kill' || h.foe === undefined ? 0 : h.foe.big !== undefined ? BOSS_KEYS * BOSS_HOLD : FOE_KEYS * FOE_HOLD
/** How many frames an exchange's blows play, its freeze included: the longer of the numbers' rise and any death. */
export const hitFramesFor = (hits: readonly Hit[]) => Math.max(HIT_FRAMES, ...hits.map(deathFrames)) + hitFreeze(hits)

/** How far the hero lunges toward the foe on each frame of a blow, from frame 1; home after. */
export const LUNGE: readonly number[] = [2, 2, 1]

/** The hero's offset on a frame of a blow they dealt: toward the struck tile; none for a blow taken. */
const lungeOf = (g: Game, hits: readonly Hit[], hitFrame: number): Pos => {
  const blow = hits.find(h => h.kind !== 'hurt' && h.kind !== 'loot' && h.kind !== 'death')
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
/** A drop shadow on the town's ground under a tile at `left`, `top`. */
const townShadow = (frame: Uint32Array, width: number, height: number, left: number, top: number) => {
  for (let ly = 0; ly < PX; ly += 1) for (let lx = 0; lx < PX; lx += 1) {
    const x = left + lx
    const y = top + ly
    const d = dropShadow(lx, ly)
    if (d < 1 && x >= 0 && x < width && y >= 0 && y < height) frame[y * width + x] = hexToInt(darken(`#${(frame[y * width + x] ?? 0).toString(16).padStart(6, '0')}`, d))
  }
}

const townFrame = (g: Game, width: number, height: number, heroAt: Pos | undefined, camera: Pos | undefined, stride: boolean, shimmer: boolean, covered: number) => {
  const hero = heroAt ?? { x: g.x * PX + PX / 2, y: g.y * PX + PX / 2 }
  const origin = originAt(camera ?? hero, width, height, worldSize(g), covered)
  const img = townImage(shimmer)
  const frame = new Uint32Array(width * height)
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) {
    const wx = origin.x + x
    const wy = origin.y + y
    const isInside = wx >= 0 && wy >= 0 && wx < TOWN_PX_W && wy < TOWN_PX_H
    frame[y * width + x] = isInside ? (img[wy * TOWN_PX_W + wx] ?? 0) : wildsPixel(wx, wy)
  }
  // Standing still, the hero casts the same shadow as everyone in town.
  if (heroAt === undefined) townShadow(frame, width, height, g.x * PX - origin.x, g.y * PX - origin.y)
  drawHeroAt(frame, g, width, height, hero, origin, false, stride)
  return frame
}

/**
 * The world seen from above at PX pixels a cell, `width` by `height` pixels, the window following the hero:
 * 0xRRGGBB per pixel, row-major. `isLit: false` leaves torchlight off, every visible pixel its own color.
 */
/**
 * Where the hero is drawn this frame: walking, bobbing idle, or lunged off their tile toward a blow they dealt (in the
 * stride, as a walk is); undefined `heroAt` when they stand on their tile, drawn with the ground.
 */
const heroDrawn = (g: Game, hits: readonly Hit[], hitFrame: number, walkingAt: Pos | undefined, idleAt: Pos | undefined, isStriding: boolean) => {
  const lunge = walkingAt === undefined ? lungeOf(g, hits, hitFrame) : { x: 0, y: 0 }
  const isLunging = lunge.x !== 0 || lunge.y !== 0
  const heroAt = isLunging ? { x: g.x * PX + PX / 2 + lunge.x, y: g.y * PX + PX / 2 + lunge.y } : idleAt
  return { heroAt, stride: isStriding || isLunging, hero: heroAt ?? { x: g.x * PX + PX / 2, y: g.y * PX + PX / 2 } }
}

/**
 * Where the torch stands: on the tile nearest the drawn hero, so a walk re-lights the ground once a tile, not every
 * frame; in a room at the room's middle, lit as a whole and still while the hero crosses it, where a torch moving with
 * him re-lit some 1,100 cells a tile, four times a corridor's.
 */
const torchOf = (level: Level, hero: Pos): Pos => {
  const heroTile = { x: Math.floor(hero.x / PX), y: Math.floor(hero.y / PX) }
  const inRoom = roomAt(level, heroTile)
  return inRoom === undefined
    ? { x: heroTile.x * PX + PX / 2, y: heroTile.y * PX + PX / 2 }
    : { x: (inRoom.x + Math.floor(inRoom.w / 2)) * PX + PX / 2, y: (inRoom.y + Math.floor(inRoom.h / 2)) * PX + PX / 2 }
}

/** The foe's marks: its bar (a big boss's wider), gold pips on someone's (red on a nemesis), and a crown over a boss, a unique or a nemesis. */
const drawFoeMarks = (frame: Uint32Array, width: number, height: number, foe: Foe, origin: Pos) => {
  const isNemesis = foe.nemesis === true
  const left = foe.x * PX - origin.x
  const top = foe.y * PX - origin.y
  if (foe.big !== undefined) {
    bigBar(frame, width, height, left - PX / 2, top - PX, foe.hp / foe.maxHp)
    return
  }
  const isSomeone = foe.boss === true || foe.unique !== undefined || isNemesis
  foeBar(frame, width, height, left, top, foe.hp / foe.maxHp, foe.champion !== undefined || foe.boss === true || foe.unique !== undefined, isNemesis ? NEMESIS_MARK : CHAMPION_MARK)
  if (isSomeone) drawCrown(frame, width, height, left, top, isNemesis ? NEMESIS_MARK : undefined)
}

export const frameOf = (
  g: Game,
  width: number,
  height: number,
  { isLit = true, heroAt: walkingAt, camera, hits = [], hitFrame: rawHitFrame = 0, lights, stride: isStriding = false, bob = false, shimmer = false, covered = 0 }: { isLit?: boolean; heroAt?: Pos; camera?: Pos; hits?: readonly Hit[]; hitFrame?: number; lights?: readonly Pos[]; stride?: boolean; bob?: boolean; shimmer?: boolean; covered?: number } = {},
) => {
  // Standing idle, the bob lifts the hero a pixel off their tile.
  const idleAt = walkingAt ?? (bob ? { x: g.x * PX + PX / 2, y: g.y * PX + PX / 2 - 1 } : undefined)
  if (g.where === 'town') return townFrame(g, width, height, idleAt, camera, isStriding, shimmer, covered)
  const level = levelOf(g)
  // The freeze holds the blow's first frame, then plays the rest as it would have.
  const freeze = hitFreeze(hits)
  const hitFrame = rawHitFrame <= freeze ? Math.min(1, rawHitFrame) : rawHitFrame - freeze
  const { heroAt, stride, hero } = heroDrawn(g, hits, hitFrame, walkingAt, idleAt, isStriding)
  const origin = originAt(camera ?? walkingAt ?? { x: g.x * PX + PX / 2, y: g.y * PX + PX / 2 }, width, height, worldSize(g), covered)
  const torchAt = torchOf(level, hero)
  // A falling hero is drawn by the fall alone.
  const dying = hits.find(h => h.kind === 'death')
  const layer = worldLayer(g, level, torchAt, isLit, heroAt !== undefined || dying !== undefined, origin, width, height, lights ?? wallTorchesOf(g.world, g.depth, level))
  const frame = new Uint32Array(width * height)
  for (let y = 0; y < height; y += 1) {
    const from = (origin.y - layer.y + y) * layer.w + (origin.x - layer.x)
    frame.set(layer.px.subarray(from, from + width), y * width)
  }
  // A big boss spills half a tile onto its sides: the hero beside it is drawn again over it.
  if (g.foe?.big !== undefined) drawBigBoss(frame, g, width, height, origin, isLit)
  if (dying === undefined && (heroAt !== undefined || g.foe?.big !== undefined)) drawHeroAt(frame, g, width, height, hero, origin, isLit, stride)
  if (g.foe !== null) drawFoeMarks(frame, width, height, g.foe, origin)
  // A beam first, so the kill's number stands over it.
  for (const hit of [...hits.filter(h => h.kind === 'loot'), ...hits.filter(h => h.kind !== 'loot')]) drawHit(frame, width, height, g, hit, hitFrame, origin)
  if (dying !== undefined) dim(frame, fallDim(Math.floor(hitFrame / HERO_HOLD)))
  return frame
}

/** The whole frame darkened toward black by `t`. */
const dim = (frame: Uint32Array, t: number) => {
  if (t > 0) frame.forEach((n, i) => (frame[i] = blend(n, 0, t)))
}

const litKey = (k: string) => lightPixel(PAL[k] ?? '#ff00ff', 1, true)

/** A death's keyframe laid over the frame, from `left`, `top`. */
const drawFall = (frame: Uint32Array, width: number, height: number, pixels: readonly Pixel[], left: number, top: number) => {
  for (const p of pixels) {
    const x = left + p.x
    const y = top + p.y
    if (x >= 0 && x < width && y >= 0 && y < height) frame[y * width + x] = hexToInt(p.hex)
  }
}

/** What one action did, to show: a blow on the foe (a hit, a crit, a kill) or the hero hurt, where and how much. */
/** A blow, or (`loot`) a drop of Rare or better from the foe slain there, `tier` its rarity; a kill keeps the foe as it stood, to show it fall; `death`, the hero's. */
export type Hit = { at: Pos; amount: number; kind: 'hit' | 'crit' | 'kill' | 'hurt' | 'loot' | 'death' | 'miss' | 'block' | 'ward'; tier?: Rarity; foe?: Foe }

/** A blow that came to nothing, as its word rises where it would have struck. */
const WORD: Partial<Record<Hit['kind'], string>> = { miss: 'MISS', block: 'BLOCK', ward: 'WARD' }

/** The lines that tell a blow came to nothing: the hero's dodged, passing through or shield-turned; the foe's turned by the hero's shield or absorbed by a ward. */
const NOTHING: readonly [RegExp, 'miss' | 'block' | 'ward', 'foe' | 'hero'][] = [
  [/ darts aside\.$|your blow passes through\.$/, 'miss', 'foe'],
  [/'s shield turns your blow\.$/, 'block', 'foe'],
  [/^Your shield turns /, 'block', 'hero'],
  [/^Your ward absorbs /, 'ward', 'hero'],
]

/**
 * The blows between two games in the same place: the foe's HP lost (a crit when the hero's last lines say so), the
 * foe slain, a blow that came to nothing (missed, blocked, warded), the blows the hero took. Nothing across a
 * change of place, where there is nothing left to point at.
 */
/** The blows of an action that came to nothing, by its own lines: the foe's side first, so the hero's lunge goes the way of his own blow. */
const nothingHits = (before: Game, after: Game): Hit[] => {
  const fresh = after.log.slice(after.log.length - after.fresh)
  const told = NOTHING.filter(([said]) => fresh.some(l => said.test(l)))
  const onFoe = before.foe === null ? [] : told.filter(t => t[2] === 'foe').map(([, kind]) => ({ at: { x: before.foe!.x, y: before.foe!.y }, amount: 0, kind }))
  const onHero = told.filter(t => t[2] === 'hero').map(([, kind]) => ({ at: { x: after.x, y: after.y }, amount: 0, kind }))
  return [...onFoe, ...onHero]
}

export const hitsBetween = (before: Game, after: Game): Hit[] => {
  // A death is told across the change of place: the hero falls where they were struck, on the level they left.
  if (after.deaths > before.deaths && after.fallen !== undefined) return [{ at: after.fallen.at, amount: 0, kind: 'death' }]
  if (before.where !== after.where || before.depth !== after.depth) return []
  const lines = after.log.slice(-4)
  const hits: Hit[] = []
  const foe = before.foe
  if (foe !== null && after.foe !== null && after.foe.hp < foe.hp) {
    hits.push({ at: { x: foe.x, y: foe.y }, amount: foe.hp - after.foe.hp, kind: lines.some(l => l.startsWith('You CRITICALLY hit')) ? 'crit' : 'hit' })
  }
  // A kill always pays XP, where smoke does not; the log keeps too few lines to be sure to hold the kill's.
  if (foe !== null && after.foe === null && (after.xp !== before.xp || after.level !== before.level)) {
    hits.push({ at: { x: foe.x, y: foe.y }, amount: foe.hp, kind: 'kill', foe })
    // The best drop of the kill, Rare or better, stands as a beam where the foe fell.
    const fresh = after.log.slice(after.log.length - after.fresh)
    const tier = BEAM_TIERS.find(t => fresh.some(l => l.startsWith('Loot: ') && l.endsWith(` (${t[0]!.toUpperCase()}${t.slice(1)}).`)))
    if (tier !== undefined) hits.push({ at: { x: foe.x, y: foe.y }, amount: 0, kind: 'loot', tier })
  }
  hits.push(...nothingHits(before, after))
  // The blows the hero took, as their lines tell them: a potion, a heal or a shrine on the same action can leave his
  // HP no lower, the blow still taken; harm with no such line (a trap) is the HP lost.
  const fresh = after.log.slice(after.log.length - after.fresh)
  const struck = fresh.reduce((sum, l) => sum + Number(/ strikes you for (\d+)/.exec(l)?.[1] ?? 0), 0)
  const hurt = struck > 0 ? struck : before.hp - after.hp
  if (hurt > 0) hits.push({ at: { x: after.x, y: after.y }, amount: hurt, kind: 'hurt' })
  return hits
}

/** What the hero's fall plays on: the level they died on, before they woke, them where they were struck and the foe that struck them as it stood. */
export const deathScene = (before: Game, after: Game): Game | undefined =>
  after.deaths > before.deaths && after.fallen !== undefined ? { ...before, ...after.fallen.at, hp: 0, foe: after.fallen.foe ?? null, panel: 'none' } : undefined

/** How long a blow shows, in frames: about 0.6 s at 30 frames a second. */
export const HIT_FRAMES = 18
const HIT_COLOR: Readonly<Record<Hit['kind'], string>> = { hit: '#ffffff', crit: '#ffd34d', kill: '#ffd34d', hurt: '#ff4a4a', loot: '#ffffff', death: '#ff4a4a', miss: '#c8c8d4', block: '#9ab8e8', ward: '#7fe3ff' }
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
  for (let dy = 0; dy < tall; dy += 1) drawBeamRow(frame, width, height, { x0, y: bottom - dy, w, color, core }, fade * (0.85 - (0.45 * dy) / BEAM_H))
  if (fade > 0 && hitFrame % 4 < 2) drawSpark(frame, width, height, x0 + Math.floor(w / 2) - (w % 2 === 0 ? 1 : 0), bottom - tall, fade)
}

/** One row of a beam, `strength` over the frame: strongest at the ground, thinning as it rises; the core, the two middle columns of a wide one, brighter. */
const drawBeamRow = (frame: Uint32Array, width: number, height: number, row: { x0: number; y: number; w: number; color: number; core: number }, strength: number) => {
  const { x0, y, w } = row
  if (y < 0 || y >= height) return
  for (let dx = 0; dx < w; dx += 1) {
    const x = x0 + dx
    const isCore = w > 2 && (dx === Math.floor(w / 2) - 1 || dx === Math.floor(w / 2))
    if (x >= 0 && x < width) frame[y * width + x] = blend(frame[y * width + x]!, isCore ? row.core : row.color, strength)
  }
}

/** The spark at a beam's top: a small diamond of white, as faded as the beam. */
const drawSpark = (frame: Uint32Array, width: number, height: number, cx: number, top: number, fade: number) => {
  for (const [dx, dy] of [[0, 0], [-1, 1], [1, 1], [0, 2]] as const) {
    const x = cx + dx
    const y = top + dy
    if (x >= 0 && x < width && y >= 0 && y < height) frame[y * width + x] = blend(frame[y * width + x]!, 0xffffff, fade)
  }
}

/** A pixel set, when it falls inside the frame. */
const putPixel = (frame: Uint32Array, width: number, height: number, x: number, y: number, color: number) => {
  if (x >= 0 && x < width && y >= 0 && y < height) frame[y * width + x] = color
}

/** A slain foe falling where it stood: a big boss bursting over its two tiles, any other crumbling on its own. */
const drawSlain = (frame: Uint32Array, width: number, height: number, g: Game, slain: Foe, hitFrame: number, left: number, top: number) => {
  if (slain.big !== undefined) drawFall(frame, width, height, bossFall(BOSS_ART[slain.big], Math.floor(hitFrame / BOSS_HOLD), litKey), left - PX / 2, top - PX)
  else drawFall(frame, width, height, foeFall(foeArtOf(slain, themeOf(g.depth)), Math.floor(hitFrame / FOE_HOLD), litKey), left, top)
}

/** A blow's number, or its word when it came to nothing, rising over the tile in the blow's color, outlined; clear of the foe's bar (3 px over the tile) from the first frame. */
const drawNumber = (frame: Uint32Array, width: number, height: number, hit: Hit, hitFrame: number, left: number, top: number) => {
  const mask = textMask(WORD[hit.kind] ?? String(hit.amount))
  const x0 = left + Math.floor((PX - (mask[0]?.length ?? 0)) / 2)
  const y0 = top - 9 - hitRise(hit.kind, hitFrame)
  const on = (x: number, y: number) => mask[y]?.[x] === '#'
  const ink = hexToInt(hitColor(hit.kind))
  const outline = hexToInt(POPUP_OUTLINE)
  mask.forEach((row, y) => [...row].forEach((_, x) => {
    if (!on(x, y)) return
    for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) if (!on(x + ox, y + oy)) putPixel(frame, width, height, x0 + x + ox, y0 + y + oy, outline)
  }))
  mask.forEach((row, y) => [...row].forEach((k, x) => k === '#' && putPixel(frame, width, height, x0 + x, y0 + y, ink)))
}

const drawHit = (frame: Uint32Array, width: number, height: number, g: Game, hit: Hit, hitFrame: number, origin: Pos) => {
  const left = hit.at.x * PX - origin.x
  const top = hit.at.y * PX - origin.y
  if (hit.kind === 'loot') {
    drawBeam(frame, width, height, hit, hitFrame, left, top)
    return
  }
  if (hit.kind === 'death') {
    // Away from what struck them.
    const side = g.foe !== null && g.foe.x > hit.at.x ? -1 : 1
    drawFall(frame, width, height, heroFall(heroArt(g), Math.floor(hitFrame / HERO_HOLD), litKey, side), left, top)
    return
  }
  if (hit.kind === 'kill' && hit.foe !== undefined) drawSlain(frame, width, height, g, hit.foe, hitFrame, left, top)
  // The struck foe white for the blow's first frames.
  const foe = g.foe
  if ((hit.kind === 'hit' || hit.kind === 'crit') && hitFrame <= 2 && foe !== null && same(foe, hit.at)) {
    const { art, dx: ox, dy: oy } = foeSprite(g)
    art.forEach((row, dy) => [...row].forEach((k, dx) => k !== '.' && putPixel(frame, width, height, left + ox + dx, top + oy + dy, 0xffffff)))
  }
  drawNumber(frame, width, height, hit, hitFrame, left, top)
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

/** A big boss's bar: as wide as the boss less a pixel each side, over its head, gold pips at its ends. */
export const BIG_BAR_W = 2 * PX - 2
const bigBar = (frame: Uint32Array, width: number, height: number, left: number, top: number, share: number) => {
  const put = (x: number, y: number, hex: string) => {
    if (x >= 0 && x < width && y >= 0 && y < height) frame[y * width + x] = hexToInt(hex)
  }
  const filled = Math.round(Math.max(0, Math.min(1, share)) * BIG_BAR_W)
  for (let i = 0; i < BIG_BAR_W; i += 1) put(left + 1 + i, top - 3, i < filled ? FOE_BAR_FILL : FOE_BAR_EMPTY)
  for (const x of [left, left + BIG_BAR_W + 1]) put(x, top - 3, CHAMPION_MARK)
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

/**
 * Cells with a frame's number stamped into the first cell, for measuring: a space on a background of blue 255, green 0
 * and red 17 times the number modulo 16. The host rounds every channel to a step of 17, so only such values reach the
 * terminal whole, as `48;2;<17k>;0;255`; the cell changes every frame, so it is always sent, and a measure unwraps the
 * count from the low four bits.
 */
const STAMP_STEP = 17
export const stampCells = (cells: string, n: number) => {
  const bytes = Uint8Array.from(atob(cells), c => c.charCodeAt(0))
  const words = new Uint32Array(bytes.buffer)
  const color = ((STAMP_STEP * (n % 16)) << 16) | 0xff
  words[0] = SPACE
  words[1] = color
  words[2] = color
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(binary)
}
/** The number modulo 16 a stamped frame carries, or undefined for one without a stamp. */
export const stampOf = (cells: string) => {
  const words = new Uint32Array(Uint8Array.from(atob(cells.slice(0, 16)), c => c.charCodeAt(0)).buffer.slice(0, 12))
  const bg = words[2] ?? 0
  const red = bg >> 16
  return (bg & 0xffff) === 0xff && red % STAMP_STEP === 0 && words[0] === SPACE ? red / STAMP_STEP : undefined
}

/** The map as a Raster's cells, `columns` by `rows` terminal cells. */
export type Ambient = { bob: boolean; shimmer: boolean }
export const STILL: Ambient = { bob: false, shimmer: false }

/** A rectangle of a frame's pixels. */
export type PixelRect = { x: number; y: number; w: number; h: number }

/** The frame with `r` lit for the hover in white, as the windows light theirs (`GLOW`). */
const lightRect = (frame: Uint32Array, width: number, height: number, r: PixelRect) => {
  for (let y = Math.max(0, r.y); y < Math.min(height, r.y + r.h); y += 1) {
    for (let x = Math.max(0, r.x); x < Math.min(width, r.x + r.w); x += 1) {
      const isEdge = x === r.x || x === r.x + r.w - 1 || y === r.y || y === r.y + r.h - 1
      frame[y * width + x] = blend(frame[y * width + x]!, 0xffffff, isEdge ? GLOW.edge : GLOW.inside)
    }
  }
  return frame
}

/** The map's cells; `lit`, the tile under the pointer, lit for the hover over everything else. */
export const pixelMap = (g: Game, columns: number, rows: number, heroAt?: Pos, camera?: Pos, hits: readonly Hit[] = [], hitFrame = 0, stride = false, ambient: Ambient = STILL, lit?: PixelRect, over?: Over, covered = 0) =>
  pixelMapFrame(g, columns, rows, heroAt, camera, hits, hitFrame, stride, ambient, lit, over, covered).cells

/** The map's Raster cells and the frame they pack, for what is written over it to take its ground from. */
/** What a caller paints over the map's frame last, `height` pixels tall: the dash standing over its bottom. */
export type Over = (frame: Uint32Array, height: number) => void

export const pixelMapFrame = (g: Game, columns: number, rows: number, heroAt?: Pos, camera?: Pos, hits: readonly Hit[] = [], hitFrame = 0, stride = false, ambient: Ambient = STILL, lit?: PixelRect, over?: Over, covered = 0) => {
  const drawn = frameOf(g, columns, rows * 2, { heroAt, camera, hits, hitFrame, stride, ...ambient, covered })
  const frame = lit === undefined ? drawn : lightRect(drawn, columns, rows * 2, lit)
  over?.(frame, rows * 2)
  return { cells: rasterCells(frame, columns, rows), frame }
}

/** A map label's place and rows, in the map's cells: each row padded a cell each side to the widest, one block. */
export type LabelBlock = { x: number; y: number; lines: readonly string[] }
export const labelWidth = (lines: readonly string[]) => Math.max(...lines.map(l => l.length)) + 2

/** The label's row under a cell of the map, or undefined off the label. */
export const labelRowAt = (label: LabelBlock, at: Pos): number | undefined =>
  at.x >= label.x && at.x < label.x + labelWidth(label.lines) && at.y >= label.y && at.y < label.y + label.lines.length ? at.y - label.y : undefined

/** How much darker than the map under it a label's ground is: enough for its names to read, the art still showing. */
export const LABEL_SHADE = 0.6
/** How far toward white the row the pointer is on is lit, over its ground. */
export const LABEL_LIT = 0.25

/** The ground under each cell of a label, row by row, from the map's frame `columns` wide: the cell's two pixels
 * averaged and darkened by LABEL_SHADE, the row `lit` then LABEL_LIT toward white, on the Raster's 17-step grid as it
 * paints them. */
export const labelGrounds = (frame: Uint32Array, columns: number, label: LabelBlock, lit?: number): string[][] =>
  label.lines.map((_, r) => Array.from({ length: labelWidth(label.lines) }, (__, i) => {
    const x = label.x + i
    const y = label.y + r
    const top = frame[2 * y * columns + x] ?? 0
    const bottom = frame[(2 * y + 1) * columns + x] ?? 0
    const channel = (shift: number) => {
      const shaded = ((((top >> shift) & 0xff) + ((bottom >> shift) & 0xff)) / 2) * (1 - LABEL_SHADE)
      const toned = r === lit ? shaded + (255 - shaded) * LABEL_LIT : shaded
      return Math.round(toned / 17) * 17
    }
    return `#${[16, 8, 0].map(s => channel(s).toString(16).padStart(2, '0')).join('')}`
  }))

/**
 * The map tile under a click on the pixel map: `x`, `y` in cells of the map's region (fractions where the terminal
 * reports them), `columns` by `rows` that region's size. A cell is one pixel across and two down.
 */
export const clickToTile = (g: Located, click: { x: number; y: number; columns: number; rows: number; covered?: number }, camera?: Pos) => {
  const origin = camera === undefined ? viewOrigin(g, click.columns, click.rows * 2, click.covered) : originAt(camera, click.columns, click.rows * 2, worldSize(g), click.covered)
  const px = origin.x + Math.floor(click.x)
  const py = origin.y + Math.floor(click.y * 2)
  return { x: Math.floor(px / PX), y: Math.floor(py / PX) }
}

/** A tile's pixels on the map, `size` its cells, the camera at `camera`: what the hover lights. */
export const tileRect = (g: Located, tile: Pos, size: { columns: number; rows: number; covered?: number }, camera?: Pos): PixelRect => {
  const origin = camera === undefined ? viewOrigin(g, size.columns, size.rows * 2, size.covered) : originAt(camera, size.columns, size.rows * 2, worldSize(g), size.covered)
  return { x: tile.x * PX - origin.x, y: tile.y * PX - origin.y, w: PX, h: PX }
}

/** Where a tile's top-left lands on the map, in its cells: `clickToTile` the other way. */
export const tileToCell = (g: Located, tile: Pos, size: { columns: number; rows: number; covered?: number }, camera?: Pos): Pos => {
  const origin = camera === undefined ? viewOrigin(g, size.columns, size.rows * 2, size.covered) : originAt(camera, size.columns, size.rows * 2, worldSize(g), size.covered)
  return { x: tile.x * PX - origin.x, y: Math.floor((tile.y * PX - origin.y) / 2) }
}

/**
 * Where a floor label's rows go on a map `size` cells, its tile's top-left at `at`: stacked over the tile, the last
 * row just above it (under the tile where the rows above are too few), held inside the map; each cut to fit with an
 * ellipsis, a label being four cells wider than its longest row (a cell of room and a frame each side).
 */
export const mapLabelAt = (at: Pos, names: readonly string[], size: { columns: number; rows: number }): { x: number; y: number; lines: string[] } => {
  const room = Math.max(1, size.columns - 4)
  const lines = names.map(name => (name.length <= room ? name : `${name.slice(0, room - 1)}…`))
  const widest = Math.max(...lines.map(l => l.length))
  const y = at.y >= lines.length ? at.y - lines.length : at.y + PX / 2
  return { x: Math.max(0, Math.min(at.x, size.columns - widest - 4)), y: Math.max(0, Math.min(y, size.rows - lines.length)), lines }
}
