<!--
BELGE KAPSAMI

AMAÇ:
Projenin mevcut teknik gerçeğini tek bir kanonik kaynakta belgelemek.
README.md ile birlikte okunduğunda, kaynak kodun tamamını baştan sona okumadan
sistemin nasıl çalıştığı ve neden böyle tasarlandığı anlaşılabilmelidir.

DAHİL:
- Domain ve temel kavramlar
- Sistem bağlamı ve sınırları
- Repository yapısı ve önemli giriş noktaları
- Mimari yaklaşım, katmanlar ve ilkeler
- Sistem bileşenleri ve modüller
- İç/dış bağımlılıklar ve bağımlılık yönleri
- Veri modeli, veri sahipliği ve veri yaşam döngüsü
- Kritik veri ve çalışma akışları
- Runtime davranışı
- API, CLI, event ve diğer teknik arayüzler
- Yapılandırma ve ortam modeli
- Teknik güvenlik mimarisi
- Hata yönetimi ve recovery
- Logging, metrics, tracing ve health checks
- Cache, performans ve ölçeklenebilirlik
- Build ve deployment mimarisi
- Test stratejisi
- Kod/tasarım kuralları ve invariant'lar
- Mimari kararlar ve gerekçeleri
- Teknik kısıtlamalar ve mimariyi etkileyen teknik borç
- Kritik senaryolar, operasyon ve sorun giderme
- Projeyi anlamak/değiştirmek için gerekli kalıcı teknik bağlam

DAHİL DEĞİL:
- Kullanıcıya dönük hızlı kurulum/kullanım anlatımı → README.md
- Gelecekte yapılması planlanan yüksek seviyeli işler → ROADMAP.md
- Aktif özelliğin geçici uygulama adımları → PLAN.md
- Sürüm bazlı değişiklik geçmişi → CHANGELOG.md
- Lisans hükümleri → LICENSE

KURAL:
Bu belge kaynak kodun satır satır açıklaması veya TODO listesi değildir.
Koddan kolayca görülebilen ayrıntılar yerine ilişkileri, sınırları, kuralları,
nedenleri ve kolayca kaybolabilecek teknik bağlamı belgeleyin. Mevcut sistem
gerçeği ile gelecek planlarını birbirine karıştırmayın.
-->

# Word Match Mimarisi

Bu belge çalışan sistemi, hedef öğrenme mimarisini ve aralarındaki sınırları tek
kanonik kaynakta açıklar. Hedefteki bir özellik kaynak kodda uygulanmadıkça
**planlanmış** olarak etiketlenir; mevcut davranış olarak yorumlanmamalıdır.

## İlgili Belgeler

- [README.md](README.md) — hızlı başlangıç, kurulum ve günlük geliştirme
- [ROADMAP.md](ROADMAP.md) — çekirdek çalışmadan sonraki ürün yönü
- [PLAN.md](PLAN.md) — aktif öğrenme mimarisi çalışmasının fazları
- [CHANGELOG.md](CHANGELOG.md) — doğrulanmış sürüm değişiklikleri
- [LICENSE](LICENSE) — kullanım ve dağıtım lisansı

# 1. Genel Bakış

## 1.1 Projenin Amacı

Word Match, Türkçe konuşan kullanıcıların İngilizce kelime haznesini düzenli
çalışmayla geliştirmesi için hazırlanmış bir web uygulamasıdır. Kullanıcı
kaydından sonra kelimeleri seviye ve kategoriye göre çalışır; sistem cevapları
ve soru bağlamını kalıcı olarak saklar.

Çalışan ürünün odağı kategori temelli Practice'tir. Hedef ürün bunun üzerine
aynı kelime verisini kullanan üç ayrı akış kurar:

```text
Learn    Sistem yeni içeriği ve sıradaki çalışmayı seçer.
Review   Sistem tekrar zamanı gelen veya zayıf alanları seçer.
Practice Kullanıcı çalışmak istediği alanı seçer.
```

## 1.2 Temel Kullanım Senaryoları

Bugün kullanıcı:

- Hesap oluşturur, giriş yapar ve kalıcı cookie ile oturumunu sürdürür.
- Bir seviye ve kategori seçip `EnglishToTurkish`, `TurkishToEnglish` veya
  `Mixed` Practice oturumu başlatır.
- Çoktan seçmeli veya yazılı soruyu cevaplar ya da cevabı görmek için `Review`
  sonucunu seçer; yarım kalan oturuma devam edebilir veya tamamladığını replay
  olarak yeniden çalışabilir.
- Kelime kataloğunu ve son çalışma sonucunu salt okunur görüntüler; kategori
  ilerlemesini sıfırlar.

Planlanan Learn ve Review akışlarında sonraki kelimeyi veya tekrarı kullanıcı
değil sistem seçer.

## 1.3 Hedefler

- Kelime, soru ve kullanıcı ilerlemesi için kalıcı ve doğrulanabilir bir domain
  modeli sağlamak.
- Kullanıcıya gösterilen soru içeriğinin anlamını snapshot ile korumak.
- Türkçeyi İngilizce kelimenin anlamını açıklayan yardımcı dil olarak
  kullanmak; genel dil yeterliliği iddiasında bulunmamak.
- Hedef mimaride kelime bilgisini dört bağımsız biçimde izlemek ve Learn,
  Review, Practice seçim kurallarını ayırmak.

## 1.4 Hedef Olmayanlar

- Uygulamanın curriculum'unu tamamlamak, kullanıcının genel CEFR İngilizce
  seviyesini kanıtlamaz.
- `WrittenRecognition`, `AuralRecognition`, `WrittenRecall` ve
  `SpokenRecall` genel Reading, Listening, Writing ve Speaking yeterlilikleri
  değildir.
- İlk `SpokenRecall` kapsamı pronunciation puanı, phoneme analizi, aksan veya
  stress değerlendirmesi değildir.
- Learn path, mikrofon ya da speech desteği olmayan kullanıcıyı dört boyutun
  tamamını zorunlu tutarak bloke etmez.

## 1.5 Temel Kavramlar

| Kavram                       | Anlamı                                                                                   |
| ---------------------------- | ---------------------------------------------------------------------------------------- |
| `Word`                       | İngilizce kelime, Türkçe çevirileri ve kelime metadata'sı.                               |
| `Level`                      | Kelimenin vocabulary curriculum içindeki seviyesi; bugün kaynak kodda `A1`–`B2` vardır.  |
| `Topic`                      | Kelimenin anlamsal kategorisi; mevcut Practice seçimi için kullanılır.                   |
| `PracticeSession`            | Bir kullanıcının `Level` + `Topic` + `Mode` çalışması ve durumudur.                      |
| `PracticeSessionWord`        | Bir oturumdaki tek soru plan öğesi ve cevap snapshot'ı.                                  |
| `UserWordProgress`           | Mevcut modelde `UserId + WordId + Direction + Format` için sayaçlar ve son sonuç.        |
| `Review`                     | Mevcut Practice'te cevabı görme sonucu; hedef Review ürün akışıyla aynı kavram değildir. |
| `VocabularyMasteryDimension` | Planlanan modelde kelime bilgisinin dört bilinçli egzersiz biçimi.                       |
| Curriculum                   | Planlanan Learn path'in açık `Level → Unit → Word` sırası.                               |

# 2. Teknoloji Yığını

| Alan                 | Kullanılan teknoloji                                                 | Rolü                                           |
| -------------------- | -------------------------------------------------------------------- | ---------------------------------------------- |
| API                  | C#, ASP.NET Core Minimal API, .NET 10                                | HTTP uçları ve iş kuralları                    |
| Veri erişimi         | EF Core 10, Npgsql                                                   | PostgreSQL migration'ları ve sorguları         |
| Kimlik               | ASP.NET Core Identity                                                | Kullanıcı, parola politikası ve cookie oturumu |
| Veritabanı           | PostgreSQL                                                           | Uygulama, Identity, session ve progress verisi |
| Web                  | React 19, TypeScript, Vite                                           | Tarayıcı istemcisi                             |
| İstemci veri katmanı | TanStack Query, Zod                                                  | API çağrıları, cache ve response doğrulama     |
| Arayüz               | Tailwind CSS, shadcn/ui, Base UI                                     | Arayüz bileşenleri                             |
| API testleri         | xUnit, `Microsoft.AspNetCore.Mvc.Testing`, Testcontainers PostgreSQL | İzole entegrasyon ve migration testleri        |
| Web testleri         | Vitest, Testing Library, jsdom                                       | Bileşen ve istemci davranışı                   |
| Production           | Docker Compose, Nginx, Cloudflare Tunnel                             | Build, proxy ve dış HTTPS erişimi              |

