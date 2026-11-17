# Elle yapılacaklar

Hesap, ödeme veya geri alınamaz işlem gerektirdiği için kodda yalnızca `.env` placeholder'ı bırakılan adımlar. Sıra, önerilen uygulama sırasıdır.

## 0. Repo
- [ ] `stampa/stampa/` klasörü: içinde boş bir git deposu olan başıboş klasör. Dokunulmadı, `.gitignore`'a eklendi. Gerekmiyorsa sil.
- [x] `git push -u origin main` — yapıldı; GitHub Actions CI yeşil. Repo şu an **herkese açık**; istemiyorsan GitHub → Settings → Danger Zone'dan private yap.

## 1. Uygulama kimliği (store kaydından ÖNCE karar ver)
- [x] Bundle identifier / Android package: `app.stampa.mobile` olarak kalmasına karar verildi (D16). Store kaydı açıldıktan sonra değiştirilemez. `STAMPA_BUNDLE_ID` ortam değişkeni veya `apps/mobile/app.config.ts`.

## 2. Supabase
Proje: `stampa` (`wjchuvvscphwcqtapfak`), bölge **eu-central-1 (Frankfurt)**. (İlk proje yanlışlıkla Tokyo'da açılmıştı; silinip yeniden kuruldu.)

- [x] Proje oluşturuldu; `apps/mobile/.env` gerçek projeyi gösteriyor (yerel değerler yorum satırında).
- [x] Migration'lar + ~5.900 şehir seed'i gönderildi (`npx supabase db push --remote --include-seed`).
- [x] `pg_cron`: `refresh-community-stats` görevi `*/15 * * * *` ile aktif.
- [x] Edge Function'lar yayında: `revenuecat-webhook`, `delete-account`, `refresh-entitlements`.
- [x] `REVENUECAT_WEBHOOK_SECRET` tanımlandı. Değer yerelde `supabase/.env.remote` dosyasında (git'e girmez); RevenueCat webhook ayarında lazım olacak.
- [ ] `REVENUECAT_SECRET_API_KEY`: RevenueCat projesi açılınca `npx supabase secrets set --remote REVENUECAT_SECRET_API_KEY=<değer>`.
- [ ] Auth → URL Configuration: Site URL `stampa://auth/callback`, Redirect URLs'e `stampa://**` ekle.
- [ ] Auth → Email: magic link şablonunu gözden geçir; üretimde özel SMTP tanımla (varsayılan SMTP saatte birkaç e-postayla sınırlı).
- [ ] Yayından önce ücretli plana geç (Free planda proje hareketsiz kalınca duraklatılır).

## 3. Apple
- [ ] Apple Developer Program üyeliği; App ID (bundle id) oluştur, "Sign in with Apple" yeteneğini aç.
- [ ] Supabase → Auth → Providers → Apple: etkinleştir, "Client IDs" alanına bundle id'yi yaz (native akış için yeterli).
- [ ] App Store Connect'te uygulama kaydı aç.
- [ ] Ürünler: `city_pack_10` → **Consumable** (D7: şehir başına tekrar alınabilmesi için), `plus_yearly` → Auto-Renewable Subscription (1 yıl, bir abonelik grubunda). Fiyatları burada belirle.
- [ ] Sandbox test kullanıcısı oluştur.

## 4. Google
- [ ] Google Cloud'da OAuth istemcileri: **Web** (Supabase için), **iOS**, **Android** (SHA-1 ile).
- [ ] Supabase → Auth → Providers → Google: etkinleştir; Client IDs alanına web + iOS + Android istemci kimliklerini yaz.
- [ ] `apps/mobile/.env`: `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`.
- [ ] Build ortamına `GOOGLE_IOS_URL_SCHEME=com.googleusercontent.apps.<ios-client-id>` ver (EAS secret / `eas.json` env). Şu an placeholder.
- [ ] Play Console'da uygulama kaydı; ürünler: `city_pack_10` (tüketilebilir uygulama içi ürün), `plus_yearly` (abonelik, yıllık temel plan).

## 5. RevenueCat
- [ ] Proje + iOS ve Android uygulamaları; App Store Connect / Play servis kimlik bilgilerini bağla.
- [ ] Ürünleri içe aktar; entitlement `plus` → `plus_yearly`. Offering (current): `city_pack_10` ve `plus_yearly` paketleri.
- [ ] `apps/mobile/.env`: `EXPO_PUBLIC_REVENUECAT_IOS_KEY`, `EXPO_PUBLIC_REVENUECAT_ANDROID_KEY` (public SDK anahtarları).
- [ ] Webhook: URL `https://<ref>.supabase.co/functions/v1/revenuecat-webhook`, Authorization header değeri = `REVENUECAT_WEBHOOK_SECRET`.
- [ ] **Sandbox doğrulaması (yerelde yapılamadı):** Şehir paketi al → o şehirde kota 12 olmalı; Plus al → sınırsız; uygulamayı silip yeniden kur → "Satın alımları geri yükle" ile geri gelmeli.

## 6. EAS / build
- [ ] `npx eas-cli@latest login` ve `npx eas-cli@latest init` (`apps/mobile` içinde; proje kimliğini config'e ekler).
- [ ] `.env` değerlerini EAS ortam değişkenlerine de tanımla (`eas env:create` ya da Dashboard).
- [ ] `npx eas-cli@latest build --profile development --platform ios` ve `--platform android`.
- [ ] **Android doğrulaması (yerelde yapılamadı — bu makinede JDK/Android SDK yok):** harita, damgalama, giriş, fotoğraf yükleme, soğuk açılış süresi (hedef < 2 sn, orta seviye cihaz).
- [ ] Gerçek cihazda: Apple ile giriş, Google ile giriş, magic link (e-postadaki bağlantının uygulamayı açması).

## 7. Yayın öncesi
- [ ] Gizlilik politikası ve kullanım koşulları sayfalarını yayınla; `EXPO_PUBLIC_PRIVACY_URL`, `EXPO_PUBLIC_TERMS_URL`. İçerik için: `docs/store/privacy-labels.md`.
- [ ] Play için web üzerinden hesap silme talebi URL'si.
- [ ] Store metinleri: `docs/store/listing.md`; ekran görüntüleri (6,7" ve 6,5" iPhone; telefon Android).
- [ ] App Privacy / Data Safety formları: `docs/store/privacy-labels.md`.
- [ ] İkon: `apps/mobile/scripts/generate-icons.py` ile üretilmiş basit bir damga ikonu var; istersen tasarımcı ikonuyla değiştir.

## Opsiyonel
- [ ] MapTiler anahtarı → `EXPO_PUBLIC_MAPTILER_KEY`. Olmadan harita çalışır ama **harita üzerinde yazı yok** (küme sayıları, şehir adları); anahtar eklenince görünür (D1, D17).
