import { describe, expect, test } from 'claude-code/testing'

import type { Game, Rarity, Work } from '../types'
import { apply } from './game'
import { foeAhead, plainHero } from './fixtures'
import { runsTests, workOf } from './work'

const RANK: readonly Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary']
const done = (g: Game, work?: Work) => apply(g, { kind: 'outcome', ok: true, what: 'Bash', ...(work === undefined ? {} : { work }) })
/** A hero on `depth` (deepest there too), hurt to 5 of 20 HP, no foe about. */
const hurtOn = (depth: number): Game => ({ ...plainHero(5), depth, deepest: depth, hp: 5 })
/** The hero struck dead by a rat that cannot miss, on the depth they stand on. */
const fall = (g: Game) => apply({ ...g, hp: 2, foe: foeAhead(g, 1, { glyph: 'r', opened: true, atk: 99 }) }, { kind: 'outcome', ok: false, what: 'Bash' })

describe('which commands run tests', () => {
  test('test runners, package scripts and build tools that test, behind settings, wrappers and other commands', async () => {
    const runs = ['bun test', 'npm test', 'npm run test', 'pnpm run test:unit', 'yarn test', 'cd app && pytest -q', 'uv run pytest tests/', 'python -m pytest', 'go test ./...', 'cargo test', 'make test', 'CI=1 npx vitest run', 'claude plugin test .', 'time jest --ci', 'npm run lint && npm test']
    expect(runs.filter(c => !runsTests(c))).toEqual([])
  })

  test('commands that only name tests do not', async () => {
    const others = ['git status', 'npm run lint', 'cat test.txt', 'ls test', 'echo npm test', 'grep -r test src', 'bun run build', 'npm install', 'python script.py test', 'claude plugin validate .', 'git commit -m "test"']
    expect(others.filter(runsTests)).toEqual([])
  })
})

describe('what a successful shell call came to', () => {
  test('a pull request opened or merged, a push, a new commit, as the host reports them', async () => {
    expect(workOf('gh pr create', { pr: { action: 'created' } })).toBe('pr')
    expect(workOf('gh pr merge 3', { pr: { action: 'merged' } })).toBe('pr')
    expect(workOf('git push', { push: { branch: 'main' } })).toBe('push')
    expect(workOf('git commit -m x', { commit: { kind: 'committed' } })).toBe('commit')
  })

  test('the greatest of several: a commit and its push are a push; a push that opens a pull request is the pull request', async () => {
    expect(workOf('git commit -m x && git push', { commit: { kind: 'committed' }, push: {} })).toBe('push')
    expect(workOf('git push && gh pr create', { push: {}, pr: { action: 'created' } })).toBe('pr')
  })

  test('an amend, a cherry-pick, a comment on a pull request and plain commands are nothing', async () => {
    expect(workOf('git commit --amend', { commit: { kind: 'amended' } })).toBeUndefined()
    expect(workOf('git cherry-pick abc', { commit: { kind: 'cherry-picked' } })).toBeUndefined()
    expect(workOf('gh pr comment 3', { pr: { action: 'commented' } })).toBeUndefined()
    expect(workOf('ls src', undefined)).toBeUndefined()
  })

  test('a test run is read from the command', async () => {
    expect(workOf('bun test', undefined)).toBe('tests')
  })
})

