import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = '@reelmatch/user/v1';

export type DeckMode = 'all' | 'cinema' | 'streaming';

export type UserState = {
  name: string;
  genres: number[]; // TMDB genre IDs
  onboarded: boolean;
  mode: DeckMode;
};

const DEFAULT: UserState = { name: '', genres: [], onboarded: false, mode: 'all' };

type ContextValue = UserState & {
  hydrated: boolean;
  setName: (name: string) => void;
  setGenres: (genres: number[]) => void;
  setMode: (mode: DeckMode) => void;
  completeOnboarding: () => void;
  reset: () => void;
};

const UserContext = createContext<ContextValue | null>(null);

export function UserProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<UserState>(DEFAULT);
  const [hydrated, setHydrated] = useState(false);

  // load on mount
  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (cancelled) return;
        if (raw) {
          try {
            const parsed = JSON.parse(raw) as Partial<UserState>;
            setState({ ...DEFAULT, ...parsed });
          } catch {
            // corrupt — fall back to defaults
          }
        }
        setHydrated(true);
      })
      .catch(() => setHydrated(true));
    return () => {
      cancelled = true;
    };
  }, []);

  // persist on every change (after hydration)
  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state)).catch(() => {});
  }, [state, hydrated]);

  const setName = useCallback((name: string) => setState((s) => ({ ...s, name })), []);
  const setGenres = useCallback((genres: number[]) => setState((s) => ({ ...s, genres })), []);
  const setMode = useCallback((mode: DeckMode) => setState((s) => ({ ...s, mode })), []);
  const completeOnboarding = useCallback(() => setState((s) => ({ ...s, onboarded: true })), []);
  const reset = useCallback(() => setState(DEFAULT), []);

  const value = useMemo<ContextValue>(
    () => ({ ...state, hydrated, setName, setGenres, setMode, completeOnboarding, reset }),
    [state, hydrated, setName, setGenres, setMode, completeOnboarding, reset],
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used inside UserProvider');
  return ctx;
}
