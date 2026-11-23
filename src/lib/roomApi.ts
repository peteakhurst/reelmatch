import { supabase } from './supabase';
import type { SampleMovie } from '../data/sampleMovies';
import type { DeckMode } from '../state/user';

export type Direction = 'left' | 'right' | 'up' | 'down';

export type RoomSnapshot = {
  code: string;
  host_id: string;
  genres: number[];
  mode: DeckMode;
  members: { id: string; name: string; joined_at: number }[];
  swipes: { member_id: string; movie_id: number; direction: Direction; movie: SampleMovie | null }[];
};

/**
 * Thrown when the persistence functions aren't deployed (migration not run).
 * Callers fall back to live-only rooms.
 */
export class RoomPersistenceUnavailable extends Error {}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    // PGRST202 = function not found in schema cache → migration not applied.
    if (error.code === 'PGRST202' || /could not find the function/i.test(error.message)) {
      throw new RoomPersistenceUnavailable(error.message);
    }
    throw new Error(error.message);
  }
  return data as T;
}

/** Trim the movie down to what other phones need to render a match. */
function slimMovie(m: SampleMovie): SampleMovie {
  return {
    id: m.id,
    title: m.title,
    release_date: m.release_date,
    poster_path: m.poster_path,
    backdrop_path: m.backdrop_path,
    vote_average: m.vote_average,
    overview: m.overview.slice(0, 600),
    genre_ids: m.genre_ids,
    runtime: m.runtime,
    genre: m.genre,
    trailerKey: m.trailerKey,
    providers: m.providers,
    watchLink: m.watchLink,
  };
}

export const roomApi = {
  get: (code: string) => rpc<RoomSnapshot | null>('room_get', { p_code: code }),
  create: (code: string, memberId: string, name: string, genres: number[], mode: DeckMode) =>
    rpc<RoomSnapshot>('room_create', {
      p_code: code,
      p_member_id: memberId,
      p_name: name,
      p_genres: genres,
      p_mode: mode,
    }),
  join: (code: string, memberId: string, name: string) =>
    rpc<RoomSnapshot | null>('room_join', { p_code: code, p_member_id: memberId, p_name: name }),
  swipe: (code: string, memberId: string, movie: SampleMovie, direction: Direction) =>
    rpc<void>('room_swipe', {
      p_code: code,
      p_member_id: memberId,
      p_movie_id: movie.id,
      p_direction: direction,
      p_movie: slimMovie(movie),
    }),
  update: (code: string, memberId: string, genres: number[], mode: DeckMode) =>
    rpc<void>('room_update', { p_code: code, p_member_id: memberId, p_genres: genres, p_mode: mode }),
  leave: (code: string, memberId: string) =>
    rpc<void>('room_leave', { p_code: code, p_member_id: memberId }),
  slimMovie,
};
