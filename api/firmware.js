import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {neon} from '@neondatabase/serverless';
import {unzipSync} from 'fflate';

const REPO=process.env.COMPILER_REPO||'hungle2006/AppDockCompiler';
const GH='https://api.github.com/repos/'+REPO+'/';
const LEGACY='https://anh-app-1w8vycmqy-hope-1091.vercel.app/api/hub?action=session';
const BOARDS=new Set(["uno","nano","nano_old","rf_nano","rf_nano_old","mega","leonardo","micro","pro_mini","nano_every","uno_wifi_rev2","uno_r4_minima","uno_r4_wifi","nano_33_iot","mkr_wifi_1010","nano_33_ble","nano_rp2040","esp32","esp32_s2","esp32_s3","esp32_c3","esp32_c6","esp8266","d1_mini","pico","pico_w","pico2","pico2_w","due_programming","due_native","nano_esp32"]);
const SLUG=/^[a-z0-9][a-z0-9-]{0,49}$/;
const NAME=/^[A-Z][A-Z0-9_]{1,39}$/;
const UUID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const LIBRARY=/^[A-Za-z0-9][A-Za-z0-9 _.-]{0,69}$/;
const PIN_LIMIT={"uno":13,"nano":13,"nano_old":13,"rf_nano":13,"rf_nano_old":13,"mega":53,"leonardo":19,"micro":19,"pro_mini":13,"nano_every":21,"uno_wifi_rev2":19,"uno_r4_minima":21,"uno_r4_wifi":21,"nano_33_iot":21,"mkr_wifi_1010":21,"nano_33_ble":31,"nano_rp2040":29,"esp32":33,"esp32_s2":46,"esp32_s3":48,"esp32_c3":21,"esp32_c6":23,"esp8266":16,"d1_mini":16,"pico":28,"pico_w":28,"pico2":28,"pico2_w":28,"due_programming":53,"due_native":53,"nano_esp32":21};
function problem(res,code,message){return res.status(code).json({ok:false,error:message})}
function sameOrigin(req){try{const u=new URL(req.headers.origin);return u.protocol==='https:'&&u.host===req.headers.host}catch{return false}}
function identity(req,res){let value=String(req.cookies?.appdock_fw||'');if(!/^[0-9a-f]{48}$/.test(value)){value=randomBytes(24).toString('hex');res.setHeader('Set-Cookie','appdock_fw='+value+'; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000')}return createHash('sha256').update(value).digest('hex')}
function iphash(req){return createHash('sha256').update((process.env.SESSION_SECRET||'appdock')+':'+String(req.headers['x-forwarded-for']||'unknown').split(',')[0]).digest('hex')}
async function github(path,init={}){const token=process.env.GITHUB_ACTIONS_TOKEN;if((init.method||'GET')!=='GET'&&!token)throw Error('Chưa thiết lập GITHUB_ACTIONS_TOKEN');const r=await fetch(GH+path,{...init,cache:'no-store',headers:{Accept:'application/vnd.github+json','User-Agent':'AppDockCompiler','X-GitHub-Api-Version':'2022-11-28',...(token?{Authorization:'Bearer '+token}:{}),...init.headers}});if(!r.ok)throw Error('GitHub API '+r.status+': '+(await r.text()).slice(0,160));return r.status===204?null:r.json()}
async function contents(path){const result=await github('contents/'+path+'?ref=main');if(!result?.content||result.type!=='file')throw Error('Không tìm thấy tệp GitHub');return Buffer.from(result.content,'base64').toString('utf8')}
async function project(id){if(!SLUG.test(id))throw Error('ID chương trình không hợp lệ');const m=JSON.parse(await contents('projects/'+id+'/manifest.json'));if(m.id!==id||!Array.isArray(m.boards)||!Array.isArray(m.fields))throw Error('Schema chương trình không hợp lệ');return m}
function values(fields,board,config){if(!config||Array.isArray(config)||typeof config!=='object')throw Error('Cấu hình không hợp lệ');if(fields.length>40)throw Error('Giới hạn 40 biến');const seen=new Set(),out={};for(const f of fields){if(!NAME.test(f.key)||seen.has(f.key))throw Error('Tên biến không hợp lệ');seen.add(f.key);const v=Object.hasOwn(config,f.key)?config[f.key]:f.default;if(f.type==='integer'||f.type==='pin'){if(!Number.isSafeInteger(v)||v<(f.min??0)||v>(f.max??1000000))throw Error(f.label+': số không hợp lệ');if(f.type==='pin'){const max=PIN_LIMIT[board]||13;if(v<2||v>max)throw Error(f.label+': chân GPIO không phù hợp với board')}}else if(f.type==='string'||f.type==='address'){if(typeof v!=='string'||v.length>(f.maxLength??64)||v.length>128||v.includes('\0'))throw Error(f.label+': chuỗi không hợp lệ');if(f.type==='address'&&!/^[a-zA-Z0-9 ._:/-]{1,128}$/.test(v))throw Error(f.label+': địa chỉ có ký tự không hỗ trợ')}else if(f.type==='boolean'){if(typeof v!=='boolean')throw Error(f.label+': giá trị true/false không hợp lệ')}else if(f.type==='choice'){if(!Array.isArray(f.options)||!f.options.includes(v))throw Error(f.label+': giá trị không được phép')}else throw Error('Loại biến chưa hỗ trợ');out[f.key]=v}if(Object.keys(config).some(key=>!seen.has(key)))throw Error('Bạn không được phép thay đổi biến khác');return out}
function validatePublish(input){if(!input||!SLUG.test(input.id)||!Array.isArray(input.boards)||!input.boards.length||input.boards.length>40||input.boards.some(b=>!BOARDS.has(b)))throw Error('ID hoặc danh sách board không hợp lệ');if(typeof input.title!=='string'||!input.title.trim()||input.title.length>90||String(input.description||'').length>500)throw Error('Tên/mô tả không hợp lệ');if(typeof input.code!=='string'||!input.code.trim()||Buffer.byteLength(input.code,'utf8')>100000)throw Error('Sketch trống hoặc vượt 100KB');if(input.fields?.length&&!input.code.includes('generated_config.h'))throw Error('Sketch có biến tùy chỉnh phải include generated_config.h');if(!Array.isArray(input.fields)||input.fields.length>40)throw Error('Số biến không hợp lệ');if(!Array.isArray(input.libraries||[])||(input.libraries||[]).length>16||(input.libraries||[]).some(x=>typeof x!=='string'||!LIBRARY.test(x)))throw Error('Danh sách thư viện Arduino không hợp lệ');const seen=new Set();for(const f of input.fields){if(!f||!NAME.test(f.key)||seen.has(f.key)||!['pin','integer','string','address','boolean','choice'].includes(f.type)||typeof f.label!=='string'||!f.label.trim()||f.label.length>80)throw Error('Định nghĩa biến không hợp lệ');seen.add(f.key);if((f.type==='pin'||f.type==='integer')&&(!Number.isSafeInteger(f.min)||!Number.isSafeInteger(f.max)||f.min>f.max))throw Error('Giới hạn số không hợp lệ');if(f.type==='choice'&&(!Array.isArray(f.options)||!f.options.length||f.options.length>30))throw Error('Danh sách lựa chọn không hợp lệ')}for(const board of input.boards)values(input.fields,board,{});return {id:input.id,title:input.title.trim(),description:String(input.description||''),version:String(input.version||'1.0.0').slice(0,32),published:input.published!==false,boards:input.boards,fields:input.fields,libraries:[...new Set(input.libraries||[])]}}
async function admin(req){const r=await fetch(LEGACY,{headers:{cookie:String(req.headers.cookie||''),'user-agent':'AppDockCompiler-role-check'},cache:'no-store'});if(!r.ok)return false;return(await r.json()).admin===true}
async function sql(){if(!process.env.DATABASE_URL)throw Error('DATABASE_URL chưa được cấu hình');const client=neon(process.env.DATABASE_URL);await client.query('CREATE TABLE IF NOT EXISTS appdock_firmware_jobs(id uuid PRIMARY KEY,actor varchar(64) NOT NULL, ip_hash varchar(64) NOT NULL,project varchar(64) NOT NULL,board varchar(30) NOT NULL, created_at timestamptz NOT NULL DEFAULT now())');return client}
async function ownedJob(req,res){const who=identity(req,res),id=String(req.query.id||'');if(!UUID.test(id))throw Error('ID biên dịch không hợp lệ');const db=await sql();const rows=await db.query('SELECT project,board FROM appdock_firmware_jobs WHERE id=$1::uuid AND actor=$2',[id,who]);if(!rows.length)throw Error('Không thấy bản biên dịch trong phiên của bạn');return {id,job:rows[0]}}
async function workflowRun(id){const r=await github('actions/runs?event=workflow_dispatch&per_page=100');return(r.workflow_runs||[]).find(x=>x.display_title==='AppDockCompiler · '+id)}
async function artifact(run,id){if(!run||run.status!=='completed'||run.conclusion!=='success')return null;const r=await github('actions/runs/'+run.id+'/artifacts?per_page=100');return(r.artifacts||[]).find(x=>x.name==='appdock-firmware-'+id&&!x.expired)||null}
async function commitProject(input,branch='main'){
 const m=validatePublish(input);
 let ref;
 if(branch==='appdock-preview'){
  try{ref=await github('git/ref/heads/appdock-preview')}
  catch(e){
   if(!String(e.message).includes('404'))throw e;
   const primary=await github('git/ref/heads/main');
   await github('git/refs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ref:'refs/heads/appdock-preview',sha:primary.object.sha})});
   ref=await github('git/ref/heads/appdock-preview');
  }
 }else ref=await github('git/ref/heads/main');
 const parent=ref.object.sha,base=await github('git/commits/'+parent);
 const tree=await github('git/trees',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({base_tree:base.tree.sha,tree:[
  {path:'projects/'+m.id+'/manifest.json',mode:'100644',type:'blob',content:JSON.stringify(m,null,2)+'\n'},
  {path:'projects/'+m.id+'/AppDockSketch.ino',mode:'100644',type:'blob',content:input.code}
 ]})});
 const commit=await github('git/commits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:(branch==='main'?'Publish':'Verify')+' AppDock firmware '+m.id,tree:tree.sha,parents:[parent]})});
 await github('git/refs/heads/'+branch,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({sha:commit.sha,force:false})});
 return {id:m.id,commit:commit.sha,manifest:m};
}
async function removeProject(id){
 if(!SLUG.test(id))throw Error('Mã chương trình không hợp lệ');
 const manifest=await project(id);
 const entries=await github('contents/projects/'+id+'?ref=main');
 if(!Array.isArray(entries)||entries.some(x=>x.type!=='file')||!entries.some(x=>x.name==='manifest.json')||!entries.some(x=>x.name==='AppDockSketch.ino'))throw Error('Cấu trúc chương trình không hỗ trợ xóa an toàn');
 const ref=await github('git/ref/heads/main'),parent=ref.object.sha,base=await github('git/commits/'+parent);
 const tree=await github('git/trees',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({base_tree:base.tree.sha,tree:entries.map(x=>({path:x.path,mode:'100644',type:'blob',sha:null}))})});
 const commit=await github('git/commits',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({message:'Remove AppDock firmware '+id,tree:tree.sha,parents:[parent]})});
 await github('git/refs/heads/main',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({sha:commit.sha,force:false})});
 return {id,title:manifest.title,commit:commit.sha};
}
async function publish(input){const result=await commitProject(input,'main');return {id:result.id,commit:result.commit}}
export default async function handler(req,res){res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');const action=String(req.query.action||'list');try{
 if(action==='health'&&req.method==='GET')return res.json({ok:true,compilerReady:!!process.env.GITHUB_ACTIONS_TOKEN,databaseReady:!!process.env.DATABASE_URL});
 if(action==='session'&&req.method==='GET'){identity(req,res);return res.json({ok:true,admin:await admin(req)})}
 if((action==='list'||action==='manage')&&req.method==='GET'){if(action==='manage'&&!await admin(req))return problem(res,403,'Chỉ quản trị viên được xem bản nháp');const entries=await github('contents/projects?ref=main');const list=await Promise.all((Array.isArray(entries)?entries:[]).filter(x=>x.type==='dir'&&SLUG.test(x.name)).slice(0,80).map(async x=>{try{const m=await project(x.name);return action==='manage'||m.published?m:null}catch{return null}}));return res.json({ok:true,projects:list.filter(Boolean)})}
 if(action==='source'&&req.method==='GET'){if(!await admin(req))return problem(res,403,'Chỉ quản trị viên được xem mã nguồn');const id=String(req.query.id||'');return res.json({ok:true,manifest:await project(id),code:await contents('projects/'+id+'/AppDockSketch.ino')})}
 if(action==='delete'&&req.method==='POST'){
 if(!sameOrigin(req))return problem(res,403,'Yêu cầu không cùng nguồn');
 if(!await admin(req))return problem(res,403,'Chỉ quản trị viên được xóa chương trình');
 const input=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
 const id=String(input.id||''),confirmId=String(input.confirmId||'');
 if(!SLUG.test(id)||confirmId!==id)return problem(res,400,'Nhập đúng mã chương trình để xác nhận xóa');
 return res.json({ok:true,...await removeProject(id)});
}
if(action==='publish'&&req.method==='POST'){if(!sameOrigin(req))return problem(res,403,'Yêu cầu không cùng nguồn');if(!await admin(req))return problem(res,403,'Cần đăng nhập Google với quyền quản trị AppDock');const input=typeof req.body==='string'?JSON.parse(req.body):req.body;return res.json({ok:true,...await publish(input)})}
 if(action==='verify'&&req.method==='POST'){
  if(!sameOrigin(req))return problem(res,403,'Yêu cầu không cùng nguồn');
  if(!await admin(req))return problem(res,403,'Chỉ quản trị viên mới được Verify mã nguồn');
  if(!process.env.GITHUB_ACTIONS_TOKEN)return problem(res,503,'GitHub Actions Token chưa được cấu hình');
  const input=typeof req.body==='string'?JSON.parse(req.body):req.body||{};
  const board=String(input.board||'');
  const draft={...input,published:false};
  const checked=validatePublish(draft);
  if(!checked.boards.includes(board))return problem(res,400,'Hãy chọn board có trong chương trình');
  const config=values(checked.fields,board,{});
  const who=identity(req,res),ip=iphash(req),db=await sql();
  const limits=await db.query("SELECT count(*)::int AS total FROM appdock_firmware_jobs WHERE (actor=$1 OR ip_hash=$2) AND created_at>now()-interval '1 hour'",[who,ip]);
  if(Number(limits[0].total)>=10)return problem(res,429,'Quá nhiều lượt Verify trong một giờ');
  const result=await commitProject(draft,'appdock-preview');
  const jobid=randomUUID();
  await db.query('INSERT INTO appdock_firmware_jobs(id,actor,ip_hash,project,board) VALUES($1::uuid,$2,$3,$4,$5)',[jobid,who,ip,checked.id,board]);
  try{await github('actions/workflows/compile.yml/dispatches',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ref:'appdock-preview',inputs:{request_id:jobid,project_id:checked.id,board,config_b64:Buffer.from(JSON.stringify(config)).toString('base64'),allow_draft:'true',revision:result.commit}})})}
  catch(e){await db.query('DELETE FROM appdock_firmware_jobs WHERE id=$1::uuid',[jobid]);throw e}
  return res.status(202).json({ok:true,id:jobid,revision:result.commit});
 }
 if(action==='compile'&&req.method==='POST'){if(!sameOrigin(req))return problem(res,403,'Yêu cầu không cùng nguồn');if(!process.env.GITHUB_ACTIONS_TOKEN)return problem(res,503,'GitHub Actions token chưa được thiết lập');const who=identity(req,res),ip=iphash(req),input=typeof req.body==='string'?JSON.parse(req.body):req.body||{};const id=String(input.project||''),board=String(input.board||'');const m=await project(id);if(!m.published||!BOARDS.has(board)||!m.boards.includes(board))return problem(res,400,'Chương trình hoặc board chưa được phát hành');const config=values(m.fields,board,input.config||{}),payload=Buffer.from(JSON.stringify(config)).toString('base64');if(payload.length>16000)return problem(res,413,'Cấu hình quá lớn');const db=await sql(),limits=await db.query("SELECT count(*)::int AS total FROM appdock_firmware_jobs WHERE (actor=$1 OR ip_hash=$2) AND created_at>now()-interval '1 hour'",[who,ip]);if(Number(limits[0].total)>=5)return problem(res,429,'Đạt giới hạn 5 lượt biên dịch/giờ');const jobid=randomUUID();await db.query('INSERT INTO appdock_firmware_jobs(id,actor,ip_hash,project,board) VALUES($1::uuid,$2,$3,$4,$5)',[jobid,who,ip,id,board]);try{await github('actions/workflows/compile.yml/dispatches',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ref:'main',inputs:{request_id:jobid,project_id:id,board,config_b64:payload}})})}catch(e){await db.query('DELETE FROM appdock_firmware_jobs WHERE id=$1::uuid',[jobid]);throw e}return res.status(202).json({ok:true,id:jobid})}
 if((action==='status'||action==='download')&&req.method==='GET'){const {id,job}=await ownedJob(req,res),run=await workflowRun(id),found=await artifact(run,id);if(action==='status')return res.json({ok:true,status:run?.status||'queued',conclusion:run?.conclusion||null,ready:!!found,runUrl:run?.html_url||null,board:job.board});if(!found)return problem(res,409,'Firmware chưa sẵn sàng');const resp=await fetch(GH+'actions/artifacts/'+found.id+'/zip',{headers:{Authorization:'Bearer '+process.env.GITHUB_ACTIONS_TOKEN,Accept:'application/vnd.github+json','User-Agent':'AppDockCompiler'}});if(!resp.ok)throw Error('Không thể tải firmware');const bytes=new Uint8Array(await resp.arrayBuffer());if(bytes.length>12000000)return problem(res,413,'Firmware quá lớn');if(['hex','uf2','bin'].includes(String(req.query.format||''))){
 const format=String(req.query.format),files=unzipSync(bytes);
 const entry=Object.entries(files).find(([n])=>n==='flash-manifest.json'||n.endsWith('/flash-manifest.json'));
 if(!entry)return problem(res,409,'Gói firmware thiếu flash manifest, hãy biên dịch lại');
 const info=JSON.parse(new TextDecoder().decode(entry[1]));
 if(info.board!==job.board)return problem(res,409,'Board trong firmware không khớp công việc biên dịch');
 if(info.protocol==='esptool')return problem(res,409,'Board Espressif cần gói ZIP chứa đúng địa chỉ flash');
 const ext='.'+format;
 let selected=typeof info.preferred==='string'&&info.preferred.endsWith(ext)?info.preferred:null;
 if(!selected)selected=info.files?.find(x=>typeof x.name==='string'&&x.name.endsWith(ext))?.name;
 if(!selected||!/^[-A-Za-z0-9_.]+$/.test(selected))return problem(res,409,'Không có tệp '+ext+' phù hợp board');
 const blob=Object.entries(files).find(([n])=>n===selected||n.endsWith('/'+selected))?.[1];
 if(!blob||blob.length>8*1024*1024||!blob.length)return problem(res,409,'Tệp firmware không hợp lệ');
 res.setHeader('Content-Type','application/octet-stream');
 res.setHeader('Content-Disposition','attachment; filename="'+selected+'"');
 return res.end(Buffer.from(blob))
}res.setHeader('Content-Type','application/zip');res.setHeader('Content-Disposition','attachment; filename="appdock-firmware.zip"');return res.end(Buffer.from(bytes))}
 return problem(res,404,'API không tồn tại');
}catch(e){console.error('AppDock firmware:',e.message);return problem(res,400,('Yêu cầu lỗi: '+String(e.message)).slice(0,270))}}
