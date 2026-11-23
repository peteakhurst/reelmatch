import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useUser } from './user';
import { useRoom, type Member, type RoomIntent } from '../hooks/useRoom';

type ContextValue = Omit<ReturnType<typeof useRoom>, 'leave' | 'updateSettings'> & {
  code: string | null;
  /** In a room that exists (code set and not "not found"). */
  active: boolean;
  myId: string | null;
  isHost: boolean;
  /** Join an existing room, or create it with `{ create: true }`. */
  joinRoom: (code: string, opts?: { create?: boolean }) => void;
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
const ROOM_STORAGE_KEY = '@reelmatch/room/v1';

/**
 * Stable per-install user id. Persists across reloads via AsyncStorage so
 * rejoining a room gives the same identity instead of looking like a
 * brand-new person every time. Memoized on (id, name, joinedAt) so the
 * useRoom effect doesn't tear down the Supabase channel on every render.
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

  return useMemo<Member | null>(() => (name && id ? { id, name, joinedAt } : null), [name, id, joinedAt]);
}

export function RoomProvider({ children }: { children: ReactNode }) {
  const { genres, mode } = useUser();
  const [code, setCode] = useState<string | null>(null);
  const [intent, setIntent] = useState<RoomIntent>({ create: false, genres, mode });
  const restoredRef = useRef(false);
  const me = useStableMember();
  const prefs = useMemo(() => ({ genres, mode }), [genres, mode]);
  const { leave, updateSettings, ...room } = useRoom(code, me, intent, prefs);

  // Rooms persist — rejoin the last one on launch.
  useEffect(() => {
    AsyncStorage.getItem(ROOM_STORAGE_KEY)
      .then((saved) => {
        if (saved) {
          restoredRef.current = true;
          setCode((c) => c ?? saved);
        }
      })
      .catch(() => {});
  }, []);

  const joinRoom = useCallback(
    (c: string, opts?: { create?: boolean }) => {
      const upper = c.toUpperCase();
      restoredRef.current = false;
      setIntent({ create: !!opts?.create, genres, mode });
      setCode(upper);
      AsyncStorage.setItem(ROOM_STORAGE_KEY, upper).catch(() => {});
    },
    [genres, mode],
  );

  const leaveRoom = useCallback(() => {
    void leave();
    setCode(null);
    AsyncStorage.removeItem(ROOM_STORAGE_KEY).catch(() => {});
  }, [leave]);

  // A room we auto-rejoined on launch has since been deleted → quietly drop it.
  useEffect(() => {
    if (room.status === 'not_found' && restoredRef.current) {
      restoredRef.current = false;
      setCode(null);
      AsyncStorage.removeItem(ROOM_STORAGE_KEY).catch(() => {});
    }
  }, [room.status]);

  const myId = me?.id ?? null;
  const isHost = !!room.settings && room.settings.hostId === myId;

  // The host's own genre/mode picks drive the room's shared deck.
  useEffect(() => {
    if (!isHost || !room.persisted || room.status !== 'connected' || !room.settings) return;
    const same =
      room.settings.mode === mode &&
      room.settings.genres.length === genres.length &&
      room.settings.genres.every((g, i) => g === genres[i]);
    if (!same) updateSettings(genres, mode).catch((err) => console.warn('[room] settings update failed', err));
  }, [isHost, room.persisted, room.status, room.settings, genres, mode, updateSettings]);

  const value = useMemo<ContextValue>(
    () => ({
      ...room,
      code,
      active: !!code && room.status !== 'not_found',
      myId,
      isHost,
      joinRoom,
      leaveRoom,
      generateCode: makeCode,
    }),
    [room, code, myId, isHost, joinRoom, leaveRoom],
  );

  return <RoomContext.Provider value={value}>{children}</RoomContext.Provider>;
}

export function useRoomContext() {
  const ctx = useContext(RoomContext);
  if (!ctx) throw new Error('useRoomContext must be used inside RoomProvider');
  return ctx;
}
