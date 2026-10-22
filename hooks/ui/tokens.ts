// The interface's design tokens: each color a window draws, named once by its role; the spacing windows lay out by;
// and the families a card belongs to. A window takes its colors from here, never a code of its own: the colors gate
// (scripts/check-colors.mjs) holds every module that draws a window to it.

/** What is written or marked: text, the dimmed and the disabled, gold, the white of the focus, what each state says. */
export const INK = {
  text: '#e8e4dc',
  dim: '#8a8494',
  off: '#5a5664',
  gold: '#ffd34d',
  focus: '#ffffff',
  white: '#ffffff',
  onRibbon: '#14101a',
  /** Text on a bright bar or a light color. */
  onBright: '#1a1820',
  /** The work the game rewards, and an upgrade. */
  good: '#3ccf4e',
  /** An easier mark, and the points to spend. */
  easy: '#5ccf6a',
  /** A harder mark. */
  hard: '#ff7a59',
  /** The close box's X, a death, a foe that slew the hero. */
  danger: '#ff5a4f',
  /** What the hero cannot wear or do. */
  wrong: '#ff4a4a',
  /** A shape for what is not there: an empty slot's ghost. */
  ghost: '#2a2732',
  /** Art a palette lacks a color for: loud on purpose. */
  missing: '#ff00ff',
  coinRim: '#c9971f',
  unpaidRim: '#4a4652',
  /** The XP bar and the quest's, lit to shaded; the smith's pips. */
  xpLight: '#f0d070',
  xp: '#d9b54a',
  xpShade: '#a88430',
} as const

/** What things are drawn on: the ground, title bar, cards, buttons, frames and lines. */
export const SURFACE = {
  ground: '#0b0b10',
  titleBar: '#15131b',
  slot: '#1a1820',
  /** A grid's lines, a rule between sections. */
  line: '#2c2834',
  card: '#15131b',
  cardEdge: '#3a3644',
  /** What is not yet found: its shape alone. */
  shade: '#2e2a38',
  frame: '#6b6258',
  backdrop: '#1c2230',
  floor: '#232a3a',
  /** A text box's fill, under the click layer's text. */
  popover: '#0e0d13',
  /** A button's face, and a row standing out; an off button's, and an empty box. */
  raised: '#1f1c27',
  sunken: '#141219',
  buttonLit: '#2c2836',
  buttonEdge: '#4a4456',
  /** The chosen tab's ground, an off button's edge. */
  tab: '#24212c',
  closeGround: '#2a1e24',
  /** The hero card's ground. */
  print: '#0f0d14',
  xpEmpty: '#2a2618',
} as const

/** Pixels between things side by side. */
export const SPACE = { gap: 3 } as const

/** A family a card belongs to: its ribbon's word, its ink, and the ribbon's dark underside. */
export type Family = { label: string; ink: string; dark: string }
export const FAMILIES = {
  work: { label: 'CRAFT', ink: '#5ccf6a', dark: '#2c6a36' },
  fight: { label: 'COMBAT', ink: '#f06a5a', dark: '#7a2a24' },
  road: { label: 'SURVIVAL', ink: '#ffd34d', dark: '#8a6a1a' },
} as const satisfies Record<string, Family>
export type FamilyName = keyof typeof FAMILIES
