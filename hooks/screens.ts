// Every interface the game draws, in many states: each window for every class and rarity, the strip, the shop, the
// smith, the stash, settings, the start screen, the codex, retiring, every talent and mark, the recap and every
// townsperson, each with the text boxes over it. Pure, for the assets audit, the pane size and the window previews.
import type { Game, HeroClass, Rarity, Talent } from '../types'
import { LOG_KEPT, apply, newGame } from './game'
import { hudPixels } from './hud'
import { BASES } from './items/catalog'
import { plainItem } from './items/loot'
import { inventoryScreenPixels } from './inventory'
import { BAG_UI_IDLE, bagOverlay } from './bagui'
import { compactOverlay, compactPixels } from './compact'
import { shopOverlay, shopPixels } from './shop'
import { forgeOverlay, forgePixels } from './forge'
import { chestOverlay, chestPixels } from './chest'
import { SPEAKERS, talkOverlay, talkPixels } from './talk'
import { sheetOverlay, sheetPixels } from './sheet'
import { settingsPixels } from './settings'
import { startOverlay, startPixels } from './start'
import { deathOverlay, deathPixels } from './death'
import { codexOverlay, codexPixels } from './codexwindow'
import { retireOverlay, retirePixels } from './retirewindow'
import { TALENTS } from './talents'
import { talentOverlay, talentPixels } from './talentwindow'
import { pairOf } from './deep'
import { deepOverlay, deepPixels } from './deepwindow'
import { helpOverlay, helpPixels } from './helpwindow'
import { logOverlay, logPixels } from './logwindow'
import { recapOverlay, recapPixels } from './recapwindow'
import type { OverlayBox } from './window'
import { arrive } from './world'

export const CLASSES: readonly HeroClass[] = ['knight', 'mage', 'rogue']
export const RARITIES: readonly Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary']

/** A window's pixels, the text boxes over them, and where it was drawn from. */
export type Shot = { name: string; px: string[][]; boxes: readonly OverlayBox[] }
const shot = (name: string, px: string[][], boxes: readonly OverlayBox[] = []): Shot => ({ name, px, boxes })

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

/** The windows of a hero's long game: the codex, retiring, the talents offered three by three, the deep at every pair of marks. */
const heroShots = (g: Game): Shot[] => {
  const codexed: Game = { ...g, codex: { uniques: ['rot'], bigs: ['king'], legendaries: [], deepest: 97, level: 60, kills: 4210, bosses: 19, deaths: 12, gold: 98765, retired: 2 } }
  const retiring = { ...g, bossSlain: 10, deepest: 12, gear: { weapon: g.bag[0]! } }
  // The log full: every line it keeps.
  const logged = { ...g, log: Array.from({ length: LOG_KEPT }, (_, i) => `Line ${i + 1} of the log.`) }
  const out: Shot[] = [
    shot('help', helpPixels(), helpOverlay()),
    shot('log', logPixels(logged), logOverlay(logged)),
    ...(['foes', 'finds'] as const).map(page => shot(`codex-${page}`, codexPixels(codexed, { page }), codexOverlay(codexed, { page }))),
    shot('retire', retirePixels(retiring, { slot: 'weapon' }), retireOverlay(retiring, { slot: 'weapon' })),
  ]
  const all = Object.keys(TALENTS) as Talent[]
  for (let i = 0; i < all.length; i += 3) {
    const offered = { ...g, level: 200, talents: all.filter((_, j) => j < i || j >= i + 3) }
    out.push(shot(`talent-${i / 3}`, talentPixels(offered), talentOverlay(offered, { chosen: 0 })))
  }
  // Every talent taken: the list at its longest.
  const allTaken = { ...g, level: 200, talents: all }
  out.push(shot('talent-taken', talentPixels(allTaken), talentOverlay(allTaken, { chosen: 0 })))
  const pairs = new Map<string, Game>()
  for (let world = 1; pairs.size < 9 && world < 500; world += 1) {
    const at = { ...g, world, ...arrive(world, 60), deepest: 60, bossSlain: 60 }
    pairs.set(pairOf(world, 2).join('-'), at)
  }
  for (const [pair, at] of pairs) out.push(shot(`deep-${pair}`, deepPixels(at), deepOverlay(at)))
  // Inside a tier, no fork waiting: the head and the tiers alone.
  const inTier = { ...g, ...arrive(g.world, 97), deepest: 97, bossSlain: 90 }
  out.push(shot('deep-tiers', deepPixels(inTier), deepOverlay(inTier)))
  const recapped = { ...g, depth: 9, level: 12, panel: 'recap' as const, recap: { calls: 42, depth: 3, level: 5, kills: 17, champions: 2, gold: 340, deaths: 1, tests: 6, commits: 2, pushes: 1, prs: 1, best: g.bag[0]! } }
  out.push(shot('recap', recapPixels(recapped), recapOverlay(recapped)))
  return out
}

