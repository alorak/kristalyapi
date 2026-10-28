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
  if(caps.job_submission_enabled!==false||health.read_only!==true)
   throw Error('Bu D0–D1 ekranı yalnız salt-okunur QE discovery API destekler.');
  const ready=healthResponse.ok&&health.status==='ready'&&caps.engine.available===true;
  return {base,ready,version:String(caps.engine.version||'belirsiz').slice(0,60),
   apiVersion:caps.api_version,binaries:caps.binaries||{},status:health.status,
   jobsEnabled:false};
 }catch(error){
  if(controller.signal.aborted)
   throw Error('Bağlantı zaman aşımına uğradı. IP, port, CORS ve tarayıcı yerel ağ iznini kontrol edin.');
  throw error;
 }finally{clearTimeout(handle);}
}
