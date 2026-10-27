// Every number that sets how hard the game is, in one place. Tune here, then judge it with tools/simulate.ts.
// Tuned against: about 3 hits a kill, a death every 150 to 200 tool calls, a close call (the hero under a quarter of
// max HP, and living) about every 100, and a boss won about two times in three, by the simulated player, who spends
// its points at random.

/** A monster's hit points: its depth and its tier in the bestiary (0 rat .. 7 dragon), plus a d4. */
export const foeHp = (depth: number, tier: number, d4: number) => 6 + depth * 6 + tier * 2 + d4

/** How much harder than the plain sum foes hit: at 1 the hero died about once in 550 tool calls. */
export const FOE_ATK_SCALE = 1.2

/** A monster's attack: mostly depth, a little tier, and a swing of 3 or 5 so some monsters hit hard. */
export const foeAtk = (depth: number, tier: number, d2: number) => Math.round((depth + Math.floor(tier / 2) + d2 * 2 + 1) * FOE_ATK_SCALE)

/**
 * The pacing: tension builds with every blow the hero takes (its share of max HP, in percent) and KILL_TENSION a
 * kill; at TENSION_PEAK the next foe is a champion (once the hero has PEAK_HP of max HP; a peak never meets a hero
 * already beaten down), and once it is down the next CALM_CALLS summons bring none. A longer calm costs the hero kills,
 * and so levels, while the depth goes on growing: at 4 calls deaths rose by half.
 */
export const TENSION_PEAK = 100
export const KILL_TENSION = 4
export const CALM_CALLS = 2
export const PEAK_HP = 0.6
/** What each summon of a calm gives back, as a share of max HP: the hero catches their breath. */
export const CALM_HEAL = 0.1

/** XP for killing a monster. */
export const foeXp = (depth: number, tier: number) => 4 + tier * 3 + depth

/** XP from one level to the next: grows faster than the kills do, so the hero levels a little behind depth. */
export const xpToLevel = (level: number) => Math.round(20 * level ** 1.5)

/** Max HP gained per level. */
export const HP_PER_LEVEL = 5

/**
 * A kill's healing potion chance is this share of `potionChance`. At the full chance three healing finds in four went
 * to waste. Simulated (80 games a class, 3,000 steps), deaths per 1,000 steps are 1.46 at the full chance and 1.55 at
 * half, the hero buying, gathering and using the rest of the belt more; at 15% they rose to 1.81.
 */
export const HEALING_DROP_SHARE = 0.5

/** The hero's base damage before crits and fury: half the level, a d4, and the attack bonus from Might and gear. */
export const heroDamage = (level: number, d4: number, attackBonus: number) => 1 + Math.floor(level / 2) + d4 + attackBonus

/** By hand, the percent chance a tile walked meets a foe, and the most a walk can: about a foe every few tiles, as the
 * session's tool calls bring one in two calls, each exploring a few tiles. */
export const HAND_FOE_TILE = 15
export const HAND_FOE_MAX = 60
