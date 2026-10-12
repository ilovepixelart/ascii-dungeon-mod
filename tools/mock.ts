// Art workbench: renders pixel art to review sheets.
// Usage: bun tools/mock.ts <out-dir> [art-file]   writes cast.ans, cast.png, scene.ans, scene.png
// art-file defaults to the live hooks/pixelart.ts; pass a draft copy to review changes before they reach the game.
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

import type * as Art from '../hooks/pixelart'
import { png } from './png'

const out = process.argv[2]
if (out === undefined) throw new Error('usage: bun tools/mock.ts <out-dir> [art-file]')
mkdirSync(out, { recursive: true })
const artFile = resolve(process.argv[3] ?? join(import.meta.dir, '../hooks/pixelart.ts'))
const art = await import(artFile)
const { MONSTER_ART, PAL, PX, TERRAIN, THING_ART, dropShadow, heroArt, lightPixel, torch, wallOcclusion }: typeof Art = art
/** Numbers that pop over characters, drawn only when the art file has a font (textMask, POPUP_INK, POPUP_OUTLINE). */
type Popup = { text: string; kind: string; over: string; scale?: number; rise?: number }
const POPUPS: Popup[] = [
  { text: '-3', kind: 'hurt', over: '@' },
  { text: '7', kind: 'damage', over: 'g' },
  { text: '14!', kind: 'crit', over: 's', scale: 2 },
  { text: '+8', kind: 'heal', over: '!' },
  { text: '+12 XP', kind: 'xp', over: '>' },
  { text: '+5', kind: 'gold', over: '$' },
]
console.log(`art: ${artFile}`)

type Px = string[][]
const SENSED = '#d9a0ff'
const MEMORY_BG = '#121626'
const worn = { weapon: {} as never, helm: {} as never, armor: {} as never, offhand: {} as never }
const CAST: [string, readonly string[]][] = [
  ['hero', heroArt({ gear: { weapon: {} as never } })],
  ['knight', heroArt({ gear: worn, cls: 'knight' })],
  ['mage', heroArt({ gear: worn, cls: 'mage' })],
  ['rogue', heroArt({ gear: worn, cls: 'rogue' })],
  ['bare', heroArt({ gear: {} })],
  ...Object.entries(MONSTER_ART),
  ...Object.entries(THING_ART),
]

/** One sheet row per review: lit, in shadow, silhouette, sensed. */
const REVIEWS: [string, (key: string, x: number, y: number) => string][] = [
  ['torchlit', (key, x, y) => (key === '.' ? lightPixel(TERRAIN.floor(x, y), 0.9, false) : lightPixel(PAL[key] ?? '#ff00ff', 0.9, true))],
  ['in shadow', (key, x, y) => (key === '.' ? lightPixel(TERRAIN.floor(x, y), 0.25, false) : lightPixel(PAL[key] ?? '#ff00ff', 0.25, true))],
  ['silhouette', key => (key === '.' ? '#8a8a8a' : '#000000')],
  ['sensed', key => (key === '.' ? MEMORY_BG : SENSED)],
]

const GAP = 4
const castSheet = (): Px => {
  const w = CAST.length * (PX + GAP) + GAP
  const px: Px = []
  for (const [, paint] of REVIEWS) {
    for (let y = 0; y < PX + GAP; y += 1) {
      const row: string[] = []
      for (let x = 0; x < w; x += 1) {
        const slot = Math.floor((x - GAP) / (PX + GAP))
        const sx = (x - GAP) % (PX + GAP)
        const sy = y - GAP / 2
        const inside = x >= GAP && sx < PX && sy >= 0 && sy < PX
        const key = inside ? (CAST[slot]?.[1][sy]?.[sx] ?? '.') : '.'
        row.push(paint(key, x, px.length))
      }
      px.push(row)
    }
  }
  return px
}

const SCENE = ['WWWWWWWWWW', 'W....!...W', 'W..s.....D', 'W........W', 'W...@..g.W', 'W.$......W', 'W.....>..W', 'WWWWWWWWWW']
const TILE: Record<string, keyof typeof TERRAIN> = { W: 'wall', D: 'door', '>': 'stairs' }
const SPRITE: Record<string, readonly string[] | undefined> = { '@': CAST[0]?.[1], s: MONSTER_ART.s, g: MONSTER_ART.g, $: THING_ART.$, '!': THING_ART['!'] }

const isWall = (tx: number, ty: number) => (SCENE[ty]?.[tx] ?? 'W') === 'W'

