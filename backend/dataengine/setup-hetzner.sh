#!/usr/bin/env bash
# =============================================================================
#  PalNovaa Data Engine — تجهيز خادم Hetzner (Ubuntu 24.04)
#  يُشغَّل مرّةً واحدة على خادمٍ جديد بصلاحيّة root:
#     bash setup-hetzner.sh
#  آمنٌ للتكرار (idempotent): إعادة تشغيله لا تُفسد شيئاً.
# =============================================================================
set -euo pipefail

APP_USER="palnovaa"
APP_DIR="/opt/palnovaa"
DB_NAME="palnovaa_geo"
DB_USER="palnovaa"
REPO_URL="${REPO_URL:-https://github.com/MohammedAnwar18/AGQ-Map.git}"

say() { echo -e "\n\033[1;36m▸ $*\033[0m"; }

if [ "$(id -u)" -ne 0 ]; then echo "شغّله بصلاحيّة root"; exit 1; fi

# ---------------------------------------------------------------- 1) النظام
say "تحديث النظام والأساسيّات"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg lsb-release ufw git unzip htop

# ---------------------------------------------------- 2) Postgres 17 + PostGIS
say "تثبيت PostgreSQL 17 و PostGIS"
install -d /usr/share/postgresql-common/pgdg
curl -fsSL https://www.postgresql.org/media/keys/ACCC4CF8.asc \
  -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
echo "deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] \
http://apt.postgresql.org/pub/repos/apt $(lsb_release -cs)-pgdg main" \
  > /etc/apt/sources.list.d/pgdg.list
apt-get update -qq
apt-get install -y -qq postgresql-17 postgresql-17-postgis-3 postgresql-contrib-17
systemctl enable --now postgresql

# ------------------------------------------------- 3) قاعدة البيانات والمستخدم
say "إنشاء قاعدة البيانات"
DB_PASS="$(openssl rand -base64 24 | tr -d '/+=' | head -c 28)"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='${DB_USER}'" | grep -q 1 || \
  sudo -u postgres psql -qc "CREATE ROLE ${DB_USER} LOGIN PASSWORD '${DB_PASS}'"
sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='${DB_NAME}'" | grep -q 1 || \
  sudo -u postgres createdb -O "${DB_USER}" "${DB_NAME}"
sudo -u postgres psql -q -d "${DB_NAME}" -c "CREATE EXTENSION IF NOT EXISTS postgis"
sudo -u postgres psql -q -d "${DB_NAME}" -c "CREATE EXTENSION IF NOT EXISTS pg_trgm"
PG_VER=$(sudo -u postgres psql -tAc "SELECT postgis_version()" -d "${DB_NAME}" | head -1)
echo "   PostGIS: ${PG_VER}"

# ----------------------------------------------------- 4) ضبط Postgres للجهاز
say "ضبط Postgres حسب ذاكرة الجهاز"
MEM_MB=$(awk '/MemTotal/ {print int($2/1024)}' /proc/meminfo)
CPUS=$(nproc)
# work_mem يُضرَب في عدد الاستعلامات المتزامنة، فنحدّه حتى لا تنفد الذاكرة
WORK_MEM=$(( MEM_MB / 64 )); [ "$WORK_MEM" -gt 64 ] && WORK_MEM=64; [ "$WORK_MEM" -lt 8 ] && WORK_MEM=8
# صندوقٌ صغير لا يحتمل 100 اتّصال
MAXCONN=50; [ "$MEM_MB" -ge 8000 ] && MAXCONN=100
PARALLEL=$(( CPUS / 2 )); [ "$PARALLEL" -lt 1 ] && PARALLEL=1
CONF="/etc/postgresql/17/main/conf.d/palnovaa.conf"
mkdir -p "$(dirname "$CONF")"
cat > "$CONF" <<EOF
# ضبطٌ موجّهٌ لأحمال PostGIS — محسوبٌ من عتاد هذا الجهاز
shared_buffers = $(( MEM_MB / 4 ))MB
effective_cache_size = $(( MEM_MB * 3 / 4 ))MB
work_mem = ${WORK_MEM}MB
maintenance_work_mem = $(( MEM_MB / 8 ))MB
max_connections = $MAXCONN
random_page_cost = 1.1              # SSD
effective_io_concurrency = 200
max_parallel_workers_per_gather = $PARALLEL
jit = off                            # يضرّ باستعلامات MVT القصيرة
EOF
echo "   ذاكرة ${MEM_MB}MB · ${CPUS} نواة → work_mem=${WORK_MEM}MB · max_connections=${MAXCONN}"
systemctl restart postgresql

# ------------------------------------------------------------- 5) Node.js 22
say "تثبيت Node.js 22"
if ! command -v node >/dev/null || [ "$(node -v | cut -c2-3)" -lt 22 ]; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash - >/dev/null
  apt-get install -y -qq nodejs
