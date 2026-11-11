import { sentenceCase, shortSummary } from './summary';
import type { Enrichment, SelectedCity } from './types';
import { fetchEntities, qidsForGeoNames } from './wikidata';
import { fetchIntros } from './wikipedia';

const progress = (label: string, total: number) => (done: number) => {
  if (done % 200 < 20 || done >= total) process.stdout.write(`\r  ${label}: ${done}/${total}   `);
  if (done >= total) process.stdout.write('\n');
};

/** Wikidata labels/descriptions + Wikipedia intros for every city. Network results are cached. */
export async function enrichCities(cities: SelectedCity[]): Promise<Map<number, Enrichment>> {
  const ids = cities.map((c) => c.id);
  const qids = await qidsForGeoNames(ids, progress('wikidata ids', ids.length));
  const uniqueQids = [...new Set(qids.values())];
  const entities = await fetchEntities(
    uniqueQids,
    progress('wikidata entities', uniqueQids.length),
  );

  const titles = { tr: [] as string[], en: [] as string[] };
  for (const e of entities.values()) {
    if (e.trwiki) titles.tr.push(e.trwiki);
    if (e.enwiki) titles.en.push(e.enwiki);
  }
  const introsTr = await fetchIntros('tr', titles.tr, progress('tr.wikipedia', titles.tr.length));
  const introsEn = await fetchIntros('en', titles.en, progress('en.wikipedia', titles.en.length));

  const out = new Map<number, Enrichment>();
  for (const id of ids) {
    const qid = qids.get(id) ?? null;
    const e = qid ? entities.get(qid) : undefined;
    out.set(id, {
      qid,
      labelTr: e?.labelTr ?? null,
      labelEn: e?.labelEn ?? null,
      descriptionTr: e?.descriptionTr ?? null,
      descriptionEn: e?.descriptionEn ?? null,
      summaryTr:
        shortSummary(e?.trwiki ? introsTr.get(e.trwiki) : null) ??
        sentenceCase(e?.descriptionTr, 'tr'),
      summaryEn:
        shortSummary(e?.enwiki ? introsEn.get(e.enwiki) : null) ??
        sentenceCase(e?.descriptionEn, 'en'),
    });
  }
  return out;
}
