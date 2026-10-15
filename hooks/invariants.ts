// Rules every game state must keep, whatever happened: the simulator checks them after every step.
// Each returns a sentence naming what broke, or nothing.
import type { Game } from '../types'
import { BELT_SIZE, KINDS, STACK_MAX, countOf } from './consumables'
import { BAG_H, BAG_W, RARE_KILLS, SLOTS, TEMPER_MAX, itemAt } from './items'
import { MAP_H, MAP_W, cellId, isFloor, same } from './map'
import { isTownWalkable } from './town'
import { LOOP_KILLS, STASH_SIZE, isBossDepth } from './game'
import { CALM_CALLS } from './balance'
import { levelOf } from './world'

type Rule = (g: Game) => string | undefined

const RULES: Readonly<Record<string, Rule>> = {
  'hero on floor': g => ((g.where === 'town' ? isTownWalkable(g) : isFloor(levelOf(g).tiles, g)) ? undefined : `hero at ${g.x},${g.y} in the ${g.where} stands on no open ground`),
  'hero cell seen': g => (g.where === 'town' || g.seen[cellId(g)] === '1' ? undefined : `hero cell ${g.x},${g.y} is unseen`),
  'town has no foe': g => (g.where === 'town' && g.foe !== null ? `the ${g.foe.name} followed the hero into town` : undefined),
  'portal only in town': g => ((g.where === 'town') === (g.portal !== null) ? undefined : `in the ${g.where} with the portal ${g.portal === null ? 'shut' : 'open'}`),
  'portal on floor': g => (g.portal === null || isFloor(levelOf(g).tiles, g.portal) ? undefined : `the portal leads back to rock at ${g.portal.x},${g.portal.y}`),
  'hero not on foe': g => (g.foe !== null && same(g, g.foe) ? `hero shares ${g.x},${g.y} with the ${g.foe.name}` : undefined),
  'foe on floor': g => (g.foe === null || isFloor(levelOf(g).tiles, g.foe) ? undefined : `foe at ${g.foe.x},${g.foe.y} is on rock`),
  'foe off the stairs': g => (g.foe !== null && same(g.foe, levelOf(g).stairs) ? `the ${g.foe.name} stands on the stairs` : undefined),
  'shield only on a shielded champion': g => {
    const foe = g.foe
    if (foe?.shield === undefined) return undefined
    // The Bone King and the Frost Lich ward themselves as a shielded champion does.
    const wards = foe.champion === 'shielded' || foe.big === 'king' || foe.big === 'lich'
    return wards && foe.shield >= 0 && foe.shield <= 1 ? undefined : `the ${foe.name} holds ${foe.shield} shield as a ${foe.champion ?? 'plain foe'}`
  },
  'temper within 0 to 3': g => {
    const off = [...SLOTS.map(s => g.gear[s]), ...g.bag].find(item => item?.temper !== undefined && !(Number.isInteger(item.temper) && item.temper >= 0 && item.temper <= TEMPER_MAX))
    return off === undefined ? undefined : `${off.name} tempered ${off.temper} times`
  },
  'boss only on a boss depth': g => (g.foe?.boss === true && !isBossDepth(g.depth) ? `the ${g.foe.name} guards depth ${g.depth}` : undefined),
  'boss slain on a boss depth reached': g => (g.bossSlain === 0 || (isBossDepth(g.bossSlain) && g.bossSlain <= g.deepest) ? undefined : `boss of depth ${g.bossSlain} slain, deepest ${g.deepest}`),
  'opening only by a class that has one': g => (g.foe?.opened === true && g.cls !== 'knight' && g.cls !== 'rogue' ? `the ${g.foe.name} met a ${g.cls}'s opening` : undefined),
  'quest within its count': g => {
    const q = g.quest
    return q === null || (q.need >= 1 && q.have >= 0 && q.have <= q.need && q.depth >= 1) ? undefined : `quest ${q.kind}: ${q.have} of ${q.need} on depth ${q.depth}`
  },
  // What the healer mended is told during the visit: max HP can fall after it (gear taken off), so it is not held to it.
  'mended only during a town visit': g => (Number.isInteger(g.mended) && g.mended >= 0 && (g.where === 'town' || g.mended === 0) ? undefined : `the healer mended ${g.mended} HP, seen in the ${g.where}`),
  'rare pity within its cap': g => (Number.isInteger(g.sinceRare) && g.sinceRare >= 0 && g.sinceRare < RARE_KILLS ? undefined : `${g.sinceRare} kills since a Rare, the cap ${RARE_KILLS}`),
  'nemesis waits below the first depth, won at least once': g => {
    const n = g.nemesis
    return n === null || (n.depth >= 2 && Number.isInteger(n.wins) && n.wins >= 1 && n.given !== '') ? undefined : `nemesis ${n.given} on depth ${n.depth} with ${n.wins} wins`
  },
  'a foe is the nemesis only while there is one': g => (g.foe?.nemesis === true && g.nemesis === null ? `the ${g.foe.name} fights as a nemesis there is none of` : undefined),
  'what was sold is out of the bag, its gold a count': g => {
    const sold = g.lastSold
    if (sold === null) return undefined
    const back = sold.items.find(i => g.bag.some(b => b.id === i.id))
    return back !== undefined ? `the ${back.name} is both sold and in the bag` : Number.isInteger(sold.coins) && sold.coins >= 0 ? undefined : `a sale of ${sold.coins} gold`
  },
  'a reforge to take back only in town': g => (g.reforgedFrom !== null && g.where !== 'town' ? `the ${g.reforgedFrom.item.name}'s reforge still open in the dungeon` : undefined),
  'nothing both locked and junk': g => {
    const both = [...g.bag, ...g.stashed, ...SLOTS.flatMap(s => (g.gear[s] === undefined ? [] : [g.gear[s]!]))].find(i => i.locked === true && i.junk === true)
    return both === undefined ? undefined : `the ${both.name} is locked and junk`
  },
  'uniques slain in bands reached': g => {
    const off = g.uniquesSlain.find(b => !Number.isInteger(b) || b < 0 || b > Math.floor((g.deepest - 1) / 5))
    return off === undefined ? undefined : `a unique slain in band ${off}, deepest ${g.deepest}`
  },
  'waypoint on a depth reached, never a boss depth': g => (g.waypoint === undefined || (Number.isInteger(g.waypoint) && g.waypoint >= 1 && g.waypoint <= g.deepest && !isBossDepth(g.waypoint)) ? undefined : `waypoint on depth ${g.waypoint}, deepest ${g.deepest}`),
  'loop count within its round': g => (g.looped === undefined || (Number.isInteger(g.looped) && g.looped >= 0 && g.looped < LOOP_KILLS) ? undefined : `${g.looped} kills toward the loop's heal`),
  'recap counts whole, from a depth reached': g => {
    const r = g.recap
    if (r === undefined) return undefined
    const counts = [r.calls, r.kills, r.champions, r.gold, r.deaths, r.tests, r.commits, r.pushes, r.prs]
    if (!counts.every(n => Number.isInteger(n) && n >= 0) || r.champions > r.kills) return `recap counts ${counts.join(', ')}`
    return r.depth >= 1 && r.depth <= g.deepest && r.level >= 1 && r.level <= g.level ? undefined : `recap from depth ${r.depth}, level ${r.level}`
  },
  'tension a count': g => (Number.isInteger(g.tension) && g.tension >= 0 ? undefined : `tension ${g.tension}`),
  'calm within its length': g => (Number.isInteger(g.calm) && g.calm >= 0 && g.calm <= CALM_CALLS ? undefined : `a calm of ${g.calm} summons, at most ${CALM_CALLS}`),
  'petted a count': g => (Number.isInteger(g.petted) && g.petted >= 0 ? undefined : `the dog petted ${g.petted} times`),
  'fortune only on its depth': g => (g.fortune === null || g.fortune.depth === g.depth ? undefined : `a fortune of depth ${g.fortune.depth} on depth ${g.depth}`),
  'foe traits in order': g => {
    const foe = g.foe
    if (foe === null) return undefined
    if (foe.turn !== undefined && !(Number.isInteger(foe.turn) && foe.turn >= 0)) return `the ${foe.name} is on turn ${foe.turn}`
    if (foe.used !== undefined && foe.glyph !== 'k') return `the ${foe.name} spent a kobold's brew`
    if (foe.stolen !== undefined && (foe.glyph !== 'g' || foe.stolen < 0)) return `the ${foe.name} holds ${foe.stolen} stolen gold`
    return undefined
  },
  'foe alive': g => (g.foe === null || g.foe.hp > 0 ? undefined : `the ${g.foe.name} has ${g.foe.hp} HP but is still there`),
  'hp within max': g => (g.hp <= g.maxHp ? undefined : `HP ${g.hp} above max ${g.maxHp}`),
  'hp positive': g => (g.hp > 0 ? undefined : `HP ${g.hp} and the hero did not die`),
  'gold not negative': g => (g.gold >= 0 ? undefined : `gold ${g.gold}`),
  'map size': g => (g.seen.length === MAP_W * MAP_H ? undefined : `seen has ${g.seen.length} cells`),
  'bag inside grid': g => g.bag.map(i => (i.x < 0 || i.y < 0 || i.x + i.w > BAG_W || i.y + i.h > BAG_H ? `${i.name} at ${i.x},${i.y} (${i.w}x${i.h}) leaves the bag` : undefined)).find(Boolean),
  'bag no overlap': g => {
    for (const item of g.bag) {
      for (let dx = 0; dx < item.w; dx += 1) {
        for (let dy = 0; dy < item.h; dy += 1) {
          const there = itemAt(g.bag.filter(o => o.id !== item.id), item.x + dx, item.y + dy)
          if (there !== undefined) return `${item.name} overlaps ${there.name} at ${item.x + dx},${item.y + dy}`
        }
      }
    }
    return undefined
  },
  'stash within its size': g => (g.stashed.length <= STASH_SIZE ? undefined : `${g.stashed.length} items in a stash of ${STASH_SIZE}`),
  'unique item ids': g => {
    const ids = [...g.bag, ...g.stashed, ...Object.values(g.gear)].flatMap(i => (i === undefined ? [] : [i.id]))
    return new Set(ids).size === ids.length ? undefined : `item ids repeat: ${ids.join(',')}`
  },
  'gear in its slot': g => (Object.entries(g.gear).map(([slot, i]) => (i !== undefined && i.slot !== slot ? `${i.name} (${i.slot}) worn as ${slot}` : undefined)).find(Boolean)),
  'cursor on a bag item': g => (g.cursor === null || g.bag.some(i => i.id === g.cursor) ? undefined : `cursor ${g.cursor} names no bag item`),
  'belt size': g => (g.belt.length === BELT_SIZE ? undefined : `belt has ${g.belt.length} slots`),
  'belt stacks': g => g.belt.map((s, i) => (s !== null && (countOf(s) < 1 || s.tiers.some(n => !Number.isInteger(n) || n < 0 || n > STACK_MAX)) ? `belt slot ${i + 1} holds ${s.tiers.join('/')}` : undefined)).find(Boolean),
  'a chosen tier is held': g => g.belt.map((s, i) => (s !== null && s.chosen !== undefined && (s.tiers[s.chosen - 1] ?? 0) === 0 ? `belt slot ${i + 1} chose tier ${s.chosen}, holding none` : undefined)).find(Boolean),
  'belt kinds in their slots': g => g.belt.map((s, i) => (s !== null && s.kind !== KINDS[i] ? `belt slot ${i + 1} holds ${s.kind}` : undefined)).find(Boolean),
  'log length': g => (g.log.length <= 5 ? undefined : `log holds ${g.log.length} lines`),
}

/** Every rule the state breaks, as "rule: what broke". */
export const violations = (g: Game): string[] =>
  Object.entries(RULES).flatMap(([name, rule]) => {
    const broke = rule(g)
    return broke === undefined ? [] : [`${name}: ${broke}`]
  })
