// Inventory art: one icon per item base, drawn at its bag footprint, used in the bag and in the worn slots alike;
// and PX by PX icons for the consumables on the belt: one form a kind, each of its three items drawn for its name.
import type { Consumable } from '../types'
import type { Tier } from './consumables'

/** Bag cell size in pixels: a 6 px icon area plus a 1 px grid line. A footprint of w x h cells is (7w - 1) x (7h - 1) px. */
export const CELL = 7

export type Icon = { cells: [number, number]; art: readonly string[] }

export const ICONS: Readonly<Record<string, Icon>> = {
  sword: { cells: [1, 3], art: ['......', '..KK..', '.KZWK.', '.KZqK.', '.KZqK.', '.KZqK.', '.KZqK.', '.KZqK.', '.KZqK.', '.KZqK.', '.KZqK.', '.KZqK.', '.KZqK.', 'KyyyyK', '.KnNK.', '.KnNK.', '.KnNK.', '.KyYK.', '..KK..', '......'] },
  dagger: { cells: [1, 2], art: ['..KK..', '.KZWK.', '.KZqK.', '.KZqK.', '.KZqK.', '.KZqK.', '.KZqK.', 'KyyyyK', '.KnNK.', '.KnNK.', '.KyYK.', '..KK..', '......'] },
  axe: { cells: [2, 3], art: ['.KKK..K..KKK.', 'KZZwK.N.KZZwK', 'KZwqKKNKKwwWK', 'KZwWWWNWWWwWK', 'KZwqKKNKKwwWK', 'KwWWK.N.KwWWK', '.KKK..N..KKK.', '.....KNK.....', '.....KNK.....', '.....KNK.....', '.....KNK.....', '.....KNK.....', '.....KNK.....', '.....KNK.....', '.....KNK.....', '.....KNK.....', '.....KNK.....', '.....KNK.....', '.....KyK.....', '......K......'] },
  buckler: { cells: [2, 2], art: ['....KKKKK....', '..KKZZZZyKK..', '.KZrrrrrrryK.', '.KZrrrrrrrYK.', 'KZrrrRRRrrryK', 'KZrrRKKKrrrYK', 'KZrrRKyKrrrYK', 'KZrrRKKKrrrYK', 'KyrrrrrrrrrYK', '.KZrrrrrrrYK.', '.KyRrrrrrRYK.', '..KKyYYYYKK..', '....KKKKK....'] },
  hood: { cells: [2, 2], art: ['....KKKKK....', '...KDDDDnK...', '..KDnnnnnnK..', '.KDnNNNNNnnK.', '.KDNkkkkkNNK.', '.KDNkkkkkNNK.', '.KDNkkkkkNNK.', '.KDNkkkkkNNK.', '.KDnNkkkNnNK.', 'KDnnnNNNnnnnK', 'KDnnnnnnnnnNK', 'KNNNNNNNNNNNK', '.KKKKKKKKKKK.'] },
  steelHelm: { cells: [2, 2], art: ['....KKKKK....', '..KKZZZZwKK..', '.KZZwwwwwZwK.', '.KZwwwwwwwWK.', 'KZWWWWWWWWWwK', 'KwKKKKKKKKKwK', 'KZkkkkkkkkkWK', 'KwKKKKKKKKKwK', 'KZZZZwKZZZZWK', 'KwwwwWKZwwwqK', 'KWWwwWKZwwWqK', '.KWqqqKWqqqK.', '..KKKKKKKKK..'] },
  tunic: { cells: [2, 3], art: ['.............', '.............', '..KKKK.KKKK..', '.KCCCbKCCCbK.', 'KCbbbbCbbbbbK', 'KCbBbbbbbBbBK', 'KCBKCbbbBKbBK', 'KbBKCbbbBKBBK', 'KKKKCbbbBKKKK', '...KCbbbBK...', '...KCbbbBK...', '...KZyyyYK...', '...KCbbbBK...', '..KCbbbbbbK..', '..KCBbbbBBK..', '.KCbBbbbBbbK.', '.KBBBBBBBBBK.', '.KKKKKKKKKKK.', '.............', '.............'] },
  chain: { cells: [2, 3], art: ['.............', '.............', '..KKKK.KKKK..', '.KeweeKwewEK.', 'KeeEeEwEeEeEK', 'KwEEEeEeEEEEK', 'KeEKwEeEEKeEK', 'KeEKeeEeEKEEK', 'KKKKwEeEEKKKK', '...KeeEeEK...', '...KwEeEEK...', '...KeEEEEK...', '...KwEeEEK...', '..KwEeEeEeK..', '..KeEEeEEEK..', '.KeeEeEeEeEK.', '.KEEEEEEEEEK.', '.KKKKKKKKKKK.', '.............', '.............'] },
  ring: { cells: [1, 1], art: ['..KK..', '.KrrK.', '.KyYK.', 'Ky..yK', 'Ky..yK', '.KyyK.'] },
  amulet: { cells: [1, 1], art: ['K....K', '.K..K.', '..KK..', '.KZcK.', '.KcbK.', '..KK..'] },
  boots: { cells: [2, 2], art: ['..KKKKK......', '..KnnNK......', '..KDnNK......', '..KDnNK......', '..KDnNK......', '..KDnNK......', '..KDnNK......', '..KDnNKKKK...', '..KDnnDDDnK..', '..KDnnnnnnnK.', '..KNNNNNNNNK.', '..KKKKKKKKKK.', '.............'] },
  greaves: { cells: [2, 2], art: ['..KKKKK......', '..KwwWK......', '..KZwWK......', '..KZwWK......', '..KZwWK......', '..KZwWK......', '..KZwWK......', '..KZwWKKKK...', '..KZwwZZZwK..', '..KZwwwwwwwK.', '..KWqqqqqqqK.', '..KKKKKKKKKK.', '.............'] },
  slippers: { cells: [2, 2], art: ['..KKKKK......', '..KppPK......', '..KFpPK......', '..KFpPK......', '..KFpPK......', '..KFpPK......', '..KFpPK......', '..KFpPKKKK...', '..KFppFFFpK..', '..KFpppppppK.', '..KPxxxxxxxK.', '..KKKKKKKKKK.', '.............'] },
  treads: { cells: [2, 2], art: ['..KKKKK......', '..KppPK......', '..KeEEK......', '..KeEEK......', '..KeEEK......', '..KeEEK......', '..KeEEK......', '..KeEEKKKK...', '..KeEEeeeEK..', '..KeEEEEEEEK.', '..KPxxxxxxxK.', '..KKKKKKKKKK.', '.............'] },
  leather: { cells: [2, 3], art: ['.............', '.............', '..KKKK.KKKK..', '.KDDDnKDDDnK.', 'KDnnnnDnnnnnK', 'KDnNnnnnnNnNK', 'KDNKDnnnNKnNK', 'KnNKDnnnNKNNK', 'KKKKDnnnNKKKK', '...KDnnnNK...', '...KDnnnNK...', '...KeEEEEK...', '...KDnnnNK...', '..KDnnnnnnK..', '..KDNnnnNNK..', '.KDnNnnnNnnK.', '.KNNNNNNNNNK.', '.KKKKKKKKKKK.', '.............', '.............'] },
  mace: { cells: [1, 3], art: ['..KK..', '.KweK.', 'KwWWeK', 'KeWWEK', '.KeEK.', '..KK..', '.KDNK.', '.KDNK.', '.KDNK.', '.KDNK.', '.KDNK.', '.KDNK.', '.KDNK.', '.KDNK.', '.KDNK.', '.KDNK.', '.KnNK.', '.KnNK.', '.KNNK.', '..KK..'] },
  staff: { cells: [1, 3], art: ['..KK..', '.KZcK.', 'KcZccK', '.KZbK.', '.KnNK.', '..KnK.', '..KnK.', '..KnK.', '..KnK.', '..KnK.', '..KnK.', '..KnK.', '..KnK.', '..KnK.', '..KnK.', '..KnK.', '..KnK.', '..KnK.', '..KnK.', '...K..'] },
  wand: { cells: [1, 2], art: ['..Z...', '.ZcZ..', '..Z...', '..KK..', '.KcK..', '.KyK..', '.KNK..', '.KNK..', '.KNK..', '.KNK..', '.KNK..', '.KyK..', '..K...'] },
  bow: { cells: [1, 3], art: ['.KK...', 'eKnK..', 'e.KnK.', 'e..KnK', 'e..KnK', 'e..KnK', 'e..KnK', 'e..KnK', 'e..KnK', 'e..KyK', 'e..KyK', 'e..KnK', 'e..KnK', 'e..KnK', 'e..KnK', 'e..KnK', 'e..KnK', 'e.KnK.', 'eKnK..', '.KK...'] },
  kite: { cells: [2, 3], art: ['.............', '.KKKKKKKKKKK.', 'KZZZZZZZZZZyK', 'KZbbbbwbbbbYK', 'KZbbbbwbbbbYK', 'KZbbbbwbbbbYK', 'KZwwwwwwwwwYK', 'KZbbbbwbbbbYK', 'KZbbbbwbbbbYK', 'KZbbbbwbbbbYK', 'KybbbbwbbbbYK', '.KZbbbwbbbYK.', '.KybbbwbbbYK.', '..KZbbwbbYK..', '..KybbwbbYK..', '...KybwbYK...', '....KywYK....', '.....KyK.....', '......K......', '.............'] },
  tome: { cells: [2, 2], art: ['.KKKKKKKKKKK.', 'KZnnnnnnnnZoK', 'KnnnnnnnnnNOK', 'KnnnnnynnnNOK', 'KnnnnyyynnNOK', 'KnnnyycyynNOK', 'KnnnnyyynnNOK', 'KnnnnnynnnNOK', 'KnnnnnnnnnNOK', 'KnnnnnnnnnNOK', 'KyNNNNNNNNYOK', 'KKKKKKKKKKKoK', '.KKKKKKKKKKK.'] },
  parry: { cells: [1, 2], art: ['..KK..', '.KZWK.', '.KZqK.', '.KZqK.', '.KZqK.', '.KwqK.', 'KwKKwK', 'KyZZYK', '.KnNK.', '.KnNK.', '.KnNK.', '.KyYK.', '..KK..'] },
  hornedHelm: { cells: [2, 2], art: ['o...KKKKK...o', 'oo.KZZZZwK.ZO', '.oKZwwwwwwKo.', '..KZwwwwwWK..', '.KwWWWWWWWwK.', 'KwKKKKKKKKKwK', 'KZkkkkkkkkkWK', 'KwKKKKKKKKKwK', 'KZZZZwKZZZZWK', 'KwwwwWKZwwwqK', 'KWWwwWKZwwWqK', '.KWqqqKWqqqK.', '..KKKKKKKKK..'] },
  hat: { cells: [2, 2], art: ['.......KK....', '......KbK....', '.....KCBK....', '.....KCbbK...', '....KCybBK...', '....KCbbbbK..', '...KCbbbyBK..', '...KCbbbbbbK.', '..KCbybbbbBK.', '.KKZyyyyyYKK.', 'KbbBBBBBBBbbK', '.KKKKKKKKKKK.', '.............'] },
  cowl: { cells: [2, 2], art: ['....KKKKK....', '...KeeeeEK...', '..KeEEEEEEK..', '.KeEKKKKKEEK.', '.KEKkkkkkKEK.', '.KEKkYkYkKEK.', '.KEKKKKKKKEK.', '.KeewwwwweEK.', '.KeEEeeeEEEK.', 'KeEEEEEEEEEEK', 'KeEEEEEEEEEEK', 'KEEEEEEEEEEEK', '.KKKKKKKKKKK.'] },
  plate: { cells: [2, 3], art: ['.............', '.............', '.............', 'KKK.......KKK', 'KZwKKKKKKKZwK', 'KZWZZZZZZZWWK', 'KWWwwwwwwwWqK', '.KKZwwWwwWKK.', '..KZwwWwwWK..', '..KZwwWwwWK..', '..KWWWqWWqK..', '..KKKKKKKKK..', '..KZZZZZZwK..', '..KwWWWWWqK..', '..KZwwwwwWK..', '..KWqqqqqqK..', '...KKKKKKK...', '.............', '.............', '.............'] },
  robe: { cells: [2, 3], art: ['.............', '...KKK.KKK...', '..KFFpKFFpK..', '.KFpppFppppK.', 'KFpPpppppPppK', 'KFxKFpppPKpPK', 'KpxKFpppPKPPK', 'KKKKFpppPKKKK', '...KFyyyPK...', '...KFpppPK...', '..KFppppppK..', '..KFPpppPPK..', '.KFpPpppPppK.', '.KFpPpppPpPK.', 'KFppPpppPpppK', 'KFppPpppPppPK', 'KyYYYYYYYYYYK', 'KKKKKKKKKKKKK', '.............', '.............'] },
  cloak: { cells: [2, 3], art: ['.............', '.............', '....KKKKK....', '...KeeeeEK...', '..KeEkkkEEK..', '..KekkkkkEK..', '.KeEEKkKeEEK.', '.KeEEeyeEEEK.', 'KeEEEPPPEEEEK', 'KeEEEPPPEEEEK', 'KeEEEPPPEEEEK', 'KeEEPPPPPEEEK', 'KeEEPPPPPEEEK', 'KeEEPPPPPEEEK', 'KeEPPPPPPPEEK', 'KeEPPPPPPPEEK', 'KExxxxxxxxxEK', 'KK.KKK.KKK.KK', '.............', '.............'] },
  signet: { cells: [1, 1], art: ['.KKKK.', '.KyYK.', 'KyKKyK', 'Ky..yK', 'Ky..yK', '.KyyK.'] },
  pendant: { cells: [1, 1], art: ['K....K', '.K..K.', '..KK..', '.KrrK.', '.KrRK.', '..KK..'] },
  tower: { cells: [2, 3], art: ['.............', '..KKKKKKKKK..', '.KZZZZZZZZwK.', 'KZwwwwwwwwwWK', 'KZwKKKKKKKwWK', 'KZwKrrrrrKwWK', 'KZwKrrrrrKwWK', 'KZwKrryrrKwWK', 'KZwKryyyrKwWK', 'KZwKrryrrKwWK', 'KZwKrrrrrKwWK', 'KZwKrrrrrKwWK', 'KZwKrrrrrKwWK', 'KZwKKKKKKKwWK', 'KZwwwwwwwwwWK', 'KywwwwwwwwwYK', 'KZwyWWWWWywWK', '.KWWWWWWWWWK.', '..KKKKKKKKK..', '.............'] },
  scepter: { cells: [1, 3], art: ['..KK..', '.KpPK.', 'KpZpPK', 'KpppPK', 'KPppPK', '.KPPK.', 'KyKKyK', '.KyYK.', '.KyYK.', '.KcYK.', '.KyYK.', '.KyYK.', '.KcYK.', '.KyYK.', '.KyYK.', '.KyYK.', '.KyYK.', '.KYYK.', '..KK..', '......'] },
  orb: { cells: [2, 2], art: ['....KKKKK....', '..KKccccbKK..', '.KcZZccccbbK.', '.KcZcccccbbK.', 'KcccccccccbBK', 'KcccccccccbBK', 'KccccccccbbBK', '.KcccccccbBK.', '.KbbcccbbBBK.', '..KKbbbbbKK..', '...KyyyyYK...', '..KyYYYYYYK..', '..KKKKKKKKK..'] },
  grimoire: { cells: [2, 2], art: ['.KKKKKKKKKKK.', 'KFPPPPPPPPFoK', 'KPxxxxxxxxPOK', 'KPxxyyyyxxPOK', 'KPxyxxxxyxPOK', 'KPxyxccxyxPOK', 'KPxyxxxxyxPOK', 'KPxxyyyyxxPOK', 'KPxxxxxxxxPOK', 'KPxxxxxxxxPOK', 'KFPPPPPPPPYOK', 'KKKKKKKKKKKoK', '.KKKKKKKKKKK.'] },
  circlet: { cells: [2, 2], art: ['.............', '.............', '.............', '.............', '......K......', '.....KcK.....', '..KKKcZcKKK..', '.KwwwKcKwwwK.', 'KwZwwwKwwwWWK', 'KWK.......KWK', 'KWK.......KWK', '.KWK.....KWK.', '..KKKKKKKKK..'] },
  sageHood: { cells: [2, 2], art: ['....KKKKK....', '...KFppppK...', '..KFppppppK..', '.KFpKKKKKpPK.', '.KpKkkkkkKPK.', '.KpKkkkkkKPK.', '.KpKkkkkkKPK.', '.KpyKkkkKyPK.', '.KFpyyyyypPK.', 'KFppppppppPPK', 'KFpppppppppPK', 'KyyyyyyyyyyYK', '.KKKKKKKKKKK.'] },
  vestments: { cells: [2, 3], art: ['.............', '...KKK.KKK...', '..KhhoKhhoK..', '.KhooohooooK.', 'KhoOoooooOooK', 'KhHKhoooOKoOK', 'KoHKhoooOKOOK', 'KKKKhoooOKKKK', '...KhyyyOK...', '...KhoooOK...', '..KhooooooK..', '..KhOoooOOK..', '.KhoOoooOooK.', '.KhoOoooOoOK.', 'KhooOoooOoooK', 'KhooOoooOooOK', 'KyYYYYYYYYYYK', 'KKKKKKKKKKKKK', '.............', '.............'] },
  mantle: { cells: [2, 3], art: ['.............', '.............', '....KKKKK....', '...KCCCCbK...', '..KCbkkkbbK..', '..KCkkkkkbK..', '.KCbbKkKCbbK.', '.KCbbCcCbbbK.', 'KCbbbBBBbbbbK', 'KCbbbBBBbbbbK', 'KCbbbBBBbbbbK', 'KCbbBBBBBbbbK', 'KCbbBBBBBbbbK', 'KCbbBBBBBbbbK', 'KCbBBBBBBBbbK', 'KCbBBBBBBBbbK', 'KbxxxxxxxxxbK', 'KK.KKK.KKK.KK', '.............', '.............'] },
  rapier: { cells: [1, 3], art: ['...K..', '..KZK.', '..KwK.', '..KwK.', '..KwK.', '..KwK.', '..KwK.', '..KwK.', '..KwK.', '..KwK.', '..KwK.', '..KwK.', '.KyyyK', 'KyKnKK', 'KyKnK.', 'KyKnK.', '.KyyK.', '..KyK.', '...K..', '......'] },
  knives: { cells: [1, 2], art: ['.K..K.', 'KZKKZK', 'KwKKwK', 'KwKKwK', 'KwKKwK', 'KwKKwK', 'KWKKWK', 'KyKKyK', 'KNKKNK', 'KNKKNK', 'KrKKrK', '.K..K.', '......'] },
  quiver: { cells: [1, 3], art: ['.r.Z.r', '.rKZKr', '..KnK.', 'KKKKKK', 'KDnnNK', 'KDnnNK', 'KyyyYK', 'KDnnNK', 'KDnnNK', 'KDnnNK', 'KDnnNK', 'KDnnNK', 'KDnnNK', 'KDnnNK', 'KDnnNK', 'KyyyYK', 'KDnnNK', 'KDnnNK', 'KNNNNK', '.KKKK.'] },
  mask: { cells: [2, 2], art: ['.............', '.............', '.............', '.............', '.KKKKKKKKKKK.', 'KaPPPPKPPPPaK', 'KPPK.PPPK.PPK', 'KPPKKPPPKKPPK', 'KPPPPPKPPPPPK', '.KaPPK.KPPaK.', '..KKK...KKK..', 'r...........r', '.r.........r.'] },
  bandana: { cells: [2, 2], art: ['.............', '.............', '...KKKKKKK...', '..KrrrrrrrK..', '.KrZrrrrrrRK.', '.KrrrrwrrrRK.', 'KrrwrrrrrwrRK', 'KRRRRRRRRRRRK', '.KKKKKKKKKrRK', '.........KrRK', '........KrRK.', '........KRK..', '.........K...'] },
  jerkin: { cells: [2, 3], art: ['.............', '.............', '..KKKK.KKKK..', '.KDDDnKDDDnK.', 'KDenneDnenneK', 'KDnNennenNeNK', 'KDNKDnenNKnNK', 'KnNKDennNKNNK', 'KKKKDnneNKKKK', '...KDnenNK...', '...KDennNK...', '...KeEEEEK...', '...KDnenNK...', '..KDnennenK..', '..KDNnneNNK..', '.KDeNnenNenK.', '.KNNNNNNNNNK.', '.KKKKKKKKKKK.', '.............', '.............'] },
}

