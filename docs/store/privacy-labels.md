# Gizlilik etiketleri (taslak)

App Store "App Privacy" ve Google Play "Data Safety" formları için, kodun **gerçekte** yaptığına göre hazırlanmış taslak. Yeni bir SDK (analitik, çökme raporu, reklam) eklenirse güncellenmeli.

## Toplanan veriler

| Veri | Nerede | Amaç | Kimliğe bağlı mı | Takip için mi |
|---|---|---|---|---|
| E-posta adresi | Supabase Auth (Apple/Google/magic link) | Hesap, uygulama işlevi | Evet | Hayır |
| Ad (Apple/Google paylaşırsa) | `profiles.display_name` | Uygulama işlevi | Evet | Hayır |
| Kullanıcı kimliği | Supabase `user_id`; RevenueCat `app_user_id` | Uygulama işlevi, satın alma | Evet | Hayır |
| Fotoğraflar | Supabase Storage, özel bucket | Uygulama işlevi | Evet | Hayır |
| Diğer kullanıcı içeriği: gezilen şehirler ve tarihleri | `visits` | Uygulama işlevi; anonim toplu istatistik | Evet | Hayır |
| Satın alma geçmişi | RevenueCat, `entitlements` | Uygulama işlevi | Evet | Hayır |

**Toplanmayanlar:** konum (GPS kullanılmıyor; şehirler elle seçiliyor), rehber, tarama geçmişi, reklam kimliği, sağlık/finans verisi, analitik/tanılama verisi (uygulamada analitik veya çökme SDK'sı yok).

## App Store — App Privacy yanıtları

- **Data Used to Track You:** Yok.
- **Data Linked to You:** Contact Info (Email Address, Name) · User Content (Photos or Videos, Other User Content) · Identifiers (User ID) · Purchases (Purchase History). Hepsi için amaç: *App Functionality*.
- **Data Not Linked to You:** Yok.
- Misafir kullanımda hiçbir veri cihazdan çıkmaz.

## Google Play — Data Safety yanıtları

- Veri toplanıyor mu: **Evet**. Üçüncü taraflarla paylaşılıyor mu: **Hayır** (Supabase ve RevenueCat hizmet sağlayıcıdır).
- Aktarımda şifreleme: **Evet** (HTTPS).
- Silme talebi: **Evet** — uygulama içinden (Profil → Hesabı sil). Play ayrıca web üzerinden silme talebi URL'si ister: `TODO-MANUAL.md`.
- Türler: Personal info (Email address, Name, User IDs) · Photos and videos (Photos) · App activity (Other user-generated content) · Financial info (Purchase history). Amaç: App functionality, Account management. Hepsi "zorunlu değil" (misafir kullanım mümkün).

## Topluluk istatistiği

"Kullanıcıların %X'i gezdi" değeri yalnızca toplu ve anonimdir: 15 dakikada bir hesaplanır, bir şehir için en az 20 kullanıcı yoksa hiç gösterilmez, kesin sayılar API'den dönmez. Gizlilik politikasında bu kullanım açıkça yazılmalı.

## Hesap silme

Profil → Hesabı sil: `delete-account` Edge Function'ı fotoğraf dosyalarını, ardından kullanıcıyı siler; ziyaretler, fotoğraf kayıtları, entitlement'lar ve profil veritabanında `ON DELETE CASCADE` ile silinir. RevenueCat müşteri kaydı da silinir (gizli API anahtarı tanımlıysa).

## Gizlilik politikasında bulunması gerekenler

Toplanan veriler ve amaçları (yukarıdaki tablo) · hizmet sağlayıcılar (Supabase, RevenueCat, Apple, Google) · saklama süresi ve silme yöntemi · toplu istatistik açıklaması · iletişim adresi · KVKK/GDPR hakları.
