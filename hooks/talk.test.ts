import { describe, expect, test } from 'claude-code/testing'

import type { Game } from '../types'
import { CURSOR, GOLD_INK } from './pieces'
import { CLOSE_BOX, WINDOW_W } from './window'
import type { Gesture } from './window'
import { SPEAKERS, talkAction, talkGesture, talkHeight, talkOverlay, talkPixels, wrap } from './talk'
import type { Speaker } from './talk'
import { newGame } from './world'

const hero = (over: Partial<Game> = {}): Game => ({ ...newGame(1, 'knight'), gold: 0, deepest: 4, depth: 4, ...over })
const words = (g: Game, who: Speaker) => talkOverlay(g, who)[0]!.lines.map(l => l.map(r => r.text).join(''))
const first = (g: Game, who: Speaker) => words(g, who)[0]
/** A click on window pixel (px, py), in the click layer's cells. */
const tap = (px: number, py: number): Gesture => ({ type: 'release', from: { x: px + 0.5, y: py / 2 + 0.25 }, at: { x: px + 0.5, y: py / 2 + 0.25 }, button: 'left' })
/** Where a window's button is: the first pixel row, from the left, inked in the button's gold key. */
const buttonAt = (g: Game, who: Speaker) => {
  const px = talkPixels(g, who)
  for (let y = 0; y < px.length; y += 1) for (let x = 35; x < WINDOW_W; x += 1) if (px[y]![x] === GOLD_INK && y > 14) return { x, y }
  return undefined
}

