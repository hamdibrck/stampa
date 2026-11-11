# Stampa — Claude Code Görev Prompt'u

Sen bu projede kıdemli bir mobil + backend mühendisisin. Görevin **Stampa** adlı gezi takip uygulamasının MVP'sini sıfırdan, App Store ve Play Store'a çıkabilecek kalitede inşa etmek.

**Çalışma şekli (önemli):**
1. **Önce planla.** Kod yazmadan önce aşağıdaki "Faz 0 — Planlama" adımını tamamla ve `docs/PLAN.md` dosyasını oluştur.
2. **Sonra onay beklemeden başla.** Plan bittiğinde durma, bana soru sorma; planı uygulamaya geç ve milestone'ları sırayla bitir.
3. Belirsiz bir noktada en makul varsayımı yap, `docs/DECISIONS.md` dosyasına "Karar / Neden / Alternatif" formatında yaz ve devam et.
4. Sadece geri alınamaz veya para/hesap gerektiren adımlarda dur (App Store Connect, Play Console, RevenueCat, Supabase/Mapbox hesap anahtarları). Bunları `docs/TODO-MANUAL.md` dosyasına benim yapmam gereken adımlar olarak yaz, kodda `.env` placeholder'larıyla ilerle.
5. Her milestone sonunda: lint + typecheck + testler geçsin, anlamlı bir git commit at, `docs/PLAN.md` içindeki ilgili kutucukları işaretle.

---

## 1. Ürün özeti

Kullanıcı dünya haritası üzerinde şehirleri seçer, kısa bir özet görür ve "Şehri gezdim" diyerek şehri damgalar. Uygulama dünyanın yüzde kaçını, her ülkenin kaç şehrini gezdiğini gösterir. Her şehre fotoğraf eklenebilir: 2 tanesi ücretsiz, fazlası uygulama içi satın alma ile. Diğer kullanıcıların verisinden toplu istatistik gösterilir ("İstanbul'u kullanıcıların %25'i gezdi").

İsim: **Stampa** (pasaport damgası metaforu). Uygulama dili: Türkçe + İngilizce (i18n baştan kurulacak, varsayılan cihaz dili).

---

## 2. MVP kapsamı

### Dahil (v1)
| # | Özellik | Detay |
|---|---|---|
| F1 | Kimlik doğrulama | Apple ile giriş, Google ile giriş, e-posta magic link. Misafir modu: yerelde işaretleme yapabilsin, giriş yapınca veriler hesaba taşınsın. |
| F2 | Dünya haritası | Tam ekran, pinch-zoom, pan. Gezilen ülkeler dolgu rengiyle boyalı. Şehir pinleri zoom seviyesine göre cluster'lı. Gezilen pin vurgu renginde, gezilmeyen gri. |
| F3 | Şehir seçimi | Pin'e dokununca alt sheet açılır: şehir adı, ülke/bölge, 1–2 cümlelik özet, topluluk yüzdesi, fotoğraflar, "Şehri gezdim" butonu (tekrar basınca geri al). |
| F4 | Arama | Şehir ve ülke arama (Türkçe karakter ve aksan duyarsız: "istanbul" = "İstanbul", "sao paulo" = "São Paulo"). Sonuca dokununca harita oraya gider ve sheet açılır. |
| F5 | Dünya sayacı | Ana ekranın üstünde: `%X,X` dünyanın gezilen kısmı + toplam şehir ve ülke sayısı + ilerleme çubuğu. |
| F6 | Ülke sayacı | Her ülke için `gezilen/toplam` (ör. Türkiye 10/81). Ülke detay ekranı: halka grafik, yüzde, kullanıcı ortalaması, filtrelenebilir şehir listesi (Tümü / Gezdiklerim / Gezmediklerim). |
| F7 | Gezilenler listesi | Ülkelere göre gruplanmış liste, ziyaret tarihine göre sıralama. |
| F8 | Fotoğraflar | Şehir başına 2 ücretsiz fotoğraf. Yükleme öncesi istemcide sıkıştırma (uzun kenar maks. 2048px, JPEG/WebP ~0.8). 3. fotoğrafta paywall açılır. Limit **sunucuda** zorlanır, istemciye güvenilmez. |
| F9 | Uygulama içi satın alma | (a) **Şehir paketi**: o şehre +10 fotoğraf, tüketilmeyen tek seferlik. (b) **Stampa Plus**: tüm şehirlerde sınırsız fotoğraf, yıllık abonelik. Satın alımları geri yükle. Fiyatlar kodda yok; RevenueCat offering'lerinden gelir. |
| F10 | Topluluk istatistiği | Her şehir için "kullanıcıların %X'i gezdi". Sadece toplu ve anonim veri. k-anonimlik: bir şehri gezen kullanıcı sayısı 20'nin altındaysa yüzde yerine "Yeni keşif" göster. |
| F11 | Profil ve ayarlar | Dil, hesap silme (App Store zorunluluğu; tüm veri ve fotoğraflar silinir), çıkış, gizlilik politikası ve kullanım koşulları linkleri. |

