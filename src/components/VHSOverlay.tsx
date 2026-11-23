import { ReactNode } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { palette } from '../theme';

/**
 * Scanline overlay applied above every screen. The original VHS spec also
 * called for an SVG fractal-noise overlay (FeTurbulence), but RN's SVG
 * implementation doesn't support that filter on native. We can re-add it
 * later as a tiled bundled noise PNG if the look needs more grit.
 */
export function VHSOverlays() {
  return <Scanlines />;
}

const SCANLINE_OFFSETS = Array.from({ length: 320 }, (_, i) => i * 3);

function Scanlines() {
  return (
    <View pointerEvents="none" style={styles.absFill}>
      <View style={styles.scanlineWrap}>
        {SCANLINE_OFFSETS.map((top) => (
          <View key={top} style={[styles.scanline, { top }]} />
        ))}
      </View>
    </View>
  );
}

export function VHSBackground({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return (
    <View style={[styles.bg, style]}>
      {children}
      <VHSOverlays />
    </View>
  );
}

const styles = StyleSheet.create({
  bg: {
    flex: 1,
    backgroundColor: palette.bg,
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
