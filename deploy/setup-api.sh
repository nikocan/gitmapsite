#!/usr/bin/env bash
# Gitmapp API kurulumu — api.gitmapp.com + app.gitmapp.com
# Mevcut sitelere ve sistemdeki Node.js'e DOKUNMAZ: Gitmapp kendi Node.js kopyasını /opt/gitmapp/node altında kullanır.
set -euo pipefail
REPO_DIR="/var/www/gitmapp"
OPT="/opt/gitmapp"
DATA="/var/lib/gitmapp"
ENVF="/etc/gitmapp/api.env"
PORT=8787
SERVER_IP="69.62.117.217"
say(){ echo -e "\n\033[1;34m==> $*\033[0m"; }
fail(){ echo -e "\n\033[1;31mDURDU: $*\033[0m"; exit 1; }
ask(){ local v; read -r -p "$1" v </dev/tty || true; echo "$v"; }
asks(){ local v; read -r -s -p "$1" v </dev/tty || true; echo >&2; echo "$v"; }
[ "$(id -u)" -eq 0 ] || fail "root olarak çalıştırın (sudo)."
[ -d "$REPO_DIR/.git" ] || fail "$REPO_DIR bulunamadı. Önce setup-vps.sh çalıştırılmış olmalı."
systemctl is-active --quiet nginx || fail "nginx çalışmıyor."

say "1/8 Kod güncelleniyor"
git -C "$REPO_DIR" pull -q --ff-only
[ -f "$REPO_DIR/server/server.mjs" ] || fail "server/server.mjs bulunamadı."

