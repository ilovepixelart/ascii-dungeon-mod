import { describe, expect, test } from 'claude-code/testing'

import type { Foe, Game, Talent, Work } from '../types'
import { apply, priceOfWare, sightOf, xpToLevel } from './game'
import { foeAhead, plainHero } from './fixtures'
import { TALENTS, offer, owed } from './talents'
import { killConsumable, slotOf } from './consumables'
import { MAP_W, isFloor, roomAt, visibleFrom } from './map'
import { visibleSet } from './panels'
import { levelOf } from './world'
import { talentCards, talentGesture, talentHeight, talentLines, talentPixels } from './talentwindow'
import { CLOSE_BOX } from './window'
import type { Gesture } from './window'
import { MAP_H } from './map'
import { PX } from './pixelart'

const ALL = Object.keys(TALENTS) as Talent[]
const knowing = (g: Game, ...talents: Talent[]): Game => ({ ...g, talents })
const tough = (g: Game, over: Partial<Foe> = {}) => foeAhead(g, 1, { hp: 99, maxHp: 99, opened: true, ...over })
const ok = (g: Game, work?: Work) => apply(g, { kind: 'outcome', ok: true, what: 'Edit', ...(work === undefined ? {} : { work }) })
const failed = (g: Game) => apply(g, { kind: 'outcome', ok: false, what: 'Bash' })
/** The damage the hero's blow said it dealt. */
const dealt = (g: Game) => Number(g.log.find(l => /^You (CRITICALLY )?hit /.test(l))?.match(/for (\d+)\.$/)?.[1])
const SEEDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]

describe('earning and picking', () => {
  test('one is owed at every tenth level, none before; those picked are no longer owed', async () => {
    expect([9, 10, 19, 20, 35].map(level => owed({ level }))).toEqual([0, 1, 1, 2, 3])
    expect(owed({ level: 25, talents: ['grudge'] })).toBe(1)
    expect(owed({ level: 25, talents: ['grudge', 'opener'] })).toBe(0)
  })

  test('never more owed than there are talents left to pick', async () => {
    expect(owed({ level: 200 })).toBe(ALL.length)
    expect(owed({ level: 200, talents: ALL })).toBe(0)
  })

  test('three are offered, none picked, the same three each time; none while none is owed', async () => {
    const g = { ...plainHero(3), level: 20, talents: ['grudge' as const] }
    const offered = offer(g)
    expect(offered.length).toBe(3)
    expect(new Set(offered).size).toBe(3)
    expect(offered).not.toContain('grudge')
    expect(offer({ ...g })).toEqual(offered)
    expect(offer({ ...g, level: 19 })).toEqual([])
  })

  test('the offer changes with the world and with each pick', async () => {
    const offers = SEEDS.map(world => offer({ level: 10, world }).join())
    expect(new Set(offers).size).toBeGreaterThan(1)
    const g = { ...plainHero(3), level: 30 }
    const first = offer(g)
    expect(offer({ ...g, talents: [first[0]!] })).not.toContain(first[0])
  })

  test('a pick from the offer is learned and said; one not offered, or none owed, is refused and said', async () => {
    const g = { ...plainHero(3), level: 10 }
    const t = offer(g)[0]!
    const learned = apply(g, { kind: 'talent', talent: t })
    expect(learned.talents).toEqual([t])
    expect(learned.log.at(-1)).toBe(`You learn ${TALENTS[t].name}: ${TALENTS[t].does}`)
    const other = ALL.find(x => !offer(g).includes(x))!
    const refused = apply(g, { kind: 'talent', talent: other })
    expect([refused.talents, refused.log.at(-1)]).toEqual([undefined, `${TALENTS[other].name} is not on offer.`])
    const early = apply({ ...g, level: 9 }, { kind: 'talent', talent: t })
    expect([early.talents, early.log.at(-1)]).toEqual([undefined, 'No talent to choose until level 10.'])
  })

  test('reaching a tenth level says a talent is waiting', async () => {
    const g = { ...plainHero(3), level: 9, xp: xpToLevel(9) - 1 }
    const to10 = apply({ ...g, foe: foeAhead(g, 1, { hp: 1, maxHp: 1, opened: true, xp: 10 }) }, { kind: 'outcome', ok: true, what: 'Edit' })
    expect(to10.level).toBeGreaterThanOrEqual(10)
    expect(to10.log).toContain('A talent to choose: open the character sheet.')
  })
})

