// Minimal STK500v1 uploader for Optiboot Uno / Nano / RF-Nano ATmega328P.
// Device choice is explicit; NEVER send on a port without user confirmation.
const pause = ms => new Promise(r=>setTimeout(r,ms));
export function parseHex(text){
 const map=new Map();let upper=0,eof=false;
 for(const line of text.trim().split(/\r?\n/)){
  if(!line.startsWith(':'))throw new Error('HEX không hợp lệ: thiếu dấu :');
  const pair=line.slice(1);
  if(pair.length%2)throw new Error('HEX sai độ dài');
  const raw=Uint8Array.from(pair.match(/../g)||[],x=>parseInt(x,16));
  if(!raw.length||raw.some(Number.isNaN))throw new Error('HEX có ký tự không hợp lệ');
  if((raw.reduce((a,b)=>a+b,0)&255)!==0)throw new Error('HEX sai checksum');
  const count=raw[0],address=(raw[1]<<8)|raw[2],type=raw[3];
  if(count+5!==raw.length)throw new Error('HEX sai số byte');
  if(type===0){for(let i=0;i<count;i++){const addr=upper+address+i;if(addr>32767)throw new Error('Firmware lớn hơn bộ nhớ Uno/Nano 32KB');map.set(addr,raw[4+i]);}}
  else if(type===4)upper=((raw[4]<<8)|raw[5])*65536;
  else if(type===2)upper=((raw[4]<<8)|raw[5])*16;
  else if(type===1){eof=true;break;}
 }
 if(!eof||!map.size)throw new Error('HEX không có dữ liệu hoặc EOF');
 let end=Math.max(...map.keys())+1;
 if(end>32768)throw new Error('Firmware vượt giới hạn ATmega328P');
 return {bytes:Uint8Array.from({length:end},(_,i)=>map.get(i)??255),size:end};
}
export class AvrFlasher{
 constructor(port,onLog=()=>{}){this.port=port;this.onLog=onLog;this.rx=[];this.active=false;this.reader=null;}
 async start(baudRate){
  await this.port.open({baudRate,bufferSize:4096});this.active=true;
  this.reader=this.port.readable.getReader();
  this.readTask=(async()=>{try{while(this.active){const {value,done}=await this.reader.read();if(done)break;for(const b of value)this.rx.push(b);}}catch(e){if(this.active)this.onLog('USB: '+e.message);}})();
  // Reset targets after USB port is open; most ATmega328P bootloaders pulse reset on DTR.
  await this.port.setSignals({dataTerminalReady:false});await pause(100);await this.port.setSignals({dataTerminalReady:true});await pause(250);
 }
 async command(payload,expect=2,timeout=1500){
  this.rx.length=0;
  const writer=this.port.writable.getWriter();try{await writer.write(Uint8Array.from([...payload,0x20]));}finally{writer.releaseLock()}
  const until=Date.now()+timeout;
  while(Date.now()<until){
   const start=this.rx.indexOf(0x14);
   if(start>=0 && this.rx.length>=start+expect){
    const bytes=this.rx.splice(start,expect);
    if(bytes.at(-1)===0x10)return bytes;
   }
   await pause(10);
  }
  throw new Error('Không nhận được phản hồi bootloader (hãy thử Old Bootloader/COM khác)');
 }
 async sync(){
  for(let n=0;n<8;n++){try{await this.command([0x30],2,450);return;}catch{await pause(100)}}
  throw new Error('Không đồng bộ được STK500v1. Kiểm tra đúng board và baud rate.');
 }
 async flash(hex,progress=()=>{}){
  const {bytes,size}=parseHex(hex);
  await this.sync();this.onLog('Bootloader OK · '+size+' bytes');
  const page=128;
  for(let i=0;i<size;i+=page){
   const data=bytes.slice(i,i+page);const word=i/2;
   await this.command([0x55,word&255,(word>>8)&255]);
   await this.command([0x64,(data.length>>8)&255,data.length&255,0x46,...data]);
   progress(Math.min(100,Math.round((i+data.length)*100/size)));
  }
  await this.command([0x51]);
  this.onLog('Đã gửi firmware qua bootloader. Thiết bị tự khởi động lại.');
 }
 async close(){
  this.active=false;
  try{if(this.reader){await this.reader.cancel();this.reader.releaseLock();}}catch{}
  try{await this.readTask;}catch{}
  try{await this.port.close();}catch{}
 }
}
