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

## D14 — pnpm tedarik zinciri ayarları
- **Karar:** pnpm 12'nin `minimumReleaseAge` korumasında yalnızca Expo SDK 58 paketleri için istisna tanımlandı (`pnpm-workspace.yaml`, kurulum sırasında otomatik yazıldı). Build script izni yalnızca `esbuild` için verildi; `@parcel/watcher` reddedildi.
- **Neden:** `create-expo-app` en güncel SDK yamalarını sabitliyor; bunlar yeni yayımlandığı için varsayılan yaş eşiğine takılıyor.
- **Alternatif:** Daha eski bir Expo yaması sabitlemek.

## D15 — ESLint 9
- **Karar:** ESLint 9.x kullanılıyor.
- **Neden:** `eslint-config-expo` içindeki `eslint-plugin-react`, ESLint 10 ile çalışmıyor.
- **Alternatif:** Expo yapılandırması güncellenince 10'a geçmek.

## D16 — Bundle kimliği placeholder
- **Karar:** iOS bundle identifier ve Android package `app.stampa.mobile` (ortam değişkeni `STAMPA_BUNDLE_ID` ile değiştirilebilir).
- **Neden:** Store kayıtları henüz yok; build alınabilmesi için bir değer gerekli.
- **Alternatif:** Kendi alan adına göre (ör. `com.<şirket>.stampa`) — store kaydı açılmadan önce karar verilmeli.

## D17 — Harita üzerindeki yazılar yalnızca MapTiler anahtarıyla
- **Karar:** Küme sayıları ve şehir adı etiketleri, `EXPO_PUBLIC_MAPTILER_KEY` tanımlıysa eklenir. Anahtar yokken kümeler boyutlarıyla ifade edilir, şehir adı dokununca mini kartta görünür.
- **Neden:** MapLibre'de metin çizimi bir glyph (font) sunucusu gerektirir; yerel altlıkta (D1) böyle bir kaynak yok.
- **Alternatif:** Glyph PBF dosyalarını uygulamaya gömmek — mümkün, ama paket boyutu ve `asset://` yol farkları nedeniyle v1'e alınmadı.

## D18 — Wikipedia özetleri TextExtracts API ile
- **Karar:** Özetler REST `page/summary` yerine Action API `prop=extracts&exintro` ile toplu çekilir; ilk 1–2 cümle `shortSummary` ile alınır (en fazla ~320 karakter, parantez içleri temizlenir). Wikipedia özeti yoksa Wikidata açıklaması, o da yoksa uygulamada "Ülke · Bölge · Nüfus".
- **Neden:** Aynı metin kaynağı; istekler gruplanabiliyor ve sonuçlar diskte önbelleğe alınıyor.
- **Alternatif:** Şehir başına iki REST isteği (~12 bin istek).

## D19 — Wikidata eşlemesi GeoNames kimliği üzerinden
- **Karar:** Şehir → Wikidata eşlemesi `P1566` (GeoNames ID) ile yapılır; birden çok aday varsa en çok site bağlantısı olan seçilir. Eşleşmeyen şehirler GeoNames adıyla ve yedek metinle kalır.
- **Neden:** Ada göre eşleştirme yanlış şehir riskini taşır.
- **Alternatif:** GeoNames `alternateNamesV2` dökümündeki Wikidata bağlantıları (≈200 MB indirme) — kapsama artırmak için ileride eklenebilir.

## D20 — Fotoğraf kayıtları Storage tetikleyicileriyle
- **Karar:** `public.photos` satırları istemci tarafından değil, `storage.objects` üzerindeki tetikleyicilerle oluşturulur/silinir. İstemci yalnızca `width`/`height` günceller.
- **Neden:** Dosya ile kayıt her zaman bire bir kalır; yarıda kalan yüklemeler "görünmez" kota tüketmez.
- **Alternatif:** İstemcinin satır eklemesi (D9'daki ilk tasarım) — tutarsızlığa açık.

## D21 — Çıkışta yerel veri temizlenir
- **Karar:** Çıkış yaparken önce bekleyen değişiklikler gönderilir, sonra cihazdaki damgalar silinir. Başka bir hesaba ait artık veri bulunursa senkrondan önce temizlenir.
- **Neden:** Paylaşılan cihazda bir hesabın damgaları sonraki hesaba karışmamalı.
- **Alternatif:** Veriyi misafir verisi olarak tutmak — hesaplar arası sızıntı riski.

## D22 — Plus için `refresh-entitlements`
- **Karar:** Satın alma ve geri yükleme sonrasında istemci, `refresh-entitlements` Edge Function'ını çağırır; fonksiyon RevenueCat REST API'sinden abonelik durumunu okuyup `entitlements` tablosunu günceller. Asıl kaynak yine webhook'tur.
- **Neden:** Webhook gecikse ya da kaçsa bile kullanıcı ödediği hakkı hemen alır; "geri yükle" webhook üretmeyebilir.
- **Alternatif:** Yalnızca webhook'a güvenmek.

## D23 — Bottom sheet'ler native form sheet
- **Karar:** Şehir detayı ve paywall, Expo Router rotaları olarak native `formSheet` sunumuyla açılır (köşe 28, tutamak, %64 ve tam boy). Ek bir bottom-sheet kütüphanesi kullanılmadı.
- **Neden:** Platformun kendi jestleri ve erişilebilirliği; daha az bağımlılık.
- **Alternatif:** `@gorhom/bottom-sheet`.

## D24 — Şehir sayısı ve hariç tutulanlar
- **Karar:** GeoNames'te `PPLX` (şehir bölümü/ilçe), `PPLH`, `PPLQ`, `PPLW` türleri şehir sayılmaz. Hiç şehri seçilmeyen ama aday listesinde yeri olan ülkeler için en büyük yerleşim eklenir.
- **Neden:** Büyük şehirlerin ilçeleri ayrı "şehir" olarak paydayı şişirmesin; her ülkede en az bir damgalanabilir şehir olsun.
- **Alternatif:** Tüm `P` sınıfı ≥100k yerleşimler (≈ 400 fazladan kayıt).

## D25 — Gezilen şehirler bölge (il/eyalet) sınırıyla boyanır
- **Karar:** Bir şehir damgalanınca o şehrin birinci düzey idari bölgesi (Türkiye'de il) vurgu rengiyle boyanır; ülkenin tamamı yalnızca bir ton açılır. Sınırlar Natural Earth 10m admin-1 verisinden gelir; yalnızca içinde şehrimiz olan 1.957 bölge pakete girer (`regions.geo.json`, ~0,9 MB). Şehir → bölge eşlemesi veri hattında, sadeleştirilmemiş geometri üzerinde nokta-poligon testiyle yapılır.
- **Neden:** Kullanıcı isteği: boyama ülke değil şehir bazında olsun. Türkiye'de 81 şehir 81 ile bire bir denk gelir.
- **Alternatif:** Yalnızca pin rengi (alan hissi yok) ya da ülkenin tamamını boyamak (tek şehirle bütün ülke "gezilmiş" görünür).
- **Not:** Türkiye dışında bir bölgede birden çok şehir olabilir; herhangi biri gezilince bölge boyanır. 8 şehir hiçbir bölgeyle eşleşmedi, onlarda yalnızca pin renklenir.