describe('what each talent does', () => {
  test('Test Driven: a passing test run also gives 2 blows of fury, said', async () => {
    const g = { ...plainHero(3), foe: tough(plainHero(3)) }
    expect(ok(knowing(g, 'testDriven'), 'tests').log).toContain('Test driven: 2 blows of fury.')
    expect(ok(g, 'tests').effects.fury).toBe(0)
    // The sure blow spends one of the two.
    expect(ok(knowing(g, 'testDriven'), 'tests').effects.fury).toBe(1)
  })

  test('Clean Commit: a commit\'s shrine also wards off the next blow', async () => {
    const g = { ...plainHero(3), depth: 3, deepest: 3, hp: 5 }
    expect(ok(knowing(g, 'cleanCommit'), 'commit').effects.ward).toBe(1)
    expect(ok(g, 'commit').effects.ward).toBe(0)
  })

  test('Ship It: a push\'s item is never of a lower tier, and sometimes higher', async () => {
    const RANK = ['common', 'uncommon', 'rare', 'epic', 'legendary']
    const tierOf = (g: Game) => RANK.indexOf(ok(g, 'push').bag.at(-1)!.rarity)
    const pairs = SEEDS.map(seed => {
      const g = { ...plainHero(seed), seed, world: seed }
      return [tierOf(g), tierOf(knowing(g, 'shipIt'))]
    })
    expect(pairs.every(([plain, shipped]) => shipped! >= plain!)).toBe(true)
    expect(pairs.some(([plain, shipped]) => shipped! > plain!)).toBe(true)
  })

  test('Rubber Ducking: a failed call gives 1 XP a depth, said; not on the call that fells the hero', async () => {
    const g = { ...plainHero(3), depth: 4, deepest: 4, xp: 0, foe: tough(plainHero(3), { atk: 1 }) }
    const ducked = failed(knowing(g, 'rubberDucking'))
    expect(ducked.xp).toBe(4)
    expect(ducked.log).toContain('Rubber ducking: +4 XP.')
    expect(failed(g).xp).toBe(0)
    const due = failed(knowing({ ...g, level: 3, xp: xpToLevel(3) - 1 }, 'rubberDucking'))
    expect(due.level).toBe(4)
    const felled = failed(knowing({ ...g, hp: 1, foe: tough(g, { atk: 99 }) }, 'rubberDucking'))
    expect([felled.deaths, felled.xp]).toEqual([1, 0])
  })

  test('Second Wind: once a depth a killing blow leaves the hero at 1 HP, said; the next on that depth kills', async () => {
    // Drinking off: at 1 HP the drink order would otherwise take a potion.
    const g = knowing({ ...plainHero(3), hp: 3, depth: 3, deepest: 3, orders: { drink: 0, smoke: false, leave: 'common' } }, 'secondWind')
    const saved = failed({ ...g, foe: tough(g, { atk: 99 }) })
    expect([saved.deaths, saved.hp, saved.wind]).toEqual([0, 1, 3])
    expect(saved.log).toContain('Second wind: you stand, at 1 HP.')
    expect(failed({ ...saved, foe: tough(saved, { atk: 99 }) }).deaths).toBe(1)
    expect(failed({ ...g, hp: 3, foe: tough(g, { atk: 99 }), talents: [] }).deaths).toBe(1)
  })

  test('Opener: a blow on a foe at full HP deals a quarter more; on a hurt foe, the same', async () => {
    for (const seed of SEEDS.slice(0, 4)) {
      const g = { ...plainHero(seed), seed }
      const fresh = { ...g, foe: tough(g) }
      expect(dealt(ok(knowing(fresh, 'opener')))).toBe(Math.round(dealt(ok(fresh)) * 1.25))
      const hurt = { ...g, foe: tough(g, { hp: 98 }) }
      expect(dealt(ok(knowing(hurt, 'opener')))).toBe(dealt(ok(hurt)))
    }
  })

  test('Grudge: a quarter more damage to a champion and a unique; to a plain foe, the same', async () => {
    const g = plainHero(3)
    const at = (over: Partial<Foe>) => ({ ...g, foe: tough(g, { hp: 98, ...over }) })
    for (const over of [{ champion: 'tough' as const }, { unique: 'ember' as const }]) {
      expect(dealt(ok(knowing(at(over), 'grudge')))).toBe(Math.round(dealt(ok(at(over))) * 1.25))
    }
    expect(dealt(ok(knowing(at({}), 'grudge')))).toBe(dealt(ok(at({}))))
  })

  test('Bloodletting: a critical hit heals 2 HP; a plain hit does not', async () => {
    const g = { ...plainHero(3), hp: 10, foe: tough(plainHero(3), { atk: 0 }) }
    expect(ok(knowing(g, 'bloodletting'), 'tests').hp - ok(g, 'tests').hp).toBe(2)
    const plain = SEEDS.map(seed => ({ ...g, seed })).find(x => !ok(x).log.some(l => l.startsWith('You CRITICALLY')))!
    expect(ok(knowing(plain, 'bloodletting')).hp).toBe(ok(plain).hp)
  })

  test('Scavenger: healing potions drop half again as often', async () => {
    const drops = (talents: Talent[]) => Array.from({ length: 400 }, (_, seed) => killConsumable({ ...plainHero(seed + 1), seed: seed + 1, talents, potionChance: 40 })).filter(d => d?.kind === 'health').length
    const plain = drops([])
    const scavenging = drops(['scavenger'])
    expect(scavenging).toBeGreaterThan(plain * 1.3)
    expect(scavenging).toBeLessThan(plain * 1.7)
  })

  test('Iron Stomach: a potion heals a quarter more, rounded up', async () => {
    const g = { ...plainHero(3), hp: 1 }
    // A Health Potion restores 35% of 20 HP: 7; a quarter more is 9.
    const drink = (x: Game) => apply(x, { kind: 'use', slot: slotOf('health') }).hp - 1
    expect([drink(g), drink(knowing(g, 'ironStomach'))]).toEqual([7, 9])
  })

  test('Haggler: the merchant asks a fifth less, rounded up, and takes that', async () => {
    const g = { ...plainHero(3), gold: 100 }
    expect([priceOfWare('health1'), priceOfWare('health1', knowing(g, 'haggler')), priceOfWare('fury1', knowing(g, 'haggler'))]).toEqual([25, 20, 40])
    const town = apply(knowing(g, 'haggler'), { kind: 'portal' })
    expect(apply(town, { kind: 'buy', ware: 'health1' }).gold).toBe(80)
  })

  test('Pathfinder: in a corridor the hero sees two tiles around, not one; a room is seen whole either way', async () => {
    const g = plainHero(3)
    const level = levelOf(g)
    expect([sightOf(g), sightOf(knowing(g, 'pathfinder'))]).toEqual([1, 2])
    const corridor = Array.from({ length: MAP_W * MAP_H }, (_, i) => ({ x: i % MAP_W, y: Math.floor(i / MAP_W) }))
      .find(c => c.x >= 2 && c.y >= 2 && c.x < MAP_W - 2 && c.y < MAP_H - 2 && isFloor(level.tiles, c) && roomAt(level, c) === undefined)!
    expect(visibleFrom(level, corridor, 2).length).toBe(25)
    expect(visibleFrom(level, corridor).length).toBe(9)
    const there = { ...g, ...corridor }
    expect(visibleSet(knowing(there, 'pathfinder'), level).size).toBe(25)
    expect(visibleSet(there, level).size).toBe(9)
    const room = level.rooms[0]!
    const inside = { x: room.x, y: room.y }
    expect(visibleFrom(level, inside, 2)).toEqual(visibleFrom(level, inside))
  })
})

