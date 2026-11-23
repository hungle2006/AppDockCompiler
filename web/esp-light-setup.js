'use strict';
(() => {
 const $ = id => document.getElementById(id);
 let pair = null, port = null, reader = null, readTask = null, pending = false, ackTimer = null;
 const status = (text, error = false) => { $('status').textContent = text; $('status').className = 'status' + (error ? ' error' : ''); };
 const update = () => { $('send').disabled = !pair || !port || pending; $('connect').disabled = !!port; $('disconnect').disabled = !port; };
 const log = text => { const el = $('console'); el.textContent = (el.textContent + '\n' + text).slice(-12000); el.scrollTop = el.scrollHeight; };
 const validPair = p => p && ['apiKey','projectId','ownerUid','deviceId','deviceEmail','devicePassword'].every(k => typeof p[k] === 'string' && p[k].length > 0 && p[k].length <= 254) && p.gpio === 27 && p.activeLow === false;
 $('pair-file').addEventListener('change', async () => {
  pair = null; update();
  try {
   const file = $('pair-file').files[0];
   if (!file) return;
   if (file.size > 8192) throw Error('File JSON quá lớn.');
   const value = JSON.parse(await file.text());
   if (!validPair(value)) throw Error('JSON không phù hợp. Tạo thiết bị GPIO27, HIGH = Bật trong ESP Light.');
   pair = value;
   $('pair-info').textContent = 'Đã kiểm tra JSON · GPIO27 · HIGH = Bật.';
  } catch (e) { $('pair-info').textContent = e.message; }
  update();
 });
 function response(line) {
  if (line.startsWith('CONFIG SAVED')) {
   clearTimeout(ackTimer); pending = false; pair = null;
   $('setup-form').reset(); $('pair-info').textContent = 'Đã gửi; dữ liệu nhập đã được xóa khỏi biểu mẫu.';
   status('ESP32 đã lưu cấu hình. Kiểm tra cảm biến bình thường rồi nhấn EN/RESET để áp dụng.');
   update();
  } else if (line.startsWith('CONFIG REJECTED') || line.startsWith('CONFIG ERROR')) {
   clearTimeout(ackTimer); pending = false; status(line, true); update();
  }
  // Allow only known status prefixes, never echo the JSON or arbitrary serial data.
  if (/^(CONFIG |ADC34=|SIM: (OK|ERROR|\+CPIN:|\+CREG:)|CALL |ALARM |ESP LIGHT|USB |latched=|PAIRING |Firestore |Firebase |Cloud )/.test(line)) log(line);
 }
 async function disconnect() {
  clearTimeout(ackTimer); pending = false;
  const oldPort = port; port = null;
  try { await reader?.cancel(); } catch {}
  try { await readTask; } catch {}
  try { reader?.releaseLock(); } catch {}
  reader = null;
  try { await oldPort?.close(); } catch {}
  update();
 }
 $('connect').addEventListener('click', async () => {
  $('connect').disabled = true;
  try {
   if (!navigator.serial) throw Error('Cần Chrome/Edge trên máy tính có hỗ trợ Web Serial.');
   port = await navigator.serial.requestPort();
   await port.open({ baudRate: 115200 });
   reader = port.readable.getReader();
   status('Đã kết nối USB 115200. Chọn JSON và gửi cấu hình.');
   readTask = (async () => {
    const decoder = new TextDecoder(); let buffer = '';
    try {
     for (;;) {
      const part = await reader.read(); if (part.done) break;
      buffer += decoder.decode(part.value, { stream: true });
      const lines = buffer.split('\n'); buffer = lines.pop().slice(-4096);
      lines.forEach(line => response(line.replace(/\r$/, '')));
     }
    } catch { if (port) status('Cổng USB đã ngắt. Kết nối lại để tiếp tục.', true); }
   })();
  } catch (e) { try { await port?.close(); } catch {} port = null; if (e.name !== 'NotFoundError') status(e.message, true); }
  update();
 });
 $('disconnect').addEventListener('click', async () => { await disconnect(); status('Đã đóng cổng USB.'); });
 navigator.serial?.addEventListener('disconnect', async event => { if (event.target === port) { await disconnect(); status('ESP32 đã rút khỏi USB.', true); } });
 $('setup-form').addEventListener('submit', async event => {
  event.preventDefault();
  if (!pair || !port || pending) return;
  if (!/^\+[0-9]{8,15}$/.test($('phone').value)) return status('Nhập số điện thoại dạng +84...', true);
  const payload = { wifiSsid: $('ssid').value, wifiPassword: $('wifi-password').value, phoneNumber: $('phone').value, pairing: pair };
  const bytes = new TextEncoder().encode(JSON.stringify(payload) + '\n');
  if (bytes.length > 4096) return status('Cấu hình vượt giới hạn 4096 byte.', true);
  pending = true; update();
  try {
   status('Đang gửi qua USB; chờ ESP32 xác nhận lưu.');
   ackTimer = setTimeout(() => { pending = false; status('Chưa nhận được xác nhận lưu. Kiểm tra đúng firmware, cổng và cảm biến rồi thử lại.', true); update(); }, 12000);
   const writer = port.writable.getWriter();
   try { await writer.write(bytes); } finally { writer.releaseLock(); }
  } catch (e) { clearTimeout(ackTimer); pending = false; status('Không gửi được: ' + e.message, true); update(); }
 });
 if (!navigator.serial) { status('Web Serial chưa được hỗ trợ. Mở trang bằng Chrome/Edge trên máy tính.', true); $('connect').disabled = true; }
})();
