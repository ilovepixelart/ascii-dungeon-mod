export type Foe = {
  glyph: string
  name: string
  hp: number
  maxHp: number
  atk: number
  xp: number
  x: number
  y: number
  /** A champion's one modifier; absent on an ordinary foe. */
  champion?: ChampionMod
  /** Blows a shielded champion still turns aside. */
  shield?: number
  /** The guardian of a boss depth's stairs. */
  boss?: true
  /** The hero's class has played its opening against it: the knight's block or the rogue's ambush. */
  opened?: true
  /** Its turns so far this fight, for the traits that come round every few. */
  turn?: number
  /** A once-a-fight trait spent: the kobold's brew. */
  used?: true
  /** Gold a goblin took from the hero, given back when it falls. */
  stolen?: number
  /** The hero's nemesis, come for them. */
  nemesis?: true
  /** One of the named uniques, by key: a theme's own monster with its own trick. */
  unique?: 'bones' | 'mire' | 'rot' | 'rime' | 'ember'
  /** A big boss, by key: every tenth depth's guardian, its theme's own, twice a foe's size, with its own moves. */
  big?: 'king' | 'queen' | 'hive' | 'lich' | 'wyrm'
  /** A big boss at half its HP or less: its second phase, entered once. */
  phase?: 2
  /** Old Bones has pulled itself back together, as it does once. */
  risen?: true
}

/** A fall: what struck the last blow (`by`, as the log says it, and the foe as it stood; no foe for a trap), where the hero stood on which depth, the gold lost and the depth woken on. */
export type Fallen = { by: string; foe?: Foe; at: { x: number; y: number }; depth: number; wake: number; lost: number }

/** A champion that slew the hero, named, waiting on a depth below: there it comes for them again. */
export type Nemesis = { given: string; kind: string; glyph: string; mod: ChampionMod; depth: number; wins: number }

/** The elder's errand: `have` of `need` done on depth `depth` or deeper (for a descend quest, 1 once it is reached). */
export type Quest = { kind: 'slay' | 'champion' | 'depth'; depth: number; need: number; have: number }

/** The mystic's blessing, good while the hero stays on `depth`. */
export type Fortune = { kind: 'luck' | 'riches' | 'insight'; depth: number }

/** What tool calls did while the player looked away: counted from `depth` and `level`, the best find Rare or better. */
export type Recap = { calls: number; depth: number; level: number; kills: number; champions: number; gold: number; deaths: number; tests: number; commits: number; pushes: number; prs: number; best?: Item }

/** What the hero does on their own: drink a healing potion under `drink` percent of max HP (0, never); throw a smoke bomb when low with no healing left; leave a kill's items below `leave` on the floor. */
export type Orders = { drink: 0 | 25 | 50; smoke: boolean; leave: Rarity }

/** What every hero of this save has done, kept through a new game: the uniques and big bosses slain and the Legendaries found, by key and name, the records, and the heroes retired (absent, none). */
export type Codex = { uniques: NonNullable<Foe['unique']>[]; bigs: NonNullable<Foe['big']>[]; legendaries: string[]; deepest: number; level: number; kills: number; bosses: number; deaths: number; gold: number; retired?: number }

/** Work a tool call came to that the game rewards: tests that passed, a commit, a push, a pull request opened or merged. */
export type Work = 'tests' | 'commit' | 'push' | 'pr'

export type ChampionMod = 'tough' | 'savage' | 'shielded' | 'vampiric'

export type Slot = 'weapon' | 'offhand' | 'helm' | 'armor' | 'boots' | 'ring' | 'amulet'

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary'

export type HeroClass = 'knight' | 'mage' | 'rogue'

export type Item = {
  id: number
  /** The item's base, which is also its icon: 'sword', 'kite', 'robe', ... */
  base: string
  name: string
  rarity: Rarity
  slot: Slot
  w: number
  h: number
  atk: number
  def: number
  hp: number
  /** Percentage points of critical chance. */
  crit: number
  /** Percent more XP from kills. */
  xp: number
  /** The class that can wear it; absent, any class. */
  cls?: HeroClass
  /** A Legendary's fixed power, by key. */
  power?: string
  junk?: boolean
  /** Kept whatever happens: not sold, marked as junk or destroyed until unlocked. */
  locked?: true
  /** Times the smith has tempered it, each +1 to its main stat, already counted in `atk` or `def`; absent, never. */
  temper?: number
  /** Top-left cell in the bag; meaningless while equipped. */
  x: number
  y: number
}

export type Attribute = 'might' | 'focus' | 'vigor' | 'insight'

/** What is open over the map; 'start' is the start screen, where the dungeon waits. */
export type Panel = 'none' | 'start' | 'death' | 'recap' | 'settings' | 'bag' | 'sheet' | 'codex' | 'retire' | 'shop' | 'forge' | 'stash' | 'healer' | 'elder' | 'mystic' | 'guard' | 'villager' | 'dog'

