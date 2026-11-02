# 🔴 CHECKLIST LÊN SÓNG — Chùa Linh Ứng Online

Thứ tự bắt buộc. Mỗi bước có cách tự kiểm tra.
Tổng thời gian: **~40 phút** nếu không vướng.

---

## BƯỚC 1 — Cập nhật VPS + bật bảo mật  ⏱️ ~10 phút
*(giao cho openclaw chạy trên VPS)*

```bash
cd ~/temple-rpc
docker compose down
git remote set-url origin https://github.com/phanthuanxp/tiktok-live
git fetch origin main && git reset --hard origin/main
echo "RPC_TOKEN=$(openssl rand -hex 24)" > .env && chmod 600 .env
cat .env          # 📋 GHI LẠI TOKEN NÀY
docker compose up -d --build
```

**✅ Kiểm tra (bắt buộc đúng cả 3):**
```bash
TOKEN=$(grep -oP 'RPC_TOKEN=\K.*' .env); B=http://localhost:3000/rpc; H='Content-Type: application/json'
curl -s -X POST $B -H "$H" -d '{"jsonrpc":"2.0","id":1,"method":"temple.getState"}' | grep -o '"totalMerit":[0-9]*'
curl -s -X POST $B -H "$H" -d '{"jsonrpc":"2.0","id":2,"method":"temple.resetMerit"}'
curl -s -X POST $B -H "$H" -H "x-rpc-token: $TOKEN" -d '{"jsonrpc":"2.0","id":3,"method":"temple.burnIncense","params":{"user":"Test","count":3}}' | grep -o '"merit":[0-9]*'
```
Đúng khi: (1) ra `totalMerit`, (2) ra lỗi `-32001`, (3) ra `merit`.

---

## BƯỚC 2 — Mở cổng cho đúng 2 máy  ⏱️ ~5 phút

Lấy IP công khai của **máy livestream** (mở ifconfig.me trên máy đó), rồi trên VPS:
```bash
ufw allow from <IP_MAY_LIVESTREAM> to any port 3000 proto tcp
ufw enable
```
⚠️ Mở cổng **3000/tcp** trong Security Group của nhà cung cấp VPS nữa.

**✅ Kiểm tra:** trên máy livestream mở `http://IP_VPS:3000/?obs=1&token=<RPC_TOKEN>` → thấy Chánh Điện.

> IP nhà thường đổi. Nếu mai không vào được → xin lại IP mới và `ufw allow` lại.

---

## BƯỚC 3 — Nhạc nền tụng niệm  ⏱️ ~5 phút  ⚠️ QUAN TRỌNG

Repo **không kèm** nhạc nền (tác giả gốc loại trừ). Không có nó, nền chỉ là
chuỗi nốt đơn 3,6 giây/tiếng — nghe rất trống.

Copy file nhạc lên VPS, đặt **đúng tên**:
```bash
scp nhac-tung-niem.m4a root@IP_VPS:~/temple-rpc/public/assets/bg_chant.m4a
# rồi trên VPS:
cd ~/temple-rpc && docker compose up -d --build
```

🚨 **Bản quyền:** TikTok tự quét nhạc. Dùng nhạc có bản quyền → live bị **tắt tiếng
hoặc khóa**. Hãy dùng nhạc tự thu, nhạc miễn phí bản quyền, hoặc tiếng tụng do
chùa/người thu cho phép dùng.

---

## BƯỚC 4 — Cầu nối trên máy livestream  ⏱️ ~10 phút

1. Cài **Node.js LTS**: https://nodejs.org
2. Giải nén thư mục `bridge` (hoặc lấy từ repo) ra Desktop
3. Double-click **`START-BRIDGE.bat`** → nó tạo `.env`, mở Notepad
4. Điền rồi lưu:
```ini
TIKTOK_USER=@tenkenh_cua_ban
VPS_RPC_URL=http://IP_VPS:3000/rpc
RPC_TOKEN=<token ở Bước 1>
```
5. Chạy lại `START-BRIDGE.bat`

**✅ Kiểm tra:** phải thấy `🔗 VPS phản hồi OK`.
Nếu kênh chưa Live, bridge sẽ chờ — đó là bình thường.

**Thử trước khi Live thật** (cần cài thư viện: `npm install` trong thư mục bridge):
```bash
node test-bridge.js
```
→ Mở `http://IP_VPS:3000/?obs=1&token=<RPC_TOKEN>`, phải thấy Phật tử đảnh lễ + nghe giọng đọc.

---

## BƯỚC 5 — OBS  ⏱️ ~5 phút

1. Tạo **Browser Source**
   - URL: `http://IP_VPS:3000/?obs=1&token=<RPC_TOKEN>`
     ⚠️ **Phải kèm `&token=`** — không có token thì hiện hình nhưng **không có
     giọng đọc** (giọng đọc đã được khóa để người lạ không bắt VPS đọc tùy ý).
   - Width **1080**, Height **1920**
2. ⚠️ **TÍCH "Control audio via OBS"** — không tích thì khán giả **không nghe**
   được giọng đọc và tiếng chuông mõ.
3. Canvas/Output: **1080×1920**, FPS 30
4. Kiểm tra cột âm lượng của Browser Source có nhảy khi có giọng đọc.

---

## BƯỚC 6 — Chạy thử trước khi mở cho khán giả  ⏱️ ~5 phút

1. Bật Live ở chế độ riêng tư / hoặc live thử bằng tài khoản phụ
2. Tự bình luận: `thắp hương`, `xin xăm`, `cầu bình an`
3. Tự thả tim, follow
4. Xác nhận trên OBS: nhân vật đảnh lễ, có giọng đọc, công đức tăng

Chỉ khi cả 4 mục chạy mới mở Live chính thức.

---

## 🧯 LỖI THƯỜNG GẶP

| Hiện tượng | Nguyên nhân |
|:---|:---|
| OBS trắng/không tải | Chưa mở cổng 3000, hoặc sai IP |
| Có hình nhưng không tiếng | Chưa tích **"Control audio via OBS"**, hoặc URL OBS thiếu `&token=` |
| Bridge báo `⛔ sai/thiếu RPC_TOKEN` | Token máy livestream khác token VPS |
| Bridge báo `❌ Không gọi được VPS` | Firewall/Security Group chưa mở cho IP máy này |
| Bình luận không ra nghi thức | Mỗi người bị giới hạn 3,5 giây/lần (chống spam) — bình thường |
| Nền chỉ có tiếng "ting" lẻ | Thiếu `bg_chant.m4a` (Bước 3) |
| Giọng đọc chậm/trễ | ZeroTTS nặng CPU; hàng đợi giới hạn 6 câu, câu cũ bị bỏ — bình thường khi đông |

---

## ⚠️ LƯU Ý TRƯỚC KHI LIVE DÀI HẠN

- **Điều khoản TikTok:** tự động hóa tương tác Live là vùng xám. Nên thử nghiệm
  bằng tài khoản phụ trước khi dùng kênh chính, tránh rủi ro mất kênh.
- **Token:** không chia sẻ. Ai có token là điều khiển được Chánh Điện.
- **Trang `/admin`** hiện ai biết link cũng mở xem được (lệnh thì đã khóa bằng
  token). Nếu muốn khóa hẳn trang → dùng Caddy + mật khẩu (xem hướng dẫn bảo mật).
