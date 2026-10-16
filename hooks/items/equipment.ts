// What the hero wears: who can wear what, the bonuses it gives, and swapping between bag and body.
import type { Game, Item, Slot, Trigger } from '../../types'
import { stash, selected, take } from './bag'
import { CLASS_NAME, SLOTS } from './catalog'
import { STAT_KEYS, worth } from './stats'
import type { Stats } from './stats'

export const gearBonus = (g: Game, stat: keyof Stats) =>
  SLOTS.reduce((sum, slot) => sum + (g.gear[slot]?.[stat] ?? 0), 0)

/** The Legendary worn that carries `power`, if any. */
export const wornPower = (g: Pick<Game, 'gear'>, power: string) => SLOTS.map(slot => g.gear[slot]).find(item => item?.power === power)

/** Whether another worn piece, in another slot, already carries the item's trigger: then the item's adds nothing. */
export const isTriggerWornElsewhere = (g: Pick<Game, 'gear'>, item: Item) =>
  item.trigger !== undefined && SLOTS.some(slot => slot !== item.slot && g.gear[slot]?.trigger === item.trigger)

/** Whether a worn piece carries the trigger: once however many do. */
export const wornTrigger = (g: Pick<Game, 'gear'>, trigger: Trigger) => SLOTS.some(slot => g.gear[slot]?.trigger === trigger)

export const canWear = (g: Pick<Game, 'cls'>, item: Item) => item.cls === undefined || item.cls === g.cls

export const classLabel = (item: Item) => (item.cls === undefined ? 'Any class' : `${CLASS_NAME[item.cls]} only`)

/** Better than what the hero wears in its slot, and wearable by the hero. */
export const isUpgrade = (g: Game, item: Item) => canWear(g, item) && worth(item) > worth(g.gear[item.slot] ?? {})

/** The change on each stat if `item` replaced what is worn in its slot. */
export const deltas = (g: Game, item: Item): Stats => {
  const worn = g.gear[item.slot]
  return Object.fromEntries(STAT_KEYS.map(k => [k, item[k] - (worn?.[k] ?? 0)])) as Stats
}

const setMaxHp = (g: Game, maxHp: number) => {
  g.maxHp = maxHp
  g.hp = Math.max(1, Math.min(g.hp, g.maxHp))
}

/** Equips the selected item, swapping the worn one back into the bag. */
export const equip = (g: Game): string => {
  const item = selected(g)
  if (item === undefined) return 'Nothing selected.'
  if (!canWear(g, item)) return `The ${item.name} is ${classLabel(item)}.`
  const worn = g.gear[item.slot]
  take(g, item.id)
  if (worn !== undefined && !stash(g, worn)) {
    stash(g, item)
    return `No room in the bag for your ${worn.name}.`
  }
  g.gear = { ...g.gear, [item.slot]: { ...item, junk: undefined } }
  setMaxHp(g, g.maxHp + item.hp - (worn?.hp ?? 0))
  if (worn !== undefined) g.cursor = worn.id
  return `You equip the ${item.name}.`
}

export const unequip = (g: Game, slot: Slot): string => {
  const worn = g.gear[slot]
  if (worn === undefined) return `Nothing worn as ${slot}.`
  if (!stash(g, worn)) return `No room in the bag for your ${worn.name}.`
  const { [slot]: _, ...rest } = g.gear
  g.gear = rest
  setMaxHp(g, g.maxHp - worn.hp)
  return `You take off the ${worn.name}.`
}
