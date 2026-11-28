---
name: market
description: "Hal parti ve cari takibi geliştirilirken veri modelini, ekranları, servisi ve kabul testini üret."
---

# Hal parti ve cari takibi

## Girdi
Seçilen meslek kodu ve unvanı, kurumun mevcut veri alanları, işlem sahibi, örnek kayıt, hedef ortam ve kabul ölçütü. Verilmeyen kurum kurallarını varsayım olarak işaretle.

## Uygula
1. Üretici ve künye adımı için işlem sahibini, kayıt kimliğini, beklenen girdiyi ve bir sonraki adıma geçiş koşulunu tanımla.
2. Tartım ve dara adımı için işlem sahibini, kayıt kimliğini, beklenen girdiyi ve bir sonraki adıma geçiş koşulunu tanımla.
3. Fire adımı için işlem sahibini, kayıt kimliğini, beklenen girdiyi ve bir sonraki adıma geçiş koşulunu tanımla.
4. Parti bazında satış adımı için işlem sahibini, kayıt kimliğini, beklenen girdiyi ve bir sonraki adıma geçiş koşulunu tanımla.
5. Cari ekstre adımı için işlem sahibini, kayıt kimliğini, beklenen girdiyi ve bir sonraki adıma geçiş koşulunu tanımla.
6. Mevcut projedeki veri modeline ve arayüz bileşenlerine uyumlu migration, servis, liste ve detay ekranını geliştir. Şirket ayrımını sunucu sorgusunda uygula.
7. Örnek veriyle normal işlem, yetkisiz erişim ve çift gönderim senaryolarını çalıştır. Dış servis bağlantısı yoksa adaptör kullan, sonucu simülasyon olarak etiketle.

## Kabul
100 kg brüt, 5 kg dara ve 3 kg fire sonrası satılabilir miktar 92 kg olur.

## Teslim
Çalıştırma komutu, örnek kayıt, değişen dosyalar, gerçekleşen test sonuçları ve doğrulanmamış entegrasyonlar. İnsan onayı gerektiren işlemleri kurumun yetkili rolüne bırak.
