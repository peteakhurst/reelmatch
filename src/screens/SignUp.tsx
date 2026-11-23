import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VHSBackground } from '../components/VHSOverlay';
import { useUser } from '../state/user';
import { palette, spacing, text, useAccent } from '../theme';

export function SignUp() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { hex: accent } = useAccent();
  const { name, setName } = useUser();
  const [draft, setDraft] = useState(name);

  const trimmed = draft.trim();
  const canContinue = trimmed.length >= 2;

  const onContinue = () => {
    if (!canContinue) return;
    setName(trimmed);
    router.push('/onboarding/genres');
  };

  return (
    <VHSBackground>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.container, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 24 }]}>
          <View>
            <View style={styles.headerRow}>
              <Text style={[styles.step, { color: accent }]}>STEP 2 / 3 · LABEL THE TAPE</Text>
              <Text style={[styles.cursor, { color: accent }]}>▮</Text>
            </View>
            <Text style={styles.title}>WHO ARE YOU?</Text>
            <Text style={styles.body}>
              Pick a name your crew will see when you join a room. You can change this later.
            </Text>

            <View style={styles.inputWrap}>
              <Text style={[styles.inputLabel, { color: accent }]}>NAME</Text>
              <TextInput
                value={draft}
                onChangeText={setDraft}
                placeholder="MAX HEADROOM"
                placeholderTextColor={palette.inkFaint}
                style={[styles.input, { borderColor: accent }]}
                autoFocus
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={32}
                returnKeyType="next"
                onSubmitEditing={onContinue}
                selectionColor={accent}
              />
              <Text style={styles.helper}>{trimmed.length}/32 · 2 minimum</Text>
            </View>
          </View>

          <View>
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
        </View>
      </KeyboardAvoidingView>
    </VHSBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.edge,
    justifyContent: 'space-between',
  },
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
    marginBottom: 36,
  },
  inputWrap: {
    gap: 10,
  },
  inputLabel: {
    ...text.monoSm,
    letterSpacing: 2,
  },
  input: {
    ...text.displayMd,
    color: palette.ink,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 2,
    backgroundColor: palette.tape,
  },
  helper: {
    ...text.monoSm,
    color: palette.inkFaint,
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
