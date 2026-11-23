import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { SampleMovie } from '../data/sampleMovies';

const STORAGE_KEY = '@reelmatch/watchlist/v1';
const MAX_PER_LIST = 200;

export type ListName = 'queue' | 'later' | 'seen' | 'nope';

export type WatchlistEntry = {
  movie: SampleMovie;
  addedAt: number; // epoch ms
};

type Lists = Record<ListName, WatchlistEntry[]>;

const EMPTY: Lists = { queue: [], later: [], seen: [], nope: [] };

type ContextValue = Lists & {
  hydrated: boolean;
  add: (list: ListName, movie: SampleMovie) => void;
  remove: (list: ListName, movieId: number) => void;
  /** Look up which list (if any) currently holds this movie. */
  whereIs: (movieId: number) => ListName | null;
  clearAll: () => void;
};

const WatchlistContext = createContext<ContextValue | null>(null);

export function WatchlistProvider({ children }: { children: ReactNode }) {
  const [lists, setLists] = useState<Lists>(EMPTY);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled) return;
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as Partial<Lists>;
            setLists({ ...EMPTY, ...parsed });
          } catch {
            // ignore
          }
        }
        setHydrated(true);
      })
      .catch(() => setHydrated(true));
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(lists)).catch(() => {});
  }, [lists, hydrated]);

  const add = useCallback((list: ListName, movie: SampleMovie) => {
    setLists((prev) => {
      const next: Lists = { ...prev };
      // remove the movie from every list first so it can't appear twice
      for (const k of Object.keys(next) as ListName[]) {
        next[k] = next[k].filter((e) => e.movie.id !== movie.id);
      }
      const entry: WatchlistEntry = { movie, addedAt: Date.now() };
      next[list] = [entry, ...next[list]].slice(0, MAX_PER_LIST);
      return next;
    });
  }, []);

  const remove = useCallback((list: ListName, movieId: number) => {
    setLists((prev) => ({
      ...prev,
      [list]: prev[list].filter((e) => e.movie.id !== movieId),
    }));
  }, []);

  const whereIs = useCallback(
    (movieId: number): ListName | null => {
      for (const k of Object.keys(lists) as ListName[]) {
        if (lists[k].some((e) => e.movie.id === movieId)) return k;
      }
      return null;
    },
    [lists],
  );

  const clearAll = useCallback(() => setLists(EMPTY), []);

  const value = useMemo<ContextValue>(
    () => ({ ...lists, hydrated, add, remove, whereIs, clearAll }),
    [lists, hydrated, add, remove, whereIs, clearAll],
  );

  return <WatchlistContext.Provider value={value}>{children}</WatchlistContext.Provider>;
}

export function useWatchlist() {
  const ctx = useContext(WatchlistContext);
  if (!ctx) throw new Error('useWatchlist must be used inside WatchlistProvider');
  return ctx;
}
