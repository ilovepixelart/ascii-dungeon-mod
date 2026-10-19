// The item catalog: data only. Adding a base, an affix or a Legendary is one entry here; no logic changes.
import type { ClassSet, HeroClass, Rarity, Slot, Trigger } from '../../types'
import type { Stats } from './stats'

export const SLOTS: readonly Slot[] = ['weapon', 'offhand', 'helm', 'armor', 'boots', 'ring', 'amulet']

export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#e8e8e8',
  uncommon: '#3ccf4e',
  rare: '#3b8eea',
  epic: '#a85cf0',
  legendary: '#ff8a1f',
}

export const RARITY_NAME: Record<Rarity, string> = { common: 'Common', uncommon: 'Uncommon', rare: 'Rare', epic: 'Epic', legendary: 'Legendary' }

export const CLASS_NAME: Record<HeroClass, string> = { knight: 'Knight', mage: 'Mage', rogue: 'Rogue' }

export type Base = Partial<Stats> & { key: string; name: string; slot: Slot; w: number; h: number; cls?: HeroClass }
export type Affix = Partial<Stats> & { name: string }
export type Legendary = Partial<Stats> & { base: string; name: string; power: string }

/** Every base, keyed by its icon; `cls` absent means any class wears it. */
export const BASES: readonly Base[] = [
  { key: 'sword', name: 'Short Sword', slot: 'weapon', w: 1, h: 3, cls: 'knight', atk: 2 },
  { key: 'mace', name: 'Mace', slot: 'weapon', w: 1, h: 3, cls: 'knight', atk: 3 },
  { key: 'axe', name: 'War Axe', slot: 'weapon', w: 2, h: 3, cls: 'knight', atk: 4 },
  { key: 'staff', name: 'Ash Staff', slot: 'weapon', w: 1, h: 3, cls: 'mage', atk: 2, xp: 10 },
  { key: 'wand', name: 'Wand', slot: 'weapon', w: 1, h: 2, cls: 'mage', atk: 1, crit: 10 },
  { key: 'scepter', name: 'Rune Scepter', slot: 'weapon', w: 1, h: 3, cls: 'mage', atk: 3 },
  { key: 'dagger', name: 'Dagger', slot: 'weapon', w: 1, h: 2, cls: 'rogue', atk: 1, crit: 5 },
  { key: 'bow', name: 'Short Bow', slot: 'weapon', w: 1, h: 3, cls: 'rogue', atk: 3 },
  { key: 'rapier', name: 'Rapier', slot: 'weapon', w: 1, h: 3, cls: 'rogue', atk: 2, crit: 5 },
  { key: 'buckler', name: 'Buckler', slot: 'offhand', w: 2, h: 2, cls: 'knight', def: 1 },
  { key: 'kite', name: 'Kite Shield', slot: 'offhand', w: 2, h: 3, cls: 'knight', def: 2 },
  { key: 'tower', name: 'Tower Shield', slot: 'offhand', w: 2, h: 3, cls: 'knight', def: 3 },
  { key: 'tome', name: 'Tome of Sparks', slot: 'offhand', w: 2, h: 2, cls: 'mage', atk: 2 },
  { key: 'orb', name: 'Crystal Orb', slot: 'offhand', w: 2, h: 2, cls: 'mage', crit: 10 },
  { key: 'grimoire', name: 'Grimoire', slot: 'offhand', w: 2, h: 2, cls: 'mage', xp: 15 },
  { key: 'parry', name: 'Parrying Dagger', slot: 'offhand', w: 1, h: 2, cls: 'rogue', def: 1, crit: 5 },
  { key: 'knives', name: 'Throwing Knives', slot: 'offhand', w: 1, h: 2, cls: 'rogue', atk: 2 },
  { key: 'quiver', name: 'Quiver', slot: 'offhand', w: 1, h: 3, cls: 'rogue', crit: 10 },
  { key: 'hood', name: 'Hood', slot: 'helm', w: 2, h: 2, cls: 'knight', hp: 3 },
  { key: 'steelHelm', name: 'Steel Helm', slot: 'helm', w: 2, h: 2, cls: 'knight', def: 1 },
  { key: 'hornedHelm', name: 'Horned Helm', slot: 'helm', w: 2, h: 2, cls: 'knight', def: 2 },
  { key: 'hat', name: 'Pointed Hat', slot: 'helm', w: 2, h: 2, cls: 'mage', xp: 10, def: 1 },
  { key: 'circlet', name: 'Silver Circlet', slot: 'helm', w: 2, h: 2, cls: 'mage', atk: 1, def: 1 },
  { key: 'sageHood', name: "Sage's Hood", slot: 'helm', w: 2, h: 2, cls: 'mage', hp: 4 },
  { key: 'cowl', name: 'Cowl', slot: 'helm', w: 2, h: 2, cls: 'rogue', crit: 5, def: 1 },
  { key: 'mask', name: "Thief's Mask", slot: 'helm', w: 2, h: 2, cls: 'rogue', crit: 5, xp: 5 },
  { key: 'bandana', name: 'Bandana', slot: 'helm', w: 2, h: 2, cls: 'rogue', hp: 4 },
  { key: 'tunic', name: 'Tunic', slot: 'armor', w: 2, h: 3, cls: 'knight', hp: 4 },
  { key: 'chain', name: 'Chain Shirt', slot: 'armor', w: 2, h: 3, cls: 'knight', def: 2 },
  { key: 'plate', name: 'Plate', slot: 'armor', w: 2, h: 3, cls: 'knight', def: 3 },
  { key: 'robe', name: 'Robe', slot: 'armor', w: 2, h: 3, cls: 'mage', hp: 5, def: 1 },
  { key: 'vestments', name: 'Silk Vestments', slot: 'armor', w: 2, h: 3, cls: 'mage', xp: 10, hp: 3 },
  { key: 'mantle', name: 'Warded Mantle', slot: 'armor', w: 2, h: 3, cls: 'mage', def: 2, hp: 2 },
  { key: 'leather', name: 'Leather Coat', slot: 'armor', w: 2, h: 3, cls: 'rogue', def: 1 },
  { key: 'cloak', name: 'Shadow Cloak', slot: 'armor', w: 2, h: 3, cls: 'rogue', def: 1, crit: 5 },
  { key: 'jerkin', name: 'Studded Jerkin', slot: 'armor', w: 2, h: 3, cls: 'rogue', def: 2, hp: 2 },
  { key: 'boots', name: 'Leather Boots', slot: 'boots', w: 2, h: 2, def: 1 },
  { key: 'greaves', name: 'Iron Greaves', slot: 'boots', w: 2, h: 2, cls: 'knight', def: 2 },
  { key: 'slippers', name: 'Silk Slippers', slot: 'boots', w: 2, h: 2, cls: 'mage', xp: 10 },
  { key: 'treads', name: 'Shadow Treads', slot: 'boots', w: 2, h: 2, cls: 'rogue', crit: 5 },
  { key: 'ring', name: 'Band', slot: 'ring', w: 1, h: 1 },
  { key: 'signet', name: 'Signet', slot: 'ring', w: 1, h: 1 },
  { key: 'amulet', name: 'Charm', slot: 'amulet', w: 1, h: 1, hp: 2 },
  { key: 'pendant', name: 'Pendant', slot: 'amulet', w: 1, h: 1, hp: 2 },
]

