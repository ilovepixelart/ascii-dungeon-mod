// The README's pictures, drawn by the game's own code: a depth mid-walk with the strip under it, and some windows as
// tools/preview.ts draws them, their text written in. Run it after a visual change and commit what it writes.
// Usage: bun tools/readme.ts [out-dir]   writes dungeon.png and one PNG per window into docs/img by default
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

import type { Game } from '../types'
import { apply } from '../hooks/game'
import { foeAhead, plainHero } from '../hooks/fixtures'
import { hudLabels, hudPixels } from '../hooks/hud'
import { frameOf } from '../hooks/pixels'
import { shots } from '../hooks/screens'
import { WINDOW_W } from '../hooks/window'
import { arrive } from '../hooks/world'
import { png } from './png'
import { preview } from './preview'

const out = process.argv[2] ?? 'docs/img'
mkdirSync(out, { recursive: true })

/** The pane's width in cells, a pixel each; the map's height in pixels. */
const WIDTH = WINDOW_W
const MAP_PX = 72
/** The windows shown, by their name in hooks/screens.ts. */
const WINDOWS = ['start-knight', 'talent-0', 'deep-brittle-ironclad', 'talk-mystic']

const hex = (n: number) => `#${(n & 0xffffff).toString(16).padStart(6, '0')}`

/** A level 6 hero a few steps into depth 4, in a room with potions and gold, a goblin on the way ahead. */
const scene = (): Game => {
  const hero = plainHero(3)
  let g: Game = { ...hero, ...arrive(hero.world, 4), deepest: 4, level: 6, gold: 340, hp: 15 }
  for (let i = 0; i < 4; i += 1) g = apply({ ...g, foe: null }, { kind: 'explore', steps: 1 })
  return { ...g, foe: foeAhead(g, 2, { opened: true }) }
}

const g = scene()
const map = frameOf(g, WIDTH, MAP_PX)
const rows = Array.from({ length: MAP_PX }, (_, y) => Array.from({ length: WIDTH }, (_, x) => hex(map[y * WIDTH + x]!)))
// The strip's numbers are text boxes, placed in its cells: under the map, they sit its height in cells lower.
const labels = hudLabels(g, WIDTH).map(b => ({ ...b, y: b.y + MAP_PX / 2 }))
await Bun.write(join(out, 'dungeon.png'), png(preview([...rows, ...hudPixels(g, WIDTH).px], labels), 1))
console.log('dungeon.png')

for (const s of shots().filter(s => WINDOWS.includes(s.name))) {
  await Bun.write(join(out, `${s.name}.png`), png(preview(s.px, s.boxes), 1))
  console.log(`${s.name}.png`)
}
