import type { PurchasesPackage } from 'react-native-purchases';

import { findOffer } from './purchases';

jest.mock('react-native-purchases', () => ({ __esModule: true, default: {} }));
jest.mock('@/features/photos/photos', () => ({}));
jest.mock('@/lib/supabase', () => ({ supabase: null }));

const pkg = (identifier: string, priceString: string) =>
  ({ product: { identifier, priceString } }) as unknown as PurchasesPackage;

describe('findOffer', () => {
  it('finds the two products by identifier and keeps store prices', () => {
    const offer = findOffer([pkg('plus_yearly', '₺399,99'), pkg('city_pack_10', '₺49,99')]);
    expect(offer.cityPack?.product.priceString).toBe('₺49,99');
    expect(offer.plus?.product.priceString).toBe('₺399,99');
  });

  it('understands Google Play base-plan identifiers', () => {
    expect(findOffer([pkg('plus_yearly:yearly', '$9.99')]).plus).not.toBeNull();
  });

  it('returns nulls when products are missing', () => {
    expect(findOffer([])).toEqual({ cityPack: null, plus: null });
  });
});