export const shots = (): Shot[] => {
  const out: Shot[] = []
  const town = { ...apply(newGame(4), { kind: 'portal' }), gold: 300 }
  for (const cls of CLASSES) for (const rarity of RARITIES) {
    const g = kitted(cls, rarity)
    out.push(shot(`inventory-${cls}-${rarity}`, inventoryScreenPixels(g), bagOverlay(g, BAG_UI_IDLE)))
    out.push(shot(`compact-${cls}-${rarity}`, compactPixels(g), compactOverlay(g, BAG_UI_IDLE)))
  }
  for (const cls of CLASSES) {
    const g = kitted(cls, 'rare')
    const smith = { ...town, ...g, where: 'town' as const }
    const stash = { ...smith, stashed: g.bag.slice(0, 4) }
    out.push(shot(`sheet-${cls}`, sheetPixels(g), sheetOverlay(g)))
    out.push(shot(`start-${cls}`, startPixels(g, { cls }), startOverlay(g, { cls })))
    out.push(shot(`strip-${cls}`, hudPixels(g, 111).px))
    out.push(shot(`forge-${cls}`, forgePixels(smith, { slot: null, menu: false } as never), forgeOverlay(smith, { slot: null, menu: false } as never)))
    out.push(shot(`chest-${cls}`, chestPixels(stash, { picked: null } as never), chestOverlay(stash, { picked: null } as never)))
  }
  out.push(shot('shop', shopPixels(town, { ware: null, menu: false }), shopOverlay(town, { ware: null, menu: false })))
  for (const page of ['game', 'orders'] as const) out.push(shot(`settings-${page}`, settingsPixels(town, { effects: false, music: false, volume: 4 }, { page })))
  // The death window for each kind of killer: a big boss, a named foe, a kind, and a trap.
  const foe = { hp: 0, maxHp: 1, atk: 1, xp: 1, x: 0, y: 0 }
  const falls = { king: { glyph: '&', name: 'Bone King', big: 'king' as const }, rot: { glyph: 'k', name: 'the Rotking', unique: 'rot' as const }, troll: { glyph: 'T', name: 'bog troll' }, trap: undefined }
  for (const [name, killer] of Object.entries(falls)) {
    const fallen = { by: killer === undefined ? 'a trap' : `the ${killer.name}`, ...(killer === undefined ? {} : { foe: { ...foe, ...killer } }), at: { x: 0, y: 0 }, depth: 30, wake: 26, lost: 120 }
    const dead = { ...town, fallen, panel: 'death' as const }
    out.push(shot(`death-${name}`, deathPixels(dead), deathOverlay(dead)))
  }
  out.push(...heroShots(kitted('knight', 'epic')))
  for (const who of SPEAKERS) {
    const there = { ...town, quest: who === 'elder' ? { kind: 'slay' as const, depth: 6, need: 5, have: 2 } : null }
    out.push(shot(`talk-${who}`, talkPixels(there, who), talkOverlay(there, who)))
  }
  return out
}
