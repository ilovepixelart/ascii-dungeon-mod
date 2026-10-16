import { describe, expect, test } from 'claude-code/testing'

import type { Foe, Game, Item, Rarity, Trigger, Work } from '../types'
import { apply, xpToLevel } from './game'
import { foeAhead, plainHero } from './fixtures'
import { PRICE, TRIGGERS, heirloomOf, makeItem, plainItem, priceOf, reforgeItem } from './items'
import { card } from './bagui'
import { itemCard } from './inventory'

const ALL = Object.keys(TRIGGERS) as Trigger[]
const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1)
/** A Rare piece carrying the trigger. */
const charm = (g: Game, trigger: Trigger, base = 'ring'): Item => ({ ...plainItem(g, base, 'rare'), trigger })
/** The hero wearing a ring with the trigger. */
const wearing = (g: Game, trigger: Trigger): Game => ({ ...g, gear: { ...g.gear, ring: charm(g, trigger) } })
const tough = (g: Game, over: Partial<Foe> = {}) => foeAhead(g, 1, { hp: 99, maxHp: 99, opened: true, ...over })
const ok = (g: Game, work?: Work) => apply(g, { kind: 'outcome', ok: true, what: 'Edit', ...(work === undefined ? {} : { work }) })
const failed = (g: Game) => apply(g, { kind: 'outcome', ok: false, what: 'Bash' })
/** The damage the hero's blow said it dealt. */
const dealt = (g: Game) => Number(g.log.find(l => /^You (CRITICALLY )?hit /.test(l))?.match(/for (\d+)\.$/)?.[1])
/** The damage the foe's blow said it dealt. */
const taken = (g: Game) => Number(g.log.find(l => / strikes you for \d+/.test(l))?.match(/for (\d+)/)?.[1])
const text = (lines: { text: string }[][]) => lines.map(l => l.map(r => r.text).join(''))

describe('which items carry one', () => {
  /** The items made at `rarity` or better, those of exactly that tier. */
  const made = (rarity: Rarity) => SEEDS.map(seed => makeItem({ ...plainHero(seed), seed }, rarity)).filter(i => i.rarity === rarity)

  test('every Epic, about a third of Rares, and no Common, Uncommon or Legendary', async () => {
    expect(made('epic').every(i => i.trigger !== undefined)).toBe(true)
    const rares = made('rare')
    const share = rares.filter(i => i.trigger !== undefined).length / rares.length
    expect([share > 0.22, share < 0.46]).toEqual([true, true])
    for (const r of ['common', 'uncommon', 'legendary'] as const) expect(made(r).some(i => i.trigger !== undefined)).toBe(false)
  })

  test('each of the eight is rolled', async () => {
    expect(new Set(made('epic').map(i => i.trigger))).toEqual(new Set(ALL))
  })

  test('a reforge rolls it anew: an Epic always keeps one, a Rare about a third of the time', async () => {
    const reforged = (rarity: Rarity) => SEEDS.map(seed => reforgeItem({ ...plainHero(seed), seed }, { ...plainItem(plainHero(1), 'sword', rarity), trigger: 'thorns' }))
    const epics = reforged('epic')
    expect(epics.every(i => i.trigger !== undefined)).toBe(true)
    expect(epics.some(i => i.trigger !== 'thorns')).toBe(true)
    const kept = reforged('rare').filter(i => i.trigger !== undefined).length / SEEDS.length
    expect([kept > 0.22, kept < 0.46]).toEqual([true, true])
  })

  test('it adds to the price: three points of worth at its tier\'s rate', async () => {
    const plain = plainItem(plainHero(1), 'sword', 'rare')
    expect(priceOf({ ...plain, trigger: 'thorns' }) - priceOf(plain)).toBe(3 * PRICE.rare)
  })

  test('an heirloom keeps it', async () => {
    expect(heirloomOf(charm(plainHero(1), 'momentum', 'sword')).trigger).toBe('momentum')
  })
})

