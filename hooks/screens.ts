// Every interface the game draws, in many states: each window for every class and rarity, the strip, the shop, the
// smith, the stash, settings, the start screen and every townsperson. Pure, for the assets audit and its test.
import type { Game, HeroClass, Rarity } from '../types'
import { apply, newGame } from './game'
import { hudPixels } from './hud'
import { BASES } from './items/catalog'
import { plainItem } from './items/loot'
import { inventoryPixels } from './inventory'
import { compactPixels } from './compact'
import { shopPixels } from './shop'
import { forgePixels } from './forge'
import { chestPixels } from './chest'
import { SPEAKERS, talkPixels } from './talk'
import { sheetPixels } from './sheet'
import { settingsPixels } from './settings'
import { startPixels } from './start'
import { deathPixels } from './death'

export const CLASSES: readonly HeroClass[] = ['knight', 'mage', 'rogue']
export const RARITIES: readonly Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary']

/** A window's pixels and where it was drawn from. */
type Shot = { name: string; px: string[][] }

/** A hero carrying one of every base of their class's pool, in each rarity in turn, the belt full. */
const kitted = (cls: HeroClass, rarity: Rarity): Game => {
  const g = { ...newGame(7, cls), gold: 999, points: 2, xp: 12 }
  const pool = BASES.filter(b => b.cls === undefined || b.cls === cls)
  let x = 0
  let y = 0
  const bag = []
  for (const b of pool) {
    if (x + b.w > 8) {
      x = 0
      y += 3
    }
    if (y + b.h > 6) break
    bag.push({ ...plainItem(g, b.key, rarity), x, y })
    x += b.w
  }
  const belt = (['health', 'regen', 'fury', 'ward', 'smoke'] as const).map(kind => ({ kind, tiers: [2, 1, 1] as [number, number, number] }))
  return { ...g, bag, cursor: bag[0]?.id ?? null, belt }
}

export const shots = (): Shot[] => {
  const out: Shot[] = []
  const town = { ...apply(newGame(4), { kind: 'portal' }), gold: 300 }
  for (const cls of CLASSES) for (const rarity of RARITIES) {
    const g = kitted(cls, rarity)
    out.push({ name: `inventory-${cls}-${rarity}`, px: inventoryPixels(g) })
    out.push({ name: `compact-${cls}-${rarity}`, px: compactPixels(g) })
  }
  for (const cls of CLASSES) {
    const g = kitted(cls, 'rare')
    out.push({ name: `sheet-${cls}`, px: sheetPixels(g) })
    out.push({ name: `start-${cls}`, px: startPixels(g, { cls }) })
    out.push({ name: `strip-${cls}`, px: hudPixels(g, 111).px })
    out.push({ name: `forge-${cls}`, px: forgePixels({ ...town, ...g, where: 'town' }, { slot: null, menu: false } as never) })
    out.push({ name: `chest-${cls}`, px: chestPixels({ ...town, ...g, where: 'town', stashed: g.bag.slice(0, 4) }, { picked: null } as never) })
  }
  out.push({ name: 'shop', px: shopPixels(town, { ware: null, menu: false }) })
  out.push({ name: 'settings', px: settingsPixels(town, { effects: true, music: false, volume: 2 }) })
  // The death window for each kind of killer: a big boss, a named foe, a kind, and a trap.
  const foe = { hp: 0, maxHp: 1, atk: 1, xp: 1, x: 0, y: 0 }
  const falls = { king: { glyph: '&', name: 'Bone King', big: 'king' as const }, rot: { glyph: 'k', name: 'the Rotking', unique: 'rot' as const }, troll: { glyph: 'T', name: 'bog troll' }, trap: undefined }
  for (const [name, killer] of Object.entries(falls)) {
    const fallen = { by: killer === undefined ? 'a trap' : `the ${killer.name}`, ...(killer === undefined ? {} : { foe: { ...foe, ...killer } }), at: { x: 0, y: 0 }, depth: 30, wake: 26, lost: 120 }
    out.push({ name: `death-${name}`, px: deathPixels({ ...town, fallen, panel: 'death' }) })
  }
  for (const who of SPEAKERS) out.push({ name: `talk-${who}`, px: talkPixels({ ...town, quest: who === 'elder' ? { kind: 'slay', depth: 6, need: 5, have: 2 } : null }, who) })
  return out
}