Mevcut feedback sesleri tarayıcıda `public/sounds/` altındaki WAV dosyalarından
çalınır. Bunlar planlanan kelime seslendirmesi veya speech-to-text değildir.

# 3. Sistem Bağlamı

## 3.1 Büyük Resim

```text
Tarayıcıdaki kullanıcı
        │ HTTPS (production) / HTTP (local development)
        ▼
React + Vite veya Nginx ile sunulan istemci
        │ /api, cookie ve XSRF header
        ▼
ASP.NET Core Minimal API ─────────────► PostgreSQL
        │
        └─ production'da Nginx ve Cloudflare Tunnel arkasında
```

Production'da Cloudflare Tunnel yayınlanan Nginx origin'ine gider; Nginx
statik istemciyi sunar ve `/api/` isteklerini özel Docker ağı üzerinden API'ye
proxy eder. API'nin bugün zorunlu bir harici TTS veya STT bağımlılığı yoktur.

## 3.2 Aktörler

- **Kullanıcı:** Hesap oluşturur, kelime çalışır, ilerlemesini görür ve
  gerektiğinde bir kategoriye ait ilerlemeyi sıfırlar.
- **Tarayıcı istemcisi:** Oturum cookie'sini taşır, durum değiştiren
  isteklerde antiforgery token gönderir ve 409 yarış durumunda oturumu yeniden
  yükler.
- **Uygulama operatörü:** Connection string, deployment ortamı, migration ve
  Docker/Cloudflare yapılandırmasını açıkça yönetir.

Planlanan içerik yönetiminde ayrı bir **yönetici** aktörü olacaktır. Bu aktör
frontend'de gizlenen bir arayüzle değil, server-side `Admin` authorization
policy ile yetkilendirilir.

## 3.3 Harici Sistemler

| Sistem                  | Mevcut kullanım                                            | Arıza davranışı                                                        |
| ----------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| PostgreSQL              | Kalıcı veri deposu                                         | API connection string olmadan başlamaz; `/health` bağlantıyı denetler. |
| Cloudflare Tunnel       | Production HTTPS hostname'ini Nginx origin'ine yönlendirir | Tunnel/yönlendirme yoksa dış erişim olmaz.                             |
| Tarayıcı audio API'leri | Feedback WAV sesleri                                       | Oynatma hatası sessizce yutulur; öğrenme sonucu değişmez.              |
| TTS/STT sağlayıcısı     | Henüz yok                                                  | Tasarım kararı verilmeden uygulanmaz.                                  |

# 4. Repository Yapısı

```text
.
├── .github/workflows/ci.yml           # GitHub Actions doğrulama hattı
├── Data/WordMatch.csv                 # Version-controlled vocabulary kaynağı
├── WordMatch.API/                     # ASP.NET Core API
│   ├── Data/                          # DbContext, EF configuration ve migrations
│   └── Features/                      # Auth, Practice ve Words feature slice'ları
├── WordMatch.API.Tests/               # API/integration testleri
├── WordMatch.Web/                     # React istemcisi
│   ├── public/sounds/                 # Mevcut feedback sesleri
│   └── src/features/                  # auth, practice ve words feature'ları
├── docker-compose.yml                 # Production topology
└── .env.example                       # Secret içermeyen environment şablonu
```

## 4.1 Önemli Dizinler

| Dizin                                | Sorumluluk                                              |
| ------------------------------------ | ------------------------------------------------------- |
| `WordMatch.API/Features/Auth`        | Kayıt, giriş, çıkış, session ve antiforgery             |
| `WordMatch.API/Features/Practice`    | Kategori, soru üretimi, oturum ve progress              |
| `WordMatch.API/Features/Words`       | `Word` domain'i ve salt okunur katalog                  |
| `WordMatch.API/Data`                 | `ApplicationDbContext`, mapping ve EF migration zinciri |
| `WordMatch.Web/src/features`         | İstemci feature'ları ve feature'a yakın testler         |
| `WordMatch.API.Tests/Infrastructure` | PostgreSQL Testcontainer kullanan API factory           |

## 4.2 Önemli Dosyalar

| Dosya                        | Sorumluluk                                                               |
| ---------------------------- | ------------------------------------------------------------------------ |
| `WordMatch.API/Program.cs`   | DI, middleware, config kontrolleri, endpoint eşleme ve health endpoint'i |
| `ApplicationDbContext.cs`    | EF Core modelinin giriş noktası                                          |
| `PracticeSessionService.cs`  | Oturum oluşturma/devam, cevaplama ve yarış durumları                     |
| `PracticeQuestionFactory.cs` | Soru planı, snapshot ve dört seçenekli seçenek üretimi                   |
| `WordMatch.Web/src/main.tsx` | İstemci provider'ları, auth gate ve route'lar                            |
| `docker-compose.yml`         | API ve Nginx web container topolojisi                                    |

# 5. Mimari

## 5.1 Mimari Yaklaşım

API feature tabanlı bir modüler monolittir. Her feature endpoint, sözleşme,
service ve domain tiplerini kendi altında tutar; persistence için doğrudan
`ApplicationDbContext` kullanır. Ayrı repository veya Unit of Work katmanı
yoktur.

İstemci de `auth`, `practice` ve `words` feature'larına ayrılır. Ortak UI, API
istemcisi ve görüntü etiketleri `src/components` ile `src/lib` altında kalır.

## 5.2 Mimari İlkeler

- Feature'lar public HTTP sözleşmeleri üzerinden kullanılır; frontend response'u
  Zod ile doğrular.
- Oturum sorusu, kelime sonradan değişse bile geçmiş cevabın anlamını koruyan
  snapshot tutar.
- Enum değerleri PostgreSQL'de string saklanır ve check constraint'lerle
  korunur.
- Kullanıcının başka kullanıcının session, kategori ilerlemesi veya progress'ine
  erişmesi endpoint ve sorgu seviyesinde `UserId` ile engellenir.
- Migration production startup'ında varsayılan olarak çalışmaz.
- Planlanan bootstrap, database-generated ilişkisel kimlik yerine
  version-controlled değişmez content identity kullanır.

## 5.3 Katmanlar

| Katman           | İçerik                                             | Bağımlılıklar                                  |
| ---------------- | -------------------------------------------------- | ---------------------------------------------- |
| Web istemcisi    | React route'ları, UI, TanStack Query, API client   | HTTP API, tarayıcı API'leri                    |
| API feature'ları | Minimal endpoint, request/response record, service | Identity, EF Core, domain tipleri              |
| Persistence      | DbContext, EF configuration, migrations            | PostgreSQL                                     |
| Deployment       | Docker image'ları, Nginx, Compose                  | API, web artifact'leri, host PostgreSQL/Tunnel |

# 6. Sistem Bileşenleri

## 6.1 Bileşen Haritası

```text
React istemcisi
  ├── AuthProvider ───────────────► /api/auth
  ├── CategorySelectionPage ──────► /api/categories
  ├── QuestionPracticePage ───────► /api/practice-sessions
  └── WordsPage ──────────────────► /api/words
                                      │
                                      ▼
                             ASP.NET Core + EF Core
                                      │
                                      ▼
                                 PostgreSQL
```

## 6.2 API

`Program.cs` yalnızca gerekli connection string mevcutsa başlar. DI ile
`CategoryService`, `PracticeQuestionFactory`, `PracticeSessionService` ve
`WordCatalogService` kaydedilir; feature extension method'ları endpoint
gruplarını eşler. `GET /health` veritabanı bağlantısını kontrol eder.

## 6.3 Web İstemcisi

`main.tsx`, `ThemeProvider`, `QueryClientProvider`, `AuthProvider` ve
`BrowserRouter` kurar. Kimliği doğrulanmamış kullanıcı yalnızca `AuthPage`e
gider. Kimliği doğrulanan kullanıcı için kök kategori seçimi, Practice
route'ları ve `/words` yüklenir; route seviyesinde lazy loading kullanılır.

## 6.4 PostgreSQL ve Production Web Katmanı

PostgreSQL Identity tablolarını, kelime içeriğini, session snapshot'larını ve
progress satırlarını tutar. Nginx Vite artifact'lerini sunar; `/assets/` için
uzun ömürlü immutable cache, `index.html` ve SPA fallback için `no-cache`
kullanır. Varsa Cloudflare `CF-Connecting-IP` header'ını API'ye istemci IP'si
olarak iletir.

# 7. Modüller

## 7.1 Modül Haritası

