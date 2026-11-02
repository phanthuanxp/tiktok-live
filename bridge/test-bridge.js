/**
 * Test harness: giả lập sự kiện TikTok Live để kiểm tra bridge gửi RPC đúng.
 * Chạy: node test-bridge.js   (cần server chạy ở VPS_RPC_URL trong .env)
 */
'use strict';
const path = require('path');
const { EventEmitter } = require('events');

// ── Thay thư viện tiktok-live-connector bằng bản giả lập ──────────────────
const realPath = require.resolve('tiktok-live-connector');
const WebcastEvent = {
  CHAT: 'chat', LIKE: 'like', GIFT: 'gift', FOLLOW: 'follow',
  SHARE: 'share', SOCIAL: 'social', MEMBER: 'member', ROOM_USER: 'roomUser'
};
const ControlEvent = { CONNECTED: 'connected', DISCONNECTED: 'disconnected', ERROR: 'error' };

let fakeConn = null;
class FakeConnection extends EventEmitter {
  constructor(user, opts) { super(); this.user = user; this.opts = opts; fakeConn = this; }
  async connect() {
    setImmediate(() => this.emit(ControlEvent.CONNECTED, { roomId: 'FAKE_ROOM_1' }));
    return { roomId: 'FAKE_ROOM_1' };
  }
  disconnect() {}
}
require.cache[realPath] = {
  id: realPath, filename: realPath, loaded: true, exports:
    { TikTokLiveConnection: FakeConnection, WebcastEvent, ControlEvent }
};

// ── Nạp bridge (nó sẽ dùng FakeConnection) ────────────────────────────────
process.env.TIKTOK_USER = process.env.TIKTOK_USER || 'test_channel';
require('./bridge.js');

// ── Bắn các sự kiện giả lập ───────────────────────────────────────────────
const U = (nick, id) => ({ user: { nickname: nick, uniqueId: id, profilePictureUrl: '' } });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  await sleep(1500); // chờ preflight + connect
  if (!fakeConn) { console.error('❌ Bridge chưa tạo connection'); process.exit(1); }
  console.log('\n═══ BẮT ĐẦU BẮN SỰ KIỆN GIẢ LẬP ═══\n');

  // 1. Bình luận thắp hương
  fakeConn.emit('chat', { ...U('Minh Tâm', 'minhtam01'), comment: 'thắp hương cầu bình an' });
  await sleep(400);

  // 2. Bình luận xin xăm
  fakeConn.emit('chat', { ...U('Ngọc Anh', 'ngocanh98'), comment: 'xin xăm đầu năm' });
  await sleep(400);

  // 3. Thả tim (test giới hạn 15)
  fakeConn.emit('like', { ...U('Thanh Hà', 'thanhha'), count: 99 });
  await sleep(400);

  // 4. Follow
  fakeConn.emit('follow', U('Đức Thịnh', 'ducthinh88'));
  await sleep(400);

  // 5. Quà combo: 3 lần dồn (1 → 3 → 5), mỗi xu 10 → phải chỉ cộng phần tăng thêm
  const giftBase = { ...U('Hoàng Nam', 'hoangnam'), giftId: 5655, groupId: 'G1',
    gift: { id: 5655, name: 'Hoa Hồng', diamondCount: 10 } };
  fakeConn.emit('gift', { ...giftBase, repeatCount: 1 });
  await sleep(300);
  fakeConn.emit('gift', { ...giftBase, repeatCount: 3 });
  await sleep(300);
  fakeConn.emit('gift', { ...giftBase, repeatCount: 5, repeatEnd: true });
  await sleep(300);
  // Gửi lại repeatEnd trùng → phải bị bỏ qua
  fakeConn.emit('gift', { ...giftBase, repeatCount: 5, repeatEnd: true });
  await sleep(300);

  // 6. Quà lớn ≥100 xu → Đại Lễ
  fakeConn.emit('gift', { ...U('Đại Thí Chủ', 'daithichu'), giftId: 7, groupId: 'G2',
    gift: { id: 7, name: 'Kim Long', diamondCount: 500 }, repeatCount: 1, repeatEnd: true });
  await sleep(800);

  console.log('\n═══ XONG. Kiểm tra tổng công đức trên server ═══');
  process.exit(0);
})();
