import { contrastRatio } from './contrast';
import { colors } from './tokens';

describe('colour contrast (WCAG AA, 4.5:1)', () => {
  const pairs: [string, string, string][] = [
    ['text on bg', colors.text, colors.bg],
    ['text on surface', colors.text, colors.surface],
    ['text on surface2', colors.text, colors.surface2],
    ['textMuted on bg', colors.textMuted, colors.bg],
    ['textMuted on surface', colors.textMuted, colors.surface],
    ['textSoft on surface', colors.textSoft, colors.surface],
    ['accent on bg', colors.accent, colors.bg],
    ['accent on surface', colors.accent, colors.surface],
    ['onAccent on accent', colors.onAccent, colors.accent],
    ['textMuted on tabBar', colors.textMuted, colors.tabBar],
  ];

  it.each(pairs)('%s', (_name, fg, bg) => {
    expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(4.5);
  });
});