| Modül               | Sorumluluk                                    | Bağımlı olduğu modüller           |
| ------------------- | --------------------------------------------- | --------------------------------- |
| Auth                | Identity, cookie oturumu ve XSRF              | `ApplicationDbContext`            |
| Words               | Kelime domain'i ve katalog                    | DbContext, Practice progress      |
| Practice/Categories | Level/topic görünümü ve progress reset        | Words, Practice                   |
| Practice/Questions  | Plan, snapshot, cevap doğrulama ve seçenekler | Words, Practice domain            |
| Practice/Sessions   | Oturum yaşam döngüsü ve progress upsert       | Questions, Words, Auth, DbContext |
| Data                | EF mapping/migrations                         | Auth, Practice, Words domain      |
| Web/auth            | Session yükleme ve login/register             | `/api/auth`                       |
| Web/practice        | Kategori, soru, sonuç, feedback sesi          | category/practice API             |
| Web/words           | Filtrelenebilir salt okunur katalog           | `/api/words`                      |

## 7.2 Auth, Practice ve Words

`AuthEndpoints`; antiforgery token, session, kayıt, giriş ve çıkış sağlar.
E-posta/kullanıcı adı doğrulanır; Identity parolası en az sekiz karakter,
büyük harf, küçük harf ve rakam ister. Kayıt ve giriş IP tabanlı rate limit'e,
durum değiştiren auth uçları antiforgery filter'a tabidir.

`PracticeSessionService` tek aktif session, replay, cevap transaction'ı ve
`UserWordProgress` upsert'ini sahiplenir. `PracticeQuestionFactory` soru
snapshot'ını server'da üretir ve çoktan seçmeli seçenekleri persist eder.

`WordCatalogService` tüm kelimeleri ID sırasıyla ve kullanıcı için kelime
başına en son `LastOutcome` ile döndürür. Bu görünüm mevcut
`Direction + Format` progress'ini tek sonuca indirger; hedef dört mastery
boyutunu tam temsil etmez.

# 8. Bağımlılıklar

## 8.1 İç Bağımlılıklar

Practice `Word` verisini soru için, `ApplicationUser` kimliğini sahiplik için
kullanır. `PracticeSessionWord` hem `PracticeSession`a hem `Word`e,
`UserWordProgress` kullanıcı ve kelimeye bağlıdır. Silme davranışları
session/kullanıcı için cascade, `Word` için restrict'tir.

## 8.2 Dış Bağımlılıklar

- ASP.NET Core Identity, EF Core/Npgsql ve PostgreSQL çalışan uygulama için
  zorunludur.
- Docker Compose ve Cloudflare Tunnel yalnızca belirtilen production topology
  için gereklidir.
- TTS/STT sağlayıcısı planlanmıştır; güncel sistemin bağımlılığı değildir.

## 8.3 Bağımlılık Kuralları

- API progress veya doğru cevap kararını frontend'den kabul etmez; server
  snapshot ve domain kuralını kullanır.
- `ImportKey`/`CurriculumUnit.Key` hedef bootstrap identity'sidir; runtime
  foreign key yerine database-generated `Word.Id`/`CurriculumUnit.Id` kullanır.
- Yeni ses sağlayıcısı mastery domain'ini sağlayıcı tipine bağlamaz.

# 9. Veri Modeli

## 9.1 Mevcut Temel Varlıklar

| Varlık                | Sahip olduğu bilgi                                                                   |
| --------------------- | ------------------------------------------------------------------------------------ |
| `ApplicationUser`     | ASP.NET Core Identity kullanıcısı                                                    |
| `Word`                | `English`, `TurkishTranslations`, part of speech, fiil metadata'sı, `Level`, `Topic` |
| `PracticeSession`     | Kullanıcı, level, topic, mode, replay/durum ve zamanlar                              |
| `PracticeSessionWord` | Position, yön, format, soru/cevap snapshot'ı, seçenekler ve sonuç                    |
| `UserWordProgress`    | Doğru/review/yanlış sayaçları, son sonuç ve cevap zamanı                             |

`Word` için `English + PartOfSpeech` benzersizdir. Türkçe çeviriler PostgreSQL
`text[]` olarak tutulur; boş/null çeviri kabul edilmez. Fiil geçmiş zaman
alanları part of speech ile tutarlı olmalıdır. Level, topic, mode, status,
direction, format ve outcome değerleri check constraint'lerle sınırlandırılır.

## 9.2 Varlık İlişkileri

```text
ApplicationUser 1 ── * PracticeSession 1 ── * PracticeSessionWord * ── 1 Word
       │                                                              │
       └────────────────────── * UserWordProgress * ─────────────────┘
```

Bir session soru satırının primary key'i `PracticeSessionId + Position`dır.
Aynı session'da `WordId + Direction + Format` yalnızca bir kez bulunabilir.
Progress benzersiz kimliği `UserId + WordId + Direction + Format`tır.

Bir kullanıcının aynı `Level + Topic` için yalnızca bir `Active` session'ı
olabilir. Unique partial index bu kuralı eşzamanlı başlatmada da korur.

## 9.3 Veri Sahipliği ve Snapshot

`PracticeSessionWord`; `EnglishSnapshot`, `PromptSnapshot`,
`CorrectAnswerSnapshot` ve yazılı cevap için kabul edilen cevapları saklar.
Çoktan seçmeli `Options`/`CorrectIndex` ilk dört cevaplanmamış soru için
lazım olduğunda oluşturulur ve kalıcılaştırılır.

Bu nedenle kelime sonradan düzeltilse de geçmiş oturumun hangi soruyu
gösterdiği ve doğru cevabı değişmez. İçerik raporu gibi gelecek özellik
kelimeye değil, bu snapshot'a bağlanmalıdır.

## 9.4 Mevcut Veri Yaşam Döngüsü

1. Migration şemayı oluşturur veya günceller.
2. `Word` kayıtları veritabanında bulunur; Practice onları `Level`/`Topic`a
   göre seçer.
3. Session oluşturulurken soru planı ve içerik snapshot'ı kaydedilir.
4. Cevap transaction ile bir kez işlenir, ardından progress upsert edilir.
5. Kategori reset'i o kullanıcıya ait ilgili session ve progress'i siler.

`Data/WordMatch.csv` version-controlled vocabulary kaynağıdır; ancak güncel
kaynak kodda bunu veritabanına yükleyen bootstrap komutu veya runtime seeder
yoktur. Boş veritabanında migration tek başına Practice'i kullanılabilir yapmaz.

## 9.5 Migration ve Hedef Bootstrap Modeli

Mevcut sistemde `WordMatch.API/Migrations` altında artımlı EF Core migration
zinciri vardır. Uygulanmış migration geriye dönük değiştirilmez; paylaşılmış
veya production ortamı değişikliği yeni migration ile yapılır. Test factory,
tarihsel migration'ların veri koruma davranışını ayrıca denetler.

Planlanan hedef mimari büyük domain değişikliği için bilinçli bir clean reset
öngörür. Bu **henüz uygulanmış değildir**:

- Eski veritabanı `word_match_legacy` adıyla, kaynak kodu ve migration tarihi
  Git tag/release geçmişiyle korunur.
- Yeni boş `word_match` veritabanı, legacy tabloları oluşturup kaldıran geçici
  adımlar olmadan tek `InitialCreate` migration'ıyla başlar.
- Eski kullanıcı, session geçmişi ve progress ilk aşamada taşınmaz; kullanıcı
  yeniden kaydolur. Gerçek kullanıcı verisi korunacaksa ayrı, açık ve testli
  data migration tasarlanır.
- Zincir kaldırılmadan önce custom SQL, manuel dönüşüm ve EF'nin yeniden
  üretmeyeceği custom migration davranışları incelenir; gereken davranış yeni
  migration, bootstrap veya deployment işlemine taşınır.
- Hedef migration'lar `word_match_legacy` üzerinde çalıştırılmaz. Sonraki
  değişiklikler yeni `InitialCreate` üstüne normal migration olarak eklenir.

Planlanan bootstrap, `Words`, `CurriculumUnits` ve `CurriculumUnitWords`
oluşturmadan ortamı kullanıma açmaz. `WordMatch.csv` her kelime için değişmez
bir `ImportKey` taşıyan canonical Word kaynağı olur. `ImportKey`
database-generated `Word.Id`, düzenlenebilir English/çeviri/metadata'dan
türetilmez; unique index ile korunur ve foreign key değildir.

Curriculum kaynağı en az şunları taşır:

```text
CurriculumUnit:     Key, Level, Title, SortOrder
CurriculumUnitWord: CurriculumUnitKey, WordImportKey, SortOrder
```

