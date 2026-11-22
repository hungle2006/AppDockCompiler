// Discover only Web Serial ports already authorized for this site.
// A new USB port always requires a user click on the browser's permission dialog.
const hexid=n=>Number.isInteger(n)?'0x'+n.toString(16).padStart(4,'0').toUpperCase():'—';
export function identifySerialPort(port){
 let data={};try{data=port?.getInfo?.()||{}}catch{}
 const v=data.usbVendorId,p=data.usbProductId,signature=hexid(v)+':'+hexid(p);
 let label='Cổng Serial',family=null;
 if([0x2341,0x2A03].includes(v)){
  if([0x0043,0x0001].includes(p)){label='Arduino Uno (USB)';family='uno'}
  else if(p===0x0058){label='Arduino Nano (USB)';family='nano'}
  else if([0x0010,0x0042].includes(p)){label='Arduino Mega (USB)';family='mega'}
  else if([0x0036,0x8036].includes(p)){label='Arduino Leonardo (USB)';family='leonardo'}
  else label='Arduino USB (không rõ mẫu board)'
 }else if(v===0x1A86&&[0x7523,0x5523].includes(p))label='USB-Serial CH340 (board chưa rõ)';
 else if(v===0x10C4&&p===0xEA60)label='USB-Serial CP210x (board chưa rõ)';
 else if(v===0x0403&&p===0x6001)label='USB-Serial FTDI (board chưa rõ)';
 else if(v===0x303A)label='USB Espressif (chưa rõ mẫu board)';
 return {label,family,signature};
}
export function portBoardMismatch(port,board){
 const f=identifySerialPort(port).family;
 const wanted=['nano','nano_old','rf_nano','rf_nano_old'].includes(board)?'nano':board;
 return !!f&&!!wanted&&f!==wanted;
}
export class SerialPortManager{
 constructor({serial,onChange=()=>{},onError=()=>{},remembered=null}){
  this.serial=serial;this.onChange=onChange;this.onError=onError;this.remembered=remembered;
  this.ports=[];this.selected=null;this.scanning=false;
  this.connect=()=>{this.scan().catch(this.onError)};
  this.disconnect=e=>{if(this.selected===(e.port||e.target))this.selected=null;this.scan().catch(this.onError)}
 }
 get supported(){return !!this.serial?.getPorts&&!!this.serial?.requestPort}
 snapshot(){return {supported:this.supported,ports:[...this.ports],selected:this.selected,scanning:this.scanning}}
 notify(){this.onChange(this.snapshot())}
 async start(){
  if(!this.supported){this.notify();return}
  this.serial.addEventListener?.('connect',this.connect);
  this.serial.addEventListener?.('disconnect',this.disconnect);
  await this.scan()
 }
 async scan(preferred){
  if(!this.supported){this.notify();return}
  this.scanning=true;this.notify();
  try{
   this.ports=[...await this.serial.getPorts()];
   if(preferred&&this.ports.includes(preferred))this.selected=preferred;
   else if(this.selected&&this.ports.includes(this.selected)){}
   else{
    let known=this.ports.filter(p=>identifySerialPort(p).signature===this.remembered);
    this.selected=this.remembered&&known.length===1?known[0]:this.ports.length===1?this.ports[0]:null
   }
  }finally{this.scanning=false;this.notify()}
 }
 async grant(){
  if(!this.supported)throw Error('Cần Chrome hoặc Edge trên máy tính');
  // Must be reached directly from a real user click, before asynchronous operations.
  const chosen=await this.serial.requestPort();
  await this.scan(chosen);
  if(!this.selected){this.ports.push(chosen);this.selected=chosen;this.notify()}
  return this.selected
 }
 choose(index){
  this.selected=this.ports[index]||null;
  if(this.selected)this.remembered=identifySerialPort(this.selected).signature;
  this.notify();return this.selected
 }
}