### Kapsam dışı (v1'de yapılmayacak, ama mimari buna hazır olacak)
- v2: şehir puanlama (1–5), yorumlar + raporlama/moderasyon, paylaşılabilir gezi kartı görseli
- v3: arkadaş takibi, liderlik tablosu, rozetler, istek listesi / gezi planlama

Veri modelinde `ratings` ve `comments` tablolarını şimdi oluşturma, ama şehir kimliklerini ve RLS desenini bunların eklenmesi kolay olacak şekilde kur.

---

## 3. "Şehir" tanımı ve yüzde hesabı (kritik)

Yüzdelerin paydasını belirlediği için bu konu baştan sabitlenmeli:

- **Kaynak:** GeoNames `cities15000` (nüfusu 15.000'den fazla olan yerleşimler). Lisansı CC-BY, attribution'ı uygulamanın "Hakkında" bölümüne ekle.
- **Ülke bazlı kural:** Varsayılan olarak her ülke için nüfusu ≥ 100.000 olan şehirler + başkent. Türkiye için istisna: **81 il merkezi** (GeoNames'te `admin1` başkentleri, `PPLA`). Kural `scripts/cities/rules.ts` içinde ülke koduna göre override edilebilir olsun; ileride başka ülkeler için de il/eyalet modeli eklenebilsin.
- **Dünya yüzdesi:** `gezilen şehir sayısı / toplam şehir sayısı`. Alternatif metrikleri (ülke sayısı bazlı, alan bazlı) `DECISIONS.md` dosyasına not et, ama v1'de şehir sayısı bazlı kullan.
- **Kısa özet:** Her şehir için Wikidata'dan `description` (tr + en) ve Wikipedia REST `page/summary` özetinden ilk 1–2 cümle. Seed sırasında bir kez çekilip veritabanına yazılır, runtime'da Wikipedia'ya istek atılmaz. Özeti olmayan şehirler için "Ülke · Bölge · Nüfus" formatında yedek metin kullan.
- Seed script'i tekrar çalıştırılabilir (idempotent) olsun ve `geonames_id`'yi kalıcı anahtar olarak kullansın.

---

## 4. Teknik yığın (varsayılan; daha iyisini gerekçesiyle seçebilirsin)

| Katman | Seçim | Not |
|---|---|---|
| Mobil | **Expo (React Native) + TypeScript**, Expo Router | EAS Build ile iOS ve Android |
| Harita | **@maplibre/maplibre-react-native** | Stil: koyu tema vektör stil (MapTiler veya Protomaps, key `.env`'den). Ülke dolguları için Natural Earth 50m GeoJSON'dan üretilmiş yerel kaynak. |
| State / veri | TanStack Query + Zustand | Offline-first: ziyaretler önce yerelde (MMKV veya SQLite), sonra senkronize |
| Backend | **Supabase** (Postgres + Auth + Storage + Edge Functions) | RLS her tabloda zorunlu |
| IAP | **RevenueCat** (`react-native-purchases`) | Entitlement `plus`, ürünler `city_pack_10`, `plus_yearly`. Webhook → Edge Function → `entitlements` tablosu |
| Fotoğraf | Supabase Storage, private bucket, signed URL | `expo-image-manipulator` ile sıkıştırma, `expo-image` ile cache |
| i18n | i18next + expo-localization | tr, en |
| Test | Jest + React Native Testing Library; DB için pgTAP veya SQL testleri | Kritik iş kuralları (fotoğraf limiti, yüzde hesabı, k-anonimlik) mutlaka test edilmeli |
| Kalite | ESLint, Prettier, `tsc --noEmit`, GitHub Actions CI | |

Monorepo: `apps/mobile`, `supabase/` (migrations, functions, seed), `scripts/cities/` (veri hattı), `docs/`.

---

## 5. Veri modeli (başlangıç taslağı; planlamada netleştir)

```
countries      (iso2 PK, iso3, name_tr, name_en, city_count, geom_ref)
cities         (id PK, geonames_id UNIQUE, country_iso2 FK, name_tr, name_en, name_ascii,
                admin1, lat, lon, population, is_capital, summary_tr, summary_en)
profiles       (user_id PK → auth.users, display_name, locale, created_at)
visits         (user_id, city_id, visited_at, created_at, PK(user_id, city_id))
photos         (id, user_id, city_id, storage_path, width, height, created_at)
entitlements   (user_id, kind ['plus'|'city_pack'], city_id NULL, extra_slots, expires_at, source_event_id)
city_stats     (city_id PK, visitor_count, visitor_share, updated_at)  -- materialized/agg tablo
country_stats  (country_iso2 PK, avg_visited_cities, updated_at)
```

Kurallar:
- `photo_quota(user, city) = 2 + Σ city_pack.extra_slots` ya da `plus` aktifse sınırsız. Kota kontrolü bir Postgres fonksiyonunda ve Storage upload policy'sinde yapılsın. İstemci yalnızca bilgi amaçlı göstersin.
- `city_stats`, `pg_cron` ile 15 dakikada bir yenilensin; her istekte ham `visits` üzerinden sayım yapılmasın. Payda = son 90 günde aktif kullanıcı sayısı (`DECISIONS.md` dosyasına not et).
- Hesap silme: Edge Function ile `visits`, `photos`, Storage objeleri ve `auth.users` kaydı silinsin.
- `cities` ve `countries` tabloları herkese okunabilir; kullanıcı tabloları yalnızca sahibine açık. `city_stats` herkese okunabilir ama k-anonimlik eşiği view içinde uygulanır.

---

## 6. Tasarım sistemi (onaylı mockup'lardan)

Koyu tema, tek vurgu rengi. Token'ları `apps/mobile/src/theme/tokens.ts` dosyasına koy:

| Token | Değer |
|---|---|
| bg | `#0E1726` |
| surface | `#172235` |
| surface-2 / track | `#24324A` |
| border | `#2C3B57` |
| map-ocean | `#121C2D` |
| map-land | `#22304A` |
| map-land-visited | `#3B5079` |
| text | `#EEF2F7` |
| text-muted | `#9AA8BD` |
| text-soft | `#C3CEDD` |
| pin-unvisited | `#8FA0BA` |
| **accent** | `#FF6B4A` (alternatifler: `#3DD6B5`, `#F5C542`, `#7AA2FF`) |
| tab-bar | `#0B1320` |

- Font: başlıklar ve rakamlar için **Space Grotesk** (500/700), gövde için **Inter** (400/500/600). `expo-font` ile yükle.
- Köşe yuvarlaklığı: kart 14–16, sheet 28, buton 16. Dokunma alanı en az 44pt.
- Sayılar Türkçe formatta: `%2,4`, `10/81`.
- "Gezildi" durumu için hafif döndürülmüş (-8°), çerçeveli bir damga rozeti göster. "Şehri gezdim" butonuna basıldığında damga animasyonu oynasın (Reanimated, ölçek + hafif haptic).

**Ekranlar (mockup'larla birebir):**
1. **Ana ekran:** Üstte logo + profil butonu → dünya yüzdesi (büyük rakam) + "34 şehir · 9 ülke" + ilerleme çubuğu → arama çubuğu → **dünya haritası** (ekranın ana alanı, gezilen ülkeler boyalı, şehir pinleri, +/− zoom, altta seçili şehrin mini kartı ve "Detay" butonu) → "Ülkelerin" listesi (bayrak/kod, isim, `x/y`, ince ilerleme çubuğu) → alt tab bar: Harita / Listem / Keşfet (v1'de placeholder) / Profil.
2. **Şehir detayı (bottom sheet):** Üstte şehre zoom yapılmış harita, altta sheet: isim, ülke · bölge, "GEZİLDİ" damgası, kısa özet, topluluk yüzdesi kartı, fotoğraf grid'i (`0/2 ücretsiz`, 2 boş slot + kilitli "Daha fazla"), en altta tam genişlikte "Şehri gezdim" butonu.
3. **Ülke detayı:** Geri butonu + ülke adı → halka grafik (`10 / 81 şehir`) + "%12,3" + "Kullanıcı ortalaması 7 şehir" → filtre chip'leri → şehir listesi (plaka/kod, isim, "%X gezdi", tik veya boş halka).
4. **Paywall (sheet):** Mevcut 2 fotoğraf + kesikli "+" slot → "İstanbul için 2 ücretsiz fotoğrafı kullandın" → iki seçenek kartı (Şehir paketi / Stampa Plus "Önerilen" etiketiyle) → "Devam et" → "Satın alımları geri yükle · Koşullar".

Erişilebilirlik: tüm ikon butonlarında `accessibilityLabel`, metin kontrastı en az 4.5:1, Dynamic Type'ta layout bozulmasın.

---

## 7. Performans hedefleri
- Harita, ~5–8 bin şehir pinini 60 fps'e yakın göstermeli: MapLibre native cluster + `ShapeSource` kullan, React component olarak pin render etme.
- Şehir veri seti uygulamaya gömülü, sıkıştırılmış ve versiyonlu bir JSON/SQLite olarak gelsin (ilk açılışta ağ gerektirmesin). Özetler ise lazy olarak Supabase'den çekilsin.
- Soğuk açılışta ana ekran 2 saniyenin altında görünsün (orta seviye Android).

---

## 8. Milestone'lar (PLAN.md'de detaylandır)

- **M0 — Planlama:** `docs/PLAN.md`, `docs/DECISIONS.md`, `docs/TODO-MANUAL.md`, mimari diyagramı (Mermaid), veri modeli, ekran akışı.
- **M1 — İskelet:** monorepo, Expo uygulaması, tema token'ları, fontlar, i18n, navigasyon, CI (lint, typecheck, test).
- **M2 — Şehir veri hattı:** GeoNames + Wikidata/Wikipedia seed script'leri, ülke kuralları (TR = 81 il), Natural Earth ülke geometrisi, uygulamaya gömülü veri paketi, Supabase migration'ları ve seed.
- **M3 — Harita ve seçim:** MapLibre haritası, ülke dolguları, cluster'lı pinler, arama, şehir sheet'i (veriler henüz yerel).
- **M4 — Ziyaretler ve sayaçlar:** yerel kayıt, dünya ve ülke sayaçları, ülke detay ekranı, gezilenler listesi, damga animasyonu.
- **M5 — Auth ve senkronizasyon:** Supabase Auth (Apple, Google, magic link), misafir verisini hesaba taşıma, offline kuyruk, RLS testleri.
- **M6 — Fotoğraflar:** sıkıştırma, yükleme, signed URL, sunucu tarafı kota fonksiyonu ve testleri.
- **M7 — IAP:** RevenueCat entegrasyonu, paywall ekranı, webhook Edge Function, entitlement'ların kotaya yansıması, satın alımları geri yükleme.
- **M8 — Topluluk istatistikleri:** `city_stats` / `country_stats`, pg_cron, k-anonimlik, UI'a bağlama.
- **M9 — Cila ve yayın hazırlığı:** hesap silme, boş/hata/yükleniyor durumları, erişilebilirlik turu, uygulama ikonu ve splash, EAS build profilleri, store metinleri taslağı (tr/en), gizlilik etiketleri (App Privacy / Data Safety) taslağı.

Her milestone için `PLAN.md` içinde şunlar olsun: amaç, görev listesi (checkbox), kabul kriterleri, riskler.

---

## 9. Kabul kriterleri (MVP tamam sayılması için)
- [ ] Haritada herhangi bir şehre dokunup "Şehri gezdim" denebiliyor; dünya ve ülke sayaçları anında güncelleniyor.
- [ ] Türkiye sayacı 81 il üzerinden doğru hesaplanıyor (test ile doğrulanmış).
- [ ] Uçak modunda işaretleme yapılabiliyor; bağlantı gelince veriler senkronize oluyor.
- [ ] 3. fotoğraf denemesi paywall açıyor; sunucu, istemci atlatılsa bile 3. yüklemeyi reddediyor (test ile doğrulanmış).
- [ ] Sandbox ortamında Şehir paketi ve Plus satın alınabiliyor, geri yüklenebiliyor ve kotaya yansıyor.
- [ ] Topluluk yüzdesi gerçek veriden geliyor ve k-anonimlik eşiğine uyuyor.
- [ ] Hesap silme tüm kullanıcı verisini ve fotoğrafları kaldırıyor.
- [ ] `pnpm lint && pnpm typecheck && pnpm test` temiz; CI yeşil.
- [ ] iOS ve Android için EAS development build alınabiliyor.

---

## 10. Başla
Şimdi Faz 0 / M0 ile başla: repoyu incele (boşsa sıfırdan kur), `docs/PLAN.md` dosyasını yaz, ardından onay beklemeden M1'e geç ve milestone'ları sırayla tamamla. Her milestone sonunda kısa bir özet ver: ne yapıldı, hangi kararlar alındı, `TODO-MANUAL.md` dosyasına ne eklendi.
