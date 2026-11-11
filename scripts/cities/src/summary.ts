const MAX_LENGTH = 320;
const ENOUGH = 110;

function stripParentheses(text: string): string {
  let prev: string;
  let out = text;
  do {
    prev = out;
    out = out.replace(/\s*[([][^()[\]]*[)\]]/g, '');
  } while (out !== prev);
  return out;
}

/** Splits on sentence ends that are followed by a capital letter, digit or quote. */
function sentences(text: string): string[] {
  return text
    .split(/(?<=[^\s.][.!?])\s+(?=[A-ZÇĞİÖŞÜÀ-Þ0-9"“'‘])/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * First one or two sentences of an encyclopedia intro, cleaned for a small card:
 * no pronunciation/parenthetical noise, no line breaks, at most ~320 characters.
 */
export function shortSummary(intro: string | null | undefined): string | null {
  if (!intro) return null;
  const firstParagraph = intro.split(/\n+/).find((p) => p.trim().length > 40) ?? intro;
  const clean = stripParentheses(firstParagraph)
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/,\s*,/g, ',')
    .trim();
  if (clean.length < 20) return null;

  const parts = sentences(clean);
  let out = parts[0] ?? clean;
  if (out.length < ENOUGH && parts[1] && out.length + parts[1].length + 1 <= MAX_LENGTH) {
    out = `${out} ${parts[1]}`;
  }
  if (out.length > MAX_LENGTH) {
    const cut = out.slice(0, MAX_LENGTH);
    out = `${cut.slice(0, cut.lastIndexOf(' '))}…`;
  }
  return out;
}

/** "türkiye'nin başkenti" → "Türkiye'nin başkenti" */
export function sentenceCase(text: string | null | undefined, locale: 'tr' | 'en'): string | null {
  const t = text?.trim();
  if (!t) return null;
  return t.charAt(0).toLocaleUpperCase(locale) + t.slice(1);
}
