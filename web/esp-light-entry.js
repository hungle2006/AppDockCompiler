(() => {
 const target = 'ESP Light · Cảm biến chốt & SIM800L';
 const attach = () => {
  const title = document.getElementById('config-title');
  const form = document.getElementById('config-form');
  if (!form || !title) return;
  let info = document.getElementById('esp-light-connect-note');
  if (!info) {
   info = document.createElement('div');
   info.id = 'esp-light-connect-note';
   info.style.cssText = 'margin:16px 0;padding:16px;border:1px solid var(--ad-line,#dce5f1);border-radius:12px;background:var(--ad-surface,#fff);font-size:14px;line-height:1.6';
   const text = document.createElement('p');
   text.textContent = 'Sau khi nạp, nhập Wi-Fi, JSON ghép nối và số điện thoại riêng qua USB. Trong ESP Light chọn GPIO27, HIGH = Bật. Hai relay chạy đồng thời; cảnh báo chốt giữ LOW.';
   const link = document.createElement('a');
   link.href = '/esp-light-setup.html'; link.className = 'button primary'; link.textContent = 'Kết nối ESP Light qua USB';
   info.append(text, link); form.append(info);
  }
  info.hidden = title.textContent.trim() !== target;
 };
 new MutationObserver(attach).observe(document.getElementById('config-title'), {childList:true,subtree:true});
 attach();
})();