describe('what each says, from how the hero stands', () => {
  test('the healer: nothing mended, half the HP or more, or less', async () => {
    expect(first(hero({ mended: 0 }), 'healer')).toBe('"Not a scratch on you. Off you go, then."')
    expect(first(hero({ mended: 21, maxHp: 42 }), 'healer')).toBe('"You were barely standing! Lie still... there."')
    expect(first(hero({ mended: 20, maxHp: 42 }), 'healer')).toBe('"Hold still. There, good as new."')
    expect(words(hero({ mended: 20, maxHp: 42 }), 'healer')[1]).toBe('+20 HP. Healing is free in town.')
  })

  test('the elder: a quest just given, one under way, one done but unpaid, one just paid', async () => {
    const q = { kind: 'slay' as const, depth: 4, need: 8, have: 0 }
    expect(first(hero({ quest: q }), 'elder')).toBe('"Slay 8 foes on depth 4 or deeper, and come back to me."')
    expect(first(hero({ quest: { ...q, have: 3 } }), 'elder')).toBe('"3 of 8 slain on depth 4 or deeper. Keep at it."')
    expect(first(hero({ quest: { ...q, have: 8 } }), 'elder')).toBe('"Make room in your bag for your reward, then claim it."')
    // 15 a depth and 30.
    expect(words(hero({ quest: q }), 'elder')[1]).toBe('Pays 90 gold and an item of Uncommon or better.')
    expect(words(hero({ quest: null, questsDone: 2 }), 'elder')).toEqual(['"Well done. Here is what I promised."', 'Quests done: 2.'])
  })

  test('the mystic: a fortune in force, one that can be paid for, one that cannot', async () => {
    // 20 and 10 a depth reached: 60 at depth 4.
    expect(first(hero({ fortune: { kind: 'riches', depth: 4 } }), 'mystic')).toBe('"Riches. Foes leave more gold, until you change depth."')
    expect(first(hero({ gold: 60 }), 'mystic')).toBe('"The cards favor those who pay for them."')
    expect(first(hero({ gold: 59 }), 'mystic')).toBe('"Come back when your purse is heavier."')
  })

  test('the guard: a guardian one depth off or nearer, a turn of the halls ahead, a fall, else the stairs', async () => {
    expect(first(hero({ depth: 4, bossSlain: 0 }), 'guard')).toBe('"A guardian holds the stairs of depth 5. Go ready."')
    expect(first(hero({ depth: 5, bossSlain: 0 }), 'guard')).toBe('"A guardian holds the stairs of depth 5. Go ready."')
    // Its guardian slain, depth 10 gives onto depth 11, where the floods give way to the fungal deep.
    expect(first(hero({ depth: 10, deepest: 10, bossSlain: 10 }), 'guard')).toBe('"Past depth 10, they say, the halls turn to fungal caves."')
    expect(first(hero({ depth: 2, deaths: 1 }), 'guard')).toBe('"Fell down there and came back? Mind the stairs this time."')
    expect(first(hero({ depth: 2, deaths: 0 }), 'guard')).toBe('"The dungeon is through the portal. Mind the stairs."')
    expect(words(hero({ depth: 2, deepest: 7, deaths: 3 }), 'guard')[1]).toBe('Your deepest: depth 7. Times fallen: 3.')
  })

  test('the villager hints at what the hero has not used yet, in turn', async () => {
    const item = { ...newGame(1).gear.weapon!, x: 0, y: 0 }
    const q = { kind: 'slay' as const, depth: 4, need: 8, have: 0 }
    expect(first(hero(), 'villager')).toMatch(/stash/)
    expect(first(hero({ stashed: [item] }), 'villager')).toMatch(/elder/)
    expect(first(hero({ stashed: [item], quest: q }), 'villager')).toMatch(/smith/)
    expect(first(hero({ stashed: [item], quest: q, reforges: 1 }), 'villager')).toMatch(/mystic/)
    expect(first(hero({ stashed: [item], quest: q, reforges: 1, fortune: { kind: 'luck', depth: 4 } }), 'villager')).toBe('"A pack from the road, sealed. Care to try your luck?"')
  })

  test('the dog, by how often it has been petted', async () => {
    expect(first(hero({ petted: 0 }), 'dog')).toMatch(/hopefully/)
    expect(first(hero({ petted: 9 }), 'dog')).toMatch(/leans into your hand/)
    expect(first(hero({ petted: 10 }), 'dog')).toMatch(/belly rub/)
  })

  test('a line wraps at the last space that fits, each piece keeping its look; a word longer than the width is cut', async () => {
    const out = wrap([[{ text: 'aaa bbb ccc dddd', dim: true }]], 8)
    expect(out).toEqual([[{ text: 'aaa bbb', dim: true }], [{ text: 'ccc dddd', dim: true }]])
    expect(wrap([[{ text: 'abcdefghij' }]], 4).map(l => l[0]!.text)).toEqual(['abcd', 'efgh', 'ij'])
    expect(wrap([[{ text: 'short' }]], 8)).toEqual([[{ text: 'short' }]])
  })

  test('long words wrap inside their box, every word kept', async () => {
    for (const who of SPEAKERS) {
      const box = talkOverlay(hero({ quest: { kind: 'champion', depth: 12, need: 1, have: 0 } }), who)[0]!
      for (const line of words(hero({ quest: { kind: 'champion', depth: 12, need: 1, have: 0 } }), who)) expect(line.length).toBeLessThanOrEqual(box.w - 4)
      expect(box.x + box.w).toBeLessThanOrEqual(WINDOW_W)
    }
    const g = hero({ quest: { kind: 'champion', depth: 12, need: 1, have: 0 } })
    expect(words(g, 'elder').join(' ').replace(/\s+/g, ' ')).toBe('"Slay a champion on depth 12 or deeper, and come back to me." Pays 210 gold and an item of Uncommon or better.')
  })
})

