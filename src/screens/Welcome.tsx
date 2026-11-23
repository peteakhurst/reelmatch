import { useRouter } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { VHSBackground } from '../components/VHSOverlay';
import { palette, spacing, text, useAccent } from '../theme';

export function Welcome() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { hex: accent } = useAccent();

  // blinking cursor for the eyebrow
  const blink = useSharedValue(1);
  useEffect(() => {
    blink.value = withRepeat(withTiming(0, { duration: 600, easing: Easing.steps(2) }), -1, true);
  }, [blink]);
  const cursorStyle = useAnimatedStyle(() => ({ opacity: blink.value }));

  return (
    <VHSBackground>
      <View style={[styles.container, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 24 }]}>
        <View style={{ gap: 18 }}>
          <View style={styles.headerRow}>
            <Text style={[styles.eyebrow, { color: accent }]}>STEP 1 / 3 · INSERT TAPE</Text>
            <Animated.Text style={[styles.cursor, { color: accent }, cursorStyle]}>▮</Animated.Text>
          </View>

          {/* Logo */}
          <Text style={[styles.logo, { color: palette.ink }]}>
            REEL<Text style={{ color: accent }}>MATCH</Text>
          </Text>
          <Text style={[styles.tagline, { color: palette.inkDim }]}>
            TINDER FOR MOVIES. WITH YOUR CREW.
          </Text>

          {/* Pitch */}
          <View style={{ gap: 14, marginTop: 18 }}>
            <Bullet color={accent} text="SWIPE through tonight's options like a video-store wall" />
            <Bullet color={palette.cyan} text="QUEUE what you'd watch · skip the rest" />
            <Bullet color={palette.lime} text="START A ROOM, drag in your crew, MATCH on a film" />
            <Bullet color={palette.yellow} text="One tap takes you straight to the streamer" />
          </View>
        </View>

        <View style={{ gap: 12 }}>
          <Pressable
            onPress={() => router.push('/onboarding/signup')}
            style={({ pressed }) => [
              styles.cta,
              { backgroundColor: accent, opacity: pressed ? 0.85 : 1 },
            ]}
          >
            <Text style={[styles.ctaText, { color: palette.bg }]}>▸ INSERT TAPE</Text>
          </Pressable>
          <Text style={[styles.fineprint, { color: palette.inkFaint }]}>
            NO ACCOUNT · NO EMAIL · NO ADS · DATA STAYS ON YOUR PHONE
          </Text>
        </View>
      </View>
    </VHSBackground>
  );
}

function Bullet({ color, text: t }: { color: string; text: string }) {
  return (
    <View style={styles.bulletRow}>
      <View style={[styles.bulletDot, { backgroundColor: color }]} />
      <Text style={[styles.bulletText, { color: palette.ink }]}>{t}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.edge,
    justifyContent: 'space-between',
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyebrow: { ...text.monoSm, letterSpacing: 2.5 },
  cursor: { ...text.monoSm, fontSize: 14 },
  logo: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 56,
    lineHeight: 56,
    letterSpacing: -2,
    textTransform: 'uppercase',
    marginTop: 6,
  },
  tagline: { ...text.monoMd, letterSpacing: 1.5 },
  bulletRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  bulletDot: { width: 8, height: 8, marginTop: 7 },
  bulletText: { ...text.bodyLg, flex: 1 },
  cta: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  ctaText: { ...text.displaySm, letterSpacing: 0 },
  fineprint: { ...text.monoSm, fontSize: 10, letterSpacing: 1.5, textAlign: 'center' },
});
