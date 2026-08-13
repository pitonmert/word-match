<!--
BELGE KAPSAMI

AMAÇ:
Projenin yüksek seviyeli gelecek yönünü ve önceliklerini göstermek.

DAHİL:
- Şu anda öncelikli büyük özellikler veya geliştirmeler
- Sıradaki yüksek seviyeli çalışmalar
- Daha sonra değerlendirilecek fikirler ve yönler

DAHİL DEĞİL:
- Mikro görevlar veya kod düzeyi TODO'lar
- Aktif işin ayrıntılı fazları ve uygulama adımları → PLAN.md
- Mevcut sistem mimarisi → ARCHITECTURE.md
- Tamamlanmış sürümlerin değişiklik geçmişi → CHANGELOG.md
- Kesin olmayan tarih veya teslim taahhütleri

KURAL:
ROADMAP bir görev takip sistemi değildir. Maddeler sonuç/özellik seviyesinde
kalmalı; uygulama ayrıntıları PLAN.md dosyasına taşınmalıdır.
-->

# Yol Haritası

Bu dosya projenin mevcut geliştirme yönünü ve planlanan önemli çalışmaları
takip eder.

> Planlar ve öncelikler geliştirme sürecine göre değişebilir.

Aktif çalışmanın sıralı uygulama adımları için [PLAN.md](PLAN.md) dosyasına,
gelecek yatırımların teknik sınırları için
[ARCHITECTURE.md](ARCHITECTURE.md#23-teknik-kısıtlamalar-ve-planlanan-uzantı-sınırları)
dosyasına bakın.

Sıralama maliyet ve belirsizliğe göre kurulmuştur: önce uygulamayı çalışır
kılan ve öğrenme değeri kanıtlanmış işler, sonra doğrulanması gereken yatırımlar
gelir.

## Şimdi

- [ ] Kelime bootstrap'ını, yazılı mastery çekirdeğini ve ilk Review döngüsünü
      [PLAN.md](PLAN.md) içindeki fazlarla tamamlamak.

## Sırada

- [ ] Development'ta OpenAPI belgesini yayımlamak; bugün yalnızca
      `AddEndpointsApiExplorer()` kayıtlıdır ve çalışır bir arayüz yoktur.
- [ ] Metrics, tracing ve yapılandırılmış loglamayı kurmak. Review aralıklarını
      gerçek kullanım verisiyle kalibre etmenin ön koşuludur.
- [ ] Curriculum path ve sistem kontrollü Learn akışını; mastery modeli
      kararlı hale geldikten sonra eklemek.
- [ ] Hedef temiz şema reset'ini ve kullanıcı/authentication reset'ini
      uygulamak. Zamanı ve `InitialCreate` içeriği hâlâ açık karardır.
- [ ] İçerik kalitesi gerektiğinde `Admin` policy, içerik bildirimi ve audit
      temelini kurmak.
- [ ] Yetkilendirme, audit ve optimistic concurrency hazır olduğunda yönetici
      kelime yönetimini eklemek.

## Daha Sonra

- [ ] Çevrimdışı çalışmayı ve kurulabilir istemciyi değerlendirmek; kelime
      çalışmanın büyük kısmı bağlantısız ortamda yapılır.
- [ ] Curriculum ve mastery modeli kararlı olduğunda vocabulary placement
      assessment'i değerlendirmek.
- [ ] Cihaz yetenek tespitini ve desteklenmeyen soruların question lifecycle'ını
      sesli egzersizler gündeme geldiğinde ele almak.
- [ ] `AuralRecognition` akışını; Review davranışı yerleştikten sonra eklemek.
- [ ] `SpokenRecall`'u yalnızca STT çalışma yeri, sağlayıcı, gizlilik metni ve
      retention davranışı kesinleştikten sonra ele almak.
- [ ] Review davranışı gözlemlendikten sonra sürümlenmiş puan ve motivasyon
      sistemi eklemek.
- [ ] Çekirdek `SpokenRecall` çalıştıktan sonra gelişmiş pronunciation ve daha
      zengin içerik seçeneklerini değerlendirmek.
- [ ] Tek kullanıcılı öğrenme değerini kanıtladıktan sonra sosyal çalışma ve
      canlı rekabeti ayrı domain olarak ele almak.
