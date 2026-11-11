# Kararlar

Format: **Karar / Neden / Alternatif**. Yeni kararlar sona eklenir.

## D1 — Harita altlığı tamamen yerel
- **Karar:** Harita stili uygulama içinde üretilir: okyanus arka planı + Natural Earth 50m'den sadeleştirilmiş ülke dolgu/sınır katmanları + şehir `ShapeSource`. `EXPO_PUBLIC_MAPTILER_KEY` tanımlıysa yüksek zoom için MapTiler vektör katmanı eklenir.
- **Neden:** Anahtar ve ağ gerektirmez (offline-first, soğuk açılış hedefi), mockup renklerine birebir uyar, karo maliyeti yok.
- **Alternatif:** MapTiler/Protomaps koyu stilini doğrudan kullanmak — daha detaylı altlık, ama anahtar/ağ bağımlılığı ve renk uyumu için stil düzenleme gerekir.

## D2 — `cities.id = geonames_id`
- **Karar:** `cities.id` integer PK, değeri GeoNames kimliği. `geonames_id` sütunu da UNIQUE olarak tutulur.
- **Neden:** Gömülü paketteki kimlikler ile DB kimlikleri ağ olmadan aynı olmalı (offline damgalama). Seed idempotentliği kendiliğinden gelir. v2 `ratings`/`comments` doğrudan `city_id` FK kullanır.
- **Alternatif:** Ayrı serial/uuid `id` — istemcinin eşleme tablosu indirmesini gerektirir.

## D3 — Şehir tanımı ve Türkiye = 81 il
- **Karar:** Varsayılan kural: nüfus ≥ 100.000 + başkent. TR için: her `admin1` için il merkezi (`PPLA`, Ankara için `PPLC`), tam 81 kayıt. Görünen ad **il adı**dır (İzmit → Kocaeli, Antakya → Hatay, Adapazarı → Sakarya); plaka kodu eklenir. Kurallar `scripts/cities/rules.ts` içinde ülke koduna göre override edilir.
- **Neden:** Türk kullanıcı "81 ili gezdim" diye düşünür; il merkezi adı yerine il adı beklenir.
- **Alternatif:** TR için de ≥100k kuralı (≈ 150+ ilçe/şehir, "81 il" beklentisini bozar).

## D4 — Dünya yüzdesi = şehir sayısı bazlı
- **Karar:** `gezilen şehir / toplam şehir`.
- **Neden:** Basit, anlaşılır, her damga sayacı hareket ettirir.
- **Alternatif:** (a) Ülke sayısı bazlı (`gezilen ülke / ~195`) — tek şehirle ülke "tamamlanır", ilerleme hissi kaba. (b) Alan bazlı (gezilen ülkelerin yüzölçümü / dünya kara alanı) — Rusya/Kanada gibi ülkeler orantısız etki yapar. (c) Nüfus ağırlıklı. İleride ikincil metrik olarak eklenebilir.

## D5 — Gömülü veri paketi: sütunlu JSON, özetler hariç
- **Karar:** `cities.v1.json` sütunlu (alan başına dizi) ve versiyonlu; özet metinleri pakette yok, Supabase'den lazy çekilip cache'lenir. Özet yoksa "Ülke · Bölge · Nüfus".
- **Neden:** Küçük paket, hızlı parse, ilk açılışta ağ gerekmez.
- **Alternatif:** Gömülü SQLite — bu boyutta (binlerce satır) gereksiz karmaşıklık.

## D6 — Yerel kayıt: Zustand + MMKV, outbox ile senkron
- **Karar:** Ziyaretler önce yerelde yazılır; her değişiklik outbox'a girer; oturum varsa ve bağlantı gelince `sync_visits` RPC'siyle gönderilir. Girişte uzak veri çekilir ve misafir verisiyle birleştirilir (union). Çakışmada son yazan kazanır; outbox'ta bekleyen şehirler için yerel durum önceliklidir.
- **Neden:** Offline-first ve misafir modu aynı mekanizmayla çözülür.
- **Alternatif:** SQLite + tam CRDT — MVP için fazla.