`CurriculumUnit.Key` başlık veya sıra değişse de aynı kavramsal unit için
değişmez ve unique index ile korunur. Import, key'leri database ID'lerine çözer
ve gerçek ilişkiye `CurriculumUnitId + WordId` yazar; curriculum sırası
runtime'da `Topic`tan üretilmez.

Bootstrap idempotenttir: aynı input duplicate kayıt/ilişki/ID değişimi üretmez.
Varsayılan işlem, kaynakta artık bulunmayan kaydı otomatik silmez; destructive
reconciliation ayrı, açık işlemdir. Hedef ortam sırası:

```text
1. Boş word_match veritabanını oluştur.
2. InitialCreate migration'ını uygula.
3. Word bootstrap importunu çalıştır.
4. Curriculum bootstrap importunu çalıştır.
5. Referential integrity ve duplicate kontrollerini doğrula.
6. Uygulamayı kullanıma aç.
```

Bootstrap normal application startup'ında kontrolsüz çalışmaz; ayrı CLI veya
deployment adımı olur.

# 10. Veri Akışı

## 10.1 Kimlik ve XSRF Akışı

1. İstemci `GET /api/auth/antiforgery` ile request token alır; sistem ilgili
   cookie'yi de saklar.
2. Kayıt/giriş isteği `X-XSRF-TOKEN` header'ıyla gönderilir.
3. Identity başarılıysa persistent authentication cookie oluşturur.
4. `GET /api/auth/session` cookie'den kullanıcıyı okuyup istemciyi hydrate eder.
5. Çıkış, antiforgery doğrulamasından sonra cookie oturumunu kapatır.

## 10.2 Mevcut Practice Akışı

1. Kullanıcı `Level`, `Topic`, `PracticeMode` ve gerekirse `Replay` gönderir.
2. Service mode'u denetler. Aynı kullanıcı/level/topic için aktif session varsa
   normal istek aynı mode'da oturumu devam ettirir; aksi durumda mevcut session
   `Abandoned` olur ve yeni session oluşturulur.
3. Uygun kelimeler seçilir. Normal oturum daha önce tamamlanan
   `Word + Direction + Format` kombinasyonlarını çıkarır; replay dahil eder.
4. `EnglishToTurkish` ve `TurkishToEnglish` tek yönü, `Mixed` iki yönü seçer.
   Her kelime için iki `QuestionFormat` (`MultipleChoice`, `Written`) planlanır;
   Mixed modunda bu dört soru eder.
5. Plan, aynı kelimeyi ardışık vermemeye çalışır; her öğenin snapshot'ı yazılır.
6. İlk dört pending çoktan seçmeli soru için server dört farklı seçenek üretir.
7. Kullanıcı `Position` ve `WordId` ile cevaplar. Server yalnızca etkin pending
   soruyu kabul eder.
8. Transaction'daki koşullu update cevabı bir kez işler, progress'i upsert eder
   ve session'ı tamamlar veya aktif bırakır.
9. İstemci 409 alırsa session'ı yeniden getirir.

Çoktan seçmeli soruda `SelectedIndex = null`, yazılı soruda cevap
gönderilmemesi `Review` sonucudur. Yazılı cevap server'da normalize edilir;
Türkçe karşılaştırma `tr-TR` kültür duyarlı, İngilizce karşılaştırma
case-insensitive'dir.

Distractor seçimi önce session kelimeleri, sonra aynı level, sonra tüm katalog
üzerinden yapılır. Dört farklı cevap üretilemezse istek geçersizdir.

## 10.3 Kategori, Katalog ve Sonuç

- Kategori endpoint'i level/topic için toplam/tamamlanan soru, aktif session ve
  replay durumunu döndürür.
- Kategori reset'i transaction içinde o kullanıcının seçili level/topic
  session'larını ve ilgili `UserWordProgress` satırlarını siler.
- Sonuç endpoint'i her `Word + Direction + Format` için en son snapshot'ı
  Correct, Review, Wrong listelerine ayırır.
- Katalog kelime başına kullanıcının en son progress outcome'unu gösterir.

## 10.4 Planlanan Learn, Review ve Practice

Planlanan model aynı kelime ve mastery kayıtlarını üç ayrı selection kuralıyla
kullanır. Bir session amacı `Learn`, `Review` veya `Practice` olarak ayrılır;
aynı `PracticeSession` aggregate'ı kullanılabilir fakat seçim kuralı purpose'a
göre değişir.

### Learn

Learn, kullanıcıyı `A1 → A2 → B1 → B2 → C1 → C2` vocabulary path'i boyunca
götürür. Kullanıcı `Devam Et` dediğinde sistem sonraki çalışmayı oluşturur;
her seferinde level/category/mode/format seçmez. `Level` curriculum ana
seviyesidir; `Topic` anlamlı grup ve Practice filtresidir, ana Learn seçimi
değildir.

Learn sonsuz feed değildir; görünür `CurriculumUnit` kilometre taşları gerekir:

```text
CurriculumUnit
- Id, Key, Level, Title, SortOrder

CurriculumUnitWord
- Id, CurriculumUnitId, WordId, SortOrder

UserCurriculumProgress
- UserId, CurriculumUnitId, Status, StartedAtUtc, CompletedAtUtc
```

`Status` en az `NotStarted`, `InProgress`, `Completed` destekleyebilir. Veri
modeli kullanıcının unit içinde hangi kelimeden devam edeceğini
`NextWordSortOrder`, `CurrentCurriculumUnitWordId` veya açık history kaydıyla
kalıcı ve deterministik cevaplamalıdır. Unit sırası, unit içi sıra, kelime
sayısı, level completion ve yeni kelime hızı topic listesinden otomatik
çıkarılmaz; bilinçli curriculum kararıdır.

Seçim aktif level/unit/position, tanıtılmamış/tanıtılmış kelimeler, mastery,
yakın tekrar, yeni–review dengesi ve cihaz yeteneğini kullanır. Aynı kelimenin
dört mastery sorusu art arda gelmez; kesin spacing sonradan kalibre edilir.

### Review

Review kelimeyi bütün olarak değil `Word + MasteryDimension` olarak seçer.
Due kayıtlar ve zayıf boyutlar önceliklidir; kullanıcı level/category seçmez.
İlk spaced repetition hedefi kusursuz algoritma değil doğru sözleşmedir:
son cevabı işler, mastery durumunu günceller, `NextReviewAt` veya eşdeğer
zamanı belirler; Wrong/Review daha erken, güçlü kayıtları daha uzun aralıkta
getirebilir.

### Practice

Planlanan Practice filtreleri `Level`, `Category` ve `Mastery`dir; her biri
tek başına veya birlikte seçilebilir. Eşleşme yoksa açık empty state gösterilir.
Practice mastery sonucunu güncelleyebilir ama Learn tarafından henüz tanıtılmamış
kelimeyi otomatik introduced saymaz ve unit completion'ı ilerletmez.

### Mastery Görünürlüğü

Planlanan ana ekran, kullanıcının vocabulary path'te nerede olduğunu, aktif
unit'i ve ayrı olarak kaç Review kaydının hazır olduğunu gösterebilmelidir.
Bir kelime gerektiğinde dört boyutta `Strong`, `Learning`, `Weak` veya
denenmemiş gibi anlamlı durumlarla görülebilir. İlk sürümde `92%` gibi yapay
kesinlik veren yüzdeler zorunlu değildir.

`/words` normal kullanıcı için salt okunur kalır. Hedef model tamamlandığında
tek bir toplu durum, dört ayrı gösterge veya mastery boyutuna göre filtreleme
bilinçli bir UI kararıyla seçilmelidir; mevcut tek `currentOutcome` bunun
yerine geçirilmiş sayılmaz.

# 11. Runtime Davranışı

## 11.1 Başlangıç

- `ConnectionStrings:DefaultConnection` boşsa API exception ile başlamaz.
- Non-development ortamda `DataProtection:KeyPath` zorunludur.
- `Database:AutoMigrate` yalnızca `true` ise startup'ta `MigrateAsync` çağırır;
  Compose bunu `false` ayarlar.
- `Https:Redirect=true` ise HTTPS redirect eklenir; Compose `false` ayarlar,
  çünkü dış TLS Cloudflare'de terminate edilir.
- Startup sonrası auth, rate-limit, authorization ve endpoint middleware'leri
  çalışır.

## 11.2 Kapanış, Arka Plan ve Zamanlanmış İşler

Özel shutdown/drain mekanizması tanımlı değildir. Docker container'ları
`restart: unless-stopped` ile çalışır. Mevcut kaynakta background worker,
queue consumer veya zamanlanmış Review işi yoktur. Planlanan Review due
kayıtlarını session başlatılırken seçer; ayrı scheduler belgelenmemiştir.

