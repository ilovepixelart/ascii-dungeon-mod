// Window preview: each window the screens list draws (hooks/screens.ts) as the pane shows it, its text boxes' lines
// written in over the pixels, for review. A cell is one pixel wide and two tall; its text is drawn in the pixel font,
// upper case, so lengths and rows are true.
// Usage: bun tools/windows.ts <out-dir> [prefix...]   writes <name>.png for each window whose name starts with a prefix, all when none
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

import { shots } from '../hooks/screens'
import { png } from './png'
import { preview } from './preview'

const [out, ...prefixes] = process.argv.slice(2)
if (out === undefined) throw new Error('usage: bun tools/windows.ts <out-dir> [prefix...]')
mkdirSync(out, { recursive: true })

for (const s of shots().filter(s => prefixes.length === 0 || prefixes.some(p => s.name.startsWith(p)))) {
  await Bun.write(join(out, `${s.name}.png`), png(preview(s.px, s.boxes), 1))
  console.log(`${s.name}: ${s.px.length / 2} rows`)
}
