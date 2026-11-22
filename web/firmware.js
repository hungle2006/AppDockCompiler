import {uploadFirmware,uploadProtocol,methodDescription} from '/firmware-uploader.js';
import {SerialPortManager, identifySerialPort, portBoardMismatch} from '/firmware-ports.js';
const $=sel=>document.querySelector(sel);
import {BOARDS,boardNames,bootloader} from '/firmware-boards.js';
import {setupAdminIDE} from '/firmware-ide.js';
let ideController=null;
window.__appdockCurrentLibraries=[];
let projects=[],selected=null,admin=false,buildId=null,buildReady=false,busy=false,flashing=false,serialPort=null;
function log(message){const box=$('#log');box.textContent+='\n['+new Date().toLocaleTimeString('vi-VN')+'] '+message;box.scrollTop=box.scrollHeight}
function progress(label,n=0){$('#buildstatus').textContent=label;$('#progress').style.width=n+'%';$('#buildpct').textContent=n+'%'}
const rememberedPort = (()=>{try{return localStorage.getItem('appdock-firmware-usb-hint')||null}catch{return null}})();
const usb = new SerialPortManager({
 serial:navigator.serial, remembered:rememberedPort,
 onChange:updateUsbUi,
 onError:e=>log('USB: '+(e?.message||e))
});
function usbHelp(text,kind=''){
 const element=$('#usb-board-hint');element.textContent=text;element.className='usb-board-hint'+(kind?' '+kind:'');
}
function updateFlashAvailability(){
 const board=$('#board')?.value;
 $('#flash').disabled=!buildReady||busy||flashing||!usb.supported||!usb.selected||uploadProtocol(board)==='download'||portBoardMismatch(usb.selected,board);
}
function updateUsbUi(state){
 const dropdown=$('#usb-select');if(!dropdown)return;
 dropdown.replaceChildren();let indicator=$('#usb-indicator');indicator.className='usb-indicator';
 $('#usb-scan').disabled=!state.supported||state.scanning;
 $('#usb-grant').disabled=!state.supported;
 dropdown.disabled=!state.supported||!state.ports.length||flashing;
 if(!state.supported){
  $('#usb-connection-status').textContent='Trình duyệt chưa hỗ trợ kết nối USB';
  $('#usb-hint').textContent='Dùng Chrome hoặc Edge trên máy tính qua HTTPS.';
  dropdown.append(new Option('Web Serial chưa được hỗ trợ',''));
  $('#usb-port-count').textContent='Không khả dụng';
  usbHelp('Bạn vẫn có thể tải firmware để nạp bằng Arduino IDE / công cụ tương thích.','warning');
  updateFlashAvailability();return;
 }
 $('#usb-port-count').textContent=state.ports.length+' thiết bị';
 if(!state.ports.length){
  $('#usb-connection-status').textContent='Chưa tìm thấy cổng được cấp quyền';
  $('#usb-hint').textContent='Cắm board vào USB, nhấn Cấp quyền cổng mới một lần; từ lần sau sẽ tự tìm lại.';
  dropdown.append(new Option('Chưa cấp quyền cổng Serial',''));
  usbHelp('Không thể tự mở cổng COM mới khi bạn chưa cho phép. AppDock không tự nạp chương trình.');
 }else{
  const count=state.ports.length;
  $('#usb-connection-status').textContent=state.selected?'Đã nhận diện cổng USB / Serial':count+' cổng đã được cấp quyền';
  $('#usb-hint').textContent=state.selected?'Cổng đã cấp quyền được chọn tự động; không cần chọn COM lại.':'Có nhiều thiết bị: chọn đúng cổng trước khi nạp.';
  if(state.selected)indicator.classList.add('ready');
  dropdown.append(new Option(state.selected?'Chọn cổng khác…':'Vui lòng chọn đúng cổng USB',''));
  for(let i=0;i<count;i++){
   const found=identifySerialPort(state.ports[i]);
   const option=new Option('Cổng '+(i+1)+' · '+found.label+' · '+found.signature,String(i));
   dropdown.append(option);
   if(state.ports[i]===state.selected)dropdown.value=String(i);
  }
  if(state.selected){
   const found=identifySerialPort(state.selected),board=$('#board')?.value;
   if(portBoardMismatch(state.selected,board)){
    usbHelp('USB gợi ý '+found.label+', nhưng bạn đang chọn '+(boardNames[board]||board)+'. Đã khóa nạp để tránh nhầm board. Hãy chọn firmware và board phù hợp.','error');
    indicator.classList.remove('ready');indicator.classList.add('error');
   }else if(found.family){
    usbHelp('USB gợi ý '+found.label+' ('+found.signature+'). Đây không phải xác minh bootloader; hãy kiểm tra mẫu board thực tế trước khi nạp.');
   }else{
    usbHelp(found.label+' · '+found.signature+'. Chip USB-Serial có thể dùng trên nhiều board; hãy xác nhận loại board và bootloader.','warning');
   }
  }else usbHelp('Đã thấy nhiều cổng. Chọn thiết bị bên trên; không tự chọn cổng để tránh nạp nhầm.','warning');
 }
 updateFlashAvailability();ideController?.refresh();
}
$('#usb-scan').onclick=async()=>{try{await usb.scan();log('USB: Đã quét '+usb.ports.length+' cổng đã cấp quyền.')}catch(e){log('USB: Không thể quét: '+e.message)}};
$('#usb-grant').onclick=async()=>{
 try{const port=await usb.grant();
  try{localStorage.setItem('appdock-firmware-usb-hint',identifySerialPort(port).signature)}catch{}
  log('USB: Đã cấp quyền '+identifySerialPort(port).label+'. Từ lần sau AppDock sẽ tự tìm lại cổng này.');
 }catch(e){if(e.name!=='NotFoundError')log('USB: '+e.message)}
};
$('#usb-select').onchange=e=>{
 if(e.target.value===''){usb.choose(-1);return;}
 const port=usb.choose(Number(e.target.value));
 if(port){try{localStorage.setItem('appdock-firmware-usb-hint',identifySerialPort(port).signature)}catch{}
 log('USB: Đã chọn '+identifySerialPort(port).label);}
};
function clearBuild(){buildId=null;buildReady=false;$('#download').disabled=true;$('#flash').disabled=true;$('#compile').disabled=!selected||busy;progress('Sẵn sàng biên dịch',0)}
async function api(action,options={}){const url=new URL('/api/firmware',location.origin);url.searchParams.set('action',action);for(const [k,v] of Object.entries(options.query||{}))url.searchParams.set(k,v);const response=await fetch(url,{method:options.body?'POST':'GET',headers:options.body?{'Content-Type':'application/json'}:{},body:options.body?JSON.stringify(options.body):undefined,cache:'no-store',credentials:'same-origin'});if(!response.ok){let d={};try{d=await response.json()}catch{}throw Error(d.error||'HTTP '+response.status)}return options.raw?response:response.json()}
function create(tag,text,className){const el=document.createElement(tag);if(text!==undefined)el.textContent=text;if(className)el.className=className;return el}
function button(text,cls,fn){let b=create('button',text,cls);b.type='button';if(fn)b.addEventListener('click',fn);return b}
async function load(){try{let [list,session,health]=await Promise.all([api('list'),api('session'),api('health')]);projects=list.projects||[];admin=session.admin===true;$('#admin-nav').hidden=!admin;$('#mobile-admin').hidden=!admin;$('#statusdot').classList.toggle('ready',health.compilerReady);$('#servertext').textContent=health.compilerReady?'GitHub Compiler sẵn sàng':'Chưa kích hoạt GitHub Token';if(!health.compilerReady)log('Máy chủ chưa có GitHub Actions Token. Bạn vẫn có thể xem và lưu cấu hình.');if(admin&&!ideController){ideController=setupAdminIDE({api,usb,log,createPayload:adminPayload});}$('#count').textContent=projects.length+' chương trình';renderCards();if(selected){const fresh=projects.find(p=>p.id===selected.id);if(fresh)selectProject(fresh)}else if(projects.length)selectProject(projects[0])}catch(e){$('#cards').replaceChildren(create('p','Không tải được thư viện: '+e.message,'empty'));$('#servertext').textContent='Lỗi kết nối';log('LỖI: '+e.message)}}
function renderCards(){let root=$('#cards');root.replaceChildren();let q=$('#search').value.trim().toLocaleLowerCase('vi-VN'),items=projects.filter(p=>(p.title+' '+p.description+' '+p.id).toLocaleLowerCase('vi-VN').includes(q));if(!items.length){root.append(create('div','Chưa có chương trình phù hợp.','empty'));return}for(const item of items){let card=create('div',undefined,'firmware-card'+(selected?.id===item.id?' active':'')),icon=create('div','⌘','card-icon'),details=create('div',undefined,'card-details'),title=create('strong',item.title),description=create('small',item.description),tags=create('div',undefined,'tagline');for(const b of item.boards.slice(0,4))tags.append(create('span',boardNames[b]?.replace('Arduino ','')||b,'tag'));if(item.boards.length>4)tags.append(create('span','+'+(item.boards.length-4),'tag'));details.append(title,description,tags);card.append(icon,details,create('span','›','arrow'));let choose=button('Chọn chương trình','',()=>selectProject(item));choose.className='cover-button';choose.setAttribute('aria-label','Chọn '+item.title);choose.style.cssText='position:absolute;inset:0;opacity:0;width:100%;height:100%;cursor:pointer';card.style.position='relative';card.append(choose);if(admin){let edit=button('✎ Sửa','button light',()=>editProject(item.id));edit.style.cssText='position:relative;z-index:2;font-size:10px;padding:6px;min-height:29px';card.append(edit)}root.append(card)}}
function selectProject(item){selected=item;$('#config-empty').hidden=true;$('#config-form').hidden=false;$('#config-title').textContent=item.title;$('#config-description').textContent=item.description||'Chỉ những biến được cho phép mới có thể thay đổi';let board=$('#board');board.replaceChildren();const groups=new Map();for(const id of item.boards){const info=BOARDS.find(x=>x.id===id);const family=info?.family||'Khác';if(!groups.has(family)){const group=create('optgroup');group.label=family;groups.set(family,group);board.append(group)}let option=create('option',boardNames[id]||id);option.value=id;groups.get(family).append(option)}const prior=localStorage.getItem('appdock-board-'+item.id);if(prior&&item.boards.includes(prior))board.value=prior;renderFields();clearBuild();renderCards();updateUsbUi(usb.snapshot())}
function renderFields(){if(!selected)return;let b=$('#board').value;localStorage.setItem('appdock-board-'+selected.id,b);$('#board-help').textContent='Board: '+(boardNames[b]||b)+' · '+methodDescription(b);let root=$('#variables');root.replaceChildren();let saved={};try{saved=JSON.parse(localStorage.getItem('appdock-config-'+selected.id+'-'+b)||'{}')}catch{}for(const f of selected.fields){let label=create('label',undefined,'field'),caption=create('span',f.label),el;const value=Object.hasOwn(saved,f.key)?saved[f.key]:f.default;if(f.type==='choice'){el=create('select');for(const o of f.options||[]){let option=create('option',String(o));option.value=String(o);el.append(option)}el.value=String(value)}else if(f.type==='boolean'){el=create('input');el.type='checkbox';el.className='toggle';el.checked=!!value}else{el=create('input');el.type=['integer','pin'].includes(f.type)?'number':'text';el.value=value??'';if(el.type==='number'){el.step='1';el.min=f.min??0;el.max=f.max??1000000}else el.maxLength=f.maxLength||64;el.placeholder=f.type==='pin'?'GPIO':f.type==='address'?'192.168.1.10':'Nhập giá trị'}el.dataset.variable=f.key;el.addEventListener('input',()=>{if(buildReady)clearBuild()});label.append(caption,el);if(f.help)label.append(create('small',f.help));root.append(label)}$('#compile').disabled=false;clearBuild()}
function collectConfig(){if(!selected)throw Error('Chưa chọn chương trình');let result={};for(const f of selected.fields){let el=[...document.querySelectorAll('[data-variable]')].find(x=>x.dataset.variable===f.key);if(!el)throw Error('Thiếu biến '+f.key);let value=f.type==='boolean'?el.checked:['pin','integer'].includes(f.type)?Number(el.value):el.value;if(['pin','integer'].includes(f.type)&&(!Number.isSafeInteger(value)||el.value===''))throw Error(f.label+': cần số nguyên');if(f.type==='choice'&&typeof f.default==='number')value=Number(value);result[f.key]=value}return result}
$('#search').addEventListener('input',renderCards);$('#board').addEventListener('change',()=>{renderFields();updateUsbUi(usb.snapshot())});$('#save-config').onclick=()=>{try{let conf=collectConfig();localStorage.setItem('appdock-config-'+selected.id+'-'+$('#board').value,JSON.stringify(conf));log('Đã lưu cấu hình cục bộ cho '+selected.title)}catch(e){log(e.message)}};$('#reset-config').onclick=()=>{if(!selected)return;localStorage.removeItem('appdock-config-'+selected.id+'-'+$('#board').value);renderFields()};$('#clear-log').onclick=()=>$('#log').textContent='Console đã xóa.';$('#btn-reload').onclick=load;
$('#compile').onclick=async()=>{if(busy||!selected)return;busy=true;$('#compile').disabled=true;$('#download').disabled=true;$('#flash').disabled=true;buildReady=false;let start=Date.now();try{let values=collectConfig();progress('Đang gửi yêu cầu biên dịch',12);let r=await api('compile',{body:{project:selected.id,board:$('#board').value,config:values}});buildId=r.id;log('Đã tạo công việc #'+buildId.slice(0,8));let state='';while(Date.now()-start<14*60*1000){await new Promise(resolve=>setTimeout(resolve,4500));let s=await api('status',{query:{id:buildId}});if(s.status!==state){state=s.status;log('GitHub Actions: '+state)}if(s.status==='queued')progress('Đang xếp hàng GitHub Actions',28);if(s.status==='in_progress')progress('Đang biên dịch firmware',60);if(s.status==='completed'){if(s.conclusion!=='success')throw Error('GitHub Actions báo thất bại. '+(s.runUrl||''));if(!s.ready)throw Error('Chưa tìm được firmware artifact');buildReady=true;progress('Biên dịch thành công',100);$('#download').disabled=false;updateFlashAvailability();log('Firmware đã sẵn sàng; có thể tải hoặc nạp USB khi tương thích.');break}}if(!buildReady)throw Error('Quá thời gian chờ Github Actions')}catch(e){progress('Lỗi biên dịch',0);log('LỖI: '+e.message)}finally{busy=false;$('#compile').disabled=!selected;updateFlashAvailability()}};
async function downloadFirmware(format='zip'){if(!buildReady||!buildId)throw Error('Chưa có firmware');let r=await api('download',{query:{id:buildId,format},raw:true});return r.blob()}
$('#download').onclick=async()=>{try{const pico=['pico','pico_w','pico2','pico2_w'].includes($('#board').value),blob=await downloadFirmware(pico?'uf2':'zip'),url=URL.createObjectURL(blob),a=create('a');a.href=url;a.download='appdock-'+(selected?.id||'firmware')+(pico?'.uf2':'.zip');a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);log(pico?'Đã tải UF2; giữ BOOTSEL rồi sao chép vào ổ Pico':'Đã tải gói firmware ZIP')}catch(e){log('TẢI LỖI: '+e.message)}};
$('#flash').onclick=async()=>{
 if(!buildReady||flashing)return;
 const board=$('#board').value;
 if(uploadProtocol(board)==='download')return log(methodDescription(board));
 const port=usb.selected;
 if(!port)return log('Hãy cấp quyền cổng USB trước khi nạp.');
 if(portBoardMismatch(port,board))return log('USB/board không khớp. Từ chối nạp firmware.');
 if(!usb.ports.includes(port))return log('Cổng USB đã ngắt, hãy quét lại.');
 if(!confirm('NẠP firmware '+boardNames[board]+' qua '+identifySerialPort(port).label+'? Dữ liệu chương trình hiện tại trên board sẽ bị thay thế.'))return;
 flashing=true;updateFlashAvailability();$('#usb-grant').disabled=true;$('#usb-scan').disabled=true;
 try{
  await uploadFirmware({board,port,fetchFirmware:async format=>{
    if(usb.selected!==port||!usb.ports.includes(port))throw Error('USB bị rút/thay đổi trước khi nạp');
    return downloadFirmware(format);
  },log,progress:n=>progress('Đang nạp firmware '+n+'%',n)});
  progress('Đã nạp firmware qua USB',100);log('Nạp thành công. Hãy kiểm tra thiết bị.');
 }catch(e){progress('Nạp USB lỗi',0);log('UPLOAD: '+e.message)}
 finally{
  serialPort=null;flashing=false;try{await usb.scan()}catch(e){log('USB: '+e.message)}updateUsbUi(usb.snapshot());
 }
};
function showAdmin(open){if(!admin)return;if(!open)ideController?.closeMonitor();$('#user-area').hidden=open;$('#admin-area').hidden=!open;$('#admin-nav').classList.toggle('selected',open);$('#mobile-admin').classList.toggle('active',open);window.scrollTo(0,0)}$('#admin-nav').onclick=()=>showAdmin(true);$('#mobile-admin').onclick=()=>showAdmin(true);$('#mobile-programs').onclick=()=>showAdmin(false);$('#mobile-settings').onclick=()=>showAdmin(false);
function createBoardChoices(){let root=$('#admin-boards');root.replaceChildren();let groups=new Map();for(const item of BOARDS){let group=groups.get(item.family);if(!group){group=create('div',undefined,'board-group');group.dataset.family=item.family;group.append(create('div',item.family,'board-group-title'));groups.set(item.family,group);root.append(group)}let box=create('label',undefined,'board-choice'),input=create('input');input.type='checkbox';input.value=item.id;input.checked=['uno','nano','nano_old'].includes(item.id);box.append(input,create('span',item.label));group.append(box);input.addEventListener('change',()=>{updateBoardCount();ideController?.boardMenu()})}updateBoardCount()}
function updateBoardCount(){let total=document.querySelectorAll('#admin-boards input:checked').length;$('#admin-board-count').textContent=total+' / '+BOARDS.length+' board'}
$('#admin-board-search').oninput=()=>{const q=$('#admin-board-search').value.trim().toLowerCase();document.querySelectorAll('#admin-boards .board-group').forEach(group=>{let matches=0;group.querySelectorAll('.board-choice').forEach(el=>{const ok=(el.textContent+' '+group.dataset.family).toLowerCase().includes(q);el.hidden=!ok;if(ok)matches++});group.hidden=!matches})};
function addVariable(f={}){let row=create('div',undefined,'variable-row'),head=create('div',undefined,'variable-head'),n=create('span','Biến cấu hình'),remove=button('✕ Xóa','',()=>row.remove());head.append(n,remove);let grid=create('div',undefined,'variable-grid');const field=(key,caption,value,type='text')=>{let label=create('label',undefined,'field');label.append(create('span',caption));let el;if(type==='select'){el=create('select');for(const val of ['pin','integer','string','address','boolean','choice']){let op=create('option',val);op.value=val;el.append(op)}el.value=value||'pin'}else{el=create('input');el.value=value??'';el.type=type}el.dataset.field=key;label.append(el);grid.append(label);return el};field('key','Mã biến',f.key||'GPIO_PIN');field('label','Tên hiển thị',f.label||'Chân GPIO');field('type','Kiểu biến',f.type||'pin','select');field('default','Mặc định',f.default??'13');field('min','Giới hạn thấp',f.min??2,'number');field('max','Giới hạn cao',f.max??13,'number');field('maxLength','Dài tối đa',f.maxLength??64,'number');field('options','Lựa chọn (phân tách dấu ,)',(f.options||[]).join(','));row.append(head,grid);$('#admin-vars').append(row)}
function parseVariable(row){const get=k=>row.querySelector('[data-field="'+k+'"]').value.trim(),type=get('type');let out={key:get('key').toUpperCase(),label:get('label'),type};if(['pin','integer'].includes(type)){out.min=Number(get('min'));out.max=Number(get('max'));out.default=Number(get('default'))}else if(type==='boolean')out.default=get('default').toLowerCase()==='true';else if(type==='choice'){out.options=get('options').split(',').map(s=>s.trim()).filter(Boolean);out.default=get('default')}else{out.default=get('default');out.maxLength=Number(get('maxLength'))||64}return out}
function newProject(){showAdmin(true);$('#admin-id').value='';$('#admin-id').readOnly=false;$('#admin-title').value='';$('#admin-description').value='';$('#admin-version').value='1.0.0';$('#admin-published').checked=true;$('#admin-code').value='#include "generated_config.h"\n\nvoid setup() {\n  pinMode(GPIO_PIN, OUTPUT);\n}\nvoid loop() {\n  digitalWrite(GPIO_PIN, HIGH);\n  delay(500);\n  digitalWrite(GPIO_PIN, LOW);\n  delay(500);\n}\n';createBoardChoices();$('#admin-vars').replaceChildren();addVariable({key:'GPIO_PIN',label:'Chân GPIO',type:'pin',min:2,max:13,default:13});window.__appdockCurrentLibraries=[];ideController?.reset();$('#admin-message').textContent='Chưa lưu chương trình lên GitHub'}
async function editProject(id){showAdmin(true);try{let r=await api('source',{query:{id}}),p=r.manifest;$('#admin-id').value=p.id;$('#admin-title').value=p.title;$('#admin-description').value=p.description;$('#admin-version').value=p.version;$('#admin-published').checked=!!p.published;$('#admin-code').value=r.code;createBoardChoices();document.querySelectorAll('#admin-boards input').forEach(x=>x.checked=p.boards.includes(x.value));$('#admin-vars').replaceChildren();p.fields.forEach(addVariable);window.__appdockCurrentLibraries=p.libraries||[];updateBoardCount();ideController?.sync();$('#admin-message').textContent='Đang chỉnh chương trình '+p.id}catch(e){log('ADMIN: '+e.message)}}
$('#admin-new').onclick=newProject;$('#admin-add-var').onclick=()=>addVariable();$('#admin-upload').onclick=()=>$('#admin-file').click();$('#admin-file').onchange=async()=>{let f=$('#admin-file').files[0];if(!f)return;if(f.size>100000){$('#admin-message').textContent='File vượt 100KB';return}$('#admin-code').value=await f.text();$('#admin-message').textContent='Đã tải '+f.name+' vào editor, chưa phát hành'};
function adminPayload(){return {id:$('#admin-id').value.trim().toLowerCase(),title:$('#admin-title').value.trim(),version:$('#admin-version').value.trim(),description:$('#admin-description').value.trim(),published:$('#admin-published').checked,boards:[...document.querySelectorAll('#admin-boards input:checked')].map(x=>x.value),fields:[...document.querySelectorAll('.variable-row')].map(parseVariable),code:$('#admin-code').value,libraries:ideController?.libraries()||[]}}
$('#admin-publish').onclick=async()=>{let save=$('#admin-publish');save.disabled=true;try{let payload=adminPayload();$('#admin-message').textContent='Đang phát hành...';let x=await api('publish',{body:payload});$('#admin-message').textContent='Đã phát hành · commit '+x.commit.slice(0,9);log('Quản trị: Đã xuất bản '+x.id+' lên GitHub');await load()}catch(e){$('#admin-message').textContent='Lỗi: '+e.message;log('ADMIN LỖI: '+e.message)}finally{save.disabled=false}};
createBoardChoices();newProject();showAdmin(false);usb.start().catch(e=>log('USB: '+e.message));load();