fi
echo "   Node: $(node -v)"

# ---------------------------------------------------- 6) المستخدم وجلب الكود
say "تجهيز التطبيق"
id -u "${APP_USER}" >/dev/null 2>&1 || useradd -m -s /bin/bash "${APP_USER}"
mkdir -p "${APP_DIR}"
if [ -d "${APP_DIR}/.git" ]; then
  git -C "${APP_DIR}" pull --ff-only || true
else
  git clone --depth 1 "${REPO_URL}" "${APP_DIR}"
fi
chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"
sudo -u "${APP_USER}" bash -lc "cd ${APP_DIR}/backend && npm install --omit=dev --no-audit --no-fund"

# بيئة العامل — تُكتَب مرّةً ولا تُدهَس
ENV_FILE="${APP_DIR}/backend/.env"
if [ ! -f "${ENV_FILE}" ]; then
  cat > "${ENV_FILE}" <<EOF
NODE_ENV=production
DATABASE_URL=postgresql://${DB_USER}:${DB_PASS}@localhost:5432/${DB_NAME}
DATAENGINE_POLL_MS=5000
EOF
  chown "${APP_USER}:${APP_USER}" "${ENV_FILE}"; chmod 600 "${ENV_FILE}"
  echo "   أُنشئ .env بكلمة مرورٍ جديدة"
else
  echo "   .env موجودٌ — لم يُمَسّ"
fi

# ------------------------------------------------------- 7) خدمة العامل
say "تسجيل عامل الترحيل كخدمة"
cat > /etc/systemd/system/palnovaa-worker.service <<EOF
[Unit]
Description=PalNovaa Data Engine — عامل الترحيل
After=network.target postgresql.service
Requires=postgresql.service

[Service]
Type=simple
User=${APP_USER}
WorkingDirectory=${APP_DIR}/backend
ExecStart=/usr/bin/node dataengine/worker.js
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal
# حمايةٌ أساسيّة
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=${APP_DIR}

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now palnovaa-worker

# ------------------------------------------------------------ 8) جدار الحماية
say "ضبط جدار الحماية"
ufw allow 22/tcp  >/dev/null
ufw allow 80/tcp  >/dev/null
ufw allow 443/tcp >/dev/null
ufw --force enable >/dev/null
echo "   مسموح: 22 / 80 / 443 فقط — Postgres غير مكشوفٍ للإنترنت"

# ------------------------------------------------------- 9) نسخٌ احتياطيّ يوميّ
say "جدولة نسخةٍ احتياطيّة يوميّة"
mkdir -p /var/backups/palnovaa
cat > /usr/local/bin/palnovaa-backup <<EOF
#!/usr/bin/env bash
set -e
F="/var/backups/palnovaa/${DB_NAME}-\$(date +%F).dump"
# لا ننسخ إن تجاوز القرص 85% — النسخة لا تستحقّ إسقاط الخدمة
USE=\$(df --output=pcent /var | tail -1 | tr -dc "0-9")
if [ "\$USE" -ge 85 ]; then echo "تخطّي النسخ: القرص ممتلئ \${USE}%"; exit 0; fi
sudo -u postgres pg_dump -Fc "${DB_NAME}" > "\$F"
# قرصٌ صغير ⇒ ثلاث نسخٍ فقط
find /var/backups/palnovaa -name '*.dump' -mtime +3 -delete
EOF
chmod +x /usr/local/bin/palnovaa-backup
echo "15 3 * * * root /usr/local/bin/palnovaa-backup" > /etc/cron.d/palnovaa-backup

# ------------------------------------------------------------------ الخلاصة
cat <<EOF

════════════════════════════════════════════════════════════════
 ✅ جاهز

 القاعدة     : ${DB_NAME}   (PostGIS ${PG_VER})
 الاتّصال     : postgresql://${DB_USER}:***@localhost:5432/${DB_NAME}
 كلمة المرور : ${DB_PASS}
               ↑ انسخها الآن — لن تُعرَض ثانية (محفوظةٌ في ${ENV_FILE})

 العامل      : systemctl status palnovaa-worker
 السجلّ       : journalctl -u palnovaa-worker -f
 نسخٌ احتياطيّ: يوميّاً 03:15 → /var/backups/palnovaa (3 أيّام)
 راقب المساحة : df -h /   — القرص الصغير يمتلئ بالبيانات الجغرافيّة بسرعة

 التالي: افتح Postgres للوصول الخارجيّ فقط إن لزم، والأفضل تشغيل
         واجهة البيانات على هذا الخادم نفسه خلف Caddy.
════════════════════════════════════════════════════════════════
EOF