/** The consumables' belt icons, PX by PX: potions by their liquid, scrolls by their mark, the smoke bomb. */
export const CONSUMABLE_ICONS = {
  health: [
    '........',
    '...KK...',
    '...nn...',
    '..KwwK..',
    '.KrZrrK.',
    '.KrrrRK.',
    '.KrrRRK.',
    '..KKKK..',
  ],
  greater: [
    '..KyyK..',
    '..KwwK..',
    '.KrrrrK.',
    'KrZrrrrK',
    'KrrryrrK',
    'KrryyyRK',
    '.KrRRRK.',
    '..KKKK..',
  ],
  regen: [
    '.....gg.',
    '...g.gGg',
    '..gGg.G.',
    '.gGgGg..',
    '..gGnG..',
    '...n....',
    '..n.....',
    '.n......',
  ],
  fury: [
    'KKKKKKKK',
    'KoooooOK',
    '.KorroK.',
    '.KryyrK.',
    '.KoryoK.',
    '.KoooOK.',
    'KoooooOK',
    'KKKKKKKK',
  ],
  ward: [
    '..KKKK..',
    '.KweewK.',
    'KwecceEK',
    'KeeceeEK',
    'KeeceeEK',
    'KecEceEK',
    '.KeEEEK.',
    '..KKKK..',
  ],
  smoke: [
    '.....Z..',
    '....y...',
    '...nK...',
    '..KKKK..',
    '.KeZEEK.',
    '.KeEEqK.',
    '.KEEqqK.',
    '..KKKK..',
  ],
  // The smoke bombs' stronger two, the same bomb: the Shadow Bomb in shadow's purple, the Passage Bomb in the portal's blue.
  shadow: [
    '.....Z..',
    '....y...',
    '...nK...',
    '..KKKK..',
    '.KpZPPK.',
    '.KpPPPK.',
    '.KPPPPK.',
    '..KKKK..',
  ],
  passage: [
    '.....Z..',
    '....y...',
    '...nK...',
    '..KKKK..',
    '.KcZbbK.',
    '.KcbbcK.',
    '.KbbccK.',
    '..KKKK..',
  ],
  // The Elixir: the great flask in gold, glowing at its stopper.
  elixir: [
    '..KccK..',
    '..KwwK..',
    '.KyyyyK.',
    'KyZyyyyK',
    'KyyyYyyK',
    'KyYYYyYK',
    '.KyYYYK.',
    '..KKKK..',
  ],
  // The Herbal Salve: a jar of green salve under a leather lid.
  salve: [
    '........',
    '.KKKKKK.',
    '.KnnnnK.',
    'KggggggK',
    'KgZgggGK',
    'KgggGgGK',
    'KGgGGGGK',
    '.KKKKKK.',
  ],
  // Troll Moss: a clump of troll-green moss.
  moss: [
    '........',
    '...tt...',
    '.mmtmmt.',
    'mtmmtmmm',
    'mmMtmMmm',
    '.MmmMmMm',
    '..MMMMM.',
    '........',
  ],
  // The Scroll of Battle: two crossed blades on the scroll.
  battle: [
    'KKKKKKKK',
    'KoooooOK',
    '.KEooEK.',
    '.KoEEoK.',
    '.KoEEoK.',
    '.KnoonK.',
    'KoooooOK',
    'KKKKKKKK',
  ],
  // The Scroll of the Berserker: a red axe on the scroll.
  berserker: [
    'KKKKKKKK',
    'KoooooOK',
    '.KoRrrK.',
    '.KoRrRK.',
    '.KonooK.',
    '.KonoOK.',
    'KoooooOK',
    'KKKKKKKK',
  ],
  // The Greater Ward Rune: its glyph grown and glowing.
  wardGreater: [
    '..KKKK..',
    '.KwecZK.',
    'KwccccEK',
    'KecZZceK',
    'KecZZceK',
    'KeccccEK',
    '.KeEEEK.',
    '..KKKK..',
  ],
  // The Aegis Rune: a golden stone, a shield its glyph.
  aegis: [
    '..KKKK..',
    '.KyyyyK.',
    'KyccccYK',
    'KyccccYK',
    'KyYccYYK',
    'KyYccYYK',
    '.KYYYYK.',
    '..KKKK..',
  ],
} as const satisfies Readonly<Record<string, readonly string[]>>

/** Each item's icon, by kind and tier: one form a kind, drawn to show the item's own name. */
const ICON_OF: Readonly<Record<Consumable, Readonly<Record<Tier, readonly string[]>>>> = {
  health: { 1: CONSUMABLE_ICONS.health, 2: CONSUMABLE_ICONS.greater, 3: CONSUMABLE_ICONS.elixir },
  regen: { 1: CONSUMABLE_ICONS.regen, 2: CONSUMABLE_ICONS.salve, 3: CONSUMABLE_ICONS.moss },
  fury: { 1: CONSUMABLE_ICONS.fury, 2: CONSUMABLE_ICONS.battle, 3: CONSUMABLE_ICONS.berserker },
  ward: { 1: CONSUMABLE_ICONS.ward, 2: CONSUMABLE_ICONS.wardGreater, 3: CONSUMABLE_ICONS.aegis },
  smoke: { 1: CONSUMABLE_ICONS.smoke, 2: CONSUMABLE_ICONS.shadow, 3: CONSUMABLE_ICONS.passage },
}

/** An item's icon: its kind's form, drawn for its tier. */
export const consumableIcon = (kind: Consumable, tier: Tier): readonly string[] => ICON_OF[kind][tier]
