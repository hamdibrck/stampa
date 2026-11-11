import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';

import { supabase } from '@/lib/supabase';
import { useSession } from '@/store/session';
import { useVisits } from '@/store/visits';

import { outboxToOps, type RemoteVisit } from './merge';

let running = false;
let rerun = false;

export type SyncResult = 'synced' | 'skipped' | 'failed';

/**
 * Pushes queued visit changes and adopts the server state. Safe to call at any time:
 * it does nothing for guests or while offline, and calls made during a run are coalesced.
 */
export async function syncNow(): Promise<SyncResult> {
  const userId = useSession.getState().session?.user.id;
  if (!supabase || !userId) return 'skipped';
  if (running) {
    rerun = true;
    return 'skipped';
  }
  running = true;
  try {
    const store = useVisits.getState();
    if (store.ownerId && store.ownerId !== userId) {
      // Data left behind by another account must never leak into this one.
      store.clear();
    }
    const sent = useVisits.getState().outbox;
    const { data, error } = await supabase.rpc('sync_visits', { ops: outboxToOps(sent) });
    if (error) return 'failed';
    useVisits.getState().applyServer((data ?? []) as RemoteVisit[], sent, userId);
    return 'synced';
  } catch {
    return 'failed';
  } finally {
    running = false;
    if (rerun) {
      rerun = false;
      void syncNow();
    }
  }
}

/**
 * Keeps the outbox draining: after local changes (debounced), when the connection returns and
 * when the app comes back to the foreground. Returns a cleanup function.
 */
export function startSync(): () => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const schedule = (delay: number) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => void syncNow(), delay);
  };

  const unsubscribeStore = useVisits.subscribe((state, prev) => {
    if (state.outbox !== prev.outbox && Object.keys(state.outbox).length > 0) schedule(1200);
  });
  const unsubscribeSession = useSession.subscribe((state, prev) => {
    if (state.session?.user.id && state.session.user.id !== prev.session?.user.id) schedule(0);
  });
  let wasOnline = true;
  const unsubscribeNet = NetInfo.addEventListener((net) => {
    const online = net.isConnected !== false && net.isInternetReachable !== false;
    if (online && !wasOnline) schedule(0);
    wasOnline = online;
  });
  const appState = AppState.addEventListener('change', (next) => {
    if (next === 'active') schedule(0);
  });

  schedule(0);
  return () => {
    if (timer) clearTimeout(timer);
    unsubscribeStore();
    unsubscribeSession();
    unsubscribeNet();
    appState.remove();
  };
}