export const baseOf = (key: string) => BASES.find(b => b.key === key)

export const PREFIXES: readonly Affix[] = [
  { name: 'Sharp', atk: 2 },
  { name: 'Sturdy', def: 2 },
  { name: 'Hearty', hp: 5 },
  { name: 'Linted', atk: 1, def: 1 },
  { name: 'Refactored', atk: 1, hp: 3 },
]

export const SUFFIXES: readonly Affix[] = [
  { name: 'of the Bear', hp: 8 },
  { name: 'of Force', atk: 3 },
  { name: 'of Warding', def: 3 },
  { name: 'of Green Builds', def: 1, hp: 4 },
  { name: 'of Fast Feedback', atk: 2, def: 1 },
]

/** Fixed names and stats; each carries one power by key (its effect is described in POWERS). */
export const LEGENDARIES: readonly Legendary[] = [
  { base: 'sword', name: 'Segfault, the Null Blade', atk: 8, power: 'tripleCrit' },
  { base: 'amulet', name: 'Rubber Duck of Insight', atk: 2, def: 2, hp: 10, xp: 50, power: 'duck' },
  { base: 'chain', name: 'Mantle of the Monorepo', def: 6, hp: 10, power: 'failHeal' },
  { base: 'ring', name: 'Band of the Endless Loop', atk: 4, hp: 4, power: 'loopHeal' },
  { base: 'kite', name: 'Aegis of Green Builds', def: 4, power: 'greenBlock' },
  { base: 'staff', name: 'Staff of Stack Traces', atk: 6, power: 'stackTrace' },
  { base: 'dagger', name: 'Whisper of the Linter', atk: 5, power: 'chainCrit' },
]

