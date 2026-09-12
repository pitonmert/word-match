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
- Gelecekte yapılması planlanan işler ve geliştirme öncelikleri → ROADMAP.md
- Sürüm bazlı değişiklik geçmişi → CHANGELOG.md
- Lisans hükümleri → LICENSE

KURAL:
Bu belge kaynak kodun satır satır açıklaması veya TODO listesi değildir.
Koddan kolayca görülebilen ayrıntılar yerine ilişkileri, sınırları, kuralları,
nedenleri ve kolayca kaybolabilecek teknik bağlamı belgeleyin. Gelecek planları
bu belgenin dışında, yalnızca ROADMAP.md'de tutulur.
-->

# Word Match Mimarisi

Bu belge çalışan sistemin teknik yapısını tek kanonik kaynakta açıklar. Kaynak
kodda olmayan özellik, karar veya iyileştirme burada yer almaz.

## İlgili Belgeler

- [README.md](README.md) — hızlı başlangıç, kurulum ve günlük geliştirme
- [ROADMAP.md](ROADMAP.md) — uygulanmamış ürün ve teknik işler
- [CHANGELOG.md](CHANGELOG.md) — doğrulanmış sürüm değişiklikleri
- [LICENSE](LICENSE) — kullanım ve dağıtım lisansı

# 1. Genel Bakış

## 1.1 Projenin Amacı

Word Match, Türkçe konuşan kullanıcıların İngilizce kelime haznesini düzenli
çalışmayla geliştirmesi için hazırlanmış bir web uygulamasıdır. Sistem
cevapları, soru bağlamını, mastery durumunu ve konu ilerlemesini kalıcı olarak
saklar.

Çalışan ürünün tek öğrenme akışı Study'dir ve başlangıçta hiçbir çalışma türü,
beceri veya yol seçimi yoktur. Sistem varsayılan olarak kullanıcının curriculum
sırasındaki güncel konusunu açar; kullanıcı isterse konuyu değiştirebilir. Yeni
içerik, tekrar ve soru türü dengesi Study domain'i içinde kalır.

```text
Ana ekran (/)
 └─ Devam et → varsa etkin oturumu sürdür, yoksa sıradaki uygun konuyu başlat
     │                                                └─ sıradaki öğrenme grubu: seçmeli tur, sonra yazılı tur
     ├─ Konu değiştir → Level/Topic seçim yüzeyi → etkin çalışma varsa açık onay
     └─ Pekiştir → isteğe bağlı, en fazla 10 soruluk konular arası oturum

Soru ekranında: "Şimdi yazamam" → oturum sonuçlanır; yeni oturum planı o beceriyi geçici olarak içermez

Navbar → Kelimeler (/words) → Salt okunur katalog
```

## 1.2 Temel Kullanım Senaryoları

Kullanıcı:

- Hesap oluşturur, giriş yapar ve kalıcı cookie ile oturumunu sürdürür.
- Ana sayfada tek bir `Devam et` eylemini görür; sunucu varsa etkin oturumu
  sürdürür, yoksa çalışılabilir sıradaki konuyu başlatır. Kullanıcı çalışma
  türü veya beceri seçmez.
- `Konu değiştir` ile ayrı bir seçim yüzeyinden başka bir level/topic seçebilir.
  Bu ayrı bir mod yaratmaz; ancak başka bir çalışma etkinse önce açıkça onaylar.
- Çoktan seçmeli veya yazılı soruyu cevaplar ya da “bilmiyorum” sonucunu seçer.
  Her soruda kelimenin yeni mi tekrar mı olduğunu görür.
- Uygun olmayan yazma sorularını 10 dakika erteler; bu bir cevap değildir ve
  mastery'yi etkilemez.
- Konunun tüm kelimelerinde iki yazılı yönü de yanıtlandığında konu tamamlandı bilgisini görür ve
  isterse ayrı bir tekrar oturumu başlatır.
- Kelime kataloğunu salt okunur görüntüler. Üst çubuktaki Word Match markası
  kullanıcıyı ana sayfaya döndürür.

## 1.3 Mevcut Kapsam

- Kelime, soru ve kullanıcı ilerlemesi için kalıcı ve doğrulanabilir bir domain
  modeli sağlamak.
- Kullanıcıya gösterilen soru içeriğinin anlamını snapshot ile korumak.
- Türkçeyi İngilizce kelimenin anlamını açıklayan yardımcı dil olarak
  kullanmak; genel dil yeterliliği iddiasında bulunmamak.
- Kelime bilgisini dört mastery boyutunda izlemek; curriculum, review schedule
  ve dengeli soru türlerini tek Study planında birleştirmek.

## 1.4 Kapsam Sınırları

- Uygulamanın curriculum'unu tamamlamak, kullanıcının genel CEFR İngilizce
  seviyesini kanıtlamaz.
- `WrittenRecognition`, `AuralRecognition`, `WrittenRecall` ve
  `SpokenRecall` genel Reading, Listening, Writing ve Speaking yeterlilikleri
  değildir.

## 1.5 Temel Kavramlar

| Kavram                       | Anlamı                                                                                  |
| ---------------------------- | --------------------------------------------------------------------------------------- |
| `Word`                       | İngilizce kelime, Türkçe çevirileri ve kelime metadata'sı.                              |
| `Level`                      | Kelimenin vocabulary curriculum içindeki seviyesi; bugün kaynak kodda `A1`–`B2` vardır. |
| `Topic`                      | Kelimenin anlamsal kategorisi ve curriculum'un görünür öğrenme birimi.                  |
| `CurriculumTopic`            | Bir `(Level, Topic)` çifti, level içindeki açık sırası ve `Active`/`Retired` durumu.    |
| `Review`                     | Cevabı bilmeme/gösterme sonucu; ayrı bir Review ürün akışı değildir.                    |
| `VocabularyMasteryDimension` | Kelime bilgisinin dört bilinçli egzersiz biçimi; başlangıç ekranında seçilmez.          |
| `StudySessionMode`           | `Topic` konu oturumu veya `Review` tekrar oturumu.                                      |
| Beceri ertelemesi            | Bir soru türünün 10 dakika boyunca planlanmaması; cevap veya sonuç değildir.            |
| `LearningGroupSortOrder`     | Konu içindeki açık, pedagojik öğrenme grubunun sırası.                                  |
| `StudySession`               | Bir konu grubunu veya en fazla 10 soruluk pekiştirmeyi taşıyan sonlu oturum.            |
| `StudySessionQuestion`       | Bir oturumdaki tek soru plan öğesi ve cevap snapshot'ı.                                 |
| `UserWordMastery`            | `UserId + WordId + VocabularyMasteryDimension` için aşama, sayaçlar ve sonraki tekrar.  |
| `UserWordIntroduction`       | `UserId + WordId` için ilk karşılaşma zamanı; akıştan bağımsız ve tek kayıttır.         |
| Curriculum                   | Study için açık `Level → sıralı Topic → öğrenme grubu → sıralı Word` sırası.            |

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
çalınır.

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
  isterse çalışmasını konu veya seviyeye göre daraltır.
- **Tarayıcı istemcisi:** Oturum cookie'sini taşır, durum değiştiren
  isteklerde antiforgery token gönderir ve 409 yarış durumunda oturumu yeniden
  yükler.
