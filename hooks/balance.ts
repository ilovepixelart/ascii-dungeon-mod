// Every number that sets how hard the game is, in one place. Tune here, then judge it with tools/simulate.ts.
// Tuned against: about 3 hits a kill, a death every 150 to 200 tool calls, a close call (the hero under a quarter of
// max HP, and living) about every 100, and a boss won about two times in three, by the simulated player, who spends
// its points at random.

/**
 * How much of the plain sum a foe's HP is, which grows as depth does and no faster: with criticals at twice a blow and
 * Might a share of it, the hero's damage grows as the gear does, about as depth does. At the whole sum a kill took 4 to
 * 5 blows from depth 5 on; with half a percent more a depth past depth 10, as when Focus raised crit damage without
 * bound, a kill at depth 150 took 4.2 blows where one at depth 25 took 2.5 (`tools/curve.ts`).
 */
export const FOE_HP_SCALE = 0.8

/** A monster's hit points: its depth and its tier in the bestiary (0 rat .. 7 dragon), plus a d4. */
export const foeHp = (depth: number, tier: number, d4: number) => Math.round((6 + depth * 6 + tier * 2 + d4) * FOE_HP_SCALE)

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

/** The level a hero has at a depth, simulated: 3 and 0.4 a depth, from depth 10 to 250 within a level of the median. */
export const levelFor = (depth: number) => Math.round(3 + 0.4 * depth)

/**
 * The share of a kill's XP a hero takes, by how far its level is over the depth's (`levelFor`): whole up to XP_LEEWAY
 * over, then each level more a step down XP_FALLOFF, the last step for any more. A hero under the depth's level takes
 * it whole. A hero staying on shallow depths stops outgrowing them.
 */
export const XP_LEEWAY = 5
export const XP_FALLOFF = [0.81, 0.62, 0.43, 0.24, 0.05] as const
export const xpShare = (level: number, depth: number) => {
  const over = level - levelFor(depth) - XP_LEEWAY
  return over <= 0 ? 1 : XP_FALLOFF[Math.min(over, XP_FALLOFF.length) - 1]!
}

/** XP from one level to the next: grows faster than the kills do, so the hero levels a little behind depth. */
export const xpToLevel = (level: number) => Math.round(20 * level ** 1.5)

/**
 * The tool calls a depth must see before an answer takes its stairs. Every answer took them: over simulated sessions,
 * answers of 0 to 2 calls died 7.45 times in 100 calls, of 3 to 12 calls 0.51 times, of 15 to 44 calls 0.04 times. The
 * depth, not the talk, sets the pace.
 */
export const DESCEND_CALLS = 3

/** The tool calls in a row in town with no window open that take the hero back through the portal: a hero left in
 * town earned nothing from the work going on. */
export const TOWN_IDLE_CALLS = 5

/** Max HP gained per level. */
export const HP_PER_LEVEL = 5

/**
 * A kill's healing potion chance is this share of `potionChance`. At the full chance three healing finds in four went
 * to waste. Simulated (80 games a class, 3,000 steps), deaths per 1,000 steps are 1.46 at the full chance and 1.55 at
 * half, the hero buying, gathering and using the rest of the belt more; at 15% they rose to 1.81. At a quarter, with a
 * guardian's Greater Health Potion in place of its Elixir (30 games a class, 6,000 steps): 1.31, where half and the
 * Elixir gave 1.19, and the merchant sells 1.2 potions a game, where it sold 0.7.
 */
export const HEALING_DROP_SHARE = 0.25

/**
 * What Might and Focus give, from their points: STAT_MAX of them over them plus STAT_HALF, so the first points give
 * about 3 in 100 each and 20 points half the most. Might's share lifts every blow; Focus's is crit chance, and adds to
 * a critical's times. Focus raised crit damage 5 in 100 a point with no bound: a hero spending on it alone hit deep
 * foes for about 8 times an even blow, and slew them in 1.6 blows where others took 2.5. With criticals at a plain
 * twice a blow, a knight or rogue spending on it alone died two to three times as often as one on Might: the rogue's
 * ambush is a sure critical whatever its chance (`tools/curve.ts`).
 */
export const STAT_MAX = 0.6
export const STAT_HALF = 20
export const statShare = (points: number) => (STAT_MAX * points) / (points + STAT_HALF)

/** A critical blow's times, Triple Crit's aside, before Focus's share. */
export const CRIT_TIMES = 2

/** The hero's base damage before Might, crits and fury: half the level, a d4, and the gear's attack. */
export const heroDamage = (level: number, d4: number, attackBonus: number) => 1 + Math.floor(level / 2) + d4 + attackBonus

/** By hand, the percent chance a tile walked meets a foe, and the most a walk can: about a foe every few tiles, as the
 * session's tool calls bring one in two calls, each exploring a few tiles. */
export const HAND_FOE_TILE = 15
export const HAND_FOE_MAX = 60

/** The least share of a blow armor lets through: deep heroes stack defense past what foes hit for. */
export const ARMOR_FLOOR = 0.25

/** Armor's measure at a depth, per depth plus ARMOR_FROM: defense of this much halves a blow there. */
export const ARMOR_PER_DEPTH = 0.9
export const ARMOR_FROM = 10

/**
 * The share of a blow that defense `def` lets through at `depth`: K / (K + def), K being ARMOR_PER_DEPTH of the depth
 * plus ARMOR_FROM, never under ARMOR_FLOOR. A share and not a sum taken off: the hero's defense and the foes' attack
 * both grow with depth, and their difference drifted, every blow at the floor or armor worth nothing.
 */
export const armorShare = (def: number, depth: number) => {
  const k = ARMOR_PER_DEPTH * (depth + ARMOR_FROM)
  return Math.max(ARMOR_FLOOR, k / (k + def))
}

/** The share of defense a piercing blow leaves standing, rounded down. */
export const PIERCED_DEF = 0.5
