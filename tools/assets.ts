// The assets audit: draws every interface in many states and reports what the game asks for and does not have.
// Magenta (#ff00ff) is what the drawing falls back to for a missing color or art key; a character the pixel font
// lacks is drawn as a space and noted. Also: item bases without an icon, foes without art, each class's item pool.
// Usage: bun tools/assets.ts [out-dir]   (with an out-dir, writes a PNG of each window for review)
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { BESTIARY, UNIQUES, apply, newGame, normalize } from '../hooks/game'
import { ICONS } from '../hooks/icons'
import { BASES, SLOTS } from '../hooks/items/catalog'
import { MAP_H, MAP_W } from '../hooks/map'
import { MONSTER_ART, missingGlyphs, monsterArt } from '../hooks/pixelart'
import { frameOf } from '../hooks/pixels'
import { CLASSES, shots } from '../hooks/screens'
import { png } from './png'

const MAGENTA = '#ff00ff'

/** Map frames: every depth of three worlds, the town, and every foe kind in every theme. */
const frames = (): string[] => {
  const found: string[] = []
  const check = (name: string, f: Uint32Array) => {
    if (f.some(n => n === 0xff00ff)) found.push(name)
  }
  for (const world of [1, 5, 9]) for (let depth = 1; depth <= 15; depth += 1) {
    const g = normalize({ ...newGame(world), depth, seen: '1'.repeat(MAP_W * MAP_H) })
    check(`map world ${world} depth ${depth}`, frameOf(g, 300, 150))
    for (const foe of BESTIARY) {
      const fought = { ...g, foe: { ...apply(g, { kind: 'summon', name: 'x.ts' }).foe!, glyph: foe.glyph } }
      if (fought.foe.glyph !== undefined) check(`foe ${foe.glyph} depth ${depth}`, frameOf(fought, 300, 150))
    }
  }
  check('town', frameOf(apply(newGame(4), { kind: 'portal' }), 300, 150))
  return found
}

if (import.meta.main) {
  const out = process.argv[2]
  if (out !== undefined) mkdirSync(out, { recursive: true })
  const all = shots()
  const magenta = all.filter(s => s.px.some(row => row.includes(MAGENTA))).map(s => s.name)
  const mapMagenta = frames()
  const noIcon = BASES.filter(b => ICONS[b.key] === undefined).map(b => b.key)
  const foes = [...BESTIARY.map(b => b.glyph), ...Object.values(UNIQUES).map(u => u.glyph)]
  const noArt = foes.filter(gl => MONSTER_ART[gl] === undefined)
  const themed = (['crypt', 'flooded', 'forge'] as const).flatMap(theme => foes.filter(gl => monsterArt(gl, theme) === undefined).map(gl => `${gl} in ${theme}`))
  console.log(`windows drawn: ${all.length}; with magenta: ${magenta.length === 0 ? 'none' : magenta.join(', ')}`)
  console.log(`map frames with magenta: ${mapMagenta.length === 0 ? 'none' : mapMagenta.slice(0, 10).join(', ')}`)
  console.log(`characters the pixel font lacks: ${missingGlyphs.size === 0 ? 'none' : [...missingGlyphs].map(c => JSON.stringify(c)).join(' ')}`)
  console.log(`item bases without an icon: ${noIcon.length === 0 ? 'none' : noIcon.join(', ')}`)
  console.log(`foes without art: ${noArt.length === 0 ? 'none' : noArt.join(', ')}; by theme: ${themed.length === 0 ? 'none' : themed.join(', ')}`)
  console.log('item pool by class and slot (bases it can find and wear):')
  for (const cls of CLASSES) {
    const row = SLOTS.map(slot => `${slot} ${BASES.filter(b => b.slot === slot && (b.cls === undefined || b.cls === cls)).length}`)
    console.log(`  ${cls.padEnd(6)} ${row.join(', ')}`)
  }
  if (out !== undefined) for (const s of all) await Bun.write(join(out, `${s.name}.png`), png(s.px, 4))
}
