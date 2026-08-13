<!--
BELGE KAPSAMI

AMAÇ:
Yalnızca aktif çalışmanın, özelliğin veya geliştirme hedefinin sıralı
uygulama planını belgelemek.

DAHİL:
- Aktif çalışmanın kısa hedefi
- Mantıksal uygulama fazları
- Fazların sırası
- Tamamlanabilir ve anlamlı teknik adımlar
- Çalışmanın tamamlanması için gereken doğrulama/test adımları

DAHİL DEĞİL:
- Uzun vadeli veya henüz aktif olmayan hedefler → ROADMAP.md
- Mevcut sistemin kalıcı teknik açıklaması → ARCHITECTURE.md
- Genel kurulum ve kullanım → README.md
- Tamamlanmış sürümlerin geçmişi → CHANGELOG.md

KURAL:
Her checkbox anlamlı bir geliştirme sonucu ifade etmelidir. Fazlar geçici
uygulama planıdır; kalıcı mimari bilgi ortaya çıkarsa ARCHITECTURE.md de
güncellenmelidir.
-->

# Kelime Bootstrap ve Yazılı Mastery Çekirdeği

Bu çalışma önce projeyi temiz bir kurulumda çalışır duruma getiren kelime
bootstrap'ını kurar, ardından mevcut kategori temelli Practice'i bozmadan
yazılı mastery çekirdeğini ve ilk Review döngüsünü ekler. Tamamlandığında yeni
bir kurulum kendi verisiyle çalışır ve kelime ilerlemesi tek outcome yerine
mastery boyutları üzerinden izlenir.

Fazlar additive ilerler: mevcut şema ve kullanıcı verisi korunur. Curriculum ve
Learn akışı, hedef şema reset'i, cihaz yetenekleri ve sesli egzersizler bu
planın kapsamı dışındadır; bunların sırası [ROADMAP.md](ROADMAP.md), teknik
sınırları
[ARCHITECTURE.md](ARCHITECTURE.md#23-teknik-kısıtlamalar-ve-planlanan-uzantı-sınırları)
içindedir.

## Faz 1 — Kelime Bootstrap

Bugün `Data/WordMatch.csv` repository'de durur ancak veritabanına aktaracak bir
yol yoktur; temiz kurulumda kategori listesi boş gelir. Bu faz diğer her şeyin
önündedir ve tek başına sevk edilebilir.

- [ ] `Words.ImportKey` unique identity'sini eklemek ve mevcut satırlar için
      geriye dönük doldurmayı migration ile güvenceye almak.
- [ ] CSV kaynağını `ImportKey` üzerinden idempotent şekilde içeri alan
      bootstrap importunu eklemek; tekrar çalıştırma duplicate üretmemelidir.
- [ ] İçerik düzeltmesinin mevcut session snapshot'larını ve progress
      kayıtlarını bozmadan uygulanmasını sağlamak.
- [ ] Migration, bootstrap, referential integrity ve duplicate kontrollerinden
      oluşan deployment sırasını doğrulamak; README kurulum adımını importer
      ile değiştirmek.

## Faz 2 — Domain Sözleşmesi

- [ ] `VocabularyMasteryDimension` ve `User + Word + MasteryDimension`
      ilerleme kimliğini tanımlamak; mastery strength ile review schedule'ı
      ayırmak.
- [ ] Review ve Practice session purpose'larını ve her biri için soru seçim
      kurallarını belirlemek.
- [ ] Level/Topic'in metadata ve Practice filtresi olarak kalmasını; mevcut
      `UserWordProgress` verisinin yeni modele taşınma yolunu belirlemek.

## Faz 3 — Yazılı Mastery Çekirdeği

- [ ] `WrittenRecognition` ve `WrittenRecall` soru/cevap akışlarını yeni
      mastery progress modeline taşımak.
- [ ] Snapshot, answer outcome, review schedule ve kullanıcı ilerlemesi için
      ilgili domain/entegrasyon testlerini kurmak.

## Faz 4 — Review ve Mastery Filtreli Practice

- [ ] Due ve zayıf `Word + MasteryDimension` kayıtlarını seçen ilk Review
      scheduling döngüsünü uygulamak.
- [ ] Practice'e Level, Category ve Mastery filtrelerini eklemek.
- [ ] Algoritma aralıklarını gerçek kullanım verisiyle kalibre edilebilecek
      sınırda tutmak.

## Faz 5 — Mastery Görünürlüğü

- [ ] `/words` üzerinde kelime başına mastery durumunu ve zayıf kelimeleri
      görünür kılmak.
- [ ] Ana ekranda güvenilir ilerleme özetini tasarlamak; yapay kesinlik veren
      yüzdeleri zorunlu kılmamak.

## Faz 6 — Doğrulama

- [ ] Temiz veritabanından bootstrap, Practice, Review ve mastery ilerlemesini
      uçtan uca doğrulamak.
- [ ] Mevcut kullanıcı verisinin faz boyunca korunduğunu migration testleriyle
      göstermek.
