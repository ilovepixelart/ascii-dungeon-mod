import { describe, expect, test } from 'claude-code/testing'

import { newGame } from './game'

// The options are held to the README by scripts/check-release.mjs: the test runner loads code only, not plugin.json.
describe('the promised surface (README, Stable surface)', () => {
  test('the commands are /dungeon, and /dungeon-bench and /dungeon-frames for measuring', async ($, on) => {
    const names: string[] = []
    on('store.get', (_$, e) => ({ value: e.key === 'save' ? newGame() : undefined }) as never)
    on('store.set', () => ({ value: undefined }) as never)
    on('command.register', (_$, e) => {
      names.push((e as { name: string }).name)
      return { value: undefined } as never
    })
    on('ui.open', () => ({ value: { isPlaced: true } }) as never)
    on('ui.toast', () => ({ value: undefined }))
    on('session.start', (_$, e) => ({ cwd: e.cwd }))
    await $.session.start({ cwd: '/', surface: 'terminal', isInteractive: true } as never)
    expect(names.sort()).toEqual(['dungeon', 'dungeon-bench', 'dungeon-frames'])
  })
})
