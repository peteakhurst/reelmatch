import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActionSheetIOS, Dimensions, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useUser } from '../state/user';
import { useWatchlist, type ListName } from '../state/watchlist';
import { useRoomContext } from '../state/room';
import { MatchOverlay } from '../components/MatchOverlay';
import { ONBOARDING_GENRES } from '../lib/genres';
import { ActionButton } from '../components/ActionButton';
import { MovieCard } from '../components/MovieCard';
import { VHSBackground } from '../components/VHSOverlay';
import { useMovieQueue } from '../hooks/useMovieQueue';
import { palette, sizes, spacing, text, useAccent } from '../theme';

type Direction = 'left' | 'right' | 'up' | 'down';
const SWIPE_THRESHOLD = 120;
const SCREEN = Dimensions.get('window');
const FLY_DISTANCE = SCREEN.width * 1.4;

const DIR_TO_LABEL: Record<Direction, string> = {
  right: 'QUEUE',
  left: 'NOPE',
  up: 'SEEN',
  down: 'LATER',
};

const DIR_TO_LIST: Record<Direction, ListName> = {
  right: 'queue',
  left: 'nope',
  up: 'seen',
  down: 'later',
};

/**
 * Thin VHS-style loading indicator that scrolls a bright bar across the screen.
 * Sits just under the top chrome so the deck cards keep their place underneath
 * and aren't blanked out while a refetch is in flight.
 */
function LoadingBar({ accent }: { accent: string }) {
  const offset = useSharedValue(-1);
  useEffect(() => {
    offset.value = withRepeat(withTiming(1, { duration: 1100 }), -1, false);
  }, [offset]);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: SCREEN.width * offset.value }],
  }));
  return (
    <View pointerEvents="none" style={loadStyles.track}>
      <Animated.View style={[loadStyles.bar, { backgroundColor: accent }, animStyle]} />
    </View>
  );
}

