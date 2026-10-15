// What a tool call came to as work, when it came to something the game rewards: a test run that passed, a commit, a
// push, a pull request opened or merged. Git's own the host reports (`gitOperation` on a shell call's record); a test
// run is read from the command. Pure.
import type { Work } from '../types'

/** The git and GitHub work the host reports on a shell call's record, as far as the game reads it. */
export type GitOperation = { commit?: { kind: string }; push?: unknown; pr?: { action: string } }

/** Words that only run the command after them: `npx vitest`, `uv run pytest`, `python -m pytest`. */
const WRAPPERS = new Set(['npx', 'bunx', 'pnpx', 'exec', 'run', 'uv', 'poetry', 'pipenv', 'hatch', 'time', '-m', 'python', 'python3'])
/** Programs that are a test run whatever follows. */
const RUNNERS = new Set(['pytest', 'jest', 'vitest', 'mocha', 'rspec', 'phpunit', 'ava', 'tap'])
/** Programs whose `test` (or `run test`) is a test run. */
const TEST_VERBS = new Set(['npm', 'pnpm', 'yarn', 'bun', 'deno', 'go', 'cargo', 'dotnet', 'mix', 'make', 'gradle', 'mvn', 'swift'])

const basename = (word: string) => word.split('/').pop() ?? word

/** A command's words past any VAR=value settings, the program without its path. */
const wordsOf = (segment: string) => {
  const words = segment.trim().split(/\s+/).filter(w => w !== '')
  const from = words.findIndex(w => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(w))
  return from < 0 ? [] : [basename(words[from]!), ...words.slice(from + 1)]
}

/** Whether one simple command runs tests. */
const isTestRun = (segment: string) => {
  const words = wordsOf(segment)
  const at = words.findIndex(w => !WRAPPERS.has(w))
  const program = words[at]
  if (program === undefined) return false
  if (RUNNERS.has(program)) return true
  const rest = words.slice(at + 1).filter(w => w !== 'run')
  if (program === 'claude') return rest[0] === 'plugin' && rest[1] === 'test'
  return TEST_VERBS.has(program) && (rest[0] === 'test' || rest[0]?.startsWith('test:') === true)
}

/** Whether a shell command runs tests in any of its parts. */
export const runsTests = (command: string) => command.split(/&&|\|\||[;|\n]/).some(isTestRun)

/** What a successful shell call came to, the greatest first: a pull request, a push, a new commit, a test run; else nothing. */
export const workOf = (command: string, git: GitOperation | undefined): Work | undefined => {
  if (git?.pr?.action === 'created' || git?.pr?.action === 'merged') return 'pr'
  if (git?.push !== undefined) return 'push'
  if (git?.commit?.kind === 'committed') return 'commit'
  return runsTests(command) ? 'tests' : undefined
}