say "2/8 Gitmapp'e özel Node.js 22 (sistem Node.js'ine dokunulmaz)"
mkdir -p "$OPT"
if [ ! -x "$OPT/node/bin/node" ] || ! "$OPT/node/bin/node" --no-warnings -e 'require("node:sqlite")' 2>/dev/null; then
  cd /tmp
  SUMS=$(curl -fsSL https://nodejs.org/dist/latest-v22.x/SHASUMS256.txt)
  FILE=$(echo "$SUMS" | awk '/linux-x64\.tar\.xz$/{print $2}' | head -1)
  SHA=$(echo "$SUMS" | awk '/linux-x64\.tar\.xz$/{print $1}' | head -1)
  [ -n "$FILE" ] || fail "Node.js sürümü bulunamadı."
  curl -fsSLO "https://nodejs.org/dist/latest-v22.x/$FILE"
  echo "$SHA  $FILE" | sha256sum -c - >/dev/null || fail "Node.js indirme doğrulanamadı."
  rm -rf "$OPT/node" && mkdir -p "$OPT/node" && tar -xJf "$FILE" -C "$OPT/node" --strip-components=1 && rm -f "$FILE"
fi
echo "Node.js: $("$OPT/node/bin/node" -v)  (sistem: $(command -v node >/dev/null && node -v || echo yok))"

say "3/8 Servis kullanıcısı ve klasörler"
id gitmapp >/dev/null 2>&1 || useradd --system --no-create-home --shell /usr/sbin/nologin gitmapp
mkdir -p "$DATA" /etc/gitmapp && chown gitmapp:gitmapp "$DATA" && chmod 700 "$DATA"

say "4/8 Ayarlar ($ENVF)"
if [ ! -f "$ENVF" ]; then
  echo "Birkaç bilgi gerekiyor (sonradan $ENVF dosyasından değiştirebilirsiniz):"
  ADMIN_EMAIL=$(ask "  Yönetici e-posta adresiniz: ")
  AI_KEY=$(asks "  Hostinger AI Router API anahtarı (sk-hstgr-…, ekranda görünmez; şimdilik boş bırakabilirsiniz): ")
  HTOKEN=$(asks "  Hostinger API anahtarı (alan adı sorgusu için, isteğe bağlı): ")
  umask 077
  cat > "$ENVF" <<EOF
PORT=$PORT
DB_PATH=$DATA/data.db
SECRET=$(openssl rand -hex 32)
ADMIN_EMAIL=$ADMIN_EMAIL
SITE_URL=https://gitmapp.com
API_URL=https://api.gitmapp.com
APP_HOST=app.gitmapp.com
AI_BASE=https://router.hostinger.com/v1
AI_KEY=$AI_KEY
AI_MODEL=
HOSTINGER_API_TOKEN=$HTOKEN
GITHUB_CLIENT_ID=
GITHUB_CLIENT_SECRET=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
AI_DAILY_ANON=3
AI_DAILY_USER=40
EOF
  chmod 600 "$ENVF"; echo "Ayarlar kaydedildi."
else echo "Mevcut ayar dosyası korunuyor."; fi

say "5/8 Sistem servisi (gitmapp-api)"
cat > /etc/systemd/system/gitmapp-api.service <<EOF
[Unit]
Description=Gitmapp API
After=network.target
[Service]
User=gitmapp
EnvironmentFile=$ENVF
ExecStart=$OPT/node/bin/node --no-warnings $REPO_DIR/server/server.mjs
Restart=always
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=$DATA
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload && systemctl enable -q gitmapp-api && systemctl restart gitmapp-api
sleep 2; curl -fsS "http://127.0.0.1:$PORT/api/health" >/dev/null || { journalctl -u gitmapp-api -n 30 --no-pager; fail "API başlamadı (yukarıdaki kayıtlara bakın)."; }
echo "API çalışıyor: $(curl -s http://127.0.0.1:$PORT/api/health)"

say "6/8 Otomatik güncelleme (kod değişince API kendiliğinden yeniden başlar)"
cat > /usr/local/bin/gitmapp-update <<'EOF'
#!/usr/bin/env bash
cd /var/www/gitmapp || exit 0
OLD=$(git rev-parse HEAD); git pull -q --ff-only || exit 0; NEW=$(git rev-parse HEAD)
if [ "$OLD" != "$NEW" ] && ! git diff --quiet "$OLD" "$NEW" -- server/; then systemctl restart gitmapp-api; echo "$(date -Is) API yeniden başlatıldı ($NEW)"; fi
EOF
chmod 755 /usr/local/bin/gitmapp-update
echo "*/5 * * * * root /usr/local/bin/gitmapp-update >> /var/log/gitmapsite-pull.log 2>&1" > /etc/cron.d/gitmapsite && chmod 644 /etc/cron.d/gitmapsite

say "7/8 nginx: api.gitmapp.com ve app.gitmapp.com"
for H in api app; do
cat > /etc/nginx/sites-available/$H.gitmapp.com <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $H.gitmapp.com;
    client_max_body_size 3m;
    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
EOF
ln -sf /etc/nginx/sites-available/$H.gitmapp.com /etc/nginx/sites-enabled/$H.gitmapp.com
done
if ! nginx -t; then rm -f /etc/nginx/sites-enabled/api.gitmapp.com /etc/nginx/sites-enabled/app.gitmapp.com; fail "nginx ayarı hatalı, geri alındı. Diğer sitelere dokunulmadı."; fi
systemctl reload nginx
for H in api app; do
  for i in $(seq 1 30); do IP=$(getent ahostsv4 "$H.gitmapp.com" 2>/dev/null | awk 'NR==1{print $1}' || true); [ "$IP" = "$SERVER_IP" ] && break; echo "  $H.gitmapp.com DNS bekleniyor… ($i/30)"; sleep 20; done
  [ "$IP" = "$SERVER_IP" ] || fail "$H.gitmapp.com DNS kaydı henüz bu sunucuyu göstermiyor; 10 dk sonra betiği tekrar çalıştırın."
done
LE_EMAIL=$(grep -h '^ADMIN_EMAIL=' "$ENVF" | cut -d= -f2)
if [ -n "$LE_EMAIL" ]; then LE_ARGS=(-m "$LE_EMAIL"); else LE_ARGS=(--register-unsafely-without-email); fi
certbot --nginx -d api.gitmapp.com -d app.gitmapp.com --non-interactive --agree-tos "${LE_ARGS[@]}" --redirect --keep-until-expiring

say "8/8 Yönetici hesabı"
set -a; . "$ENVF"; set +a
if [ -n "${ADMIN_EMAIL:-}" ]; then sudo -u gitmapp -E "$OPT/node/bin/node" --no-warnings "$REPO_DIR/server/server.mjs" create-admin; else echo "ADMIN_EMAIL boş, yönetici oluşturulmadı."; fi

say "TAMAM ✓"
curl -s -o /dev/null -w "https://api.gitmapp.com/api/health → %{http_code}\n" https://api.gitmapp.com/api/health || true
echo "Yapay zekâ anahtarını sonradan eklemek için: nano $ENVF  →  AI_KEY=…  →  systemctl restart gitmapp-api"
