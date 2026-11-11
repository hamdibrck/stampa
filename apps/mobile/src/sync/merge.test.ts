import {
  applyServerState,
  outboxToOps,
  toDateString,
  toggleVisit,
  type Outbox,
  type Visits,
} from './merge';

const t1 = new Date('2026-11-11T10:00:00.000Z');
const t2 = new Date('2026-11-11T10:05:00.000Z');

describe('toggleVisit', () => {
  it('marks a city and queues an upsert', () => {
    const r = toggleVisit({}, {}, 745044, t1);
    expect(r.visited).toBe(true);
    expect(r.visits['745044']).toEqual({
      visitedAt: toDateString(t1),
      updatedAt: t1.toISOString(),
    });
    expect(r.outbox['745044']).toMatchObject({ op: 'upsert', at: t1.toISOString() });
  });

  it('unmarks on the second press and queues a delete', () => {
    const a = toggleVisit({}, {}, 1, t1);
    const b = toggleVisit(a.visits, a.outbox, 1, t2);
    expect(b.visited).toBe(false);
    expect(b.visits['1']).toBeUndefined();
    expect(b.outbox['1']).toEqual({ op: 'delete', at: t2.toISOString() });
  });

  it('does not mutate its inputs', () => {
    const visits: Visits = {};
    const outbox: Outbox = {};
    toggleVisit(visits, outbox, 1, t1);
    expect(visits).toEqual({});
    expect(outbox).toEqual({});
  });
});

describe('outboxToOps', () => {
  it('serialises operations for the sync RPC', () => {
    const a = toggleVisit({}, {}, 7, t1);
    const b = toggleVisit(a.visits, a.outbox, 8, t1);
    const c = toggleVisit(b.visits, b.outbox, 8, t2);
    expect(outboxToOps(c.outbox)).toEqual([
      { city_id: 7, op: 'upsert', visited_at: toDateString(t1), at: t1.toISOString() },
      { city_id: 8, op: 'delete', visited_at: null, at: t2.toISOString() },
    ]);
  });
});

describe('applyServerState', () => {
  const remote = [
    { city_id: 1, visited_at: '2026-01-01', updated_at: '2026-01-01T00:00:00.000Z' },
    { city_id: 2, visited_at: '2026-02-02', updated_at: '2026-02-02T00:00:00.000Z' },
  ];

  it('adopts the server state and clears acknowledged operations', () => {
    const sent = toggleVisit({}, {}, 1, t1).outbox;
    const r = applyServerState(remote, sent, sent);
    expect(Object.keys(r.visits).sort()).toEqual(['1', '2']);
    expect(r.outbox).toEqual({});
  });

  it('moves guest stamps into the account (union with remote)', () => {
    // Guest stamped city 9 offline; the account already has 1 and 2. Nothing was sent yet.
    const guest = toggleVisit({}, {}, 9, t1);
    const r = applyServerState(remote, guest.outbox, {});
    expect(Object.keys(r.visits).sort()).toEqual(['1', '2', '9']);
    expect(r.outbox['9']).toBeDefined();
  });

  it('keeps changes made while the request was in flight', () => {
    const sent = toggleVisit({}, {}, 2, t1).outbox; // upsert 2 was pushed
    const later = toggleVisit({ '2': { visitedAt: 'x', updatedAt: 'x' } }, sent, 2, t2).outbox; // user unmarked meanwhile
    const r = applyServerState(remote, later, sent);
    expect(r.visits['2']).toBeUndefined();
    expect(r.outbox['2']).toEqual({ op: 'delete', at: t2.toISOString() });
  });

  it('applies a pending delete over the server state', () => {
    const pending: Outbox = { '1': { op: 'delete', at: t1.toISOString() } };
    const r = applyServerState(remote, pending, {});
    expect(Object.keys(r.visits)).toEqual(['2']);
  });
});
