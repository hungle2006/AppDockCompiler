# ESP Light — Cảm biến chốt + SIM800L

ESP32 DevKit (ESP32 gốc hai nhân), Arduino core 3.x, ArduinoJson 7.x.
App: https://esp-light-control.vercel.app/
Nạp: https://anh-app-hub.vercel.app/firmware
Cấu hình USB: https://anh-app-hub.vercel.app/esp-light-setup.html

| Thiết bị | GPIO |
| --- | --- |
| Analog / digital cảm biến | 34 / 32 |
| LED cảnh báo / bình thường | 2 / 4 |
| Relay 1 / Relay 2 | 27 / 26 |
| ESP32 RX ← SIM TX | 16 |
| ESP32 TX → SIM RX | 17 |

Giữ đúng mức điện code gốc: khởi động HIGH/HIGH, cảnh báo LOW/LOW.
HIGH/LOW không chứng minh tiếp điểm relay bật/tắt; kiểm tra module thực tế.
Cảm biến phải xuất logic 3,3V, không đưa 5V vào GPIO. GPIO32 dùng INPUT như code gốc nên cần mức HIGH/LOW xác định.
SIM800L dùng nguồn riêng theo thông số module, chịu được xung dòng khi phát, chung GND. Không cấp SIM từ chân 3V3 ESP32.

## Ghép nối

1. Đăng nhập ESP Light, thêm thiết bị GPIO27, HIGH = Bật. Lưu JSON ghép nối.
2. Chọn chương trình ESP Light · Cảm biến chốt & SIM800L trên AppDock, board ESP32, biên dịch và nạp.
3. Mở trang cấu hình USB, chọn JSON, nhập Wi-Fi và số điện thoại dạng +84..., gửi vào ESP32.
4. Sau CONFIG SAVED, kiểm tra cảm biến bình thường rồi nhấn EN/RESET để áp dụng.

Không nhập mật khẩu vào biến build công khai. Mật khẩu được gửi qua USB và lưu NVS trên ESP32.
NVS/flash chưa bật mã hóa; người đọc được flash có thể lấy cấu hình. Không chia sẻ JSON có mật khẩu.
Có thể dùng Serial Monitor 115200, newline, gửi một dòng:
{"wifiSsid":"TEN_WIFI","wifiPassword":"MAT_KHAU","phoneNumber":"+84901234567","pairing":{"projectId":"esplight-a94ff","apiKey":"API_KEY_TU_APP","ownerUid":"OWNER_UID","deviceId":"DEVICE_ID","deviceEmail":"EMAIL_THIET_BI","devicePassword":"MAT_KHAU_THIET_BI","gpio":27,"activeLow":false}}
Đây là ví dụ. Dùng tài khoản thiết bị do app cấp, không dùng mật khẩu Google cá nhân.
Lệnh STATUS chỉ in trạng thái. Cấu hình mới chỉ có hiệu lực sau khi bạn chủ động khởi động lại; không nhận cấu hình mới khi đang chốt cảnh báo.

## Hoạt động

- Hai relay điều khiển chung một bản ghi thiết bị. Trước lệnh cloud đầu tiên giữ HIGH như code gốc.
- Cảm biến LOW ổn định 50ms: chốt, LED2 sáng, LED4 tắt, cả hai relay LOW. Cảm biến về HIGH không tự xóa chốt.
- Chỉ một ATD sau khi SIM READY và đăng ký mạng; thiếu mạng thì đợi, không chặn cảm biến.
- ATH sau tối đa 25 giây tính từ ATD, không phải từ lúc nghe máy. BUSY/NO ANSWER/NO CARRIER/ERROR kết thúc lần thử, không gọi lặp.
- Gửi ATD không chứng minh đã kết nối cuộc gọi.
- Mất Wi-Fi: cảm biến/relay/bộ hẹn giờ vẫn chạy độc lập với tác vụ HTTPS.
- Khi đang chốt, lệnh bật từ app không nâng relay HIGH; đồng bộ trả desiredOn=false, reportedOn=false.
- Khởi động lại xóa chốt và cho phép gọi lại giống code gốc. Nếu cảm biến vẫn LOW sẽ kích hoạt lại. Không có reset từ xa.

## Firestore

Đường dẫn users/{ownerUid}/devices/{deviceId}. Đọc desiredOn/gpio/activeLow; ghi reportedOn/rssi/ipAddress/lastSeenAt (giờ máy chủ); chỉ cảnh báo mới ghi desiredOn=false.
Không đổi deviceUid/tên/phòng; không tạo lại tài liệu đã xóa. Dùng tài khoản thiết bị, TLS có xác thực CA, gia hạn token và điều kiện updateTime.
Tương thích firestore.rules hiện tại của ESP Light, không cần mở quyền database công khai.
App hiện chỉ hiển thị bật/tắt, IP, RSSI và online; chưa hiển thị ADC, chốt cảm biến hay trạng thái gọi. Xem thông tin đó qua Serial.
Mặc định mỗi 15 giây một đọc + một ghi: khoảng 5760 đọc và 5760 ghi/ngày/thiết bị, cộng đồng bộ khi cảnh báo. Theo dõi hạn mức.

## Kiểm tra phần cứng sau nạp

1. Cảm biến HIGH: LED4 sáng, nút app đổi cả GPIO27/26.
2. Cảm biến LOW: chốt LOW/LOW, LED2 sáng, giữ sau khi cảm biến HIGH trở lại.
3. SIM sẵn sàng: một ATD, ATH đúng hạn; thử số bận/không trả lời/thiếu mạng.
4. Khi chốt, bật trên app: phần cứng vẫn LOW.
5. Mất Wi-Fi khi gọi: vẫn ngắt đúng hạn, nối lại sẽ đồng bộ.
6. Kiểm tra khởi động lại và cấu hình sai.

Biên dịch không thay thế kiểm tra mạch thật; chưa kiểm chứng ESP32, SIM và relay của bạn.
Tham khảo: https://firebase.google.com/docs/firestore/use-rest-api
và https://firebase.google.com/docs/reference/rest/auth.
