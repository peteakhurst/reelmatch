import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { roomApi, RoomPersistenceUnavailable, type Direction, type RoomSnapshot } from '../lib/roomApi';
import type { SampleMovie } from '../data/sampleMovies';
import type { DeckMode } from '../state/user';

export type Member = {
  id: string;
  name: string;
  joinedAt: number;
  /** Currently has the app open in this room (Realtime presence). */
  online?: boolean;
};

export type Swipe = { movieId: number; direction: Direction };

export type MatchEvent = {
  movie: SampleMovie;
  members: Member[];
  at: number;
};

/** The deck filter everyone in the room shares — owned by the host. */
export type RoomSettings = { hostId: string; genres: number[]; mode: DeckMode };

export type RoomStatus = 'connecting' | 'connected' | 'disconnected' | 'not_found';

/** What the local user wants the room to start with if they're creating it. */
export type RoomIntent = { create: boolean; genres: number[]; mode: DeckMode };

type SwipeMap = Record<string, Record<number, Direction>>;

type RoomState = {
  status: RoomStatus;
  /** False when the Supabase functions aren't deployed → live-only fallback. */
  persisted: boolean;
  roster: Member[];
  settings: RoomSettings | null;
  onlineIds: string[];
  /** Presence payloads — only used by the live-only fallback. */
  presence: (Member & { genres?: number[]; mode?: DeckMode })[];
  swipes: SwipeMap;
  commonGround: SampleMovie[];
  latestMatch: MatchEvent | null;
};

type Result = Omit<RoomState, 'roster' | 'presence' | 'onlineIds'> & {
  /** Everyone in the room (online or not), oldest first. */
  members: Member[];
  broadcastSwipe: (movie: SampleMovie, direction: Direction) => void;
  dismissMatch: () => void;
  /** Host-only: change the shared deck filter. */
  updateSettings: (genres: number[], mode: DeckMode) => Promise<void>;
  /** Leave for good (drops your swipes from the room). */
  leave: () => Promise<void>;
};

const EMPTY: RoomState = {
  status: 'connecting',
  persisted: true,
  roster: [],
  settings: null,
  onlineIds: [],
  presence: [],
  swipes: {},
  commonGround: [],
  latestMatch: null,
};

const matchedKey = (code: string) => `@reelmatch/matched/${code}`;

function swipesFromSnapshot(snap: RoomSnapshot, cache: Record<number, SampleMovie>): SwipeMap {
  const out: SwipeMap = {};
  for (const s of snap.swipes) {
    (out[s.member_id] ??= {})[s.movie_id] = s.direction;
    if (s.movie) cache[s.movie_id] = s.movie;
  }
  return out;
}

/** Union of two swipe maps; `b` wins on conflicts. */
function mergeSwipes(a: SwipeMap, b: SwipeMap): SwipeMap {
  const out: SwipeMap = { ...a };
  for (const [mid, swipes] of Object.entries(b)) out[mid] = { ...(out[mid] ?? {}), ...swipes };
  return out;
}

/**
 * A party room. Members, swipes and the shared deck filter are stored in
 * Supabase (see supabase/migrations) so people can swipe at different times
 * and still match. Realtime broadcast pushes swipes instantly to whoever is
 * online, presence shows who's in the app right now, and a full resync runs
 * on join, reconnect and whenever the app returns to the foreground.
 *
 * If the migration hasn't been applied it degrades to the old live-only
 * behaviour (presence roster, nothing stored).
 */
