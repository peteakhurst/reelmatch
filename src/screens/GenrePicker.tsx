import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { VHSBackground } from '../components/VHSOverlay';
import { ONBOARDING_GENRES } from '../lib/genres';
import { useUser } from '../state/user';
import { palette, spacing, text, useAccent, useContentWidth } from '../theme';

const COLUMNS = 3;
const GAP = 10;
const MIN_PICKS = 3;

export function GenrePicker() {
  const contentW = useContentWidth();
  const CARD_W = (contentW - spacing.edge * 2 - GAP * (COLUMNS - 1)) / COLUMNS;
  const CARD_H = CARD_W * (4 / 3);
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { hex: accent } = useAccent();
  const { genres: existing, setGenres, completeOnboarding, onboarded } = useUser();
  const [picked, setPicked] = useState<Set<number>>(new Set(existing));

  const togglePick = (id: number) => {
    Haptics.selectionAsync().catch(() => {});
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const canContinue = picked.size >= MIN_PICKS;

  const onContinue = () => {
    if (!canContinue) return;
    setGenres([...picked]);
    // First-time onboarding: blow away the signup→genres stack and land on the
    // deck. Mid-session edit (already onboarded): just pop back where you came
    // from so you keep your place in whatever flow opened the picker.
    if (onboarded && router.canGoBack()) {
      router.back();
    } else {
      completeOnboarding();
      router.replace('/');
    }
  };

  return (
    <VHSBackground>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 60,
          paddingBottom: insets.bottom + 120,
          paddingHorizontal: spacing.edge,
        }}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Text style={[styles.step, { color: accent }]}>STEP 3 / 3 · TASTE PROFILE</Text>
          <Text style={[styles.cursor, { color: accent }]}>▮</Text>
        </View>
        <Text style={styles.title}>WHAT DO YOU WATCH?</Text>
        <Text style={styles.body}>Pick at least 3 to seed your deck. You can change these later.</Text>

        <View style={styles.grid}>
          {ONBOARDING_GENRES.map((g) => {
            const isPicked = picked.has(g.id);
            return (
              <Pressable
                key={g.id}
                onPress={() => togglePick(g.id)}
                style={[
                  styles.cell,
                  {
                    width: CARD_W,
                    height: CARD_H,
                    borderColor: isPicked ? accent : palette.inkFaint,
                    borderWidth: isPicked ? 2 : 1,
                  },
                ]}
              >
                {/* hard offset shadow when selected */}
                {isPicked ? (
                  <View
                    pointerEvents="none"
                    style={[styles.cellShadow, { width: CARD_W, height: CARD_H, backgroundColor: accent }]}
                  />
                ) : null}
                <View style={styles.cellInner}>
                  <Text style={[styles.cellLabel, { color: isPicked ? palette.ink : palette.inkDim }]}>
                    {g.label}
                  </Text>
                </View>
                {isPicked ? (
                  <View style={[styles.checkChip, { backgroundColor: accent }]}>
                    <Text style={[styles.checkText, { color: palette.bg }]}>✓</Text>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>

      {/* sticky CTA */}
      <View style={[styles.footer, { paddingBottom: insets.bottom + 16 }]}>
        <Text style={[styles.counter, { color: canContinue ? accent : palette.inkDim }]}>
          {picked.size} SELECTED
        </Text>
        <Pressable
          onPress={onContinue}
          disabled={!canContinue}
          style={({ pressed }) => [
            styles.cta,
            {
              backgroundColor: canContinue ? accent : palette.tape,
              borderColor: canContinue ? accent : palette.inkFaint,
              opacity: pressed ? 0.85 : 1,
            },
          ]}
        >
          <Text style={[styles.ctaText, { color: canContinue ? palette.bg : palette.inkDim }]}>
            CONTINUE ▸
          </Text>
        </Pressable>
      </View>
    </VHSBackground>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 14,
  },
  step: {
    ...text.monoSm,
    letterSpacing: 2.5,
  },
  cursor: {
    ...text.monoSm,
    fontSize: 14,
  },
  title: {
    ...text.displayLg,
    color: palette.ink,
    marginBottom: 14,
  },
  body: {
    ...text.bodyLg,
    color: palette.inkDim,
    marginBottom: 28,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: GAP,
  },
  cell: {
    backgroundColor: palette.tape,
    overflow: 'visible',
  },
  cellShadow: {
    position: 'absolute',
    top: 5,
    left: 5,
    zIndex: -1,
  },
  cellInner: {
    flex: 1,
    padding: 10,
    justifyContent: 'flex-end',
  },
  cellLabel: {
    ...text.displayXs,
    letterSpacing: -0.4,
  },
  checkChip: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    ...text.monoSm,
    fontSize: 14,
    letterSpacing: 0,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.edge,
    paddingTop: 14,
    backgroundColor: 'rgba(10,6,18,0.95)',
    borderTopWidth: 1,
    borderTopColor: palette.inkFaint,
    gap: 10,
  },
  counter: {
    ...text.monoSm,
    letterSpacing: 2,
  },
  cta: {
    paddingVertical: 18,
    borderWidth: 2,
    alignItems: 'center',
  },
  ctaText: {
    ...text.displaySm,
    letterSpacing: 0,
  },
});
