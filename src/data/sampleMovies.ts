import type { TMDBMovie } from '../lib/api';

/**
 * Hardcoded fallback when the proxy isn't reachable yet (e.g. before the TMDB
 * key is wired up). These are the same six films the prototype uses, with real
 * TMDB poster paths so the UI looks right out of the box.
 */
export type ProviderChip = { name: string; type: 'flatrate' | 'rent' | 'buy' };

export type SampleMovie = TMDBMovie & {
  runtime: number;
  genre: string;
  trailerKey: string | null;
  providers: ProviderChip[];
  /** TMDB-supplied JustWatch deep link for the user's region (the easiest
   *  universal "watch on" URL — works for whatever streamers the user has). */
  watchLink: string | null;
};

export const SAMPLE_MOVIES: SampleMovie[] = [
  {
    id: 335984,
    title: 'Blade Runner 2049',
    release_date: '2017-10-04',
    poster_path: '/gajva2L0rPYkEWjzgFlBXCAVBE5.jpg',
    backdrop_path: '/askg3SMvhqEl4OL52YuvdtY40Yb.jpg',
    vote_average: 7.6,
    overview:
      'A young blade runner uncovers a long-buried secret that could plunge what is left of society into chaos.',
    runtime: 164,
    genre: 'SCI-FI',
    trailerKey: 'gCcx85zbxz4',
    providers: [],
    watchLink: null,
  },
  {
    id: 313369,
    title: 'La La Land',
    release_date: '2016-12-09',
    poster_path: '/uDO8zWDhfWwoFdKS4fzkUJt0Rf0.jpg',
    backdrop_path: '/fp6X6yhgcxzxCpmM0EVC6V9B5qC.jpg',
    vote_average: 7.9,
    overview:
      'A jazz pianist falls for an aspiring actress in Los Angeles. Their dreams pull them apart even as love draws them in.',
    runtime: 128,
    genre: 'ROMANCE',
    trailerKey: '0pdqf4P9MB8',
    providers: [],
    watchLink: null,
  },
  {
    id: 76341,
    title: 'Mad Max: Fury Road',
    release_date: '2015-05-15',
    poster_path: '/8tZYtuWezp8JbcsvHYO0O46tFbo.jpg',
    backdrop_path: '/gqrnQA6Xppdl8vIb2eJc58VC1tW.jpg',
    vote_average: 7.5,
    overview:
      'A drifter and a rebellious warrior flee a tyrant across a wasteland in a war-rig pursued by a cult of road maniacs.',
    runtime: 121,
    genre: 'ACTION',
    trailerKey: 'hEJnMQG9ev8',
    providers: [],
    watchLink: null,
  },
  {
    id: 493922,
    title: 'Hereditary',
    release_date: '2018-06-08',
    poster_path: '/4GFPuL14eXi66V96xBWY73Y9PfR.jpg',
    backdrop_path: '/iBOcDBPnYuosFmqnvzqEEDbRfql.jpg',
    vote_average: 7.3,
    overview:
      'After her secretive mother dies, Annie’s family begins to unravel cryptic, terrifying secrets about their ancestry.',
    runtime: 127,
    genre: 'HORROR',
    trailerKey: 'V6wWKNij_1M',
    providers: [],
    watchLink: null,
  },
  {
    id: 376867,
    title: 'Moonlight',
    release_date: '2016-10-21',
    poster_path: '/qhMSciMkqNbtbhURXrkAj4sumGl.jpg',
    backdrop_path: '/A0PA1uIQy2uoiRuHF9Wo67qkNzP.jpg',
    vote_average: 7.4,
    overview:
      'A young man grapples with identity, sexuality, and belonging across three pivotal chapters of his life.',
    runtime: 111,
    genre: 'DRAMA',
    trailerKey: '9NJj12tJzqc',
    providers: [],
    watchLink: null,
  },
  {
    id: 545611,
    title: 'Everything Everywhere All at Once',
    release_date: '2022-03-25',
    poster_path: '/w3LxiVYdWWRvEVdn5RYq6jIqkb1.jpg',
    backdrop_path: '/nGxUxi3PfXDRm7Vg95VBNgNM8yc.jpg',
    vote_average: 7.8,
    overview:
      'A laundromat owner is yanked across infinite parallel lives to defeat a cosmic threat — and reconnect with her family.',
    runtime: 139,
    genre: 'SCI-FI',
    trailerKey: 'wxN1T1uxQ2g',
    providers: [],
    watchLink: null,
  },
];
