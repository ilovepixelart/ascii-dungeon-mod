// Popup-size workbench: one combat beat per panel, the same beat in each font size, rows compared side by side.
// Usage: bun tools/popups.ts <out-dir> <art-file>   writes popups.ans, popups.png
import { mkdirSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { png } from './png'

const [out, artArg] = [process.argv[2], process.argv[3]]
if (out === undefined || artArg === undefined) throw new Error('usage: bun tools/popups.ts <out-dir> <art-file>')
mkdirSync(out, { recursive: true })
const art = await import(resolve(artArg))
const { MONSTER_ART, PAL, PX, TERRAIN, heroArt, lightPixel, torch, dropShadow } = art

type Px = string[][]
type Label = { text: string; kind: string; over: 'hero' | 'foe' }
type Variant = { name: string }

const VARIANTS: Variant[] = [
  { name: 'small 3x5' },
]
const BEATS: { name: string; labels: Label[] }[] = [
  { name: 'exchange', labels: [{ text: '7', kind: 'damage', over: 'foe' }, { text: '-3', kind: 'hurt', over: 'hero' }] },
  { name: 'crit', labels: [{ text: '14!', kind: 'crit', over: 'foe' }] },
]

// A 4 by 3 tile crop: the knight and a goblin side by side in the middle row.
const COLS = 4
const ROWS = 3
const HERO = { x: 1, y: 1 }
const FOE = { x: 2, y: 1 }
const hero = heroArt({ gear: { weapon: {} } })
const goblin = MONSTER_ART.g

const panel = (labels: Label[], v: Variant): Px => {
  const light = { x: HERO.x * PX + PX / 2, y: HERO.y * PX + PX / 2 }
  const px: Px = Array.from({ length: ROWS * PX }, (_, y) =>
    Array.from({ length: COLS * PX }, (_, x) => {
      const tx = Math.floor(x / PX)
      const ty = Math.floor(y / PX)
      const sprite = tx === HERO.x && ty === HERO.y ? hero : tx === FOE.x && ty === FOE.y ? goblin : undefined
      const key = sprite?.[y % PX]?.[x % PX] ?? '.'
      const l = torch(Math.hypot(x - light.x, y - light.y) / PX)
      if (key !== '.') return lightPixel(PAL[key] ?? '#ff00ff', l, true)
      const k = sprite === undefined ? 1 : dropShadow(x % PX, y % PX)
      const ground = TERRAIN.floor(x, y)
      const dim = `#${[1, 3, 5].map(i => Math.round(Number.parseInt(ground.slice(i, i + 2), 16) * k).toString(16).padStart(2, '0')).join('')}`
      return lightPixel(dim, l, false)
    }),
  )
  for (const label of labels) stamp(px, label, v)
  return px
}

/** Centered over the character's tile, its bottom one pixel above the tile: the outline ring, then the ink. */
const stamp = (px: Px, label: Label, v: Variant) => {
  const at = label.over === 'hero' ? HERO : FOE
  const mask: string[] = art.textMask(label.text)
  const w = mask[0]?.length ?? 0
  const left = at.x * PX + Math.floor((PX - w) / 2)
  const top = at.y * PX - mask.length - 1
  const on = (x: number, y: number) => mask[y]?.[x] === '#'
  for (let y = -1; y <= mask.length; y += 1) {
    for (let x = -1; x <= w; x += 1) {
      const row = px[top + y]
      if (row === undefined || left + x < 0 || left + x >= row.length) continue
      const ring = !on(x, y) && [-1, 0, 1].some(dy => [-1, 0, 1].some(dx => on(x + dx, y + dy)))
      if (on(x, y)) row[left + x] = art.POPUP_INK[label.kind]
      else if (ring) row[left + x] = art.POPUP_OUTLINE
    }
  }
}

const GAP = 4
const BG = '#0b0b10'
const sheet: Px = []
for (const v of VARIANTS) {
  const panels = BEATS.map(b => panel(b.labels, v))
  for (let y = 0; y < ROWS * PX; y += 1) sheet.push(panels.flatMap((p, i) => [...(i > 0 ? Array(GAP).fill(BG) : []), ...(p[y] ?? [])]))
  for (let y = 0; y < GAP; y += 1) sheet.push(Array(sheet[0]?.length ?? 0).fill(BG))
}

const rgb = (hex: string) => [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16)).join(';')
const band = (px: Px) => {
  const lines: string[] = []
  for (let y = 0; y < px.length; y += 2) {
    lines.push(`${(px[y] ?? []).map((t, x) => `\x1b[38;2;${rgb(t)}m\x1b[48;2;${rgb(px[y + 1]?.[x] ?? BG)}m▀`).join('')}\x1b[0m`)
  }
  return lines
}
const rowsPerVariant = ROWS * PX + GAP
const lines = band(sheet)
const ans: string[] = [`${BEATS.map(b => b.name.padEnd(COLS * PX + GAP)).join('')}`]
VARIANTS.forEach((v, i) => {
  ans.push(v.name)
  ans.push(...lines.slice((i * rowsPerVariant) / 2, ((i + 1) * rowsPerVariant) / 2))
})
await Bun.write(join(out, 'popups.ans'), `${ans.join('\n')}\n`)
await Bun.write(join(out, 'popups.png'), png(sheet, 6))
console.log(`variants (top to bottom): ${VARIANTS.map(v => v.name).join(' | ')}; beats (left to right): ${BEATS.map(b => b.name).join(' | ')}`)
