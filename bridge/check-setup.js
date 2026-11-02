#!/usr/bin/env node
/**
 * KIỂM TRA ĐƯỜNG DÂY TRƯỚC KHI LIVE
 * Chạy trên máy livestream. Kiểm tra lần lượt: cấu hình → mạng tới VPS →
 * token → giọng đọc, rồi in ra đúng đường dẫn để dán vào OBS.
 */
'use strict';
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const p = path.join(__dirname, '.env');
  if (!fs.existsSync(p)) return false;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '').trim();
  }
  return true;
}

const OK = '  [ OK ]', NO = '  [LỖI ]', WARN = '  [ ! ]';
let failed = 0;
const fail = (msg, fix) => { failed++; console.log(`${NO} ${msg}`); if (fix) console.log(`         → ${fix}`); };
const pass = (msg) => console.log(`${OK} ${msg}`);

(async () => {
  console.log('='.repeat(62));
  console.log('  KIỂM TRA ĐƯỜNG DÂY — Chùa Linh Ứng Online');
  console.log('='.repeat(62) + '\n');

  // 1. Cấu hình
  console.log('[1/5] Cấu hình');
  if (!loadEnv()) {
    fail('Chưa có file .env', 'Chạy START-BRIDGE.bat một lần để nó tạo .env, rồi điền thông tin.');
    return done();
  }
  const USER = (process.env.TIKTOK_USER || '').replace(/^@/, '').trim();
  const URL = (process.env.VPS_RPC_URL || '').trim();
  const TOKEN = (process.env.RPC_TOKEN || '').trim();
  USER ? pass(`Kênh TikTok: @${USER}`) : fail('Thiếu TIKTOK_USER', 'Mở .env điền tên kênh, ví dụ: TIKTOK_USER=@kenhcuaban');
  URL ? pass(`Địa chỉ VPS: ${URL}`) : fail('Thiếu VPS_RPC_URL', 'Ví dụ: VPS_RPC_URL=http://100.x.y.z:3000/rpc');
  TOKEN ? pass(`Token: ${TOKEN.slice(0, 6)}… (${TOKEN.length} ký tự)`) : fail('Thiếu RPC_TOKEN', 'Lấy từ file .env trên VPS (dòng RPC_TOKEN=).');
  if (!URL || !TOKEN) return done();

  const base = URL.replace(/\/rpc$/, '');
  const rpc = async (method, params, tok) => {
    const res = await fetch(URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(tok ? { 'x-rpc-token': tok } : {}) },
      body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
      signal: AbortSignal.timeout(12000)
    });
    return res.json();
  };

  // 2. Mạng tới VPS
  console.log('\n[2/5] Kết nối tới VPS');
  try {
    const d = await rpc('temple.getState', {});
    if (d?.result) pass(`VPS trả lời (tổng công đức hiện tại: ${d.result.totalMerit})`);
    else { fail('VPS trả về dữ liệu lạ: ' + JSON.stringify(d).slice(0, 120)); return done(); }
  } catch (e) {
    fail(`Không gọi được VPS (${e.message})`,
      'Kiểm tra: Tailscale đã bật trên CẢ máy này và VPS chưa? Địa chỉ trong .env đúng chưa? Container còn chạy không?');
    return done();
  }

  // 3. Token
  console.log('\n[3/5] Xác thực token');
  const noTok = await rpc('temple.resetMerit', {}, '');
  noTok?.error?.code === -32001
    ? pass('Lệnh không token bị chặn đúng (VPS đang được bảo vệ)')
    : console.log(`${WARN} VPS KHÔNG chặn lệnh thiếu token — chưa bật RPC_TOKEN trên VPS?`);

  const withTok = await rpc('temple.burnIncense', { user: 'Kiểm Tra Hệ Thống', count: 1, wish: 'Thử đường dây' }, TOKEN);
  if (withTok?.result) pass('Token hợp lệ — gửi được nghi thức lên Chánh Điện');
  else fail(`Token bị từ chối: ${withTok?.error?.message || '?'}`,
    'Token trong .env phải khớp CHÍNH XÁC với RPC_TOKEN trên VPS (không thừa dấu cách).');

  // 4. Giọng đọc
  console.log('\n[4/5] Giọng đọc ZeroTTS');
  try {
    const r = await fetch(`${base}/api/tts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-rpc-token': TOKEN },
      body: JSON.stringify({ text: 'Nam mô A Di Đà Phật' }),
      signal: AbortSignal.timeout(45000)
    });
    const d = await r.json();
    if (d?.ok && d?.url) pass('Tạo được giọng đọc');
    else if (r.status === 401) fail('Giọng đọc từ chối token', 'Kiểm tra lại RPC_TOKEN.');
    else console.log(`${WARN} Giọng đọc chưa sẵn sàng: ${d?.error || r.status} (model có thể đang tải lần đầu — đợi vài phút rồi chạy lại)`);
  } catch (e) {
    console.log(`${WARN} Không kiểm tra được giọng đọc: ${e.message}`);
  }

  // 5. Đường dẫn OBS
  console.log('\n[5/5] Đường dẫn dán vào OBS');
  console.log('\n  Browser Source  (Width 1080 — Height 1920):');
  console.log(`\n     ${base}/?obs=1&token=${TOKEN}\n`);
  console.log('  ⚠️  Nhớ TÍCH ô "Control audio via OBS", không thì khán giả không nghe được tiếng.');

  done();

  function done() {
    console.log('\n' + '='.repeat(62));
    console.log(failed === 0
      ? '  ✅ ĐƯỜNG DÂY THÔNG. Có thể chạy START-BRIDGE.bat và lên sóng.'
      : `  ❌ CÒN ${failed} LỖI cần sửa trước khi live (xem dòng [LỖI] ở trên).`);
    console.log('='.repeat(62));
  }
})();
