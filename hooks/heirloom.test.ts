import { describe, expect, test } from 'claude-code/testing'

import type { Game, Item, Slot } from '../types'
import { apply, whyNotRetire } from './game'
import { buttonsIn, plainHero } from './fixtures'
import { BASES, LEGENDARIES, PREFIXES, RARITY_COLOR, SLOTS, SUFFIXES, heirloomOf, plainItem } from './items'
import { retireBoxes, retireButtons, retireGesture, retireHeight, retireOverlay, retirePixels } from './retirewindow'
import { CLOSE_BOX, WINDOW_TOP, WINDOW_W } from './window'
import { WORK_X, forgePixels } from './forge'
import type { Gesture } from './window'
import { textMask } from './pixelart'
import { EMPTY_CODEX } from './codex'

const piece = (key: string, over: Partial<Item> = {}): Item => ({ ...plainItem({ nextId: 700 }, key, 'rare'), ...over })
/** A hero who has slain the first big boss, wearing `helm`. */
const veteran = (helm: Item, over: Partial<Game> = {}): Game => {
  const g = plainHero(3)
  return { ...g, bossSlain: 10, deepest: 12, depth: 12, level: 14, gear: { ...g.gear, helm }, codex: { ...EMPTY_CODEX, deepest: 12, level: 14 }, ...over }
}

describe('passing an item down', () => {
  test('a Rare keeps its name, tier and look; its stats are its base\'s plain ones, untempered', async () => {
    // The steel helm's base is 1 defense; found deep with Sturdy and of the Bear, and tempered twice, it had more.
    const found = piece('steelHelm', { name: 'Sturdy Steel Helm of the Bear', def: 11, hp: 20, temper: 2, locked: true })
    const h = heirloomOf(found)
    expect([h.name, h.rarity, h.base, h.slot]).toEqual(['Sturdy Steel Helm of the Bear', 'rare', 'steelHelm', 'helm'])
    expect([h.atk, h.def, h.hp, h.crit, h.xp]).toEqual([0, 1, 0, 0, 0])
    expect([h.temper, h.locked]).toEqual([undefined, undefined])
  })

  test('a Legendary keeps its power, its stats its base\'s plain ones', async () => {
    // The Band of the Endless Loop is a plain band, no stats, still healing every fifth kill.
    const band = piece('ring', { rarity: 'legendary', name: 'Band of the Endless Loop', power: 'loopHeal', atk: 9, hp: 9 })
    const h = heirloomOf(band)
    expect([h.power, h.atk, h.def, h.hp, h.crit, h.xp]).toEqual(['loopHeal', 0, 0, 0, 0, 0])
  })

  test('the Rubber Duck keeps its +50% XP, the power it is: on a plain charm\'s 2 HP', async () => {
    const duck = piece('amulet', { rarity: 'legendary', name: 'Rubber Duck of Insight', power: 'duck', atk: 9, def: 9, hp: 30, xp: 57 })
    const h = heirloomOf(duck)
    expect([h.power, h.atk, h.def, h.hp, h.crit, h.xp]).toEqual(['duck', 0, 0, 2, 0, 50])
  })
})

describe('retiring', () => {
  test("the hero's standing orders carry over to the next hero, retired or started anew", async () => {
    const orders = { drink: 50 as const, smoke: true, leave: 'uncommon' as const }
    const retired = apply({ ...veteran(piece('steelHelm')), orders }, { kind: 'retire', slot: 'helm' })
    expect(retired.orders).toEqual(orders)
    expect(apply(retired, { kind: 'restart' }).orders).toEqual(orders)
    expect(apply({ ...plainHero(3), orders }, { kind: 'restart' }).orders).toEqual(orders)
  })

  test('not before a big boss is slain, said; nor passing down an empty slot', async () => {
    const helm = piece('steelHelm')
    expect(whyNotRetire(veteran(helm, { bossSlain: 5 }), 'helm')).toBe('A hero retires once they have slain a big boss.')
    expect(whyNotRetire(veteran(helm), 'ring')).toBe('Choose a piece you wear to pass down.')
    expect(whyNotRetire(veteran(helm), 'helm')).toBeUndefined()
    // The veteran's two talents, at level 14, already offered, so the talent window does not open on the refusal.
    const refused = apply(veteran(helm, { bossSlain: 5, talentOffered: 2 }), { kind: 'retire', slot: 'helm' })
    expect([refused.level, refused.panel, refused.heirloom]).toEqual([14, 'none', undefined])
    expect(refused.log.at(-1)).toBe('A hero retires once they have slain a big boss.')
  })

  test('the hero is gone: the start screen opens on a new game, the codex counts the retirement, the piece is the heirloom', async () => {
    const helm = piece('steelHelm', { name: 'Sturdy Steel Helm of the Bear', def: 11, hp: 20 })
    const after = apply(veteran(helm), { kind: 'retire', slot: 'helm' })
    expect([after.panel, after.level, after.depth, after.bossSlain]).toEqual(['start', 1, 1, 0])
    expect(after.codex).toMatchObject({ retired: 1, deepest: 12, level: 14 })
    expect(after.heirloom).toEqual(heirloomOf(helm))
  })

  test('a second retirement counts two and its piece replaces the first heirloom', async () => {
    const first = apply(veteran(piece('steelHelm')), { kind: 'retire', slot: 'helm' })
    const ring = piece('ring', { name: 'Ring' })
    const g = plainHero(3)
    const second = apply({ ...veteran(piece('steelHelm'), { codex: first.codex, heirloom: first.heirloom }), gear: { ...g.gear, ring } }, { kind: 'retire', slot: 'ring' })
    expect(second.codex?.retired).toBe(2)
    expect(second.heirloom?.base).toBe('ring')
  })
})

