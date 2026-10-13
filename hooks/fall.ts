// Deaths as they play on the map, a keyframe at a time: a foe crumbling to dust, a big boss cracking with light and
// bursting, the hero toppling into a pool. Pure: each keyframe is the pixels to lay over the frame, from the sprite's
// top-left, in colors; the map lights the sprite's own colors before they come here.

export type Pixel = { x: number; y: number; hex: string }

/** Keyframes and the frames each is held, at 30 frames a second: a foe in about half a second, a big boss and the hero in over a second. */
export const FOE_KEYS = 7
export const FOE_HOLD = 2
export const BOSS_KEYS = 12
export const BOSS_HOLD = 3
export const HERO_KEYS = 8
export const HERO_HOLD = 3
/** The fallen hero lies this many frames more before the death window opens. */
export const HERO_REST = 12

const WHITE = '#ffffff'
const RED = '#e05a4a'
const GOLD = '#ffd34d'
const DUST = '#8a8494'
const DARK = '#1a1418'
const GROUND = '#2a2632'
const ASH = '#3a3440'
const POOL = '#7a1f28'
const POOL_EDGE = '#5a1a20'
const RING = '#fff4c0'

/** A fixed scatter in [0, 1) for a pixel and a purpose, so a death plays the same every time. */
const scatter = (x: number, y: number, s = 0) => (((x * 73856093) ^ (y * 19349663) ^ (s * 83492791)) >>> 0) % 1000 / 1000

export const mix = (a: string, b: string, t: number) => {
  const ch = (h: string, i: number) => parseInt(h.slice(1 + i * 2, 3 + i * 2), 16)
  return `#${[0, 1, 2].map(i => Math.round(ch(a, i) * (1 - t) + ch(b, i) * t).toString(16).padStart(2, '0')).join('')}`
}

type Lit = (key: string) => string
const each = (art: readonly string[], f: (key: string, x: number, y: number) => Pixel | undefined): Pixel[] =>
  art.flatMap((row, y) => [...row].flatMap((k, x) => {
    if (k === '.') return []
    const p = f(k, x, y)
    return p === undefined ? [] : [p]
  }))

/** A foe's death at keyframe `key`: white, then red, then it crumbles, its pixels dropping out and falling, dust on the floor fading. */
export const foeFall = (art: readonly string[], key: number, lit: Lit): Pixel[] => {
  if (key === 0) return each(art, (_, x, y) => ({ x, y, hex: WHITE }))
  if (key === 1) return each(art, (k, x, y) => ({ x, y, hex: mix(lit(k), RED, 0.6) }))
  if (key >= FOE_KEYS) return []
  const t = (key - 1) / 5
  const bottom = art.length - 1
  const body = each(art, (k, x, y) => {
    if (scatter(x, y) < t * 1.1) return undefined
    const fall = Math.min(bottom - y, Math.floor(t * t * 10 * (0.5 + scatter(x, y, 1))))
    return { x, y: y + fall, hex: mix(lit(k), DARK, t * 0.8) }
  })
  const width = art[0]?.length ?? 0
  const dust = key >= FOE_KEYS - 1 ? [] : Array.from({ length: width - 2 }, (_, i) => i + 1)
    .filter(x => scatter(x, key, 2) < 0.5 * (1 - t) + 0.2)
    .map(x => ({ x, y: bottom, hex: mix(DUST, GROUND, t) }))
  return [...body, ...dust]
}

/** The boss shaking a pixel each way, flashing white on every other keyframe. */
const bossShake = (art: readonly string[], key: number, lit: Lit) => {
  const dx = key % 2 === 0 ? -1 : 1
  return each(art, (k, x, y) => ({ x: x + dx, y, hex: key % 2 === 0 ? WHITE : lit(k) }))
}

/** Gold cracks spreading from the boss's middle three cells a keyframe, along its middle lines and diagonal and here and there, the rest whitening. */
const bossCracks = (art: readonly string[], key: number, lit: Lit, cx: number, cy: number) => {
  const reach = (key - 3) * 3
  return each(art, (k, x, y) => {
    const isOnLine = scatter(x, y, 3) < 0.25 || x === cx || y === cy || x - cx === y - cy
    const isCrack = Math.abs(x - cx) + Math.abs(y - cy) <= reach && isOnLine
    return { x, y, hex: isCrack ? GOLD : mix(lit(k), WHITE, (key - 3) * 0.12) }
  })
}