describe('the talent window', () => {
  const tap = (p: { x: number; y: number }): Gesture => ({ type: 'release', from: { x: p.x + 0.5, y: p.y / 2 + 0.25 }, at: { x: p.x + 0.5, y: p.y / 2 + 0.25 }, button: 'left' })
  const g = { ...plainHero(3), level: 10, panel: 'talent' as const }

  test('a card a talent offered, its name and what it does; a click on one takes it', async () => {
    const cards = talentCards(g)
    expect(cards.map(c => c.talent)).toEqual(offer(g))
    const texts = talentLines(g).map(l => l.text)
    expect(texts[0]).toBe('LEVEL 10  CHOOSE ONE')
    for (const t of offer(g)) expect(texts).toContain(TALENTS[t].name.toUpperCase())
    expect(talentGesture(g, tap({ x: cards[1]!.rect.x + 20, y: cards[1]!.rect.y + 6 }))).toEqual([{ kind: 'talent', talent: cards[1]!.talent }])
  })

  test('with none owed, the talents taken and the level of the next; with all taken, says so', async () => {
    const done = { ...g, level: 25, talents: ['grudge', 'haggler'] as Talent[] }
    expect(talentCards(done)).toEqual([])
    expect(talentLines(done).map(l => l.text)).toEqual(['NEXT AT LEVEL 30', 'GRUDGE', 'HAGGLER'])
    expect(talentLines({ ...g, level: 200, talents: ALL })[0]!.text).toBe('EVERY TALENT TAKEN')
  })

  test('while offering, the talents already taken are not listed', async () => {
    const texts = talentLines({ ...g, level: 20, talents: ['grudge'] }).map(l => l.text)
    expect(texts).not.toContain('GRUDGE')
    expect(texts.at(-1)).toBe('CLICK ONE TO TAKE IT')
  })

  test('the close box closes it; a click elsewhere does nothing', async () => {
    expect(talentGesture(g, tap({ x: CLOSE_BOX[0] + 1, y: CLOSE_BOX[1] + 1 }))).toEqual([{ kind: 'panel', panel: 'talent' }])
    expect(talentGesture(g, tap({ x: 50, y: 15 }))).toEqual([])
  })

  test('fits over the map with any three talents offered, and with every talent taken', async () => {
    for (const world of Array.from({ length: 60 }, (_, i) => i + 1)) {
      const x = { ...g, world }
      expect(talentHeight(x)).toBeLessThanOrEqual(MAP_H * PX)
      expect(talentPixels(x).length).toBe(talentHeight(x))
    }
    expect(talentHeight({ ...g, level: 200, talents: ALL })).toBeLessThanOrEqual(MAP_H * PX)
  })
})