describe('the next hero', () => {
  const retired = (helm: Item) => apply(veteran(helm), { kind: 'retire', slot: 'helm' })

  test('sets out wearing the heirloom, the kit piece it replaces in the bag, at full HP, said', async () => {
    const helm = piece('steelHelm', { name: 'Sturdy Steel Helm of the Bear' })
    const hero = apply(retired(helm), { kind: 'restart', cls: 'knight' })
    expect(hero.gear.helm?.name).toBe('Sturdy Steel Helm of the Bear')
    expect(hero.bag.some(i => i.base === 'hood')).toBe(true)
    expect(hero.hp).toBe(hero.maxHp)
    // The kit's Hood gave 3 HP; a plain Steel Helm gives none.
    expect(hero.maxHp).toBe(apply({ ...hero, heirloom: undefined }, { kind: 'restart', cls: 'knight' }).maxHp - 3)
    expect(hero.log.at(-1)).toBe('You set out in your heirloom, the Sturdy Steel Helm of the Bear.')
    expect(hero.heirloom).toEqual(heirloomOf(helm))
  })

  test('an heirloom that adds HP sets out at the new full HP', async () => {
    // A knight's kit has no amulet: the Rubber Duck's plain charm adds 2 to max HP.
    const duck = piece('amulet', { rarity: 'legendary', name: 'Rubber Duck of Insight', power: 'duck' })
    const g = plainHero(3)
    const left = apply({ ...veteran(piece('steelHelm')), gear: { ...g.gear, amulet: duck } }, { kind: 'retire', slot: 'amulet' })
    const hero = apply(left, { kind: 'restart', cls: 'knight' })
    expect(hero.maxHp).toBe(apply(plainHero(3), { kind: 'restart', cls: 'knight' }).maxHp + 2)
    expect(hero.hp).toBe(hero.maxHp)
  })

  test('the heirloom is a piece of its own: its id is new, apart from every other', async () => {
    const hero = apply(retired(piece('steelHelm', { id: 1 })), { kind: 'restart', cls: 'knight' })
    const ids = [...hero.bag, ...Object.values(hero.gear)].map(i => i!.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  test('a class that cannot wear it finds it in the bag, said', async () => {
    const tome = piece('tome', { name: 'Tome' })
    const g = plainHero(3)
    const left = apply({ ...veteran(piece('steelHelm')), gear: { ...g.gear, offhand: tome } }, { kind: 'retire', slot: 'offhand' })
    const knight = apply(left, { kind: 'restart', cls: 'knight' })
    expect(knight.gear.offhand?.name).not.toBe('Tome')
    expect(knight.bag.some(i => i.name === 'Tome')).toBe(true)
    expect(knight.log.at(-1)).toBe('Your heirloom, the Tome, waits in your bag.')
  })

  test('every new hero has it, not only the first', async () => {
    const once = apply(retired(piece('steelHelm', { name: 'Sturdy Steel Helm of the Bear' })), { kind: 'restart', cls: 'rogue' })
    const again = apply(once, { kind: 'restart', cls: 'knight' })
    expect(again.gear.helm?.name).toBe('Sturdy Steel Helm of the Bear')
  })

  test('with no heirloom a new hero wears the kit alone', async () => {
    const hero = apply(plainHero(3), { kind: 'restart', cls: 'knight' })
    expect(hero.heirloom).toBeUndefined()
    expect(hero.bag).toEqual([])
  })
})


describe('the retire window', () => {
  const tap = (p: { x: number; y: number }): Gesture => ({ type: 'release', from: { x: p.x + 0.5, y: p.y / 2 + 0.25 }, at: { x: p.x + 0.5, y: p.y / 2 + 0.25 }, button: 'left' })
  const helm = piece('steelHelm', { name: 'Steel Helm of Fast Feedback' })
  const g = veteran(helm, { panel: 'retire' })
  const IDLE = { slot: null }
  const said = (x: Game, ui: { slot: Slot | null }) => retireOverlay(x, ui)[0]!.lines.map(l => l.map(r => r.text).join(''))

  test('asks for the heirloom; the box names the chosen piece, what passing it down means and who the hero was', async () => {
    expect(said(g, { slot: 'helm' })).toEqual(['Choose an heirloom:', 'Steel Helm of Fast Feedback', 'Every new hero starts wearing it,', 'its power kept and its stats plain.', 'Level 14 Knight, deepest 12, 1 big boss.'])
    expect(retireOverlay(g, { slot: 'helm' })[0]!.lines[1]![0]!).toMatchObject({ bold: true, color: RARITY_COLOR[helm.rarity] })
    expect(said({ ...g, bossSlain: 30 }, IDLE).at(-1)).toBe('Level 14 Knight, deepest 12, 3 big bosses.')
  })

  test('a slot a worn piece; a click on one chooses it, and the first worn is chosen before any', async () => {
    const boxes = retireBoxes(g)
    expect(boxes.map(b => b.slot)).toEqual(['weapon', 'helm'])
    expect(said(g, IDLE)[1]).toBe(g.gear.weapon!.name)
    expect(retireGesture(g, IDLE, tap({ x: boxes[1]!.x + 3, y: boxes[1]!.y + 4 }))).toEqual({ ui: { slot: 'helm' }, actions: [] })
  })

  test('Retire retires passing down the chosen piece; Back goes back to the sheet; the close box closes', async () => {
    const b = retireButtons(g, { slot: 'helm' })
    expect(retireGesture(g, { slot: 'helm' }, tap({ x: b.retire.x + 2, y: b.retire.y + 4 })).actions).toEqual([{ kind: 'retire', slot: 'helm' }])
    expect(retireGesture(g, { slot: 'helm' }, tap({ x: b.back.x + 2, y: b.back.y + 4 })).actions).toEqual([{ kind: 'panel', panel: 'sheet' }])
    expect(retireGesture(g, IDLE, tap({ x: CLOSE_BOX[0] + 1, y: CLOSE_BOX[1] + 1 })).actions).toEqual([{ kind: 'panel', panel: 'retire' }])
    expect(retireGesture(g, IDLE, tap({ x: 60, y: 10 })).actions).toEqual([])
  })

  test('before a big boss is slain Retire is dark and does nothing', async () => {
    const early = { ...g, bossSlain: 5 }
    const b = retireButtons(early, IDLE)
    expect(retireGesture(early, IDLE, tap({ x: b.retire.x + 2, y: b.retire.y + 4 })).actions).toEqual([])
    const lit = (x: Game) => buttonsIn(retireOverlay(x, IDLE)).find(k => k.text === 'RETIRE')!.isLit
    expect(lit(early)).toBe(false)
    expect(lit(g)).toBe(true)
  })

  test('fits in 40 rows wearing all seven pieces with the longest name a piece can have', async () => {
    const widest = (names: readonly string[]) => [...names].sort((a, b) => textMask(b.toUpperCase())[0]!.length - textMask(a.toUpperCase())[0]!.length)[0]!
    const affixed = [PREFIXES, BASES, SUFFIXES].map(list => widest(list.map(x => x.name))).join(' ')
    const longest = widest([affixed, ...LEGENDARIES.map(l => l.name)])
    const full = { ...g, gear: Object.fromEntries(SLOTS.map((slot, i) => [slot, { ...piece('ring', { id: 800 + i, slot }), name: longest }])) }
    expect(retireBoxes(full).length).toBe(7)
    expect(retireHeight(full, IDLE)).toBeLessThanOrEqual(80)
    expect(retirePixels(full, IDLE).length).toBe(retireHeight(full, IDLE))
    expect(retireOverlay(full, IDLE)[0]!.lines.every(l => l.map(r => r.text).join('').length <= WINDOW_W - WORK_X - 3)).toBe(true)
  })

  test('shows what is worn as the smith does, the chosen piece framed the same', async () => {
    const side = (px: string[][]) => px.slice(WINDOW_TOP, WINDOW_TOP + 58).map(row => row.slice(0, WORK_X - 1))
    for (const slot of ['weapon', 'helm'] as const) expect(side(retirePixels(g, { slot }))).toEqual(side(forgePixels(g, { slot })))
  })
})
