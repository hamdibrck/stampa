import type { Session } from '@supabase/supabase-js';

import { useSession } from '@/store/session';
import { useVisits } from '@/store/visits';

import { syncNow } from './engine';

const mockRpc = jest.fn();
jest.mock('@/lib/supabase', () => ({
  supabase: { rpc: (...args: unknown[]) => mockRpc(...args) },
}));
jest.mock('@react-native-community/netinfo', () => ({
  addEventListener: jest.fn(() => jest.fn()),
}));

const signIn = (id: string) =>
  useSession.getState().setSession({ user: { id } } as unknown as Session);

beforeEach(() => {
  mockRpc.mockReset();
  useVisits.getState().clear();
  useSession.getState().setSession(null);
});

describe('syncNow', () => {
  it('does nothing for a guest and keeps the stamp queued (airplane-mode friendly)', async () => {
    useVisits.getState().toggle(745044);
    expect(await syncNow()).toBe('skipped');
    expect(mockRpc).not.toHaveBeenCalled();
    expect(Object.keys(useVisits.getState().outbox)).toEqual(['745044']);
  });

  it('keeps the outbox when the request fails (offline) and retries later', async () => {
    signIn('user-1');
    useVisits.getState().toggle(745044);
    mockRpc.mockRejectedValueOnce(new Error('Network request failed'));
    expect(await syncNow()).toBe('failed');
    expect(useVisits.getState().visits['745044']).toBeDefined();
    expect(Object.keys(useVisits.getState().outbox)).toEqual(['745044']);

    mockRpc.mockResolvedValueOnce({
      data: [{ city_id: 745044, visited_at: '2026-11-11', updated_at: '2026-11-11T10:00:00Z' }],
      error: null,
    });
    expect(await syncNow()).toBe('synced');
    expect(useVisits.getState().outbox).toEqual({});
  });

  it('moves guest stamps into the account on sign-in and merges with the server', async () => {
    useVisits.getState().toggle(745044); // stamped as guest
    signIn('user-1');
    mockRpc.mockResolvedValueOnce({
      data: [
        { city_id: 745044, visited_at: '2026-11-11', updated_at: '2026-11-11T10:00:00Z' },
        { city_id: 323786, visited_at: '2026-01-01', updated_at: '2026-01-01T10:00:00Z' },
      ],
      error: null,
    });
    await syncNow();
    expect(mockRpc).toHaveBeenCalledWith('sync_visits', {
      ops: [expect.objectContaining({ city_id: 745044, op: 'upsert' })],
    });
    const s = useVisits.getState();
    expect(Object.keys(s.visits).sort()).toEqual(['323786', '745044']);
    expect(s.ownerId).toBe('user-1');
    expect(s.outbox).toEqual({});
  });

  it("never pushes another account's leftovers", async () => {
    signIn('user-1');
    useVisits.getState().toggle(745044);
    mockRpc.mockResolvedValueOnce({ data: [], error: null });
    useVisits.setState({ ownerId: 'user-2' });
    await syncNow();
    expect(mockRpc).toHaveBeenCalledWith('sync_visits', { ops: [] });
  });

  it('treats an API error as a failure', async () => {
    signIn('user-1');
    useVisits.getState().toggle(1);
    mockRpc.mockResolvedValueOnce({ data: null, error: { message: 'boom' } });
    expect(await syncNow()).toBe('failed');
    expect(Object.keys(useVisits.getState().outbox)).toEqual(['1']);
  });
});
