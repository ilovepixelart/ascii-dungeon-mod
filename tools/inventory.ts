// Inventory workbench: renders the game's own inventory screen (hooks/inventory.ts) for a sample hero.
// Usage: bun tools/inventory.ts <out-dir> [draft-module] [selected-bag-index]   writes inventory.ans, inventory.png
// A draft module (a copy of hooks/inventory.ts) is rendered in place of the live one.
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'

import type { Game, Item, Rarity } from '../types'
import type { Run } from '../hooks/game'
import { plainItem } from '../hooks/items'
import { newGame } from '../hooks/world'
import { png } from './png'

const [out, draft, pick] = [process.argv[2], process.argv[3], process.argv[4]]
const { INV_H, INV_W, beltLabel, inventoryPixels, itemCard } = (await import(draft ?? '../hooks/inventory')) as typeof import('../hooks/inventory')
if (out === undefined) throw new Error('usage: bun tools/inventory.ts <out-dir>')
mkdirSync(out, { recursive: true })

const g: Game = newGame(1, 'knight')
const make = (base: string, rarity: Rarity, x: number, y: number, over: Partial<Item> = {}): Item => ({ ...plainItem(g, base, rarity), x, y, ...over })
g.gear = { ...g.gear, offhand: make('buckler', 'uncommon', 0, 0, { def: 2 }), ring: make('ring', 'rare', 0, 0, { atk: 2 }), boots: make('boots', 'common', 0, 0) }
g.bag = [
  make('axe', 'epic', 0, 0, { name: 'Sharp War Axe of Force', atk: 9 }),
  make('chain', 'rare', 2, 0, { name: 'Sturdy Chain Shirt of Warding', def: 7 }),
  make('steelHelm', 'common', 4, 0),
  make('dagger', 'uncommon', 6, 0, { name: 'Sharp Dagger', atk: 3 }),
  make('ring', 'legendary', 7, 0, { name: 'Band of the Endless Loop', atk: 4, hp: 4, power: 'loopHeal' }),
  make('amulet', 'uncommon', 7, 1),
  make('sword', 'common', 6, 2),
  make('signet', 'epic', 7, 2, { atk: 2, def: 2 }),
  make('greaves', 'uncommon', 0, 3, { def: 3 }),
  make('kite', 'legendary', 2, 3, { name: 'Aegis of Green Builds', def: 4, power: 'greenBlock' }),
  make('mace', 'common', 4, 2),
  make('staff', 'rare', 5, 2),
  make('wand', 'rare', 7, 3),
]
g.cursor = g.bag[Number(pick ?? 1)]?.id ?? null
g.belt = [{ kind: 'health', count: 3 }, { kind: 'regen', count: 2 }, { kind: 'mapping', count: 1 }, { kind: 'fury', count: 1 }, { kind: 'smoke', count: 2 }]

const px = inventoryPixels(g)
const rgb = (hex: string) => [1, 3, 5].map(i => Number.parseInt(hex.slice(i, i + 2), 16)).join(';')
const text = (runs: Run[]) => runs.map(r => `${r.dim ? '\x1b[2m' : ''}${r.bold ? '\x1b[1m' : ''}${r.color?.startsWith('#') ? `\x1b[38;2;${rgb(r.color)}m` : ''}${r.text}\x1b[0m`).join('')
const lines: string[] = []
for (let y = 0; y < INV_H; y += 2) lines.push(`${(px[y] ?? []).map((t, x) => `\x1b[38;2;${rgb(t)}m\x1b[48;2;${rgb(px[y + 1]?.[x] ?? '#000000')}m▀`).join('')}\x1b[0m`)
const belt = [0, 1, 2, 3, 4].map(i => beltLabel(g, i)).join('   ')
await Bun.write(join(out, 'inventory.ans'), `${[...lines, `\x1b[2m${belt}\x1b[0m`, '', ...itemCard(g).map(text)].join('\n')}\n`)
await Bun.write(join(out, 'inventory.png'), png(px, 8))
console.log(`wrote ${join(out, 'inventory.ans')} ${join(out, 'inventory.png')} (${INV_W} x ${INV_H} px)`)