- **Uygulama operatörü:** Connection string, deployment ortamı, migration ve
  Docker/Cloudflare yapılandırmasını açıkça yönetir.

## 3.3 Harici Sistemler

| Sistem                  | Mevcut kullanım                                            | Arıza davranışı                                                        |
| ----------------------- | ---------------------------------------------------------- | ---------------------------------------------------------------------- |
| PostgreSQL              | Kalıcı veri deposu                                         | API connection string olmadan başlamaz; `/health` bağlantıyı denetler. |
| Cloudflare Tunnel       | Production HTTPS hostname'ini Nginx origin'ine yönlendirir | Tunnel/yönlendirme yoksa dış erişim olmaz.                             |
| Tarayıcı audio API'leri | Feedback WAV sesleri                                       | Oynatma hatası sessizce yutulur; öğrenme sonucu değişmez.              |

# 4. Repository Yapısı

```text
.
├── .github/workflows/ci.yml           # GitHub Actions doğrulama hattı
├── WordMatch.API/                     # ASP.NET Core API
│   ├── Content/                        # Words.csv
│   ├── Data/                          # DbContext, EF configuration ve migrations
│   └── Features/                      # Auth, Study ve Words feature slice'ları
├── WordMatch.API.Tests/               # API/integration testleri
├── WordMatch.Web/                     # React istemcisi
│   ├── public/sounds/                 # Mevcut feedback sesleri
│   └── src/features/                  # auth, study, question-session ve words
├── docker-compose.yml                 # Production topology
└── .env.example                       # Secret içermeyen environment şablonu
```

## 4.1 Önemli Dizinler

| Dizin                                | Sorumluluk                                              |
| ------------------------------------ | ------------------------------------------------------- |
| `WordMatch.API/Features/Auth`        | Kayıt, giriş, çıkış, session ve antiforgery             |
| `WordMatch.API/Features/Study`       | Curriculum bootstrap, planner, mastery, session ve API  |
| `WordMatch.API/Features/Words`       | `Word` domain'i, soru üretimi, bootstrap ve katalog     |
| `WordMatch.API/Data`                 | `ApplicationDbContext`, mapping ve EF migration zinciri |
| `WordMatch.Web/src/features`         | İstemci feature'ları ve feature'a yakın testler         |
| `WordMatch.API.Tests/Infrastructure` | PostgreSQL Testcontainer kullanan API factory           |

## 4.2 Önemli Dosyalar

| Dosya                        | Sorumluluk                                                               |
| ---------------------------- | ------------------------------------------------------------------------ |
| `WordMatch.API/Program.cs`   | DI, middleware, config kontrolleri, endpoint eşleme ve health endpoint'i |
| `ApplicationDbContext.cs`    | EF Core modelinin giriş noktası                                          |
| `StudyService.cs`            | Study oturumu, cevap transaction'ı, mastery ve konu ilerlemesi           |
| `StudyPlanner.cs`            | Due, yeni ve zayıf öğelerden 10 benzersiz soru seçimi                    |
| `QuestionFactory.cs`         | Snapshot, normalize cevap karşılaştırması ve seçenek üretimi             |
| `StudyQuestionFactory.cs`    | Mastery boyutundan Study sorusuna dönüşüm                                |
| `WordMatch.Web/src/main.tsx` | İstemci provider'ları, auth gate ve route'lar                            |
| `docker-compose.yml`         | API ve Nginx web container topolojisi                                    |

# 5. Mimari

## 5.1 Mimari Yaklaşım

API feature tabanlı bir modüler monolittir. Her feature endpoint, sözleşme,
service ve domain tiplerini kendi altında tutar; persistence için doğrudan
`ApplicationDbContext` kullanır. Ayrı repository veya Unit of Work katmanı
yoktur.

İstemci `auth`, `study`, `question-session` ve `words` feature'larına ayrılır. Ortak UI, API
istemcisi ve görüntü etiketleri `src/components` ile `src/lib` altında kalır.

## 5.2 Mimari İlkeler

- Feature'lar public HTTP sözleşmeleri üzerinden kullanılır; frontend response'u
  Zod ile doğrular.
- Oturum sorusu, kelime sonradan değişse bile geçmiş cevabın anlamını koruyan
  snapshot tutar.
- Enum değerleri PostgreSQL'de string saklanır ve check constraint'lerle
  korunur.
- Kullanıcının başka kullanıcının oturumuna, mastery veya konu ilerlemesine
  erişmesi endpoint ve sorgu seviyesinde `UserId` ile engellenir.
- Migration production startup'ında varsayılan olarak çalışmaz.
- Bootstrap, database-generated ilişkisel kimlik yerine version-controlled
  değişmez content identity (`ImportKey`, `(Level, Topic)`) kullanır.

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
  ├── StudyHomePage ──────────────► /api/study
  ├── StudySessionPage ───────────► /api/study-sessions
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
Study planner/factory/service ile Word katalog ve bootstrap servisleri
kaydedilir; feature extension method'ları endpoint gruplarını eşler.
`GET /health` veritabanı bağlantısını kontrol eder.

## 6.3 Web İstemcisi

`main.tsx`, `ThemeProvider`, `QueryClientProvider`, `AuthProvider` ve
`BrowserRouter` kurar. Kimliği doğrulanmamış kullanıcı yalnızca `AuthPage`e
gider. Kimliği doğrulanan kullanıcı için `/` Study ana ekranı,
`/session/:sessionId` ve `/words` yüklenir; route seviyesinde lazy loading
kullanılır. Navbar yalnız Word Match ana sayfa
bağlantısını ve hesap menüsünü taşır.

## 6.4 PostgreSQL ve Production Web Katmanı

PostgreSQL Identity tablolarını, kelime içeriğini, session snapshot'larını ve
progress satırlarını tutar. Nginx Vite artifact'lerini sunar; `/assets/` için
uzun ömürlü immutable cache, `index.html` ve SPA fallback için `no-cache`
kullanır. Yalnız güvenilir Docker Tunnel peer'ından gelen Cloudflare
`CF-Connecting-IP` header'ını istemci IP'si olarak kabul eder; auth uçları için
ayrıca Nginx seviyesinde IP tabanlı limit uygular.

# 7. Modüller

## 7.1 Modül Haritası

| Modül                | Sorumluluk                                    | Bağımlı olduğu modüller           |
| -------------------- | --------------------------------------------- | --------------------------------- |
| Auth                 | Identity, cookie oturumu ve XSRF              | `ApplicationDbContext`            |
| Words                | Kelime domain'i, soru üretimi ve katalog      | DbContext                         |
| Study/Bootstrap      | Açık curriculum kaynağını doğrular ve yükler  | Words, Study domain, DbContext    |
| Study/Sessions       | Planner, oturum, mastery ve konu ilerlemesi   | Questions, Words, Auth, DbContext |
| Data                 | EF mapping/migrations                         | Auth, Study, Words domain         |
| Web/auth             | Session yükleme ve login/register             | `/api/auth`                       |
| Web/study            | Konu ana ekranı, soru ve oturum özeti         | study API                         |
| Web/question-session | Saf kart, soru, feedback, sonuç ve ses sunumu | Study sunumu                      |
| Web/words            | Filtrelenebilir salt okunur katalog           | `/api/words`                      |

