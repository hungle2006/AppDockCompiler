/* STK500v2 uploader for Arduino Mega 2560 with 256-byte pages and bootloader-region protection. */
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export function parseMegaHex(input){
 const map=new Map();let upper=0,eof=false;
 for(const line of input.trim().split(/\r?\n/)){
  if(!/^:(?:[\dA-Fa-f]{2}){5,}$/.test(line))throw Error("HEX không hợp lệ");
  const x=Uint8Array.from(line.slice(1).match(/../g),s=>parseInt(s,16)),n=x[0],offset=x[1]*256+x[2],type=x[3];
  if(x.length!==n+5||x.reduce((a,b)=>a+b,0)%256)throw Error("HEX sai checksum/độ dài");
  if(type===0){for(let i=0;i<n;i++){const addr=upper+offset+i;if(addr>=0x3E000)throw Error("HEX ghi vào vùng bootloader Mega2560");map.set(addr,x[i+4]);}}
  else if(type===4)upper=(x[4]*256+x[5])*65536;
  else if(type===2)upper=(x[4]*256+x[5])*16;
  else if(type===1){eof=true;break;}
 }
 if(!eof||!map.size)throw Error("HEX thiếu dữ liệu/EOF");
 let size=0;for(const a of map.keys())size=Math.max(size,a+1);
 return {bytes:Uint8Array.from({length:size},(_,i)=>map.get(i)??255),size};
}
export function stkV2Frame(seq,payload){const n=payload.length,b=Uint8Array.from([0x1b,seq&255,(n>>8)&255,n&255,0x0e,...payload]);return Uint8Array.from([...b,b.reduce((a,v)=>a^v,0)])}
export class Mega2560Flasher{
 constructor(port,log=()=>{}){this.port=port;this.log=log;this.seq=0;this.rx=[];this.active=false}
 async start(){await this.port.open({baudRate:115200,bufferSize:8192});this.active=true;this.reader=this.port.readable.getReader();
  this.task=(async()=>{try{while(this.active){let {value,done}=await this.reader.read();if(done)break;this.rx.push(...value)}}catch(e){if(this.active)this.log("USB: "+e.message)}})();
  await this.port.setSignals({dataTerminalReady:false});await sleep(80);await this.port.setSignals({dataTerminalReady:true});await sleep(280);
 }
 async packet(cmd,timeout=1600){
  const seq=this.seq++&255;this.rx=[];const w=this.port.writable.getWriter();try{await w.write(stkV2Frame(seq,cmd))}finally{w.releaseLock()}
  const stop=Date.now()+timeout;
  while(Date.now()<stop){
   let pos=this.rx.indexOf(0x1b);
   if(pos>=0&&this.rx.length-pos>=6){
    let count=this.rx[pos+2]*256+this.rx[pos+3],total=count+6;
    if(count>1024)throw Error("STK500v2 sai độ dài gói");
    if(this.rx.length-pos>=total){
     const r=this.rx.splice(pos,total),msg=r.slice(5,-1);
     if(r[1]!==seq||r[4]!==0x0e||r.reduce((a,b)=>a^b,0)!==0)throw Error("STK500v2 checksum/sequence lỗi");
     if(msg[0]!==cmd[0]||msg[1]!==0)throw Error("STK500v2 lệnh bị từ chối");
     return msg;
    }
   }
   await sleep(9);
  }
  throw Error("STK500v2 không phản hồi");
 }
 async sync(){for(let attempt=0;attempt<7;attempt++){try{await this.packet([0x01],650);this.log("Mega2560 bootloader STK500v2 đã phản hồi");return}catch{await sleep(120)}}throw Error("Không đồng bộ được Mega2560, hãy chọn đúng COM/bootloader")}
 async flash(hex,progress=()=>{}){
  const {bytes,size}=parseMegaHex(hex);await this.sync();
  for(let at=0;at<size;at+=256){
   const page=bytes.slice(at,at+256),word=at/2,address=word>=0x10000?(word|0x80000000):word;
   await this.packet([0x06,(address>>>24)&255,(address>>>16)&255,(address>>>8)&255,address&255]);
   await this.packet([0x13,(page.length>>>8)&255,page.length&255,0xc1,0,0x40,0x4c,0x20,0,0,...page],4500);
   progress(Math.min(100,Math.round((at+page.length)*100/size)));
  }
  await this.packet([0x11]);this.log("Đã gửi firmware Mega2560");
 }
 async close(){this.active=false;try{await this.reader?.cancel()}catch{}try{await this.task}catch{}try{this.reader?.releaseLock()}catch{}try{await this.port.close()}catch{}}
}
