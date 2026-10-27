import { describe, expect, test } from 'claude-code/testing'

import type { Game, Mark } from '../types'
import { apply, depthMod } from './game'
import { MARKS, forkTier, isForkOpen, markHere, pairOf, roman, tierOf, tierStart } from './deep'
import { killConsumable } from './consumables'
import { foeAhead, plainHero } from './fixtures'
import { arrive } from './world'
import { CARD_KEYS, deepCards, deepGesture, deepHeight, deepOverlay, deepPixels } from './deepwindow'
import { CLOSE_BOX } from './window'
import type { Gesture } from './window'

const EASY: Mark[] = ['steady', 'mild', 'brittle']
const HARD: Mark[] = ['ironclad', 'frenzied', 'lean']
const SEEDS = Array.from({ length: 300 }, (_, i) => i + 1)
/** A plain hero on `depth`, as deep as they have been, no boss slain unless said. */
const deepAt = (depth: number, over: Partial<Game> = {}, seed = 3): Game => {
  const g = plainHero(seed)
  return { ...g, ...arrive(g.world, depth), deepest: depth, bossSlain: 0, fortune: null, ...over }
}
/** Depth 55: a boss depth, so no twist, and no unique's. */
const IN_TIER = 55
const marked = (mark: Mark, over: Partial<Game> = {}, seed = 3) => deepAt(IN_TIER, { marks: { 1: mark }, ...over }, seed)
const summoned = (g: Game) => apply(g, { kind: 'summon', name: 'x.ts' }).foe
/** The gold a kill of a 1 HP foe said it paid. */
const paid = (g: Game) => {
  const after = apply({ ...g, foe: foeAhead(g, 1, { hp: 1, maxHp: 1, opened: true }) }, { kind: 'attack' })
  return Number(after.log.find(l => l.startsWith('You slay'))?.match(/\+(\d+) gold/)?.[1])
}
/** The big boss of `depth` slain by a hero standing on it, too high a level to level up and push the log on. */
const bigSlain = (depth: number) => {
  const g = apply(deepAt(depth, { level: 200 }), { kind: 'descend' })
  return apply({ ...g, foe: { ...g.foe!, hp: 1 } }, { kind: 'attack' })
}

describe('the marks\' words', () => {
  test('set off a clause joined by "but" with a comma, as a sentence does', async () => {
    const joined = Object.values(MARKS).map(m => m.does).filter(does => / but /.test(does))
    expect(joined.length).toBeGreaterThan(0)
    for (const does of joined) expect(does).toMatch(/, but /)
  })
})

describe('tiers', () => {
  test('none down to depth 50, then one every ten depths, each ending at its big boss', async () => {
    expect([1, 50, 51, 60, 61, 100, 101].map(tierOf)).toEqual([0, 0, 1, 1, 2, 5, 6])
    expect([1, 2, 6].map(tierStart)).toEqual([51, 61, 101])
  })

  test('written in Roman numerals', async () => {
    expect([1, 4, 5, 6, 9, 14, 40, 90, 400, 949, 2024].map(roman)).toEqual(['I', 'IV', 'V', 'VI', 'IX', 'XIV', 'XL', 'XC', 'CD', 'CMXLIX', 'MMXXIV'])
  })

  test('a tier is Steady unless its mark was chosen; in town and above the tiers nothing is marked', async () => {
    expect(markHere(deepAt(IN_TIER))).toBe('steady')
    expect(markHere(marked('lean'))).toBe('lean')
    expect(markHere(deepAt(50, { marks: { 1: 'lean' } }))).toBe('steady')
    expect(markHere({ ...marked('lean'), where: 'town' })).toBe('steady')
  })
})