describe('what each trigger does', () => {
  const g = plainHero(3)

  test('Thorns: a foe whose blow lands takes a tenth of it back, at least 1', async () => {
    const at = { ...g, hp: 99, maxHp: 99, foe: tough(g, { atk: 44 }) }
    const hit = failed(wearing(at, 'thorns'))
    const dmg = taken(hit)
    // Not a whole ten, so rounding up shows.
    expect([dmg > 10, dmg % 10 !== 0]).toEqual([true, true])
    expect(hit.foe!.hp).toBe(99 - Math.ceil(dmg / 10))
    expect(hit.log).toContain(`Thorns: the goblin of x takes ${Math.ceil(dmg / 10)}.`)
    expect(failed(at).foe!.hp).toBe(99)
    expect(failed(wearing({ ...at, foe: tough(g, { atk: 1 }) }, 'thorns')).foe!.hp).toBe(98)
  })

  test('Thorns never takes the last of a foe\'s HP, and a blow that slays the hero brings none', async () => {
    const at = { ...g, hp: 99, maxHp: 99 }
    expect(failed(wearing({ ...at, foe: tough(g, { atk: 40, hp: 2 }) }, 'thorns')).foe!.hp).toBe(1)
    const slain = failed(wearing({ ...at, hp: 1, belt: [null, null, null, null, null], foe: tough(g, { atk: 40 }) }, 'thorns'))
    expect(slain.log.some(l => l.startsWith('Thorns'))).toBe(false)
  })

  test('Leeching: a kill heals 1 HP, no more than max', async () => {
    const at = { ...g, hp: 10, foe: foeAhead(g, 1, { hp: 1, maxHp: 1, opened: true }) }
    expect(ok(wearing(at, 'leeching')).hp - ok(at).hp).toBe(1)
    expect(ok(wearing({ ...at, hp: at.maxHp }, 'leeching')).hp).toBe(at.maxHp)
  })

  test('Momentum: after a kill, the next blow deals a quarter more, once', async () => {
    const at = { ...g, foe: foeAhead(g, 1, { hp: 1, maxHp: 1, opened: true }) }
    const [plain, rolling] = [ok(at), ok(wearing(at, 'momentum'))]
    expect([plain.momentum, rolling.momentum]).toEqual([undefined, true])
    const next = (x: Game) => ok({ ...x, foe: tough(x) })
    const [a, b] = [dealt(next(plain)), dealt(next(rolling))]
    expect(Math.abs(b - a * 1.25)).toBeLessThanOrEqual(1)
    expect(b).toBeGreaterThan(a)
    const after = next(rolling)
    expect(after.momentum).toBeUndefined()
    expect(dealt(next({ ...after, log: [] }))).toBe(dealt(next({ ...next(plain), log: [] })))
  })

  test('Bulwark: the first blow that lands each fight is halved, rounded up; the next is whole', async () => {
    const at = { ...g, hp: 99, maxHp: 99, foe: tough(g, { atk: 21 }) }
    const whole = taken(failed(at))
    const first = failed(wearing(at, 'bulwark'))
    expect(taken(first)).toBe(Math.ceil(whole / 2))
    expect(first.log.some(l => l.endsWith(', half of it turned.'))).toBe(true)
    expect(taken(failed({ ...first, log: [] }))).toBe(whole)
  })

  test('Bulwark: a knight\'s shield turns the first blow, and Bulwark halves the first that lands after it', async () => {
    const knight = { ...g, cls: 'knight' as const, hp: 99, maxHp: 99, foe: tough(g, { atk: 21, opened: undefined }) }
    const turned = failed(wearing(knight, 'bulwark'))
    expect(turned.log.some(l => l.startsWith('Your shield turns'))).toBe(true)
    expect(turned.foe!.landed).toBeUndefined()
    expect(failed({ ...turned, log: [] }).log.some(l => l.endsWith(', half of it turned.'))).toBe(true)
  })

  test('Executioner: a blow on a foe under a quarter HP deals half again; at a quarter, not', async () => {
    const at = (hp: number) => ({ ...g, foe: tough(g, { hp, maxHp: 400 }) })
    const [plain, finishing] = [dealt(ok(at(99))), dealt(ok(wearing(at(99), 'executioner')))]
    expect(Math.abs(finishing - plain * 1.5)).toBeLessThanOrEqual(1)
    expect(finishing).toBeGreaterThan(plain)
    expect(dealt(ok(wearing(at(100), 'executioner')))).toBe(dealt(ok(at(100))))
  })

  test('Prospector: kills pay a fifth more gold, rounded down', async () => {
    const at = { ...g, depth: 9, foe: foeAhead(g, 1, { hp: 1, maxHp: 1, opened: true }) }
    const coins = (x: Game) => Number(x.log.find(l => l.startsWith('You slay'))?.match(/\+(\d+) gold/)?.[1])
    const plain = coins(ok(at))
    expect(coins(ok(wearing(at, 'prospector')))).toBe(Math.floor(plain * 1.2))
  })

  test('Quick Study: a passing test run gives 1 XP a depth, said', async () => {
    const at = { ...g, depth: 7, level: 50, foe: tough(g) }
    const studied = ok(wearing(at, 'quickStudy'), 'tests')
    expect(studied.xp - ok(at, 'tests').xp).toBe(7)
    expect(studied.log).toContain('Quick study: +7 XP.')
    expect(ok(wearing(at, 'quickStudy')).xp).toBe(ok(at).xp)
  })

  test('Quick Study: XP that reaches the next level levels the hero up', async () => {
    const at = { ...g, depth: 7, level: 3, xp: xpToLevel(3) - 1, foe: tough(g) }
    expect(ok(wearing(at, 'quickStudy'), 'tests').level).toBe(4)
    expect(ok(at, 'tests').level).toBe(3)
  })

  test('Fresh Start: a commit\'s shrine also gives 1 blow of fury, said', async () => {
    const fresh = ok(wearing(g, 'freshStart'), 'commit')
    expect(fresh.effects.fury - ok(g, 'commit').effects.fury).toBe(1)
    expect(fresh.log).toContain('A fresh start: 1 blow of fury.')
  })

  test('two pieces with the same trigger count once', async () => {
    const at = { ...g, hp: 10, foe: foeAhead(g, 1, { hp: 1, maxHp: 1, opened: true }) }
    const twice = { ...wearing(at, 'leeching'), gear: { ...wearing(at, 'leeching').gear, amulet: charm(g, 'leeching', 'amulet') } }
    expect(ok(twice).hp).toBe(ok(wearing(at, 'leeching')).hp)
  })

  test('in the bag, a trigger does nothing', async () => {
    const at = { ...g, hp: 10, foe: foeAhead(g, 1, { hp: 1, maxHp: 1, opened: true }) }
    expect(ok({ ...at, bag: [{ ...charm(g, 'leeching'), x: 0, y: 0 }] }).hp).toBe(ok(at).hp)
  })
})

