// TMDB movie genre IDs → short uppercase labels for the UI.
// Static map from /genre/movie/list (rarely changes; bundling it avoids an extra round-trip).
export const TMDB_GENRES: Record<number, string> = {
  28: 'ACTION',
  12: 'ADVENTURE',
  16: 'ANIMATION',
  35: 'COMEDY',
  80: 'CRIME',
  99: 'DOCS',
  18: 'DRAMA',
  10751: 'FAMILY',
  14: 'FANTASY',
  36: 'HISTORY',
  27: 'HORROR',
  10402: 'MUSIC',
  9648: 'MYSTERY',
  10749: 'ROMANCE',
  878: 'SCI-FI',
  10770: 'TV MOVIE',
  53: 'THRILLER',
  10752: 'WAR',
  37: 'WESTERN',
};

export function pickGenreLabel(genreIds: number[] | undefined): string {
  if (!genreIds?.length) return 'FILM';
  for (const id of genreIds) if (TMDB_GENRES[id]) return TMDB_GENRES[id];
  return 'FILM';
}

/**
 * Genres surfaced in the onboarding picker — the 9 the README spec calls out,
 * each tied to its TMDB genre ID so we can pass a CSV to /discover?with_genres=.
 */
export const ONBOARDING_GENRES: { id: number; label: string }[] = [
  { id: 27, label: 'HORROR' },
  { id: 878, label: 'SCI-FI' },
  { id: 10749, label: 'ROMANCE' },
  { id: 28, label: 'ACTION' },
  { id: 35, label: 'COMEDY' },
  { id: 18, label: 'DRAMA' },
  { id: 53, label: 'THRILLER' },
  { id: 99, label: 'DOCS' },
  { id: 16, label: 'ANIMATION' },
];
