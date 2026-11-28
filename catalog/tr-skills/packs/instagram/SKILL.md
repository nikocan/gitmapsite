---
name: instagram
description: "Onaylı işletme içeriği için Instagram içerik yayını adaptörünü geliştir ve test et."
---

# Instagram içerik yayını

Girdi: hesap, içerik sürümü, medya, saat dilimi, görünürlük ve kullanıcı onayı.
1. Resmi belgede geçerli hesap, kapsam, inceleme ve sürüm koşullarını doğrula. OAuth bağlantısını ilgili şirkete bağla.
2. Profesyonel hesabı seç; görsel/video için medya kapsayıcısı oluştur, hazır durumunu bekle ve yayınlanan medya kimliğini kaydet.
3. Taslak > onay > zamanlama > gönderim > sağlayıcı teyidi > rapor akışını kur. İçerik değişirse eski onayı geçersiz kıl.
4. Aynı yayın anahtarını tekilleştir. Gönderimden sonra zaman aşımı varsa sağlayıcıdaki durumu uzlaştır; belirsiz kaydı yeniden göndermeden incelemeye al.
5. İzin geri çekilmesi, kota ve desteklenmeyen medya için düzeltilebilir hata göster. Yalnız desteklenen ve erişilebilen ölçümleri raporla.

Kabul: onaysız taslak bekler; yinelenen iş tek yayın üretir; başka şirkete ait hesap kullanılamaz. Çevrimdışı örnek için demo_social.py testi çalıştır. Gerçek hesapla uçtan uca testi ayrıca kaydet.

Kaynak: https://developers.facebook.com/docs/instagram-platform/content-publishing/
