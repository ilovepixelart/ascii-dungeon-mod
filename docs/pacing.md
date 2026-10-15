# Pacing

What keeps a session from being the same fight over and over, and how it is judged. `tools/feel.ts` measures it from simulated games, a class each: deaths and close calls per 100 tool calls, bosses won, notable moments per 100 calls, the longest stretch without one, foe kinds per depth, the share of calls spent below depths already reached. The numbers below are its, over 100 games a class of 1,000 steps (about 320 tool calls).

## Which foes

Any kind the depth has unlocked can come, the theme's favorites and the newest more often (see `items.md`, Finding things). A depth shows about 2.7 kinds of foe; picking by depth alone gave 1.5, and from depth 8 down only dragons.

## Tension, peaks and calms

`tension` (`Game`) builds with every blow the hero takes, its share of max HP in percent, and a little with each kill (`KILL_TENSION`). At `TENSION_PEAK` the next foe is a champion, announced ("The air grows heavy. Something strong is near.", and a toast); once it is down, the next `CALM_CALLS` summons bring no foe and each gives back a tenth of max HP (`CALM_HEAL`). A death clears both. The numbers are in `hooks/balance.ts`.

- The peak waits for a hero at `PEAK_HP` of max HP or more: tension is recent damage, so without the wait the champion came exactly when the hero was most hurt, and deaths nearly doubled.
- The calm is short on purpose: every summon it holds back is a kill not made, while the depth goes on growing at each task's end. A calm of 4 calls put the hero about a level behind and raised deaths by half.
- Peaks cost some lives, paid for by foes hitting 1.2 times their plain sum (`FOE_ATK_SCALE`) where without the director they hit 1.3 times.

## Depth twists

From depth 2, about 40 depths in 100 (boss depths aside) have a twist (`depthMod` in `hooks/game.ts`), drawn from the world and the depth so a depth keeps its own: Gloom (foes hit a fifth harder, kills pay half again the gold), Horde (foes a quarter more HP, kills half again the XP), Champions' den (one foe in four a champion), Barren (no potions drop, gear drops more often), Bloodlust (the hero and the foes both hit a quarter harder), Hoard (gold on the floor and in chests doubled, foes a sixth harder). It is said in full and toasted on arrival, by stairs or on waking after a death, and its mark stands after the depth on the strip's side line.

## Rooms

Besides the shrine, the library, the flooded halls' spring and the forge's anvil, any theme can have a vault (`themedThing` in `hooks/map.ts`): three gold piles across its middle, a trap each side of the middle one, for whoever clicks in.

## Uniques

See `items.md`, Finding things: a named monster a band of five depths, met about twice in 100 tool calls.

## Good loot

The 12th kill without a Rare or better leaves one (see `items.md`, Finding things), and a Rare or better from a kill rises as a beam where the foe fell.

## The nemesis

A champion that slays the hero becomes their nemesis (`remember` in `hooks/game.ts`): named ("Grak the Butcher", the title from its modifier), it waits 4 to 7 depths below where it won (`Game.nemesis`). On that depth or deeper the next foe is it, announced and toasted, a champion of its kind at the depth's strongest, a fifth stronger in HP and attack for each win (`NEMESIS_GROWTH`), with red pips and a red crown on the map. Winning again it gains a win and goes deeper still; slain, it leaves a trophy of Epic or better and is gone. One at a time: another champion's win makes none while one waits. Met about once in 210 tool calls; the death rate is where it was without it.

## Work

What a tool call came to, beyond succeeding, is rewarded (`workOf` in `hooks/work.ts`, `reward` in `hooks/game.ts`). Commits, pushes and pull requests are read from what the host reports on a shell call's record (`gitOperation`), never from the command, so a quiet `git commit -q`, which the host does not report, earns nothing. A test run is read from the command: a runner, or a build tool's `test`.

| Work | Reward | How often |
|---|---|---|
| Tests that pass | the blow is a sure critical | every run |
| A commit | a shrine: full HP, and the depth marked as the one to wake on after a fall deeper in its band; on a boss depth, the HP alone | once a depth |
| A push | a cache: an item, Rare or better | once a depth |
| A pull request opened or merged | a hoard: an item, Epic or better | once a depth |

Only real outcomes pay: an amend, a cherry-pick or a comment on a pull request does not, and a failure takes nothing away that it did not before. Once a depth keeps a run of commits from being a fountain of HP. Over 60 simulated games a class, with a commit in eleven shell calls, a push in twenty-two and a pull request in ninety: deaths per 1,000 steps 2.30, where they were 2.22. The shrine's HP alone brings them to 1.86; waking deeper brings them back, and the hero gets half a depth deeper. Rare or better is 37% of what drops, where it was 33%.

## Where it stands

| | Before | Now |
|---|---|---|
| Deaths per 100 tool calls | 0.16 to 0.21 | 0.70 to 0.80 |
| Longest wait in a game for a Rare or better, 9 games in 10 | 145 calls | 110 calls |
| Bosses won | 91 to 93% | 67 to 77% |
| Notable moments per 100 calls | 10 to 12 | 16 to 19 |
| Longest quiet stretch, median | 29 to 34 calls | 21 to 26 calls |
| Foe kinds per depth | 1.5 | 2.6 |
