import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { VHSBackground } from '../components/VHSOverlay';
import { useRoomContext } from '../state/room';
import { palette, spacing, text, useAccent } from '../theme';

export function PartyEntry() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { hex: accent } = useAccent();
  const { joinRoom, generateCode } = useRoomContext();
  const [draft, setDraft] = useState('');

  const enter = (code: string) => {
    Haptics.selectionAsync().catch(() => {});
    joinRoom(code);
    router.replace('/party/room');
  };

  const create = () => enter(generateCode());

  const join = () => {
    const code = draft.trim().toUpperCase();
    if (code.length < 4) return;
    enter(code);
  };

  return (
    <VHSBackground>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={[styles.container, { paddingTop: insets.top + 60, paddingBottom: insets.bottom + 24 }]}>
          <View style={{ gap: 14 }}>
            <View style={styles.headerRow}>
              <Text style={[styles.eyebrow, { color: accent }]}>MOVIE NIGHT</Text>
              <Text style={[styles.cursor, { color: accent }]}>▮</Text>
            </View>
            <Text style={styles.title}>BRING YOUR CREW.</Text>
            <Text style={styles.body}>
              Spin up a room or punch in a friend's code. Everyone swipes the same deck — match
              when you both queue the same film.
            </Text>

            {/* CREATE */}
            <Pressable
              onPress={create}
              style={({ pressed }) => [
                styles.primary,
                { backgroundColor: accent, opacity: pressed ? 0.85 : 1, marginTop: 12 },
              ]}
            >
              <Text style={[styles.primaryText, { color: palette.bg }]}>▸ NEW ROOM</Text>
            </Pressable>

            {/* OR */}
            <View style={styles.orRow}>
              <View style={styles.hr} />
              <Text style={[styles.orText, { color: palette.inkFaint }]}>— OR —</Text>
              <View style={styles.hr} />
            </View>

            {/* JOIN */}
            <View style={{ gap: 10 }}>
              <Text style={[styles.inputLabel, { color: accent }]}>ROOM CODE</Text>
              <TextInput
                value={draft}
                onChangeText={(v) => setDraft(v.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
                placeholder="7K3X9Q"
                placeholderTextColor={palette.inkFaint}
                style={[styles.input, { borderColor: accent }]}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={6}
                returnKeyType="join"
                onSubmitEditing={join}
                selectionColor={accent}
              />
              <Pressable
                onPress={join}
                disabled={draft.length < 4}
                style={({ pressed }) => [
                  styles.secondary,
                  {
                    borderColor: draft.length >= 4 ? accent : palette.inkFaint,
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text style={[styles.secondaryText, { color: draft.length >= 4 ? accent : palette.inkDim }]}>
                  JOIN ROOM ▸
                </Text>
              </Pressable>
            </View>
          </View>

          {/* back to deck */}
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.backBtn}>
            <Text style={[text.monoMd, { color: palette.inkDim }]}>◂ BACK TO SOLO DECK</Text>
          </Pressable>
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
  },
  eyebrow: { ...text.monoSm, letterSpacing: 2.5 },
  cursor: { ...text.monoSm, fontSize: 14 },
  title: { ...text.displayLg, color: palette.ink },
  body: { ...text.bodyLg, color: palette.inkDim },
  primary: {
    paddingVertical: 18,
    alignItems: 'center',
  },
  primaryText: { ...text.displaySm, letterSpacing: 0 },
  orRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginVertical: 6 },
  hr: { flex: 1, height: 1, backgroundColor: palette.inkFaint },
  orText: { ...text.monoSm, letterSpacing: 2 },
  inputLabel: { ...text.monoSm, letterSpacing: 2 },
  input: {
    ...text.displayMd,
    color: palette.ink,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 2,
    backgroundColor: palette.tape,
    letterSpacing: 4,
  },
  secondary: {
    paddingVertical: 16,
    borderWidth: 2,
    alignItems: 'center',
  },
  secondaryText: { ...text.monoMd, letterSpacing: 2 },
  backBtn: { alignSelf: 'center', paddingVertical: 12 },
});
