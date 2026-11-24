#!/usr/bin/env bash
# Gitmapsite — gitmapp.com VPS kurulumu
# Mevcut sitelere DOKUNMAZ: sadece gitmapp.com için yeni bir sanal sunucu (vhost) ekler.
set -euo pipefail
DOMAIN="gitmapp.com"
ROOT="/var/www/gitmapp"
REPO="https://github.com/nikocan/gitmapsite.git"
EMAIL="nahitcan@gmail.com"
SERVER_IP="69.62.117.217"
say(){ echo -e "\n\033[1;34m==> $*\033[0m"; }
fail(){ echo -e "\n\033[1;31mDURDU: $*\033[0m"; exit 1; }
[ "$(id -u)" -eq 0 ] || fail "root olarak çalıştırın (sudo)."

say "1/6 Sunucu durumu (sadece okuma)"
echo "80/443 portlarını dinleyenler:"; ss -ltnp 2>/dev/null | grep -E ':(80|443)\s' || echo "  (yok)"
WS=none
if systemctl is-active --quiet nginx 2>/dev/null; then WS=nginx
elif systemctl is-active --quiet apache2 2>/dev/null; then WS=apache
elif systemctl is-active --quiet caddy 2>/dev/null; then WS=caddy
elif command -v docker >/dev/null && docker ps --format '{{.Ports}}' 2>/dev/null | grep -qE '0\.0\.0\.0:(80|443)->'; then WS=docker
fi
echo "Tespit edilen web sunucusu: $WS"
case "$WS" in
  nginx) echo "Mevcut nginx siteleri:"; ls /etc/nginx/sites-enabled/ 2>/dev/null || true ;;
  none)  say "80 portunda çalışan web sunucusu yok, nginx kuruluyor"; apt-get update -qq && apt-get install -y -qq nginx; WS=nginx ;;
  *)     echo "Bu sunucuda $WS kullanılıyor. Otomatik ayar sadece nginx için yazıldı."
         echo "Yukarıdaki çıktıyı Claude'a gönderin; $WS için uygun ayarı hazırlayacak."; exit 2 ;;
esac

say "2/6 Uygulama dosyaları ($ROOT)"
command -v git >/dev/null || apt-get install -y -qq git
if [ -d "$ROOT/.git" ]; then git -C "$ROOT" pull -q --ff-only; else git clone -q --depth 1 "$REPO" "$ROOT"; fi
chown -R www-data:www-data "$ROOT" 2>/dev/null || true
echo "Son sürüm: $(git -C "$ROOT" log -1 --format='%h %s' | cut -c1-80)"

say "3/6 nginx ayarı (sadece gitmapp.com)"
CONF="/etc/nginx/sites-available/$DOMAIN"
if [ -f "$CONF" ]; then cp "$CONF" "$CONF.bak.$(date +%s)"; fi
cat > "$CONF" <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name $DOMAIN www.$DOMAIN;
    root $ROOT;
    index index.html;
    location / { try_files \$uri \$uri/ /index.html; }
    location ~ /\.(git|github) { deny all; return 404; }
    location /deploy/ { deny all; return 404; }
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy strict-origin-when-cross-origin always;
    add_header X-Frame-Options SAMEORIGIN always;
    gzip on; gzip_types text/html text/css application/javascript application/json;
}
NGINX
ln -sf "$CONF" "/etc/nginx/sites-enabled/$DOMAIN"
if ! nginx -t; then rm -f "/etc/nginx/sites-enabled/$DOMAIN"; fail "nginx ayarı hatalı, gitmapp.com ayarı geri alındı. Diğer sitelere dokunulmadı."; fi
systemctl reload nginx
echo "nginx yeniden yüklendi (diğer siteler etkilenmez)."

say "4/6 DNS kontrolü"
IP=""
for i in $(seq 1 30); do
  IP=$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk 'NR==1{print $1}' || true)
  [ "$IP" = "$SERVER_IP" ] && { echo "$DOMAIN → $IP ✓"; break; }
  echo "  $DOMAIN şu an '$IP' gösteriyor, $SERVER_IP bekleniyor… ($i/30)"; sleep 20
done
[ "$IP" = "$SERVER_IP" ] || fail "DNS henüz bu sunucuyu göstermiyor. 10 dakika sonra betiği tekrar çalıştırın."

say "5/6 SSL sertifikası (Let's Encrypt)"
command -v certbot >/dev/null || apt-get install -y -qq certbot python3-certbot-nginx
certbot --nginx -d "$DOMAIN" -d "www.$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect --keep-until-expiring

say "6/6 Otomatik güncelleme (GitHub'a her yükleme 5 dk içinde yayına girer)"
cat > /etc/cron.d/gitmapsite <<CRON
*/5 * * * * root cd $ROOT && git pull -q --ff-only >> /var/log/gitmapsite-pull.log 2>&1
CRON
chmod 644 /etc/cron.d/gitmapsite

say "TAMAM ✓  https://$DOMAIN yayında"
curl -s -o /dev/null -w "Ana sayfa yanıtı: %{http_code}\n" "https://$DOMAIN/" || true
