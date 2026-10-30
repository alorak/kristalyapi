/* D0/D1 only: explicit user-triggered, read-only QE API discovery.
 * No implicit LAN requests, persistence, credential forwarding or DFT jobs.
 */
function localHttpHost(hostname){
 const h=hostname.toLowerCase().replace(/^\[|\]$/g,'');
 if(h==='localhost'||h==='::1'||h.endsWith('.localhost')||h.endsWith('.local'))return true;
 if(/^127\.\d+\.\d+\.\d+$/.test(h))return true;
 const m=h.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
 if(m){
  const a=m.slice(1).map(Number);
  if(a.some(n=>n>255))return false;
  return a[0]===10||(a[0]===172&&a[1]>=16&&a[1]<=31)||
   (a[0]===192&&a[1]===168);
 }
 return /^f[cd][0-9a-f:]+$/.test(h)||/^fe80:[0-9a-f:]+$/.test(h);
}
export function normalizeQeApiUrl(value){
 if(typeof value!=='string'||value.length>260)throw Error('Geçerli bir IP/port adresi girin.');
 const entered=value.trim();
 if(!/^https?:\/\//i.test(entered))throw Error('http:// veya https:// ile başlayan tam adres gerekli.');
 let url;
 try{url=new URL(entered);}catch{throw Error('API adresi geçerli bir URL değil.');}
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password||
  url.search||url.hash||url.pathname!=='/'||!url.hostname)
  throw Error('Yalnız şema, sunucu ve port girin; kullanıcı, yol, sorgu veya parola eklemeyin.');
 if(url.protocol==='http:'&&!localHttpHost(url.hostname))
  throw Error('Şifresiz HTTP yalnız yerel ağ/localhost için kabul edilir; uzak sunucuya HTTPS kullanın.');
 return url.origin;
}
async function jsonFromResponse(response,expectedPath){
 if(!response||typeof response.json!=='function')throw Error(expectedPath+' yanıtı alınamadı.');
 const type=response.headers?.get?.('content-type')||'';
 if(!type.toLowerCase().includes('application/json'))throw Error(expectedPath+' JSON döndürmedi.');
 const obj=await response.json();
 if(!obj||typeof obj!=='object'||Array.isArray(obj))
  throw Error(expectedPath+' geçerli veri döndürmedi.');
 return obj;
}
export async function inspectQeApi(address,{fetcher=fetch,timeoutMs=7000}={}){
 const base=normalizeQeApiUrl(address);
 if(!Number.isInteger(timeoutMs)||timeoutMs<100||timeoutMs>30000)
  throw Error('Bağlantı zaman aşımı 100–30000 ms aralığında olmalı.');
 const controller=new AbortController();
 const handle=setTimeout(()=>controller.abort(),timeoutMs);
 const options={method:'GET',mode:'cors',cache:'no-store',credentials:'omit',
  redirect:'error',signal:controller.signal};
 try{
  const [healthResponse,capsResponse]=await Promise.all([
   fetcher(base+'/api/health',options),
   fetcher(base+'/api/capabilities',options)
  ]);
  if(!healthResponse.ok&&healthResponse.status!==503)
   throw Error('Sağlık uç noktası HTTP '+healthResponse.status+' döndürdü.');
  if(!capsResponse.ok)
   throw Error('Yetenekler uç noktası HTTP '+capsResponse.status+' döndürdü.');
  const [health,caps]=await Promise.all([
   jsonFromResponse(healthResponse,'/api/health'),
   jsonFromResponse(capsResponse,'/api/capabilities')
  ]);
  if(health.engine!=='quantum-espresso'||caps.engine?.id!=='quantum-espresso'||
   health.api_version!==caps.api_version||typeof caps.api_version!=='string')
   throw Error('Sunucu beklenen KristalYapı QE API sözleşmesine uymuyor.');
  const jobsEnabled=caps.job_submission_enabled===true&&health.read_only===false;
  if(!jobsEnabled&&(caps.job_submission_enabled!==false||health.read_only!==true))
   throw Error('QE API iş gönderme özelliği ile sağlık durumu tutarsız.');
  const ready=healthResponse.ok&&health.status==='ready'&&caps.engine.available===true;
  return {base,ready,version:String(caps.engine.version||'belirsiz').slice(0,60),
   apiVersion:caps.api_version,binaries:caps.binaries||{},status:health.status,
   jobsEnabled,resourceProfile:parseResourceProfile(caps.resource_profile)};
 }catch(error){
  if(controller.signal.aborted)
   throw Error('Bağlantı zaman aşımına uğradı. IP, port, CORS ve tarayıcı yerel ağ iznini kontrol edin.');
  throw error;
 }finally{clearTimeout(handle);}
}


