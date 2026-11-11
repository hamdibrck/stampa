import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const CACHE = join(ROOT, '.cache');
export const REPO = join(ROOT, '..', '..');

// Generic client name on purpose: no personal contact details leave this machine.
const USER_AGENT = 'StampaCitySeed/0.1 (one-off city data seeding script)';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function request(url: string, init: RequestInit, attempt = 0): Promise<Response> {
  let res: Response | null = null;
  try {
    res = await fetch(url, {
      ...init,
      headers: { 'User-Agent': USER_AGENT, ...(init.headers ?? {}) },
      signal: AbortSignal.timeout(90_000),
    });
  } catch (err) {
    if (attempt >= 5) throw err;
  }
  if (res?.ok) return res;
  if (res && ![429, 500, 502, 503, 504].includes(res.status)) {
    throw new Error(`${res.status} ${res.statusText} for ${url}`);
  }
  if (attempt >= 5) throw new Error(`Giving up on ${url} (${res?.status ?? 'network error'})`);
  const retryAfter = Number(res?.headers.get('retry-after')) || 0;
  await sleep(Math.max(retryAfter * 1000, 1500 * 2 ** attempt));
  return request(url, init, attempt + 1);
}

/** Downloads a file once; later runs reuse the cached copy. */
export async function download(url: string, relPath: string): Promise<string> {
  const path = join(CACHE, relPath);
  if (!existsSync(path)) {
    mkdirSync(dirname(path), { recursive: true });
    const res = await request(url, {});
    writeFileSync(path, Buffer.from(await res.arrayBuffer()));
  }
  return path;
}

/**
 * JSON request with an on-disk cache keyed by the request, so the enrichment step can be
 * interrupted and resumed, and re-runs do not hit the network again.
 */
export async function cachedJson<T>(
  bucket: string,
  url: string,
  body?: Record<string, string>,
): Promise<T> {
  const key = createHash('sha1')
    .update(url + JSON.stringify(body ?? null))
    .digest('hex');
  const path = join(CACHE, bucket, `${key}.json`);
  if (existsSync(path)) return JSON.parse(readFileSync(path, 'utf8')) as T;
  const res = await request(
    url,
    body
      ? {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            Accept: 'application/json',
          },
          body: new URLSearchParams(body).toString(),
        }
      : { headers: { Accept: 'application/json' } },
  );
  const json = (await res.json()) as T;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(json));
  await sleep(60);
  return json;
}

export function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
