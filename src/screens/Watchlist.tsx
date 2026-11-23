import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { posterUrl } from '../lib/api';
import { useWatchlist, type ListName, type WatchlistEntry } from '../state/watchlist';
import { palette, spacing, text, useAccent } from '../theme';
import { VHSBackground } from '../components/VHSOverlay';

const TABS: { id: ListName; label: string; color: keyof typeof TAB_COLORS }[] = [
  { id: 'queue', label: 'QUEUE', color: 'accent' },
  { id: 'later', label: 'LATER', color: 'cyan' },
  { id: 'seen', label: 'SEEN', color: 'yellow' },
];

const TAB_COLORS = {
  accent: palette.magenta, // overridden by useAccent below
  cyan: palette.cyan,
  yellow: palette.yellow,
} as const;

export function Watchlist() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { hex: accent } = useAccent();
  const wl = useWatchlist();
  const [activeTab, setActiveTab] = useState<ListName>('queue');

  const colorFor = (key: keyof typeof TAB_COLORS) => (key === 'accent' ? accent : TAB_COLORS[key]);
  const entries = wl[activeTab];
  const counts: Record<ListName, number> = {
    queue: wl.queue.length,
    later: wl.later.length,
    seen: wl.seen.length,
    nope: wl.nope.length,
  };

  return (
    <VHSBackground>
      {/* top chrome */}
      <View style={[styles.topChrome, { paddingTop: insets.top + 8 }]}>
        <View>
          <Text style={[styles.modeLabel, { color: palette.inkFaint }]}>YOUR LISTS</Text>
          <Text style={styles.title}>
            WATCHLIST <Text style={{ color: accent }}>▸</Text>
          </Text>
        </View>
        <Pressable onPress={() => router.back()} hitSlop={10} style={[styles.backChip, { borderColor: accent }]}>
          <Text style={[styles.backText, { color: accent }]}>◂ DECK</Text>
        </Pressable>
      </View>

      {/* tab bar */}
      <View style={styles.tabRow}>
        {TABS.map((t) => {
          const c = colorFor(t.color);
          const active = activeTab === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => setActiveTab(t.id)}
              style={[
                styles.tab,
                {
                  borderColor: active ? c : palette.inkFaint,
                  backgroundColor: active ? `${c}22` : 'transparent',
                },
              ]}
            >
              <Text style={[styles.tabLabel, { color: active ? c : palette.inkDim }]}>
                {t.label}
              </Text>
              <Text style={[styles.tabCount, { color: active ? c : palette.inkFaint }]}>
                {counts[t.id]}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {entries.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[text.displayMd, { color: palette.ink }]}>NOTHING HERE</Text>
          <Text style={[text.monoSm, { color: palette.inkDim, marginTop: 8 }]}>
            SWIPE SOME CARDS TO FILL THIS LIST
          </Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(e) => String(e.movie.id)}
          contentContainerStyle={{ paddingHorizontal: spacing.edge, paddingBottom: insets.bottom + 24 }}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          renderItem={({ item }) => (
            <Row
              entry={item}
              accent={accent}
              tabColor={colorFor(TABS.find((t) => t.id === activeTab)!.color)}
              onOpen={() => router.push(`/movie/${item.movie.id}`)}
              onRemove={() => wl.remove(activeTab, item.movie.id)}
            />
          )}
        />
      )}
    </VHSBackground>
  );
}

function Row({
  entry,
  accent,
  tabColor,
  onOpen,
  onRemove,
}: {
  entry: WatchlistEntry;
  accent: string;
  tabColor: string;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const { movie } = entry;
  const poster = posterUrl(movie.poster_path, 'w342');
  const year = movie.release_date?.slice(0, 4) ?? '';
  const subProvider = movie.providers.find((p) => p.type === 'flatrate');

  return (
    <Pressable onPress={onOpen} style={[styles.row, { borderColor: tabColor }]}>
      {poster ? (
        <Image source={{ uri: poster }} style={styles.thumb} contentFit="cover" />
      ) : (
        <View style={[styles.thumb, { backgroundColor: palette.tape }]} />
      )}
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>{movie.title}</Text>
        <Text style={styles.rowMeta} numberOfLines={1}>
          {year}
          {movie.runtime ? ` · ${movie.runtime}m` : ''} · {movie.genre} · ★{movie.vote_average.toFixed(1)}
        </Text>
        <Text style={[styles.rowProvider, { color: subProvider ? accent : palette.inkFaint }]} numberOfLines={1}>
          {subProvider ? subProvider.name.toUpperCase() : 'NOT STREAMING'}
        </Text>
      </View>
      <Pressable onPress={onRemove} hitSlop={10} style={styles.removeBtn}>
        <Text style={[text.monoMd, { color: palette.inkDim }]}>×</Text>
      </Pressable>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topChrome: {
    paddingHorizontal: spacing.edge,
    paddingBottom: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  modeLabel: {
    ...text.monoSm,
  },
  title: {
    ...text.displaySm,
    color: palette.ink,
  },
  backChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderStyle: 'dashed',
  },
  backText: {
    ...text.monoSm,
    letterSpacing: 1.5,
  },
  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: spacing.edge,
    gap: 6,
    marginBottom: 14,
  },
  tab: {
    flex: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1.5,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tabLabel: {
    ...text.monoMd,
    letterSpacing: 1.5,
  },
  tabCount: {
    ...text.monoMd,
  },
  row: {
    flexDirection: 'row',
    backgroundColor: palette.tape,
    borderWidth: 1.5,
    padding: 10,
    gap: 12,
    alignItems: 'center',
  },
  thumb: {
    width: 56,
    height: 80,
  },
  rowBody: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    ...text.displayXs,
    color: palette.ink,
  },
  rowMeta: {
    ...text.monoSm,
    color: palette.inkDim,
  },
  rowProvider: {
    ...text.monoSm,
    letterSpacing: 1.5,
  },
  removeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