export const POWERS: Readonly<Record<string, string>> = {
  tripleCrit: 'Critical hits deal triple damage.',
  duck: 'Half again as much XP from kills.',
  failHeal: 'A failed tool call heals 1 HP.',
  loopHeal: 'Every fifth kill heals 3 HP.',
  greenBlock: 'A passing test run wards off the next hit.',
  stackTrace: 'A failed tool call strikes the foe as well.',
  chainCrit: 'A critical hit makes the next hit critical too.',
}

/** Every trigger: its name, what it does, and whether it rewards the player's work. */
export const TRIGGERS: Readonly<Record<Trigger, { name: string; does: string; work?: true }>> = {
  thorns: { name: 'Thorns', does: 'A foe that hits you takes a tenth of the blow back.' },
  leeching: { name: 'Leeching', does: 'A kill heals 1 HP.' },
  momentum: { name: 'Momentum', does: 'After a kill, the next blow deals a quarter more.' },
  bulwark: { name: 'Bulwark', does: 'The first blow that lands each fight is halved.' },
  executioner: { name: 'Executioner', does: 'A blow on a foe under a quarter HP deals half again.' },
  prospector: { name: 'Prospector', does: 'Kills pay a fifth more gold.' },
  quickStudy: { name: 'Quick Study', does: 'A passing test run gives 1 XP a depth.', work: true },
  freshStart: { name: 'Fresh Start', does: "A commit's shrine also gives 1 blow of fury.", work: true },
}
/** Of the Rares, this many in a hundred carry a trigger; every Epic does. */
export const RARE_TRIGGER_SHARE = 34
/** What a trigger adds to an item's worth. */
export const TRIGGER_WORTH = 3

/** Each class's set: its pieces (base and name), what two worn add, and what three do to the class's ability. */
export const SETS: Readonly<Record<ClassSet, { name: string; cls: HeroClass; pieces: readonly { base: string; name: string }[]; two: Partial<Stats>; twoSaid: string; three: string }>> = {
  oathbound: {
    name: 'Oathbound',
    cls: 'knight',
    pieces: [{ base: 'sword', name: 'Oathbound Blade' }, { base: 'plate', name: 'Oathbound Plate' }, { base: 'hornedHelm', name: 'Oathbound Helm' }],
    two: { def: 2 },
    twoSaid: '+2 def',
    three: 'Shield block turns the first blow of a fight and halves the second.',
  },
  archivist: {
    name: "Archivist's",
    cls: 'mage',
    pieces: [{ base: 'scepter', name: "Archivist's Scepter" }, { base: 'vestments', name: "Archivist's Vestments" }, { base: 'circlet', name: "Archivist's Circlet" }],
    two: { xp: 10 },
    twoSaid: '+10% XP',
    three: 'Siphon restores a quarter of max HP, not a fifth.',
  },
  nightglass: {
    name: 'Nightglass',
    cls: 'rogue',
    pieces: [{ base: 'rapier', name: 'Nightglass Rapier' }, { base: 'cloak', name: 'Nightglass Cloak' }, { base: 'cowl', name: 'Nightglass Cowl' }],
    two: { crit: 5 },
    twoSaid: '+5% crit',
    three: 'Ambush makes the first two strikes of a fight sure criticals.',
  },
}
/** A set's own color: no tier uses it. */
export const SET_COLOR = '#3cc8c8'
/** Of the big bosses' Epics, this many in a hundred are a set piece. */
export const SET_SHARE = 50

export const STARTING_KIT: Readonly<Record<HeroClass, readonly string[]>> = {
  knight: ['sword', 'buckler', 'tunic', 'hood'],
  mage: ['staff', 'tome', 'robe', 'hat'],
  rogue: ['dagger', 'parry', 'leather', 'cowl'],
}

/** Affixes a tier rolls; a Legendary has fixed stats instead. */
export const AFFIX_COUNT: Record<Rarity, number> = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 0 }

/** Gold per point of worth, by tier. */
export const PRICE: Record<Rarity, number> = { common: 2, uncommon: 5, rare: 6, epic: 12, legendary: 20 }
