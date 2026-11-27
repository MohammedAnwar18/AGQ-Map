#!/usr/bin/env bash
# =============================================================================
#  PalNovaa Data API — نشرُ الواجهة خلف Caddy بشهادة HTTPS تلقائيّة
#  يُشغَّل بعد setup-hetzner.sh:
#     DOMAIN=data.palnovaa.com bash setup-api.sh
#  آمنٌ للتكرار.
# =============================================================================
set -euo pipefail

APP_DIR="/opt/palnovaa"
APP_USER="palnovaa"
DOMAIN="${DOMAIN:-}"
PORT="${PORT:-8080}"
ORIGINS="${ORIGINS:-https://palnovaa.com,https://www.palnovaa.com}"

say() { echo -e "\n\033[1;36m▸ $*\033[0m"; }
if [ "$(id -u)" -ne 0 ]; then echo "شغّله بصلاحيّة root"; exit 1; fi
if [ -z "$DOMAIN" ]; then echo "حدّد النطاق:  DOMAIN=data.palnovaa.com bash setup-api.sh"; exit 1; fi
if [ ! -d "$APP_DIR" ]; then echo "شغّل setup-hetzner.sh أوّلاً"; exit 1; fi

# ------------------------------------------------- 1) التحقّق من توجيه النطاق
say "التحقّق من أنّ $DOMAIN يشير إلى هذا الخادم"
MYIP="$(curl -4 -fsS --max-time 10 https://ifconfig.me || echo '')"
DNSIP="$(getent ahostsv4 "$DOMAIN" 2>/dev/null | awk 'NR==1{print $1}' || echo '')"
echo "   الخادم: ${MYIP:-?}   |   النطاق: ${DNSIP:-لم يُحَلّ}"
if [ -z "$DNSIP" ]; then
  echo "   ⚠️  لم يُحَلّ النطاق بعد. أضِف سجلّ A ثمّ أعِد التشغيل."; exit 1
fi
if [ -n "$MYIP" ] && [ "$DNSIP" != "$MYIP" ]; then
  echo "   ⚠️  النطاق يشير إلى $DNSIP لا إلى هذا الخادم."
  echo "      إن كان على Cloudflare فاجعل الـProxy رماديّاً (DNS only) —"
  echo "      المُمرَّر (برتقاليّ) يمنع Let's Encrypt ويُفعّل Worker على النطاق."
  exit 1
fi
echo "   ✅ التوجيه صحيح"

# -------------------------------------------------------- 2) أسرار الخدمة
ENV_FILE="${APP_DIR}/backend/.env"
say "ضبط بيئة الواجهة"
touch "$ENV_FILE"
set_env() {   # set_env KEY VALUE — يضيف أو يستبدل بلا تكرار
  if grep -q "^$1=" "$ENV_FILE"; then sed -i "s|^$1=.*|$1=$2|" "$ENV_FILE";
  else echo "$1=$2" >> "$ENV_FILE"; fi
}
set_env DATA_API_PORT "$PORT"
set_env DATA_API_ORIGINS "$ORIGINS"
chown "${APP_USER}:${APP_USER}" "$ENV_FILE"; chmod 600 "$ENV_FILE"

if ! grep -q '^JWT_SECRET=' "$ENV_FILE"; then
  echo ""
  echo "   ⚠️  JWT_SECRET غير موجود — بدونه ترفض مسارات الأدمن كلّ طلب."
  echo "      انسخ القيمة نفسها من متغيّرات Vercel ثمّ:"
  echo "        nano ${ENV_FILE}     وأضِف سطراً:  JWT_SECRET=القيمة"
  echo "        systemctl restart palnovaa-api"
  echo ""
fi

# ------------------------------------------------------------- 3) الخدمة
say "تسجيل خدمة الواجهة"
cat > /etc/systemd/system/palnovaa-api.service <<EOF
[Unit]
Description=PalNovaa Data API
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIR}/backend
ExecStart=/usr/bin/node dataengine/api-server.js
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=${APP_DIR}

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now palnovaa-api
sleep 2
systemctl is-active --quiet palnovaa-api && echo "   ✅ الخدمة تعمل" || { echo "   ❌ فشلت:"; journalctl -u palnovaa-api -n 15 --no-pager; exit 1; }

# -------------------------------------------------------------- 4) Caddy
say "تثبيت Caddy وإصدار شهادة HTTPS"
if ! command -v caddy >/dev/null; then
  apt-get install -y -qq debian-keyring debian-archive-keyring apt-transport-https curl
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' \
    | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' \
    | tee /etc/apt/sources.list.d/caddy-stable.list >/dev/null
  apt-get update -qq
  apt-get install -y -qq caddy
fi

cat > /etc/caddy/Caddyfile <<EOF
${DOMAIN} {
    encode gzip zstd
    # البلاطات ثابتةٌ عمليّاً — نسمح بتخزينها على الحافّة والمتصفّح
    @tiles path /api/data/tiles/*
    header @tiles Cache-Control "public, max-age=3600, s-maxage=86400"
    reverse_proxy 127.0.0.1:${PORT}
    log {
        output file /var/log/caddy/palnovaa.log {
            roll_size 20mb
            roll_keep 5
        }
    }
}
EOF
mkdir -p /var/log/caddy && chown caddy:caddy /var/log/caddy
systemctl enable caddy >/dev/null 2>&1 || true
systemctl restart caddy
sleep 4

# ------------------------------------------------------------- 5) تحقّق
say "اختبار الواجهة"
LOCAL="$(curl -fsS --max-time 10 "http://127.0.0.1:${PORT}/health" || echo 'FAIL')"
echo "   محلّيّاً : ${LOCAL:0:120}"
PUBLIC="$(curl -fsS --max-time 25 "https://${DOMAIN}/health" || echo 'FAIL')"
echo "   عبر HTTPS: ${PUBLIC:0:120}"

cat <<EOF

════════════════════════════════════════════════════════════════
 ✅ واجهة البيانات منشورة

 العنوان : https://${DOMAIN}
 الفحص   : https://${DOMAIN}/health
 الخدمة  : systemctl status palnovaa-api
 السجلّ   : journalctl -u palnovaa-api -f

 الخطوة الأخيرة على Vercel — أضِف متغيّراً للواجهة:
   VITE_DATA_API = https://${DOMAIN}/api
 ثمّ Redeploy.
════════════════════════════════════════════════════════════════
EOF