/** The burst: shards flying out from the middle and falling, fading to the ground, with a ring of light for its first three keyframes. */
const bossBurst = (art: readonly string[], key: number, lit: Lit, cx: number, cy: number) => {
  const t = (key - 6) / 5
  const shards = each(art, (k, x, y) => {
    if (scatter(x, y, 4) < t * 0.9) return undefined
    const v = (0.6 + scatter(x, y, 5) * 1.2) * 1.6 * t
    return { x: Math.round(x + (x - cx + 0.5) * v), y: Math.round(y + (y - cy + 0.5) * v + t * t * 6), hex: mix(scatter(x, y, 6) < 0.3 ? GOLD : lit(k), GROUND, t * 0.9) }
  })
  const r = key - 7
  const ring = r > 2 ? [] : Array.from({ length: 16 }, (_, i) => {
    const angle = (i / 16) * Math.PI * 2
    return { x: Math.round(cx + Math.cos(angle) * (4 + r * 3)), y: Math.round(cy + Math.sin(angle) * (4 + r * 3) * 0.8), hex: RING }
  })
  return [...shards, ...ring]
}

/** A big boss's death at keyframe `key`: it shakes, flashing; gold cracks spread from its middle; then it bursts outward with a ring of light. */
export const bossFall = (art: readonly string[], key: number, lit: Lit): Pixel[] => {
  const cx = (art[0]?.length ?? 0) / 2
  const cy = art.length / 2
  if (key < 4) return bossShake(art, key, lit)
  if (key < 7) return bossCracks(art, key, lit, cx, cy)
  return key >= BOSS_KEYS ? [] : bossBurst(art, key, lit, cx, cy)
}

/** The hero's fall at keyframe `key`: white, red, a lean and a steeper one, then fallen at that slant a pixel lower, greying, a pool spreading under; toward `side`, 1 right, -1 left. */
export const heroFall = (art: readonly string[], key: number, lit: Lit, side: 1 | -1 = 1): Pixel[] => {
  const n = art.length
  const w = art[0]?.length ?? n
  // Leaning left is the right lean mirrored about the sprite's middle, the art itself unturned.
  const lean = (x: number, y: number, by: number) => (side === 1 ? x + Math.round((n - 1 - y) * by) : x - Math.round((n - 1 - y) * by))
  if (key === 0) return each(art, (_, x, y) => ({ x, y, hex: WHITE }))
  if (key === 1) return each(art, (k, x, y) => ({ x, y, hex: mix(lit(k), RED, 0.5) }))
  if (key < 4) {
    const by = key === 2 ? 0.4 : 0.9
    return each(art, (k, x, y) => ({ x: lean(x, y, by), y: y + key - 2, hex: mix(lit(k), RED, 0.25) }))
  }
  const k = Math.min(key, HERO_KEYS - 1)
  const spread = Math.min(3, k - 3)
  const pool = [
    ...Array.from({ length: 5 + 2 * spread }, (_, i) => ({ x: 5 - spread + i, y: n, hex: mix(POOL, GROUND, 0.15) })),
    ...Array.from({ length: 3 + 2 * spread }, (_, i) => ({ x: 6 - spread + i, y: n + 1, hex: mix(POOL_EDGE, GROUND, 0.3) })),
  ].map(p => (side === 1 ? p : { ...p, x: w - 1 - p.x }))
  const body = each(art, (c, x, y) => ({ x: lean(x, y, 0.9), y: y + 2, hex: mix(lit(c), ASH, Math.min(0.5, (k - 3) * 0.12)) }))
  return [...pool, ...body]
}

/** How dark the map grows behind the fallen hero at keyframe `key`: none until they lie, then deeper to six tenths. */
export const fallDim = (key: number) => (key < 4 ? 0 : Math.min(0.6, (key - 3) * 0.15))
