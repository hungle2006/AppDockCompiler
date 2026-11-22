import {AvrFlasher} from '/firmware-flash.js';
import {SerialPortManager,identifySerialPort,portBoardMismatch} from '/firmware-ports.js';
const $=sel=>document.querySelector(sel);
const boardNames={uno:'Arduino Uno R3',nano:'Arduino Nano (mới)',nano_old:'Arduino Nano (bootloader cũ)',rf_nano:'RF-Nano (mới)',rf_nano_old:'RF-Nano (bootloader cũ)',mega:'Arduino Mega 2560',leonardo:'Arduino Leonardo',esp32:'ESP32 DevKit',esp8266:'ESP8266 NodeMCU'};
const bootloader={uno:115200,nano:115200,nano_old:57600,rf_nano:115200,rf_nano_old:57600};
let projects=[],selected=null,admin=false,buildId=null,buildReady=false,busy=false,serialPort=null;
function log(message){const box=$('#log');box.textContent+='\n['+new Date().toLocaleTimeString('vi-VN')+'] '+message;box.scrollTop=box.scrollHeight}
function progress(label,n=0){$('#buildstatus').textContent=label;$('#progress').style.width=n+'%';$('#buildpct').textContent=n+'%'}
const rememberedUsb=(()=>{try{return localStorage.getItem('appdock-firmware-usb-hint')}catch{return null}})();
const usb=new SerialPortManager({serial:navigator.serial,remembered:rememberedUsb,onChange:paintUsb,onError:e=>log('USB: '+e.message)});
let flashing=false;
function updateFlash(){
 const b=$('#board')?.value;
 $('#flash').disabled=!buildReady||busy||flashing||!usb.supported||!usb.selected||!Object.hasOwn(bootloader,b)||portBoardMismatch(usb.selected,b)
}
function paintUsb(s){
 if(!$('#usb-select'))return;
 const select=$('#usb-select'),hint=$('#usb-board-hint');
 const message=(text,warning=false)=>{hint.textContent=text;hint.className='usb-board-hint'+(warning?' warning':'')};
 select.replaceChildren();
 $('#usb-grant').disabled=$('#usb-scan').disabled=!s.supported;
 if(s.scanning)$('#usb-scan').disabled=true;
 select.disabled=!s.supported||!s.ports.length||flashing;
 $('#usb-indicator').className='usb-indicator'+(s.selected?' ready':'');
 $('#usb-port-count').textContent=s.ports.length+' thiết bị';
 if(!s.supported){
  $('#usb-connection-status').textContent='Trình duyệt không hỗ trợ Web Serial';
  $('#usb-hint').textContent='Dùng Chrome/Edge trên máy tính qua HTTPS.';
  select.append(new Option('Không khả dụng',''));
  message('Bạn vẫn có thể tải firmware và nạp bằng công cụ phù hợp.',true)
 }else if(!s.ports.length){
  $('#usb-connection-status').textContent='Chưa có cổng được cấp quyền';
  $('#usb-hint').textContent='Cắm board vào cổng USB bất kỳ, nhấn Cấp quyền cổng mới một lần.';
  select.append(new Option('Chưa tìm thấy cổng đã cho phép',''));
  message('AppDock tự tìm lại cổng đã cấp quyền. Không tự nạp firmware.')
 }else{
  $('#usb-connection-status').textContent=s.selected?'Đã nhận diện cổng USB / Serial':s.ports.length+' cổng được cấp quyền';
  $('#usb-hint').textContent=s.selected?'Cổng đã được chọn tự động; không cần chọn COM lại.':'Có nhiều cổng; chọn đúng thiết bị trước khi nạp.';
  select.append(new Option('Chọn thiết bị USB',''));
  s.ports.forEach((p,i)=>{
   const d=identifySerialPort(p);select.append(new Option('Cổng '+(i+1)+' · '+d.label+' · '+d.signature,String(i)));
   if(p===s.selected)select.value=String(i)
  });
  if(!s.selected)message('Có nhiều cổng. Hãy chọn đúng thiết bị để tránh nạp nhầm.',true);
  else{
   const d=identifySerialPort(s.selected),b=$('#board')?.value;
   if(portBoardMismatch(s.selected,b))message('USB gợi ý '+d.label+' nhưng đang chọn '+(boardNames[b]||b)+'. Nạp USB bị khóa để tránh nhầm board.',true);
   else if(d.family)message('USB gợi ý '+d.label+'. Vẫn cần kiểm tra loại board và bootloader trước khi nạp.');
   else message(d.label+' · '+d.signature+'. Không thể xác định loại board chỉ từ chip USB-Serial.',true)
  }
 }
 updateFlash()
}
$('#usb-scan').onclick=async()=>{try{await usb.scan();log('USB: Tìm thấy '+usb.ports.length+' cổng đã cho phép')}catch(e){log('USB: '+e.message)}};
$('#usb-grant').onclick=async()=>{try{
 const p=await usb.grant();try{localStorage.setItem('appdock-firmware-usb-hint',identifySerialPort(p).signature)}catch{}
 log('USB: Đã cấp quyền '+identifySerialPort(p).label)
}catch(e){if(e.name!=='NotFoundError')log('USB: '+e.message)}};
$('#usb-select').onchange=e=>{
 const p=usb.choose(e.target.value===''?-1:Number(e.target.value));
 if(p){try{localStorage.setItem('appdock-firmware-usb-hint',identifySerialPort(p).signature)}catch{}log('USB: Đã chọn '+identifySerialPort(p).label)}
};
function clearBuild(){buildId=null;buildReady=false;$('#download').disabled=true;$('#flash').disabled=true;$('#compile').disabled=!selected||busy;progress('Sẵn sàng biên dịch',0)}
async function api(action,options={}){const url=new URL('/api/firmware',location.origin);url.searchParams.set('action',action);for(const [k,v] of Object.entries(options.query||{}))url.searchParams.set(k,v);const response=await fetch(url,{method:options.body?'POST':'GET',headers:options.body?{'Content-Type':'application/json'}:{},body:options.body?JSON.stringify(options.body):undefined,cache:'no-store',credentials:'same-origin'});if(!response.ok){let d={};try{d=await response.json()}catch{}throw Error(d.error||'HTTP '+response.status)}return options.raw?response:response.json()}
function create(tag,text,className){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el}
function button(text,cls,fn){let b=create('button',text,cls);b.type='button';if(fn)b.addEventListener('click',fn);return b}
async function load(){try{let [list,session,health]=await Promise.all([api('list'),api('session'),api('health')]);projects=list.projects||[];admin=session.admin===true;$('#admin-nav').hidden=!admin;$('#mobile-admin').hidden=!admin;$('#statusdot').classList.toggle('ready',health.compilerReady);$('#servertext').textContent=health.compilerReady?'GitHub Compiler sẵn sàng':'Chưa kích hoạt GitHub Token';if(!health.compilerReady)log('Máy chủ chưa có GitHub Actions Token. Bạn vẫn có thể xem và lưu cấu hình.');$('#count').textContent=projects.length+' chương trình';renderCards();if(selected){const fresh=projects.find(p=>p.id===selected.id);if(fresh)selectProject(fresh)}else if(projects.length)selectProject(projects[0])}catch(e){$('#cards').replaceChildren(create('p','Không tải được thư viện: '+e.message,'empty'));$('#servertext').textContent='Lỗi kết nối';log('LỖI: '+e.message)}}
function renderCards(){let root=$('#cards');root.replaceChildren();let q=$('#search').value.trim().toLocaleLowerCase('vi-VN'),items=projects.filter(p=>(p.title+' '+p.description+' '+p.id).toLocaleLowerCase('vi-VN').includes(q));if(!items.length){root.append(create('div','Chưa có chương trình phù hợp.','empty'));return}for(const item of items){let card=create('div',undefined,'firmware-card'+(selected?.id===item.id?' active':'')),icon=create('div','⌘','card-icon'),details=create('div',undefined,'card-details'),title=create('strong',item.title),description=create('small',item.description),tags=create('div',undefined,'tagline');for(const b of item.boards.slice(0,4))tags.append(create('span',boardNames[b]?.replace('Arduino ','')||b,'tag'));if(item.boards.length>4)tags.append(create('span','+'+(item.boards.length-4),'tag'));details.append(title,description,tags);card.append(icon,details,create('span','›','arrow'));let choose=button('Chọn chương trình','',()=>selectProject(item));choose.className='cover-button';choose.setAttribute('aria-label','Chọn '+item.title);choose.style.cssText='position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer';card.style.position='relative';card.append(choose);if(admin){let edit=button('✎ Sửa','button light',()=>editProject(item.id));edit.style.cssText='position:relative;z-index:2;font-size:10px;padding:6px;min-height:29px';card.append(edit)}root.append(card)}}
function selectProject(item){selected=item;$('#config-empty').hidden=true;$('#config-form').hidden=false;$('#config-title').textContent=item.title;$('#config-description').textContent=item.description||'Chỉ những biến được cho phép mới có thể thay đổi';let board=$('#board');board.replaceChildren();for(const id of item.boards){let option=create('option',boardNames[id]||id);option.value=id;board.append(option)}const prior=localStorage.getItem('appdock-board-'+item.id);if(prior&&item.boards.includes(prior))board.value=prior;renderFields();clearBuild();renderCards()}
function renderFields(){if(!selected)return;let b=$('#board').value;localStorage.setItem('appdock-board-'+selected.id,b);$('#board-help').textContent='Board: '+(boardNames[b]||b)+' · chọn đúng phiên bản bootloader';let root=$('#variables');root.replaceChildren();let saved={};try{saved=JSON.parse(localStorage.getItem('appdock-config-'+selected.id+'-'+b)||'{}')}catch{}for(const f of selected.fields){let label=create('label',undefined,'field'),caption=create('span',f.label),el;const value=Object.hasOwn(saved,f.key)?saved[f.key]:f.default;if(f.type==='choice'){el=create('select');for(const o of f.options||[]){let option=create('option',String(o));option.value=String(o);el.append(option)}el.value=String(value)}else if(f.type==='boolean'){el=create('input');el.type='checkbox';el.className='toggle';el.checked=!!value}else{el=create('input');el.type=['integer','pin'].includes(f.type)?'number':'text';el.value=value??'';if(el.type==='number'){el.step='1';el.min=f.min??0;el.max=f.max??1000000}else el.maxLength=f.maxLength||64;el.placeholder=f.type==='pin'?'GPIO':f.type==='address'?'192.168.1.10':'Nhập giá trị'}el.dataset.variable=f.key;el.addEventListener('input',()=>{if(buildReady)clearBuild()});label.append(caption,el);if(f.help)label.append(create('small',f.help));root.append(label)}$('#compile').disabled=false;clearBuild()}
function collectConfig(){if(!selected)throw Error('Chưa chọn chương trình');let result={};for(const f of selected.fields){let el=[...document.querySelectorAll('[data-variable]')].find(x=>x.dataset.variable===f.key);if(!el)throw Error('Thiếu biến '+f.key);let value=f.type==='boolean'?el.checked:['pin','integer'].includes(f.type)?Number(el.value):el.value;if(['pin','integer'].includes(f.type)&&(!Number.isSafeInteger(value)||el.value===''))throw Error(f.label+': cần số nguyên');if(f.type==='choice'&&typeof f.default==='number')value=Number(value);result[f.key]=value}return result}
$('#search').addEventListener('input',renderCards);$('#board').addEventListener('change',()=>{renderFields();paintUsb(usb.snapshot())});$('#save-config').onclick=()=>{try{let conf=collectConfig();localStorage.setItem('appdock-config-'+selected.id+'-'+$('#board').value,JSON.stringify(conf));log('Đã lưu cấu hình cục bộ cho '+selected.title)}catch(e){log(e.message)}};$('#reset-config').onclick=()=>{if(!selected)return;localStorage.removeItem('appdock-config-'+selected.id+'-'+$('#board').value);renderFields()};$('#clear-log').onclick=()=>$('#log').textContent='Console đã xóa.';$('#btn-reload').onclick=load;
$('#compile').onclick=async()=>{if(busy||!selected)return;busy=true;$('#compile').disabled=true;$('#download').disabled=true;$('#flash').disabled=true;buildReady=false;let start=Date.now();try{let values=collectConfig();progress('Đang gửi yêu cầu biên dịch',12);let r=await api('compile',{body:{project:selected.id,board:$('#board').value,config:values}});buildId=r.id;log('Đã tạo công việc #'+buildId.slice(0,8));let state='';while(Date.now()-start<14*60*1000){await new Promise(resolve=>setTimeout(resolve,4500));let s=await api('status',{query:{id:buildId}});if(s.status!==state){state=s.status;log('GitHub Actions: '+state)}if(s.status==='queued')progress('Đang xếp hàng GitHub Actions',28);if(s.status==='in_progress')progress('Đang biên dịch firmware',60);if(s.status==='completed'){if(s.conclusion!=='success')throw Error('GitHub Actions báo thất bại. '+(s.runUrl||''));if(!s.ready)throw Error('Chưa tìm được firmware artifact');buildReady=true;progress('Biên dịch thành công',100);$('#download').disabled=false;updateFlash();log('Firmware đã sẵn sàng; có thể tải hoặc nạp USB khi tương thích.');break}}if(!buildReady)throw Error('Quá thời gian chờ Github Actions')}catch(e){progress('Lỗi biên dịch',0);log('LỖI: '+e.message)}finally{busy=false;$('#compile').disabled=!selected}};
async function downloadFirmware(format='zip'){if(!buildReady||!buildId)throw Error('Chưa có firmware');let r=await api('download',{query:{id:buildId,format},raw:true});return r.blob()}
$('#download').onclick=async()=>{try{let blob=await downloadFirmware(),url=URL.createObjectURL(blob),a=create('a');a.href=url;a.download='appdock-'+(selected?.id||'firmware')+'.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);log('Đã tải gói firmware ZIP')}catch(e){log('TẢI LỖI: '+e.message)}};
$('#flash').onclick=async()=>{
 if(!buildReady||flashing)return;
 const board=$('#board').value,port=usb.selected;
 if(!Object.hasOwn(bootloader,board))return log('Cần công cụ nạp riêng cho board này');
 if(!port)return log('Hãy kết nối cổng USB trước khi nạp.');
 if(portBoardMismatch(port,board))return log('Nạp bị khóa: USB và board đã chọn không khớp.');
 if(!usb.ports.includes(port))return log('Board đã rút khỏi máy. Hãy quét lại.');
 if(!confirm('Xác nhận nạp lên '+boardNames[board]+' qua '+identifySerialPort(port).label+'? Chương trình cũ trên board sẽ bị thay thế.'))return;
 flashing=true;updateFlash();$('#usb-grant').disabled=$('#usb-scan').disabled=true;
 let flasher;
 try{
  const hex=await(await downloadFirmware('hex')).text();
  if(usb.selected!==port||!usb.ports.includes(port))throw Error('Cổng đã thay đổi trong lúc chuẩn bị nạp');
  serialPort=port;flasher=new AvrFlasher(port,log);
  await flasher.start(bootloader[board]);
  await flasher.flash(hex,n=>progress('Đang nạp firmware qua USB',n));
  progress('Đã gửi firmware qua USB',100);log('Đã gửi xong firmware. Kiểm tra thiết bị chạy đúng.')
 }catch(e){progress('Nạp USB lỗi',0);log('UPLOAD: '+e.message)}
 finally{
  try{await flasher?.close()}catch{}
  serialPort=null;flashing=false;
  try{await usb.scan()}catch(e){log('USB: '+e.message)}
  paintUsb(usb.snapshot())
 }
};
function showAdmin(open){if(!admin)return;$('#user-area').hidden=open;$('#admin-area').hidden=!open;$('#admin-nav').classList.toggle('selected',open);$('#mobile-admin').classList.toggle('active',open);window.scrollTo(0,0)}$('#admin-nav').onclick=()=>showAdmin(true);$('#mobile-admin').onclick=()=>showAdmin(true);$('#mobile-programs').onclick=()=>showAdmin(false);$('#mobile-settings').onclick=()=>showAdmin(false);
function createBoardChoices(){let root=$('#admin-boards');root.replaceChildren();for(const [key,label] of Object.entries(boardNames)){let box=create('label'),input=create('input');input.type='checkbox';input.value=key;input.checked=['uno','nano','nano_old'].includes(key);box.append(input,create('span',label));root.append(box)}}
function addVariable(f={}){let row=create('div',undefined,'variable-row'),head=create('div',undefined,'variable-head'),n=create('span','Biến cấu hình'),remove=button('✕ Xóa','',()=>row.remove());head.append(n,remove);let grid=create('div',undefined,'variable-grid');const field=(key,caption,value,type='text')=>{let label=create('label',undefined,'field');label.append(create('span',caption));let el;if(type==='select'){el=create('select');for(const val of ['pin','integer','string','address','boolean','choice']){let op=create('option',val);op.value=val;el.append(op)}el.value=value||'pin'}else{el=create('input');el.value=value??'';el.type=type}el.dataset.field=key;label.append(el);grid.append(label);return el};field('key','Mã biến',f.key||'GPIO_PIN');field('label','Tên hiển thị',f.label||'Chân GPIO');field('type','Kiểu biến',f.type||'pin','select');field('default','Mặc định',f.default??'13');field('min','Giới hạn thấp',f.min??2,'number');field('max','Giới hạn cao',f.max??13,'number');field('maxLength','Dài tối đa',f.maxLength??64,'number');field('options','Lựa chọn (phân tách dấu ,)',(f.options||[]).join(','));row.append(head,grid);$('#admin-vars').append(row)}
function parseVariable(row){const get=k=>row.querySelector('[data-field="'+k+'"]').value.trim(),type=get('type');let out={key:get('key').toUpperCase(),label:get('label'),type};if(['pin','integer'].includes(type)){out.min=Number(get('min'));out.max=Number(get('max'));out.default=Number(get('default'))}else if(type==='boolean')out.default=get('default').toLowerCase()==='true';else if(type==='choice'){out.options=get('options').split(',').map(s=>s.trim()).filter(Boolean);out.default=get('default')}else{out.default=get('default');out.maxLength=Number(get('maxLength'))||64}return out}
function newProject(){showAdmin(true);$('#admin-id').value='';$('#admin-id').readOnly=false;$('#admin-title').value='';$('#admin-description').value='';$('#admin-version').value='1.0.0';$('#admin-published').checked=true;$('#admin-code').value='#include "generated_config.h"\n\nvoid setup() {\n  pinMode(GPIO_PIN, OUTPUT);\n}\nvoid loop() {\n  digitalWrite(GPIO_PIN, HIGH);\n  delay(500);\n  digitalWrite(GPIO_PIN, LOW);\n  delay(500);\n}\n';createBoardChoices();$('#admin-vars').replaceChildren();addVariable({key:'GPIO_PIN',label:'Chân GPIO',type:'pin',min:2,max:13,default:13});$('#admin-message').textContent='Chưa lưu chương trình lên GitHub'}
async function editProject(id){showAdmin(true);try{let r=await api('source',{query:{id}}),p=r.manifest;$('#admin-id').value=p.id;$('#admin-title').value=p.title;$('#admin-description').value=p.description;$('#admin-version').value=p.version;$('#admin-published').checked=!!p.published;$('#admin-code').value=r.code;createBoardChoices();document.querySelectorAll('#admin-boards input').forEach(x=>x.checked=p.boards.includes(x.value));$('#admin-vars').replaceChildren();p.fields.forEach(addVariable);$('#admin-message').textContent='Đang chỉnh chương trình '+p.id}catch(e){log('ADMIN: '+e.message)}}
$('#admin-new').onclick=newProject;$('#admin-add-var').onclick=()=>addVariable();$('#admin-upload').onclick=()=>$('#admin-file').click();$('#admin-file').onchange=async()=>{let f=$('#admin-file').files[0];if(!f)return;if(f.size>100000){$('#admin-message').textContent='File vượt 100KB';return}$('#admin-code').value=await f.text();$('#admin-message').textContent='Đã tải '+f.name+' vào editor, chưa phát hành'};
$('#admin-publish').onclick=async()=>{let save=$('#admin-publish');save.disabled=true;try{let boards=[...document.querySelectorAll('#admin-boards input:checked')].map(x=>x.value);let fields=[...document.querySelectorAll('.variable-row')].map(parseVariable);let payload={id:$('#admin-id').value.trim().toLowerCase(),title:$('#admin-title').value.trim(),version:$('#admin-version').value.trim(),description:$('#admin-description').value.trim(),published:$('#admin-published').checked,boards,fields,code:$('#admin-code').value};$('#admin-message').textContent='Đang phát hành...';let x=await api('publish',{body:payload});$('#admin-message').textContent='Đã phát hành · commit '+x.commit.slice(0,9);log('Quản trị: Đã xuất bản '+x.id+' lên GitHub');await load()}catch(e){$('#admin-message').textContent='Lỗi: '+e.message;log('ADMIN LỖI: '+e.message)}finally{save.disabled=false}};
createBoardChoices();newProject();showAdmin(false);usb.start().catch(e=>log('USB: '+e.message));load();