/** The five kinds of consumable, a belt slot each, each in three tiers. */
export type Consumable = 'health' | 'regen' | 'fury' | 'ward' | 'smoke'

/** A belt slot's kind and how many of each tier it holds, I to III. */
/** A belt slot: its kind, how many of each tier, and the tier chosen to use first, while the slot holds one. */
export type BeltSlot = { kind: Consumable; tiers: [number, number, number]; chosen?: 1 | 2 | 3 }

export type Game = {
  /** The save format: 2 since pixel art became the default view. A save without it predates that. */
  version: number
  seed: number
  /** Fixed at a new game: with `depth` it picks the map, so a level redraws the same. */
  world: number
  depth: number
  x: number
  y: number
  /** One '0' or '1' per map cell, row by row: what the hero has seen on this depth. */
  seen: string
  /** Cell ids on this depth whose gold, potion or trap is used up. */
  taken: number[]
  /** The tiles the last action stepped through, in order: what the pane animates. */
  walked: { x: number; y: number }[]
  hp: number
  maxHp: number
  level: number
  xp: number
  gold: number
  cls: HeroClass
  /** Five belt slots, keys 1 to 5. */
  belt: (BeltSlot | null)[]
  /** Turns or hits left on each running effect. */
  effects: { regen: number; fury: number; ward: number }
  /** The next kill's chance in percent to drop a health potion. */
  potionChance: number
  /** Kills since the last Epic or better dropped. */
  dryKills: number
  /** Kills since the last Rare or better dropped: the RARE_KILLS-th kill leaves one, whatever it would have left. */
  sinceRare: number
  /** Reforges the smith has done: each makes the next dearer. */
  reforges: number
  /** The deepest boss depth whose guardian is slain; 0 before the first. */
  bossSlain: number
  /** Items kept in the town stash, at most STASH_SIZE; their bag places mean nothing there. */
  stashed: Item[]
  /** The elder's quest in hand; null before one is taken and after it is paid. */
  quest: Quest | null
  /** Quests the elder has paid for. */
  questsDone: number
  /** The mystic's fortune in force; null when none, or once the hero changes depth. */
  fortune: Fortune | null
  deepest: number
  /** The depth a commit marked: a fall on it or deeper in its band wakes there. Absent before the first, never a boss depth. */
  waypoint?: number
  /** Kills toward the Band of the Endless Loop's heal, 0 to 4; absent, none. */
  looped?: number
  /** The Whisper of the Linter's last blow was a critical: the next is one too. */
  chain?: true
  /** The hero's standing orders; absent, the defaults (`DEFAULT_ORDERS`). */
  orders?: Orders
  /** What the tool calls since the player's last click or key came to; absent when none have. */
  recap?: Recap
  /** The worn piece the last hero to retire passed down, at depth 1 strength: every new hero starts with it. Absent before the first retirement. */
  heirloom?: Item
  /** What every hero of this save has done; absent until the first action after a load, then begun from the game (`firstCodex`). */
  codex?: Codex
  /** The depth each once-a-depth reward for work was last given on. */
  boons?: Partial<Record<Exclude<Work, 'tests'>, number>>
  deaths: number
  /** How the hero last fell, for the death window; absent before the first death. */
  fallen?: Fallen
  /** HP the healer restored on this town visit: 0 when the hero came in unhurt, and back to 0 on leaving town. */
  mended: number
  /** Times the town dog has been petted. */
  petted: number
  /** How hard the fighting has pressed lately: each blow taken adds its share of max HP in percent, each kill a little. */
  tension: number
  /** Foes the dungeon holds back after a peak: the calm's summons left. */
  calm: number
  /** The bands of five depths whose unique has been slain: the band's index, depth 1 to 5 the first. */
  uniquesSlain: number[]
  /** The champion that slew the hero, waiting deeper; null when there is none, or once it is slain. */
  nemesis: Nemesis | null
  /** The last sale, to buy back at what it fetched: one item, or a sale of junk's every item; gone on the next sale, a change of depth or the portal. */
  lastSold: { items: Item[]; coins: number } | null
  /** The piece as it was before the smith's last reforge, to keep instead: gone with the next job or on leaving town. */
  reforgedFrom: { slot: Slot; item: Item } | null
  foe: Foe | null
  log: string[]
  /** How many of the last log lines the latest action wrote. */
  fresh: number
  toast: string | null
  bag: Item[]
  gear: Partial<Record<Slot, Item>>
  cursor: number | null
  nextId: number
  stats: Record<Attribute, number>
  points: number
  panel: Panel
  /** Where the hero is: in the dungeon at `depth`, or in town. */
  where: 'dungeon' | 'town'
  /** In town, the dungeon tile the portal was opened on, where it leads back to; null in the dungeon. */
  portal: { x: number; y: number } | null
    /** 1 draws a character per map cell; 2 an ASCII sprite block per cell; 3 pixel art where the surface has a Raster, else as 2. */
  zoom: 1 | 2 | 3
}

declare module 'claude-code' {
  interface PluginState {
    'ascii-dungeon': { game: Game }
  }
}
