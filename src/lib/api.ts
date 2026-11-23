import Constants from 'expo-constants';

const BASE_URL: string =
  (Constants.expoConfig?.extra as { apiBaseUrl?: string } | undefined)?.apiBaseUrl ??
  'http://localhost:8787';

export type TMDBMovie = {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  vote_average: number;
  overview: string;
  genre_ids?: number[];
  runtime?: number;
};

export type TMDBVideo = {
  key: string;
  site: 'YouTube' | string;
  type: 'Trailer' | 'Teaser' | 'Clip' | string;
  official: boolean;
  size: number;
  name?: string;
};

export type MovieDetail = TMDBMovie & {
  runtime: number;
  genres: { id: number; name: string }[];
  videos: { results: TMDBVideo[] };
  credits: { cast: { id: number; name: string; character: string; profile_path: string | null }[] };
};

export type PagedMovies = { page?: number; total_pages?: number; results: TMDBMovie[] };

export const posterUrl = (path: string | null, size: 'w342' | 'w500' | 'w780' | 'original' = 'w500') =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : null;

async function fetchJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`API ${res.status}: ${path}`);
  return res.json() as Promise<T>;
}

export const api = {
  discover: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetchJson<PagedMovies>(`/discover${qs ? `?${qs}` : ''}`);
  },
  nowPlaying: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return fetchJson<PagedMovies>(`/now-playing${qs ? `?${qs}` : ''}`);
  },
  movie: (id: number) => fetchJson<MovieDetail>(`/movie/${id}`),
  pickTrailerKey: (videos: TMDBVideo[] | undefined) => {
    const keys = api.pickTrailerKeys(videos);
    return keys[0] ?? null;
  },
  /**
   * Returns an ordered list of YouTube candidate keys to try, best-first.
   * Specialty trailers (ASL, IMAX, named-event variants) often have stricter
   * embed restrictions than the canonical "Official Trailer", so we deprioritize
   * those. Many "official" videos still have embedding disabled (YT 101/150) or
   * playback misconfig (153) — keep the rest as fallbacks for runtime retry.
   */
  pickTrailerKeys: (videos: TMDBVideo[] | undefined): string[] => {
    if (!videos?.length) return [];
    const yt = videos.filter((v) => v.site === 'YouTube');

    // Lower score = appears earlier (we sort ascending). Combines type, name
    // shape, official flag, and resolution into a single deterministic ordering.
    const SPECIALTY = /(ASL|sign\s*language|IMAX|70mm|deaf|spanish|dub|spotify)/i;
    const CANONICAL = /^official\s+trailer(\s*(\d+|us|uk|international))?$/i;
    const TRAILERY = /trailer/i;

    const score = (v: TMDBVideo) => {
      let s = 0;
      if (v.type === 'Trailer') s += 0;
      else if (v.type === 'Teaser') s += 200;
      else if (v.type === 'Clip') s += 400;
      else s += 600;

      const name = v.name ?? '';
      if (CANONICAL.test(name)) s -= 80;
      else if (TRAILERY.test(name) && !SPECIALTY.test(name)) s -= 40;
      if (SPECIALTY.test(name)) s += 120;

      if (!v.official) s += 5;
      if (v.size && v.size >= 1080) s -= 2;
      return s;
    };

    return yt
      .slice()
      .sort((a, b) => score(a) - score(b))
      .map((v) => v.key)
      .filter((k, i, arr) => arr.indexOf(k) === i);
  },
};

export const API_BASE_URL = BASE_URL;
