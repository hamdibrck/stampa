import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

type SessionState = {
  session: Session | null;
  /** false until the stored session has been read on launch. */
  ready: boolean;
  setSession: (session: Session | null) => void;
};

export const useSession = create<SessionState>((set) => ({
  session: null,
  ready: false,
  setSession: (session) => set({ session, ready: true }),
}));

export const useUserId = () => useSession((s) => s.session?.user.id ?? null);
