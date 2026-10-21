import { describe, expect, test } from 'claude-code/testing'

import type { On } from 'claude-code'
import type { Engine } from 'claude-code/testing'
import type { Game } from '../types'
import { SAVE_VERSION, newGame } from './game'

/** The host a session starts in, its store holding `saved`; what the mod writes lands in the map, what it says in `said`. */
const hostWith = (on: On, saved: unknown) => {
  const kept = new Map<string, unknown>([['save', saved]])
  const said: string[] = []
  on('store.get', (_$, e) => ({ value: kept.get(e.key) }) as never)
  on('store.set', (_$, e) => {
    kept.set(e.key, e.value)
    return { value: undefined } as never
  })
  on('command.register', () => ({ value: undefined }) as never)
  on('ui.open', () => ({ value: { isPlaced: true } }) as never)
  on('ui.toast', (_$, e) => {
    said.push(e.text)
    return { value: undefined }
  })
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('tool.call', () => ({ result: { stdout: '', stderr: '', interrupted: false } as never }))
  return { kept, said }
}
const start = ($: Engine) => $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true } as never)

describe('the saved game a session opens', () => {
  test('a save from a newer version is left as it is, said, and play goes on without writing over it', async ($, on) => {
    const later = { ...newGame(), version: SAVE_VERSION + 1, gold: 1234 }
    const { kept, said } = hostWith(on, later)
    await start($)
    await $.tool.call({ tool: 'Bash', command: 'ls' })
    expect(kept.get('save')).toEqual(later)
    expect(said.some(t => t.includes('newer version'))).toBe(true)
  })

  for (const [what, saved] of [['a number', 5], ['a bag that is not a list', { ...newGame(), bag: null }], ['gear that is not a set', { ...newGame(), gear: null }]] as const) {
    test(`a save that cannot be read (${what}) gives way to a new game, which plays and is saved`, async ($, on) => {
      const { kept } = hostWith(on, saved)
      await start($)
      await $.tool.call({ tool: 'Bash', command: 'ls' })
      const now = kept.get('save') as Game
      expect(Array.isArray(now.bag) && Array.isArray(now.log) && now.version === SAVE_VERSION).toBe(true)
    })
  }

  test('a save of this version opens as it was', async ($, on) => {
    const { kept } = hostWith(on, { ...newGame(), gold: 77 })
    await start($)
    await $.tool.call({ tool: 'Bash', command: 'ls' })
    expect((kept.get('save') as Game).gold).toBe(77)
  })
})