describe('on the item card', () => {
  const g = plainHero(3)

  test('its name in the tier\'s color, what it does wrapped under it, before the price', async () => {
    const lines = card(g, { ...plainItem(g, 'chain', 'rare'), trigger: 'thorns' }, undefined, true)
    const t = text(lines)
    const at = t.indexOf('Thorns')
    expect(at).toBeGreaterThan(0)
    expect(lines[at]![0]).toMatchObject({ bold: true, color: '#3b8eea' })
    expect(t.slice(at + 1, at + 3)).toEqual(['A foe that hits you takes a', 'tenth of the blow back.'])
    expect(t[at + 3]).toMatch(/^Sells for /)
    expect(t.every(l => l.length <= 31)).toBe(true)
  })

  test('says when another worn piece already has it; not when the piece it would replace has', async () => {
    const worn = { ...g, gear: { ...g.gear, ring: charm(g, 'thorns') } }
    const note = 'Same trigger as worn: no effect'
    expect(text(card(worn, { ...plainItem(g, 'chain', 'rare'), trigger: 'thorns' }, undefined, true))).toContain(note)
    expect(text(card(worn, charm(g, 'thorns'), undefined, true))).not.toContain(note)
    expect(text(card(worn, { ...plainItem(g, 'chain', 'rare'), trigger: 'bulwark' }, undefined, true))).not.toContain(note)
  })

  test('none on an item without one', async () => {
    expect(text(card(g, plainItem(g, 'chain', 'rare'), undefined, true)).some(l => ALL.some(t => l.startsWith(TRIGGERS[t].name)))).toBe(false)
  })

  test('as text, on one line', async () => {
    const item = { ...plainItem(g, 'chain', 'rare'), trigger: 'bulwark' as const, x: 0, y: 0 }
    expect(text(itemCard({ ...g, bag: [item], cursor: item.id }))).toContain('Bulwark: The first blow that lands each fight is halved.')
  })
})
