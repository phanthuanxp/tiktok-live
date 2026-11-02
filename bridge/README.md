# 📡 Cầu Nối TikTok Live (Bridge)

Chạy trên **máy ở Việt Nam**. Nghe phòng TikTok Live rồi bắn sự kiện vào VPS.

> **Tại sao cần?** IP VPS nước ngoài dễ bị TikTok chặn. Bridge chạy ở VN nên
> TikTok "thấy" IP Việt Nam → kết nối ổn định. VPS chỉ lo render + giọng đọc.

```
TikTok Live  ──►  Bridge (máy VN)  ──POST /rpc + token──►  VPS  ──►  OBS
```

---

## 🚀 Cài đặt (Windows — 3 bước)

**1.** Cài [Node.js](https://nodejs.org) (chọn bản **LTS**), nếu máy chưa có.

**2.** Copy thư mục `bridge` này về máy, rồi **double-click `START-BRIDGE.bat`**.
Lần đầu nó sẽ tự tạo file `.env` và mở Notepad cho điền.

**3.** Điền 3 dòng trong `.env` rồi lưu lại:

```ini
TIKTOK_USER=@tenkenh_cua_ban
VPS_RPC_URL=http://IP_VPS:3000/rpc
RPC_TOKEN=<token lấy từ file .env trên VPS>
```

Chạy lại `START-BRIDGE.bat`. Xong.

> File `.bat` tự cài thư viện lần đầu và **tự khởi chạy lại** nếu bridge bị dừng.

---

## ✅ Dấu hiệu chạy đúng

```
🪷 TIKTOK LIVE BRIDGE — Chùa Linh Ứng Online
   Phòng Live : @tenkenh
   Token      : ✅ có
🔗 VPS phản hồi OK (công đức hiện tại: 1080)
✅ Đã vào phòng @tenkenh (roomId: 7xxxxxxxx)
💬 Minh Tâm: thắp hương cầu bình an
❤️  Thanh Hà thả 12 tim
🎁 Hoàng Nam tặng Hoa Hồng (10 xu)
```

Cứ 5 phút bridge in một dòng thống kê để biết nó còn sống.

---

## 🎮 Sự kiện được chuyển thành nghi thức

| TikTok Live        | Gọi RPC                    | Trên Chánh Điện                          |
|:-------------------|:---------------------------|:-----------------------------------------|
| Bình luận          | `temple.comment`           | Server tự phân loại: thắp hương / cầu nguyện / xin xăm |
| Thả tim            | `temple.strikeWoodenFish`  | Gõ mõ (tối đa 15 tim mỗi đợt)            |
| Follow / Share     | `temple.ringBell`          | Thỉnh Đại Hồng Chung                     |
| Tặng quà           | `temple.offerGift`         | Dâng lễ; ≥100 xu tự nâng thành Đại Lễ    |

Quà gửi dồn (combo) chỉ tính **phần tăng thêm** nên không bị cộng trùng điểm.

---

## 🩺 Kiểm tra đường dây trước khi live (nên chạy đầu tiên)

Double-click **`KIEM-TRA.bat`**. Nó kiểm tra lần lượt: cấu hình → mạng tới VPS →
token → giọng đọc, rồi **in ra đúng đường dẫn để dán vào OBS** (đã kèm token).

Mỗi lỗi đều kèm cách sửa, ví dụ token không khớp hay Tailscale chưa bật.
Chỉ khi thấy `✅ ĐƯỜNG DÂY THÔNG` mới nên lên sóng.

---

## 🧪 Thử không cần Live thật

**Chế độ in thử (không gửi lên VPS)** — đặt trong `.env`:
```ini
DRY_RUN=1
```

**Bắn sự kiện giả lập để kiểm tra toàn trình** (cần VPS đang chạy):
```bash
npm install
node test-bridge.js
```
Script này giả lập bình luận, thả tim, follow, quà combo và quà lớn,
rồi gửi thật lên VPS — dùng để kiểm tra token và mapping có đúng không.

---

## 🧯 Gặp lỗi?

| Thông báo | Nguyên nhân & cách xử lý |
|:---|:---|
| `⛔ VPS từ chối: sai/thiếu RPC_TOKEN` | Token trong `.env` không khớp với `.env` trên VPS. Copy lại cho đúng. |
| `❌ Không gọi được VPS` | VPS chưa chạy, hoặc firewall/Security Group chưa mở cổng 3000 cho IP máy này. |
| `Chưa vào được phòng … không phát Live` | Kênh hiện không livestream. Bridge sẽ tự chờ và thử lại. |
| Bridge vào được nhưng không có sự kiện | Kiểm tra `TIKTOK_USER` đúng kênh đang Live chưa. |

Bridge tự kết nối lại khi mất mạng (giãn dần 5s → 60s).

---

## 📌 Lưu ý

- Bridge **không cần** mở cổng gì trên máy VN — nó chỉ gọi ra ngoài.
- Nên để VPS giới hạn firewall chỉ cho IP máy này gọi `/rpc` (an toàn hơn).
- Không chia sẻ `RPC_TOKEN` — ai có token là điều khiển được Chánh Điện.
