import { useEffect, useRef } from 'react';
import { Image } from 'expo-image';
import { Linking, Pressable, useWindowDimensions, StyleSheet, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import ConfettiCannon from 'react-native-confetti-cannon';
import { posterUrl } from '../lib/api';
import type { MatchEvent } from '../hooks/useRoom';
import { palette, text, useAccent } from '../theme';


export function MatchOverlay({ match, onDismiss }: { match: MatchEvent; onDismiss: () => void }) {
  const { width: SCREEN_W } = useWindowDimensions();
  const { hex: accent } = useAccent();
  const scale = useSharedValue(0.92);
  const opacity = useSharedValue(0);
  const rewind = useSharedValue(0);
  const confettiRef = useRef<ConfettiCannon | null>(null);

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    opacity.value = withTiming(1, { duration: 220 });
    scale.value = withSequence(
      withTiming(1.04, { duration: 320, easing: Easing.out(Easing.cubic) }),
      withTiming(1, { duration: 200 }),
    );
    rewind.value = withDelay(200, withTiming(1, { duration: 1200, easing: Easing.out(Easing.cubic) }));
    // small delay so the cannon fires after the overlay is visible
    const t = setTimeout(() => confettiRef.current?.start(), 200);
    return () => clearTimeout(t);
  }, [match.movie.id, opacity, rewind, scale]);

  const onPlayTonight = () => {
    if (match.movie.watchLink) {
      Linking.openURL(match.movie.watchLink).catch(() => {});
    }
    onDismiss();
  };

  const containerStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));

  const rewindStyle = useAnimatedStyle(() => ({
    width: `${rewind.value * 100}%`,
  }));

  const poster = posterUrl(match.movie.poster_path, 'w500');
  const memberNames = match.members.map((m) => m.name.toUpperCase()).join(' · ');

  return (
    <Animated.View style={[styles.shade, containerStyle]}>
      <View style={styles.eyebrowRow}>
        <Text style={[text.monoMd, { color: accent, letterSpacing: 2 }]}>▸▸ REWIND COMPLETE</Text>
      </View>
      <Text style={[styles.bigTitle, { color: palette.ink }]}>
        IT&apos;S A{'\n'}<Text style={{ color: accent }}>MATCH.</Text>
      </Text>

      <View style={[styles.posterWrap, { borderColor: accent, shadowColor: accent }]}>
        {poster ? (
          <Image source={{ uri: poster }} style={styles.poster} contentFit="cover" />
        ) : (
          <View style={[styles.poster, { backgroundColor: palette.tape }]} />
        )}
      </View>

      <Text style={[text.monoSm, { color: palette.inkDim, letterSpacing: 2, marginTop: 16 }]}>
        ◂◂ REWIND · TAPE A · TRK 03
      </Text>
      <View style={styles.rewindBarOuter}>
        <Animated.View style={[styles.rewindBarInner, { backgroundColor: accent }, rewindStyle]} />
      </View>

      <Text style={[text.body, { color: palette.inkDim, marginTop: 16, textAlign: 'center' }]}>
        {memberNames} BOTH WANT TO WATCH
      </Text>
      <Text style={[text.displayMd, { color: palette.ink, textAlign: 'center', marginTop: 6 }]}>
        {match.movie.title.toUpperCase()}
      </Text>

      <View style={styles.btnRow}>
        <Pressable onPress={onDismiss} style={[styles.ghostBtn, { borderColor: palette.inkFaint }]}>
          <Text style={[text.monoMd, { color: palette.inkDim }]}>KEEP SWIPING</Text>
        </Pressable>
        <Pressable
          onPress={onPlayTonight}
          disabled={!match.movie.watchLink}
          style={[
            styles.solidBtn,
            {
              backgroundColor: match.movie.watchLink ? accent : palette.tape,
              borderWidth: match.movie.watchLink ? 0 : 1.5,
              borderColor: palette.inkFaint,
            },
          ]}
        >
          <Text
            style={[
              text.monoMd,
              { color: match.movie.watchLink ? palette.bg : palette.inkDim },
            ]}
          >
            {match.movie.watchLink ? '▸ PLAY TONIGHT' : 'NOT STREAMING'}
          </Text>
        </Pressable>
      </View>

      {/* confetti — fired imperatively from the effect above */}
      <ConfettiCannon
        ref={(r) => {
          confettiRef.current = r;
        }}
        count={120}
        origin={{ x: SCREEN_W / 2, y: -10 }}
        autoStart={false}
        fadeOut
        explosionSpeed={350}
        fallSpeed={2800}
        colors={[accent, palette.cyan, palette.lime, palette.yellow, palette.ink]}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(10,6,18,0.96)',
    paddingHorizontal: 24,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  eyebrowRow: {
    marginBottom: 8,
  },
  bigTitle: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 64,
    lineHeight: 64,
    textAlign: 'center',
    letterSpacing: -2,
    textTransform: 'uppercase',
    marginBottom: 22,
  },
  posterWrap: {
    width: 220,
    aspectRatio: 2 / 3,
    borderWidth: 2,
    transform: [{ rotate: '-3deg' }],
    shadowOpacity: 0.5,
    shadowRadius: 0,
    shadowOffset: { width: 6, height: 6 },
  },
  poster: { width: '100%', height: '100%' },
  rewindBarOuter: {
    width: '70%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginTop: 8,
    overflow: 'hidden',
  },
  rewindBarInner: {
    height: '100%',
  },
  btnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 28,
    width: '100%',
  },
  ghostBtn: { flex: 1, paddingVertical: 14, borderWidth: 1.5, alignItems: 'center' },
  solidBtn: { flex: 2, paddingVertical: 14, alignItems: 'center' },
});
