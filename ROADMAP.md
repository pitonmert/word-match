<!--
BELGE KAPSAMI

AMAÇ:
Uygulanmamış tüm ürün, teknik iyileştirme ve düzeltme kararlarını tek yerde
tutmak.

DAHİL:
- Sıradaki işler ve öncelikleri
- Gelecek özelliklerin kabul edilmiş mimari sınırları
- Mevcut sistemin giderilmesi planlanan eksikleri

DAHİL DEĞİL:
- Çalışan sistemin teknik açıklaması → ARCHITECTURE.md
- Hızlı kurulum ve kullanım → README.md
- Yayımlanmış değişiklik geçmişi → CHANGELOG.md

KURAL:
Bu dosya uygulanmamış işleri tek kaynaktan açıklar. Bir iş tamamlandığında
buradan silinir; çalışan davranış ARCHITECTURE.md'ye, kayda değer değişiklik
CHANGELOG.md'ye taşınır.
-->

# Yol Haritası

Öncelikler kullanım verisi ve ürün öğrenimlerine göre değişebilir. Bu dosyadaki
hiçbir madde, kaynak kodda uygulanmadan mevcut davranış sayılmaz.

## Şimdi

### Mastery Görünürlüğü

- `/api/words` kullanıcıdan bağımsız, salt okunur katalog olarak kalacak;
  kullanıcı ilerlemesi bu yanıta eklenmeyecek.
- Yetkili `GET /api/study/mastery`, yalnız kullanıcının tanıttığı kelimeler
  için `WordId`, ilk karşılaşma bilgisi ve boyut bazlı mastery durumu
  (`Stage`, sayaçlar, `NextReviewAtUtc`) döndürecek.
- `/words`, katalog ve mastery verisini ayrı query'lerle yükleyip `WordId`
  üzerinden birleştirecek. Kayıtsız kelime “Henüz çalışılmadı” sayılacak.
- Görünümde dört boyut rozeti, özet durum veya yeni/zayıf/due filtrelerinin
  hangilerinin gerekli olduğu kullanım ihtiyacına göre belirlenecek; yapay
  başarı yüzdesi eklenmeyecek.

### Operasyon ve Gözlemlenebilirlik

- Development ortamında OpenAPI belgesini yayımlamak.
- Metrics, tracing ve yapılandırılmış loglamayı kurmak; planner ve tekrar
  aralıklarını gerçek kullanım verisiyle değerlendirmek.
- API/web cache stratejisini, sorgu profillemesini ve otomatik rollback
  yaklaşımını ihtiyaç ortaya çıktığında tasarlamak.

## Sırada

### İçerik Kalitesi ve Yönetim

- İçerik bildirimi, `Admin` policy, audit ve optimistic concurrency temelini
  kurmak.
- Bu güvenlik sınırları hazır olduğunda kelime içerik yönetimini eklemek.

### Placement Assessment

- Normal Study oturumundan ayrı, kontrollü kelime örneklemi ve seviye
  dağılımına sahip başlangıç değerlendirmesini tasarlamak.
- Sonucun genel CEFR iddiası değil, başlangıç vocabulary seviyesi olduğunu
  korumak.

## Daha Sonra

### Sesli Çalışma

- Cihaz yeteneği, teknik atlama lifecycle'ı ve izin kaybı davranışı
  kesinleştikten sonra `AuralRecognition`ı etkinleştirmek.
- `SpokenRecall` için STT çalışma yeri, sağlayıcı, gizlilik metni, retention ve
  hata davranışlarını belirlemek. Mikrofon/speech sorunu öğrenme sonucu veya
  mastery güncellemesi üretmemeli.
- Pronunciation, zengin ses içeriği, örnek cümle ve görselleri çekirdek Study
  davranışından ayrı ürün kararları olarak değerlendirmek.

### Ürün Genişletmeleri

- Study ve tekrar davranışı gözlemlendikten sonra sürümlenmiş puan/motivasyon
  modelini değerlendirmek.
- Çevrimdışı çalışma ve kurulabilir istemciyi değerlendirmek.
- Sosyal çalışma veya canlı rekabeti; gizlilik, moderasyon, server-authoritative
  zaman ve reconnect gibi ayrı domain gereksinimleriyle ele almak.
