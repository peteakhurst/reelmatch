import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import WebView, { WebViewMessageEvent } from 'react-native-webview';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TapeLabel } from '../components/TapeLabel';
import { VHSBackground } from '../components/VHSOverlay';
import { useMovie, type EnrichedMovie } from '../hooks/useMovie';
import { posterUrl } from '../lib/api';
import { pickGenreLabel } from '../lib/genres';
import { useWatchlist } from '../state/watchlist';
import type { ProviderChip, SampleMovie } from '../data/sampleMovies';
import { palette, spacing, text, useAccent, useContentWidth } from '../theme';

const REGION = 'AU';

/**
 * Adapter: the detail screen pulls a richer payload than the deck card; this
 * narrows it down to the SampleMovie shape the watchlist stores. Keeps the
 * watchlist self-contained so cards rendered from disk look identical to ones
 * coming straight off the deck.
 */
function toSampleMovie(d: EnrichedMovie): SampleMovie {
  const region = d.watchProviders?.results?.[REGION];
  const flat: ProviderChip[] = (region?.flatrate ?? []).map((p) => ({ name: p.provider_name, type: 'flatrate' }));
  const rent: ProviderChip[] = (region?.rent ?? []).map((p) => ({ name: p.provider_name, type: 'rent' }));
  return {
    id: d.id,
    title: d.title,
    release_date: d.release_date,
    poster_path: d.poster_path,
    backdrop_path: d.backdrop_path,
    vote_average: d.vote_average,
    overview: d.overview,
    runtime: d.runtime ?? 0,
    genre: pickGenreLabel(d.genres?.map((g) => g.id)),
    trailerKey: d.trailerKey,
    providers: [...flat, ...rent].slice(0, 3),
    watchLink: region?.link ?? null,
  };
}

const BACKDROP_H = 380;
const BODY_OVERLAP = 140;