export function useRoom(
  roomCode: string | null,
  me: Member | null,
  intent: RoomIntent,
  prefs: { genres: number[]; mode: DeckMode },
): Result {
  const [state, setState] = useState<RoomState>(EMPTY);
  // Movie payloads by id so match UI has posters for films this phone never dealt.
  const movieCache = useRef<Record<number, SampleMovie>>({});
  const channelRef = useRef<RealtimeChannel | null>(null);
  const meRef = useRef(me);
  meRef.current = me;
  const intentRef = useRef(intent);
  intentRef.current = intent;
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;
  const persistedRef = useRef(true);
  const syncRef = useRef<() => Promise<void>>(async () => {});
  // Matches already celebrated in this room — persisted so reopening the app
  // doesn't replay old ones, but a match that happened while you were away
  // still fires once.
  const matchedShown = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!roomCode || !me) return;
    let cancelled = false;
    setState(EMPTY);
    persistedRef.current = true;
    movieCache.current = {};
    matchedShown.current = new Set();

    const applySnapshot = (snap: RoomSnapshot) => {
      const roster = snap.members.map((m) => ({ id: m.id, name: m.name, joinedAt: m.joined_at }));
      const fromDb = swipesFromSnapshot(snap, movieCache.current);
      setState((s) => ({
        ...s,
        status: 'connected',
        persisted: true,
        roster,
        settings: { hostId: snap.host_id, genres: snap.genres ?? [], mode: snap.mode },
        // Keep any local swipes the server hasn't acknowledged yet.
        swipes: mergeSwipes(s.swipes, fromDb),
      }));
    };

    const sync = async () => {
      const m = meRef.current;
      if (!m || !persistedRef.current) return;
      try {
        const snap = intentRef.current.create
          ? await roomApi.create(roomCode, m.id, m.name, intentRef.current.genres, intentRef.current.mode)
          : await roomApi.join(roomCode, m.id, m.name);
        if (cancelled) return;
        intentRef.current = { ...intentRef.current, create: false };
        if (!snap) {
          setState((s) => ({ ...s, status: 'not_found' }));
          return;
        }
        applySnapshot(snap);
      } catch (err) {
        if (cancelled) return;
        if (err instanceof RoomPersistenceUnavailable) {
          console.warn('[room] persistence unavailable — live-only mode. Run the Supabase migration.');
          persistedRef.current = false;
          setState((s) => ({ ...s, persisted: false, status: 'connected' }));
          return;
        }
        // A code collision on create — treat it like joining.
        if (intentRef.current.create && /duplicate key/i.test(String(err))) {
          intentRef.current = { ...intentRef.current, create: false };
          return sync();
        }
        console.warn('[room] sync failed', err);
      }
    };
    syncRef.current = sync;

    // Load which matches this phone already celebrated, then catch up.
    const matchedLoaded = AsyncStorage.getItem(matchedKey(roomCode))
      .then((raw) => {
        if (cancelled || !raw) return;
        try {
          for (const id of JSON.parse(raw) as number[]) matchedShown.current.add(id);
        } catch {}
      })
      .catch(() => {});

    const channel = supabase.channel(`room:${roomCode}`, {
      config: { presence: { key: me.id }, broadcast: { self: false } },
    });
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const raw = channel.presenceState();
        const presence = Object.entries(raw)
          .map(([key, ps]) => {
            const p = ps[0] as unknown as RoomState['presence'][number] | undefined;
            return p ? { ...p, id: key } : null;
          })
          .filter((p): p is RoomState['presence'][number] => !!p)
          .sort((a, b) => a.joinedAt - b.joinedAt);
        setState((s) => ({ ...s, presence, onlineIds: presence.map((p) => p.id) }));
      })
      .on('broadcast', { event: 'swipe' }, ({ payload }) => {
        const { memberId, movie, direction } = payload as {
          memberId: string;
          movie: SampleMovie;
          direction: Direction;
        };
        movieCache.current[movie.id] = movie;
        setState((s) => mergeSwipesState(s, memberId, movie.id, direction));
      })
      // Roster or settings changed somewhere → resync.
      .on('broadcast', { event: 'room-changed' }, () => {
        void syncRef.current();
      })
      .subscribe(async (status) => {
        if (cancelled) return;
        if (status === 'SUBSCRIBED') {
          await matchedLoaded;
          if (cancelled) return;
          const m = meRef.current!;
          await channel.track({
            id: m.id,
            name: m.name,
            joinedAt: m.joinedAt,
            genres: prefsRef.current.genres,
            mode: prefsRef.current.mode,
          });
          await sync();
          if (!persistedRef.current) setState((s) => ({ ...s, status: 'connected' }));
          channel.send({ type: 'broadcast', event: 'room-changed', payload: {} });
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setState((s) => (s.status === 'not_found' ? s : { ...s, status: 'disconnected' }));
        }
      });

    // Coming back to the app → pick up anything swiped while we were away.
    const appSub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void syncRef.current();
    });

    return () => {
      cancelled = true;
      appSub.remove();
      channel.unsubscribe();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomCode, me]);

  // Keep presence payload current so the live-only fallback follows the host's filter.
  useEffect(() => {
    const ch = channelRef.current;
    const m = meRef.current;
    if (!ch || !m || state.status !== 'connected') return;
    ch.track({ id: m.id, name: m.name, joinedAt: m.joinedAt, genres: prefs.genres, mode: prefs.mode }).catch(
      () => {},
    );
  }, [prefs.genres, prefs.mode, state.status]);

  // Someone we don't know yet came online → pull the fresh roster (once per id).
  const syncedFor = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!state.persisted || state.status !== 'connected') return;
    const unknown = state.onlineIds.filter(
      (id) => !state.roster.some((r) => r.id === id) && !syncedFor.current.has(id),
    );
    if (!unknown.length) return;
    unknown.forEach((id) => syncedFor.current.add(id));
    void syncRef.current();
  }, [state.onlineIds, state.roster, state.persisted, state.status]);

  // Who's in the room: the stored roster, or presence if we're live-only.
  const members = useMemo<Member[]>(() => {
    const online = new Set(state.onlineIds);
    const base = state.persisted ? state.roster : state.presence;
    return base.map((m) => ({ id: m.id, name: m.name, joinedAt: m.joinedAt, online: online.has(m.id) }));
  }, [state.persisted, state.roster, state.presence, state.onlineIds]);

  const settings = useMemo<RoomSettings | null>(() => {
    if (state.persisted) return state.settings;
    const host = state.presence[0];
    return host ? { hostId: host.id, genres: host.genres ?? [], mode: host.mode ?? 'all' } : null;
  }, [state.persisted, state.settings, state.presence]);

  // Recompute common ground + matches whenever swipes or the roster change.
  useEffect(() => {
    if (!roomCode) return;
    const tally: Record<number, number> = {};
    const memberIds = new Set(members.map((m) => m.id));
    for (const [memberId, swipes] of Object.entries(state.swipes)) {
      if (!memberIds.has(memberId)) continue; // ignore people who left
      for (const [movieIdStr, dir] of Object.entries(swipes)) {
        if (dir === 'right') tally[Number(movieIdStr)] = (tally[Number(movieIdStr)] ?? 0) + 1;
      }
    }

    const commonGround: SampleMovie[] = [];
    let newMatch: MatchEvent | null = null;
    for (const [idStr, count] of Object.entries(tally)) {
      const movieId = Number(idStr);
      const movie = movieCache.current[movieId];
      if (!movie) continue;
      if (count >= 2) commonGround.push(movie);
      if (members.length >= 2 && count === members.length && !matchedShown.current.has(movieId)) {
        matchedShown.current.add(movieId);
        newMatch = { movie, members, at: Date.now() };
      }
    }
    if (newMatch) {
      AsyncStorage.setItem(matchedKey(roomCode), JSON.stringify([...matchedShown.current])).catch(() => {});
    }

    setState((s) => {
      const sameSet =
        s.commonGround.length === commonGround.length &&
        s.commonGround.every((m, i) => m.id === commonGround[i]?.id);
      if (sameSet && !newMatch) return s;
      return {
        ...s,
        commonGround: sameSet ? s.commonGround : commonGround,
        latestMatch: newMatch ?? s.latestMatch,
      };
    });
  }, [state.swipes, members, roomCode]);

  const broadcastSwipe = useCallback(
    (movie: SampleMovie, direction: Direction) => {
      const m = meRef.current;
      const ch = channelRef.current;
      if (!m || !ch || !roomCode) return;
      const slim = roomApi.slimMovie(movie);
      movieCache.current[movie.id] = slim;
      setState((s) => mergeSwipesState(s, m.id, movie.id, direction));
      ch.send({ type: 'broadcast', event: 'swipe', payload: { memberId: m.id, movie: slim, direction } });
      if (persistedRef.current) {
        roomApi.swipe(roomCode, m.id, movie, direction).catch((err) => console.warn('[room] swipe save failed', err));
      }
    },
    [roomCode],
  );

  const dismissMatch = useCallback(() => setState((s) => ({ ...s, latestMatch: null })), []);

  const updateSettings = useCallback(
    async (genres: number[], mode: DeckMode) => {
      const m = meRef.current;
      if (!m || !roomCode || !persistedRef.current) return;
      await roomApi.update(roomCode, m.id, genres, mode);
      await syncRef.current();
      channelRef.current?.send({ type: 'broadcast', event: 'room-changed', payload: {} });
    },
    [roomCode],
  );

  const leave = useCallback(async () => {
    const m = meRef.current;
    if (!m || !roomCode) return;
    AsyncStorage.removeItem(matchedKey(roomCode)).catch(() => {});
    if (!persistedRef.current) return;
    try {
      await roomApi.leave(roomCode, m.id);
      channelRef.current?.send({ type: 'broadcast', event: 'room-changed', payload: {} });
    } catch (err) {
      console.warn('[room] leave failed', err);
    }
  }, [roomCode]);

  const { roster: _r, presence: _p, onlineIds: _o, ...rest } = state;
  return { ...rest, members, settings, broadcastSwipe, dismissMatch, updateSettings, leave };
}

function mergeSwipesState(s: RoomState, memberId: string, movieId: number, direction: Direction): RoomState {
  const mine = { ...(s.swipes[memberId] ?? {}), [movieId]: direction };
  return { ...s, swipes: { ...s.swipes, [memberId]: mine } };
}
