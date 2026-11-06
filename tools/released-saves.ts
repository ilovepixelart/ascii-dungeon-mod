// Saves as released versions of the mod wrote them, for `hooks/released.test.ts` to load: each tag checked out into a
// scratch worktree, its own simulator playing each class STEPS steps from seed SEED, the final game stored the way that
// version stored it (as is before `savable` existed, through it after). Writes `hooks/released.ts`.
// Usage: bun tools/released-saves.ts <version>...   (e.g. 0.4.0 0.11.0)
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SEED = 7
const STEPS = 3000
const CLASSES = ['knight', 'mage', 'rogue'] as const
const root = join(import.meta.dir, '..')
const git = (...args: string[]) => {
  const r = Bun.spawnSync(['git', '-C', root, ...args])
  if (r.exitCode !== 0) throw new Error(`git ${args.join(' ')}: ${r.stderr.toString()}`)
}

const saves: Record<string, Record<string, unknown>> = {}
for (const version of process.argv.slice(2)) {
  const dir = mkdtempSync(join(tmpdir(), 'released-'))
  git('worktree', 'add', '--detach', dir, `ascii-dungeon--v${version}`)
  try {
    const { simulate } = await import(join(dir, 'hooks/sim.ts'))
    const { savable } = (await import(join(dir, 'hooks/save.ts'))) as { savable?: (g: unknown) => unknown }
    saves[version] = Object.fromEntries(CLASSES.map(cls => {
      const g = simulate(SEED, STEPS, cls).final
      return [cls, JSON.parse(JSON.stringify(savable === undefined ? g : savable(g)))]
    }))
  } finally {
    git('worktree', 'remove', '--force', dir)
    rmSync(dir, { recursive: true, force: true })
  }
}

const body = `// Written by tools/released-saves.ts: saves as released versions wrote them, each class after ${STEPS} simulated steps.
export const RELEASED_SAVES: Readonly<Record<string, Readonly<Record<'knight' | 'mage' | 'rogue', unknown>>>> = ${JSON.stringify(saves)}
`
writeFileSync(join(root, 'hooks/released.ts'), body)
console.log(`wrote hooks/released.ts: ${Object.keys(saves).join(', ')}`)
