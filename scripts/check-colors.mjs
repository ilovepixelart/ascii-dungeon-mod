// The colors gate: every module that draws a window (calls windowPixels) or takes its colors from the interface's
// tokens names them by role from hooks/ui/tokens.ts, never a raw code of its own. Art (sprites, the map's palette,
// pixel art) keeps its codes and is not checked.
//
//   node scripts/check-colors.mjs     exits 1 with a line per raw color found
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const HOOKS = 'hooks'
const TOKENS = join(HOOKS, 'ui', 'tokens.ts')
const RAW = /'#[0-9a-fA-F]{6}'/g

const sources = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  const path = join(dir, e.name)
  if (e.isDirectory()) return sources(path)
  return e.name.endsWith('.ts') && !e.name.endsWith('.test.ts') ? [path] : []
})

const isChecked = (path, text) => path !== TOKENS && (text.includes('windowPixels(') || /from '\.{1,2}\/(ui\/)?tokens'/.test(text))

const found = sources(HOOKS).flatMap(path => {
  const text = readFileSync(path, 'utf8')
  if (!isChecked(path, text)) return []
  return text.split('\n').flatMap((line, i) => (line.match(RAW) ?? []).map(raw => `${path}:${i + 1}: ${raw} is not a token`))
})

if (found.length > 0) {
  for (const line of found) console.error(line)
  console.error(`\n${found.length} raw colors in window modules: name each by its role in ${TOKENS}`)
  process.exit(1)
}
console.log('colors: every window module names its colors by role')
