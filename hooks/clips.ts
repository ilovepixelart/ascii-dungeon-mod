// Written by tools/sounds.py with the clips in sounds/: run it again after changing a sound.
/** Each effect's length in milliseconds. */
export const CLIP_MS = {
  hit: 120,
  crit: 150,
  kill: 190,
  hurt: 140,
  coin: 170,
  chest: 280,
  portal: 460,
  step1: 45,
  step2: 45,
  level: 460,
  loot: 410,
  nemesis: 600,
  peak: 500,
  calm: 420,
} as const
/** Each clip's loudest sample, from 0 to 1. */
export const CLIP_PEAK = {
  hit: 0.265,
  crit: 0.327,
  kill: 0.332,
  hurt: 0.287,
  coin: 0.237,
  chest: 0.363,
  portal: 0.334,
  step1: 0.098,
  step2: 0.098,
  level: 0.292,
  loot: 0.296,
  nemesis: 0.296,
  peak: 0.312,
  calm: 0.196,
  town: 0.426,
} as const
