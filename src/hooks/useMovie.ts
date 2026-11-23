import { useEffect, useState } from 'react';
import { api, type MovieDetail, type TMDBVideo } from '../lib/api';

export type WatchProvidersByRegion = {
  results: Record<
    string,
    {
      link?: string; // JustWatch deep link for the region — best universal "watch on" target
      flatrate?: { provider_id: number; provider_name: string; logo_path: string }[];
      rent?: { provider_id: number; provider_name: string; logo_path: string }[];
      buy?: { provider_id: number; provider_name: string; logo_path: string }[];
    }
  >;
};

export type EnrichedMovie = MovieDetail & {
  trailerKey: string | null;
  trailerKeys: string[];
  watchProviders?: WatchProvidersByRegion;
};

type State = {
  movie: EnrichedMovie | null;
  loading: boolean;
  error: string | null;
};

export function useMovie(id: number | null): State {
  const [state, setState] = useState<State>({ movie: null, loading: !!id, error: null });

  useEffect(() => {
    if (!id) {
      setState({ movie: null, loading: false, error: null });
      return;
    }
    const ctrl = new AbortController();
    setState({ movie: null, loading: true, error: null });
    (async () => {
      try {
        // /movie/:id appends videos + credits + watch/providers via the proxy.
        // The watch/providers payload comes back under the "watch/providers" key —
        // expose it as a normal field for ergonomics downstream.
        const raw = await api.movie(id);
        const videos = (raw.videos?.results ?? []) as TMDBVideo[];
        const trailerKeys = api.pickTrailerKeys(videos);
        const watchProviders = (raw as unknown as { 'watch/providers'?: WatchProvidersByRegion })[
          'watch/providers'
        ];
        if (ctrl.signal.aborted) return;
        setState({
          movie: { ...raw, trailerKey: trailerKeys[0] ?? null, trailerKeys, watchProviders },
          loading: false,
          error: null,
        });
      } catch (err) {
        if (ctrl.signal.aborted) return;
        setState({
          movie: null,
          loading: false,
          error: err instanceof Error ? err.message : 'fetch failed',
        });
      }
    })();
    return () => ctrl.abort();
  }, [id]);

  return state;
}
