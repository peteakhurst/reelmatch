import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type TMDBMovie } from '../lib/api';
import { pickGenreLabel } from '../lib/genres';
import { SAMPLE_MOVIES, type ProviderChip, type SampleMovie } from '../data/sampleMovies';
import { useUser } from '../state/user';
import { useRoomContext } from '../state/room';
import { useWatchlist, type ListName, type WatchlistEntry } from '../state/watchlist';
import type { WatchProvidersByRegion } from './useMovie';

const REGION = 'AU';
const MAX_PROVIDERS = 3;
/** Fetch the next page once this many unswiped cards remain. */
const PREFETCH_AT = 6;
/** Enrich (runtime, trailer, providers) this many cards ahead of the cursor. */
const ENRICH_AHEAD = 4;
/** "Later" snoozes a film for this long before it can reappear. */
const LATER_SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;
/** If a whole page is already-swiped, keep pulling up to this many pages in one go. */
const MAX_EMPTY_PAGE_SKIPS = 4;

function extractProviders(raw: unknown): ProviderChip[] {
  const wp = (raw as { 'watch/providers'?: WatchProvidersByRegion })['watch/providers'];
  const region = wp?.results?.[REGION];
  if (!region) return [];
  const flat = (region.flatrate ?? []).map((p) => ({ name: p.provider_name, type: 'flatrate' as const }));
  const rent = (region.rent ?? []).map((p) => ({ name: p.provider_name, type: 'rent' as const }));
  return [...flat, ...rent].slice(0, MAX_PROVIDERS);
}

function extractWatchLink(raw: unknown): string | null {
  const wp = (raw as { 'watch/providers'?: WatchProvidersByRegion })['watch/providers'];
  return wp?.results?.[REGION]?.link ?? null;
}

/** Bare card from a list result — enriched later once it nears the front. */
function toCard(m: TMDBMovie): SampleMovie {
  return {
    ...m,
    runtime: 0,
    genre: pickGenreLabel(m.genre_ids),
    trailerKey: null,
    providers: [],
    watchLink: null,
  };
}

type Lists = Record<ListName, WatchlistEntry[]>;

/**
 * Ids that shouldn't be dealt again: anything queued, seen or noped, plus
 * "later" films still inside their snooze window.
 */
function buildExcludeSet(lists: Lists, now = Date.now()): Set<number> {
  const out = new Set<number>();
  for (const e of lists.queue) out.add(e.movie.id);
  for (const e of lists.seen) out.add(e.movie.id);
  for (const e of lists.nope) out.add(e.movie.id);
  for (const e of lists.later) if (now - e.addedAt < LATER_SNOOZE_MS) out.add(e.movie.id);
  return out;
}

type State = {
  movies: SampleMovie[];
  /** Initial load of a fresh deck (no cards yet). */
  loading: boolean;
  /** Fetching another page while cards are still on screen. */
  loadingMore: boolean;
  /** True once TMDB has no more pages for this filter. */
  exhausted: boolean;
  error: string | null;
  source: 'live' | 'sample';
  /** Changes whenever a brand-new deck is dealt — the deck resets its cursor on this. */
  deckKey: string;
};

type Result = State & { refetch: () => void };

/**
 * Endless swipe queue. Pulls /discover (or /now-playing) page by page,
 * prefetching the next page as the user nears the end, and lazily enriches
 * the cards just ahead of `cursor` with runtime/trailer/providers.
 *
 * Solo: films already on any list (or snoozed via LATER) are filtered out so
 * they don't come back. In a room we only skip films *you've* swiped in that
 * room — a film you queued solo still needs to count for the room's match.
 *
 * Falls back to the bundled SAMPLE_MOVIES if the first page can't load.
 */