describe('the fork', () => {
  test('each tier is chosen of one easier mark and one harder, fixed by the world, not the same for every world', async () => {
    for (const world of [1, 2, 3, 4, 5]) {
      const [easy, hard] = pairOf(world, 2)
      expect([EASY.includes(easy), HARD.includes(hard)]).toEqual([true, true])
      expect(pairOf(world, 2)).toEqual([easy, hard])
    }
    expect(new Set(SEEDS.slice(0, 20).map(world => pairOf(world, 1).join())).size).toBeGreaterThan(1)
  })

  test('it opens when the big boss at 50 falls, for tier I, and closes once the hero is in tier I', async () => {
    expect(forkTier({ bossSlain: 45, deepest: 50 })).toBeUndefined()
    expect(forkTier({ bossSlain: 50, deepest: 50 })).toBe(1)
    expect(forkTier({ bossSlain: 50, deepest: 51 })).toBeUndefined()
    expect(forkTier({ bossSlain: 100, deepest: 100 })).toBe(6)
  })

  test('a hero who went past a tier\'s start before its fork gets no fork for it: that tier stays Steady', async () => {
    expect(forkTier({ bossSlain: 90, deepest: 97 })).toBeUndefined()
    expect(forkTier({ bossSlain: 55, deepest: 55 })).toBeUndefined()
  })

  test('it waits until a mark is chosen', async () => {
    expect(isForkOpen({ bossSlain: 60, deepest: 60 })).toBe(true)
    expect(isForkOpen({ bossSlain: 60, deepest: 60, marks: { 2: 'mild' } })).toBe(false)
  })

  test('the big boss falling at 50 says the fork and its two marks', async () => {
    const g = bigSlain(50)
    const [easy, hard] = pairOf(g.world, 1).map(m => MARKS[m].name)
    expect(g.log).toContain(`The Abyss forks: circle I, The Hollow Halls, takes the blessing ${easy} or the curse ${hard}. Choose in the Abyss.`)
  })

  test('a big boss above the tiers, or a lesser boss in one, says no fork', async () => {
    for (const g of [bigSlain(40), bigSlain(55)]) {
      expect(g.log.some(l => l.endsWith('The way down is open.') || l.startsWith('Loot: '))).toBe(true)
      expect(g.log.some(l => l.startsWith('The Abyss forks'))).toBe(false)
    }
  })
})

describe('choosing', () => {
  const atFork = deepAt(60, { bossSlain: 60 })
  const [easy, hard] = pairOf(atFork.world, 2)

  test('either mark offered is chosen, and said; it may be changed until the stairs', async () => {
    const chosen = apply(atFork, { kind: 'mark', mark: hard })
    expect(chosen.marks).toEqual({ 2: hard })
    expect(chosen.log.at(-1)).toBe(`Tier II will be ${MARKS[hard].name}: ${MARKS[hard].does}`)
    expect(apply(chosen, { kind: 'mark', mark: easy }).marks).toEqual({ 2: easy })
  })

  test('a mark not offered is refused, and said', async () => {
    const other = [...EASY, ...HARD].find(m => m !== easy && m !== hard)!
    const refused = apply(atFork, { kind: 'mark', mark: other })
    expect([refused.marks, refused.log.at(-1)]).toEqual([undefined, `${MARKS[other].name} is not on offer for circle II.`])
  })

  test('with no fork open, a choice is refused, and said', async () => {
    const refused = apply(deepAt(IN_TIER), { kind: 'mark', mark: 'mild' })
    expect([refused.marks, refused.log.at(-1)]).toEqual([undefined, 'The Abyss has no fork to choose now.'])
  })

  test('the stairs into the tier take the chosen mark and say it', async () => {
    const down = apply(apply(atFork, { kind: 'mark', mark: hard }), { kind: 'descend' })
    expect([down.depth, down.marks]).toEqual([61, { 2: hard }])
    expect(down.log).toContain(`Circle II, The Sunken Vaults: ${MARKS[hard].name}, a curse. ${MARKS[hard].does}`)
    expect(down.log.some(l => l.startsWith('Unchosen'))).toBe(false)
  })

  test('unchosen, the stairs take the easier mark and say so', async () => {
    const down = apply(atFork, { kind: 'descend' })
    expect(down.marks).toEqual({ 2: easy })
    expect(down.log).toContain('Unchosen, circle II, The Sunken Vaults, takes the blessing.')
    expect(down.log).toContain(`Circle II, The Sunken Vaults: ${MARKS[easy].name}, a blessing. ${MARKS[easy].does}`)
  })

  test('woken above a fork, the stairs down to it take no mark and say no tier', async () => {
    const above = apply(deepAt(55, { bossSlain: 60, deepest: 60 }), { kind: 'descend' })
    expect([above.depth, above.marks, above.log.some(l => l.startsWith('Circle ') || l.startsWith('Unchosen'))]).toEqual([56, undefined, false])
  })

  test('the stairs within a tier, or into a tier with no fork, say no tier', async () => {
    expect(apply(deepAt(56), { kind: 'descend' }).log.some(l => l.startsWith('Circle '))).toBe(false)
    const passed = apply(deepAt(60, { bossSlain: 60, deepest: 70 }), { kind: 'descend' })
    expect([passed.marks, passed.log.some(l => l.startsWith('Circle '))]).toEqual([undefined, false])
  })
})