## 11.3 Eşzamanlılık

- Tek aktif session unique index ile korunur; `DbUpdateException` sonrası
  service mevcut session'ı yeniden okur.
- Cevap satırı `Outcome IS NULL` koşuluyla güncellenir; yalnızca bir submit
  başarılı olur.
- Progress upsert ve session durumu aynı database transaction'ındadır.
- Lazy seçenekler yalnızca henüz yazılmamış satırı güncelleyen koşullu update
  ile oluşturulur; yarışta saklanan değer okunur.

# 12. Arayüzler

## 12.1 HTTP / API

| Uç                                                | Kimlik                    | Amaç                           |
| ------------------------------------------------- | ------------------------- | ------------------------------ |
| `GET /api/auth/antiforgery`                       | Hayır                     | Antiforgery request token'ı    |
| `GET /api/auth/session`                           | Evet                      | Geçerli kullanıcı              |
| `POST /api/auth/register`                         | Hayır + rate limit + XSRF | Hesap oluşturur ve giriş yapar |
| `POST /api/auth/login`                            | Hayır + rate limit + XSRF | Giriş yapar                    |
| `POST /api/auth/logout`                           | Evet + XSRF               | Oturumu kapatır                |
| `GET /api/categories/`                            | Evet                      | Kategori ve ilerleme           |
| `DELETE /api/categories/{level}/{topic}/progress` | Evet + XSRF               | Kategori progress reset        |
| `POST /api/practice-sessions/`                    | Evet + XSRF               | Session başlatır/devam ettirir |
| `GET /api/practice-sessions/{sessionId}`          | Evet                      | Session okur                   |
| `GET /api/practice-sessions/results`              | Evet                      | Sonuç görünümü                 |
| `POST /api/practice-sessions/{sessionId}/answers` | Evet + XSRF               | Mevcut soruyu cevaplar         |
| `GET /api/words/`                                 | Evet                      | Salt okunur kelime kataloğu    |
| `GET /health`                                     | Hayır                     | PostgreSQL health check        |

Enum'lar JSON'da string serileştirilir. `Program.cs` yalnızca
`AddEndpointsApiExplorer()` içerir; Swagger middleware'i veya yayınlanmış
`/swagger` endpoint'i yoktur.

## 12.2 CLI, Dosya ve Tarayıcı Arayüzleri

Mevcut uygulamanın özel CLI'ı yoktur; EF migration için `dotnet ef` kullanılır.
Planlanan idempotent bootstrap normal startup yerine ayrı CLI/deployment adımı
olur; komut sözleşmesi henüz belirlenmemiştir.

`Data/WordMatch.csv` source dosyası güncel kod tarafından import edilmez.
Feedback sesleri `/sounds/correct.wav`, `/sounds/wrong.wav`,
`/sounds/show-answer.wav` olarak statik sunulur. Planlanan
`AuralRecognition` için browser `SpeechSynthesis` ilk yaklaşım olabilir;
voice listesi geç yüklenebilir, uygun English voice bulunmayabilir ve autoplay
kısıtları vardır.

# 13. Yapılandırma

## 13.1 Yapılandırma Kaynakları

ASP.NET Core varsayılan zinciri `appsettings.json`, ortam ayarları, environment
variable ve development user secrets kullanır. Production Compose değerleri
hosttaki `.env`den alır; `.env` commit edilmez, `.env.example` yalnızca
şablondur.

## 13.2 Ortam Değişkenleri

| Ad                                     | Rol                         |
| -------------------------------------- | --------------------------- |
| `ConnectionStrings__DefaultConnection` | PostgreSQL bağlantı dizisi  |
| `Database__AutoMigrate`                | Startup migration davranışı |
| `DataProtection__KeyPath`              | Non-development key dizini  |
| `Https__Redirect`                      | API HTTPS redirect          |
| `ASPNETCORE_ENVIRONMENT`               | ASP.NET Core ortamı         |
| `ASPNETCORE_HTTP_PORTS`                | Container API portu         |
| `WORDMATCH_API_PORT`                   | Host API portu              |
| `WORDMATCH_WEB_PORT`                   | Host Nginx web portu        |
| `WORDMATCH_WEB_BIND_ADDRESS`           | Nginx host bind adresi      |

Secret, token, parola ve private key değerleri dokümana veya repository'ye
yazılmaz.

## 13.3 Ortamlar

### Development

API hostta `dotnet watch`, istemci `npm run dev` ile çalışır. Launch profile
API HTTP adresini `http://localhost:5164`, Vite `http://localhost:5174` olarak
yapılandırır; Vite `/api` isteklerini API'ye proxy eder. PostgreSQL repository
dışında çalışır, connection string user secrets ile verilebilir.

Kaynak belgelerde development ve production'ın öğrenme verisini bilinçli
paylaşabileceği yazılıdır. Kod bunu zorunlu kılmaz; deployment connection
string'i belirler. Authentication cookie adları ve Data Protection key depoları
ayrıdır; test veritabanı development/production PostgreSQL'iyle paylaşılmaz.

### Test

`WordMatchApiFactory`, `postgres:17-alpine` Testcontainer ile
`word_match_tests` veritabanı oluşturur. API development environment'ında
çalışır ancak connection string test container'ından gelir.

### Production

Compose API 8080 container portunu yalnızca host loopback'e, Nginx web origin'ini
varsayılan olarak `127.0.0.1`e yayınlar. Nginx `/api/` için özel Docker ağındaki
`api:8080` upstream'ini kullanır. Cloudflare Tunnel production hostname'ini web
origin'ine yönlendirmelidir.

Tunnel host loopback'e erişemiyorsa `WORDMATCH_WEB_BIND_ADDRESS=0.0.0.0`
kullanılabilir; bu durumda port güvenilmeyen ağlardan ayrıca korunmalıdır.

# 14. Güvenlik Mimarisi

## 14.1 Güven Sınırları

Tarayıcı–Nginx/Cloudflare, Nginx–API ve API–PostgreSQL ayrı güven sınırlarıdır.
Production container'ları özel ağda HTTP konuşabilir; public erişim güvenli dış
HTTPS endpoint üzerinden yapılır. `UseForwardedHeaders`, forwarded header'ları
yalnızca `172.16.0.0/12` Docker private address aralığındaki proxy için
güvenilir kabul eder.

## 14.2 Kimlik Doğrulama ve Yetkilendirme

Identity benzersiz e-posta ve persistent cookie kullanır. Development cookie
adı `WordMatch.Auth.Development`, non-development adı
`__Host-WordMatch.Auth`tur. Cookie `HttpOnly`, `SameSite=Lax`, `Path=/` ve
production'da `Secure=Always` ayarlarıyla çıkar.

`__Host-` öneki `Secure=true`, `Path=/` ve Domain belirtilmemesi koşuluna
bağlıdır. Planlanan schema/authentication reset'inde legacy cookie'nin hedef
sistemce kullanılmaması için production'da
`__Host-WordMatch.Auth.Production`/`__Host-WordMatch.XSRF.Production`,
development'ta `WordMatch.Auth.Development`/`WordMatch.XSRF.Development`
öngörülür. Bu isimler **hedef mimaridir**; mevcut non-development kodu
`.Production` suffix'i içermez.

Kategori, Practice ve Words grupları `RequireAuthorization()` kullanır; service
sorguları kullanıcı ID'siyle scope edilir. `GET /health` ile kayıt/giriş/
antiforgery anonimdir; session/çıkış kimlik gerektirir. Gelecek admin ekranı
frontend'de gizlenemez, server-side `Admin` policy ile korunur.

## 14.3 Antiforgery, Rate Limit ve Hassas Veri

XSRF cookie adı development'ta `WordMatch.XSRF.Development`,
non-development'ta `__Host-WordMatch.XSRF`dir. İstemci state-changing
çağrılarda `X-XSRF-TOKEN` gönderir; filter geçersiz/eksik token için 400 döner.

Kayıt/giriş, IP başına dakikada 10 istek izinli fixed-window `auth` policy'sine
tabidir; aşımda 429 döner, queue yoktur. Kayıt isteği e-posta/kullanıcı adı/
parola, Practice mode/cevap türü/indeks/pending soru/yazılı cevap kurallarıyla
doğrulanır. Parametreli EF Core/SQL interpolation kullanılır; parola veya
connection string response'ta dönmez.

Planlanan `SpokenRecall`de mikrofon yalnızca soru başlatıldığında açılır,
arkaplanda sürekli dinleme yoktur:

```text
record → transcribe → discard
```

