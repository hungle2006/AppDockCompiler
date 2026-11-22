/* Browser ESP uploader: uses self-hosted esptool-js bundle and signed-in AppDock build artifacts. */
export const ESP_BOARD_CHIP=Object.freeze({esp32:"ESP32",esp32_s2:"ESP32-S2",esp32_s3:"ESP32-S3",esp32_c3:"ESP32-C3",esp32_c6:"ESP32-C6",esp8266:"ESP8266",d1_mini:"ESP8266"});
const decoder=new TextDecoder("utf-8",{fatal:true});
const find=(files,name)=>Object.entries(files).find(([k])=>k===name||k.endsWith("/"+name))?.[1];
export function parseEspArtifact(files,board){
 const bytes=find(files,"flash-manifest.json");if(!bytes)throw Error("Firmware thiếu flash-manifest.json, hãy biên dịch lại");
 const m=JSON.parse(decoder.decode(bytes));
 if(m.schema!==1||m.board!==board||m.protocol!=="esptool"||m.chip!==ESP_BOARD_CHIP[board])throw Error("Firmware không khớp board được chọn");
 if(!Array.isArray(m.images)||m.images.length<1||m.images.length>8)throw Error("Manifest chưa có địa chỉ flash");
 const occupied=[],fileArray=[];
 for(const im of m.images){
  if(!im||typeof im.file!=="string"||!/^[-\w.]+\.bin$/.test(im.file)||!Number.isSafeInteger(im.address)||im.address<0||im.address%4096)throw Error("Tên tệp hoặc địa chỉ flash không hợp lệ");
  const data=find(files,im.file);
  if(!(data instanceof Uint8Array)||!data.length||data.length>16*1024*1024||data.length!==im.size)throw Error("Firmware thiếu tệp hoặc sai kích thước: "+im.file);
  const end=im.address+Math.ceil(data.length/4096)*4096;
  if(end>16*1024*1024||occupied.some(([a,b])=>im.address<b&&end>a))throw Error("Phân vùng flash trùng hoặc vượt dung lượng");
  occupied.push([im.address,end]);fileArray.push({address:im.address,data});
 }
 const opt=m.options||{},mode=String(opt.flashMode||"keep").toLowerCase(),freq=String(opt.flashFreq||"keep").toLowerCase(),size=String(opt.flashSize||"keep");
 if(!["keep","qio","qout","dio","dout"].includes(mode)||!["keep","80m","40m","26m","20m"].includes(freq)||!["keep","detect","256KB","512KB","1MB","2MB","4MB","8MB","16MB","32MB"].includes(size))throw Error("Thông số chip flash không hợp lệ");
 return {fileArray,chip:m.chip,options:{flashMode:mode,flashFreq:freq,flashSize:size}};
}
export function chipMatches(board,name){
 const chip=String(name||"").toUpperCase().replace(/[_ ]/g,"-"),expected=ESP_BOARD_CHIP[board];if(!expected)return false;
 if(expected==="ESP32")return /^ESP32(?:$|[- ](?!S2|S3|C3|C6|C2|C5|H2|P4))/.test(chip);
 return chip.includes(expected.toUpperCase());
}
export async function flashEspFirmware({zip,port,board,log=()=>{},progress=()=>{},runtimeImport=()=>import("/firmware-vendor.js")}){
 if(!(zip instanceof Uint8Array)||zip.length>12*1024*1024)throw Error("Firmware ZIP sai hoặc quá lớn");
 if(!port||!ESP_BOARD_CHIP[board])throw Error("Board/cổng không hỗ trợ esptool");
 const {unzipSync,ESPLoader,Transport}=await runtimeImport();
 const {fileArray,chip,options}=parseEspArtifact(unzipSync(zip),board);
 const terminal={clean:()=>{},write:x=>{if(String(x||"").trim())log(String(x).trim().slice(0,160))},writeLine:x=>{if(String(x||"").trim())log(String(x).trim().slice(0,160))}};
 const transport=new Transport(port,true);
 try{
  const loader=new ESPLoader({transport,baudrate:115200,terminal,debugLogging:false});
  log("Đang tìm ROM bootloader Espressif…");
  const actual=await loader.main();log("Đã phát hiện chip: "+actual);
  if(!chipMatches(board,actual))throw Error("CHẶN NẠP: Chip "+actual+" không khớp firmware "+chip);
  const sizes=fileArray.map(x=>x.data.length),total=sizes.reduce((a,b)=>a+b,0);
  await loader.writeFlash({fileArray,...options,eraseAll:false,compress:true,reportProgress:(idx,written)=>{
   const done=sizes.slice(0,idx).reduce((a,b)=>a+b,0)+Math.min(sizes[idx]||0,written);progress(Math.min(100,Math.round(done/total*100)));
  }});
  await loader.after("hard_reset");progress(100);log("Đã ghi firmware và reset ESP");
  return {chip:actual,bytes:total,images:fileArray.length};
 }finally{try{await transport.disconnect?.()}catch(e){log("Ngắt USB: "+e.message)}}
}