describe('what each mark does', () => {
  test('Ironclad: foes have half again the HP and hit a sixth harder', async () => {
    const [plain, iron] = [summoned(deepAt(IN_TIER))!, summoned(marked('ironclad'))!]
    expect(Math.abs(iron.maxHp - plain.maxHp * 1.5)).toBeLessThanOrEqual(1)
    expect(Math.abs(iron.atk - (plain.atk * 7) / 6)).toBeLessThanOrEqual(1)
    expect(iron.atk).toBeGreaterThan(plain.atk)
  })

  test('Brittle: foes have a fifth less HP and hit a fifth harder', async () => {
    const [plain, brittle] = [summoned(deepAt(IN_TIER))!, summoned(marked('brittle'))!]
    expect(Math.abs(brittle.maxHp - plain.maxHp * 0.8)).toBeLessThanOrEqual(1)
    expect(Math.abs(brittle.atk - plain.atk * 1.2)).toBeLessThanOrEqual(1)
    expect(brittle.atk).toBeGreaterThan(plain.atk)
  })

  test('Frenzied: foes hit a sixth harder, their HP as ever', async () => {
    // A seed whose foe is no champion either way, so the champion's own changes do not show.
    const seed = SEEDS.find(s => summoned(marked('frenzied', {}, s))?.champion === undefined && summoned(marked('steady', {}, s))?.champion === undefined)!
    const [plain, frenzied] = [summoned(marked('steady', {}, seed))!, summoned(marked('frenzied', {}, seed))!]
    expect(Math.abs(frenzied.atk - (plain.atk * 7) / 6)).toBeLessThanOrEqual(1)
    expect(frenzied.atk).toBeGreaterThan(plain.atk)
    expect(frenzied.maxHp).toBe(plain.maxHp)
  })

  test('Frenzied: about one foe in four is a champion, where one in ten is otherwise', async () => {
    const share = (mark: Mark) => SEEDS.filter(seed => summoned(marked(mark, {}, seed))?.champion !== undefined).length / SEEDS.length
    expect(share('steady')).toBeLessThan(0.15)
    expect(share('frenzied')).toBeGreaterThan(0.18)
    expect(share('frenzied')).toBeLessThan(0.32)
  })

  test('Mild: foes hit a fifth softer, their HP as ever', async () => {
    const [plain, mild] = [summoned(deepAt(IN_TIER))!, summoned(marked('mild'))!]
    expect(Math.abs(mild.atk - plain.atk * 0.8)).toBeLessThanOrEqual(1)
    expect(mild.atk).toBeLessThan(plain.atk)
    expect(mild.maxHp).toBe(plain.maxHp)
  })

  test('Mild: a kill pays a third less gold; Lean: twice the gold', async () => {
    const plain = paid(deepAt(IN_TIER))
    expect(plain).toBeGreaterThan(0)
    expect([paid(marked('mild')), paid(marked('lean'))]).toEqual([Math.floor((plain * 2) / 3), plain * 2])
  })

  test('Lean: foes as ever', async () => {
    expect(summoned(marked('lean'))).toEqual(summoned(deepAt(IN_TIER)))
  })

  test('Lean: healing potions drop about a quarter as often', async () => {
    // At the full chance, so a quarter of a quarter of 300 kills still drops enough to count.
    const drops = (mark: Mark) => SEEDS.filter(seed => killConsumable({ ...marked(mark, {}, seed), seed, potionChance: 100 })?.kind === 'health').length
    expect(drops('lean')).toBeGreaterThan(drops('steady') * 0.15)
    expect(drops('lean')).toBeLessThan(drops('steady') * 0.4)
  })

  test('Ironclad: a kill\'s items roll twice, so more of them are Rare or better', async () => {
    const rares = (mark: Mark) =>
      SEEDS.map(seed => {
        const g = marked(mark, { bag: [] }, seed)
        return apply({ ...g, foe: foeAhead(g, 1, { hp: 1, maxHp: 1, opened: true }) }, { kind: 'attack' }).bag
      })
        .flat()
        .filter(item => ['rare', 'epic', 'legendary'].includes(item.rarity)).length
    expect(rares('ironclad')).toBeGreaterThan(rares('steady') * 1.3)
  })

  test('no twist lies on the depth the mark tests stand on', async () => {
    expect(SEEDS.slice(0, 20).every(seed => depthMod(plainHero(seed).world, IN_TIER) === undefined)).toBe(true)
  })
})