Ham kayıt Word Match veritabanında kalıcı tutulmaz. Sadece gerekli recognized
text, outcome ve minimum teknik metadata saklanabilir. Harici STT seçilirse
kullanıcıya veri gönderimi açıklanır, sağlayıcı anahtarı frontend'e verilmez,
çağrı API üzerinden yapılır ve provider retention politikası implementation
öncesi belgelenir.

# 15. Hata Yönetimi

## 15.1 Hata Modeli

- Config eksikleri startup exception ile uygulamayı durdurur.
- Auth doğrulaması `ValidationProblem`, geçersiz giriş 401, yasak erişim 403
  döndürür.
- Practice validation 400, bulunamayan kaynak 404, eski/çakışan session veya
  cevap 409 döndürür. Practice hataları `{ "message": "…" }` şeklindedir.
- `/health` database ulaşılamazsa 503 ve `unhealthy` durumunu döndürür; hata
  warning olarak loglanır.

Tek global Problem Details/exception middleware'i belgelenmemiştir; beklenmeyen
server hataları framework varsayılanına kalır.

## 15.2 Recovery

İstemci cevap kaydında 409 alırsa session'ı yeniden yükler. UI, yükleme ve
kayıt hatalarını ayrı durumlarla gösterir. Uygulamada otomatik database retry
policy yapılandırılmamıştır.

Planlanan cihaz hatası öğrenme outcome'u değildir: desteklenmeyen boyut
planlanmaz; session sırasında izin/audio/network/speech desteği kaybolursa soru
`SkippedUnsupported` veya eşdeğeri lifecycle ile kapanır. Correct/Wrong/Review,
mastery strength veya review scheduling değişmez; session bloke olmaz.

# 16. Logging ve Gözlemlenebilirlik

`appsettings.json` varsayılan log seviyesini `Information`,
`Microsoft.AspNetCore` seviyesini `Warning` yapar. Health database hatasını
`HealthCheck` logger'ıyla warning kaydeder. Nginx access/error logları
stdout/stderr'e, Docker logları container log akışına gider.

Metrics, distributed tracing veya business metric tanımlı değildir. `GET /health`
yalnızca database bağlantısını denetler; Nginx/Cloudflare reachability kanıtı
değildir.

# 17. Cache, Performans ve Ölçeklenebilirlik

Mevcut sistemde distributed cache yoktur. Kritik yollarda session oluşturma ve
seçenek üretimi katalogyu belleğe alır; katalog endpoint'i tüm kelimeleri ve o
kullanıcıya ait progress satırlarını ayrı sorgular. Distractor üretimi session,
aynı level ve tüm katalogyu tarayabilir.

Bu davranış küçük vocabulary kataloğu için tasarlanmıştır; ölçek hedefi
belgelenmemiştir. Katalog büyürse pagination, daha dar sorgu ve sorgu
profillemesi ölçümle değerlendirilir; uygulanmış çözüm değildir.

Teknik sınırlar:

- Dört seçenek için içerik yeterli ayrık cevap taşımalıdır.
- Curriculum sırası `Topic`tan çıkarılamaz; explicit source gerekir.
- Browser TTS voice kalitesi/erişimi cihazlar arasında tutarsız olabilir.
- STT'nin browser/device'ta mı, `API → external provider` yolunda mı
  çalışacağı belirlenmemiştir.

# 18. Build ve Çalıştırma

API `dotnet build`/`dotnet watch`, web `npm run build`/`npm run dev` ile çalışır.
Web build TypeScript ve Vite build'ini yürütür. `npm run check`; lint,
typecheck, Tailwind lint, format kontrolü, Vitest ve Vite build'ini birleştirir.

Docker API image'i .NET SDK ile publish eder, .NET runtime image'inde çalışır.
Web image'i Node 24 ile artifact üretir, unprivileged Nginx image'ine kopyalar.
Günlük komutlar için [README.md](README.md) kullanılır.

# 19. Deployment

## 19.1 Topoloji

```text
Internet
  │ HTTPS
  ▼
Cloudflare Tunnel
  │ http://localhost:<WORDMATCH_WEB_PORT>
  ▼
Nginx web container ── /api/ ──► API container:8080 ──► host PostgreSQL:5432
```

Web bind adresi varsayılan olarak loopback'tir. API portu da Compose'ta
`127.0.0.1`e bağlıdır. Direct HTTP origin yalnızca yerel health check için
düşünülür; production auth cookie'leri secure'dur. Varsayılan web portuyla
Tunnel hedefi `http://localhost:5172` olur; Cloudflare Universal SSL açık
tutulur ve kullanıcı production Cloudflare HTTPS hostname'i üzerinden erişir.

## 19.2 Release ve Migration Sırası

1. Yerel `.env` dosyasını `cp .env.example .env` ile oluşturup ortam değerlerini
   güvenli biçimde girin.
2. Yeni şema gerekiyorsa testlerden sonra migration'ı açıkça uygulayın.
3. `docker compose config` ile yapılandırmayı denetleyin.
4. `docker compose up -d --build` ile image'leri build edip başlatın.
5. API health, Nginx origin ve Cloudflare hostname'ini ayrı ayrı doğrulayın.

Compose `Database__AutoMigrate=false` gönderir. Hedef clean-bootstrap
mimarisinde migration'dan sonra ayrıca bootstrap importu ve referential
integrity/duplicate doğrulaması gerekir.

## 19.3 Rollback ve Data Protection

Otomatik rollback prosedürü yoktur. Şema migration'ı içeren release geri
alınmadan önce migration veri uyumluluğu ve geri dönüş adımları değerlendirilir.
Production Data Protection key'leri named `wordmatch-data-protection` volume'ünde
`/var/lib/wordmatch/data-protection` altında kalır; container değişse de
oturum şifreleme anahtarları korunur. Bu volume'ü silmek mevcut production
oturumlarını geçersiz kılar, rollback aracı değildir.

# 20. Test Stratejisi

## 20.1 Test Türleri

| Tür                  | Konum                            | Kapsam                                                     |
| -------------------- | -------------------------------- | ---------------------------------------------------------- |
| API/entegrasyon      | `WordMatch.API.Tests`            | Auth, kategori, question factory, session endpoint/service |
| Migration            | `WordMatchApiFactory`            | Tarihsel migration sözleşmesi ve veri koruma               |
| Web unit/bileşen     | `WordMatch.Web/src/**/__tests__` | Auth, practice, words, API client, UI                      |
| Format/statik analiz | API ve web komutları             | Format, lint, TypeScript                                   |

## 20.2 Test Sınırları ve Kritik Senaryolar

API testleri izole Testcontainer PostgreSQL kullanır; development/production
veritabanına bağlanmaz. Fixture başlangıçta küçük kontrollü kelime seti ekler.
Cloudflare, gerçek production hostname, gerçek TTS/STT veya fiziksel cihaz
acceptance testi kaynakta yoktur.

Kritik test alanları auth/XSRF; kategori doğrulaması/reset; dört farklı
seçenek, Türkçe/İngilizce normalizasyonu ve aynı kelimeyi ardışık planlamama;
tek aktif session, replay, double submit/409; migration veri koruma; webde
session resume, sonuç, error state, klavye erişimi ve feedback ses tercihidir.

## 20.3 Sürekli Entegrasyon

`.github/workflows/ci.yml`, `main` branch'ine push ve pull request'lerde,
ayrıca elle tetiklenince çalışır. Aynı workflow/ref için önceki çalışmayı iptal
eder ve üç bağımsız job yürütür:

- **API (.NET):** .NET 10 ile solution restore/build eder ve API testlerini
  Release yapılandırmasında çalıştırır. Test uygulaması için yalnızca CI'a ait
  PostgreSQL connection string'i environment variable olarak verilir.
- **Web (React/Vite):** Node 24'te `WordMatch.Web` dizininde `npm ci` ardından
  `npm run check` çalıştırır; lint, typecheck, biçim kontrolü, Vitest ve
  production Vite build'ini kapsar.
- **Docker images:** Production benzeri gerekli Compose değişkenleriyle
  `docker compose build` çalıştırır. Container'ları başlatmaz ve canlı
  PostgreSQL/Cloudflare Tunnel doğrulaması yapmaz.

# 21. Kod ve Tasarım Kuralları

## 21.1 İsimlendirme ve Organizasyon

- API/web dosyaları feature altında tutulur; merkezi katman adına göre
  dağılmaz.
- C#, class/property/endpoint/paket isimleri İngilizce kalır; kullanıcı Türkçe
  etiketleri `displayLabels` ve UI'da yönetilir.
