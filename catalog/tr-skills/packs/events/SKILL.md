---
name: events
description: "Organizasyon ve etkinlik yönetimi geliştirilirken veri modelini, ekranları, servisi ve kabul testini üret."
---

# Organizasyon ve etkinlik yönetimi

## Girdi
Seçilen meslek kodu ve unvanı, kurumun mevcut veri alanları, işlem sahibi, örnek kayıt, hedef ortam ve kabul ölçütü. Verilmeyen kurum kurallarını varsayım olarak işaretle.

## Uygula
1. Brief adımı için işlem sahibini, kayıt kimliğini, beklenen girdiyi ve bir sonraki adıma geçiş koşulunu tanımla.
2. Mekân ve tarih adımı için işlem sahibini, kayıt kimliğini, beklenen girdiyi ve bir sonraki adıma geçiş koşulunu tanımla.
3. Tedarikçi adımı için işlem sahibini, kayıt kimliğini, beklenen girdiyi ve bir sonraki adıma geçiş koşulunu tanımla.
4. Kapasite ve katılım adımı için işlem sahibini, kayıt kimliğini, beklenen girdiyi ve bir sonraki adıma geçiş koşulunu tanımla.
5. Mevcut projedeki veri modeline ve arayüz bileşenlerine uyumlu migration, servis, liste ve detay ekranını geliştir. Şirket ayrımını sunucu sorgusunda uygula.
6. Örnek veriyle normal işlem, yetkisiz erişim ve çift gönderim senaryolarını çalıştır. Dış servis bağlantısı yoksa adaptör kullan, sonucu simülasyon olarak etiketle.

## Kabul
Son davetiye için iki kayıt alındığında kapasite aşılmaz.

## Teslim
Çalıştırma komutu, örnek kayıt, değişen dosyalar, gerçekleşen test sonuçları ve doğrulanmamış entegrasyonlar. İnsan onayı gerektiren işlemleri kurumun yetkili rolüne bırak.
