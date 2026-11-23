export const palette = {
  bg: '#0a0612',
  bgAlt: '#110821',
  tape: '#1d1230',
  ink: '#f5ecff',
  inkDim: 'rgba(245,236,255,0.55)',
  inkFaint: 'rgba(245,236,255,0.28)',
  magenta: '#ff2e88',
  cyan: '#2ef0ff',
  yellow: '#ffdf3f',
  lime: '#8fff5b',
  red: '#ff3b3b',
  black: '#000000',
  white: '#ffffff',
} as const;

export type AccentName = 'magenta' | 'cyan' | 'lime' | 'amber' | 'violet';

export const ACCENTS: Record<AccentName, string> = {
  magenta: palette.magenta,
  cyan: palette.cyan,
  lime: palette.lime,
  amber: '#ffb13f',
  violet: '#b96bff',
};

export const spacing = {
  edge: 20,
  section: 22,
  cardPad: 12,
  buttonPadV: 14,
} as const;

export const radius = {
  none: 0,
} as const;

export const motion = {
  blink: 1000,
  flicker: 3000,
  tracking: 8000,
  glitch: 600,
  rewind: 1200,
} as const;

export const sizes = {
  topChromeTop: 60,
  /** Poster-ish width:height of the swipe card. */
  cardAspect: 0.69,
  bottomActions: 36,
  /** Room reserved under the deck for the action buttons + labels. */
  actionsHeight: 100,
} as const;

export const layout = {
  /**
   * Widest the app's content column gets. Phones are narrower than this so
   * nothing changes there; on wide screens (iPhone Duo unfolded, iPad, web)
   * content stays a readable centred column instead of stretching.
   */
  maxContentWidth: 560,
} as const;