- `QuestionDirection` ile `QuestionFormat` mevcut modelde ayrı kavramlardır.

## 21.2 Public API ve Değişmez Kurallar

- `GET /api/words/` normal kullanıcı için salt okunurdur; bugün kelime
  create/update endpoint'i yoktur.
- State-changing endpoint'ler authorization gerekiyorsa XSRF filter'ını da
  kullanır.
- Response'lar server snapshot'ını döndürür; istemci doğru cevabı yazmaz.
- `Word.Id` runtime ilişkisel kimliktir; progress oluştuktan sonra `Words`
  truncate edilip yeniden yüklenmez.
- Session snapshot geçmiş sonucu korur.
- Mastery strength ile bir sonraki review zamanı aynı state/sayı değildir.
- Curriculum progression ve mastery birbirinin yerine kullanılmaz.
- Planlanan `SkippedUnsupported` öğrenme sonucu değildir.

## 21.3 Kaçınılması Gerekenler

- `English + PartOfSpeech`i hedef bootstrap import identity'si yapmak.
- `Direction × Presentation × AnswerMethod`ın tüm kombinasyonlarını üretip
  progress kimliği yapmak.
- Uygulanmış migration'ı değiştirmek veya migration klasörünü kontrol listesi
  olmadan silmek.
- Topic/level metadata'sından runtime curriculum sırası uydurmak.
- Teknik audio/STT hatasını `Wrong` saymak ya da desteklenmeyen Practice
  seçimini sessizce başka mastery boyutuna düşürmek.

# 22. Mimari Kararlar

## ADR-001 — Feature Tabanlı Minimal API

Endpoint'ler `MapGroup` ile feature altında toplanır; EF Core access
service'lerde doğrudan `ApplicationDbContext` üzerinden yapılır. Küçük ürün
için repository/Unit of Work soyutlaması eklenmez.

## ADR-002 — Session Soru Snapshot'ları Kalıcıdır

Kelime içeriği değişse bile geçmiş kullanıcı sonucu korunur. Bu nedenle
`PracticeSessionWord` prompt, correct answer, accepted answers ve gerekirse
seçenekleri saklar.

## ADR-003 — Mevcut Progress Dört Soru Kombinasyonuna Göredir

Bugünkü kimlik `UserId + WordId + Direction + Format`tır. Çalışan Practice'i
temsil eder fakat hedef öğrenme semantiğinin nihai modeli değildir.

## ADR-004 — Hedef Mastery Dört Bilinçli Boyuttur

| Boyut                | Egzersiz                              | Ölçülen bilgi       |
| -------------------- | ------------------------------------- | ------------------- |
| `WrittenRecognition` | İngilizceyi gör → Türkçe anlamı seç   | Yazılı formu tanıma |
| `AuralRecognition`   | İngilizceyi duy → Türkçe anlamı seç   | Sesli formu tanıma  |
| `WrittenRecall`      | Türkçe anlamı gör → İngilizceyi yaz   | Yazılı formu üretme |
| `SpokenRecall`       | Türkçe anlamı gör → İngilizceyi söyle | Sesli formu üretme  |

Türkçe hedef öğrenme dili değil, anlam yardımcısıdır. Hedef ilerleme en az
`UserId + WordId + MasteryDimension` benzersizliğinde `UserWordMastery` ile
tutulur. Kayıt son outcome, doğru/yanlış geçmişi, mastery strength, son
çalışma/başarı zamanı, review zamanı ve Learn içinde boyutun denenmesini
destekler; kesin property/enum isimleri implementation'da seçilir.

`QuestionPresentation` (`Text`, `Audio`) ve `AnswerMethod`
(`MultipleChoice`, `Written`, `Spoken`) soru üretiminde yararlı kavramlar
olabilir; progress kimliği değildir. Sistem bunların tüm çarpımını üretmek
yerine yalnızca bu dört bilinçli mastery egzersizini destekler.

## ADR-005 — Clean Migration Reset Hedef Karardır

