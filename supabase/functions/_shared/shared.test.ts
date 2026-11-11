import { describe, expect, it, vi } from 'vitest';

import { deleteAccount, type DeleteAccountDeps, type StorageEntry } from './deleteAccount';
import { activePlus } from './entitlements';
import { isAuthorized, parseEvent } from './webhook';

describe('webhook authorization', () => {
  it('accepts the configured secret with or without Bearer', () => {
    expect(isAuthorized('Bearer s3cret', 's3cret')).toBe(true);
    expect(isAuthorized('s3cret', 's3cret')).toBe(true);
  });
  it('rejects wrong, missing or unconfigured secrets', () => {
    expect(isAuthorized('Bearer nope', 's3cret')).toBe(false);
    expect(isAuthorized(null, 's3cret')).toBe(false);
    expect(isAuthorized('Bearer ', '')).toBe(false);
    expect(isAuthorized('anything', undefined)).toBe(false);
  });
});

describe('parseEvent', () => {
  it('returns the event when it has an id and type', () => {
    expect(
      parseEvent({ event: { id: 'e1', type: 'RENEWAL', product_id: 'plus_yearly' } }),
    ).toMatchObject({
      id: 'e1',
      type: 'RENEWAL',
    });
  });
  it('rejects malformed bodies', () => {
    expect(parseEvent(null)).toBeNull();
    expect(parseEvent({})).toBeNull();
    expect(parseEvent({ event: { type: 'RENEWAL' } })).toBeNull();
    expect(parseEvent({ event: 'x' })).toBeNull();
  });
});

describe('activePlus', () => {
  const now = new Date('2026-11-11T00:00:00Z');
  const body = (expires: string | null) => ({
    subscriber: {
      entitlements: { plus: { expires_date: expires, product_identifier: 'plus_yearly' } },
    },
  });
  it('returns the active subscription', () => {
    expect(activePlus(body('2027-11-11T00:00:00Z'), 'u1', now)).toEqual({
      expiresAt: '2027-11-11T00:00:00.000Z',
      productId: 'plus_yearly',
      sourceEventId: `rc-sync:u1:${Date.parse('2027-11-11T00:00:00Z')}`,
    });
  });
  it('returns null when expired or absent', () => {
    expect(activePlus(body('2026-01-01T00:00:00Z'), 'u1', now)).toBeNull();
    expect(activePlus(body(null), 'u1', now)).toBeNull();
    expect(activePlus({ subscriber: { entitlements: {} } }, 'u1', now)).toBeNull();
    expect(activePlus(null, 'u1', now)).toBeNull();
  });
});

describe('deleteAccount', () => {
  function fakeStorage(files: string[]) {
    const remaining = new Set(files);
    const deps: DeleteAccountDeps = {
      list: async (prefix) => {
        const entries = new Map<string, StorageEntry>();
        for (const f of remaining) {
          if (!f.startsWith(`${prefix}/`)) continue;
          const [name, ...rest] = f.slice(prefix.length + 1).split('/');
          entries.set(name!, { name: name!, isFolder: rest.length > 0 });
        }
        return [...entries.values()];
      },
      remove: vi.fn(async (paths: string[]) => paths.forEach((p) => remaining.delete(p))),
      deleteUser: vi.fn(async () => undefined),
    };
    return { deps, remaining };
  }

  it('removes all of the user’s photos in every city, then the user', async () => {
    const { deps, remaining } = fakeStorage([
      'user-a/745044/1.jpg',
      'user-a/745044/2.jpg',
      'user-a/323786/3.jpg',
      'user-b/745044/9.jpg',
    ]);
    const result = await deleteAccount(deps, 'user-a');
    expect(result.removedFiles).toBe(3);
    expect([...remaining]).toEqual(['user-b/745044/9.jpg']);
    expect(deps.deleteUser).toHaveBeenCalledWith('user-a');
  });

  it('removes files in batches of 100', async () => {
    const { deps, remaining } = fakeStorage(Array.from({ length: 250 }, (_, i) => `u/1/${i}.jpg`));
    await deleteAccount(deps, 'u');
    expect(deps.remove).toHaveBeenCalledTimes(3);
    expect(remaining.size).toBe(0);
  });

  it('does not delete the user when removing files fails', async () => {
    const { deps } = fakeStorage(['u/1/a.jpg']);
    deps.remove = vi.fn(async () => {
      throw new Error('storage down');
    });
    await expect(deleteAccount(deps, 'u')).rejects.toThrow('storage down');
    expect(deps.deleteUser).not.toHaveBeenCalled();
  });

  it('works for a user without photos', async () => {
    const { deps } = fakeStorage([]);
    expect((await deleteAccount(deps, 'u')).removedFiles).toBe(0);
    expect(deps.deleteUser).toHaveBeenCalledWith('u');
  });
});
