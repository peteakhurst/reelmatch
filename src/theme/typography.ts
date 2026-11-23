import { Platform, TextStyle } from 'react-native';

export const fonts = {
  mono: 'VT323_400Regular',
  display: {
    regular: 'SpaceGrotesk_400Regular',
    medium: 'SpaceGrotesk_500Medium',
    semibold: 'SpaceGrotesk_600SemiBold',
    bold: 'SpaceGrotesk_700Bold',
  },
  body: {
    regular: 'Inter_400Regular',
    medium: 'Inter_500Medium',
    semibold: 'Inter_600SemiBold',
  },
} as const;

const upper: TextStyle = {
  textTransform: 'uppercase',
};

export const text = {
  monoSm: {
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 2,
  } satisfies TextStyle,
  monoMd: {
    fontFamily: fonts.mono,
    fontSize: 14,
    letterSpacing: 2,
  } satisfies TextStyle,
  displayXs: {
    fontFamily: fonts.display.bold,
    fontSize: 16,
    letterSpacing: -0.4,
    ...upper,
  } satisfies TextStyle,
  displaySm: {
    fontFamily: fonts.display.bold,
    fontSize: 20,
    letterSpacing: -0.5,
    ...upper,
  } satisfies TextStyle,
  displayMd: {
    fontFamily: fonts.display.bold,
    fontSize: 28,
    letterSpacing: -1,
    ...upper,
  } satisfies TextStyle,
  displayLg: {
    fontFamily: fonts.display.bold,
    fontSize: 38,
    letterSpacing: -1.5,
    ...upper,
  } satisfies TextStyle,
  displayXl: {
    fontFamily: fonts.display.bold,
    fontSize: 84,
    letterSpacing: -2.5,
    ...upper,
  } satisfies TextStyle,
  body: {
    fontFamily: fonts.body.regular,
    fontSize: 14,
    lineHeight: 20,
  } satisfies TextStyle,
  bodyLg: {
    fontFamily: fonts.body.regular,
    fontSize: 15,
    lineHeight: 22.5,
  } satisfies TextStyle,
} as const;

export const chromaticAberration = (intensity: 1 | 2 = 1): TextStyle => ({
  textShadowColor: 'rgba(255,0,128,0.6)',
  textShadowOffset: { width: intensity, height: 0 },
  textShadowRadius: 0,
});

export const isIOS = Platform.OS === 'ios';
