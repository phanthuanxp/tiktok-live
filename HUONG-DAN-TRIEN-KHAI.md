# 🪷 Hướng Dẫn Triển Khai VPS — Chùa Linh Ứng Online

> **Kiến trúc A**: VPS lo phần nặng (render giao diện + giọng đọc ZeroTTS + JSON-RPC).
> Phần "nghe TikTok Live" KHÔNG chạy trên VPS nước ngoài (để tránh bị TikTok chặn IP),
> mà do máy ở Việt Nam đảm nhiệm (xem Phase 2 cuối tài liệu).

---

## ✅ Yêu cầu VPS
- Ubuntu/Debian, RAM ≥ 2GB (anh có 4GB → thoải mái), 2 vCPU trở lên.
- Mở cổng `3000` (hoặc đặt sau Nginx + HTTPS — xem mục nâng cao).
- Không cần GPU.

---

## 🚀 Cài đặt (dùng file `install-vps.sh` đính kèm)

SSH vào VPS bằng cách anh vẫn dùng, rồi đưa file `install-vps.sh` lên VPS theo 1 trong 2 cách:

**Cách 1 — tạo file trực tiếp trên VPS (không cần công cụ gì):**
```bash
nano install-vps.sh      # dán toàn bộ nội dung file → Ctrl+O, Enter, Ctrl+X
bash install-vps.sh
```

**Cách 2 — nếu dùng scp từ máy Windows:**
```powershell
scp install-vps.sh user@IP_VPS:~/
ssh user@IP_VPS "bash ~/install-vps.sh"
```

Script tự động: cài Docker → tải source → **vá Kiến trúc A (tắt auto-connect)** →
ghi file Docker → build → chạy nền.
Lần đầu build hơi lâu vì phải cài ZeroTTS; lần sau rất nhanh.
Lần chạy đầu, giọng đọc sẽ tải model `zeroweight-ai/ZeroTTS` từ HuggingFace
(cần internet trên VPS — chỉ tải 1 lần, sau đó lưu trong volume).

Sau khi xong:
- Màn hình Live:        `http://IP_VPS:3000`
- OBS 9:16 (sạch):      `http://IP_VPS:3000/?obs=1`  → đặt Browser Source `1080×1920`
- Admin / JSON-RPC:     `http://IP_VPS:3000/admin`

---

## 🔧 Lệnh vận hành thường dùng

```bash
cd ~/temple-rpc
docker compose logs -f temple     # xem log (tải model giọng đọc lần đầu)
docker compose restart            # khởi động lại
docker compose down               # tắt
docker compose up -d --build      # cập nhật & chạy lại sau khi sửa code
```

Dữ liệu công đức và cache giọng đọc nằm trong Docker volume `temple-data`,
**không mất** khi restart/redeploy.

---

## 🧪 Kiểm tra nhanh nghi thức (không cần TikTok)

```bash
curl -X POST http://IP_VPS:3000/rpc -H "Content-Type: application/json" -d '{
  "jsonrpc":"2.0","id":1,"method":"temple.burnIncense",
  "params":{"user":"Thí Chủ Minh Tâm","count":3,"wish":"Cầu bình an"}
}'
```
Mở `http://IP_VPS:3000/?obs=1` sẽ thấy Phật tử bước lên đảnh lễ + nghe giọng đọc.

---

## 🔒 Nâng cao (khuyến nghị khi chạy thật)

1. **HTTPS + tên miền**: đặt Nginx reverse proxy trỏ về `127.0.0.1:3000`,
   cấp SSL bằng Let's Encrypt (`certbot`). Giúp OBS/websocket không bị chặn.
2. **Bảo mật trang /admin**: hiện ai có link cũng vào được → nên thêm
   Basic Auth ở tầng Nginx, hoặc giới hạn IP. (Có thể làm ở bước nâng cấp.)
3. **Firewall**: chỉ mở 80/443 (nếu dùng Nginx), đóng 3000 ra ngoài.

---

## 📡 PHASE 2 — Nghe TikTok Live từ máy Việt Nam (làm sau)

Vì IP VPS nước ngoài dễ bị TikTok chặn, phần `live.connect` sẽ chạy ở VN:

- **Cách nhanh**: dùng **TikFinity / Streamer.bot** trên máy VN, cấu hình
  mỗi sự kiện (comment/tim/quà) → gọi `POST http://IP_VPS:3000/rpc` với method
  tương ứng (`temple.burnIncense`, `temple.offerGift`…).
- **Cách gọn hơn (cần code thêm)**: viết một "bridge" nhỏ chạy trên máy VN,
  dùng `tiktok-live-connector` kết nối phòng Live rồi tự động bắn sự kiện vào
  `/rpc` của VPS. Phần này em sẽ dựng cho anh ở bước nâng cấp.

> Bảng method đầy đủ xem trong `README.md` mục "Giao Thức JSON-RPC 2.0".