function checkedJobCredentials(address,token){
 const base=normalizeQeApiUrl(address),u=new URL(base);
 if(u.protocol!=='https:'&&!['localhost','127.0.0.1','[::1]'].includes(u.hostname))
  throw Error('API anahtarı HTTP üzerinden LAN IP adresine gönderilmez. HTTPS reverse proxy kurun.');
 if(typeof token!=='string'||token.length<32||token.length>256||/\s/.test(token))
  throw Error('Geçerli en az 32 karakterli API anahtarını girin.');
 return {base,token};
}
async function qeRequest(address,token,path,{method='GET',body,fetcher=fetch,timeoutMs=15000}={}){
 const {base}=checkedJobCredentials(address,token);
 const options={method,mode:'cors',cache:'no-store',credentials:'omit',
  headers:{Authorization:'Bearer '+token},redirect:'error'};
 if(body!==undefined){
  options.headers['Content-Type']='application/json';
  options.body=JSON.stringify(body);
  if(options.body.length>65536)throw Error('DFT hesaplama isteği 64 KiB sınırını aşıyor.');
 }
 const controller=new AbortController();
 const timer=method==='GET'?setTimeout(()=>controller.abort(),timeoutMs):null;
 if(timer!==null)options.signal=controller.signal;
 try{
 const response=await fetcher(base+path,options);
 const result=await response.json();
 if(!response.ok){
  throw Error('QE API ('+response.status+'): '+String(result.detail||'İstek başarısız').slice(0,180));
 }
 return result;
 }catch(error){if(controller.signal.aborted)throw Error('QE okuma isteği zaman aşımına uğradı.');throw error;
 }finally{if(timer!==null)clearTimeout(timer);}
}
export async function validateQeScf(address,token,payload,opts){
 return qeRequest(address,token,'/api/v1/calculations/validate',{method:'POST',body:payload,...opts});
}
export async function submitQeScf(address,token,payload,opts){
 return qeRequest(address,token,'/api/v1/calculations',{method:'POST',body:payload,...opts});
}
export async function getQeScfJob(address,token,jobId,opts){
 if(!/^[a-f0-9]{32}$/.test(jobId))throw Error('Geçersiz iş numarası.');
 return qeRequest(address,token,'/api/v1/calculations/'+jobId,opts);
}
export async function getQeScfResult(address,token,jobId,opts){
 if(!/^[a-f0-9]{32}$/.test(jobId))throw Error('Geçersiz iş numarası.');
 return qeRequest(address,token,'/api/v1/calculations/'+jobId+'/results',opts);
}
export async function cancelQeScfJob(address,token,jobId,opts){
 if(!/^[a-f0-9]{32}$/.test(jobId))throw Error('Geçersiz iş numarası.');
 return qeRequest(address,token,'/api/v1/calculations/'+jobId+'/cancel',{method:'POST',...opts});
}

export async function listQeScfJobs(address,token,opts){
 return qeRequest(address,token,'/api/v1/calculations',opts);
}

export function parseQeBandPath(text){
 if(typeof text!=='string'||text.length>10000)throw Error('Bant yolu en fazla 10000 karakter olmalı.');
 const points=text.split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#')).map(line=>{
  const row=line.split(/\s+/),k=row.slice(1,4).map(Number),n=Number(row[4]);
  if(row.length!==5||!/^[A-Za-z][A-Za-z0-9_-]{0,15}$/.test(row[0])||
   k.some(x=>!Number.isFinite(x)||Math.abs(x)>2)||k[2]!==0||!Number.isInteger(n)||n<1||n>100)
   throw Error('Bant yolu satırı: ETIKET kx ky 0 N; N 1–100 olmalı.');
  return {label:row[0],k,segments:n};
 });
 if(points.length<2||points.length>16||points.at(-1).segments!==1||points.reduce((s,p)=>s+p.segments,0)>300)
  throw Error('2–16 bant noktası, en çok 300 bölüm ve son ağırlık 1 gerekli.');
 return points;
}

export async function getQeJobDiagnostics(address,token,jobId,opts={}){
 if(typeof jobId!=='string'||!(/^[a-f0-9]{32}$/.test(jobId)))throw Error('Geçerli iş kimliği gerekli.');
 return qeRequest(address,token,'/api/v1/calculations/'+jobId+'/diagnostics',opts);
}

export async function pauseQeElectronicJob(address,token,jobId,opts={}){
 if(!(/^[a-f0-9]{32}$/.test(jobId)))throw Error('Geçerli iş kimliği gerekli.');
 return qeRequest(address,token,'/api/v1/calculations/'+jobId+'/pause',{method:'POST',...opts});
}
export async function resumeQeElectronicJob(address,token,jobId,opts={}){
 if(!(/^[a-f0-9]{32}$/.test(jobId)))throw Error('Geçerli iş kimliği gerekli.');
 return qeRequest(address,token,'/api/v1/calculations/'+jobId+'/resume',{method:'POST',...opts});
}

export function parseResourceProfile(raw){
 if(raw===undefined)return {id:'local-default',max_atoms:64,max_bands:128,max_nscf_k:24};
 if(!raw||typeof raw.id!=='string'||!(/^[a-z][a-z0-9-]{1,39}$/.test(raw.id))||
  !Number.isInteger(raw.max_atoms)||raw.max_atoms<1||raw.max_atoms>512||
  !Number.isInteger(raw.max_bands)||raw.max_bands<1||raw.max_bands>2048||
  !Number.isInteger(raw.max_nscf_k)||raw.max_nscf_k<2||raw.max_nscf_k>48)throw Error('Sunucu kaynak sınırları geçersiz.');
 if(raw.execution_enabled!==undefined&&typeof raw.execution_enabled!=='boolean'||raw.sha256!==undefined&&!/^[a-f0-9]{64}$/.test(raw.sha256))throw Error('Sunucu kaynak profili kimliği geçersiz.');
 return {id:raw.id,max_atoms:raw.max_atoms,max_bands:raw.max_bands,max_nscf_k:raw.max_nscf_k,
  executionEnabled:raw.execution_enabled,sha256:raw.sha256};
}
