import { cachedJson, chunk } from './http';

const CONCURRENCY = 4;

type ExtractResponse = {
  continue?: Record<string, string>;
  query?: {
    normalized?: { from: string; to: string }[];
    redirects?: { from: string; to: string }[];
    pages?: { title: string; extract?: string; missing?: boolean }[];
  };
};

/**
 * Plain-text intro of each page, keyed by the title that was asked for.
 * Uses the TextExtracts API in batches (same text as REST `page/summary`, ~20× fewer requests).
 */
export async function fetchIntros(
  lang: 'tr' | 'en',
  titles: string[],
  onProgress?: (done: number) => void,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const batches = chunk([...new Set(titles)], 20);
  let done = 0;
  let next = 0;

  // The API hands out only a few extracts per response and asks the client to continue, so a
  // batch costs many round trips. A small worker pool keeps the total time reasonable.
  const worker = async () => {
    for (;;) {
      const batch = batches[next++];
      if (!batch) return;
      for (const [title, extract] of await fetchBatch(lang, batch)) out.set(title, extract);
      done += batch.length;
      onProgress?.(done);
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return out;
}

async function fetchBatch(lang: 'tr' | 'en', batch: string[]): Promise<Map<string, string>> {
  const alias = new Map<string, string>(); // resolved title → requested title
  const extracts = new Map<string, string>();
  let cont: Record<string, string> = {};
  for (let guard = 0; guard < 30; guard++) {
    const params = new URLSearchParams({
      action: 'query',
      prop: 'extracts',
      exintro: '1',
      explaintext: '1',
      exlimit: '20',
      redirects: '1',
      titles: batch.join('|'),
      format: 'json',
      formatversion: '2',
      ...cont,
    });
    const json = await cachedJson<ExtractResponse>(
      `wikipedia-${lang}`,
      `https://${lang}.wikipedia.org/w/api.php?${params}`,
    );
    for (const n of json.query?.normalized ?? []) alias.set(n.to, alias.get(n.from) ?? n.from);
    for (const r of json.query?.redirects ?? []) alias.set(r.to, alias.get(r.from) ?? r.from);
    for (const p of json.query?.pages ?? []) {
      if (p.extract) extracts.set(p.title, p.extract);
    }
    if (!json.continue) break;
    cont = json.continue;
  }
  const out = new Map<string, string>();
  for (const [title, extract] of extracts) out.set(alias.get(title) ?? title, extract);
  return out;
}