const loadStyles = StyleSheet.create({
  track: {
    height: 2,
    marginHorizontal: 20,
    marginTop: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  bar: {
    height: '100%',
    width: '40%',
  },
});

function summarizeGenres(ids: number[]): string {
  if (!ids.length) return 'ALL GENRES';
  const labels = ids
    .map((id) => ONBOARDING_GENRES.find((g) => g.id === id)?.label)
    .filter((l): l is string => !!l);
  if (labels.length <= 2) return labels.join(' · ');
  return `${labels.slice(0, 2).join(' · ')} +${labels.length - 2}`;
}

export function SwipeDeck() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { hex: accent } = useAccent();
  const { reset: wipeUser, genres: pickedGenres, mode, setMode } = useUser();
  const { add: addToWatchlist, queue: queueList, clearAll: wipeWatchlist } = useWatchlist();
  const room = useRoomContext();
  const inRoom = !!room.code;
  // While in a room, the deck is filtered by the host's genres (see useMovieQueue).
  // Show those in the chip so the label matches what you're actually seeing.
  const host = inRoom ? room.members[0] : null;
  const isHost = inRoom && host?.id === room.myId;
  const effectiveGenres =
    inRoom && host?.genres?.length ? host.genres : pickedGenres;
  const canEditGenres = !inRoom || isHost;
  // shared values for the front card's drag offset (UI-thread)
  const tx = useSharedValue(0);
  const ty = useSharedValue(0);
  const isAnimating = useSharedValue(false);

  const [index, setIndex] = useState(0);
  const [history, setHistory] = useState<{ index: number; direction: Direction }[]>([]);
  const { movies: queue, loading, loadingMore, exhausted, source, deckKey, refetch } = useMovieQueue(index);
  const remaining = Math.max(0, queue.length - index);

  // A new deck was dealt (genre/mode/room change or rewind) → back to card 0.
  useEffect(() => {
    setIndex(0);
    setHistory([]);
    tx.value = 0;
    ty.value = 0;
    isAnimating.value = false;
  }, [deckKey, tx, ty, isAnimating]);

  const reset = useCallback(() => {
    Haptics.selectionAsync().catch(() => {});
    refetch();
  }, [refetch]);
  const front = queue[index] ?? null;
  const back = queue[index + 1] ?? null;

  const advance = useCallback(
    (direction: Direction) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const swiped = queue[index];
      if (swiped) {
        const list: ListName = DIR_TO_LIST[direction];
        addToWatchlist(list, swiped);
        if (inRoom) room.broadcastSwipe(swiped, direction);
      }
      setHistory((h) => [...h, { index, direction }]);
      setIndex((i) => i + 1);
      tx.value = 0;
      ty.value = 0;
      isAnimating.value = false;
    },
    [index, tx, ty, queue, addToWatchlist, isAnimating, inRoom, room],
  );

  const flyOff = useCallback(
    (direction: Direction) => {
      'worklet';
      const map: Record<Direction, { x: number; y: number }> = {
        left: { x: -FLY_DISTANCE, y: 0 },
        right: { x: FLY_DISTANCE, y: 0 },
        up: { x: 0, y: -FLY_DISTANCE },
        down: { x: 0, y: FLY_DISTANCE },
      };
      const target = map[direction];
      tx.value = withTiming(target.x, { duration: 260 });
      ty.value = withTiming(target.y, { duration: 260 }, (done) => {
        if (done) runOnJS(advance)(direction);
      });
    },
    [tx, ty, advance],
  );

  const triggerSwipe = useCallback(
    (direction: Direction) => {
      if (isAnimating.value || !front) return;
      isAnimating.value = true;
      flyOff(direction);
    },
    [flyOff, front],
  );

  const undo = useCallback(() => {
    if (!history.length) return;
    Haptics.selectionAsync().catch(() => {});
    setHistory((h) => h.slice(0, -1));
    setIndex((i) => Math.max(0, i - 1));
    tx.value = 0;
    ty.value = 0;
  }, [history, tx, ty]);

  const wipeAll = useCallback(async () => {
    if (inRoom) room.leaveRoom();
    wipeWatchlist();
    wipeUser();
    await AsyncStorage.removeItem('@reelmatch/memberId/v1').catch(() => {});
  }, [inRoom, room, wipeWatchlist, wipeUser]);

  /**
   * Pulls UNDO + dev-only RESET/WIPE into one native iOS ActionSheet so the
   * top chrome doesn't run out of horizontal space.
   */
  const openMenu = useCallback(() => {
    if (Platform.OS !== 'ios') {
      // Android fallback would be a custom modal — we're iOS-only for now.
      undo();
      return;
    }
    const undoEnabled = history.length > 0;
    const options: string[] = [];
    if (undoEnabled) options.push('⟲ Undo last swipe');
    if (__DEV__) {
      options.push('↺ Reset deck (fresh page)');
      options.push('⌫ Wipe everything (dev)');
    }
    options.push('Cancel');
    const cancelButtonIndex = options.length - 1;
    const destructiveIndex = __DEV__ ? options.length - 2 : -1;

    ActionSheetIOS.showActionSheetWithOptions(
      {
        options,
        cancelButtonIndex,
        destructiveButtonIndex: destructiveIndex >= 0 ? destructiveIndex : undefined,
        userInterfaceStyle: 'dark',
      },
      (buttonIndex) => {
        const label = options[buttonIndex];
        if (label?.startsWith('⟲')) undo();
        else if (label?.startsWith('↺')) reset();
        else if (label?.startsWith('⌫')) wipeAll();
      },
    );
  }, [history.length, undo, reset, wipeAll]);

  const openDetail = useCallback(
    (movieId: number) => {
      router.push(`/movie/${movieId}`);
    },
    [router],
  );

  const composedGesture = useMemo(() => {
    const pan = Gesture.Pan()
      .activeOffsetX([-8, 8])
      .activeOffsetY([-8, 8])
      .onUpdate((e) => {
        tx.value = e.translationX;
        ty.value = e.translationY;
      })
      .onEnd((e) => {
        const ax = Math.abs(e.translationX);
        const ay = Math.abs(e.translationY);
        const past = ax > SWIPE_THRESHOLD || ay > SWIPE_THRESHOLD;
        if (!past) {
          tx.value = withSpring(0, { damping: 18, stiffness: 220 });
          ty.value = withSpring(0, { damping: 18, stiffness: 220 });
          return;
        }
        let dir: Direction;
        if (ax > ay) dir = e.translationX > 0 ? 'right' : 'left';
        else dir = e.translationY > 0 ? 'down' : 'up';
        isAnimating.value = true;
        flyOff(dir);
      });

    const tap = Gesture.Tap()
      .maxDuration(250)
      .maxDistance(8)
      .onEnd((_e, success) => {
        if (success && front) runOnJS(openDetail)(front.id);
      });

    return Gesture.Exclusive(pan, tap);
  }, [tx, ty, flyOff, isAnimating, front, openDetail]);

  const frontStyle = useAnimatedStyle(() => {
    const rotate = interpolate(
      tx.value,
      [-SCREEN.width, 0, SCREEN.width],
      [-15, 0, 15],
      Extrapolation.CLAMP,
    );
    return {
      transform: [
        { translateX: tx.value },
        { translateY: ty.value },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  const backStyle = useAnimatedStyle(() => {
    const dist = Math.hypot(tx.value, ty.value);
    const t = Math.min(dist / SWIPE_THRESHOLD, 1);
    const scale = 0.95 + t * 0.05;
    const opacity = 0.5 + t * 0.5;
    return {
      transform: [{ scale }, { rotate: '-1.8deg' }],
      opacity,
    };
  });

  // Tinted overlay on the front card showing the active direction's color/label
  const overlayStyles = {
    queue: useAnimatedStyle(() => {
      const dist = Math.max(0, tx.value);
      const o = interpolate(dist, [40, SWIPE_THRESHOLD], [0, 0.85], Extrapolation.CLAMP);
      return { opacity: o };
    }),
    nope: useAnimatedStyle(() => {
      const dist = Math.max(0, -tx.value);
      const o = interpolate(dist, [40, SWIPE_THRESHOLD], [0, 0.85], Extrapolation.CLAMP);
      return { opacity: o };
    }),
    seen: useAnimatedStyle(() => {
      const dist = Math.max(0, -ty.value);
      const o = interpolate(dist, [40, SWIPE_THRESHOLD], [0, 0.85], Extrapolation.CLAMP);
      return { opacity: o };
    }),
    later: useAnimatedStyle(() => {
      const dist = Math.max(0, ty.value);
      const o = interpolate(dist, [40, SWIPE_THRESHOLD], [0, 0.85], Extrapolation.CLAMP);
      return { opacity: o };
    }),
  };

  return (
    <VHSBackground>
      {/* top chrome */}
      <View style={[styles.topChrome, { paddingTop: insets.top + 8 }]}>
        <View style={{ gap: 6 }}>
          <Text style={styles.modeLabel}>{inRoom ? 'ROOM' : 'QUEUE'}</Text>
          <Pressable
            onPress={() => (inRoom ? router.push('/party/room') : null)}
            disabled={!inRoom}
          >
            <Text style={styles.title}>
              {inRoom ? (
                <>
                  #{room.code} <Text style={{ color: accent }}>▸</Text>
                </>
              ) : (
                <>
                  Tonight <Text style={{ color: accent }}>▸</Text>
                </>
              )}
            </Text>
          </Pressable>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Pressable
              onPress={() => canEditGenres && router.push('/onboarding/genres')}
              disabled={!canEditGenres}
              hitSlop={6}
              style={[
                styles.genreChip,
                {
                  borderColor: canEditGenres ? accent : palette.inkFaint,
                  borderStyle: canEditGenres ? 'solid' : 'dashed',
                },
              ]}
            >
              <Text style={[styles.genreChipText, { color: canEditGenres ? accent : palette.inkDim }]}>
                {inRoom && !isHost ? '↪ ' : '▦ '}
                {summarizeGenres(effectiveGenres)}
              </Text>
            </Pressable>
            {inRoom ? (
              <Pressable
                onPress={() => router.push('/party/room')}
                hitSlop={6}
                style={[styles.genreChip, { borderColor: palette.lime }]}
              >
                <Text style={[styles.genreChipText, { color: palette.lime }]}>
                  ◉ {room.members.length} CREW
                </Text>
              </Pressable>
            ) : (
              <Pressable
                onPress={() => router.push('/party')}
                hitSlop={6}
                style={[styles.genreChip, { borderColor: palette.lime }]}
              >
                <Text style={[styles.genreChipText, { color: palette.lime }]}>▴ PARTY</Text>
              </Pressable>
            )}
          </View>
          {/* mode segment — ALL / IN CINEMA / STREAMING */}
          <View style={styles.modeRow}>
            {(['all', 'cinema', 'streaming'] as const).map((m) => {
              const active = mode === m;
              const label = m === 'all' ? 'ALL' : m === 'cinema' ? 'IN CINEMA' : 'STREAMING';
              return (
                <Pressable
                  key={m}
                  onPress={() => setMode(m)}
                  hitSlop={4}
                  style={[
                    styles.modeSeg,
                    {
                      borderColor: active ? accent : palette.inkFaint,
                      backgroundColor: active ? `${accent}22` : 'transparent',
                    },
                  ]}
                >
                  <Text style={[styles.modeSegText, { color: active ? accent : palette.inkDim }]}>
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View style={styles.topRight}>
          <View style={styles.chipRow}>
            <Pressable
              onPress={() => router.push('/watchlist')}
              hitSlop={10}
              style={styles.chip}
            >
              <Text style={[styles.chipText, { color: accent }]}>
                ▣ LIST {queueList.length ? `· ${queueList.length}` : ''}
              </Text>
            </Pressable>
            <Pressable onPress={() => openMenu()} hitSlop={10} style={styles.chip}>
              <Text style={[styles.chipText, { color: palette.ink }]}>⋯ MORE</Text>
            </Pressable>
          </View>
          <Text style={styles.counter}>
            {loading ? '...' : `${remaining}${exhausted ? '' : '+'} LEFT`}
            {source === 'sample' && !loading ? ' · OFFLINE' : ''}
          </Text>
        </View>
      </View>

      {/* loading tracking bar — shows when refetching but we still have cards visible */}
      {loadingMore && queue.length > 0 ? <LoadingBar accent={accent} /> : null}

      {/* deck area */}
      <View style={styles.deckWrap}>
        {/* back-card peek */}
        {back ? (
          <Animated.View key={`back-${index + 1}`} style={[styles.cardSlot, backStyle]}>
            <MovieCard movie={back} isFront={false} />
          </Animated.View>
        ) : null}

        {/* hard offset shadow behind front card */}
        {front ? (
          <View pointerEvents="none" style={[styles.frontShadow, { backgroundColor: accent }]} />
        ) : null}

        {/* front card */}
        {front ? (
          <GestureDetector gesture={composedGesture}>
            <Animated.View key={`front-${index}`} style={[styles.cardSlot, frontStyle]}>
              <MovieCard movie={front} isFront />
              {/* tinted direction overlays */}
              <Animated.View
                pointerEvents="none"
                style={[styles.dirOverlay, { backgroundColor: accent }, overlayStyles.queue]}
              >
                <Text style={[styles.dirLabel, { color: palette.bg }]}>QUEUE</Text>
              </Animated.View>
              <Animated.View
                pointerEvents="none"
                style={[styles.dirOverlay, { backgroundColor: palette.inkDim }, overlayStyles.nope]}
              >
                <Text style={[styles.dirLabel, { color: palette.bg }]}>NOPE</Text>
              </Animated.View>
              <Animated.View
                pointerEvents="none"
                style={[styles.dirOverlay, { backgroundColor: palette.yellow }, overlayStyles.seen]}
              >
                <Text style={[styles.dirLabel, { color: palette.bg }]}>SEEN</Text>
              </Animated.View>
              <Animated.View
                pointerEvents="none"
                style={[styles.dirOverlay, { backgroundColor: palette.cyan }, overlayStyles.later]}
              >
                <Text style={[styles.dirLabel, { color: palette.bg }]}>LATER</Text>
              </Animated.View>
            </Animated.View>
          </GestureDetector>
        ) : loading || loadingMore ? (
          <View style={[styles.cardSlot, styles.empty]}>
            <Text style={styles.emptyText}>TRACKING…</Text>
            <Text style={styles.emptySub}>LOADING THE NEXT REEL</Text>
          </View>
        ) : (
          <View style={[styles.cardSlot, styles.empty]}>
            <Text style={styles.emptyText}>END OF TAPE</Text>
            <Text style={styles.emptySub}>NO MORE FILMS IN THE QUEUE</Text>
            <Pressable onPress={() => reset()} hitSlop={10} style={[styles.resetCta, { borderColor: accent }]}>
              <Text style={[styles.resetCtaText, { color: accent }]}>↺ REWIND TAPE</Text>
            </Pressable>
          </View>
        )}
      </View>

      {/* 4 action buttons */}
      <View style={[styles.actions, { bottom: insets.bottom + sizes.bottomActions }]}>
        <ActionButton dir="left" label="NOPE" color={palette.inkDim} onPress={() => triggerSwipe('left')} />
        <ActionButton dir="down" label="LATER" color={palette.cyan} onPress={() => triggerSwipe('down')} />
        <ActionButton dir="up" label="SEEN" color={palette.yellow} variant="sm" onPress={() => triggerSwipe('up')} />
        <ActionButton dir="right" label="QUEUE" color={accent} variant="lg" onPress={() => triggerSwipe('right')} />
      </View>

      {/* match celebration overlay */}
      {room.latestMatch ? <MatchOverlay match={room.latestMatch} onDismiss={room.dismissMatch} /> : null}
    </VHSBackground>
  );
}

const styles = StyleSheet.create({
  topChrome: {
    paddingHorizontal: spacing.edge,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modeLabel: {
    ...text.monoSm,
    color: palette.inkFaint,
  },
  title: {
    ...text.displaySm,
    color: palette.ink,
  },
  topRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: palette.inkFaint,
    borderStyle: 'dashed',
  },
  genreChip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
  },
  genreChipText: {
    ...text.monoSm,
    fontSize: 11,
    letterSpacing: 1.5,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 4,
  },
  modeSeg: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
  },
  modeSegText: {
    ...text.monoSm,
    fontSize: 10,
    letterSpacing: 1.5,
  },
  chipText: {
    ...text.monoSm,
    fontSize: 11,
    color: palette.inkDim,
    letterSpacing: 1.5,
  },
  counter: {
    ...text.monoMd,
    color: palette.inkDim,
  },
  deckWrap: {
    marginHorizontal: spacing.edge,
    marginTop: spacing.section,
    height: sizes.cardHeight,
  },
  cardSlot: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  frontShadow: {
    position: 'absolute',
    top: 6,
    left: 6,
    right: -6,
    bottom: -6,
  },
  dirOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dirLabel: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 64,
    letterSpacing: -2,
    transform: [{ rotate: '-8deg' }],
  },
  actions: {
    position: 'absolute',
    left: 0,
    right: 0,
    paddingHorizontal: 28,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: palette.tape,
    borderWidth: 1,
    borderColor: palette.inkFaint,
  },
  emptyText: {
    ...text.displayMd,
    color: palette.ink,
  },
  emptySub: {
    ...text.monoSm,
    color: palette.inkDim,
    marginTop: 8,
  },
  resetCta: {
    marginTop: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 2,
  },
  resetCtaText: {
    ...text.monoMd,
    letterSpacing: 2,
  },
});
