/* Shared browser uploader used by both the admin Arduino IDE and public Firmware Center. */
import {AvrFlasher} from "./firmware-flash.js";
import {Mega2560Flasher} from "./firmware-flash-mega.js";
import {flashEspFirmware,ESP_BOARD_CHIP} from "./firmware-flash-esp.js";
import {bootloader,boardNames} from "./firmware-boards.js";
export function uploadProtocol(board){
 if(Object.hasOwn(bootloader,board))return "stk500v1";
 if(board==="mega")return "stk500v2";
 if(Object.hasOwn(ESP_BOARD_CHIP,board))return "esptool";
 return "download";
}
export function methodDescription(board){
 const p=uploadProtocol(board);
 if(p==="stk500v1")return "Nạp trực tiếp bằng STK500v1 qua Web Serial (cần đúng bootloader).";
 if(p==="stk500v2")return "Nạp trực tiếp Arduino Mega2560 bằng STK500v2.";
 if(p==="esptool")return "Nạp trực tiếp ESP32/ESP8266 qua esptool-js, xác minh chip và địa chỉ flash.";
 if(["pico","pico_w","pico2","pico2_w"].includes(board))return "Biên dịch và tải UF2; giữ BOOTSEL khi cắm Pico vào USB, sau đó sao chép UF2 vào ổ RPI-RP2/RP2350. Không dùng Web Serial để nạp.";
 if(["leonardo","micro"].includes(board))return "Biên dịch HEX; nạp bằng avrdude AVR109. Bootloader có thể đổi cổng USB sau reset 1200 baud.";
 if(["nano_every","uno_wifi_rev2"].includes(board))return "Đã biên dịch HEX; dùng avrdude JTAG2UPDI (không dùng STK500v1).";
 if(["uno_r4_minima","uno_r4_wifi"].includes(board))return "Đã biên dịch BIN/HEX; nạp bằng công cụ DFU tương ứng Arduino UNO R4.";
 if(["nano_33_iot","mkr_wifi_1010","nano_33_ble"].includes(board))return "Đã biên dịch BIN; sử dụng công cụ BOSSA và bootloader của board.";
 if(board==="nano_rp2040")return "Đã biên dịch cho Nano RP2040 Connect; dùng công cụ upload Arduino Mbed hoặc UF2 khi có.";
 if(["due_programming","due_native"].includes(board))return "Đã biên dịch BIN cho Arduino Due; nạp bằng bossac/SAM-BA đúng loại cổng.";
 if(board==="nano_esp32")return "Arduino Nano ESP32: tải gói firmware, nạp bằng công cụ Arduino tương thích; chưa bật Upload Web Serial.";
 return "Board này có thể biên dịch và tải firmware; dùng công cụ nạp phù hợp của nhà sản xuất.";
}
export async function uploadFirmware({board,port,fetchFirmware,log=()=>{},progress=()=>{}}){
 const p=uploadProtocol(board);
 if(p==="download")throw Error(methodDescription(board));
 if(p==="esptool"){const zip=new Uint8Array(await(await fetchFirmware("zip")).arrayBuffer());return flashEspFirmware({zip,board,port,log,progress})}
 let flasher;
 try{
  const hex=await(await fetchFirmware("hex")).text();
  if(p==="stk500v1"){flasher=new AvrFlasher(port,log);await flasher.start(bootloader[board])}
  else {flasher=new Mega2560Flasher(port,log);await flasher.start()}
  await flasher.flash(hex,progress);return {chip:board,images:1};
 }finally{await flasher?.close()}
}
