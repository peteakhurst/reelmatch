import { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View, ViewStyle } from 'react-native';
import { layout, palette } from '../theme';

/**
 * Scanline overlay applied above every screen. The original VHS spec also
 * called for an SVG fractal-noise overlay (FeTurbulence), but RN's SVG
 * implementation doesn't support that filter on native. We can re-add it
 * later as a tiled bundled noise PNG if the look needs more grit.
 */
export function VHSOverlays() {
  return <Scanlines />;
}

function Scanlines() {
  // Enough lines for the current window (taller on unfolded/large screens).
  const { height } = useWindowDimensions();
  const count = Math.ceil(height / 3) + 1;
  return (
    <View pointerEvents="none" style={styles.absFill}>
      <View style={styles.scanlineWrap}>
        {Array.from({ length: count }, (_, i) => (
          <View key={i} style={[styles.scanline, { top: i * 3 }]} />
        ))}
      </View>
    </View>
  );
}

export function VHSBackground({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <View style={[styles.bg, style]}>
      <View style={styles.column}>{children}</View>
      <VHSOverlays />
    </View>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: palette.bg,
  },
  // Centred content column — full width on phones, capped on wide screens.
  column: {
    flex: 1,
    width: '100%',
    maxWidth: layout.maxContentWidth,
    alignSelf: 'center',
  },
  absFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  scanlineWrap: {
    flex: 1,
    overflow: 'hidden',
  },
  scanline: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.18)',
  },
});
