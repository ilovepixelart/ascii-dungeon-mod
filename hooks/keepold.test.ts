import { describe, expect, test } from 'claude-code/testing'

import type { Game, Item } from '../types'
import { apply, keptChoice, reforgeCost } from './game'
import { GOLD_INK } from './pieces'
import { plainItem } from './items'
import { WINDOW_TOP } from './window'
import type { Gesture } from './window'
import { forgeGesture, forgeOverlay, forgePixels } from './forge'
import { newGame } from './world'

/** A knight in town with gold, wearing a Rare helm to reforge. */
const inTown = (): { g: Game; helm: Item } => {
  const base = apply({ ...newGame(4, 'knight'), gold: 5000 }, { kind: 'portal' })
  const helm = { ...plainItem(base, 'steelHelm', 'rare'), x: 0, y: 0 }
  return { g: { ...base, gear: { ...base.gear, helm } }, helm }
}

describe('keeping the old roll', () => {
  test('after a reforge the piece as it was can be worn again; the gold stays paid', async () => {
    const { g, helm } = inTown()
    const reforged = apply(g, { kind: 'reforge', slot: 'helm' })
    const paid = g.gold - reforgeCost(g)
    expect(reforged.gold).toBe(paid)
    expect(keptChoice(reforged)).toEqual({ slot: 'helm', item: helm })
    const kept = apply(reforged, { kind: 'keepOld' })
    expect(kept.gear.helm).toEqual(helm)
    expect(kept.gold).toBe(paid)
    expect(kept.reforgedFrom).toBeNull()
    expect(kept.log.at(-1)).toBe(`You keep your ${helm.name} as it was, and the smith melts down the ${reforged.gear.helm!.name}.`)
  })

  test('the chance is gone with the next job, once the piece is no longer worn, or on leaving town', async () => {
    const { g } = inTown()
    const reforged = apply(g, { kind: 'reforge', slot: 'helm' })
    expect(keptChoice(apply(reforged, { kind: 'temper', slot: 'weapon' }))).toBeUndefined()
    expect(keptChoice(apply(reforged, { kind: 'unequip', slot: 'helm' }))).toBeUndefined()
    expect(apply(reforged, { kind: 'portal' }).reforgedFrom).toBeNull()
    const none = apply(g, { kind: 'keepOld' })
    expect(none.log.at(-1)).toBe('There is no reforge to take back.')
    expect(none.gear).toEqual(g.gear)
  })

  test('a second reforge keeps the one before it, not the first', async () => {
    const { g } = inTown()
    const once = apply(g, { kind: 'reforge', slot: 'helm' })
    const twice = apply(once, { kind: 'reforge', slot: 'helm' })
    expect(keptChoice(twice)?.item).toEqual(once.gear.helm)
  })

  test('in the smith\'s window: what it was before, and a Keep old button that takes it back', async () => {
    const { g, helm } = inTown()
    const reforged = apply({ ...g, panel: 'forge' }, { kind: 'reforge', slot: 'helm' })
    const lines = forgeOverlay(reforged, { slot: 'helm' })[0]!.lines.map(l => l.map(r => r.text).join(''))
    expect(lines.some(l => l.startsWith(`Before: ${helm.name}`))).toBe(true)
    expect(forgeOverlay(g, { slot: 'helm' })[0]!.lines.some(l => l[0]?.text === 'Before: ')).toBe(false)
    // The buttons' gold keys, top to bottom: Temper, Reforge, Keep old.
    const px = forgePixels(reforged, { slot: 'helm' })
    const keys: number[] = []
    for (let y = WINDOW_TOP; y < px.length; y += 1) if (px[y]!.slice(47, 54).includes(GOLD_INK) && !px[y - 1]!.slice(47, 54).includes(GOLD_INK)) keys.push(y)
    expect(keys.length).toBe(3)
    const tap: Gesture = { type: 'release', from: { x: 50.5, y: (keys[2]! + 2) / 2 + 0.25 }, at: { x: 50.5, y: (keys[2]! + 2) / 2 + 0.25 }, button: 'left' }
    expect(forgeGesture(reforged, { slot: 'helm' }, tap).actions).toEqual([{ kind: 'keepOld' }])
  })
})