export function MovieDetail({ id }: { id: number }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { hex: accent } = useAccent();
  const { movie, loading, error } = useMovie(id);
  const { add, remove, whereIs } = useWatchlist();
  const currentList = whereIs(id);

  if (loading) {
    return (
      <VHSBackground>
        <View style={styles.center}>
          <ActivityIndicator color={accent} />
        </View>
      </VHSBackground>
    );
  }

  if (error || !movie) {
    return (
      <VHSBackground>
        <View style={styles.center}>
          <Text style={[text.monoMd, { color: palette.inkDim }]}>FAILED TO LOAD</Text>
          <Pressable onPress={() => router.back()} style={[styles.backBtn, { borderColor: accent, marginTop: 16 }]}>
            <Text style={[text.monoMd, { color: accent }]}>◂ BACK</Text>
          </Pressable>
        </View>
      </VHSBackground>
    );
  }

  const backdrop = posterUrl(movie.backdrop_path ?? movie.poster_path, 'w780');
  const year = movie.release_date?.slice(0, 4) ?? '';
  const genreLabel = pickGenreLabel(movie.genres?.map((g) => g.id));
  const cast = movie.credits?.cast?.slice(0, 6) ?? [];

  return (
    <VHSBackground>
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 140 }}
        showsVerticalScrollIndicator={false}
      >
        {/* backdrop */}
        <View style={styles.backdropWrap}>
          {backdrop ? (
            <Image source={{ uri: backdrop }} style={styles.backdrop} contentFit="cover" />
          ) : (
            <View style={[styles.backdrop, { backgroundColor: palette.tape }]} />
          )}
          <View style={styles.backdropFade} pointerEvents="none" />
        </View>

        {/* top buttons */}
        <View style={[styles.topBar, { top: insets.top + 8 }]} pointerEvents="box-none">
          <Pressable onPress={() => router.back()} hitSlop={10} style={[styles.backBtn, { borderColor: accent }]}>
            <Text style={[text.monoMd, { color: accent }]}>◂ BACK</Text>
          </Pressable>
        </View>

        {/* body overlapping backdrop */}
        <View style={[styles.body, { marginTop: -BODY_OVERLAP }]}>
          <TapeLabel color={accent}>{`NOW SHOWING · ${year || '—'}`}</TapeLabel>

          <Text style={[styles.title, { color: palette.ink }]} numberOfLines={2}>
            {movie.title}
          </Text>

          <View style={styles.metaRow}>
            <Text style={styles.metaItem}>{movie.runtime ? `${movie.runtime}m` : '—'}</Text>
            <Text style={styles.metaSep}>·</Text>
            <Text style={styles.metaItem}>{genreLabel}</Text>
            <Text style={styles.metaSep}>·</Text>
            <Text style={[styles.metaItem, { color: accent }]}>★ {movie.vote_average.toFixed(1)}</Text>
          </View>

          {/* trailer player — tries each candidate, falls back to a YouTube link */}
          <TrailerPlayer keys={movie.trailerKeys} accent={accent} />

          {/* synopsis */}
          <View style={styles.section}>
            <TapeLabel color={palette.cyan}>SYNOPSIS</TapeLabel>
            <Text style={[text.bodyLg, { color: palette.ink, marginTop: 10 }]}>{movie.overview}</Text>
          </View>

          {/* watch providers */}
          <WhereToWatch movie={movie} accent={accent} />

          {/* cast */}
          {cast.length ? (
            <View style={styles.section}>
              <TapeLabel color={palette.lime}>CAST</TapeLabel>
              <View style={{ marginTop: 10 }}>
                {cast.map((c, i) => (
                  <View
                    key={c.id}
                    style={[styles.castRow, i === cast.length - 1 ? null : styles.castDivider]}
                  >
                    <Text style={[text.body, { color: palette.ink }]} numberOfLines={1}>
                      {c.name}
                    </Text>
                    <Text style={[text.monoSm, { color: palette.inkDim }]} numberOfLines={1}>
                      {c.character || '—'}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      {/* sticky bottom CTA */}
      <View style={[styles.cta, { paddingBottom: insets.bottom + 16 }]}>
        <Pressable
          onPress={() =>
            currentList === 'later' ? remove('later', id) : add('later', toSampleMovie(movie))
          }
          style={[
            styles.ghostBtn,
            {
              borderColor: palette.cyan,
              backgroundColor: currentList === 'later' ? `${palette.cyan}22` : 'transparent',
            },
          ]}
        >
          <Text style={[text.monoMd, { color: palette.cyan }]}>
            {currentList === 'later' ? '✓ LATER' : '+ LATER'}
          </Text>
        </Pressable>
        <Pressable
          onPress={() =>
            currentList === 'queue' ? remove('queue', id) : add('queue', toSampleMovie(movie))
          }
          style={[
            styles.solidBtn,
            {
              backgroundColor: currentList === 'queue' ? palette.tape : accent,
              borderWidth: currentList === 'queue' ? 1.5 : 0,
              borderColor: accent,
            },
          ]}
        >
          <Text
            style={[
              text.monoMd,
              { color: currentList === 'queue' ? accent : palette.bg },
            ]}
          >
            {currentList === 'queue' ? '✓ IN QUEUE' : '♥ ADD TO QUEUE'}
          </Text>
        </Pressable>
      </View>
    </VHSBackground>
  );
}

function TrailerPlayer({ keys, accent }: { keys: string[]; accent: string }) {
  const trailerW = useContentWidth() - spacing.edge * 2;
  const trailerH = Math.round((trailerW * 9) / 16);
  const key = keys[0];

  if (!key) {
    return (
      <View
        style={[
          styles.trailerWrap,
          styles.trailerEmpty,
          { width: trailerW, height: trailerH, borderColor: palette.inkFaint },
        ]}
      >
        <Text style={[text.monoMd, { color: palette.inkDim }]}>NO TRAILER ON FILE</Text>
      </View>
    );
  }

  // Plain iframe — the referrer is what matters most. Setting baseUrl to a real
  // public site means the WebView sends a proper Referer header, which YouTube
  // requires before it'll initialize the player for some videos (else: error 153).
  const html = `<!DOCTYPE html><html><head>
<meta name="viewport" content="width=device-width,initial-scale=1,user-scalable=no" />
<meta name="referrer" content="strict-origin-when-cross-origin" />
<style>html,body{margin:0;padding:0;background:#000;height:100%;overflow:hidden}
iframe{position:absolute;inset:0;width:100%;height:100%;border:0}</style>
</head><body>
<iframe
  src="https://www.youtube.com/embed/${key}?playsinline=1&modestbranding=1&rel=0&iv_load_policy=3&fs=1"
  referrerpolicy="strict-origin-when-cross-origin"
  allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
  allowfullscreen></iframe>
</body></html>`;

  return (
    <View style={[styles.trailerWrap, { width: trailerW, height: trailerH, borderColor: accent }]}>
      <WebView
        originWhitelist={['*']}
        source={{ html, baseUrl: 'https://www.themoviedb.org/' }}
        style={{ flex: 1, backgroundColor: '#000' }}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
        sharedCookiesEnabled
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction
        mixedContentMode="always"
        allowsFullscreenVideo
      />
      <View style={styles.trailerLabel}>
        <Text style={[text.monoSm, { color: accent, letterSpacing: 1.5 }]}>▸ TRAILER</Text>
      </View>
    </View>
  );
}

function WhereToWatch({
  movie,
  accent,
}: {
  movie: { watchProviders?: import('../hooks/useMovie').WatchProvidersByRegion };
  accent: string;
}) {
  const region = movie.watchProviders?.results?.AU;
  const flat = region?.flatrate ?? [];
  const rent = region?.rent ?? [];

  return (
    <View style={styles.section}>
      <TapeLabel color={palette.yellow}>WHERE TO WATCH</TapeLabel>
      {flat.length || rent.length ? (
        <View style={{ marginTop: 10, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {flat.map((p) => (
            <View key={`f-${p.provider_id}`} style={[styles.providerChip, { borderColor: accent }]}>
              <Text style={[text.monoSm, { color: accent, letterSpacing: 1.5 }]}>
                {p.provider_name.toUpperCase()}
              </Text>
            </View>
          ))}
          {rent.map((p) => (
            <View key={`r-${p.provider_id}`} style={[styles.providerChip, { borderColor: palette.inkDim }]}>
              <Text style={[text.monoSm, { color: palette.inkDim, letterSpacing: 1.5 }]}>
                {p.provider_name.toUpperCase()} · RENT
              </Text>
            </View>
          ))}
        </View>
      ) : (
        <Text style={[text.body, { color: palette.inkDim, marginTop: 10 }]}>
          NOT CURRENTLY STREAMING
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdropWrap: {
    height: BACKDROP_H,
    width: '100%',
    overflow: 'hidden',
  },
  backdrop: {
    height: '100%',
    width: '100%',
  },
  backdropFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 220,
    backgroundColor: 'transparent',
    // simple two-layer fade — RN doesn't do real linear gradients without expo-linear-gradient,
    // so we lay a translucent solid + a stronger one near the bottom
  },
  topBar: {
    position: 'absolute',
    left: spacing.edge,
    right: spacing.edge,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  backBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1.5,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  body: {
    paddingHorizontal: spacing.edge,
    paddingTop: 16,
    paddingBottom: 24,
    gap: 14,
    backgroundColor: palette.bg,
  },
  title: {
    ...text.displayLg,
    fontSize: 36,
    letterSpacing: -1.2,
    marginTop: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: -4,
  },
  metaItem: {
    ...text.monoMd,
    color: palette.inkDim,
  },
  metaSep: {
    ...text.monoMd,
    color: palette.inkFaint,
  },
  section: {
    marginTop: 6,
  },
  trailerWrap: {
    borderWidth: 1.5,
    marginTop: 4,
    overflow: 'hidden',
  },
  trailerEmpty: {
    backgroundColor: palette.tape,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  openYtBtn: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1.5,
  },
  trailerLabel: {
    position: 'absolute',
    top: 8,
    left: 8,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  providerChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  castRow: {
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  castDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: palette.inkFaint,
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
  ghostBtn: {
    flex: 1,
    paddingVertical: 14,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  solidBtn: {
    flex: 2,
    paddingVertical: 14,
    alignItems: 'center',
  },
});
