#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────
#  Chùa Linh Ứng Online — Cài đặt 1 lệnh trên VPS (Ubuntu/Debian)
#  Kiến trúc A: VPS chạy render + ZeroTTS + JSON-RPC. KHÔNG gọi live.connect.
#  Cách dùng:   bash install-vps.sh
# ──────────────────────────────────────────────────────────────────────────
set -euo pipefail

REPO_URL="https://github.com/zane-tv/tiktok-live-temple-rpc.git"
APP_DIR="${APP_DIR:-$HOME/temple-rpc}"
PORT="${PORT:-3000}"

echo "==> [1/5] Kiểm tra & cài Docker (nếu thiếu)…"
if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker || true
fi
# docker compose v2 (plugin). Nếu thiếu, thử gói plugin.
if ! docker compose version >/dev/null 2>&1; then
  apt-get update -y && apt-get install -y docker-compose-plugin || true
fi

echo "==> [2/5] Lấy source về $APP_DIR…"
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull --ff-only || true
else
  git clone --depth 1 "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

echo "==> [2b/5] Vá Kiến trúc A: tắt auto-connect TikTok trên VPS…"
# 1) Auto-connect chỉ dựa vào TIKTOK_USER (bỏ fallback 'zenfacts_vn')
sed -i "s#process.env.TIKTOK_USER || state.tiktok?.username || 'zenfacts_vn'#process.env.TIKTOK_USER || ''#g" server.js
# 2) Bỏ username mặc định trong initial state
sed -i "s#username: 'zenfacts_vn',#username: '',#g" server.js

echo "==> [3/5] Ghi file Docker (Dockerfile / compose / .dockerignore)…"
cat > Dockerfile <<'DOCKER_EOF'
FROM oven/bun:1-debian
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 python3-pip python3-venv \
        ffmpeg libsndfile1 ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package.json package-lock.json* ./
RUN bun install
RUN python3 -m venv .venv \
    && . .venv/bin/activate \
    && pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir zerotts pillow
COPY . .
RUN mkdir -p data/tts-cache
ENV HF_HOME=/app/.hf-cache
ENV PORT=3000
EXPOSE 3000
CMD ["bun", "run", "server.js"]
DOCKER_EOF

cat > docker-compose.yml <<COMPOSE_EOF
services:
  temple:
    build: .
    image: temple-rpc:latest
    container_name: temple-rpc
    restart: unless-stopped
    ports:
      - "${PORT}:3000"
    environment:
      - PORT=3000
      - TIKTOK_USER=
    volumes:
      - temple-data:/app/data
      - temple-hf-cache:/app/.hf-cache
volumes:
  temple-data:
  temple-hf-cache:
COMPOSE_EOF

cat > .dockerignore <<'IGN_EOF'
node_modules
.venv
.hf-cache
data
dist
.git
*.log
*.m4a
.DS_Store
IGN_EOF

echo "==> [4/5] Build image (lần đầu hơi lâu vì cài ZeroTTS)…"
docker compose build

echo "==> [5/5] Khởi chạy…"
docker compose up -d

IP=$(curl -fsS ifconfig.me 2>/dev/null || echo "IP_VPS")
echo
echo "────────────────────────────────────────────────────────"
echo " ✅ ĐÃ CHẠY. Kiểm tra:"
echo "   • Màn hình Live  : http://$IP:$PORT"
echo "   • OBS 9:16 (sạch): http://$IP:$PORT/?obs=1"
echo "   • Admin / RPC    : http://$IP:$PORT/admin"
echo
echo " Xem log giọng đọc tải model lần đầu:"
echo "   docker compose logs -f temple"
echo "────────────────────────────────────────────────────────"
