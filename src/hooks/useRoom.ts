import { useEffect, useMemo, useRef, useState } from 'react';
import type { RealtimeChannel, RealtimePresenceState } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { SampleMovie } from '../data/sampleMovies';

export type Member = {
  id: string;
  name: string;
  joinedAt: number;
  /** TMDB genre IDs this member picked during onboarding. Broadcast via presence
   *  so the host's selection seeds the shared room queue. */
  genres?: number[];
};

export type Swipe = {
  movieId: number;
  direction: 'left' | 'right' | 'up' | 'down';
};

export type MatchEvent = {
  movie: SampleMovie;
  members: Member[];
  at: number;
};

type RoomState = {
  status: 'connecting' | 'connected' | 'disconnected';
  members: Member[];
  /** All members' swipes, indexed by member id then movie id */
  swipes: Record<string, Record<number, Swipe['direction']>>;
  /** Movies that the current user has at least one other member queue with them */
  commonGround: SampleMovie[];
  /** Most recent match (everyone in the room queued the same film) */
  latestMatch: MatchEvent | null;
};

type Result = RoomState & {
  /** Broadcast a swipe to other members. Pass the movie object so the server has poster/title for matches. */
  broadcastSwipe: (movie: SampleMovie, direction: Swipe['direction']) => void;
  /** Acknowledge / dismiss the latest match locally. */
  dismissMatch: () => void;
};

const EMPTY: RoomState = {
  status: 'connecting',
  members: [],
  swipes: {},
  commonGround: [],
  latestMatch: null,
};

/**
 * Joins a Supabase Realtime channel keyed on the room code. Uses presence to
 * track which members are in the room, and broadcast for swipe events. Computes
 * "common ground" (movies ≥2 members queued) and "match" (movies ALL members
 * queued) locally so we don't need any server logic.
 */
export function useRoom(roomCode: string | null, me: Member | null): Result {
  const [state, setState] = useState<RoomState>(EMPTY);
  // We hold a movie cache so when a swipe broadcast comes in for a movie this
  // device has never rendered, we still have its title/poster for the match UI.
  const movieCache = useRef<Record<number, SampleMovie>>({});
  const channelRef = useRef<RealtimeChannel | null>(null);
  const meRef = useRef<Member | null>(me);
  meRef.current = me;
  // Movies we've already surfaced as a match — prevents refiring after dismiss
  const matchedShown = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (!roomCode || !me) return;

    const channel = supabase.channel(`room:${roomCode}`, {
      config: { presence: { key: me.id }, broadcast: { self: false } },
    });
    channelRef.current = channel;

    const recomputeFromPresence = (raw: RealtimePresenceState) => {
      const members: Member[] = Object.entries(raw)
        .map(([key, presences]) => {
          const p = presences[0] as unknown as Member | undefined;
          return p ? { ...p, id: key } : null;
        })
        .filter((m): m is Member => !!m)
        .sort((a, b) => a.joinedAt - b.joinedAt);
      setState((s) => ({ ...s, members }));
    };

    channel
      .on('presence', { event: 'sync' }, () => {
        recomputeFromPresence(channel.presenceState());
      })
      .on('broadcast', { event: 'swipe' }, ({ payload }) => {
        const { memberId, movie, direction } = payload as {
          memberId: string;
          movie: SampleMovie;
          direction: Swipe['direction'];
        };
        movieCache.current[movie.id] = movie;
        setState((s) => {
          const memberSwipes = { ...(s.swipes[memberId] ?? {}) };
          memberSwipes[movie.id] = direction;
          const nextSwipes = { ...s.swipes, [memberId]: memberSwipes };
          return { ...s, swipes: nextSwipes };
        });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            id: me.id,
            name: me.name,
            joinedAt: me.joinedAt,
          });
          setState((s) => ({ ...s, status: 'connected' }));
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setState((s) => ({ ...s, status: 'disconnected' }));
        }
      });

    return () => {
      channel.unsubscribe();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [roomCode, me]);

  // Recompute commonGround + latestMatch whenever swipes/members change
  useEffect(() => {
    const tally: Record<number, number> = {};
    for (const memberId of Object.keys(state.swipes)) {
      for (const [movieIdStr, dir] of Object.entries(state.swipes[memberId])) {
        if (dir === 'right') {
          const id = Number(movieIdStr);
          tally[id] = (tally[id] ?? 0) + 1;
        }
      }
    }

    const memberCount = state.members.length;
    const commonGround: SampleMovie[] = [];
    let newMatch: MatchEvent | null = null;
    for (const [idStr, count] of Object.entries(tally)) {
      const movieId = Number(idStr);
      const movie = movieCache.current[movieId];
      if (!movie) continue;
      if (count >= 2) commonGround.push(movie);
      if (memberCount >= 2 && count === memberCount && !matchedShown.current.has(movieId)) {
        matchedShown.current.add(movieId);
        newMatch = { movie, members: state.members, at: Date.now() };
      }
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
  }, [state.swipes, state.members]);

  const broadcastSwipe = useMemo(
    () => (movie: SampleMovie, direction: Swipe['direction']) => {
      const m = meRef.current;
      const ch = channelRef.current;
      if (!m || !ch) return;
      // cache locally so this device's commonGround/match logic has the data
      movieCache.current[movie.id] = movie;
      // record our own swipe in local state
      setState((s) => {
        const mine = { ...(s.swipes[m.id] ?? {}) };
        mine[movie.id] = direction;
        return { ...s, swipes: { ...s.swipes, [m.id]: mine } };
      });
      ch.send({
        type: 'broadcast',
        event: 'swipe',
        payload: { memberId: m.id, movie, direction },
      });
    },
    [],
  );

  const dismissMatch = useMemo(
    () => () => setState((s) => ({ ...s, latestMatch: null })),
    [],
  );

  return { ...state, broadcastSwipe, dismissMatch };
}
