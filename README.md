<!--
BELGE KAPSAMI

AMAÇ:
Projeyi hızlıca tanıtmak ve bir kullanıcının/geliştiricinin projeyi kurup
çalıştırabilmesi için gereken temel bilgileri vermek.

DAHİL:
- Projenin amacı ve kısa özeti
- Temel özellikler
- Gereksinimler
- Kurulum
- Temel kullanım
- Geliştirme ve test komutları
- Diğer proje belgelerine kısa yönlendirmeler

DAHİL DEĞİL:
- Ayrıntılı sistem ve yazılım mimarisi → ARCHITECTURE.md
- Uzun vadeli gelecek hedefleri → ROADMAP.md
- Aktif işin fazları ve teknik uygulama adımları → PLAN.md
- Sürüm geçmişi ve önemli değişiklikler → CHANGELOG.md
- Lisans metni → LICENSE

KURAL:
README hızlı okunabilir kalmalıdır. Ayrıntılı teknik bilgiyi burada tekrar
etmek yerine ilgili kanonik belgeye bağlantı verin.
-->

# Word Match

Word Match, Türkçe konuşan kullanıcıların İngilizce kelime haznesini çalışması
için geliştirilmiş bir web uygulamasıdır. Kullanıcılar kelimeleri seviye ve
kategoriye göre çalışır; oturumlar, cevaplar ve ilerleme kalıcı olarak saklanır.

Mevcut ürün kategori temelli Practice akışına odaklanır. Planlanan Learn ve
Review akışları ile dört boyutlu mastery modeli için [Mimari](ARCHITECTURE.md)
ve [Uygulama Planı](PLAN.md) belgelerine bakın.

## Özellikler

- ASP.NET Core Identity ile kayıt, giriş, kalıcı oturum ve XSRF koruması
- Seviye/kategori bazlı İngilizce ↔ Türkçe ve mixed kelime çalışması
- Çoktan seçmeli ve yazılı soru biçimleri; doğru, tekrar ve yanlış sonuçları
- Devam eden oturumu sürdürme, tamamlanmış içeriği replay etme ve kategori
  ilerlemesini sıfırlama
- Salt okunur kelime kataloğu, filtreler ve isteğe bağlı feedback sesleri

## Gereksinimler

- .NET SDK 10
- Node.js ve npm
- Erişilebilir bir PostgreSQL veritabanı
- Production Compose kurulumu için Docker ve Docker Compose

## Kurulum

Önce API için PostgreSQL bağlantı dizisini güvenli local user secrets deposuna
tanımlayın; gerçek bağlantı bilgilerini repository'ye yazmayın.

```bash
dotnet user-secrets set "ConnectionStrings:DefaultConnection" "<PostgreSQL bağlantı dizisi>" --project WordMatch.API
dotnet ef database update --project WordMatch.API --startup-project WordMatch.API
npm ci --prefix WordMatch.Web
```

Ardından kelime verisini yükleyin. `Data/WordMatch.csv` kelime kaynağını içerir,
ancak güncel kaynak kodda bu dosyayı otomatik yükleyen bir bootstrap komutu
yoktur. Bu adım atlanırsa kategori listesi boş gelir ve Practice başlatılamaz.
Komutu repository kökünden, boş bir `Words` tablosuna karşı bir kez çalıştırın:

```bash
psql "<PostgreSQL bağlantı dizisi>" -c "\copy \"Words\" (\"English\",\"TurkishTranslations\",\"PartOfSpeech\",\"PastSimple\",\"PastParticiple\",\"IsIrregular\",\"Level\",\"Topic\") FROM 'Data/WordMatch.csv' WITH (FORMAT csv, HEADER true)"
```

> Not: Bu komut idempotent değildir. `Words` tablosu doluyken yeniden
> çalıştırılırsa `IX_Words_English_PartOfSpeech` unique index'i nedeniyle hata
> verir. Planlanan idempotent bootstrap akışı
> [Mimari](ARCHITECTURE.md#95-migration-ve-hedef-bootstrap-modeli) ve
> [Uygulama Planı](PLAN.md) içinde tanımlıdır.

## Kullanım

API ve istemciyi iki ayrı terminalde başlatın:

```bash
dotnet watch --project WordMatch.API
```

```bash
npm run dev --prefix WordMatch.Web
```

Tarayıcıda `http://localhost:5174` adresini açın, hesap oluşturun ve bir
kategori seçerek çalışmaya başlayın. API'nin local health endpoint'i
`http://localhost:5164/health` adresindedir.

## Geliştirme

API testlerini çalıştırın:

```bash
dotnet test WordMatch.API.slnx
```

Web doğrulamalarını çalıştırın:

```bash
npm run check --prefix WordMatch.Web
```

Değişikliklerden önce whitespace ve patch hatalarını denetleyin:

```bash
git diff --check
```

## Proje Dosyaları

- [Mimari](ARCHITECTURE.md)
- [Yol Haritası](ROADMAP.md)
- [Uygulama Planı](PLAN.md)
- [Değişiklik Kaydı](CHANGELOG.md)
- [Lisans](LICENSE)