describe('the button', () => {
  test('the mystic\'s reads a fortune, only while none is in force and it can be paid for', async () => {
    expect(talkAction(hero({ gold: 60 }), 'mystic')).toMatchObject({ action: { kind: 'fortune' }, state: 'ready', cost: 60 })
    expect(talkAction(hero({ gold: 59 }), 'mystic')?.state).toBe('off')
    expect(talkAction(hero({ gold: 500, fortune: { kind: 'luck', depth: 4 } }), 'mystic')?.state).toBe('off')
  })

  test('the elder\'s claims, lit only when the quest is done; there is none without a quest', async () => {
    const q = { kind: 'slay' as const, depth: 4, need: 8, have: 3 }
    expect(talkAction(hero({ quest: q }), 'elder')).toMatchObject({ action: { kind: 'claim' }, state: 'off' })
    expect(talkAction(hero({ quest: { ...q, have: 8 } }), 'elder')?.state).toBe('armed')
    expect(talkAction(hero({ quest: null }), 'elder')).toBeUndefined()
  })

  test('the dog\'s pets it; the villager\'s sells a sealed pack; the guard\'s trades in; the healer has none', async () => {
    expect(talkAction(hero(), 'dog')).toMatchObject({ action: { kind: 'pet' }, state: 'ready' })
    expect(talkAction(hero(), 'villager')).toMatchObject({ key: 'G', action: { kind: 'gamble' } })
    expect(talkAction(hero(), 'guard')).toMatchObject({ key: 'T', action: { kind: 'tradeIn' } })
    expect(talkAction(hero(), 'healer')).toBeUndefined()
  })

  test('a click on a button that can act does it; on one that cannot, nothing; the close box closes the window', async () => {
    const dog = hero()
    const at = buttonAt(dog, 'dog')!
    expect(talkGesture(dog, 'dog', tap(at.x, at.y))).toEqual([{ kind: 'pet' }])
    const poor = hero({ gold: 0 })
    const off = buttonAt({ ...poor, gold: 500 }, 'mystic')!
    expect(talkGesture(poor, 'mystic', tap(off.x, off.y))).toEqual([])
    expect(talkGesture({ ...poor, gold: 500 }, 'mystic', tap(off.x, off.y))).toEqual([{ kind: 'fortune' }])
    const [x, y] = CLOSE_BOX
    for (const who of SPEAKERS) expect(talkGesture(hero(), who, tap(x + 2, y + 2))).toEqual([{ kind: 'panel', panel: who }])
    expect(talkGesture(dog, 'dog', tap(2, 40))).toEqual([])
    expect(talkGesture(dog, 'dog', { type: 'drag', from: { x: at.x, y: at.y / 2 }, at: { x: at.x, y: at.y / 2 } })).toEqual([])
  })
})

describe('the window', () => {
  test('is WINDOW_W wide, a whole number of cells tall, and holds everything it draws', async () => {
    for (const who of SPEAKERS) {
      const g = hero({ quest: { kind: 'slay', depth: 4, need: 8, have: 3 } })
      const px = talkPixels(g, who)
      expect(px.length).toBe(talkHeight(g, who))
      expect(px.length % 2).toBe(0)
      for (const row of px) expect(row.length).toBe(WINDOW_W)
      const box = talkOverlay(g, who)[0]!
      expect((box.y + box.h) * 2).toBeLessThanOrEqual(px.length)
    }
  })

  test('the mystic\'s fortune in force is framed white with its name in gold; the others are not', async () => {
    const px = talkPixels(hero({ fortune: { kind: 'riches', depth: 4 } }), 'mystic')
    const framed = px.map((row, y) => ({ y, white: row.slice(3, WINDOW_W - 3).every(p => p === CURSOR) })).filter(r => r.white)
    // One row's frame, top and bottom edges.
    expect(framed.length).toBe(2)
    const none = talkPixels(hero(), 'mystic')
    expect(none.some(row => row.slice(3, WINDOW_W - 3).every(p => p === CURSOR))).toBe(false)
    const inGold = px.slice(framed[0]!.y, framed[1]!.y).some(row => row.slice(4, 40).includes(GOLD_INK))
    expect(inGold).toBe(true)
  })
})

test('the healer shows the hero\'s HP and the elder the quest as text on a flat bar; the others have none', async () => {
  const g = { ...newGame(4), hp: 12, maxHp: 30 }
  const label = (who: Parameters<typeof talkOverlay>[1], game = g) => talkOverlay(game, who).find(b => b.role === 'label')?.lines[0]!.map(r => r.text).join('')
  expect(label('healer')).toBe('12/30')
  expect(label('guard')).toBeUndefined()
  expect(label('elder', { ...g, quest: { kind: 'slay', depth: 6, need: 5, have: 2 } })).toBe('2/5')
})