export function useMovieQueue(cursor: number): Result {
  const { genres: myGenres, mode: myMode } = useUser();
  const room = useRoomContext();
  const watchlist = useWatchlist();
  const inRoom = room.active;
  const roomCode = room.code;
  // In a room everyone deals from the host's filter (stored on the room) so
  // phones see the same films in the same order. OR semantics ('|') because
  // TMDB treats commas as AND, which collapses the set on most combos.
  const effectiveGenres = inRoom ? (room.settings?.genres ?? []) : myGenres;
  const mode = inRoom ? (room.settings?.mode ?? 'all') : myMode;
  const genreKey = effectiveGenres.join('|');
  // Don't deal a room deck until we know the room's filter.
  const ready = !inRoom || !!room.settings;
  const [generation, setGeneration] = useState(0);
  const deckKey = `${genreKey}/${mode}/${inRoom ? roomCode : 'solo'}/${ready ? 'ready' : 'wait'}/${generation}`;

  const [state, setState] = useState<State>({
    movies: [],
    loading: true,
    loadingMore: false,
    exhausted: false,
    error: null,
    source: 'live',
    deckKey,
  });

  // Mutable bookkeeping that shouldn't trigger renders.
  const deckRef = useRef(deckKey);
  const pageRef = useRef(0);
  const totalPagesRef = useRef(Infinity);
  const fetchingRef = useRef(false);
  const enrichedRef = useRef<Set<number>>(new Set());
  const enrichingRef = useRef<Set<number>>(new Set());
  // Read the latest lists at fetch time without making them a dependency —
  // otherwise every swipe (which writes a list) would re-deal the deck.
  const listsRef = useRef<Lists>(watchlist);
  listsRef.current = watchlist;
  const inRoomRef = useRef(inRoom);
  inRoomRef.current = inRoom;
  // Films I've already swiped in this room (stored server-side, so this
  // survives reinstalls and works across sessions).
  const myRoomSwipesRef = useRef<Record<number, unknown>>({});
  myRoomSwipesRef.current = (room.myId && room.swipes[room.myId]) || {};

  const fetchPage = useCallback(
    async (page: number) => {
      const params: Record<string, string> = { page: String(page) };
      if (mode === 'cinema') return api.nowPlaying(params);
      if (genreKey) params.with_genres = genreKey;
      if (mode === 'streaming') {
        // Only films with at least one subscription provider in our region.
        params.with_watch_monetization_types = 'flatrate';
        params.watch_region = REGION;
      }
      return api.discover(params);
    },
    [genreKey, mode],
  );

  /** Pull pages until we gain at least one new card (or run out). */
  const loadMore = useCallback(async () => {
    if (fetchingRef.current) return;
    const myDeck = deckRef.current;
    fetchingRef.current = true;
    setState((s) => ({ ...s, loadingMore: s.movies.length > 0, loading: s.movies.length === 0 }));
    try {
      let added: SampleMovie[] = [];
      for (let i = 0; i < MAX_EMPTY_PAGE_SKIPS && !added.length; i++) {
        const next = pageRef.current + 1;
        if (next > totalPagesRef.current) break;
        const res = await fetchPage(next);
        if (deckRef.current !== myDeck) return; // deck changed mid-flight
        pageRef.current = next;
        totalPagesRef.current = Math.min(res.total_pages ?? Infinity, 500); // TMDB caps at 500
        const exclude = inRoomRef.current
          ? new Set(Object.keys(myRoomSwipesRef.current).map(Number))
          : buildExcludeSet(listsRef.current);
        added = res.results.filter((m) => !exclude.has(m.id)).map(toCard);
        if (added.length) {
          setState((s) => {
            const have = new Set(s.movies.map((m) => m.id));
            const fresh = added.filter((m) => !have.has(m.id));
            return { ...s, movies: [...s.movies, ...fresh], source: 'live', error: null };
          });
        }
      }
      setState((s) => ({
        ...s,
        loading: false,
        loadingMore: false,
        exhausted: pageRef.current >= totalPagesRef.current,
      }));
    } catch (err) {
      if (deckRef.current !== myDeck) return;
      const message = err instanceof Error ? err.message : 'fetch failed';
      setState((s) =>
        s.movies.length
          ? { ...s, loading: false, loadingMore: false, error: message }
          : { ...s, movies: SAMPLE_MOVIES, loading: false, loadingMore: false, error: message, source: 'sample', exhausted: true },
      );
    } finally {
      if (deckRef.current === myDeck) fetchingRef.current = false;
    }
  }, [fetchPage]);

  // Deal a fresh deck whenever the filter / room / generation changes.
  useEffect(() => {
    deckRef.current = deckKey;
    pageRef.current = 0;
    totalPagesRef.current = Infinity;
    fetchingRef.current = false;
    enrichedRef.current = new Set();
    enrichingRef.current = new Set();
    setState({
      movies: [],
      loading: true,
      loadingMore: false,
      exhausted: false,
      error: null,
      source: 'live',
      deckKey,
    });
    if (ready) loadMore();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckKey]);

  // Prefetch the next page as the cursor approaches the end.
  const { movies, exhausted, source } = state;
  useEffect(() => {
    if (!ready || state.deckKey !== deckKey || source === 'sample' || exhausted) return;
    if (movies.length && movies.length - cursor <= PREFETCH_AT) loadMore();
  }, [ready, cursor, movies.length, exhausted, source, loadMore, state.deckKey, deckKey]);

  // Enrich the cards just ahead of the cursor.
  useEffect(() => {
    if (source === 'sample') return;
    const myDeck = deckRef.current;
    const window = movies.slice(cursor, cursor + ENRICH_AHEAD);
    for (const m of window) {
      if (enrichedRef.current.has(m.id) || enrichingRef.current.has(m.id)) continue;
      enrichingRef.current.add(m.id);
      api
        .movie(m.id)
        .then((full) => {
          if (deckRef.current !== myDeck) return;
          enrichedRef.current.add(m.id);
          const patch: Partial<SampleMovie> = {
            runtime: full.runtime ?? 0,
            genre: pickGenreLabel(m.genre_ids?.length ? m.genre_ids : full.genres?.map((g) => g.id)),
            trailerKey: api.pickTrailerKey(full.videos?.results),
            providers: extractProviders(full),
            watchLink: extractWatchLink(full),
          };
          setState((s) => ({
            ...s,
            movies: s.movies.map((x) => (x.id === m.id ? { ...x, ...patch } : x)),
          }));
        })
        .catch(() => {
          // Leave the bare card; mark done so we don't hammer a failing id.
          enrichedRef.current.add(m.id);
        })
        .finally(() => enrichingRef.current.delete(m.id));
    }
  }, [cursor, movies, source]);

  const refetch = useCallback(() => setGeneration((g) => g + 1), []);

  // Until the reset effect runs for a new deckKey, don't leak the old deck.
  if (state.deckKey !== deckKey) {
    return { ...state, movies: [], loading: true, loadingMore: false, exhausted: false, deckKey, refetch };
  }
  return { ...state, refetch };
}