describe('tests that pass', () => {
  test('make the blow a sure critical', async () => {
    // A hero with Focus 1 crits 3 times in 100: over twelve worlds a plain blow misses a crit, a passing test run never does.
    const crits = (work?: Work) => [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(seed => {
      const g = plainHero(seed)
      return done({ ...g, foe: foeAhead(g, 1, { hp: 99, maxHp: 99, opened: true }) }, work).log.some(l => l.startsWith('You CRITICALLY hit'))
    })
    expect(crits().includes(false)).toBe(true)
    expect(crits('tests')).toEqual(crits('tests').map(() => true))
  })

  test('say so before the blow', async () => {
    const g = plainHero(2)
    const after = done({ ...g, foe: foeAhead(g, 1, { hp: 99, maxHp: 99, opened: true }) }, 'tests')
    const said = after.log.findIndex(l => l === 'The tests pass: your blow is sure.')
    expect(said).toBeGreaterThanOrEqual(0)
    expect(after.log[said + 1]).toMatch(/^You CRITICALLY hit the goblin of x for \d+\.$/)
  })
})

describe('a commit', () => {
  test('heals the hero to full and marks the depth: a fall deeper in its band wakes there', async () => {
    const after = done(hurtOn(13), 'commit')
    expect(after.hp).toBe(20)
    expect(after.waypoint).toBe(13)
    expect(after.log.at(-1)).toBe('You kneel at a shrine: your work is kept. Full HP; you will wake on depth 13.')
    expect(after.toast).toBe('Shrine: you will wake on depth 13.')
    expect(fall({ ...after, depth: 14, deepest: 14 }).depth).toBe(13)
    expect(fall({ ...after, depth: 14, deepest: 14 }).fallen?.wake).toBe(13)
  })

  test('without one, a fall wakes on the band\'s first depth', async () => {
    expect(fall({ ...hurtOn(14) }).depth).toBe(11)
  })

  test('marked in an earlier band, a fall wakes on its own band\'s first depth', async () => {
    expect(fall({ ...hurtOn(14), waypoint: 8 }).depth).toBe(11)
  })

  test('is rewarded once a depth: a second on the same depth heals nothing', async () => {
    const first = done(hurtOn(13), 'commit')
    const second = done({ ...first, hp: 5 }, 'commit')
    expect(second.hp).toBe(5)
    expect(done({ ...second, depth: 14, deepest: 14 }, 'commit').hp).toBe(20)
  })

  test('on a boss depth heals but marks nothing: no waking at a guardian\'s feet', async () => {
    const after = done({ ...hurtOn(15), waypoint: 12 }, 'commit')
    expect(after.hp).toBe(20)
    expect(after.waypoint).toBe(12)
    expect(after.log.at(-1)).toBe('You kneel at a shrine: your work is kept. Full HP.')
  })

  test('in town heals too, and marks the depth the portal leads back to', async () => {
    const town = apply(hurtOn(13), { kind: 'portal' })
    const after = done({ ...town, hp: 5 }, 'commit')
    expect(after.hp).toBe(20)
    expect(after.waypoint).toBe(13)
  })

  test('that failed is nothing', async () => {
    const after = apply(hurtOn(13), { kind: 'outcome', ok: false, what: 'Bash', work: 'commit' })
    expect(after.waypoint).toBeUndefined()
    expect(after.log.some(l => l.startsWith('You kneel at a shrine'))).toBe(false)
  })
})

describe('a push and a pull request', () => {
  const found = (g: Game, work: Work) => {
    const after = done(g, work)
    return after.bag.filter(i => !g.bag.some(b => b.id === i.id))
  }

  test('a push opens a cache: one item, Rare or better', async () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const got = found({ ...hurtOn(7), seed, world: seed }, 'push')
      expect(got.length).toBe(1)
      expect(RANK.indexOf(got[0]!.rarity)).toBeGreaterThanOrEqual(RANK.indexOf('rare'))
    }
  })

  test('a pull request opens a hoard: one item, Epic or better', async () => {
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const got = found({ ...hurtOn(7), seed, world: seed }, 'pr')
      expect(got.length).toBe(1)
      expect(RANK.indexOf(got[0]!.rarity)).toBeGreaterThanOrEqual(RANK.indexOf('epic'))
    }
  })

  test('each is rewarded once a depth, apart from the other', async () => {
    const pushed = done(hurtOn(7), 'push')
    expect(found(pushed, 'push')).toEqual([])
    expect(found(pushed, 'pr').length).toBe(1)
    expect(found({ ...pushed, depth: 8, deepest: 8 }, 'push').length).toBe(1)
  })

  test('say what opened', async () => {
    expect(done(hurtOn(7), 'push').log).toContain('Your work goes out, and a cache opens.')
    expect(done(hurtOn(7), 'pr').log).toContain('Your pull request opens a hoard.')
  })
})
