// Inventory art: one icon per item base, drawn at its bag footprint, used in the bag and in the worn slots alike;
// and one PX by PX icon per consumable for the belt.
import type { Consumable } from '../types'

/** Bag cell size in pixels: a 6 px icon area plus a 1 px grid line. A footprint of w x h cells is (7w - 1) x (7h - 1) px. */
export const CELL = 7

export const footprintPx = (cells: number) => CELL * cells - 1

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
}

/** Each consumable's belt icon, PX by PX: potions by their liquid, scrolls by their mark, the smoke bomb. */
export const CONSUMABLE_ICONS: Readonly<Record<Consumable, readonly string[]>> = {
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
    '...KK...',
    '...nn...',
    '..KwwK..',
    '..KggK..',
    '.KgZgGK.',
    '.KgggGK.',
    '.KGGGGK.',
    '..KKKK..',
  ],
  mapping: [
    'KKKKKKKK',
    'KoooooOK',
    '.KoNoRK.',
    '.KoNNoK.',
    '.KooNoK.',
    '.KoooOK.',
    'KoooooOK',
    'KKKKKKKK',
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
    'KKKKKKKK',
    'KoooooOK',
    '.KobboK.',
    '.KbccbK.',
    '.KobboK.',
    '.KoboOK.',
    'KoooooOK',
    'KKKKKKKK',
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
}
