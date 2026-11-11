export type StorageEntry = { name: string; isFolder: boolean };

export type DeleteAccountDeps = {
  /** Lists one level of the photos bucket under `prefix`. */
  list(prefix: string): Promise<StorageEntry[]>;
  remove(paths: string[]): Promise<void>;
  /** Deletes the auth user; visits, photos, entitlements and the profile cascade in Postgres. */
  deleteUser(userId: string): Promise<void>;
};

async function collect(deps: DeleteAccountDeps, prefix: string, depth = 0): Promise<string[]> {
  if (depth > 4) return [];
  const out: string[] = [];
  for (const entry of await deps.list(prefix)) {
    const path = `${prefix}/${entry.name}`;
    if (entry.isFolder) out.push(...(await collect(deps, path, depth + 1)));
    else out.push(path);
  }
  return out;
}

/**
 * Removes every photo file of the user, then the user. Files go first: if anything fails the
 * account still exists and the request can simply be repeated.
 */
export async function deleteAccount(
  deps: DeleteAccountDeps,
  userId: string,
): Promise<{ removedFiles: number }> {
  const paths = await collect(deps, userId);
  for (let i = 0; i < paths.length; i += 100) await deps.remove(paths.slice(i, i + 100));
  await deps.deleteUser(userId);
  return { removedFiles: paths.length };
}
