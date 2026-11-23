import 'react-native-url-polyfill/auto';
import Constants from 'expo-constants';
import { createClient } from '@supabase/supabase-js';

type Extra = { supabaseUrl?: string; supabaseKey?: string };
const extra = (Constants.expoConfig?.extra ?? {}) as Extra;

if (!extra.supabaseUrl || !extra.supabaseKey) {
  // eslint-disable-next-line no-console
  console.warn('[supabase] missing supabaseUrl/supabaseKey in app.json extra');
}

/**
 * Single shared client. We're only using Realtime channels (no DB tables, no
 * auth) so default options are fine. The publishable key is safe to ship —
 * Realtime broadcast/presence channels don't need RLS.
 */
export const supabase = createClient(extra.supabaseUrl ?? '', extra.supabaseKey ?? '', {
  auth: { persistSession: false, autoRefreshToken: false },
  realtime: { params: { eventsPerSecond: 10 } },
});
