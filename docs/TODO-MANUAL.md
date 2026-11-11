# Elle yapılacaklar

Hesap, ödeme veya geri alınamaz işlem gerektirdiği için kodda yalnızca `.env` placeholder'ı bırakılan adımlar. Milestone ilerledikçe güncellenir.

## Repo
- [ ] `stampa/stampa/` klasörü: içinde boş bir git deposu olan başıboş klasör. Dokunulmadı, `.gitignore`'a eklendi. Gerekmiyorsa silebilirsin.
- [ ] `git push -u origin main` — commit'ler yalnızca yerelde atılıyor.

## Supabase (M2, M5–M9)
- [ ] Proje oluştur; `EXPO_PUBLIC_SUPABASE_URL` ve `EXPO_PUBLIC_SUPABASE_ANON_KEY` değerlerini `apps/mobile/.env` dosyasına yaz.
- [ ] `npx supabase link` + `npx supabase db push` ile migration'ları uygula.
- [ ] Dashboard → Database → Extensions: `pg_cron` etkinleştir.
- [ ] Şehir verisini seed et (komut M2 sonunda buraya eklenecek).

## Harita (opsiyonel)
- [ ] MapTiler anahtarı → `EXPO_PUBLIC_MAPTILER_KEY`. Olmadan da harita çalışır (D1).

## Uygulama kimliği
- [ ] Bundle identifier / Android package'a karar ver (şu an `app.stampa.mobile`, bkz. D16). Store kaydı açıldıktan sonra değiştirilemez. `STAMPA_BUNDLE_ID` ortam değişkeni veya `apps/mobile/app.config.ts`.