Hedef reset varsayılan migration stratejisi değildir. Büyük domain değişikliği
için legacy database/authentication'ı bilinçli ayırır ve reset öncesi custom
migration davranışının taşınmasını zorunlu kılar. Ayrıntılar
[Bölüm 9.5](#95-migration-ve-hedef-bootstrap-modeli) içindedir.

# 23. Teknik Kısıtlamalar ve Planlanan Uzantı Sınırları

Bu bölümdeki uzantılar mevcut sürüm davranışı veya yayın taahhüdü değildir.
Roadmap'teki anlamlı teknik sınırları, çekirdekle çelişmemesi için korur.

## 23.1 Device Capability, Aural ve Spoken Recall

Session oluşturulmadan önce istemci desteklediği mastery boyutlarını bildirir.
Server bunu yalnızca plan için kullanır; soru/cevap kuralları yine server
domain'indedir. Desteklenmeyen boyut planlanmaz, mastery sonucu yazmaz,
Correct/Wrong/Review üretmez; session toplamı yalnızca planlanan sorulardır.

Kullanıcı desteklenmeyen boyutu özellikle seçerse sessiz fallback yapılmaz,
açık desteklenmiyor durumu gösterilir. Session sırasında destek kaybı için
lifecycle örneği:

```text
Pending
Answered
SkippedUnsupported
```

Kesin enum implementation'da seçilir. Başlangıçtaki `PlannedQuestions` sabittir;
`Answered + SkippedUnsupported` tamamlanan plan öğeleridir. Örneğin 20 soruda
18 cevap + 2 teknik atlama session'ı tamamlar. Teknik atlama doğru/yanlış/
review/mastery sayılarında yer almaz, sonuç ekranında ayrı bilgi olabilir.

`AuralRecognition`de İngilizce kelime yazılı görünmez, ses tekrar oynatılabilir
ve English voice kullanılır. Browser `SpeechSynthesis` ilk yaklaşım olabilir;
ileride hazırlanmış audio/harici TTS kullanılabilir. Domain sağlayıcıya bağımlı
değildir.

`SpokenRecall` izin ister, kısa recording alır, İngilizce STT çalıştırır, metni
normalize eder, beklenen cevapla karşılaştırır ve normal answer pipeline'ına
verir. Mikrofon reddi, browser desteği, network/speech service hatası Learn'i
kilitlemez. STT'nin browser/device'ta mı API üzerinden harici sağlayıcıda mı
çalışacağı, buna bağlı gizlilik metni/retention ile implementation öncesi
karar gerektirir.

## 23.2 Yönetici ve İçerik Kalitesi

İçerik bildirimi `ContentReport` veya `QuestionIssue` gibi ayrı domain olur.
En az `WordId`, ilgili `PracticeSessionWord`/snapshot, bildiren kullanıcı,
neden, açıklama, durum, oluşturulma/çözülme zamanı ve çözüm notunu taşır.

Gelecek admin word management için korumalı create/update endpoint, server-side
validation, sabit `Word.Id`, optimistic concurrency (örneğin `RowVersion`) ve
audit geçmişi gerekir. Yönetilebilir alanlar English, Turkish translations,
part of speech, verb metadata, CEFR level, topic, curriculum placement ve
ileride audio referansıdır. Admin authorization/audit edit UI'dan önce gelir.

## 23.3 Placement Assessment

Vocabulary placement assessment normal Learn/Practice'ten rastgele soru
seçmek değildir; ayrı seçim/puanlama, level dağılımı ve kontrollü soru örneklemi
ister. `SessionPurpose.Assessment` veya ayrı aggregate değerlendirilebilir.
Mastery modelinin kararlı, curriculum sırasının ve level içeriğinin yeterince
düzenli olması bağımlılıktır. Sonuç genel CEFR değil tahmini vocabulary
başlangıç seviyesidir.

## 23.4 Puan ve Motivasyon

Learn/Review/mastery/spaced repetition kararlı olmadan puan eklenmez. Tek
mutable `User.Score += 10` yerine append-only, kural sürümünü taşıyan
`ScoreEvent(UserId, Reason, Amount, RuleVersion, CreatedAt)` tercih edilir.
Doğru recall, düzenli Review, Learn session tamamlaması ve tutarlı günlük
çalışma ödüllendirilebilir. Aşırı hız bonusu, sert yanlış cezası, kolay soruya
yöneltme ve `SkippedUnsupported` için puan üretilmez.

## 23.5 Sosyal Çalışma ve Rekabet

Arkadaşlık/canlı rekabet küçük Practice uzantısı değildir. Ayrı domain;
arkadaşlık/davet, gizlilik, engelleme, match/room, katılımcı,
server-authoritative zaman, SignalR benzeri realtime, idempotent cevap,
disconnect/reconnect ve moderasyon gerekir. Normal `PracticeSession` doğrudan
multiplayer match'e dönüştürülmez. Tek kullanıcılı çekirdeğin değeri
kanıtlanmadan bu yatırım yapılmaz.

## 23.6 Daha Zengin İçerik ve Pronunciation

Hazırlanmış ses, örnek cümle, görsel, kullanım bağlamı, pronunciation ve yeni
topic/curriculum düzenleri değerlendirilebilir; dört mastery boyutu gereksizce
çoğaltılmaz. Context comprehension ölçen boşluk doldurma yalnızca
`WrittenRecall` UI varyasyonu sayılmaz; ürün amacı ayrı değerlendirilir.

Görseller animal/food/object/place gibi somut kelimelerde yararlıdır ama
`although`, `perhaps`, `improve`, `depend` gibi soyut kelimelerde zorunlu
temsil olmaz. İlk SpokenRecall'in “anlaşılır doğru kelime” sınırı pronunciation
score, phoneme/stress/feedback ile geriye dönük değişmez. Ham ses arşivi ancak
açık kullanıcı bilgisi, yeni ürün kararı ve retention politikasıyla oluşabilir.

## 23.7 Yeni Özellik Kontrol Listesi

Yeni özellik planlanırken şu sorular cevaplanır:

1. Hangi kullanıcı problemini çözer?
2. Hangi `VocabularyMasteryDimension` ile ilişkilidir; yeni boyut gerekli mi?
3. Mevcut boyutun yalnızca farklı sunumu mu?
4. Learn, Review, Practice'ten hangisine aittir; kullanıcı mı sistem mi seçer?
5. Curriculum progression, mastery strength veya review schedule etkilenir mi?
6. Question lifecycle ile learning outcome karışıyor mu?
7. Category/CEFR metadata'sı veya session snapshot anlamı değişiyor mu?
8. Başka cihazda kalıcılık, authorization, hassas izin veya üçüncü taraf veri
   aktarımı gerekir mi?
9. Retention tanımlı mı, mevcut domain kavramını yineliyor mu?
10. Öğrenme değeri doğrulanmadan dekoratif karmaşıklık ekliyor mu?

Doğru sistem eşleştirmesi: yanlış çalışmak Review selection + mastery outcome;
cevabı gösterilen içeriği tekrar çalışmak `AnswerAction`/`ReviewReason` +
Review; bilineni isteğe bağlı tekrar Practice veya normal Review scheduling;
kategori/mastery seçimi Practice filtresi; dinleme `AuralRecognition`,
`QuestionFormat.Listening` değil; konuşma basit microphone butonu değil,
capability + STT içeren `SpokenRecall`; teknik hata `SkippedUnsupported`;
pronunciation ayrı değerlendirme; puan sürümlenmiş `ScoreEvent`; admin
düzenleme API authorization + audit + concurrency ile çözülür.

# 24. Bilinen Sorunlar ve Teknik Borç

- `Data/WordMatch.csv` için mevcut import/bootstrap uygulaması yoktur.
- Kaynak belgelerdeki Swagger URL'si güncel `Program.cs` Swagger middleware'i
  eşlemediğinden çalışır durum olarak belgelenemez.
- Mevcut `UserWordProgress` ve `/api/words/` tek outcome görünümü hedef dört
  mastery boyutunu temsil etmez.
- Curriculum, `UserWordMastery`, due Review, device capability,
  `SkippedUnsupported`, Aural ve Spoken Recall kaynak kodda henüz yoktur.
- Metrics, tracing, ayrı cache ve otomatik rollback prosedürü tanımlı değildir.

# 25. Değişiklik Rehberi

- Kelime metadata'sını değiştirmeden önce `WordConfiguration` constraint'leri,
  `Word.Id` ilişkileri, `PracticeQuestionFactory` ve snapshot etkisini inceleyin.
- Direction/format eklemek API enum/constraint, plan/factory, request-response,
  frontend Zod/UI, progress key ve testleri birlikte değiştirir.
- Session davranışı active unique index, conditional answer update, progress
  upsert, replay/result sorguları ve 409 recovery ile birlikte değerlendirilir.
- Şema değişiminde yeni migration yazın; production migration, Docker release
  ve gerekli bootstrap sırasını açıkça planlayın.
- Mastery değişiminde curriculum, mastery strength, review zamanı ve teknik
  question lifecycle ayrı tutulur.

# 26. Kritik Senaryolar

## 26.1 Aynı Oturumu İki Yerden Cevaplama

İki istek aynı pending soruyu cevaplarsa koşullu update yalnızca birini
başarılı yapar. Diğeri 409 alır ve istemci server session'ını yeniden yükler;
progress çift artmaz.

## 26.2 Kelime İçeriği Sonradan Düzeltilir

Yeni session güncel kelimeyi kullanır. Eski session/sonuç
`PracticeSessionWord` snapshot'ını kullandığı için geçmiş sonuç değişmez.

## 26.3 Dört Farklı Seçenek Bulunamaz

Factory yakın kapsamları dener, yine üç valid distractor bulamazsa validation
hatası üretir. İçerik verisi düzeltilir; tekrar eden/yanlış seçenekle soru
üretilmez.

## 26.4 Planlanan Cihaz Desteği Session Ortasında Kaybolur

Mikrofon izni geri çekilir veya STT/TTS erişilemezse soru öğrenme hatası
sayılmaz. `SkippedUnsupported` olur; session ilerler ama mastery/review değişmez.

# 27. Operasyon ve Sorun Giderme

| Belirti                      | Kontrol                                                                           |
| ---------------------------- | --------------------------------------------------------------------------------- |
| API başlamıyor               | `ConnectionStrings:DefaultConnection`; production'da `DataProtection__KeyPath`    |
| Practice'te kelime yok       | Migration yanında `Words` verisini doğrulayın; CSV için otomatik importer yoktur. |
| Şema yeni ama uygulama eski  | Migration testten sonra açıkça uygulanmış mı; Compose auto-migrate kapalı mı?     |
| Dış hostname açılmıyor       | Önce `/health`, sonra Nginx host portu, son olarak Tunnel/DNS routing.            |
| Production login düşüyor     | `wordmatch-data-protection` volume ve key path korunuyor mu?                      |
| Tunnel loopback'e erişemiyor | Gerekirse web bind `0.0.0.0`; port ağ seviyesinde korunuyor mu?                   |

# 28. Varsayımlar ve Açık Kararlar

- Hedef clean reset'in zamanı, gerçek kullanıcı verisi migration gereksinimi ve
  `InitialCreate`in kesin içeriği uygulanmış karar değildir.
- Curriculum source formatı CSV, JSON veya başka version-controlled biçim
  olabilir; kesin format seçilmemiştir.
- Learn completion eşiği, mastery strength enum/puanı, unit cursor modeli ve
  spaced-repetition aralıkları implementation'da kesinleşir.
- STT çalışma yeri, sağlayıcı, gizlilik metni ve retention davranışı
  implementation öncesi zorunlu karardır.

# 29. Projeyi Anlamak İçin Okuma Sırası

1. [README.md](README.md)
2. Bu belgenin Genel Bakış, Veri Modeli ve Veri Akışı bölümleri
3. `Program.cs`, `PracticeSessionService.cs`, `PracticeQuestionFactory.cs`
4. Webde `src/main.tsx`, `src/features/practice`, `src/features/auth`
5. Aktif çalışma için [PLAN.md](PLAN.md), uzun vadeli yön için [ROADMAP.md](ROADMAP.md)

# 30. AI İçin Bağlam

Değişiklik önerirken çalışan Practice modelini hedef mastery mimarisinden ayırın.
Küçük, ürün tarafından gerekçelendirilmiş tasarımlar tercih edin: ihtiyaç yoksa
yeni repository, genel retry, write endpoint, DTO veya seed altyapısı eklemeyin.
Session snapshot, user scope, database constraint, XSRF ve migration geçmişini
etkileyen değişiklikte ilgili test/deployment etkisini inceleyin.

# 31. Güncelleme Kuralı

Davranış, domain, veri modeli, endpoint, config, deployment veya güvenlik
değiştiğinde bu belge aynı değişiklikte güncellenir. Planlanan özellik
uygulandığında buradaki “planlanan” açıklama çalışan sistem gerçeğine taşınır;
sıradaki işler [PLAN.md](PLAN.md) veya [ROADMAP.md](ROADMAP.md) içinde
güncellenir. Sürüm geçmişi yalnızca doğrulanmış release olduğunda
[CHANGELOG.md](CHANGELOG.md) dosyasına eklenir.
