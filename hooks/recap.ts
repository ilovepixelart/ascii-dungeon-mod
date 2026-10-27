// What happened while the player looked away: counted from the tool calls since their last click or key (`noted`), and
// shown on the next one once RECAP_CALLS calls have passed (`look`); `recapwindow.ts` draws it. Pure.
import type { Game, Item, Rarity, Recap, Work } from '../types'
import type { Action } from './game'
import { worth } from './items/stats'

/** Tool calls unseen before a look opens the recap; fewer are forgotten. */
export const RECAP_CALLS = 10

const RANK: readonly Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary']
const WORK_COUNT: Readonly<Record<Work, 'tests' | 'commits' | 'pushes' | 'prs'>> = { tests: 'tests', commit: 'commits', push: 'pushes', pr: 'prs' }

/** The better find: the rarer, or of one rarity the stronger; the one held when they are alike. */
const better = (held: Item | undefined, found: Item) => {
  if (held === undefined) return found
  const by = RANK.indexOf(found.rarity) - RANK.indexOf(held.rarity)
  return by > 0 || (by === 0 && worth(found) > worth(held)) ? found : held
}

/** A recap begun where the hero stands. */
export const begun = (g: Game): Recap => ({ calls: 0, depth: g.depth, level: g.level, kills: 0, champions: 0, gold: 0, deaths: 0, tests: 0, commits: 0, pushes: 0, prs: 0 })

/** The foe an action took `before` to `after` slew: gone with the hero standing and paid in XP; else undefined. */
export const slain = (before: Game, after: Game) =>
  after.deaths === before.deaths && before.foe !== null && after.foe === null && (after.xp !== before.xp || after.level !== before.level) ? before.foe : undefined

/** The recap after a tool-driven action took `before` to `after`: a call for each outcome, a foe slain, gold gained, a fall, work done, the best find. */
export const noted = (before: Game, after: Game, action: Action): Recap => {
  const r = before.recap ?? begun(before)
  const deaths = after.deaths - before.deaths
  const foe = slain(before, after)
  const isKill = foe !== undefined
  const work = action.kind === 'outcome' && action.ok ? action.work : undefined
  const best = after.bag.filter(i => RANK.indexOf(i.rarity) >= RANK.indexOf('rare') && !before.bag.some(b => b.id === i.id)).reduce(better, r.best)
  return {
    ...r,
    calls: r.calls + (action.kind === 'outcome' ? 1 : 0),
    kills: r.kills + (isKill ? 1 : 0),
    champions: r.champions + (foe?.champion !== undefined ? 1 : 0),
    gold: r.gold + Math.max(0, after.gold - before.gold),
    deaths: r.deaths + deaths,
    ...(work === undefined ? {} : { [WORK_COUNT[work]]: r[WORK_COUNT[work]] + 1 }),
    ...(best === undefined ? {} : { best }),
  }
}

/** A look at the pane: enough unseen opens the recap; under the death window it waits for the first look after it;
 * fewer unseen are forgotten. */
export const look = (g: Game) => {
  if (g.recap === undefined || g.recap.calls < RECAP_CALLS) delete g.recap
  else if (g.panel !== 'death') g.panel = 'recap'
}
