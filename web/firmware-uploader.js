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
 if(["pico","pico_w"].includes(board))return "Pico: tải ZIP, giải nén .uf2; giữ BOOTSEL khi cắm USB rồi chép .uf2 vào ổ RPI-RP2.";
 if(["leonardo","micro"].includes(board))return "Leonardo/Micro dùng bootloader AVR109 và cổng USB mới sau reset; hãy dùng Arduino IDE.";
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
