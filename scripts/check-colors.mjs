// The colors gate: every module that draws a window (calls windowPixels), takes its colors from the interface's
// tokens, or draws the pane's text (a .tsx) names them by role from hooks/ui/tokens.ts, never a raw code of its own.
// A click layer (a ClientModule) cannot import the tokens, so a code it holds must be a token's value, copied. Art
// (sprites, the map's palette, pixel art) keeps its codes and is not checked.
//
//   node scripts/check-colors.mjs     exits 1 with a line per raw color found
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const HOOKS = 'hooks'
const TOKENS = join(HOOKS, 'ui', 'tokens.ts')
// A color code in any quotes, of three, four, six or eight digits (the last digit pair or digit an alpha).
const RAW = /["'`]#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})["'`]/g
const code = raw => raw.slice(1, -1).toLowerCase()

const sources = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  const path = join(dir, e.name)
  if (e.isDirectory()) return sources(path)
  return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [path] : []
})

const isClient = text => text.includes('ClientModule')
const isChecked = (path, text) =>
  path !== TOKENS && (path.endsWith('.tsx') || isClient(text) || text.includes('windowPixels(') || /from ["']\.{1,2}\/(ui\/)?tokens["']/.test(text))

const tokenCodes = new Set((readFileSync(TOKENS, 'utf8').match(RAW) ?? []).map(code))

const found = sources(HOOKS).flatMap(path => {
  const text = readFileSync(path, 'utf8')
  if (!isChecked(path, text)) return []
  return text.split('\n').flatMap((line, i) => (line.match(RAW) ?? []).flatMap(raw => {
    if (isClient(text)) return tokenCodes.has(code(raw)) ? [] : [`${path}:${i + 1}: ${raw} is no token's value`]
    return [`${path}:${i + 1}: ${raw} is not a token`]
  }))
})

if (found.length > 0) {
  for (const line of found) console.error(line)
  console.error(`\n${found.length} raw colors in window modules: name each by its role in ${TOKENS}`)
  process.exit(1)
}
console.log('colors: every window module names its colors by role')
