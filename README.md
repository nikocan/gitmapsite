# Gitmapsite — Uygulama Dünyası

GitHub'daki açık kaynak projelerden, lisansı ve güvenliği kontrol edilmiş hazır uygulamaları işletmelere sunan; markaya göre özelleştirip alan adı, Hostinger sunucusu ve istenirse App Store / Google Play'e kadar teslim eden platform.

- Canlı: https://gitmapp.com (yedek: https://nikocan.github.io/gitmapsite/)
- Müşteri görünümü: Uygulama Dünyası, Uygulamamı Oluştur, Paketler, Yapay Zekâ Destekleri, Taleplerim
- Yönetici görünümü: Siparişler, İş Planı & Gelir, GitHub Radar, İş Kolları, Listem, Yapım Kuyruğu, Ayarlar
- Sürüm notları: uygulama içinde **Güncellemeler** sekmesi

## Stüdyoda sürüm kontrolü

**Geliştir → Dallar** panelinde bir kaynak ve başlangıç dalı seçin. **Yeni dal** ile çalışma dalını açın. Stüdyoda düzenleme yaptıktan sonra panelde `index.html` farkını inceleyin, bir commit mesajı yazın ve kaydedin.

Gitmapp sekmesi geçmişi proje sahibinin hesabında, SQLite üzerinde tutar. GitHub sekmesi mevcut OAuth bağlantısını kullanır. Kendi hesabınızda yazma yetkiniz bulunan bir depoyu bağlayabilir veya yeni, herkese açık bir depo oluşturabilirsiniz. GitHub commit’i seçilen daldaki kök `index.html` dosyasını günceller. Dal başka bir yerde ilerlediyse panel yeni sürümle karşılaştırmanızı ister.

Bir dalı Gitmapp projesinde kullanmak için **Çalışmayı proje taslağına aktar** seçeneğini kullanıp projeyi kaydedin. Yayın işlemini Stüdyo’nun **Yayınla** düğmesinden başlatabilirsiniz. Sürüm kontrolü testleri Node.js üzerinde `node --test server/version-control.test.mjs` komutuyla çalışır.
