# Stampa

Gezdiğin şehirleri haritada damgala; dünyanın yüzde kaçını gördüğünü takip et.

- Plan ve durum: [docs/PLAN.md](docs/PLAN.md)
- Kararlar: [docs/DECISIONS.md](docs/DECISIONS.md)
- Elle yapılacaklar (hesaplar, anahtarlar): [docs/TODO-MANUAL.md](docs/TODO-MANUAL.md)

## Yapı

| Klasör | İçerik |
|---|---|
| `apps/mobile` | Expo (React Native) uygulaması |
| `packages/shared` | Ortak saf TypeScript (arama normalizasyonu, sayı formatı) |
| `scripts/cities` | Şehir veri hattı (GeoNames → kurallar → Wikidata/Wikipedia → paket + seed) |
| `supabase` | Migration'lar, seed, pgTAP testleri, Edge Function'lar |

## Başlangıç

```bash
pnpm install

# Kalite kontrolleri
pnpm lint && pnpm typecheck && pnpm test

# Yerel backend (Docker gerekir) + veritabanı testleri
npx supabase start
pnpm test:db

# Uygulama (MapLibre native kod içerdiği için Expo Go'da çalışmaz, dev build gerekir)
cp apps/mobile/.env.example apps/mobile/.env   # değerleri doldur
pnpm mobile ios        # veya: pnpm mobile android
pnpm mobile start
```

## Şehir verisi

Uygulamaya gömülü paket (`apps/mobile/assets/data`) ve veritabanı seed'i (`supabase/seed`) repoda hazır gelir. Yeniden üretmek için:

```bash
pnpm cities build      # download → select → enrich → emit (ağ gerekir, sonuçlar .cache altında saklanır)
```

Hangi yerleşimin "şehir" sayılacağı `scripts/cities/rules.ts` içinde tanımlıdır (varsayılan: nüfus ≥ 100.000 + başkent; Türkiye: 81 il).

Veri kaynakları: GeoNames (CC BY 4.0), Natural Earth (kamu malı), Wikipedia/Wikidata.
