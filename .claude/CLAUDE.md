# ascii-dungeon

A Claude Code mod: coding activity drives a roguelike drawn in a pane. Hooks in `hooks/register.tsx`; rules in `hooks/game.ts`; art in `hooks/pixelart.ts`.

## Visual changes go through the mock workbench first (mandatory)

No sprite, tile, palette, lighting or layout change reaches the game code until it has passed a mock round and the person has approved it.

1. Copy `hooks/pixelart.ts` to a draft in a fresh `r<N>` folder in the scratchpad and edit only the draft. The live game hot-reloads `hooks/pixelart.ts`, so editing it directly ships the change before anyone approved it.
2. Render the draft: `bun tools/mock.ts <out-dir> <draft-file>` (without a draft file it renders the live art). It writes `cast.png`, `cast.ans`, `scene.png`, `scene.ans`.
3. Review `cast.png` and `scene.png` yourself with the Read tool before showing anything. The cast sheet has four rows; check each:
   - torchlit: does each sprite read as what it is?
   - in shadow: does it still read at the edge of the light?
   - silhouette: is the shape recognizable as solid black, and distinct from every other sprite?
   - sensed: does it still read as a flat purple shape out of sight?
   Then the scene: floor not competing with sprites, light pool visible, walls and stairs legible.
4. Write down what fails, fix it, render the next round. Repeat until the review finds nothing.
5. Show the person the round: the `! cat <out-dir>/cast.ans` and `! cat <out-dir>/scene.ans` lines (exactly what the terminal pane draws) and the critique per sprite.
6. Only after the person approves: copy the draft over `hooks/pixelart.ts`, run the gates, and render the live art once more to confirm it matches the approved round.

`hooks/pixelart.test.ts` pins what the review established: PX by PX sprites, palette-only colors, every monster silhouette at least 10 pixels from every other.

## Design references

Research other games freely for design decisions, but the mod's docs, comments, tests and commit messages never name them. State the decision as a principle in this project's own terms ("numbers rise a tile and fade", not "like game X").

## Rule changes go through the simulator

Any change to game rules (movement, combat, spawning, loot, items, consumables) is judged by playing it, not only by unit tests.

1. Run `bun tools/simulate.ts <out-dir> --games 20 --steps 1000` before and after the change. It plays games for every class through the real `apply`, checks every rule in `hooks/invariants.ts` after every step, and prints balance numbers (deaths, potions, hits and damage per kill, loot shares, depth and level).
2. Any broken rule comes with a replay command; `--replay class:seed:step` prints the steps up to it and writes a picture of the board. Look at the picture.
3. Compare the balance numbers before and after, and say what moved and why.
4. A new kind of state gets a rule in `hooks/invariants.ts`, tested both ways in `hooks/invariants.test.ts` (quiet on legitimate states, speaking up on a broken one).

## Gates

`node scripts/gates.mjs` runs every gate CI runs, in its order: the release check, `claude plugin validate --strict .`, `claude plugin test .` and the typecheck. All must pass.
