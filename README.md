# AppDockCompiler — Firmware Center

**AppDock chính:** https://anh-app-hub.vercel.app/  
**Task mới:** https://anh-app-hub.vercel.app/firmware  
**GitHub Actions:** https://github.com/hungle2006/AppDockCompiler/actions/workflows/compile.yml

## Mục đích

Đây là **một task của AppDock**, không phải một ứng dụng độc lập. Quản trị viên AppDock đăng sketch Arduino/ESP cùng schema các biến được phép sửa. Người sử dụng chỉ chọn một chương trình, chọn board, thay những biến được phép (GPIO, tên thiết bị, địa chỉ IP, delay, v.v.) rồi yêu cầu biên dịch và nạp firmware.

Không cung cấp trình soạn thảo mã nguồn cho người dùng thường.

## Kiến trúc

- `web/firmware.html`, `web/firmware.js`, `web/firmware.css`: giao diện người dùng và quản trị.
- `web/firmware-flash.js`: STK500v1 uploader cho Uno/Nano/RF-Nano tương thích qua Web Serial (Chrome/Edge desktop).
- `web/firmware-nav.js`: chèn task Nạp firmware vào thanh điều hướng AppDock.
- `api/firmware.js`: Vercel API cùng domain AppDock, sử dụng session Google hiện có để xác thực quản trị, kiểm tra tham số đầu vào, lưu job/giới hạn lượt biên dịch trong Neon, phát hành chương trình lên GitHub và phân phối firmware.
- `projects/<project-id>/manifest.json`: tên, board, các trường được cho sửa, loại dữ liệu, giới hạn và giá trị mặc định.
- `projects/<project-id>/AppDockSketch.ino`: sketch quản trị viên công bố, có `#include "generated_config.h"`.
- `scripts/prepare.py`: kiểm tra giá trị theo manifest, chỉ sinh các #define hợp lệ; không chèn mã nguồn từ client.
- `.github/workflows/compile.yml`: GitHub Actions Arduino CLI, xuất file .hex/.bin và artifact 7 ngày.
- `appdock/`: snapshot cấu hình triển khai AppDock sau khi thêm firmware task.

## Vai trò

**Quản trị viên:** phải đăng nhập Google của AppDock; được nhập/sửa sketch .ino, thay manifest, chọn board, khai báo biến và phát hành bản mới trực tiếp lên repository này. Khi chưa có quyền, API `action=source` trả HTTP 403.

**Người dùng:** chỉ được xem các chương trình đã phát hành, sửa biến đã được whitelist, lưu cấu hình cục bộ, gửi compile, tải firmware và upload USB với bootloader tương thích.

## Kích hoạt biên dịch từ website — cần làm một lần

AppDock đang có `DATABASE_URL`. Biến `GITHUB_ACTIONS_TOKEN` **chưa được cài** vào Vercel nên nút Compile trên website chưa chạy end-to-end.

1. Vào https://github.com/settings/personal-access-tokens/new tạo Fine-grained PAT, chỉ chọn repository `hungle2006/AppDockCompiler`. Cấp `Actions: Read and write` và `Contents: Read and write`.
2. Vào https://vercel.com/hope-1091/anh-app-hub/settings/environment-variables và tạo biến `GITHUB_ACTIONS_TOKEN` ở Production, loại Sensitive hoặc Encrypted.
3. Redeploy production `anh-app-hub` để áp dụng biến. Không gửi token vào chat hoặc commit lên GitHub.

API chấp nhận tối đa 5 lần biên dịch/giờ/phiên hoặc IP theo cơ chế lưu job trong Neon.

## Khả năng board

- **Biên dịch theo cấu hình:** Uno, Nano bootloader mới/cũ, RF-Nano tương thích, Mega 2560, Leonardo, ESP32 DevKit, ESP8266 NodeMCU.
- **Nạp trực tiếp qua Web Serial:** STK500v1 Uno/Nano/RF-Nano tương thích, chưa kiểm thử trên tất cả thiết bị thực.
- **Các board khác:** tải ZIP firmware, nạp bằng công cụ tương thích. Không tuyên bố hỗ trợ USB trực tiếp cho Mega/Leonardo/ESP.

## Kiểm thử

- GitHub Actions đã build sample `led-blink` trên Uno thành công: https://github.com/hungle2006/AppDockCompiler/actions/runs/45028141151
- Production Vercel trả HTTP 200 tại `/`, `/firmware`, `/api/firmware?action=list` và `/api/hub?action=catalog`.
- API `source` không đăng nhập trả 403.
- Trình biên dịch Python đã được test với trường hợp hợp lệ, sai pin, sai kiểu, dư biến, sai giá trị.
- Chưa kiểm tra nút Publish, Compile trực tiếp từ website cho tới khi có GitHub Token; nạp USB cần board thật.

## Bảo mật

GitHub repository hiện **public**. Không cho đăng mật khẩu, secret, khóa API hoặc firmware riêng tư trong repository hay thông số biên dịch. Nếu cần code riêng tư, chuyển repository thành private trước khi phát hành mã. GitHub Token chỉ được đặt ở backend Vercel.

## Lưu ý bảo toàn AppDock cũ

Bản AppDock tích hợp mới bảo toàn frontend và các API cũ bằng các rewrite trong `appdock/vercel.json` hướng về deployment production trước đó. Đây là giải pháp chuyển tiếp để tránh làm gián đoạn kho ứng dụng; về lâu dài nên chuyển toàn bộ source AppDock gốc vào Git trước khi tiếp tục sửa sâu.
