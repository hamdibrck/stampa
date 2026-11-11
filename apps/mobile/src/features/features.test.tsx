import { act, render, screen } from '@testing-library/react-native';

import { buildSections } from '@/app/(tabs)/list';
import { citiesByCountry, cities } from '@/data/world';
import { CommunityCard } from '@/features/city/CommunityCard';
import { fallbackSummary } from '@/features/city/citySummary';
import { WorldCounter } from '@/features/home/WorldCounter';
import i18n from '@/i18n';
import { useVisits } from '@/store/visits';

jest.mock('expo-router', () => ({ useRouter: () => ({ push: jest.fn(), navigate: jest.fn() }) }));

const turkey = citiesByCountry.get('TR')!;

beforeEach(async () => {
  useVisits.getState().clear();
  await i18n.changeLanguage('tr');
});

describe('WorldCounter', () => {
  it('updates immediately when a city is stamped', async () => {
    await render(<WorldCounter />);
    expect(screen.getByTestId('world-percent')).toHaveTextContent('%0,0');
    expect(screen.getByTestId('world-counts')).toHaveTextContent('0 şehir · 0 ülke');

    await act(async () => {
      for (const c of turkey) useVisits.getState().toggle(c.id);
    });
    expect(screen.getByTestId('world-counts')).toHaveTextContent('81 şehir · 1 ülke');
    expect(screen.getByTestId('world-percent')).not.toHaveTextContent('%0,0');

    await act(async () => {
      useVisits.getState().toggle(turkey[0]!.id);
    });
    expect(screen.getByTestId('world-counts')).toHaveTextContent('80 şehir · 1 ülke');
  });
});

describe('CommunityCard', () => {
  it('shows the share when the server provides one', async () => {
    await render(<CommunityCard share={0.25} />);
    expect(screen.getByTestId('community-share')).toHaveTextContent(
      'Kullanıcıların %25 kadarı gezdi',
    );
  });

  it('shows "Yeni keşif" when the share is hidden by k-anonymity', async () => {
    await render(<CommunityCard share={null} />);
    expect(screen.getByTestId('community-new')).toHaveTextContent('Yeni keşif');
    expect(screen.queryByTestId('community-share')).toBeNull();
  });

  it('shows "Yeni keşif" while stats are unavailable (offline / not configured)', async () => {
    await render(<CommunityCard share={undefined} />);
    expect(screen.getByTestId('community-new')).toBeTruthy();
  });
});

describe('fallbackSummary', () => {
  it('uses "Ülke · Bölge · Nüfus"', () => {
    const paris = cities.find((c) => c.nameEn === 'Paris' && c.country === 'FR')!;
    const text = fallbackSummary(paris, 'tr');
    expect(text.split(' · ')).toHaveLength(3);
    expect(text).toContain('Nüfus');
  });
});

describe('visited list sections', () => {
  const visits = {
    [String(turkey[0]!.id)]: { visitedAt: '2026-01-10', updatedAt: '2026-01-10T00:00:00Z' },
    [String(turkey[1]!.id)]: { visitedAt: '2026-03-05', updatedAt: '2026-03-05T00:00:00Z' },
    [String(citiesByCountry.get('FR')![0]!.id)]: {
      visitedAt: '2026-02-01',
      updatedAt: '2026-02-01T00:00:00Z',
    },
  };

  it('groups by country and sorts by visit date, newest first', () => {
    const sections = buildSections(visits, true);
    expect(sections.map((s) => s.country.iso2)).toEqual(['TR', 'FR']);
    expect(sections[0]!.data.map((i) => i.visitedAt)).toEqual(['2026-03-05', '2026-01-10']);
  });

  it('can sort oldest first', () => {
    const sections = buildSections(visits, false);
    expect(sections.map((s) => s.country.iso2)).toEqual(['TR', 'FR']);
    expect(sections[0]!.data.map((i) => i.visitedAt)).toEqual(['2026-01-10', '2026-03-05']);
  });
});