describe('the Abyss window', () => {
  const tap = (p: { x: number; y: number }): Gesture => ({ type: 'release', from: { x: p.x + 0.5, y: p.y / 2 + 0.25 }, at: { x: p.x + 0.5, y: p.y / 2 + 0.25 }, button: 'left' })
  const W = deepAt(1).world
  const atFork = deepAt(100, { bossSlain: 100, marks: { 4: pairOf(W, 4)[0], 5: pairOf(W, 5)[1] } })
  const said = (g: Game) => deepOverlay(g)[0]!.lines.map(l => l.map(r => r.text).join(''))
  const name = (tier: number, i: number) => MARKS[pairOf(W, tier)[i]!].name

  test('heads with the circle the hero is in, its depths and its warden, then the fates chosen and where the next fork opens', async () => {
    // Circle V is depths 91 to 100, the Ember Deeps; depth 100 is the forge's, its warden the Furnace Wyrm.
    expect(said({ ...atFork, depth: 97, bossSlain: 90, deepest: 97 })).toEqual([
      'Circle V: The Ember Deeps',
      'Depths 91 to 100, its warden the Furnace Wyrm.',
      `Fates chosen: III Steady, IV ${name(4, 0)}, V ${name(5, 1)}`,
      'The next fork opens at depth 100, when its warden falls.',
    ])
  })

  test('while a fork waits, its cards stand above the box, which heads with the circle to choose for', async () => {
    // Circle VI is depths 101 to 110, the Bone Choir; depth 110 is flooded, its warden the Drowned Queen.
    expect(said(atFork).slice(0, 2)).toEqual(['Circle VI: The Bone Choir', 'Depths 101 to 110, its warden the Drowned Queen.'])
    const cards = deepCards(atFork)
    expect(cards[0]!.rect.y + cards[0]!.rect.h).toBeLessThan(deepOverlay(atFork)[0]!.y * 2)
  })

  test('while a fork waits, its two cards span the box under them, edge to edge', async () => {
    const [a, b] = deepCards(atFork)
    const box = deepOverlay(atFork)[0]!
    expect([a!.rect.x, b!.rect.x + b!.rect.w]).toEqual([box.x, box.x + box.w])
  })

  test('while a fork waits, its blessing and its curse side by side, the blessing first, and a click on one chooses it', async () => {
    const cards = deepCards(atFork)
    expect(cards.map(c => c.mark)).toEqual(pairOf(atFork.world, 6))
    expect([cards[0]!.rect.y === cards[1]!.rect.y, cards[0]!.rect.x + cards[0]!.rect.w < cards[1]!.rect.x]).toEqual([true, true])
    expect(CARD_KEYS).toEqual(['A', 'B'])
    const [a, b] = pairOf(atFork.world, 6).map(m => MARKS[m])
    const words = deepOverlay(atFork).filter(x => x.role === 'button').map(x => x.lines[0]!.map(r => r.text).join(''))
    expect(words).toEqual([`BLESSING: ${a!.name.toUpperCase()}`, `CURSE: ${b!.name.toUpperCase()}`])
    expect(said(atFork).slice(2, 4)).toEqual([`A ${a!.name}, a blessing: ${a!.does}`, `B ${b!.name}, a curse: ${b!.does}`])
    expect(said(atFork).at(-1)).toBe('Choose its fate: none chosen, the blessing holds.')
    expect(deepGesture(atFork, tap({ x: cards[1]!.rect.x + 20, y: cards[1]!.rect.y + 3 }))).toEqual([{ kind: 'mark', mark: cards[1]!.mark }])
  })

  test('the chosen card is framed white, and the note says a click changes it', async () => {
    const hard = pairOf(atFork.world, 6)[1]
    const chosen = { ...atFork, marks: { ...atFork.marks, 6: hard } }
    const [a, b] = deepCards(chosen)
    const edge = (g: Game, r: { x: number; y: number }) => deepPixels(g)[r.y]![r.x + 30]
    expect([edge(chosen, a!.rect) === '#ffffff', edge(chosen, b!.rect) === '#ffffff']).toEqual([false, true])
    expect(edge(atFork, b!.rect)).not.toBe('#ffffff')
    expect(said(chosen).at(-1)).toBe('Choose its fate: a click changes it.')
  })

  test('above the circles, says what the Abyss is and where it opens', async () => {
    const g = deepAt(30, { bossSlain: 30 })
    const told = ['The Abyss', 'It opens past depth 50: every 10 depths a circle, a warden at its end, its fate yours to choose.']
    expect(said(g)).toEqual(told)
    expect(said({ ...g, where: 'town' })).toEqual(told)
    expect(deepCards(deepAt(30))).toEqual([])
  })

  test('the circle the hero is in has its fate in its ink among those chosen; in town, none is', async () => {
    const g = deepAt(97, { bossSlain: 90 })
    const fates = deepOverlay(g)[0]!.lines.find(l => l[0]!.text === 'Fates chosen: ')!
    // Unchosen, a circle's fate is Steady, a blessing.
    expect(fates.at(-1)).toMatchObject({ text: 'V Steady', color: '#5ccf6a' })
    const away = deepOverlay({ ...g, where: 'town' })[0]!.lines.find(l => l[0]!.text === 'Fates chosen: ')!
    expect(away.filter(r => (r as { color?: string }).color !== undefined)).toEqual([])
  })

  test('in a circle with no fork waiting, says where the next opens', async () => {
    expect(said(deepAt(97, { bossSlain: 90 })).at(-1)).toBe('The next fork opens at depth 100, when its warden falls.')
    expect(said(deepAt(60, { bossSlain: 55 })).at(-1)).toBe('The next fork opens at depth 60, when its warden falls.')
  })

  test('the close box closes it; a click elsewhere does nothing', async () => {
    expect(deepGesture(atFork, tap({ x: CLOSE_BOX[0] + 1, y: CLOSE_BOX[1] + 1 }))).toEqual([{ kind: 'panel', panel: 'deep' }])
    expect(deepGesture(atFork, tap({ x: 50, y: 15 }))).toEqual([])
  })

  test('fits in 40 rows at a fork of each of the nine pairs, three tiers listed', async () => {
    const g = deepAt(80, { bossSlain: 80 })
    const pairs = new Map<string, Game>()
    for (const world of SEEDS) pairs.set(pairOf(world, 4).join(), { ...g, world })
    expect(pairs.size).toBe(9)
    for (const x of pairs.values()) {
      expect(deepHeight(x)).toBeLessThanOrEqual(80)
      expect(deepPixels(x).length).toBe(deepHeight(x))
    }
  })
})
