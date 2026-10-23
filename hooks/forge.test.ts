import { describe, expect, test } from 'claude-code/testing'

import type { Game, Item, Rarity, Slot } from '../types'
import { CURSOR } from './pieces'
import { BG } from './canvas'
import { buttonsIn } from './fixtures'
import { WORN_SLOTS } from './inventory'
import { makeItem, plainItem, setOf, setPiece } from './items'
import { WINDOW_TOP, CLOSE_BOX } from './window'
import type { Gesture } from './window'
import { FORGE_UI_IDLE, chosenSlot, forgeGesture, forgeHeight, forgeOverlay, forgePixels, nextWorn, whyNotReforge, whyNotTemper } from './forge'
import { apply } from './game'
import { newGame } from './world'

const knight = (gold: number): Game => ({ ...newGame(1, 'knight'), gold })
const wear = (g: Game, slot: Slot, base: string, rarity: Rarity, over: Partial<Item> = {}): Game => ({ ...g, gear: { ...g.gear, [slot]: { ...plainItem(g, base, rarity), x: 0, y: 0, ...over } } })
const tap = (px: number, py: number): Gesture => ({ type: 'release', from: { x: px + 0.5, y: py / 2 + 0.25 }, at: { x: px + 0.5, y: py / 2 + 0.25 }, button: 'left' })
const onSlot = (slot: Slot) => {
  const [x, y, w, h] = WORN_SLOTS[slot]
  return tap(x + Math.floor(w / 2), WINDOW_TOP + y + Math.floor(h / 2))
}
const card = (g: Game, slot: Slot | null) => forgeOverlay(g, { slot })[0]!.lines.map(l => l.map(r => r.text).join(''))
/** The tops of the buttons whose keys are lit, in window pixels. */
const readyKeys = (g: Game, slot: Slot | null) => buttonsIn(forgeOverlay(g, { slot })).filter(b => b.isLit).map(b => b.y)

describe('the piece chosen', () => {
  test('is the first worn until another is clicked; a piece no longer worn gives way to the first', async () => {
    const g = knight(0)
    expect(chosenSlot(g, FORGE_UI_IDLE)).toBe('weapon')
    expect(forgeGesture(g, FORGE_UI_IDLE, onSlot('armor')).ui).toEqual({ slot: 'armor' })
    expect(chosenSlot(g, { slot: 'armor' })).toBe('armor')
    expect(chosenSlot(g, { slot: 'ring' })).toBe('weapon')
    expect(chosenSlot({ ...g, gear: {} }, FORGE_UI_IDLE)).toBeUndefined()
  })

  test('an empty slot is not chosen', async () => {
    const g = knight(0)
    expect(forgeGesture(g, { slot: 'armor' }, onSlot('ring')).ui).toEqual({ slot: 'armor' })
  })

  test('is framed white on its own frame, as the bag frames the slot it would fill, the ground outside it left bare; the others are not', async () => {
    const g = knight(0)
    const px = forgePixels(g, { slot: 'armor' })
    const at = (slot: Slot, out: number) => {
      const [x, y] = WORN_SLOTS[slot]
      return px[WINDOW_TOP + y - out]?.[x + 2]
    }
    expect([at('armor', 1), at('armor', 2)]).toEqual([CURSOR, BG])
    expect(at('weapon', 1)).not.toBe(CURSOR)
  })

  test('the step key goes through the worn pieces in slot order and wraps', async () => {
    const g = knight(0)
    const worn = (['weapon', 'offhand', 'helm', 'armor', 'boots', 'ring', 'amulet'] as const).filter(s => g.gear[s] !== undefined)
    let ui = FORGE_UI_IDLE
    const seen: (Slot | null)[] = []
    for (let i = 0; i < worn.length + 1; i += 1) {
      ui = nextWorn(g, ui)
      seen.push(ui.slot)
    }
    expect(seen).toEqual([...worn.slice(1), worn[0]!, worn[1] ?? worn[0]!])
  })
})