## 7.2 Auth, Study ve Words

`AuthEndpoints`; antiforgery token, session, kayıt, giriş ve çıkış sağlar.
E-posta/kullanıcı adı doğrulanır; Identity parolası en az sekiz karakter,
büyük harf, küçük harf ve rakam ister. Kayıt ve giriş IP tabanlı rate limit'e,
durum değiştiren auth uçları antiforgery filter'a tabidir.

`StudyService` kullanıcı başına tek aktif Study oturumunu, server-authoritative
cevap değerlendirmesini, `UserWordMastery` güncellemesini ve curriculum
ilerlemesini sahiplenir. `StudyPlanner` konu oturumunda ilk eksik öğrenme
grubunun iki yazılı turunu, pekiştirmede ise yalnız due mastery kayıtlarını
planlar. `StudyQuestionFactory` soru üretimini
`Features/Words/Questions` altındaki ortak `QuestionFactory` üzerinden yapar;
normalizasyon, kabul edilen cevaplar ve seçenek üretimi orada tanımlıdır.

`WordCatalogService` tüm kelimeleri ID sırasıyla döndürür. Katalog kullanıcıdan
bağımsızdır ve ilerleme taşımaz; mastery görünürlüğü ayrı bir iştir.

# 8. Bağımlılıklar

## 8.1 İç Bağımlılıklar

Study `Word` verisini soru için, `ApplicationUser` kimliğini sahiplik için
kullanır. `StudySessionQuestion` hem `StudySession`a hem `Word`e;
`UserWordMastery` ve `UserWordIntroduction` kullanıcıya bağlıdır. Silme
davranışları session/kullanıcı için cascade, `Word` ve `CurriculumTopic` için
restrict'tir.

## 8.2 Dış Bağımlılıklar

- ASP.NET Core Identity, EF Core/Npgsql ve PostgreSQL çalışan uygulama için
  zorunludur.
- Docker Compose ve Cloudflare Tunnel yalnızca belirtilen production topology
  için gereklidir.
- Güncel sistemin TTS/STT sağlayıcı bağımlılığı yoktur.

## 8.3 Bağımlılık Kuralları

- API progress veya doğru cevap kararını frontend'den kabul etmez; server
  snapshot ve domain kuralını kullanır.
- `ImportKey` ve `(Level, Topic)` bootstrap identity'sidir; runtime foreign
  key yerine database-generated `Word.Id`/`CurriculumTopic.Id` kullanır.
- Yeni ses sağlayıcısı mastery domain'ini sağlayıcı tipine bağlamaz.

# 9. Veri Modeli

## 9.1 Temel Varlıklar

| Varlık                 | Sahip olduğu bilgi                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------ |
| `ApplicationUser`      | ASP.NET Core Identity kullanıcısı                                                    |
| `Word`                 | `English`, `TurkishTranslations`, part of speech, fiil metadata'sı, `Level`, `Topic` |
| `CurriculumTopic`      | `(Level, Topic)`, level içindeki sıra ve `Active`/`Retired` durumu                   |
| `CurriculumTopicWord`  | Konudaki kelime üyeliği ve açık sıra                                                 |
| `UserWordIntroduction` | Kullanıcı/kelime için ilk karşılaşma zamanı                                          |
| `UserWordMastery`      | Kullanıcı/kelime/boyut için aşama, sonuç sayaçları ve sonraki tekrar                 |
| `StudySession`         | Kullanıcı, mod, isteğe bağlı konu, durum ve zamanlar                                 |
| `UserStudySkillPause`  | Kullanıcı/boyut için geçici ertelemenin bitiş zamanı                                 |
| `StudySessionQuestion` | Soru/cevap snapshot'ı, boyut, tanıtım işareti ve sonuç                               |

`Word` için `English + PartOfSpeech` benzersizdir. Türkçe çeviriler PostgreSQL
`text[]` olarak tutulur; boş/null çeviri kabul edilmez. Fiil geçmiş zaman
alanları part of speech ile tutarlı olmalıdır. Level, topic, mod, durum ve
outcome değerleri check constraint'lerle sınırlandırılır.

`CurriculumTopic` içinde `(Level, Topic)` ve `(Level, SortOrder)` benzersizdir;
bir kelime `CurriculumTopicWords.WordId` unique index'i sayesinde yalnız bir
level ve topic altında bulunur. `StudySession` bir `StudySessionMode` taşır:
`Topic` oturumunda `CurriculumTopicId` doludur, `Review` oturumunda NULL'dır ve
bu check constraint ile korunur. `UserStudySkillPause`, kullanıcı ve boyut
anahtarıyla geçici ertelemenin bitiş zamanını tutar.

## 9.2 Varlık İlişkileri

```text
ApplicationUser 1 ── * StudySession 1 ── * StudySessionQuestion * ── 1 Word
       │                                      │
       ├── * UserWordMastery * ───────────────┘
       └── * UserWordIntroduction * ──────────┘

CurriculumTopic 1 ── * CurriculumTopicWord * ── 1 Word
       │
       └── 0..1 StudySession (yalnız Topic modunda)
```

Bir soru satırının primary key'i `StudySessionId + Position`dır.
Kullanıcı başına yalnız bir `Active` oturum vardır; unique partial index bu
kuralı eşzamanlı başlatmada da korur. Study sorusunda
aynı `WordId` bir oturumda yalnız bir kez bulunur. Mastery kimliği
`UserId + WordId + VocabularyMasteryDimension`dır.

## 9.3 Veri Sahipliği ve Snapshot

`StudySessionQuestion`; `EnglishSnapshot`, `PromptSnapshot`,
`CorrectAnswerSnapshot`, yazılı cevap için kabul edilen cevapları ve çoktan
seçmeli `Options`/`CorrectIndex` değerlerini oturum kurulurken saklar.

Bu nedenle kelime sonradan düzeltilse de geçmiş oturumun hangi soruyu
gösterdiği ve doğru cevabı değişmez.

## 9.4 Mevcut Veri Yaşam Döngüsü

1. Migration şemayı oluşturur.
2. Kelime ve curriculum bootstrap komutları içeriği yükler.
3. Study planner oturumu kurar; soru planı ve içerik snapshot'ı kaydedilir.
4. Cevap transaction ile bir kez işlenir; mastery upsert edilir ve ilk
   karşılaşmada global `UserWordIntroduction` yazılır. Konu ilerlemesi bu
   kaydın curriculum üyeliğiyle eşleştirilmesinden türetilir.

`WordMatch.API/Content/Words.csv` version-controlled içerik kaynağıdır. Boş
veritabanında migration tek başına uygulamayı kullanılabilir yapmaz; ardından
bootstrap komutu çalıştırılır.

## 9.5 Migration ve Bootstrap Modeli

Migration zinciri iki kez bilinçli olarak tek bir `InitialCreate`e indirildi:
önce Practice → Study geçişinde, sonra paket curriculum'u `Level → sıralı Topic`
omurgasıyla değiştirirken. İkincisinde `CurriculumUnits`/`CurriculumUnitWords`
tabloları, `StudySessions.Path`/`Focus` kolonları ve
`UserWordIntroductions.Path` tamamen kalktığı için artımlı geçmiş yerine hedef
şema doğrudan üretildi. Her iki resette de korunacak gerçek kullanıcı verisi
yoktu.

