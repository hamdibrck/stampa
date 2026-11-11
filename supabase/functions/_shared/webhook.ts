/** Pure helpers for the RevenueCat webhook. No Deno APIs here, so they run under Vitest too. */

export type RevenueCatEvent = { id: string; type: string; [key: string]: unknown };

function timingSafeEqual(a: string, b: string): boolean {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i++) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}

/**
 * RevenueCat sends the value configured in its dashboard as the Authorization header.
 * Both "Bearer <secret>" and the bare secret are accepted. An unset secret rejects everything.
 */
export function isAuthorized(header: string | null, secret: string | undefined): boolean {
  if (!secret || !header) return false;
  const value = header.startsWith('Bearer ') ? header.slice(7) : header;
  return timingSafeEqual(value, secret);
}

export function parseEvent(body: unknown): RevenueCatEvent | null {
  const event = (body as { event?: unknown } | null)?.event;
  if (!event || typeof event !== 'object') return null;
  const { id, type } = event as { id?: unknown; type?: unknown };
  if (typeof id !== 'string' || !id || typeof type !== 'string' || !type) return null;
  return event as RevenueCatEvent;
}
