import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import type { SampleMovie } from '../data/sampleMovies';
import { posterUrl } from '../lib/api';
import { palette, text, useAccent } from '../theme';
import { StreamingChip } from './StreamingChip';

type Props = {
  movie: SampleMovie;
  isFront: boolean;
};

export function MovieCard({ movie }: Props) {
  const { hex: accent } = useAccent();
  const poster = posterUrl(movie.poster_path, 'w780');

  return (
    <View style={[styles.card, { borderColor: accent, shadowColor: palette.black }]}>
      {poster ? (
        <Image source={{ uri: poster }} style={styles.poster} contentFit="cover" transition={150} />
      ) : (
        <View style={[styles.poster, { backgroundColor: palette.tape }]} />
      )}

      {/* meta badge top-left */}
      <View style={[styles.recBadge, { borderColor: accent }]}>
        <View style={styles.recDot} />
        <Text style={styles.recText}>
          {movie.runtime ? `${movie.genre} · ${movie.runtime}m` : movie.genre}
        </Text>
      </View>

      {/* genre badge top-right */}
      <View style={[styles.genreBadge, { borderColor: accent }]}>
        <Text style={[styles.genreText, { color: accent }]}>{movie.genre}</Text>
      </View>

      {/* rating bottom-right (above synopsis area) */}
      <View style={[styles.ratingBadge, { borderColor: accent }]}>
        <Text style={styles.ratingLabel}>RATING</Text>
        <Text style={styles.ratingValue}>
          <Text style={{ color: accent }}>{movie.vote_average.toFixed(1)}</Text>
          <Text style={styles.ratingDenom}>/10</Text>
        </Text>
      </View>

      {/* gradient + title + synopsis at bottom */}
      <View style={styles.bottomGradient} pointerEvents="none">
        <View style={styles.titleRow}>
          <Text style={styles.title} numberOfLines={1}>
            {movie.title}
          </Text>
          {movie.release_date ? (
            <Text style={styles.year}>{movie.release_date.slice(0, 4)}</Text>
          ) : null}
        </View>
        <Text style={styles.synopsis} numberOfLines={2}>
          “{movie.overview}”
        </Text>
        {movie.providers.length ? (
          <View style={styles.chipsRow}>
            {movie.providers.map((p) => (
              <StreamingChip
                key={`${p.type}-${p.name}`}
                name={p.type === 'flatrate' ? p.name : `${p.name} · RENT`}
                color={p.type === 'flatrate' ? accent : palette.inkDim}
              />
            ))}
          </View>
        ) : (
          <View style={styles.chipsRow}>
            <StreamingChip name="NOT STREAMING" color={palette.inkDim} />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: palette.tape,
    borderWidth: 1.5,
    overflow: 'hidden',
  },
  poster: {
    ...StyleSheet.absoluteFillObject,
  },
  recBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
  },
  recDot: {
    width: 8,
    height: 8,
    backgroundColor: palette.red,
    borderRadius: 4,
  },
  recText: {
    ...text.monoSm,
    color: palette.ink,
    letterSpacing: 1,
  },
  genreBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
  },
  genreText: {
    ...text.monoSm,
    letterSpacing: 1.5,
  },
  ratingBadge: {
    position: 'absolute',
    bottom: 170,
    right: 12,
    backgroundColor: '#000',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    alignItems: 'flex-start',
  },
  ratingLabel: {
    ...text.monoSm,
    fontSize: 11,
    color: palette.inkDim,
    letterSpacing: 1,
  },
  ratingValue: {
    fontFamily: 'SpaceGrotesk_700Bold',
    fontSize: 20,
    lineHeight: 22,
  },
  ratingDenom: {
    color: palette.inkDim,
    fontSize: 13,
  },
  bottomGradient: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 28,
    paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.92)',
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginBottom: 6,
  },
  title: {
    ...text.displayMd,
    color: palette.ink,
    flexShrink: 1,
  },
  year: {
    ...text.monoMd,
    color: palette.inkDim,
    letterSpacing: 1.5,
  },
  synopsis: {
    ...text.body,
    fontStyle: 'italic',
    color: palette.ink,
    marginBottom: 10,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
});
