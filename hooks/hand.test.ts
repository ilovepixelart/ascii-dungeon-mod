import { describe, expect, test } from 'claude-code/testing'

import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import type { Game } from '../types'
import { DEFAULT_ORDERS, apply, isByHand, levelOf, newGame, ordersOf } from './game'

const PANE = { plugin: 'ascii-dungeon', component: 'Pane', requestId: 'dungeon', props: { title: 'Dungeon', isFocused: true, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} } } as const

const byHand = (g: Game): Game => ({ ...g, panel: 'none', orders: { ...DEFAULT_ORDERS, play: 'hand' } })

/** The session begun on `saved`, the host's part stubbed, every tool call failing. */
const begin = async ($: Engine, on: On, saved: Game) => {
  on('store.get', (_$, e) => ({ value: e.key === 'save' ? saved : undefined }) as never)
  on('store.set', () => ({ value: undefined }) as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('ui.toast', () => ({ value: undefined }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: { stdout: '', stderr: 'boom' } as never, isError: true }))
  on('turn.complete', () => ({ text: '' }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true } as never)
}

/** A player by hand alone: a foe fought, points trained, the stairs taken, else a step toward them. */
const playByHand = (g0: Game, actions: number) => {
  let g = g0
  for (let i = 0; i < actions; i += 1) {
    const stairs = levelOf(g).stairs
    if (g.panel !== 'none') g = apply(g, { kind: 'panel', panel: g.panel })
    else if (g.points > 0) g = apply(g, { kind: 'train', stat: 'vigor' })
    else if (g.foe !== null) g = apply(g, { kind: 'attack' })
    else if (g.x === stairs.x && g.y === stairs.y) g = apply(g, { kind: 'stairs' })
    else g = apply(g, { kind: 'walk' })
  }
  return g
}

describe('playing by hand', () => {
  test('is an order: the session plays until it is stepped, and a save from before it has the session playing', async () => {
    const g = { ...newGame(1, 'knight'), panel: 'none' as const }
    expect(isByHand(g)).toBe(false)
    const hand = apply(g, { kind: 'order', order: 'play' })
    expect(isByHand(hand)).toBe(true)
    expect(hand.log.at(-1)).toBe('You play by hand: the session no longer moves you, and foes find you as you walk.')
    expect(apply(hand, { kind: 'order', order: 'play' }).log.at(-1)).toBe('The session plays: every tool call moves you, every answer takes the stairs.')
    expect(ordersOf({ orders: { drink: 50, smoke: true, leave: 'rare' } as never })).toEqual({ drink: 50, smoke: true, leave: 'rare', play: 'session' })
  })

  test("the session's tool calls and answers leave the hero be", async ($, on) => {
    await begin($, on, byHand(newGame(1, 'knight')))
    await $.tool.call({ tool: 'Bash', command: 'npm test' })
    await $.tool.call({ tool: 'Bash', command: 'npm test' })
    await $.turn.complete({ answer: 'done', durationMs: 1, isAborted: false, turnId: 't1', reason: 'answer' } as never)
    const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
    expect(await ui.find({ type: 'Text', text: /of npm/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /descend to depth/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /^\[ +HP 30\/30 +\]/ })).toBeDefined()
  })

  for (const cls of ['knight', 'mage', 'rogue'] as const) {
    test(`a ${cls} played by hand alone meets foes on the way, levels and gets past the first boss`, { timeoutMs: 30000 }, async () => {
      const g = playByHand(byHand(newGame(1, cls)), 1500)
      expect(g.level).toBeGreaterThanOrEqual(5)
      expect(g.deepest).toBeGreaterThan(5)
    })
  }

  test('the session playing, a walk by hand meets no foe', async () => {
    let g: Game = { ...newGame(1, 'knight'), panel: 'none' }
    for (let i = 0; i < 40 && g.foe === null; i += 1) g = apply(g, { kind: 'walk' })
    expect(g.foe).toBeNull()
  })
})
