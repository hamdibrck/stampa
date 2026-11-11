import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { zustandStorage } from '@/lib/storage';
import {
  applyServerState,
  toggleVisit,
  type Outbox,
  type RemoteVisit,
  type Visits,
} from '@/sync/merge';

type VisitsState = {
  visits: Visits;
  outbox: Outbox;
  /** Account the local data belongs to; null while the user is a guest. */
  ownerId: string | null;
  /** Marks or unmarks a city. Works offline; returns the new state. */
  toggle: (cityId: number, now?: Date) => boolean;
  /** Applies a successful sync response. */
  applyServer: (remote: RemoteVisit[], sent: Outbox, ownerId: string) => void;
  /** Removes all local visit data (after sign-out or account deletion). */
  clear: () => void;
};

export const useVisits = create<VisitsState>()(
  persist(
    (set, get) => ({
      visits: {},
      outbox: {},
      ownerId: null,
      toggle: (cityId, now = new Date()) => {
        const r = toggleVisit(get().visits, get().outbox, cityId, now);
        set({ visits: r.visits, outbox: r.outbox });
        return r.visited;
      },
      applyServer: (remote, sent, ownerId) => {
        const r = applyServerState(remote, get().outbox, sent);
        set({ visits: r.visits, outbox: r.outbox, ownerId });
      },
      clear: () => set({ visits: {}, outbox: {}, ownerId: null }),
    }),
    {
      name: 'visits.v1',
      storage: createJSONStorage(() => zustandStorage),
      partialize: ({ visits, outbox, ownerId }) => ({ visits, outbox, ownerId }),
    },
  ),
);

export const useIsVisited = (cityId: number) => useVisits((s) => s.visits[String(cityId)] != null);

export const usePendingCount = () => useVisits((s) => Object.keys(s.outbox).length);

export function visitedIds(visits: Visits): number[] {
  return Object.keys(visits).map(Number);
}
