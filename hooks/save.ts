// Saves from older versions of the mod, brought up to the current shape. Each version step is one migration.
import type { BeltSlot, Consumable, Game, Item, Rarity } from '../types'
import { KINDS, TIERS, emptyBelt, slotOf } from './consumables'
import type { Tier } from './consumables'
import { baseOf, repack, priceOf } from './items'
import { BIG_EVERY, generate, layoutOf, themeOf } from './map'
import type { Theme } from './map'

/** The theme of a depth before version 9 added the fungal deep and the frozen caverns: three themes, five depths each. */
const themeBefore9 = (depth: number): Theme => (['crypt', 'flooded', 'forge'] as const)[Math.floor((depth - 1) / 5) % 3]!
import { FOG, SAVE_VERSION, arrive, newGame } from './world'

type LegacyItem = Omit<Item, 'base' | 'crit' | 'xp' | 'rarity'> & { rarity: string; base?: string; crit?: number; xp?: number }

const LEGACY_RARITY: Record<string, Rarity> = { common: 'common', enchanted: 'uncommon', forged: 'rare', legendary: 'legendary' }

/** Which base an item from before bases existed most likely is, judged by its name and slot. */
const legacyBase = (item: LegacyItem): string => {
  const has = (word: string) => item.name.includes(word)
  if (item.slot === 'weapon') return has('Axe') ? 'axe' : has('Dagger') ? 'dagger' : 'sword'
  if (item.slot === 'armor') return has('Chain') ? 'chain' : has('Leather') ? 'leather' : 'tunic'
  return { helm: 'hood', ring: 'ring', amulet: 'amulet' }[item.slot as 'helm' | 'ring' | 'amulet'] ?? 'ring'
}

/** An item from a version 2 save in the version 3 shape. It keeps its stats and stays wearable by any class. */
export const migrateItem = (item: LegacyItem): Item => {
  if (item.base !== undefined && item.rarity in { uncommon: 1, rare: 1, epic: 1, common: 1, legendary: 1 }) return item as Item
  const base = baseOf(legacyBase(item))
  return { ...item, base: base?.key ?? 'ring', w: base?.w ?? 1, h: base?.h ?? 1, rarity: LEGACY_RARITY[item.rarity] ?? 'common', crit: item.crit ?? 0, xp: item.xp ?? 0, cls: undefined }
}

/** Version 3: items move to the five tiers and the 8 x 6 bag, potions to the belt, and the hero is a Knight. */
const toVersion3 = (g: Game): Game => {
  const legacy = g as Game & { potions?: number }
  const gear = Object.fromEntries(Object.entries(g.gear).map(([slot, item]) => [slot, item && migrateItem(item as LegacyItem)]))
  const { bag, left } = repack(g.bag.map(i => migrateItem(i as LegacyItem)))
  const potions = Math.min(9, legacy.potions ?? 0)
  const belt = potions > 0 ? [{ kind: 'health' as const, tiers: [potions, 0, 0] as [number, number, number] }, ...emptyBelt().slice(1)] : emptyBelt()
  const { potions: _, ...rest } = legacy
  return {
    ...rest,
    gear,
    bag,
    gold: g.gold + left.reduce((sum, i) => sum + priceOf(i), 0),
    cursor: bag.some(i => i.id === g.cursor) ? g.cursor : (bag[0]?.id ?? null),
    cls: 'knight',
    belt,
    effects: { regen: 0, fury: 0, ward: 0 },
    potionChance: 40,
    dryKills: 0,
  }
}

/** Fills fields a save from an older version lacks, and runs each migration it is behind on. */
/** Each game normalized once: games are never changed in place, so the same input always gives the same output. */
const normalized = new WeakMap<Game, Game>()

export const normalize = (game: Game): Game => {
  const known = normalized.get(game)
  if (known !== undefined) return known
  const g = normalizeOnce(game)
  normalized.set(game, g)
  normalized.set(g, g)
  return g
}

/** A belt slot as saved before version 7: one of seven kinds, and a count. */
type LegacySlot = { kind: string; count: number }
/** What each old kind is now: its kind, and the tier it became. */
const LEGACY_KIND: Readonly<Record<string, readonly [Consumable, Tier]>> = {
  health: ['health', 1], greater: ['health', 3], regen: ['regen', 1], fury: ['fury', 1], ward: ['ward', 1], mapping: ['smoke', 3], smoke: ['smoke', 1],
}

/** A saved slot's stacks as [kind, tier, count]: an old stack at the tier its kind became, a tiered slot as it is. */
const stacksOf = (slot: LegacySlot | BeltSlot): [Consumable, Tier, number][] => {
  if ('tiers' in slot) return KINDS.includes(slot.kind) ? TIERS.map(t => [slot.kind, t, slot.tiers[t - 1] ?? 0]) : []
  const [kind, tier] = LEGACY_KIND[slot.kind] ?? []
  return kind === undefined || tier === undefined ? [] : [[kind, tier, slot.count]]
}

/** Version 7: the belt holds five kinds in three tiers, a slot a kind; each old stack joins its kind's slot at its tier. */
/** The most of one tier a slot held at version 7: a save of that version merges up to it, as it then did. */
const V7_STACK_MAX = 9

export const toVersion7 = (belt: readonly (LegacySlot | BeltSlot | null)[]): (BeltSlot | null)[] => {
  const out = emptyBelt()
  for (const [kind, tier, count] of belt.flatMap(s => (s === null ? [] : stacksOf(s)))) {
    const at = slotOf(kind)
    const tiers = [...(out[at]?.tiers ?? [0, 0, 0])] as [number, number, number]
    tiers[tier - 1] = Math.min(V7_STACK_MAX, tiers[tier - 1]! + Math.max(0, Math.floor(count)))
    out[at] = tiers.some(n => n > 0) ? { kind, tiers } : null
  }
  return out
}

