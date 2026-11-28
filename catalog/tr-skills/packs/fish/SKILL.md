---
name: fish
description: "Av ve ürün parti defteri geliştirilirken veri modelini, ekranları, servisi ve kabul testini üret."
---

# Av ve ürün parti defteri

## Girdi
Seçilen meslek kodu ve unvanı, kurumun mevcut veri alanları, işlem sahibi, örnek kayıt, hedef ortam ve kabul ölçütü. Verilmeyen kurum kurallarını varsayım olarak işaretle.

## Uygula
1. Sefer adımı için işlem sahibini, kayıt kimliğini, beklenen girdiyi ve bir sonraki adıma geçiş koşulunu tanımla.
2. Av kaydı adımı için işlem sahibini, kayıt kimliğini, beklenen girdiyi ve bir sonraki adıma geçiş koşulunu tanımla.
3. Tartım adımı için işlem sahibini, kayıt kimliğini, beklenen girdiyi ve bir sonraki adıma geçiş koşulunu tanımla.
4. Soğuk depo adımı için işlem sahibini, kayıt kimliğini, beklenen girdiyi ve bir sonraki adıma geçiş koşulunu tanımla.
5. Teslim adımı için işlem sahibini, kayıt kimliğini, beklenen girdiyi ve bir sonraki adıma geçiş koşulunu tanımla.
6. Mevcut projedeki veri modeline ve arayüz bileşenlerine uyumlu migration, servis, liste ve detay ekranını geliştir. Şirket ayrımını sunucu sorgusunda uygula.
7. Örnek veriyle normal işlem, yetkisiz erişim ve çift gönderim senaryolarını çalıştır. Dış servis bağlantısı yoksa adaptör kullan, sonucu simülasyon olarak etiketle.

## Kabul
Parti iki alıcıya bölündüğünde teslim toplamı tartımı aşamaz.

## Teslim
Çalıştırma komutu, örnek kayıt, değişen dosyalar, gerçekleşen test sonuçları ve doğrulanmamış entegrasyonlar. İnsan onayı gerektiren işlemleri kurumun yetkili rolüne bırak.