- Aynı temiz test veritabanı bir kez düşürülüp yeniden kuruldu; eski kullanıcı,
  oturum geçmişi ve progress taşınmadı. Kullanıcı yeniden kaydolur.
- Reset uygulandığı anda gerçek kullanıcı verisi yoktu; sistem yalnızca
  Cloudflare Access arkasındaki test hesaplarına açıktı.
- Bundan sonraki şema değişiklikleri `InitialCreate` üstüne normal migration
  olarak eklenir. Uygulanmış migration geriye dönük değiştirilmez.

Bootstrap, `Words`, `CurriculumTopics` ve `CurriculumTopicWords` oluşturmadan
ortamı kullanıma açmaz. `Words.csv`'nin her satırı bir kelimeyi **ve** onun
curriculum yerleşimini aynı anda taşır — kelime içeriği ile curriculum üyeliği
ayrı dosyalarda değildir, çünkü bir kelime konusuz var olamaz:

```text
ImportKey, English, TurkishTranslations, PartOfSpeech, PastSimple,
PastParticiple, IsIrregular, Level, Topic,
TopicSortOrder, WordSortOrder, LearningGroupSortOrder
```

`ImportKey` her kelime için değişmez, database-generated `Word.Id`,
düzenlenebilir English/çeviri/metadata'dan türetilmez; unique index ile
korunur ve foreign key değildir. Bir konunun doğal anahtarı `(Level, Topic)`
olduğu için ayrı bir key kolonu yoktur ve görünür bir başlık saklanmaz;
arayüz başlığı `A1 · Hayvanlar` biçiminde level ve topic'ten üretilir.

`TopicSortOrder` konunun **kendi level'ı içindeki** sırasıdır ve aynı
`(Level, Topic)` grubunun tüm satırlarında aynı olmalıdır; her level için
boşluksuz `1..N` olur. `WordSortOrder` kelimenin konu içindeki sırasıdır ve
boşluksuz `1..M` olur. `LearningGroupSortOrder` konu içindeki pedagojik
grubun açık sırasıdır; kullanılan grup numaraları boşluksuz `1..G` olmalıdır.
Bir grubun büyüklüğü sabit değildir: örneğin Günler tek 7 kelimelik gruptur.
**Curriculum sırası açık veridir**: ne `WordTopic`
enum'ının deklarasyon sırasından, ne konu adından, ne de rastgele bir
sıralamadan runtime'da üretilir.

Kaynak mevcut 700 kelimeyi 66 `(Level, Topic)` konusuna bağlar: A1'de 27, A2'de
20, B1'de 14, B2'de 5 konu. Konu boyutu sınırlı değildir; içerik dengesi ayrı
bir küratörlük işidir. Bootstrap idempotenttir: aynı input duplicate
kayıt/ilişki/ID değişimi üretmez. Kelime içeriği, konu sırası ve kelimenin
konu üyeliği/sırası **her zaman** serbestçe düzeltilebilir — bunların hiçbiri
kullanıcı ilerlemesi başladıktan sonra kilitlenmez, çünkü ilerleme
(`UserWordMastery`, `UserWordIntroduction`) tamamen `WordId` bazlıdır ve
curriculum üyeliğine referans taşımaz; "sıradaki konu" ve konu ilerlemesi her
istekte güncel üyelikten canlı hesaplanır (bkz. ADR-006). Bir kelimeyi bir
konudan diğerine taşımak, o kelimenin sicilini etkilemez.

Kaynaktan düşen bir konu silinmez, `Retired` işaretlenir ve kendi level'ının
aktif konularından sonraya park edilir. Retired konu ne "sıradaki konu" olur ne
de konu seçim listesinde görünür; kelime bağları, kullanıcı ilerlemesi ve eski
oturum snapshot'ları korunur.
Varsayılan işlem, kaynakta artık bulunmayan kaydı otomatik silmez; destructive
reconciliation ayrı, açık işlemdir. Hedef ortam sırası:

```text
1. Veritabanına güncel migration'ı uygula.
2. İçerik bootstrap importunu çalıştır.
3. API ve web yayınını kullanıma aç.
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

## 10.2 Çok Cihazlı Kullanım

Aynı kullanıcı birden fazla cihazdan eşzamanlı giriş yapabilir; telefon–bilgisayar
geçişi dil öğrenmede olağan bir davranıştır ve engellenmez. Çıkış yalnızca o
cihazın cookie'sini siler.

Teklik cihazda değil çalışma oturumundadır: bir kullanıcının aynı anda tek bir
`Active` Study oturumu olabilir ve bu, `StudySessions.UserId` üzerindeki filtreli
unique index ile veritabanı düzeyinde zorunludur. Oturumu başlatan tarayıcıya
ait rastgele cihaz kimliği `StudySessions.OwnerDeviceId` üzerinde saklanır.
Başka bir cihaz `GET /api/study` çağrısında çalışmanın kullanılamadığını görür;
aynı oturuma katılamaz, yeni oturum başlatamaz veya soru/cevap uçlarını çağıramaz.

Bir oturum sonuçlandığında, sonuç ekranındaki `Devam et` eylemi de aynı cihaz
kimliği için geçici olarak saklanır. Bu hak açıkken başka cihaz yeni çalışma
başlatamaz; sonuç sahibinin `Devam et` eylemi sıradaki çalışmayı açar. Sonuç
ekranındaki `Ana Sayfa` ile navbar'daki Word Match bağlantısı bu hakkı serbest
bırakır. Başka cihazdaki kullanıcı isterse açıkça `Bu cihazdan devam et`
eylemiyle sahipliği anında devralır; önceki cihaz sonraki isteğinde oturuma
erişemez.

Oturum oluşturan üç kod yolu da "aktif oturum var mı" okumasının ardından ekleme
yapar; iki cihaz bu okumayı aynı anda geçebilir. Kaybeden ekleme unique index'e
takılır, yakalanır ve kullanıcıya kazanan oturum `Resume` olarak döndürülür.

Cevaplama sunucu otoritesindedir: sunucu sıradaki soruyu kendisi belirler,
istemcinin gönderdiği `Position`/`WordId` ile eşleşmesini şart koşar ve yazmayı
transaction içinde `Outcome IS NULL` koşullu bir UPDATE ile yapar. İki cihaz aynı
soruyu cevaplarsa yalnızca biri yazar, diğeri 409 alır; istemci sessizce yeniden
yükleyip doğru soruya döner.

Cihazlar arası canlı senkronizasyon (polling, SSE, WebSocket) yoktur. İkinci
cihaz, diğerinin ilerlemesini kendi bir sonraki isteğinde fark eder.

## 10.3 Tek Study Akışı

Ürünün tek öğrenme akışı Study'dir ve başlangıç ekranı hiçbir çalışma türü,
beceri veya yol seçimi içermez. Sistem varsayılan olarak kullanıcının
curriculum sırasındaki güncel konusunu önerir; kullanıcı `Konu değiştir` ile
başka bir level/topic seçebilir. Bu seçim ayrı bir akış veya mod yaratmaz,
yalnız açılacak oturumun konusudur.

Oturum iki moddan biridir:

| Mod      | İçeriği                                                     | Sınır                    |
| -------- | ----------------------------------------------------------- | ------------------------ |
| `Topic`  | Seçilen konunun ilk tamamlanmamış öğrenme grubu             | Grubun doğal soru sayısı |
| `Review` | Vadesi gelmiş, daha önce yanıtlanmış kelime–beceri çiftleri | En fazla 10 soru         |

**Konu oturumuna başka topic'lerin tekrarları karışmaz.** Bir öğrenme grubu,
kelimelerinin tümünde önce `WrittenRecognition`, ardından aynı kelimelerde
karıştırılmış `WrittenRecall` turunu içerir. Bir kelime, iki yönü de en az bir
kez yanıtlanınca tamamlanır. Konunun tüm kelimeleri tamamlanınca konu tamamlanır;
kullanıcı ayrı bir pekiştirme oturumu başlatabilir. Pekiştirme yeni kelime veya
daha önce hiç yanıtlanmamış beceri yönü tanıtmaz.

`UserWordIntroduction`, ilk karşılaşma için tarihsel kayıt olmaya devam eder;
curriculum ilerlemesi ise iki yazılı `UserWordMastery` kaydından türetilir.
Kullanıcı bir konuyu erken tamamladığında ilerleme ortak kelime kaydına yazılır;
curriculum sırası o konuya ulaştığında aynı kelimeler yeniden yeni içerik olmaz.

`POST /api/study-sessions/continue` önce etkin oturumu döndürür; aktif oturum
yoksa sunucu geçici beceri kısıtlarını dikkate alarak çalışılabilir ilk konuyu
planlar. Konu değişimi ancak açık onayla önceki oturumu `Abandoned` yapabilir.
Distractor havuzu seçimden etkilenmez; seçenekler her zaman tüm katalog
üzerinden üretilir.

### Sıralı Konular

Study sonsuz feed değildir; görünür `CurriculumTopic` kilometre taşları kullanır:

```text
CurriculumTopic
- Id, Level, Topic, SortOrder, Status

