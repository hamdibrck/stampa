/**
 * Pure helpers for offline-first visits (docs/DECISIONS.md D6).
 *
 * Every local change is written to `visits` immediately and queued in `outbox`.
 * The outbox is keyed by city, so repeated toggles collapse into one pending operation.
 */

/** YYYY-MM-DD */
export type Visit = { visitedAt: string; updatedAt: string };
export type Visits = Record<string, Visit>;

export type PendingOp =
  { op: 'upsert'; visitedAt: string; at: string } | { op: 'delete'; at: string };
export type Outbox = Record<string, PendingOp>;

export type RemoteVisit = { city_id: number; visited_at: string; updated_at: string };

export type SyncOp = {
  city_id: number;
  op: 'upsert' | 'delete';
  visited_at: string | null;
  at: string;
};

export function toDateString(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Toggles a city and records the change in the outbox. */
export function toggleVisit(
  visits: Visits,
  outbox: Outbox,
  cityId: number,
  now: Date,
): { visits: Visits; outbox: Outbox; visited: boolean } {
  const key = String(cityId);
  const at = now.toISOString();
  const nextVisits = { ...visits };
  const nextOutbox = { ...outbox };
  if (visits[key]) {
    delete nextVisits[key];
    nextOutbox[key] = { op: 'delete', at };
    return { visits: nextVisits, outbox: nextOutbox, visited: false };
  }
  const visitedAt = toDateString(now);
  nextVisits[key] = { visitedAt, updatedAt: at };
  nextOutbox[key] = { op: 'upsert', visitedAt, at };
  return { visits: nextVisits, outbox: nextOutbox, visited: true };
}

export function outboxToOps(outbox: Outbox): SyncOp[] {
  return Object.entries(outbox).map(([cityId, op]) => ({
    city_id: Number(cityId),
    op: op.op,
    visited_at: op.op === 'upsert' ? op.visitedAt : null,
    at: op.at,
  }));
}

/**
 * Applies the server's answer to a sync.
 *
 * `sent` is the outbox snapshot that was pushed. Operations still identical to the snapshot are
 * acknowledged; anything the user changed while the request was in flight stays queued and keeps
 * priority over the server state.
 */
export function applyServerState(
  remote: RemoteVisit[],
  outbox: Outbox,
  sent: Outbox,
): { visits: Visits; outbox: Outbox } {
  const visits: Visits = {};
  for (const row of remote) {
    visits[String(row.city_id)] = { visitedAt: row.visited_at, updatedAt: row.updated_at };
  }
  const remaining: Outbox = {};
  for (const [key, op] of Object.entries(outbox)) {
    if (sent[key]?.at === op.at) continue;
    remaining[key] = op;
    if (op.op === 'delete') delete visits[key];
    else visits[key] = { visitedAt: op.visitedAt, updatedAt: op.at };
  }
  return { visits, outbox: remaining };
}