describe('the jobs', () => {
  test('tempering: its price when it can be paid, else short of gold; never past the limit', async () => {
    const g = knight(60)
    const sword = g.gear.weapon!
    expect(whyNotTemper(g, sword)).toBeUndefined()
    expect(whyNotTemper({ ...g, gold: 59 }, sword)).toBe('not enough gold')
    expect(whyNotTemper(g, { ...sword, temper: 3 })).toBe('tempered as far as it goes')
  })

  test('reforging: not a Common, not a Legendary, and not short of gold', async () => {
    const g = knight(1000)
    expect(whyNotReforge(g, g.gear.weapon!)).toBe('a Common has no affixes')
    const rare = wear(g, 'helm', 'steelHelm', 'rare').gear.helm!
    expect(whyNotReforge(g, rare)).toBeUndefined()
    expect(whyNotReforge({ ...g, gold: 0 }, rare)).toBe('not enough gold')
    expect(whyNotReforge(g, wear(g, 'ring', 'ring', 'legendary').gear.ring!)).toBe('a Legendary stays as it was made')
  })

  test('the card ends with what each job costs, or why it cannot be done; tempering says what it makes of the stat', async () => {
    // A new knight's Common sword, 2 attack: 60 to temper; nothing to reforge.
    expect(card(knight(0), 'weapon').slice(-2)).toEqual(['Temper 60  ATK 2 > 3  not enough gold', 'Reforge a Common has no affixes'])
    expect(card(knight(100), 'weapon').slice(-2)).toEqual(['Temper 60  ATK 2 > 3', 'Reforge a Common has no affixes'])
    expect(card(wear(knight(0), 'weapon', 'sword', 'common', { temper: 3 }), 'weapon').at(-2)).toBe('Temper tempered as far as it goes  ATK 2')
    expect(card({ ...knight(0), gear: {} }, null)).toEqual(['You wear nothing for the smith to work on.'])
  })

  test('a click on a job that can be done does it on the chosen piece; one that cannot does nothing', async () => {
    const g = wear(knight(1000), 'helm', 'steelHelm', 'rare')
    const [temperY, reforgeY] = readyKeys(g, 'helm')
    expect(forgeGesture(g, { slot: 'helm' }, tap(50, temperY! + 2)).actions).toEqual([{ kind: 'temper', slot: 'helm' }])
    expect(forgeGesture(g, { slot: 'helm' }, tap(50, reforgeY! + 2)).actions).toEqual([{ kind: 'reforge', slot: 'helm' }])
    const poor = { ...g, gold: 0 }
    expect(readyKeys(poor, 'helm')).toEqual([])
    expect(forgeGesture(poor, { slot: 'helm' }, tap(50, temperY! + 2)).actions).toEqual([])
    expect(forgeGesture(poor, { slot: 'helm' }, tap(50, reforgeY! + 2)).actions).toEqual([])
  })

  test('the close box closes the window; a drag does nothing', async () => {
    const [x, y] = CLOSE_BOX
    expect(forgeGesture(knight(0), { slot: 'armor' }, tap(x + 2, y + 2))).toEqual({ ui: FORGE_UI_IDLE, actions: [{ kind: 'panel', panel: 'forge' }] })
    expect(forgeGesture(knight(0), FORGE_UI_IDLE, { type: 'drag', from: { x: 5, y: 15 }, at: { x: 9, y: 15 } }).actions).toEqual([])
  })
})

describe('the smith after a reforge', () => {
  /** In town before the smith with `item` worn in its slot, rich, then reforged once: Keep old is offered. */
  const reforged = (g: Game, item: Item) => {
    const slot = item.slot
    const town = { ...apply({ ...g, gold: 10 ** 7 }, { kind: 'portal' }), gear: { [slot]: { ...item, x: 0, y: 0 } }, panel: 'forge' as const }
    return { g: apply(town, { kind: 'reforge', slot }), slot }
  }

  test('fits in 41 rows with Keep old shown, every line of its card whole, for any piece the smith reforges', async () => {
    const tall: string[] = []
    for (let seed = 1; seed <= 60; seed += 1) {
      const g = newGame(seed)
      for (const item of [makeItem({ ...g, depth: 40 }, 'uncommon', 3), makeItem({ ...g, depth: 40 }, 'epic', 3), setPiece(g, setOf(g.cls))]) {
        const { g: after, slot } = reforged(g, item)
        const box = forgeOverlay(after, { slot })[0]!
        const cut = box.lines.map(l => l.map(r => r.text).join('')).filter(t => t.length > box.w - 4)
        if (forgeHeight(after, { slot }) > 82 || cut.length > 0) tall.push(`${item.name}: ${forgeHeight(after, { slot })} px, cut ${cut.join(' / ')}`)
      }
    }
    expect(tall.slice(0, 3)).toEqual([])
  })

  test('the card says what was worn before, its name in its tier color, then its stats', async () => {
    const g = newGame(7)
    const item = { ...plainItem(g, 'helm', 'epic'), atk: 2, def: 6, hp: 0, crit: 0, xp: 0 }
    const { g: after, slot } = reforged(g, item)
    const lines = forgeOverlay(after, { slot })[0]!.lines
    const at = lines.findIndex(l => l[0]?.text === 'Before: ')
    expect(lines[at]![1]).toMatchObject({ text: item.name, color: '#a85cf0' })
    expect(lines[at + 1]!.map(r => r.text).join('').trim()).toBe('+2 atk  +6 def')
  })
})
