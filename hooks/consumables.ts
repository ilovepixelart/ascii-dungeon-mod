// Consumables: what each does, the belt they stack in, and the effects they leave running.
// Adding a consumable is one entry in CONSUMABLES (plus its kind in the Consumable type).
import type { BeltSlot, Consumable, Game } from '../types'
import { pick, roll } from './rng'

export const BELT_SIZE = 5
export const STACK_MAX = 9

const heal = (g: Game, amount: number) => {
  const before = g.hp
  g.hp = Math.min(g.maxHp, g.hp + amount)
  return g.hp - before
}

/** Each consumable: its name, what it does in a line (as the merchant's card says), and its use. */
export const CONSUMABLES: Readonly<Record<Consumable, { name: string; about: string; use: (g: Game) => string }>> = {
  health: { name: 'Health Potion', about: 'Restores 35% of your HP.', use: g => `You drink a Health Potion. +${heal(g, Math.ceil(g.maxHp * 0.35))} HP` },
  greater: { name: 'Greater Health Potion', about: 'Restores all your HP.', use: g => `You drink a Greater Health Potion. +${heal(g, g.maxHp)} HP` },
  regen: {
    name: 'Regeneration Draught',
    about: 'Heals a tenth of your HP after each of the next 5 fights.',
    use: g => {
      g.effects = { ...g.effects, regen: 5 }
      return 'Warmth spreads through you: you heal over the next 5 fights.'
    },
  },
  mapping: {
    name: 'Scroll of Mapping',
    about: 'Reveals the whole level.',
    use: g => {
      g.seen = '1'.repeat(g.seen.length)
      return 'The scroll burns away and the whole level is laid bare.'
    },
  },
  fury: {
    name: 'Scroll of Fury',
    about: 'Your next 5 hits deal double damage.',
    use: g => {
      g.effects = { ...g.effects, fury: 5 }
      return 'Fury fills you: your next 5 hits deal double damage.'
    },
  },
  ward: {
    name: 'Ward Scroll',
    about: 'Absorbs the next 2 hits.',
    use: g => {
      g.effects = { ...g.effects, ward: 2 }
      return 'A ward shimmers around you: it absorbs the next 2 hits.'
    },
  },
  smoke: {
    name: 'Smoke Bomb',
    about: 'Escapes the foe you are fighting.',
    use: g => {
      if (g.foe === null) return 'Smoke drifts away; nothing was hunting you.'
      const name = g.foe.name
      g.foe = null
      return `You vanish in smoke. The ${name} loses you.`
    },
  },
}

export const emptyBelt = (): (BeltSlot | null)[] => Array.from({ length: BELT_SIZE }, () => null)

/** Where one more goes: a slot of the same kind with room, else the first empty slot; -1 when the belt is full. */
export const beltRoom = (g: Pick<Game, 'belt'>, kind: Consumable) => {
  const at = g.belt.findIndex(s => s?.kind === kind && s.count < STACK_MAX)
  return at >= 0 ? at : g.belt.findIndex(s => s === null)
}

/** Stacks onto a slot of the same kind with room, else the first empty slot; false when the belt is full. */
export const addToBelt = (g: Game, kind: Consumable): boolean => {
  const free = beltRoom(g, kind)
  if (free < 0) return false
  const slot = g.belt[free]
  g.belt = g.belt.map((s, i) => (i === free ? { kind, count: (slot?.count ?? 0) + 1 } : s))
  return true
}

export const useBelt = (g: Game, index: number): string => {
  const slot = g.belt[index]
  if (slot === undefined || slot === null) return `Belt slot ${index + 1} is empty.`
  g.belt = g.belt.map((s, i) => (i === index ? (s !== null && s.count > 1 ? { ...s, count: s.count - 1 } : null) : s))
  return CONSUMABLES[slot.kind].use(g)
}

/** The first belt slot holding a healing potion, or -1. */
export const healingSlot = (g: Game) => g.belt.findIndex(s => s?.kind === 'health' || s?.kind === 'greater')

/** One fight's worth of running effects: regeneration heals a tenth of max HP while it lasts. */
export const tickEffects = (g: Game): string | undefined => {
  if (g.effects.regen <= 0) return undefined
  g.effects = { ...g.effects, regen: g.effects.regen - 1 }
  const healed = heal(g, Math.ceil(g.maxHp / 10))
  return healed > 0 ? `You regenerate ${healed} HP.` : undefined
}

/**
 * What a kill drops besides gear. Health potions keep a steady supply: the chance starts at 40%,
 * falls 10 points after a potion drops and rises 10 points after a kill without one.
 */
export const killConsumable = (g: Game): Consumable | undefined => {
  if (roll(g, 100) <= g.potionChance) {
    g.potionChance = Math.max(10, g.potionChance - 10)
    return g.depth >= 4 && roll(g, 4) === 1 ? 'greater' : 'health'
  }
  g.potionChance = Math.min(90, g.potionChance + 10)
  if (roll(g, 100) > 15) return undefined
  return pick(g, g.depth >= 3 ? ['regen', 'mapping', 'fury', 'ward', 'smoke'] : ['regen', 'mapping', 'fury', 'ward'])
}
