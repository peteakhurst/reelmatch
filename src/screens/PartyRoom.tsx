import { Redirect, useRouter } from 'expo-router';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Image } from 'expo-image';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { TapeLabel } from '../components/TapeLabel';
import { VHSBackground } from '../components/VHSOverlay';
import { posterUrl } from '../lib/api';
import { useRoomContext } from '../state/room';
import { palette, spacing, text, useAccent } from '../theme';

const MEMBER_COLORS = [palette.cyan, palette.lime, palette.yellow, palette.magenta];

export function PartyRoom() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { hex: accent } = useAccent();
  const { code, members, status, commonGround, leaveRoom } = useRoomContext();

  if (!code) {
    // not in a room — bounce to the create/join screen
    return <Redirect href="/party" />;
  }

  const copyCode = async () => {
    Haptics.selectionAsync().catch(() => {});
    await Clipboard.setStringAsync(code);
  };

  const shareCode = () =>
    Share.share({
      message: `Join my ReelMatch room — code: ${code}`,
    });

  const start = () => {
    router.push('/');
  };

  const leave = () => {
    leaveRoom();
    router.replace('/');
  };

  return (
    <VHSBackground>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + 60,
          paddingBottom: insets.bottom + 110,
          paddingHorizontal: spacing.edge,
          gap: 22,
        }}
      >
        {/* room header */}
        <View>
          <View style={styles.headerRow}>
            <Text style={[styles.eyebrow, { color: accent }]}>MOVIE NIGHT · {status === 'connected' ? 'LIVE' : status.toUpperCase()}</Text>
            <View style={[styles.recDot, { opacity: status === 'connected' ? 1 : 0.3 }]} />
          </View>
          <Text style={styles.title}>
            ROOM <Text style={{ color: accent }}>#</Text>{code}
          </Text>
          <View style={styles.actionRow}>
            <Pressable onPress={copyCode} hitSlop={6} style={[styles.dashedChip, { borderColor: accent }]}>
              <Text style={[text.monoSm, { color: accent, letterSpacing: 1.5 }]}>⧉ COPY CODE</Text>
            </Pressable>
            <Pressable onPress={shareCode} hitSlop={6} style={[styles.dashedChip, { borderColor: accent }]}>
              <Text style={[text.monoSm, { color: accent, letterSpacing: 1.5 }]}>↗ SHARE</Text>
            </Pressable>
          </View>
        </View>

        {/* crew grid */}
        <View>
          <TapeLabel color={palette.lime}>{`CREW · ${members.length}`}</TapeLabel>
          <View style={[styles.crewGrid, { marginTop: 10 }]}>
            {members.length === 0 ? (
              <Text style={[text.body, { color: palette.inkDim }]}>WAITING…</Text>
            ) : (
              members.map((m, i) => {
                const c = MEMBER_COLORS[i % MEMBER_COLORS.length];
                return (
                  <View key={m.id} style={[styles.crewCell, { borderColor: c }]}>
                    <View style={[styles.avatar, { backgroundColor: c }]}>
                      <Text style={[styles.avatarText, { color: palette.bg }]}>
                        {m.name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[text.displayXs, { color: palette.ink }]} numberOfLines={1}>
                        {m.name}
                      </Text>
                      <Text style={[text.monoSm, { color: c, letterSpacing: 1.5 }]}>JOINED</Text>
                    </View>
                  </View>
                );
              })
            )}
          </View>
        </View>

        {/* common ground */}
        <View style={[styles.commonPanel, { borderColor: accent }]}>
          <View style={styles.headerRow}>
            <TapeLabel color={accent}>COMMON GROUND</TapeLabel>
            <View style={[styles.recDot, { backgroundColor: palette.red }]} />
            <Text style={[text.monoSm, { color: palette.red, letterSpacing: 2 }]}>LIVE</Text>
          </View>
          <Text style={styles.commonCount}>
            <Text style={{ color: accent, fontSize: 48 }}>{commonGround.length}</Text>
            <Text style={{ color: palette.inkDim, fontSize: 22 }}> common</Text>
          </Text>
          <Text style={[text.monoSm, { color: palette.inkFaint, letterSpacing: 1.5 }]}>
            FILMS EVERYONE QUEUED SO FAR
          </Text>

          <View style={styles.posterGrid}>
            {commonGround.length ? (
              commonGround.slice(0, 8).map((m) => {
                const p = posterUrl(m.poster_path, 'w342');
                return (
                  <View key={m.id} style={[styles.posterCell, { borderColor: accent }]}>
                    {p ? (
                      <Image source={{ uri: p }} style={styles.poster} contentFit="cover" />
                    ) : (
                      <View style={[styles.poster, { backgroundColor: palette.tape }]} />
                    )}
                  </View>
                );
              })
            ) : (
              <View style={[styles.placeholder, { borderColor: palette.inkFaint }]}>
                <Text style={[text.monoSm, { color: palette.inkFaint, letterSpacing: 1.5 }]}>
                  KEEP SWIPING
                </Text>
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* sticky CTAs */}
      <View style={[styles.cta, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable onPress={leave} style={[styles.ghostBtn, { borderColor: palette.inkFaint }]}>
          <Text style={[text.monoMd, { color: palette.inkDim }]}>◂ LEAVE</Text>
        </Pressable>
        <Pressable onPress={start} style={[styles.solidBtn, { backgroundColor: accent }]}>
          <Text style={[text.monoMd, { color: palette.bg }]}>▸ SWIPE TOGETHER</Text>
        </Pressable>
      </View>
    </VHSBackground>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  eyebrow: { ...text.monoSm, letterSpacing: 2.5 },
  title: { ...text.displayLg, color: palette.ink, marginTop: 8 },
  recDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: palette.red },
  actionRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  dashedChip: { paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderStyle: 'dashed' },
  crewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  crewCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 10,
    borderWidth: 1.5,
    width: '48%',
    backgroundColor: palette.tape,
  },
  avatar: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  avatarText: { ...text.displayXs, letterSpacing: 0 },
  commonPanel: {
    borderWidth: 1.5,
    backgroundColor: palette.tape,
    padding: 14,
    gap: 6,
  },
  commonCount: { fontFamily: 'SpaceGrotesk_700Bold', marginTop: 4 },
  posterGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  posterCell: { width: '23%', aspectRatio: 3 / 4, borderWidth: 1.5 },
  poster: { width: '100%', height: '100%' },
  placeholder: {
    width: '100%',
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  cta: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: spacing.edge,
    paddingTop: 12,
    backgroundColor: 'rgba(10,6,18,0.95)',
    borderTopWidth: 1,
    borderTopColor: palette.inkFaint,
    flexDirection: 'row',
    gap: 10,
  },
  ghostBtn: { flex: 1, paddingVertical: 14, borderWidth: 1.5, alignItems: 'center' },
  solidBtn: { flex: 2, paddingVertical: 14, alignItems: 'center' },
});
