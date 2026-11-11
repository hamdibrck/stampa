export type PlusState = { expiresAt: string; productId: string; sourceEventId: string };

type Subscriber = {
  subscriber?: {
    entitlements?: Record<string, { expires_date?: string | null; product_identifier?: string }>;
  };
};

/**
 * Active "plus" entitlement from a RevenueCat `GET /v1/subscribers/{id}` response, or null.
 * The synthetic source event id is stable per expiry date, so repeated refreshes insert once.
 */
export function activePlus(body: unknown, userId: string, now: Date): PlusState | null {
  const plus = (body as Subscriber | null)?.subscriber?.entitlements?.plus;
  if (!plus?.expires_date) return null;
  const expires = new Date(plus.expires_date);
  if (Number.isNaN(expires.getTime()) || expires <= now) return null;
  return {
    expiresAt: expires.toISOString(),
    productId: plus.product_identifier ?? 'plus_yearly',
    sourceEventId: `rc-sync:${userId}:${expires.getTime()}`,
  };
}
