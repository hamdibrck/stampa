import i18n, { countLabel, toSupportedLocale } from '.';
import en from './locales/en.json';
import tr from './locales/tr.json';

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe('i18n', () => {
  it('has identical keys in tr and en', () => {
    expect(keys(tr).sort()).toEqual(keys(en).sort());
  });

  it('maps device languages to supported locales', () => {
    expect(toSupportedLocale('tr')).toBe('tr');
    expect(toSupportedLocale('tr-TR')).toBe('tr');
    expect(toSupportedLocale('de')).toBe('en');
    expect(toSupportedLocale(undefined)).toBe('en');
  });

  it('pluralises units per language', async () => {
    await i18n.changeLanguage('en');
    expect(countLabel('city', 1)).toBe('1 city');
    expect(countLabel('city', 34)).toBe('34 cities');
    await i18n.changeLanguage('tr');
    expect(countLabel('city', 34)).toBe('34 şehir');
    expect(countLabel('country', 9)).toBe('9 ülke');
  });
});
