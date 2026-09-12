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
- Sürüm geçmişi ve önemli değişiklikler → CHANGELOG.md
- Lisans metni → LICENSE

KURAL:
README hızlı okunabilir kalmalıdır. Ayrıntılı teknik bilgiyi burada tekrar
etmek yerine ilgili kanonik belgeye bağlantı verin.
-->

# Word Match

Word Match, Türkçe konuşan kullanıcıların İngilizce kelime haznesini düzenli
çalışmayla geliştirmesi için hazırlanmış bir web uygulamasıdır. Oturumlar,
cevaplar ve ilerleme kalıcı olarak saklanır.

Uygulamanın tek öğrenme akışı Study'dir ve başlangıçta çalışma türü, beceri
veya yol seçimi yoktur. Sistem curriculum sırasındaki güncel konuyu açar;
kullanıcı isterse konuyu değiştirir. Curriculum `Level → sıralı Topic → açık
öğrenme grubu → sıralı kelime` şeklindedir ve sıra `Words.csv`'den gelen açık
veridir. Ayrıntılar için
[Mimari](ARCHITECTURE.md) belgesine bakın.

## Özellikler

- ASP.NET Core Identity ile kayıt, giriş, kalıcı oturum ve XSRF koruması
- `/` altında tek bir başlangıç yüzeyi: sunucunun belirlediği tek `Devam et`
  eylemi, konu ilerlemesi ve `Konu değiştir`
- `Level → sıralı Topic → açık öğrenme grubu → sıralı kelime` curriculum omurgası
- Konu oturumu bir grubu bütünüyle çalışır: önce anlamını seçme, ardından aynı
  kelimeleri karıştırılmış sırayla yazarak hatırlama; yalnız pekiştirme
  oturumları en fazla 10 sorudur
- Soru türlerini sistem dengeler; kullanıcı uygun olmayan yazma sorularını
  10 dakika erteleyebilir. Açık oturum sonuçlanır, sonraki çalışma uygun
  konudan başlar ve süre dolduğunda eski konu yalnız yeni oturum sınırında
  yeniden seçilir; bu bir cevap değildir ve mastery'yi etkilemez
- Elle seçilen konudaki kelime iki yazılı yönü de yanıtlandığında tamamlanır ve
  sıra o konuya geldiğinde yeniden yeni kelime olarak görünmez
- Çoktan seçmeli ve yazılı soru biçimleri; doğru, bilmiyorum ve yanlış sonuçları
- Sabit soru kartı, ses tercihi, klavye kısayolları ve cevaplanan sonuçları
  oturum içinde inceleme
- Devam eden Study oturumunu sürdürme ve ayrıntılı sonuç listeleri
- Salt okunur kelime kataloğu ve filtreler

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

Ardından içerik verisini yükleyin. `WordMatch.API/Content/Words.csv`
içindeki `ImportKey`, veritabanının ürettiği `Id` değerinden ayrı ve sabit
kaynak kimliğidir. Bu sayede aynı kaynak tekrar yüklendiğinde ilişkisel
kimlikler ve kullanıcı ilerlemesi korunur. Komut normal API başlangıcından
ayrıdır:

```bash
dotnet run --project WordMatch.API -- bootstrap words
```

Komut idempotenttir. Her satır bir kelimeyi, konu yerleşimini ve öğrenme grubu
yerleşimini birlikte
taşır; 700 kelimeyi 66 sıralı konuya bağlar (A1'de 27, A2'de 20, B1'de 14,
B2'de 5), kaynak anahtarlarının eksiksiz ve benzersiz, konu sırasının her
level içinde; öğrenme grubu sırasının konu içinde kesintisiz olmasını zorunlu
tutar. Kelime içeriği ve konu
üyeliği/sırası her zaman serbestçe düzeltilebilir — kullanıcı ilerlemesi
kelime bazlı tutulduğu için bu düzeltmeler mevcut ilerlemeyi etkilemez.
Kaynaktan kaldırılan konular silinmez, `Retired` işaretlenir ve planlamada
görünmez.

## Kullanım

API ve istemciyi iki ayrı terminalde başlatın:

```bash
dotnet watch --project WordMatch.API
```

```bash
npm run dev --prefix WordMatch.Web
```

Tarayıcıda `http://localhost:5174` adresini açın, hesap oluşturun ve
`Başla` ile doğrudan ilk soruya geçin. Ana ekran sıradaki konuyu
(ör. `A1 · Duygular ve Kişilik`) ve o konudaki ilerlemeyi gösterir;
`Konu değiştir` ile başka bir level/topic seçebilirsiniz. API'nin local health
endpoint'i `http://localhost:5164/health` adresindedir.

## Doğrulama

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
- [Değişiklik Kaydı](CHANGELOG.md)
- [Lisans](LICENSE)