/** Pixels from the floor pixel to the nearest wall tile edge, checking the four neighbours. */
const wallDistance = (x: number, y: number) => {
  const tx = Math.floor(x / PX)
  const ty = Math.floor(y / PX)
  const lx = x % PX
  const ly = y % PX
  const gaps = [isWall(tx - 1, ty) ? lx : 99, isWall(tx + 1, ty) ? PX - 1 - lx : 99, isWall(tx, ty - 1) ? ly : 99, isWall(tx, ty + 1) ? PX - 1 - ly : 99]
  return Math.min(...gaps)
}

const darken = (hex: string, k: number) => `#${[1, 3, 5].map(i => Math.round(Number.parseInt(hex.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('')}`

/** Stamps each popup centered over the top of its tile: an outline ring first, then the ink. */
const withPopups = (px: Px): Px => {
  if (typeof art.textMask !== 'function') return px
  for (const p of POPUPS) {
    const ty = SCENE.findIndex(row => row.includes(p.over))
    const tx = SCENE[ty]?.indexOf(p.over) ?? -1
    if (ty < 0 || tx < 0) continue
    const mask: string[] = art.textMask(p.text, p.scale ?? 1)
    const w = mask[0]?.length ?? 0
    const left = tx * PX + Math.floor((PX - w) / 2)
    const top = ty * PX - mask.length - 1 - (p.rise ?? 0)
    const on = (x: number, y: number) => mask[y]?.[x] === '#'
    for (let y = -1; y <= mask.length; y += 1) {
      for (let x = -1; x <= w; x += 1) {
        const row = px[top + y]
        if (row === undefined || left + x < 0 || left + x >= row.length) continue
        const isRing = !on(x, y) && [-1, 0, 1].some(dy => [-1, 0, 1].some(dx => on(x + dx, y + dy)))
        if (on(x, y)) row[left + x] = art.POPUP_INK[p.kind] ?? '#ff00ff'
        else if (isRing) row[left + x] = art.POPUP_OUTLINE
      }
    }
  }
  return px
}

const sceneSheet = (): Px => {
  const hero = { x: 4 * PX + PX / 2, y: 4 * PX + PX / 2 }
  return withPopups(Array.from({ length: SCENE.length * PX }, (_, y) =>
    Array.from({ length: (SCENE[0]?.length ?? 0) * PX }, (_, x) => {
      const ch = SCENE[Math.floor(y / PX)]?.[Math.floor(x / PX)] ?? 'W'
      const sprite = SPRITE[ch]
      const key = sprite?.[y % PX]?.[x % PX] ?? '.'
      const light = torch(Math.hypot(x - hero.x, y - hero.y) / PX)
      if (key !== '.') return lightPixel(PAL[key] ?? '#ff00ff', light, true)
      const tile = TILE[ch] ?? 'floor'
      const shade = (sprite === undefined ? 1 : dropShadow(x % PX, y % PX)) * (tile === 'wall' ? 1 : wallOcclusion(wallDistance(x, y)))
      return lightPixel(darken(TERRAIN[tile](x, y), shade), light, false)
    }),
  ))
}

const rgb = (hex: string) => [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16)).join(';')
const ansi = (px: Px) => {
  const lines: string[] = []
  for (let y = 0; y < px.length; y += 2) {
    lines.push(`${(px[y] ?? []).map((top, x) => `\x1b[38;2;${rgb(top)}m\x1b[48;2;${rgb(px[y + 1]?.[x] ?? '#000000')}m▀`).join('')}\x1b[0m`)
  }
  return lines.join('\n')
}

const names = CAST.map(([n]) => n.slice(0, PX + GAP - 1).padEnd(PX + GAP)).join('')
const cast = castSheet()
await Bun.write(join(out, 'cast.ans'), `${' '.repeat(GAP)}${names}\n${ansi(cast)}\nrows: ${REVIEWS.map(([n]) => n).join(', ')}\n`)
await Bun.write(join(out, 'cast.png'), png(cast, 6))
const scene = sceneSheet()
await Bun.write(join(out, 'scene.ans'), `${ansi(scene)}\n`)
await Bun.write(join(out, 'scene.png'), png(scene, 6))
console.log(`cast: ${CAST.map(([n]) => n).join(' ')}`)
console.log(`review rows: ${REVIEWS.map(([n]) => n).join(', ')}`)
console.log(`wrote ${join(out, 'cast.ans')} ${join(out, 'cast.png')} ${join(out, 'scene.ans')} ${join(out, 'scene.png')}`)