/** Version 12: each work's once-a-depth reward keeps every depth it was given on, where it kept the last alone. */
const toVersion12 = (boons: unknown): Game['boons'] =>
  typeof boons !== 'object' || boons === null
    ? undefined
    : Object.fromEntries(Object.entries(boons).flatMap(([work, depth]) => (typeof depth === 'number' ? [[work, [depth]]] : [])))

/** Version 13: the stash has tabs; what one list held is its first. */
const toVersion13 = (stashed: unknown): Game['stashed'] => [Array.isArray(stashed) ? (stashed as Item[]) : []]

/** The save's fields brought to the current shape, each migration it is behind on run, stamped current. */
const reshaped = (game: Game, version: number): Game => {
  let g: Game = { ...newGame(game.seed), ...game }
  // Before version 2 the saved view was the old default, not a choice: it opens on pixel art.
  if (version < 2) g = { ...g, zoom: 3 }
  if (version < 3) g = toVersion3({ ...g, gear: game.gear ?? {}, bag: game.bag ?? [] })
  if (version < 7) g = { ...g, belt: toVersion7(g.belt as (LegacySlot | BeltSlot | null)[]) }
  if (version < 12) g = { ...g, boons: toVersion12(g.boons as unknown) }
  if (version < 13) g = { ...g, stashed: toVersion13(game.stashed as unknown) }
  // Version 4 added the town (`where`, `portal`): the new-game defaults spread above put an older save in the dungeon.
  // A view that no longer exists (4 was briefly a pixel view) opens on the pixel view.
  if (![1, 2, 3].includes(g.zoom)) g = { ...g, zoom: 3 }
  return { ...g, version: SAVE_VERSION }
}

/**
 * Whether the save's level is no longer the one it was saved on. Versions 5 and 6 rebuilt every level (6 gave rooms
 * shapes); version 8 gave some depths another layout, version 9 another theme, version 10 every tenth depth a boss's
 * arena, version 11 rounded, alcoved and island rooms to the levels that have one.
 */
const isRebuiltSince = (g: Game, version: number) =>
  version < 6 ||
  (version < 8 && layoutOf(g.world, g.depth) !== 'rooms') ||
  (version < 9 && themeBefore9(g.depth) !== themeOf(g.depth)) ||
  (version < 10 && g.depth % BIG_EVERY === 0) ||
  (version < 11 && hasShapeSince10(g))

/** A shape no level had before version 11: a level with one is not the level a version 10 save stood on. */
const hasShapeSince10 = (g: Game) => generate(g.world, g.depth).rooms.some(r => r.shape === 'rounded' || r.shape === 'alcoves' || r.shape === 'island')

const normalizeOnce = (game: Game): Game => {
  const version = game.version ?? 1
  const g = reshaped(game, version)
  const isCurrent = typeof game.world === 'number' && typeof game.y === 'number' && game.seen?.length === FOG.length
  if (!isCurrent) return { ...g, world: g.seed, ...arrive(g.seed, g.depth), foe: null }
  // On a level rebuilt since, an older position, fog and pickups belong to a layout that is gone: the save re-enters its
  // depth at the new start; in town only the portal's way back moves there.
  if (isRebuiltSince(g, version)) {
    const fresh = arrive(g.world, g.depth)
    if (g.where === 'town') return { ...g, seen: fresh.seen, taken: fresh.taken, portal: { x: fresh.x, y: fresh.y }, foe: null }
    return { ...g, ...fresh, foe: null }
  }
  return g
}

/** A save written by a newer version of the mod than this one: opened here it would be read wrong, and saved, stamped older. */
export const isFromLater = (saved: unknown) =>
  typeof saved === 'object' && saved !== null && typeof (saved as Game).version === 'number' && (saved as Game).version > SAVE_VERSION

/**
 * Whether a stored save can be opened: an object, its bag and log lists and its gear a set wherever it has them (the
 * oldest saves lack some), that `normalize` brings up to date.
 */
export const isReadable = (saved: unknown): saved is Game => {
  if (typeof saved !== 'object' || saved === null || Array.isArray(saved) || isFromLater(saved)) return false
  const s = saved as Record<string, unknown>
  const isListOrNone = (key: string) => s[key] === undefined || Array.isArray(s[key])
  if (!isListOrNone('bag') || !isListOrNone('log') || !(s.gear === undefined || (typeof s.gear === 'object' && s.gear !== null))) return false
  try {
    normalize(saved as Game)
    return true
  } catch {
    return false
  }
}

/**
 * What a session opens on, when the game is not yet set this session (`version` 0): the saved game, or with none, or
 * none it can read, a first game, on the start screen. Undefined leaves the game as it is.
 */
export const openingGame = (current: Game, version: number, saved: unknown): Game | undefined =>
  version !== 0 ? undefined : isReadable(saved) ? saved : { ...current, panel: 'start' }

/** A quest as the log says it, the prompt's words quoted: `A new quest: "..."`, a repeat counted after. */
const QUOTED_QUEST = /^A new quest: ".*"( \(x\d+\))?$/

/** The game as it is written to disk: a prompt's words, quoted in the log as a quest, stay in the session alone. */
export const savable = (g: Game): Game =>
  g.log.some(l => QUOTED_QUEST.test(l)) ? { ...g, log: g.log.map(l => l.replace(QUOTED_QUEST, 'A new quest.$1')) } : g