CurriculumTopicWord
- CurriculumTopicId, WordId, SortOrder, LearningGroupSortOrder

UserWordIntroduction
- UserId, WordId, IntroducedAtUtc
```

Curriculum omurgası `Level → sıralı Topic → öğrenme grubu → sıralı Word`tur ve her sıra da
`Words.csv`'den gelen açık veridir (bkz. §9.5). "Sıradaki konu" saklanmaz;
`(Level, SortOrder)` sırasında hâlâ eksik yazılı yönü olan ilk `Active`
konudur. Tamamlanmış konular atlanır, kısmen tamamlanmış konu ilk eksik
öğrenme grubundan devam eder.

Bir konunun tamamlanma sayısı, o konuya bağlı kelimelerin iki yazılı mastery
boyutunu da taşımasından türetilir. Ayrı bir `Title` alanı yoktur; arayüz başlığı
`A1 · Hayvanlar` biçiminde level ve topic'ten üretilir.

Ana sayfadaki konu çubuğu iki katmanlıdır: iki yazılı yönü tamamlanan kelimeler
ana renk ile gösterilir; yalnız `WrittenRecognition` yönü yanıtlanan kelimeler
ana dolgunun arkasında daha soluk bir katman oluşturur. Bu ikinci katman konu
tamamlanması veya mastery gücü değildir; kullanıcının anlamını seçerek gördüğü
kelimeleri görünür kılar.

### Geçici Beceri Ertelemesi

Kullanıcı, o an uygun olmayan yazma sorularını 10 dakika erteler
(`Şimdi yazamam`). Erteleme
`POST /api/study-sessions/{id}/deferrals` ile kaydedilir ve şunları **yapmaz**:

- Yanlış, bilmiyorum veya review sonucu yazmaz
- `UserWordMastery` aşamasını, sayaçlarını veya `NextReviewAtUtc` değerini
  değiştirmez
- `UserWordIntroduction` oluşturmaz

Sunucu, cevaplanmamış soruları siler ve mevcut oturumu sonuçlandırır;
cevaplanmış snapshot'lara dokunulmaz. En az bir beceri açık kalmalıdır, aksi
hâlde istek 409 döner. Erteleme kullanıcıya bağlıdır; süre dolana kadar yalnız
**yeni** oturum planları bu boyutu içermez. Süre dolduğunda etkin bir oturum
yarıda kesilmez; sonraki oturum planlama anında curriculum'daki ilk eksik konu
yeniden seçilebilir.

### Ana Ekran ve Soru Kartı

Başlangıç ekranı sabit soru kartının içinde **değildir**; normal sayfa
düzeninde mevcut eylemi, konu ilerlemesini, `Devam et` ve `Konu değiştir`
eylemlerini gösterir. Uzun level/topic listesi ayrı bir dialog yüzeyinde açılır.

Soru çözme ekranı sabit soru kartı tasarımını kullanmaya devam eder: soru,
cevap alanı/seçenekler, geri bildirim ve ilerleme için odaklanmış tek yüzey.
Başlıkta konu ve yeni/tekrar rozeti, footer'da cevaplanan/toplam sayısı ile
doğru/bilmiyorum/yanlış sayaçları bulunur. Sayaçlar o ana kadarki sonuç
listelerini açar. Tamamlanma ekranı konu tamamlandıysa bunu başlıkta belirtir,
tekrar oturumu için bir eylem sunar ve üç sonuç sekmesini gösterir.

`ReviewQuestionCount`, pekiştirme oturumunun **şu anda** kaç soru içereceğidir:
yalnız vadesi gelmiş ve daha önce yanıtlanmış mastery kayıtları sayılır.

### Web Soru Oturumu Sunumu

Sunum parçaları `features/question-session` altında toplanır: saf kart kabuğu,
başlık, seçenek, yazılı cevap, ilerleme, sonuç tarayıcısı, erişilebilir duyuru
ve feedback sesi. `StudyQuestionCard` bu parçaları açıkça birleştirir; bütün
ürün davranışlarını boolean prop'larla yöneten tek bir dev bileşen yoktur.

Study'de seçmeli cevaplar `1–4` ile verilebilir. Doğru cevap, son soru değilse
yaklaşık 800 ms sonra otomatik ilerler; yanlış ve bilmiyorum cevaplarında
`Devam et` veya Enter gerekir. Son soru her durumda `Sonuçları gör` eylemini
bekler. Doğruluk ve doğru cevap yalnızca Study answer response'undan gelir.
Ses tercihi tarayıcıda saklanır; doğru, yanlış ve cevabı göster sesleri
paylaşılır. Kayıt hatası aynı gönderimi yeniden deneyebilir.

### Study Planner

Başlangıç ekranında beceri seçimi yoktur; sistem dengeli soru türleri planlar.
Beceri boyutları backend'de ve mastery modelinde korunur:

| Boyut                | Soru biçimi                         | Durum                       |
| -------------------- | ----------------------------------- | --------------------------- |
| `WrittenRecognition` | İngilizceyi gör → Türkçe anlamı seç | Planlanır                   |
| `WrittenRecall`      | Türkçe anlamı gör → İngilizceyi yaz | Planlanır                   |
| `AuralRecognition`   | Kullanılamaz                        | Soru biçimi yok; planlanmaz |
| `SpokenRecall`       | Kullanılamaz                        | Soru biçimi yok; planlanmaz |

`StudyPlanner.SupportedDimensions` bugün planlanabilir iki yazılı boyutu tutar;
ertelenen boyutlar bundan çıkarılır. Konu planı seçilen konunun ilk eksik
öğrenme grubunu alır, kelimeleri `SortOrder` sırasında seçmeli turda planlar,
ardından aynı kümenin yazılı turunu karıştırır. Bir oturumda aynı kelime iki
farklı boyutla bulunabilir; aynı kelime–boyut çifti yalnız bir kez bulunur.
Tekrar planı yalnız `NextReviewAtUtc <= now` olan mastery kayıtlarını
`NextReviewAtUtc`, `Stage`, `WordId`, `Dimension` sırasıyla alır; eksik boyut
dolgu sorusu üretmez.

Doğru cevap mastery aşamasını `0–5` arasında artırır ve 1, 3, 7, 14, 30 gün
aralıklarından birini planlar. Yanlış veya bilmiyorum aşamayı sıfırlar ve 10
dakika sonrasını planlar. Zaman `TimeProvider` üzerinden alınır.

Çoktan seçmeli soruda yanlış seçenekler önce sorulan kelimenin `Topic`inden,
sonra aynı levelden, son olarak genel katalogdan seçilir. Yeterli seçenek
bulamamak bir yetenek geçişi değil, bootstrap ve içerik doğrulamasında
yakalanması gereken veri bütünlüğü hatasıdır.

### Kelime Kataloğu

`/words`, kullanıcıdan bağımsız salt okunur kelime kataloğudur. API yalnız
kelime metadata'sını döndürür; kullanıcıya ait mastery veya progress alanları
bu sözleşmede bulunmaz.

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
queue consumer veya zamanlanmış iş yoktur. Due kayıtları Study session
başlatılırken planner tarafından seçilir.

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

| Uç                                               | Kimlik                    | Amaç                                                                  |
| ------------------------------------------------ | ------------------------- | --------------------------------------------------------------------- |
| `GET /api/auth/antiforgery`                      | Hayır                     | Antiforgery request token'ı                                           |
| `GET /api/auth/session`                          | Evet                      | Geçerli kullanıcı                                                     |
| `POST /api/auth/register`                        | Hayır + rate limit + XSRF | Hesap oluşturur ve giriş yapar                                        |
| `POST /api/auth/login`                           | Hayır + rate limit + XSRF | Giriş yapar                                                           |
| `POST /api/auth/logout`                          | Evet + XSRF               | Oturumu kapatır                                                       |
| `GET /api/study`                                 | Evet                      | Curriculum konumu, tek sonraki eylem, tekrar sayısı ve topic kataloğu |
| `POST /api/study-sessions/continue`              | Evet + XSRF               | Etkin oturumu sürdürür veya uygun sıradaki konuyu başlatır            |
| `POST /api/study-sessions`                       | Evet + XSRF               | Açıkça seçilen `Topic` veya `Review` oturumu başlatır                 |
| `GET /api/study-sessions/{sessionId}`            | Evet                      | Study sorusu/ilerleme/özeti                                           |
| `POST /api/study-sessions/{sessionId}/answers`   | Evet + XSRF               | Etkin Study sorusunu cevaplar                                         |
| `POST /api/study-sessions/{sessionId}/deferrals` | Evet + XSRF               | Bir beceriyi 10 dakika erteler; sonuç/mastery yazmaz                  |
| `GET /api/words/`                                | Evet                      | Kullanıcıdan bağımsız kelime kataloğu                                 |
| `GET /health`                                    | Hayır                     | PostgreSQL health check                                               |

Enum'lar JSON'da string serileştirilir. `Program.cs` yalnızca
`AddEndpointsApiExplorer()` içerir; Swagger middleware'i veya yayınlanmış
`/swagger` endpoint'i yoktur.

## 12.2 CLI, Dosya ve Tarayıcı Arayüzleri

EF migration için `dotnet ef` kullanılır. İdempotent kelime bootstrap'ı normal
startup yerine ayrı CLI/deployment adımıdır:

```bash
dotnet run --project WordMatch.API -- bootstrap words
```

`WordMatch.API/Content/Words.csv` uygulama yayınıyla birlikte taşınır. Her
satır bir kelimeyi ve konu yerleşimini birlikte taşır. Komut `ImportKey`
üzerinden içeri alır ve önceki sistemden gelen satırları `legacy-{Id}`
anahtarıyla eşleyerek aynı veritabanı kimliği üzerinde devralır; kaynaktan
kaldırılmış satırları otomatik silmez. Kelime içeriği ve konu üyeliği/sırası
her zaman serbestçe düzeltilebilir; başlık düzeltmesi de dahildir.
Feedback sesleri `/sounds/correct.wav`, `/sounds/wrong.wav`,
`/sounds/show-answer.wav` olarak statik sunulur.

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
bağlıdır.

Aynı hesaba birden fazla cihazdan eşzamanlı giriş serbesttir; ayrıntı için
bkz. 10.2.

Study ve Words grupları `RequireAuthorization()` kullanır; service
sorguları kullanıcı ID'siyle scope edilir. `GET /health` ile kayıt/giriş/
antiforgery anonimdir; session/çıkış kimlik gerektirir.

## 14.3 Antiforgery, Rate Limit ve Hassas Veri

XSRF cookie adı development'ta `WordMatch.XSRF.Development`,
non-development'ta `__Host-WordMatch.XSRF`dir. İstemci state-changing
çağrılarda `X-XSRF-TOKEN` gönderir; filter geçersiz/eksik token için 400 döner.

Kayıt/giriş, IP başına dakikada 10 istek izinli fixed-window `auth` policy'sine
tabidir; aşımda 429 döner, queue yoktur. Kayıt isteği e-posta/kullanıcı adı/
parola, Study path/focus/topic/level/cevap türü/indeks/pending soru/yazılı cevap kurallarıyla
doğrulanır. Parametreli EF Core/SQL interpolation kullanılır; parola veya
connection string response'ta dönmez.

# 15. Hata Yönetimi

## 15.1 Hata Modeli

- Config eksikleri startup exception ile uygulamayı durdurur.
- Auth doğrulaması `ValidationProblem`, geçersiz giriş 401, yasak erişim 403
  döndürür.
- Study validation 400, bulunamayan veya başka kullanıcıya ait
  session 404, eski/çakışan session veya cevap 409 döndürür. Feature hataları
  `{ "message": "…" }` şeklindedir.
- `/health` database ulaşılamazsa 503 ve `unhealthy` durumunu döndürür; hata
  warning olarak loglanır.

Tek global Problem Details/exception middleware'i belgelenmemiştir; beklenmeyen
server hataları framework varsayılanına kalır.

## 15.2 Recovery

İstemci cevap kaydında 409 alırsa session'ı yeniden yükler. UI, yükleme ve
kayıt hatalarını ayrı durumlarla gösterir. Uygulamada otomatik database retry
policy yapılandırılmamıştır.

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
seçenek üretimi katalogyu belleğe alır; katalog endpoint'i tüm kelimeleri
döndürür. Distractor üretimi session, aynı level ve tüm katalogyu tarayabilir.

Teknik sınırlar:

- Dört seçenek için içerik yeterli ayrık cevap taşımalıdır.
- Curriculum sırası `Topic`tan çıkarılamaz; explicit source gerekir.

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

## 19.4 Rollback ve Data Protection

Otomatik rollback prosedürü yoktur. Şema migration'ı içeren release geri
alınmadan önce migration veri uyumluluğu ve geri dönüş adımları değerlendirilir.
Production Data Protection key'leri named `wordmatch-data-protection` volume'ünde
`/var/lib/wordmatch/data-protection` altında kalır; container değişse de
oturum şifreleme anahtarları korunur. Bu volume'ü silmek mevcut production
oturumlarını geçersiz kılar, rollback aracı değildir.

# 20. Test Stratejisi

## 20.1 Test Türleri

| Tür                  | Konum                            | Kapsam                                                       |
| -------------------- | -------------------------------- | ------------------------------------------------------------ |
| API/entegrasyon      | `WordMatch.API.Tests`            | Auth, curriculum, planner/mastery, soru üretimi ve Study API |
| Web unit/bileşen     | `WordMatch.Web/src/**/__tests__` | Auth, Study, ortak soru sunumu, words ve API client          |
| Format/statik analiz | API ve web komutları             | Format, lint, TypeScript                                     |

## 20.2 Test Sınırları ve Kritik Senaryolar

API testleri izole Testcontainer PostgreSQL kullanır; development/production
veritabanına bağlanmaz. Fixture başlangıçta küçük kontrollü kelime seti ekler.
Cloudflare, gerçek production hostname, gerçek TTS/STT veya fiziksel cihaz
acceptance testi kaynakta yoktur.

Kritik test alanları auth/XSRF; 700 kelime/66 konu curriculum doğrulaması;
idempotent import; due ve 10 benzersiz soruluk plan; fixed mastery aralıkları;
path veya focus değişiminde abandon; double submit/409; fresh migration; webde beş
kart, Yakında erişilebilirliği, doğrudan soru, resume, server-authoritative
feedback, 800 ms otomatik ilerleme, klavye/ses davranışı, ara sonuç inceleme,
tamamlanma listeleri ve hata/retry durumlarıdır. Elle seçilen konudaki
tanıtımın global olduğu, ilgili konuya kredi yazdığı ve sıra oraya geldiğinde
yeniden yeni kelime
olarak planlanmadığı ayrıca doğrulanır.

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
  `docker compose build` çalıştırır. API Dockerfile'ı publish çıktısında
  `Content/Words.csv` bulunduğunu build sırasında doğrular. Container'ları
  başlatmaz ve canlı PostgreSQL/Cloudflare Tunnel doğrulaması yapmaz.

# 21. Kod ve Tasarım Kuralları

## 21.1 İsimlendirme ve Organizasyon

- API/web dosyaları feature altında tutulur; merkezi katman adına göre
  dağılmaz.
- C#, class/property/endpoint/paket adı gibi kod isimleri İngilizce kalır; kullanıcı Türkçe
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

## 21.3 Kaçınılması Gerekenler

- `English + PartOfSpeech`i bootstrap import identity'si yapmak.
- `Direction × Presentation × AnswerMethod`ın tüm kombinasyonlarını üretip
  progress kimliği yapmak.
- Yayımlanmış bir migration'ı geriye dönük değiştirmek. Zincirin tamamını
  sıfırlamak yalnızca ADR-004'teki gibi açık, gerekçeli ve veri kaybının kabul
  edildiği bir karardır.
- Topic/level metadata'sından runtime curriculum sırası uydurmak.
- Ertelenen veya desteklenmeyen bir beceriyi sessizce başka boyuta düşürmek.

# 22. Mimari Kararlar

## ADR-001 — Feature Tabanlı Minimal API

Endpoint'ler `MapGroup` ile feature altında toplanır; EF Core access
service'lerde doğrudan `ApplicationDbContext` üzerinden yapılır. Küçük ürün
için repository/Unit of Work soyutlaması eklenmez.

## ADR-002 — Session Soru Snapshot'ları Kalıcıdır

Kelime içeriği değişse bile geçmiş kullanıcı sonucu korunur. Bu nedenle
`StudySessionQuestion` prompt, correct answer, accepted answers ve gerekirse
seçenekleri saklar.

## ADR-003 — Mastery Dört Bilinçli Boyuttur

| Boyut                | Egzersiz                             | Ölçülen bilgi       |
| -------------------- | ------------------------------------ | ------------------- |
| `WrittenRecognition` | İngilizceyi gör → Türkçe anlamı seç  | Yazılı formu tanıma |
| `AuralRecognition`   | Tanımlı, ancak oturumda kullanılamaz | —                   |
| `WrittenRecall`      | Türkçe anlamı gör → İngilizceyi yaz  | Yazılı formu üretme |
| `SpokenRecall`       | Tanımlı, ancak oturumda kullanılamaz | —                   |

Türkçe hedef öğrenme dili değil, anlam yardımcısıdır. İlerleme
`UserId + WordId + MasteryDimension` benzersizliğinde `UserWordMastery` ile
tutulur. Kayıt son sonucu, doğru/review/yanlış sayaçlarını, `0–5` aşamasını,
son çalışma zamanını ve sonraki tekrar zamanını taşır.

`UserWordMastery` kimliği presentation veya answer method'a göre ayrışmaz;
ilerleme enum'daki mastery boyutlarında tutulur. Güncel planner yalnız
`WrittenRecognition` ve `WrittenRecall` boyutlarını planlar.

## ADR-004 — Clean Migration Reset Uygulandı

Migration zinciri iki kez tek `InitialCreate`e indirildi: önce tek-Study ve
ortak kelime-tanıtım modeline geçerken, sonra paket curriculum'u
`Level → sıralı Topic` omurgasıyla değiştirirken. İkincisinde iki tablo
tamamen kalktı ve üç kolon anlamını yitirdiği için artımlı geçmiş taşımak
hedef şemadan daha karmaşık olurdu. Reset varsayılan strateji değildir; büyük
domain değişikliğine ve gerçek kullanıcı verisinin bulunmadığı bir ana özgüdür.
Ayrıntılar [Bölüm 9.5](#95-migration-ve-bootstrap-modeli) içindedir.

## ADR-005 — Konu Seçimi Ayrı Bir Akış Değil, Tek Study Akışının Parametresidir

Ayrı bir "Konu Keşfi" modu ve `StudyPath` kavramı kaldırıldı. Kullanıcı ana
ekranda çalışma türü seçmez; sistem sıradaki konuyu açar ve kullanıcı isterse
konuyu değiştirir. Bu seçim ayrı bir oturum türü, ayrı bir ilerleme modeli veya
ayrı bir Practice progress'i oluşturmaz — yalnız açılacak oturumun konusudur.

`UserWordIntroduction` bütün Study oturumlarının ortak ilk karşılaşma kaydıdır
ve hangi yoldan gelindiğini artık taşımaz, çünkü tek bir yol vardır. Erken
tamamlanan bir konudaki kelime, curriculum sırası oraya ulaştığında yeniden
yeni içerik olarak gösterilmez; pekiştirme yalnız daha önce yanıtlanmış ve due
olan mastery yönlerinden gelir.

## ADR-006 — Konu Üyeliği İlerlemeden Bağımsız, Kelime Merkezli Bir Sınıflandırmadır

İlerleme (`UserWordMastery`, `UserWordIntroduction`) yalnızca `WordId`
bazlıdır; `CurriculumTopicId` taşımaz. "Sıradaki konu" ve konu ilerlemesi
saklı bir sayaç değil, güncel `CurriculumTopicWord` üyeliğinden her istekte
canlı türetilen bir görünümdür. Bu nedenle bir kelimeyi bir konudan diğerine
taşımak — kullanıcı ilerlemesi başlamış olsa bile — hiçbir kullanıcı sicilini
bozmaz; yalnızca konuların görünen tamamlanma durumunu yeniden hesaplatır.
İçerik (kelime metadata'sı ve konu yapısı) her zaman serbestçe düzeltilebilir.

Aynı gerekçeyle kaynaktan düşen konu silinmez, `Retired` işaretlenir: satırın
kendisi kullanıcı ilerlemesinin ve eski oturum snapshot'larının bağlı olduğu
kimliktir, planlamada görünmemesi ise ayrı bir durum sorusudur.

## ADR-007 — Curriculum Sırası Kod Değil, Veridir

Konu sırası daha önce `WordTopic` enum'ının deklarasyon sırasından türetiliyor
ve her istekte tüm kelimeler taranarak yeniden hesaplanıyordu; bu, alfabetik
İngilizce adlara bağlı, gözden geçirilemeyen ve pedagojik olarak anlamsız bir
sıra üretiyordu. Sıra artık `Words.csv`'deki `TopicSortOrder` ve
`WordSortOrder` kolonlarından gelir, bootstrap'te doğrulanır ve
`CurriculumTopics` tablosunda saklanır.

Bunun sonucu: içerik sırası kod değişikliği olmadan düzenlenebilir ve bir
pull request'te okunabilir. Enum yerine tablo kullanmak, `WordTopic`'i tip
güvenliği ve check constraint'ler için korurken sıralamayı içerik katmanına
taşır.

# 23. Değişiklik Rehberi

- Kelime metadata'sını değiştirmeden önce `WordConfiguration` constraint'leri,
  `Word.Id` ilişkileri, `QuestionFactory` ve snapshot etkisini inceleyin.
- Direction/format eklemek API enum/constraint, plan/factory, request-response,
  frontend Zod/UI, progress key ve testleri birlikte değiştirir.
- Session davranışı active unique index, conditional answer update, progress
  upsert, replay/result sorguları ve 409 recovery ile birlikte değerlendirilir.
- Şema değişiminde yeni migration yazın; production migration, Docker release
  ve gerekli bootstrap sırasını açıkça planlayın.
- Mastery değişiminde curriculum, mastery strength, review zamanı ve teknik
  question lifecycle ayrı tutulur.
- Curriculum sırası koda değil `Words.csv`'ye yazılır; bootstrap doğrulaması,
  `CurriculumTopic` constraint'leri ve `Retired` davranışı birlikte gözden
  geçirilir.
- Oturumun soru planına dokunan her değişiklik, beceri ertelemesinin hiçbir
  sonuç/mastery yazmadığını doğrulayan testlerle birlikte değerlendirilir.

# 24. Kritik Senaryolar

## 24.1 Aynı Oturumu İki Yerden Cevaplama

İki istek aynı pending soruyu cevaplarsa koşullu update yalnızca birini
başarılı yapar. Diğeri 409 alır ve istemci server session'ını yeniden yükler;
progress çift artmaz.

## 24.2 Kelime İçeriği Sonradan Düzeltilir

Yeni session güncel kelimeyi kullanır. Eski session/sonuç
`StudySessionQuestion` snapshot'ını kullandığı için geçmiş sonuç değişmez.

## 24.3 Oturum Ortasında Beceri Ertelenir

Sunucu cevaplanmamış soruları siler ve oturumu sonuçlandırır. Cevaplanmış
snapshot'lar, mastery sayaçları ve `NextReviewAtUtc` değişmez; erteleme hiçbir
sonuç yazmaz. Erteleme 10 dakika boyunca yalnız kullanıcının sonraki oturum
planlarına uygulanır; son açık beceri ertelenmek istenirse istek 409 döner.

## 24.4 Sıradan Bir Konu Erken Çalışılır

Kullanıcının seçtiği konudaki kelimelerin iki yazılı mastery yönü tamamlanınca
aynı ilerleme diğer ekranlarda da görünür. Curriculum pointer'ı hareket etmez
— sıradaki konu hâlâ ilk tamamlanmamış konudur. Sıra o konuya ulaştığında
tamamlanmış konu atlanır, kısmen tamamlanmış konu ilk eksik öğrenme grubundan
devam eder; hiçbir kelime ikinci kez yeni içerik olarak gösterilmez.

## 24.5 Dört Farklı Seçenek Bulunamaz

Factory yakın kapsamları dener, yine üç valid distractor bulamazsa validation
hatası üretir. İçerik verisi düzeltilir; tekrar eden/yanlış seçenekle soru
üretilmez.

# 25. Operasyon ve Sorun Giderme

| Belirti                      | Kontrol                                                                        |
| ---------------------------- | ------------------------------------------------------------------------------ |
| API başlamıyor               | `ConnectionStrings:DefaultConnection`; production'da `DataProtection__KeyPath` |
| Study'de konu yok            | Migration uygulandıktan sonra `bootstrap words` çalıştırıldığını doğrulayın.   |
| Şema yeni ama uygulama eski  | Migration testten sonra açıkça uygulanmış mı; Compose auto-migrate kapalı mı?  |
| Dış hostname açılmıyor       | Önce `/health`, sonra Nginx host portu, son olarak Tunnel/DNS routing.         |
| Production login düşüyor     | `wordmatch-data-protection` volume ve key path korunuyor mu?                   |
| Tunnel loopback'e erişemiyor | Gerekirse web bind `0.0.0.0`; port ağ seviyesinde korunuyor mu?                |

# 26. Projeyi Anlamak İçin Okuma Sırası

1. [README.md](README.md)
2. Bu belgenin Genel Bakış, Veri Modeli ve Veri Akışı bölümleri
3. `Program.cs`, `StudyService.cs`, `StudyPlanner.cs`, `StudyQuestionFactory.cs`
4. Webde `src/main.tsx`, `src/features/study`, `src/features/auth`
5. Uygulanmamış işler için [ROADMAP.md](ROADMAP.md)

# 27. AI İçin Bağlam

Study tek öğrenme akışıdır; ikinci bir paralel akış önermeyin.
Küçük, ürün tarafından gerekçelendirilmiş tasarımlar tercih edin: ihtiyaç yoksa
yeni repository, genel retry, write endpoint, DTO veya seed altyapısı eklemeyin.
Session snapshot, Study path, database constraint, XSRF ve migration geçmişini
etkileyen değişiklikte ilgili test/deployment etkisini inceleyin.

# 28. Güncelleme Kuralı

Davranış, domain, veri modeli, endpoint, config, deployment veya güvenlik
değiştiğinde bu belge aynı değişiklikte güncellenir. Uygulanmamış işler yalnız
[ROADMAP.md](ROADMAP.md)'de tutulur. Sürüm geçmişi yalnızca doğrulanmış release
olduğunda [CHANGELOG.md](CHANGELOG.md) dosyasına eklenir.
