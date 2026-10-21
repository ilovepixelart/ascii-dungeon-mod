import { describe, expect, test } from 'claude-code/testing'

import type { On, PromptSubmitInput } from 'claude-code'
import type { Game } from '../types'
import { savable } from './save'
import { newGame } from './game'

/** The store as a map the test reads, what the mod saves landing in it; and the engine beneath a prompt. */
const storeIn = (on: On) => {
  const kept = new Map<string, unknown>()
  on('store.get', (_$, e) => ({ value: kept.get(e.key) }) as never)
  on('store.set', (_$, e) => {
    kept.set(e.key, e.value)
    return { value: undefined } as never
  })
  // The engine's own part of a prompt, beneath the mod's hook.
  on('prompt.submit', (_$, e) => ({ text: e.text }) as never)
  return kept
}
/** A prompt typed at the composer, not waiting on a turn. */
const typed = (over: Partial<PromptSubmitInput> & { text: string }): PromptSubmitInput => ({ wait: false, origin: { kind: 'composer' }, ...over })
const savedLog = (kept: Map<string, unknown>) => (kept.get('save') as Game | undefined)?.log ?? []

describe('a prompt as a quest', () => {
  test('a prompt is a quest, said; its words are never written to the save', async ($, on) => {
    const kept = storeIn(on)
    await $.prompt.submit(typed({ text: 'deploy with token ghp_SECRET123 now please' }))
    expect(JSON.stringify(kept.get('save'))).not.toContain('ghp_SECRET123')
    expect(savedLog(kept).at(-1)).toBe('A new quest.')
  })

  test('a slash command and a prompt the person does not see as typed are no quest', async ($, on) => {
    const kept = storeIn(on)
    await $.prompt.submit(typed({ text: '/dungeon', command: { name: 'dungeon', args: '' } }))
    await $.prompt.submit(typed({ text: 'a reminder the engine adds', isMeta: true }))
    await $.prompt.submit(typed({ text: 'fix the build' }))
    expect(savedLog(kept).filter(l => l.startsWith('A new quest'))).toEqual(['A new quest.'])
  })

  test('only what a person typed is a quest: at the prompt or through Remote Control, not a notification, a schedule, another session or the SDK', async ($, on) => {
    const kept = storeIn(on)
    for (const kind of ['task-notification', 'scheduled-trigger', 'peer', 'sdk'] as const) await $.prompt.submit(typed({ text: `from ${kind}`, origin: { kind } }))
    await $.prompt.submit(typed({ text: 'from a channel', origin: { kind: 'channel', server: 'slack' } }))
    expect(savedLog(kept).filter(l => l.startsWith('A new quest'))).toEqual([])
    await $.prompt.submit(typed({ text: 'typed at the prompt' }))
    await $.prompt.submit(typed({ text: 'typed on a phone', origin: { kind: 'bridge' } }))
    expect(savedLog(kept).filter(l => l.startsWith('A new quest'))).toEqual(['A new quest.', 'A new quest.'])
  })
})

test('the save holds a quest without its words, a repeat counted, every other line as it was', async () => {
  const g = { ...newGame(), log: ['You enter depth 1.', 'A new quest: "fix the build"', 'A new quest: "say "hi""', 'A new quest: "go" (x3)', 'Loot: a quest: "x".'] }
  expect(savable(g).log).toEqual(['You enter depth 1.', 'A new quest.', 'A new quest.', 'A new quest. (x3)', 'Loot: a quest: "x".'])
  const plain = { ...newGame(), log: ['You enter depth 1.'] }
  expect(savable(plain)).toBe(plain)
})
