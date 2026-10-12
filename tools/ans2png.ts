// Renders a truecolor .ans mock to a PNG for review in true proportions (a cell twice as tall as wide): half and
// quarter blocks at their true detail, any other character as a bar in its ink.
// Usage: bun tools/ans2png.ts <in.ans> <out.png>
import { png } from './png'

const [input, output] = [process.argv[2], process.argv[3]]
if (input === undefined || output === undefined) throw new Error('usage: bun tools/ans2png.ts <in.ans> <out.png>')

const BG = '#0b0b10'
const DEFAULT_INK = '#d0d0d0'
const NAMED: Record<string, string> = { '31': '#d9443a', '32': '#3ccf4e', '33': '#e0c040', '34': '#3b8eea', '35': '#a85cf0', '36': '#40c0d0', '37': '#d0d0d0', '90': '#808080' }
const hex = (r: number, g: number, b: number) => `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`
const dimmed = (h: string) => hex(...([1, 3, 5].map(i => Math.round(Number.parseInt(h.slice(i, i + 2), 16) * 0.55)) as [number, number, number]))

/** A cell as 2 x 2 pixels: top-left, top-right, bottom-left, bottom-right. */
type Cell = [string, string, string, string]
/** Quarter-block glyphs by their bits: 1 top-left, 2 top-right, 4 bottom-left, 8 bottom-right. */
const QUAD_BITS: Record<string, number> = Object.fromEntries([' ', '\u2598', '\u259d', '\u2580', '\u2596', '\u258c', '\u259e', '\u259b', '\u2597', '\u259a', '\u2590', '\u259c', '\u2584', '\u2599', '\u259f', '\u2588'].map((g, bits) => [g, bits]))
const rows: Cell[][] = []
for (const line of (await Bun.file(input).text()).split('\n')) {
  const cells: Cell[] = []
  let fg = DEFAULT_INK
  let bg = BG
  let isDim = false
  for (let i = 0; i < line.length; i += 1) {
    if (line[i] === '\x1b' && line[i + 1] === '[') {
      const end = line.indexOf('m', i)
      const codes = line.slice(i + 2, end).split(';')
      for (let c = 0; c < codes.length; c += 1) {
        const code = codes[c]
        if (code === '0' || code === '') [fg, bg, isDim] = [DEFAULT_INK, BG, false]
        else if (code === '2') isDim = true
        else if ((code === '38' || code === '48') && codes[c + 1] === '2') {
          const color = hex(Number(codes[c + 2]), Number(codes[c + 3]), Number(codes[c + 4]))
          if (code === '38') fg = color
          else bg = color
          c += 4
        } else if (code !== undefined && NAMED[code] !== undefined) fg = NAMED[code]!
      }
      i = end
      continue
    }
    const ch = line[i]!
    const ink = isDim ? dimmed(fg) : fg
    const bits = QUAD_BITS[ch]
    if (bits !== undefined) cells.push([0, 1, 2, 3].map(q => ((bits >> q) & 1 ? fg : bg)) as Cell)
    else cells.push([bg, bg, ink, ink])
  }
  rows.push(cells)
}
const width = Math.max(...rows.map(r => r.length))
// A terminal cell is twice as tall as it is wide: 2 x 4 output pixels, each quarter 1 x 2.
const px: string[][] = rows.flatMap(r => {
  const top = Array.from({ length: width * 2 }, (_, x) => r[Math.floor(x / 2)]?.[x % 2] ?? BG)
  const bottom = Array.from({ length: width * 2 }, (_, x) => r[Math.floor(x / 2)]?.[2 + (x % 2)] ?? BG)
  return [top, top, bottom, bottom]
})
await Bun.write(output, png(px, 3))
console.log(`${width} columns x ${rows.length} rows -> ${output}`)
