// The windows of hooks/screens.ts as saves a real Claude Code opens: each a game with its window's panel set, the keys
// pressed once the pane has the keyboard, a text to click, and the terminal's width (narrow for the compact bag).
// Usage: bun tools/shots/scenes.ts <out.json>   (shoot.py runs it)
import type { Game } from '../../types'
import { LOG_KEPT, apply, newGame } from '../../hooks/game'
import { SPEAKERS } from '../../hooks/talk'
import { TALENTS } from '../../hooks/talents'
import { pairOf } from '../../hooks/deep'
import { arrive } from '../../hooks/world'
import { SET_PLACES } from '../../hooks/stash'
import { CLASSES, RARITIES, kitted } from '../../hooks/screens'
import type { Talent } from '../../types'

type Scene = { name: string; game: Game; keys?: string[]; cols?: number; click?: string }

const out: Scene[] = []
const town = { ...apply(newGame(4), { kind: 'portal' }), gold: 300 }
for (const cls of CLASSES) for (const rarity of RARITIES) {
  const g = kitted(cls, rarity)
  out.push({ name: `inventory-${cls}-${rarity}`, game: { ...g, panel: 'bag' } })
  out.push({ name: `compact-${cls}-${rarity}`, game: { ...g, panel: 'bag' }, cols: 200 })
}
for (const cls of CLASSES) {
  const g = kitted(cls, 'rare')
  const smith = { ...town, ...g, where: 'town' as const }
  out.push({ name: `sheet-${cls}`, game: { ...g, panel: 'sheet' } })
  out.push({ name: `start-${cls}`, game: { ...g, panel: 'start' }, keys: [String(CLASSES.indexOf(cls) + 1)] })
  // The belt's counts from one to two digits, over every icon.
  const counted = g.belt.map((b, i) => ({ ...b!, tiers: [[34, 1, 0], [26, 0, 0], [25, 0, 0], [10, 2, 1], [9, 0, 0]][i] as [number, number, number] }))
  out.push({ name: `map-${cls}`, game: { ...g, panel: 'none', belt: counted } })
  out.push({ name: `forge-${cls}`, game: { ...smith, panel: 'forge' } })
  out.push({ name: `chest-${cls}`, game: { ...smith, panel: 'stash', stashed: [g.bag.slice(0, 4)] } })
  if (cls === 'knight') {
    out.push({ name: 'chest-tab2', game: { ...smith, panel: 'stash', stashed: [g.bag.slice(0, 4)] }, keys: ['p'] })
    const place = SET_PLACES[0]!
    const piece = { ...g.bag[0]!, set: place.set as Game['bag'][number]['set'], base: place.base, name: place.name, rarity: 'epic' as const }
    out.push({ name: 'chest-sets', game: { ...smith, panel: 'stash', stashed: [g.bag.slice(1, 4)], stashSets: [piece] }, keys: ['p', 'p', 'p', 'p'] })
  }
}
out.push({ name: 'map-town', game: { ...town, panel: 'none' } })
out.push({ name: 'shop', game: { ...town, panel: 'shop' } })
out.push({ name: 'settings-game', game: { ...town, panel: 'settings' } })
out.push({ name: 'settings-orders', game: { ...town, panel: 'settings' }, keys: ['p'] })
out.push({ name: 'help', game: { ...town, panel: 'settings' }, keys: ['h'] })
// The death window for each kind of killer: a big boss, a named foe, a kind, and a trap.
const foe = { hp: 0, maxHp: 1, atk: 1, xp: 1, x: 0, y: 0 }
const falls = { king: { glyph: '&', name: 'Bone King', big: 'king' as const }, rot: { glyph: 'k', name: 'the Rotking', unique: 'rot' as const }, troll: { glyph: 'T', name: 'bog troll' }, trap: undefined }
for (const [name, killer] of Object.entries(falls)) {
  const fallen = { by: killer === undefined ? 'a trap' : `the ${killer.name}`, ...(killer === undefined ? {} : { foe: { ...foe, ...killer } }), at: { x: 0, y: 0 }, depth: 30, wake: 26, lost: 120 }
  // A fall counts the death before its window opens.
  out.push({ name: `death-${name}`, game: { ...town, fallen, deaths: 1, panel: 'death' } })
}
const g = kitted('knight', 'epic')
const codexed: Game = { ...g, panel: 'codex', codex: { uniques: ['rot'], bigs: ['king'], legendaries: [], deepest: 97, level: 60, kills: 4210, bosses: 19, deaths: 12, gold: 98765, retired: 2 } }
// The log opens from the strip's gold.
out.push({ name: 'log', game: { ...g, gold: 4321, log: Array.from({ length: LOG_KEPT }, (_, i) => `Line ${i + 1} of the log.`) }, click: '4,321' })
out.push({ name: 'codex-foes', game: codexed })
out.push({ name: 'codex-finds', game: codexed, keys: ['p'] })
out.push({ name: 'retire', game: { ...g, panel: 'retire', bossSlain: 10, deepest: 12, gear: { ...g.gear, weapon: g.bag[0]! } } })
const all = Object.keys(TALENTS) as Talent[]
for (let i = 0; i < all.length; i += 3) out.push({ name: `talent-${i / 3}`, game: { ...g, panel: 'talent', level: 200, talents: all.filter((_, j) => j < i || j >= i + 3) } })
out.push({ name: 'talent-taken', game: { ...g, panel: 'talent', level: 200, talents: all } })
const pairs = new Map<string, Game>()
for (let world = 1; pairs.size < 9 && world < 500; world += 1) pairs.set(pairOf(world, 2).join('-'), { ...g, world, ...arrive(world, 60), deepest: 60, bossSlain: 60, panel: 'deep' })
for (const [pair, at] of pairs) out.push({ name: `deep-${pair}`, game: at })
out.push({ name: 'deep-tiers', game: { ...g, ...arrive(g.world, 97), deepest: 97, bossSlain: 90, panel: 'deep' } })
const recap = { calls: 42, depth: 3, level: 5, kills: 17, champions: 2, gold: 340, deaths: 1, tests: 6, commits: 2, pushes: 1, prs: 1, best: g.bag[0]! }
out.push({ name: 'recap', game: { ...g, depth: 9, level: 12, panel: 'recap', recap } })
for (const who of SPEAKERS) out.push({ name: `talk-${who}`, game: { ...town, panel: who, quest: who === 'elder' ? { kind: 'slay' as const, depth: 6, need: 5, have: 2 } : null } })

await Bun.write(process.argv[2]!, JSON.stringify(out))
console.log(out.length)
