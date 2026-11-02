#!/usr/bin/env node
/**
 * ──────────────────────────────────────────────────────────────────────────
 *  TIKTOK LIVE BRIDGE — Chùa Linh Ứng Online
 *  Chạy trên máy ở Việt Nam. Nghe phòng TikTok Live rồi bắn sự kiện
 *  (bình luận / thả tim / follow / share / tặng quà) vào JSON-RPC của VPS.
 *
 *  Vì sao cần bridge: IP VPS nước ngoài hay bị TikTok chặn. Bridge chạy ở VN
 *  nên TikTok "thấy" IP Việt Nam → kết nối ổn định. VPS chỉ lo render + giọng đọc.
 *
 *  Cấu hình qua file .env (xem .env.example):
 *    TIKTOK_USER=@tenkenh
 *    VPS_RPC_URL=http://IP_VPS:3000/rpc
 *    RPC_TOKEN=<token của VPS>
 * ──────────────────────────────────────────────────────────────────────────
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { TikTokLiveConnection, WebcastEvent, ControlEvent } = require('tiktok-live-connector');

// ── 1. Nạp cấu hình từ .env (không cần thư viện ngoài) ────────────────────
function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
    }
  }
}
loadEnv();

const TIKTOK_USER = (process.env.TIKTOK_USER || '').replace(/^@/, '').trim();
const VPS_RPC_URL = (process.env.VPS_RPC_URL || 'http://127.0.0.1:3000/rpc').trim();
const RPC_TOKEN = (process.env.RPC_TOKEN || '').trim();
const DRY_RUN = /^(1|true|yes)$/i.test(process.env.DRY_RUN || '');
const LIKE_CAP = 15; // giống server gốc: mỗi đợt tim tối đa 15

if (!TIKTOK_USER) {
  console.error('❌ Thiếu TIKTOK_USER trong .env (ví dụ: TIKTOK_USER=@zenfacts_vn)');
  process.exit(1);
}

console.log('─'.repeat(64));
console.log('🪷 TIKTOK LIVE BRIDGE — Chùa Linh Ứng Online');
console.log(`   Phòng Live : @${TIKTOK_USER}`);
console.log(`   VPS RPC    : ${VPS_RPC_URL}`);
console.log(`   Token      : ${RPC_TOKEN ? '✅ có' : '⚠️  TRỐNG (VPS sẽ chặn nếu đã bật bảo mật)'}`);
if (DRY_RUN) console.log('   Chế độ     : DRY_RUN (chỉ in ra, không gửi lên VPS)');
console.log('─'.repeat(64));

// ── 2. Gửi lệnh JSON-RPC lên VPS ──────────────────────────────────────────
let rpcId = 1;
const stats = { sent: 0, failed: 0, byMethod: {} };

async function callRpc(method, params) {
  stats.byMethod[method] = (stats.byMethod[method] || 0) + 1;
  if (DRY_RUN) {
    console.log(`   [DRY] ${method}`, JSON.stringify(params).slice(0, 140));
    return;
  }
  try {
    const res = await fetch(VPS_RPC_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(RPC_TOKEN ? { 'x-rpc-token': RPC_TOKEN } : {})
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: rpcId++, method, params }),
      signal: AbortSignal.timeout(12000)
    });
    const data = await res.json().catch(() => null);
    if (data?.error) {
      stats.failed++;
      const msg = data.error.message || '';
      if (data.error.code === -32001) {
        console.error(`   ⛔ VPS từ chối (${method}): sai/thiếu RPC_TOKEN → kiểm tra .env`);
      } else {
        console.error(`   ⚠️  VPS báo lỗi (${method}): ${msg}`);
      }
      return;
    }
    stats.sent++;
  } catch (err) {
    stats.failed++;
    console.error(`   ⚠️  Không gửi được (${method}): ${err.message}`);
  }
}

// ── 3. Trích thông tin người xem (giống hệt server gốc) ───────────────────
function extractUser(data) {
  const u = data?.user || data || {};
  const uniqueId = u.uniqueId || u.displayId || data?.uniqueId || '';
  const user = u.nickname || uniqueId || data?.nickname || 'Thí Chủ';
  const avatar =
    u.profilePictureUrl ||
    u.avatarLarge?.urlList?.[0] ||
    u.avatarThumb?.urlList?.[0] ||
    u.avatarMedium?.urlList?.[0] ||
    data?.profilePictureUrl ||
    '';
  return { user, uniqueId, avatar };
}

// ── 4. Kết nối & lắng nghe phòng Live ─────────────────────────────────────
const giftComboTracker = new Map(); // chống đếm trùng khi quà gửi liên tiếp (combo)
let conn = null;
let retryDelay = 5000;

function attachHandlers(c) {
  c.on(ControlEvent.CONNECTED, (roomState) => {
    retryDelay = 5000;
    console.log(`✅ Đã vào phòng @${TIKTOK_USER} (roomId: ${roomState?.roomId || c?.roomId || '?'})`);
  });

  c.on(ControlEvent.DISCONNECTED, () => {
    console.warn('🔌 Mất kết nối phòng Live → sẽ thử lại…');
    scheduleReconnect();
  });

  c.on(ControlEvent.ERROR, (err) => {
    console.warn('⚠️  Lỗi TikTok:', err?.message || err);
  });

  // Bình luận → server tự phân loại (thắp hương / cầu nguyện / xin xăm)
  c.on(WebcastEvent.CHAT, (data) => {
    const { user, uniqueId, avatar } = extractUser(data);
    const comment = data?.content || data?.comment || '';
    if (!comment.trim()) return;
    console.log(`💬 ${user}: ${comment}`);
    callRpc('temple.comment', { comment, user, uniqueId, avatar });
  });

  // Thả tim → gõ mõ
  c.on(WebcastEvent.LIKE, (data) => {
    const { user, uniqueId, avatar } = extractUser(data);
    const count = Math.min(LIKE_CAP, Math.max(1, Number(data?.count ?? data?.likeCount ?? 1)));
    console.log(`❤️  ${user} thả ${count} tim`);
    callRpc('temple.strikeWoodenFish', { user, uniqueId, avatar, count });
  });

  // Follow / Share → thỉnh Đại Hồng Chung
  const onSocial = (data) => {
    const { user, uniqueId, avatar } = extractUser(data);
    console.log(`🔔 ${user} follow/chia sẻ`);
    callRpc('temple.ringBell', {
      user,
      uniqueId,
      avatar,
      count: 1,
      wish: 'Hữu duyên tương ngộ nơi cửa Phật, cầu bình an may mắn',
      readTts: false
    });
  };
  c.on(WebcastEvent.FOLLOW, onSocial);
  c.on(WebcastEvent.SHARE, onSocial);
  c.on(WebcastEvent.SOCIAL, (data) => {
    const action = String(data?.action || '');
    const disp = String(
      data?.common?.displayText?.displayType || data?.displayType || ''
    ).toLowerCase();
    if (action === '1' || action === '3' || disp.includes('follow') || disp.includes('share')) {
      onSocial(data);
    }
  });

  // Tặng quà → dâng lễ (server tự nâng cấp Đại Lễ khi ≥100 xu)
  c.on(WebcastEvent.GIFT, (data) => {
    const { user, uniqueId, avatar } = extractUser(data);
    const giftObj = data?.gift || data?.giftDetails || {};
    const giftId = String(data?.giftId || giftObj?.id || 'rose');
    const groupId = String(data?.groupId || `${uniqueId}_${giftId}`);
    const repeatCount = Math.max(1, Number(data?.repeatCount || data?.comboCount || 1));

    // Chống cộng trùng: chỉ tính phần tăng thêm của combo
    const prevCount = giftComboTracker.get(groupId) || 0;
    if (repeatCount <= prevCount && data?.repeatEnd) {
      giftComboTracker.delete(groupId);
      return;
    }
    const deltaCount = Math.max(1, repeatCount - prevCount);
    giftComboTracker.set(groupId, repeatCount);
    if (giftComboTracker.size > 500) {
      giftComboTracker.delete(giftComboTracker.keys().next().value);
    }

    const diamondCount = Math.max(1, Number(giftObj?.diamondCount || data?.diamondCount || 1));
    const totalCoins = diamondCount * deltaCount;
    const rawGiftName = giftObj?.name || data?.giftName || giftObj?.describe || 'Hoa Hồng Tâm Thành';
    const giftName = deltaCount > 1 ? `${deltaCount}x ${rawGiftName}` : rawGiftName;

    console.log(`🎁 ${user} tặng ${giftName} (${totalCoins} xu)`);
    callRpc('temple.offerGift', {
      user,
      uniqueId,
      avatar,
      coins: totalCoins,
      giftName,
      wish: `Thành tâm dâng ${giftName} kính lễ Đức Phật A Di Đà`
    });
  });
}

function scheduleReconnect() {
  const wait = retryDelay;
  retryDelay = Math.min(retryDelay * 2, 60000); // giãn dần tối đa 60s
  console.log(`⏳ Thử kết nối lại sau ${Math.round(wait / 1000)}s…`);
  setTimeout(connect, wait);
}

async function connect() {
  try {
    conn = new TikTokLiveConnection(TIKTOK_USER, {
      processInitialData: false, // bỏ qua lịch sử cũ, chỉ nghe sự kiện mới
      fetchRoomInfoOnConnect: false,
      enableExtendedGiftInfo: true // cần để biết số xu của quà
    });
    attachHandlers(conn);
    await conn.connect();
  } catch (err) {
    const msg = err?.message || String(err);
    console.error(`❌ Chưa vào được phòng: ${msg}`);
    if (/offline|not.*live|LIVE has ended/i.test(msg)) {
      console.error('   → Kênh hiện không phát Live. Bridge sẽ chờ và thử lại.');
    }
    scheduleReconnect();
  }
}

// Kiểm tra VPS trước khi nghe Live (báo lỗi sớm còn hơn im lặng)
async function preflight() {
  if (DRY_RUN) return;
  try {
    const res = await fetch(VPS_RPC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 0, method: 'temple.getState' }),
      signal: AbortSignal.timeout(10000)
    });
    const data = await res.json();
    if (data?.result) {
      console.log(`🔗 VPS phản hồi OK (công đức hiện tại: ${data.result.totalMerit ?? '?'})`);
    } else {
      console.warn('⚠️  VPS trả về dữ liệu lạ:', JSON.stringify(data).slice(0, 160));
    }
  } catch (err) {
    console.error(`❌ Không gọi được VPS (${VPS_RPC_URL}): ${err.message}`);
    console.error('   → Kiểm tra: VPS đang chạy? Cổng đã mở cho IP máy này? URL đúng chưa?');
  }
}

// Báo cáo định kỳ 5 phút cho biết bridge còn sống
setInterval(() => {
  const parts = Object.entries(stats.byMethod).map(([k, v]) => `${k.replace('temple.', '')}=${v}`);
  console.log(`📊 [${new Date().toLocaleTimeString('vi-VN')}] gửi OK=${stats.sent} lỗi=${stats.failed} | ${parts.join(' ') || 'chưa có sự kiện'}`);
}, 5 * 60 * 1000);

process.on('SIGINT', () => {
  console.log('\n👋 Dừng bridge. Tổng kết: gửi OK=%d, lỗi=%d', stats.sent, stats.failed);
  try { conn?.disconnect(); } catch (_) {}
  process.exit(0);
});

(async () => {
  await preflight();
  await connect();
})();
