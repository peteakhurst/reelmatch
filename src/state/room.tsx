import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { useUser } from './user';
import { useRoom, type Member } from '../hooks/useRoom';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect } from 'react';

type ContextValue = ReturnType<typeof useRoom> & {
  code: string | null;
  myId: string | null;
  joinRoom: (code: string) => void;
  leaveRoom: () => void;
  generateCode: () => string;
};

const RoomContext = createContext<ContextValue | null>(null);

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 to avoid confusion
function makeCode(len = 6) {
  let out = '';
  for (let i = 0; i < len; i++) out += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return out;
}

const ID_STORAGE_KEY = '@reelmatch/memberId/v1';

/**
 * Stable per-install user id. Persists across reloads via AsyncStorage so
 * rejoining a room (or hot-reload during dev) gives the same identity instead
 * of looking like a brand-new person every time. The returned Member object is
 * memoized on (id, name, joinedAt) so the useRoom effect doesn't tear down the
 * Supabase channel on every render.
 */
function useStableMember(): Member | null {
  const { name } = useUser();
  const [id, setId] = useState<string | null>(null);
  const [joinedAt] = useState(() => Date.now());

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(ID_STORAGE_KEY).then((existing) => {
      if (cancelled) return;
      if (existing) {
        setId(existing);
      } else {
        const fresh = `m_${Math.random().toString(36).slice(2, 10)}`;
        AsyncStorage.setItem(ID_STORAGE_KEY, fresh).catch(() => {});
        setId(fresh);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return useMemo<Member | null>(
    () => (name && id ? { id, name, joinedAt } : null),
    [name, id, joinedAt],
  );
}

export function RoomProvider({ children }: { children: ReactNode }) {
  const { genres } = useUser();
  const [code, setCode] = useState<string | null>(null);
  const baseMember = useStableMember();
  // Attach the user's current genre picks so other members can adopt the
  // host's selection — keeps the deck identical across phones.
  const me = useMemo<Member | null>(
    () => (baseMember ? { ...baseMember, genres } : null),
    [baseMember, genres],
  );
  const room = useRoom(code, me);

  const joinRoom = useCallback((c: string) => setCode(c.toUpperCase()), []);
  const leaveRoom = useCallback(() => setCode(null), []);

  const value = useMemo<ContextValue>(
    () => ({ ...room, code, myId: me?.id ?? null, joinRoom, leaveRoom, generateCode: makeCode }),
    [room, code, me, joinRoom, leaveRoom],
  );

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoomContext() {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error('useRoomContext must be used inside RoomProvider');
  return ctx;
}
