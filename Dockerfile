# ─────────────────────────────────────────────────────────────
# Chùa Linh Ứng Online — TikTok Live RPC Temple
# Image: Bun.js (server) + Python ZeroTTS (worker giọng đọc)
# Kiến trúc A: VPS chạy render + TTS + JSON-RPC (KHÔNG gọi live.connect)
# ─────────────────────────────────────────────────────────────
FROM oven/bun:1-debian

# Gói hệ thống cần cho ZeroTTS (âm thanh) + python venv
RUN apt-get update && apt-get install -y --no-install-recommends \
        python3 python3-pip python3-venv \
        ffmpeg libsndfile1 ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1) Cài dependencies Node/Bun trước (tận dụng cache layer)
COPY package.json package-lock.json* ./
RUN bun install

# 2) Tạo venv Python + cài ZeroTTS (server tự tìm .venv/bin/python)
RUN python3 -m venv .venv \
    && . .venv/bin/activate \
    && pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir zerotts pillow

# 3) Copy toàn bộ source
COPY . .

# Thư mục dữ liệu bền vững (merit-state.json + tts-cache) → mount volume
RUN mkdir -p data/tts-cache

# Cache model HuggingFace nằm ở đây để mount volume, khỏi tải lại mỗi lần
ENV HF_HOME=/app/.hf-cache
ENV PORT=3000

EXPOSE 3000

CMD ["bun", "run", "server.js"]
