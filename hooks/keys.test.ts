import { describe, expect, test } from 'claude-code/testing'

import type { On } from 'claude-code'
import type { Engine, Mounted } from 'claude-code/testing'
import type { Game } from '../types'
import { newGame } from './game'

// The text dashboard (a pane too narrow for the strip): one key, one action, in every view.
const PANE = { plugin: 'ascii-dungeon', component: 'Pane', requestId: 'dungeon', props: { title: 'Dungeon', isFocused: true, bodyColumns: 60, placement: 'dock', scroll: { offset: 0, bodyRows: 60 }, view: {} } } as const

/** The session begun on `saved`, the host's part stubbed. */
const begin = async ($: Engine, on: On, saved: Game) => {
  on('store.get', (_$, e) => ({ value: e.key === 'save' ? saved : undefined }) as never)
  on('store.set', () => ({ value: undefined }) as never)
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('ui.toast', () => ({ value: undefined }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true } as never)
}

/** The hotkeys two buttons or more answer to, with the buttons. */
const shared = async (ui: Pick<Mounted<'terminal' | 'desktop', 'Pane'>, 'findAll'>) => {
  const by = new Map<string, string[]>()
  for (const b of await ui.findAll({ type: 'Button' })) {
    const key = (b.props as { hotkey?: string }).hotkey
    if (key !== undefined) by.set(key, [...(by.get(key) ?? []), String(b.key)])
  }
  return [...by].filter(([, buttons]) => buttons.length > 1)
}

describe('the text dashboard\'s keys', () => {
  for (const surface of ['terminal', 'desktop'] as const) {
    test(`on the ${surface}, the map and the bag: no key does two things`, async $ => {
      const ui = await $.ui.mount({ ...PANE, surface })
      expect(await shared(ui)).toEqual([])
      await ui.press({ key: 'bag' })
      expect(await ui.find({ type: 'Button', key: 'junk' })).toBeDefined()
      expect(await shared(ui)).toEqual([])
      await ui.unmount()
    })
  }

  const town = (over: Partial<Game>): Game => ({ ...newGame(), where: 'town', x: 10, y: 10, ...over })
  for (const [who, over] of [['elder', { panel: 'elder', quest: { kind: 'slay', depth: 1, need: 1, have: 1 } }], ['dog', { panel: 'dog' }]] as const) {
    test(`in town with the ${who}'s window open: no key does two things`, async ($, on) => {
      await begin($, on, town(over as Partial<Game>))
      const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
      expect(await ui.find({ type: 'Button', key: who === 'elder' ? 'claim' : 'pet' })).toBeDefined()
      expect(await shared(ui)).toEqual([])
      await ui.unmount()
    })
  }
})
