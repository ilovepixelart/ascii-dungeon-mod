// The town's picture by day: its ground with roof ridges, eave shadows and path edges, everything standing in it
// with its shadow, and the townsfolk. It never changes, so it is drawn once; a frame cuts its window out of it.
import { NPC_ART, PAL, PX, TOWN_BIG_ART, TOWN_DECOR_ART, TOWN_TERRAIN, TOWN_THING_ART, TREE_ALT, dropShadow } from './pixelart'
import { TOWN_DECOR, TOWN_GROUND, TOWN_H, TOWN_SPOTS, TOWN_W } from './town'
import type { TownSpot } from './town'

const TILE: Readonly<Record<string, keyof typeof TOWN_TERRAIN>> = {
  H: 'forest', R: 'roof', S: 'slate', P: 'teal', W: 'wall', X: 'stone', A: 'awning', C: 'counter',
  f: 'forge', '=': 'road', '.': 'grass', ',': 'flowers',
}
const ROOF = new Set(['R', 'S', 'P'])
/** Each roof's lit ridge, a lighter shade of its own color. */
const RIDGE: Readonly<Record<string, string>> = { R: '#d9776a', S: '#7a8496', P: '#6ac0c4' }
const EAVE_SHADE = [0.45, 0.6, 0.78]
const RIDGE_SHADE = 0.55
const EAVE_EDGE = '#1a1420'
/** Road against grass: lit on the sides toward the light (top, left), shaded on the far sides. */
const ROAD_LIT = '#c4b8a0'
const ROAD_SHADED = '#6a6252'
const TREE_SHADE = 0.68
const SPOT_ART: Readonly<Record<TownSpot, readonly string[]>> = { ...NPC_ART, ...TOWN_THING_ART }
/** Things on walls cast no shadow on the ground. */
const FLAT = new Set(['signCoin', 'signAnvil', 'signCross', 'furnace', 'chimney'])

export const TOWN_PX_W = TOWN_W * PX
export const TOWN_PX_H = TOWN_H * PX

const toInt = (hex: string) => Number.parseInt(hex.slice(1, 7), 16)
const shade = (c: number, k: number) => (Math.round(((c >> 16) & 0xff) * k) << 16) | (Math.round(((c >> 8) & 0xff) * k) << 8) | Math.round((c & 0xff) * k)
const tileAt = (tx: number, ty: number) => TOWN_GROUND[ty]?.[tx] ?? 'H'

/** One ground pixel: the tile's texture, then the roof ridge and eave edge, the eaves' shadow, and the road's edges. */
const groundPixel = (x: number, y: number) => {
  const tx = Math.floor(x / PX)
  const ty = Math.floor(y / PX)
  const lx = x % PX
  const ly = y % PX
  const t = tileAt(tx, ty)
  const base = toInt(TOWN_TERRAIN[TILE[t] ?? 'grass'](x, y))
  if (ROOF.has(t) && !ROOF.has(tileAt(tx, ty - 1)) && ly === 0) return shade(base, RIDGE_SHADE)
  if (ROOF.has(t) && !ROOF.has(tileAt(tx, ty - 1)) && ly === 1) return toInt(RIDGE[t]!)
  if (ROOF.has(t) && !ROOF.has(tileAt(tx, ty + 1)) && ly === PX - 1) return toInt(EAVE_EDGE)
  if (!ROOF.has(t) && ROOF.has(tileAt(tx, ty - 1)) && ly < EAVE_SHADE.length) return shade(base, EAVE_SHADE[ly]!)
  if (t !== '=') return base
  const grassy = (dx: number, dy: number) => ['.', ','].includes(tileAt(tx + dx, ty + dy))
  if ((lx === 0 && grassy(-1, 0)) || (ly === 0 && grassy(0, -1))) return toInt(ROAD_LIT)
  if ((lx === PX - 1 && grassy(1, 0)) || (ly === PX - 1 && grassy(0, 1))) return toInt(ROAD_SHADED)
  return base
}

/** The shimmer's other phase: the fountain's water and the portal's swirl with their two blues traded. */
const SHIMMER: Readonly<Record<string, string>> = { b: 'c', c: 'b' }
const SHIMMERS = new Set(['fountain', 'portal'])

const cached = new Map<boolean, Uint32Array>()

/** The whole town, TOWN_PX_W by TOWN_PX_H, 0xRRGGBB per pixel, row-major; `shimmer`, the water's other phase. */
export const townImage = (shimmer = false): Uint32Array => {
  const known = cached.get(shimmer)
  if (known !== undefined) return known
  const ink = (art: string, k: string) => (shimmer && SHIMMERS.has(art) ? (SHIMMER[k] ?? k) : k)
  const img = new Uint32Array(TOWN_PX_W * TOWN_PX_H)
  for (let y = 0; y < TOWN_PX_H; y += 1) for (let x = 0; x < TOWN_PX_W; x += 1) img[y * TOWN_PX_W + x] = groundPixel(x, y)
  const put = (x: number, y: number, c: number) => {
    if (x >= 0 && y >= 0 && x < TOWN_PX_W && y < TOWN_PX_H) img[y * TOWN_PX_W + x] = c
  }
  const darkenAt = (x: number, y: number, k: number) => {
    if (x >= 0 && y >= 0 && x < TOWN_PX_W && y < TOWN_PX_H) img[y * TOWN_PX_W + x] = shade(img[y * TOWN_PX_W + x]!, k)
  }
  /** A small sprite on its tile, its drop shadow on the ground around it unless it hangs on a wall. */
  const sprite = (rows: readonly string[], tx: number, ty: number, hasShadow: boolean, art = '') => {
    for (let ly = 0; ly < PX; ly += 1) for (let lx = 0; lx < PX; lx += 1) {
      const k = ink(art, rows[ly]?.[lx] ?? '.')
      if (k !== '.') put(tx * PX + lx, ty * PX + ly, toInt(PAL[k] ?? '#ff00ff'))
      else if (hasShadow && dropShadow(lx, ly) < 1) darkenAt(tx * PX + lx, ty * PX + ly, dropShadow(lx, ly))
    }
  }
  for (const d of TOWN_DECOR) {
    if (d.size === 2) {
      const rows = TOWN_BIG_ART[d.art as keyof typeof TOWN_BIG_ART]
      if (d.art === 'tree') {
        // A soft oval on the ground, centered under the trunk: three quarters of a tile across each way, a quarter down.
        const cx = d.x * PX + PX
        const cy = d.y * PX + 2 * PX - 2
        const rx = Math.round(PX * 0.75)
        const ry = PX / 4
        for (let y = -ry; y <= ry; y += 1) for (let x = -rx; x <= rx; x += 1) if ((x * x) / (rx * rx) + (y * y) / (ry * ry) <= 1) darkenAt(cx + x, cy + y, TREE_SHADE)
      }
      rows.forEach((row, ly) => [...row].forEach((k, lx) => {
        if (k !== '.') put(d.x * PX + lx, d.y * PX + ly, toInt((d.alt === true ? TREE_ALT[k] : undefined) ?? PAL[ink(d.art, k)] ?? '#ff00ff'))
      }))
    } else sprite(TOWN_DECOR_ART[d.art as keyof typeof TOWN_DECOR_ART], d.x, d.y, !FLAT.has(d.art))
  }
  for (const spot of Object.keys(TOWN_SPOTS) as TownSpot[]) sprite(SPOT_ART[spot], TOWN_SPOTS[spot].x, TOWN_SPOTS[spot].y, true, spot)
  cached.set(shimmer, img)
  return img
}