## D7 — Şehir paketi mağazada "consumable"
- **Karar:** `city_pack_10` App Store / Play'de **consumable** tanımlanır; sunucuda süresiz entitlement'a çevrilir. Şehir eşlemesi: satın alma öncesi `purchase_intents(user, city)` yazılır, webhook olayı en son tüketilmemiş niyetle eşlenir. "Geri yükle" bu ürün için sunucudaki `entitlements` tablosundan gelir (hesaba bağlı); Plus için RevenueCat restore kullanılır.
- **Neden:** Non-consumable ürün hesap başına yalnızca bir kez satın alınabilir; paket ise şehir başına satılıyor. Görev tanımındaki "tüketilmeyen" davranış (kalıcılık) sunucu tarafında sağlanır.
- **Alternatif:** (a) Tek non-consumable → yalnızca bir şehre alınabilir. (b) Şehir başına ayrı ürün → binlerce ürün, yönetilemez.

## D8 — RevenueCat kimliği ve fotoğraf için giriş zorunluluğu
- **Karar:** RevenueCat `app_user_id` = Supabase `user_id`. Fotoğraf eklemek ve satın almak için giriş gerekir; damgalama misafirken serbest.
- **Neden:** Fotoğraflar ve entitlement'lar sunucuda kullanıcıya bağlı; anonim kimlik birleştirme hatalarını önler.
- **Alternatif:** Supabase anonim oturum — hesap birleştirme karmaşıklığı.

## D9 — Fotoğraf kotası: sayım `storage.objects` üzerinden
- **Karar:** Yol `{user_id}/{city_id}/{uuid}.jpg`. `storage.objects` INSERT policy'si `can_upload_photo` çağırır; mevcut sayı aynı önekteki Storage objelerinden hesaplanır, advisory lock ile yarış engellenir. `photos` tablosu meta veri içindir ve insert trigger'ı objenin varlığını doğrular.
- **Neden:** İstemci `photos` satırını yazmayı atlasa bile limit aşılamaz.
- **Alternatif:** Yalnızca `photos` tablosundan sayım — atlatılabilir.

## D10 — Topluluk istatistiği: payda ve k-anonimlik
- **Karar:** `visitor_share = şehri gezen aktif kullanıcı / son 90 günde aktif kullanıcı`. "Aktif" = `profiles.last_active_at` son 90 gün içinde (senkron sırasında güncellenir). `pg_cron` 15 dakikada bir `refresh_stats()` çalıştırır. Ziyaretçi sayısı < 20 ise view payı ve sayıyı NULL döner → "Yeni keşif". Ülke ortalaması = o ülkede en az bir şehir gezmiş aktif kullanıcıların ortalama şehir sayısı; ülkede < 20 kullanıcı varsa NULL.
- **Neden:** Terk edilmiş hesaplar yüzdeleri sulandırmasın; küçük gruplarda bireyler çıkarsanamasın.
- **Alternatif:** Payda = tüm kayıtlı kullanıcılar (zamanla yüzdeler anlamsız düşer).

## D11 — Ana ekran yerleşimi
- **Karar:** Üstte sayaç + arama, harita ana alanı kaplar, "Ülkelerin" listesi haritanın altından çekilebilir bir panel. Şehir detayı ve paywall alt sheet.
- **Neden:** F2 "tam ekran harita" ile mockup'taki "harita + ülke listesi" yerleşimini birlikte karşılar.
- **Alternatif:** Tek dikey scroll — harita jestleri scroll ile çakışır.

## D12 — Auth yöntemi
- **Karar:** Apple ve Google native akış + `signInWithIdToken`; magic link `stampa://auth/callback` deep link ile.
- **Neden:** Native akış App Store beklentisine uygun; web yönlendirmesi yok.
- **Alternatif:** Tamamı web OAuth (`signInWithOAuth`) — daha az native bağımlılık, daha kötü deneyim.

## D13 — Test araçları
- **Karar:** Mobil: jest-expo + RNTL. `packages/shared` ve `scripts/cities`: Vitest. DB: pgTAP (`supabase test db`). Edge Function iş mantığı Deno'dan bağımsız saf TS modüllerinde tutulur ve Vitest ile test edilir.
- **Neden:** Her katman için en az sürtünmeli araç; Deno kurulumu gerektirmez.
- **Alternatif:** Her yerde Jest.
