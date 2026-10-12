// Consumables: five kinds, each in three tiers, the belt they stack in (a slot a kind), and the effects they leave.
// Adding a tier or changing one is an entry in CONSUMABLES; a kind has its fixed place on the belt (KINDS).
import type { BeltSlot, Consumable, Game } from '../types'
import { pick, roll } from './rng'

export const BELT_SIZE = 5
/** The most of one tier a slot holds. */
export const STACK_MAX = 9
/** The kinds in their belt slots, 1 to 5. */
export const KINDS: readonly Consumable[] = ['health', 'regen', 'fury', 'ward', 'smoke']
export type Tier = 1 | 2 | 3
export const TIERS: readonly Tier[] = [1, 2, 3]

const heal = (g: Game, amount: number) => {
  const before = g.hp
  g.hp = Math.min(g.maxHp, g.hp + amount)
  return g.hp - before
}

type Entry = { name: string; about: string; use: (g: Game) => string }

/** The foe left behind in smoke, then what more the tier does; with no foe, only the more. */
const escape = (g: Game, then: (g: Game) => string) => {
  if (g.foe === null) return then(g) || 'Smoke drifts away; nothing was hunting you.'
  const name = g.foe.name
  g.foe = null
  const more = then(g)
  return `You vanish in smoke. The ${name} loses you.${more === '' ? '' : ` ${more}`}`
}

const regen = (g: Game, fights: number) => {
  g.effects = { ...g.effects, regen: Math.max(g.effects.regen, fights) }
  return `Warmth spreads through you: you heal over the next ${fights} fights.`
}
const fury = (g: Game, hits: number) => {
  g.effects = { ...g.effects, fury: Math.max(g.effects.fury, hits) }
  return `Fury fills you: your next ${hits} hits deal double damage.`
}
const ward = (g: Game, hits: number) => {
  g.effects = { ...g.effects, ward: Math.max(g.effects.ward, hits) }
  return `A ward shimmers around you: it absorbs the next ${hits} hits.`
}

/** Each kind's three tiers: name, what it does in a line (as the merchant's card says), and its use. */
export const CONSUMABLES: Readonly<Record<Consumable, Readonly<Record<Tier, Entry>>>> = {
  health: {
    1: { name: 'Health Potion', about: 'Restores 35% of your HP.', use: g => `You drink a Health Potion. +${heal(g, Math.ceil(g.maxHp * 0.35))} HP` },
    2: { name: 'Greater Health Potion', about: 'Restores 70% of your HP.', use: g => `You drink a Greater Health Potion. +${heal(g, Math.ceil(g.maxHp * 0.7))} HP` },
    3: { name: 'Elixir', about: 'Restores all your HP.', use: g => `You drink an Elixir. +${heal(g, g.maxHp)} HP` },
  },
  regen: {
    1: { name: 'Regeneration Draught', about: 'Heals a tenth of your HP after each of the next 5 fights.', use: g => regen(g, 5) },
    2: { name: 'Strong Draught', about: 'Heals a tenth of your HP after each of the next 8 fights.', use: g => regen(g, 8) },
    3: { name: 'Troll Blood', about: 'Heals a tenth of your HP after each of the next 12 fights.', use: g => regen(g, 12) },
  },
  fury: {
    1: { name: 'Scroll of Fury', about: 'Your next 5 hits deal double damage.', use: g => fury(g, 5) },
    2: { name: 'Battle Hymn', about: 'Your next 8 hits deal double damage.', use: g => fury(g, 8) },
    3: { name: "Berserker's Oath", about: 'Your next 12 hits deal double damage.', use: g => fury(g, 12) },
  },
  ward: {
    1: { name: 'Ward Scroll', about: 'Absorbs the next 2 hits.', use: g => ward(g, 2) },
    2: { name: 'Greater Ward', about: 'Absorbs the next 3 hits.', use: g => ward(g, 3) },
    3: { name: 'Aegis', about: 'Absorbs the next 5 hits.', use: g => ward(g, 5) },
  },
  smoke: {
    1: { name: 'Smoke Bomb', about: 'Escapes the foe you are fighting.', use: g => escape(g, () => '') },
    2: { name: 'Shadow Step', about: 'Escapes the foe you are fighting, and restores 20% of your HP.', use: g => escape(g, h => `+${heal(h, Math.ceil(h.maxHp * 0.2))} HP`) },
    3: {
      name: 'Scroll of Passage',
      about: 'Escapes the foe you are fighting, and reveals the whole level.',
      use: g => escape(g, h => {
        h.seen = '1'.repeat(h.seen.length)
        return 'The whole level is laid bare.'
      }),
    },
  },
}

export const nameOf = (kind: Consumable, tier: Tier) => CONSUMABLES[kind][tier].name

