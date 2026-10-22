// The font gate: words and numbers in the pane are terminal text, so no module draws the pixel font (`textMask`, the
// `FONT` it reads, or `word` over it) but those listed here: where it is defined, the map's floating combat numbers
// (art that moves with the blow) and the hero card (a picture saved to a file, with no terminal to write text in).
//
//   node scripts/check-font.mjs     exits 1 with a line per use found elsewhere
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const HOOKS = 'hooks'
const ALLOWED = new Set(['hooks/pixelart.ts', 'hooks/window.ts', 'hooks/pixels.ts', 'hooks/herocard.ts'])
const USE = /\b(?:textMask|word)\s*\(|\bFONT\s*\[/

const sources = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  const path = join(dir, e.name)
  if (e.isDirectory()) return sources(path)
  return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [path] : []
})

const found = sources(HOOKS).filter(path => !ALLOWED.has(path)).flatMap(path =>
  readFileSync(path, 'utf8').split('\n').flatMap((line, i) => (USE.test(line) && !/^\s*(\/\/|\*)/.test(line) ? [`${path}:${i + 1}: ${line.trim()}`] : [])))

if (found.length > 0) {
  for (const line of found) console.error(line)
  console.error(`\n${found.length} uses of the pixel font: write words and numbers as terminal text (artLabel, buttonBox in hooks/pieces.ts)`)
  process.exit(1)
}
console.log('font: no window draws words in the pixel font')
