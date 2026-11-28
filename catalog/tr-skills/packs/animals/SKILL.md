---
name: animals
description: "Sürü ve bakım kayıtları geliştirilirken veri modelini, ekranları, servisi ve kabul testini üret."
---

# Sürü ve bakım kayıtları

## Girdi
Seçilen meslek kodu ve unvanı, kurumun mevcut veri alanları, işlem sahibi, örnek kayıt, hedef ortam ve kabul ölçütü. Verilmeyen kurum kurallarını varsayım olarak işaretle.

## Uygula
1. Hayvan veya grup kimliği adımı için işlem sahibini, kayıt kimliğini, beklenen girdiyi ve bir sonraki adıma geçiş koşulunu tanımla.
2. Bakım takvimi adımı için işlem sahibini, kayıt kimliğini, beklenen girdiyi ve bir sonraki adıma geçiş koşulunu tanımla.
3. Yem tüketimi adımı için işlem sahibini, kayıt kimliğini, beklenen girdiyi ve bir sonraki adıma geçiş koşulunu tanımla.
4. Devir adımı için işlem sahibini, kayıt kimliğini, beklenen girdiyi ve bir sonraki adıma geçiş koşulunu tanımla.
5. Mevcut projedeki veri modeline ve arayüz bileşenlerine uyumlu migration, servis, liste ve detay ekranını geliştir. Şirket ayrımını sunucu sorgusunda uygula.
6. Örnek veriyle normal işlem, yetkisiz erişim ve çift gönderim senaryolarını çalıştır. Dış servis bağlantısı yoksa adaptör kullan, sonucu simülasyon olarak etiketle.

## Kabul
Aynı yem çıkışı tekrar iletildiğinde depo miktarı bir kez azalır.

## Teslim
Çalıştırma komutu, örnek kayıt, değişen dosyalar, gerçekleşen test sonuçları ve doğrulanmamış entegrasyonlar. İnsan onayı gerektiren işlemleri kurumun yetkili rolüne bırak.
