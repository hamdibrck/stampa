import { worldProgress } from '@/data/progress';
import { citiesByCountry } from '@/data/world';
import { storage } from '@/lib/storage';

import { useVisits, visitedIds } from './visits';

const ankara = citiesByCountry.get('TR')!.find((c) => c.plate === '06')!;

beforeEach(() => useVisits.getState().clear());

describe('visits store', () => {
  it('toggles a city and updates the counters immediately', () => {
    expect(worldProgress(visitedIds(useVisits.getState().visits)).visitedCities).toBe(0);
    expect(useVisits.getState().toggle(ankara.id)).toBe(true);
    expect(worldProgress(visitedIds(useVisits.getState().visits))).toMatchObject({
      visitedCities: 1,
      visitedCountries: 1,
    });
    expect(useVisits.getState().toggle(ankara.id)).toBe(false);
    expect(worldProgress(visitedIds(useVisits.getState().visits)).visitedCities).toBe(0);
  });

  it('works without a session and queues the change for sync', () => {
    useVisits.getState().toggle(ankara.id);
    const { outbox, ownerId } = useVisits.getState();
    expect(ownerId).toBeNull();
    expect(outbox[String(ankara.id)]?.op).toBe('upsert');
  });

  it('persists to device storage', () => {
    useVisits.getState().toggle(ankara.id);
    const saved = JSON.parse(storage.getString('visits.v1') ?? '{}');
    expect(saved.state.visits[String(ankara.id)]).toBeDefined();
    expect(saved.state.outbox[String(ankara.id)]).toBeDefined();
  });

  it('adopts the server state after a sync', () => {
    useVisits.getState().toggle(ankara.id);
    const sent = useVisits.getState().outbox;
    useVisits
      .getState()
      .applyServer(
        [{ city_id: ankara.id, visited_at: '2026-11-11', updated_at: '2026-11-11T00:00:00Z' }],
        sent,
        'user-1',
      );
    const s = useVisits.getState();
    expect(s.outbox).toEqual({});
    expect(s.ownerId).toBe('user-1');
    expect(s.visits[String(ankara.id)]?.visitedAt).toBe('2026-11-11');
  });
});
