import { cachedJson, chunk } from './http';

type SparqlResult = { results: { bindings: Record<string, { value: string }>[] } };

async function sparql(query: string): Promise<Record<string, { value: string }>[]> {
  const json = await cachedJson<SparqlResult>('sparql', 'https://query.wikidata.org/sparql', {
    query,
    format: 'json',
  });
  return json.results.bindings;
}

const qidOf = (uri: string) => uri.slice(uri.lastIndexOf('/') + 1);

/** GeoNames id → Wikidata QID. When several items claim an id, the best-linked one wins. */
export async function qidsForGeoNames(
  ids: number[],
  onProgress?: (done: number) => void,
): Promise<Map<number, string>> {
  const best = new Map<number, { qid: string; links: number }>();
  let done = 0;
  for (const batch of chunk(ids, 150)) {
    const values = batch.map((id) => `"${id}"`).join(' ');
    const rows = await sparql(
      `SELECT ?gn ?item ?links WHERE { VALUES ?gn { ${values} } ?item wdt:P1566 ?gn ; wikibase:sitelinks ?links . }`,
    );
    for (const row of rows) {
      const id = Number(row.gn?.value);
      const links = Number(row.links?.value) || 0;
      const qid = qidOf(row.item?.value ?? '');
      const current = best.get(id);
      if (qid && (!current || links > current.links)) best.set(id, { qid, links });
    }
    done += batch.length;
    onProgress?.(done);
  }
  return new Map([...best].map(([id, v]) => [id, v.qid]));
}

/** ISO 3166-1 alpha-2 → Turkish country name. */
export async function turkishCountryNames(): Promise<Map<string, string>> {
  const rows = await sparql(
    `SELECT ?code ?label ?links WHERE { ?c wdt:P297 ?code ; wikibase:sitelinks ?links ; rdfs:label ?label . FILTER(LANG(?label) = "tr") }`,
  );
  const best = new Map<string, { label: string; links: number }>();
  for (const row of rows) {
    const code = row.code?.value ?? '';
    const links = Number(row.links?.value) || 0;
    const current = best.get(code);
    if (code && row.label && (!current || links > current.links)) {
      best.set(code, { label: row.label.value, links });
    }
  }
  return new Map([...best].map(([code, v]) => [code, v.label]));
}

export type Entity = {
  labelTr: string | null;
  labelEn: string | null;
  descriptionTr: string | null;
  descriptionEn: string | null;
  trwiki: string | null;
  enwiki: string | null;
};

type WbEntities = {
  entities?: Record<
    string,
    {
      labels?: Record<string, { value: string }>;
      descriptions?: Record<string, { value: string }>;
      sitelinks?: Record<string, { title: string }>;
    }
  >;
};

export async function fetchEntities(
  qids: string[],
  onProgress?: (done: number) => void,
): Promise<Map<string, Entity>> {
  const out = new Map<string, Entity>();
  let done = 0;
  for (const batch of chunk(qids, 50)) {
    const params = new URLSearchParams({
      action: 'wbgetentities',
      ids: batch.join('|'),
      props: 'labels|descriptions|sitelinks',
      languages: 'tr|en',
      sitefilter: 'trwiki|enwiki',
      format: 'json',
    });
    const json = await cachedJson<WbEntities>(
      'wikidata',
      `https://www.wikidata.org/w/api.php?${params}`,
    );
    for (const [qid, e] of Object.entries(json.entities ?? {})) {
      out.set(qid, {
        labelTr: e.labels?.tr?.value ?? null,
        labelEn: e.labels?.en?.value ?? null,
        descriptionTr: e.descriptions?.tr?.value ?? null,
        descriptionEn: e.descriptions?.en?.value ?? null,
        trwiki: e.sitelinks?.trwiki?.title ?? null,
        enwiki: e.sitelinks?.enwiki?.title ?? null,
      });
    }
    done += batch.length;
    onProgress?.(done);
  }
  return out;
}