/** What the merchant sells: a kind at a tier, written as the kind then the tier's number. */
export type Ware = `${Consumable}${Tier}`
export const wareOf = (ware: Ware) => ({ kind: ware.slice(0, -1) as Consumable, tier: Number(ware.at(-1)) as Tier })

/** The belt, a slot a kind in KINDS' order, each empty. */
export const emptyBelt = (): (BeltSlot | null)[] => Array.from({ length: BELT_SIZE }, () => null)

/** How many a slot holds in all its tiers. */
export const countOf = (slot: BeltSlot | null | undefined) => (slot === null || slot === undefined ? 0 : slot.tiers.reduce((a, b) => a + b, 0))
/** The strongest tier a slot holds, the one it uses; undefined for an empty slot. */
export const bestTier = (slot: BeltSlot | null | undefined): Tier | undefined => {
  if (slot === null || slot === undefined) return undefined
  for (const t of [3, 2, 1] as const) if ((slot.tiers[t - 1] ?? 0) > 0) return t
  return undefined
}

/** The belt slot a kind lives in. */
export const slotOf = (kind: Consumable) => KINDS.indexOf(kind)

/** Whether one more of a kind's tier fits: its slot holds fewer than STACK_MAX of that tier. */
export const hasRoom = (g: Pick<Game, 'belt'>, kind: Consumable, tier: Tier = 1) => heldOf(g, kind, tier) < STACK_MAX

/** How many of a kind's tier the belt holds. */
export const heldOf = (g: Pick<Game, 'belt'>, kind: Consumable, tier: Tier) => g.belt[slotOf(kind)]?.tiers[tier - 1] ?? 0

/** One more into its kind's slot, at its tier; false when that tier's stack is full. */
export const addToBelt = (g: Game, kind: Consumable, tier: Tier = 1): boolean => {
  if (!hasRoom(g, kind, tier)) return false
  const at = slotOf(kind)
  const now = g.belt[at]?.tiers ?? [0, 0, 0]
  const tiers = now.map((n, i) => (i === tier - 1 ? n + 1 : n)) as [number, number, number]
  g.belt = g.belt.map((s, i) => (i === at ? { kind, tiers } : s))
  return true
}

/** Uses a slot: its strongest tier, one less of it, the slot empty once none is left. */
export const useBelt = (g: Game, index: number): string => {
  const slot = g.belt[index]
  const tier = bestTier(slot)
  if (slot === undefined || slot === null || tier === undefined) return `Belt slot ${index + 1} is empty.`
  const tiers = slot.tiers.map((n, i) => (i === tier - 1 ? n - 1 : n)) as [number, number, number]
  g.belt = g.belt.map((s, i) => (i === index ? (tiers.some(n => n > 0) ? { ...slot, tiers } : null) : s))
  return CONSUMABLES[slot.kind][tier].use(g)
}

/** The healing slot when it holds a potion, or -1. */
export const healingSlot = (g: Game) => (countOf(g.belt[slotOf('health')]) > 0 ? slotOf('health') : -1)

/** One fight's worth of running effects: regeneration heals a tenth of max HP while it lasts. */
export const tickEffects = (g: Game): string | undefined => {
  if (g.effects.regen <= 0) return undefined
  g.effects = { ...g.effects, regen: g.effects.regen - 1 }
  const healed = heal(g, Math.ceil(g.maxHp / 10))
  return healed > 0 ? `You regenerate ${healed} HP.` : undefined
}

/** A drop's tier by depth: III 1 in 100 at depth 1, 2 more a depth up to 30; II 4 a depth up to 45 more; else I. */
export const tierFor = (g: Game): Tier => {
  const third = Math.min(30, 1 + 2 * (g.depth - 1))
  const n = roll(g, 100)
  if (n <= third) return 3
  if (n <= third + Math.min(45, 4 * g.depth)) return 2
  return 1
}

/**
 * What a kill drops besides gear: a kind and its tier. Healing keeps a steady supply: the chance starts at 40%, falls
 * 10 points after a potion drops and rises 10 points after a kill without one.
 */
export const killConsumable = (g: Game): { kind: Consumable; tier: Tier } | undefined => {
  if (roll(g, 100) <= g.potionChance) {
    g.potionChance = Math.max(10, g.potionChance - 10)
    return { kind: 'health', tier: tierFor(g) }
  }
  g.potionChance = Math.min(90, g.potionChance + 10)
  if (roll(g, 100) > 15) return undefined
  const kind = pick(g, g.depth >= 3 ? (['regen', 'fury', 'ward', 'smoke'] as const) : (['regen', 'fury', 'ward'] as const))
  return { kind, tier: tierFor(g) }
}
