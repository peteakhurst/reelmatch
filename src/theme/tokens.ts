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
  cardHeight: 510,
  bottomActions: 36,
} as const;
