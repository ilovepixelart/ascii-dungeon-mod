// Full-screen workbench: the whole pane as the game draws it, for a sample hero with the bag open.
// Usage: bun tools/screen.ts <out-dir> [columns] [rows]   writes screen.ans (review it as a PNG with tools/ans2png.ts)
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

import type { Game, Item, Rarity } from '../types'
import type { Run } from '../hooks/game'
import { apply } from '../hooks/game'
import { BAG_X, INV_H, INV_W, inventoryPixels, itemCard } from '../hooks/inventory'
import { plainItem } from '../hooks/items'
import { hudLayout, hudPixels } from '../hooks/hud'
import { MAP_H } from '../hooks/map'
import { PX } from '../hooks/pixelart'
import { logRuns } from '../hooks/panels'
import { frameOf } from '../hooks/pixels'
import { newGame } from '../hooks/world'

const [out, colsArg, rowsArg] = [process.argv[2], process.argv[3], process.argv[4]]
if (out === undefined) throw new Error('usage: bun tools/screen.ts <out-dir> [columns] [rows]')
mkdirSync(out, { recursive: true })
const COLUMNS = Number(colsArg ?? 110)
const ROWS = Number(rowsArg ?? 70)

let g: Game = newGame(21, 'knight')
for (let i = 0; i < 4; i += 1) g = apply(g, { kind: 'explore', steps: 3 })
g = apply(g, { kind: 'summon', name: 'auth.ts' })
const make = (base: string, rarity: Rarity, x: number, y: number, over: Partial<Item> = {}): Item => ({ ...plainItem(g, base, rarity), x, y, ...over })
g = {
  ...g,
  panel: (process.argv[5] ?? 'bag') === 'none' ? 'none' : 'bag',
  bag: [
    make('axe', 'epic', 0, 0, { name: 'Sharp War Axe of Force', atk: 9 }),
    make('chain', 'rare', 2, 0, { name: 'Sturdy Chain Shirt of Warding', def: 7 }),
    make('steelHelm', 'common', 4, 0),
    make('dagger', 'uncommon', 6, 0, { name: 'Sharp Dagger', atk: 3 }),
    make('ring', 'legendary', 7, 0, { name: 'Band of the Endless Loop', atk: 4, hp: 4, power: 'loopHeal' }),
    make('kite', 'legendary', 2, 3, { name: 'Aegis of Green Builds', def: 4, power: 'greenBlock' }),
    make('greaves', 'uncommon', 0, 3, { def: 3 }),
  ],
  belt: [{ kind: 'health', tiers: [3, 0, 0] }, { kind: 'regen', tiers: [2, 0, 0] }, null, null, { kind: 'smoke', tiers: [0, 0, 1] }],
}
g.cursor = g.bag[1]?.id ?? null

const rgb = (hex: string) => [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16)).join(';')
const text = (runs: Run[]) =>
  runs.map(r => `${r.dim ? '\x1b[2m' : ''}${r.bold ? '\x1b[1m' : ''}${r.color?.startsWith('#') ? `\x1b[38;2;${rgb(r.color)}m` : ''}${r.bg ? `\x1b[48;2;${rgb(r.bg)}m` : ''}${r.text}\x1b[0m`).join('')
/** A line's width on screen, its escape codes left out. */
const visible = (line: string) => line.replace(/\x1b\[[0-9;]*m/g, '').length
const halfBlocks = (px: (x: number, y: number) => string, w: number, h: number) =>
  Array.from({ length: h / 2 }, (_, y) => `${Array.from({ length: w }, (_, x) => `\x1b[38;2;${rgb(px(x, 2 * y))}m\x1b[48;2;${rgb(px(x, 2 * y + 1))}m▀`).join('')}\x1b[0m`)

// The same arithmetic the pane uses. With the bag open the inventory takes the whole pane, centered in a frame.
const hud = hudPixels(g, COLUMNS)
const hex = (n: number) => `#${n.toString(16).padStart(6, '0')}`
const inv = inventoryPixels(g)
const boxed = (rows: string[]) => [`+${'-'.repeat(COLUMNS - 2)}+`, ...rows.map(r => `|${r}${' '.repeat(Math.max(0, COLUMNS - 2 - visible(r)))}|`), `+${'-'.repeat(COLUMNS - 2)}+`]
const pad = ' '.repeat(Math.floor((COLUMNS - 2 - INV_W) / 2))
const inventoryScreen = () =>
  boxed([
    `\x1b[1m Inventory\x1b[0m${' '.repeat(COLUMNS - 2 - 10 - 22)}\x1b[38;2;${rgb('#ffd34d')}mGold ${g.gold}\x1b[0m   \x1b[1mi\x1b[0m: Close `,
    '',
    `${pad}\x1b[2m${'Worn'.padEnd(BAG_X)}Bag\x1b[0m`,
    ...halfBlocks((x, y) => inv[y]?.[x] ?? '#000000', INV_W, INV_H).map(l => `${pad}${l}`),
    '',
    ...itemCard(g).map(r => ` ${text(r)}`),
    '',
    ' \x1b[1me\x1b[0m: Equip  \x1b[1ms\x1b[0m: Sell  \x1b[1mj\x1b[0m: Junk  \x1b[1mx\x1b[0m: Sell junk  \x1b[1mo\x1b[0m: Arrange  \x1b[1mn\x1b[0m: Next',
    ' \x1b[2mClick an item to select it, click it again to equip. Click worn gear to take it off, a potion to drink it.\x1b[0m',
    '',
    ...logRuns(g).slice(-2).map(r => ` \x1b[2m> ${r.text}\x1b[0m`),
  ])
const playScreen = () => {
  const mapWidth = COLUMNS
  const mapRows = Math.max(6, Math.min((MAP_H * PX) / 2, ROWS - hudLayout(COLUMNS).height / 2))
  const frame = frameOf(g, mapWidth, mapRows * 2)
  return [
    ...halfBlocks((x, y) => hex(frame[y * mapWidth + x] ?? 0), mapWidth, mapRows * 2),
    ...halfBlocks((x, y) => hud.px[y]?.[x] ?? '#000000', COLUMNS, hudLayout(COLUMNS).height),
  ]
}
const lines = g.panel === 'bag' ? inventoryScreen() : playScreen()
await Bun.write(join(out, 'screen.ans'), `${lines.join('\n')}\n`)
console.log(`${COLUMNS} x ${lines.length} rows (pane rows given: ${ROWS}) -> ${join(out, 'screen.ans')}`)
