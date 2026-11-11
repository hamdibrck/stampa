const SPECIAL: Record<string, string> = {
  ı: 'i',
  ß: 'ss',
  æ: 'ae',
  œ: 'oe',
  ø: 'o',
  đ: 'd',
  ð: 'd',
  ł: 'l',
  þ: 'th',
  ə: 'a',
};

/**
 * Accent- and Turkish-insensitive search key.
 * "İstanbul" → "istanbul", "São Paulo" → "sao paulo", "Iğdır" → "igdir".
 */
export function normalizeSearch(input: string): string {
  return input
    .replace(/[İI]/g, 'i')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[ıßæœøđðłþə]/g, (ch) => SPECIAL[ch] ?? ch)
    .replace(/[\s\-'’‘`.,()/]+/g, ' ')
    .trim();
}
