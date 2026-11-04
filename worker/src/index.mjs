// A tightly scoped COD gateway. Never accept an arbitrary upstream URL.
// The primary COD server and its public mirrors share the same /cod/ layout.
// They are fixed here; requests only choose a validated path below /cod.
export const COD_UPSTREAMS = [
  'https://www.crystallography.net/cod',
  'https://qiserver.ugr.es/cod',
  'https://cod.ibt.lt/cod'
];
const COD = COD_UPSTREAMS[0];
const SEARCH_KEYS = new Set([
  'text','id','formula','spacegroup','journal','year','volume','issue','doi',
  'strictmin','strictmax','vmin','vmax','minZ','maxZ','minZprime','maxZprime',
  'has_fobs','include_duplicates','include_errors','include_theoretical'
]);
const CIF_LIMIT = 4_000_000;
const JSON_LIMIT = 6_500_000;
// COD and its mirrors fail independently: the primary may answer 52x/500 or
// time out, and a mirror may lack a route (one serves result.php as raw PHP
// source, another returns 500 for OPTIMADE). Each round tries every upstream
// once, in order; transient failures are retried in later rounds. Everything
// shares one wall-clock budget so the browser (which waits ~25 s) still
// gets an answer, and no single host may use more than one attempt's share.
const UPSTREAM_BUDGET_MS = 20_000;
const ATTEMPT_TIMEOUT_MS = 8_000;
const UPSTREAM_ROUNDS = 2;
const RETRY_DELAYS_MS = [800];
const RETRYABLE_STATUS = new Set([408,425,429,500,502,503,504,520,521,522,523,524,525,526,530]);
const WORKER_VERSION = '1.3';
const USER_AGENT = 'kristalyapi-cod-worker/'+WORKER_VERSION+' (+https://github.com/alorak/kristalyapi)';
// Successful bodies are kept in the Cloudflare edge cache so a COD entry that
// imported once does not depend on COD being reachable the next time.
const CACHE_TTL = {cif:30*86_400, json:300}; // CIF: 30 days; COD revisions are rare

function cors(origin, env) {
  const origins = String(env?.CORS_ORIGINS || 'https://alorak.github.io')
    .split(',').map(x => x.trim()).filter(Boolean);
  if (origin && !origins.includes(origin)) return null;
  const headers = {
    'X-Content-Type-Options': 'nosniff',
    'Vary': 'Origin',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Accept, X-API-KEY'
  };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}
function fail(status, error, headers = {}) {
  return new Response(JSON.stringify({error}), {
    status, headers:{...headers,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}
  });
}
function validSearchKey(k) {
  return SEARCH_KEYS.has(k) || /^el[1-8]$/.test(k) || /^nel[1-4]$/.test(k);
}
// Returns {path, url, type, limit}: `path` is relative to a COD base and
// `url` is the canonical primary-server URL (also the cache key).
export function upstreamUrl(path, search) {
  const params = new URLSearchParams(search);
  if (params.size > 40 || search.length > 2400) throw new Error('Query is too large');
  const spec = (rel, type, limit) => ({path:rel, url:COD+rel, type, limit});
  if (path === '/api/search') {
    if ([...params.keys()].some(k => !validSearchKey(k) && k !== 'format') ||
        [...params.values()].some(v => v.length > 150) ||
        (params.has('format') && params.get('format') !== 'json') ||
        ![...params.keys()].some(k => k !== 'format' && !k.startsWith('include_'))) {
      throw new Error('Invalid COD search query');
    }
    params.set('format','json');
    return spec('/result.php?'+params.toString(),'json',JSON_LIMIT);
  }
  if (path === '/api/structures') {
    if ([...params.keys()].some(k => !['filter','page_limit','response_fields'].includes(k)) ||
        !params.get('filter') || params.get('filter').length > 1600 ||
        (params.has('page_limit') && (!/^\d{1,3}$/.test(params.get('page_limit')) ||
          +params.get('page_limit') < 1 || +params.get('page_limit') > 100)) ||
        (params.has('response_fields') && !/^[a-z_0-9,]{1,200}$/.test(params.get('response_fields')))) {
      throw new Error('Invalid OPTIMADE query');
    }
    params.set('page_limit',params.get('page_limit')||'100');
    return spec('/optimade/v1/structures?'+params.toString(),'json',JSON_LIMIT);
  }
  const cif = path.match(/^\/api\/cif\/(\d{6,9})$/);
  if (cif && !search) return spec('/'+cif[1]+'.cif','cif',CIF_LIMIT);
  const item = path.match(/^\/api\/structures\/(\d{6,9})$/);
  if (item && !search) return spec('/optimade/v1/structures/'+item[1],'json',JSON_LIMIT);
  throw new Error('Unsupported COD route');
}
async function boundedBody(response, max) {
  const length = Number(response.headers.get('content-length')||0);
  if (Number.isFinite(length) && length > max) throw new Error('Upstream response too large');
  if (!response.body) throw new Error('Empty upstream body');
  const reader=response.body.getReader(),chunks=[];
  let size=0;
  try {
    for (;;) {
      const {value,done}=await reader.read();
      if (done) break;
      size+=value.byteLength;
      if (size>max) throw new Error('Upstream response too large');
      chunks.push(value);
    }
  } catch (error) {
    await reader.cancel().catch(()=>{});
    throw error;
  } finally { reader.releaseLock(); }
  const result=new Uint8Array(size);let offset=0;
  for (const chunk of chunks) {result.set(chunk,offset);offset+=chunk.byteLength;}
  return result;
}

class UpstreamStatus extends Error {
  constructor(status) { super('COD upstream returned '+status); this.status=status; }
}
class InvalidBody extends Error {}
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const hostOf = base => new URL(base).host;

// A 200 answer is only relayed if it really is the requested format: mirrors
// have been seen answering 200 with raw PHP source or HTML error pages.
export function validBody(type, bytes) {
  const text=new TextDecoder().decode(bytes.subarray(0,Math.min(bytes.byteLength,65536)));
  if (/^\s*(?:<!doctype|<html|<\?php)/i.test(text)) return false;
  if (type==='cif') return /(^|\n)\s*data_\S/.test(text);
  try {
    const value=JSON.parse(new TextDecoder().decode(bytes));
    return value!==null && typeof value==='object';
  } catch { return false; }
}

// Fetch one validated COD path from the primary server or a mirror.
// Transient failures (5xx/52x, timeouts, connection errors) are retried in the
// next round; definitive answers from one host (403, 404, redirects, a body
// in the wrong format) skip that host but still let the other hosts answer.
export async function fetchUpstream(spec, upstreamFetch=fetch, {
  upstreams=COD_UPSTREAMS, rounds=UPSTREAM_ROUNDS, budgetMs=UPSTREAM_BUDGET_MS,
  attemptTimeoutMs=ATTEMPT_TIMEOUT_MS, delays=RETRY_DELAYS_MS, sleep=wait, now=Date.now
}={}) {
  const deadline=now()+budgetMs;
  const failures=new Map(), settled=new Set();
  for (let round=0; round<rounds; round++) {
    const pending=upstreams.filter(base=>!settled.has(base));
    if (!pending.length) break;
    if (round>0) {
      const delay=delays[Math.min(round-1,delays.length-1)]||0;
      if (now()+delay>=deadline) break;
      await sleep(delay);
    }
    for (const base of pending) {
      const remaining=deadline-now();
      if (remaining<=0) break;
      const controller=new AbortController();
      const timer=setTimeout(()=>controller.abort(),Math.min(remaining,attemptTimeoutMs));
      const host=hostOf(base);
      try {
        const response=await upstreamFetch(base+spec.path,{method:'GET',redirect:'manual',signal:controller.signal,
          headers:{Accept:spec.type==='json'?'application/json':'text/plain','User-Agent':USER_AGENT}});
        if (!response.ok || response.status>=300) {
          response.body?.cancel?.().catch(()=>{});
          throw new UpstreamStatus(response.status);
        }
        const body=await boundedBody(response,spec.limit);
        if (!validBody(spec.type,body)) throw new InvalidBody('invalid '+spec.type+' body');
        return {body,host};
      } catch (error) {
        if (error.message==='Upstream response too large') throw error;
        if (error instanceof UpstreamStatus) {
          failures.set(host,String(error.status));
          if (!RETRYABLE_STATUS.has(error.status)) settled.add(base);
        } else if (error instanceof InvalidBody) {
          failures.set(host,error.message);
          settled.add(base);
        } else {
          failures.set(host,'timeout or connection failure');
        }
      } finally {clearTimeout(timer);}
    }
  }
  const error=new Error('COD upstream timeout or connection failure');
  error.failures=failures;
  throw error;
}
function failureSummary(failures) {
  if (!failures?.size) return 'COD upstream timeout or connection failure';
  return 'All COD servers failed: '+[...failures].map(([host,why])=>host+' '+why).join('; ');
}
function allNotFound(failures) {
  return failures?.size>0 && [...failures.values()].every(v=>v==='404');
}

function cacheKey(url) { return new Request(url,{method:'GET'}); }
function edgeCache(options) {
  if ('cache' in options) return options.cache;
  try { return globalThis.caches?.default||null; } catch { return null; }
}

// Materials Project: an explicitly opted-in, non-caching, allowlisted API relay.
// The personal key arrives only in X-API-KEY and is never placed in a URL,
// response header, edge cache or diagnostic. No arbitrary upstream is accepted.
const MP_SUMMARY_ORIGIN='https://api.materialsproject.org';
const MP_FIELDS=new Set(['material_id','formula_pretty','symmetry','nsites','band_gap',
 'is_gap_direct','formation_energy_per_atom','energy_above_hull','density','has_props',
 'last_updated','structure']);
const MP_MAX_BYTES=2_500_000;
function mpSummaryTarget(search){
 if(search.length>1500)throw Error('Materials Project query too long');
 const p=new URLSearchParams(search);
 if(p.size<3||p.size>4)throw Error('Invalid Materials Project query');
 if([...p.keys()].some(k=>!['material_ids','formula','chemsys','_fields','_limit'].includes(k)))throw Error('Unsupported Materials Project parameter');
 const selectors=['material_ids','formula','chemsys'].filter(k=>p.has(k));
 if(selectors.length!==1||!p.has('_fields')||!p.has('_limit'))throw Error('Invalid Materials Project search');
 const sel=selectors[0],value=p.get(sel);
 if(!(sel==='material_ids'&&/^mp-\d{1,12}$/.test(value)||
   sel==='formula'&&/^(?:[A-Z][a-z]?\d*(?:\.\d+)?){1,8}$/.test(value)||
   sel==='chemsys'&&/^[A-Z][a-z]?(?:-[A-Z][a-z]?){1,7}$/.test(value)))throw Error('Invalid Materials Project identifier');
 const fields=p.get('_fields')?.split(',');
 if(!fields?.length||fields.length>12||fields.some(f=>!MP_FIELDS.has(f))||
    new Set(fields).size!==fields.length)throw Error('Invalid Materials Project fields');
 const limit=Number(p.get('_limit'));
 if(!/^\d{1,2}$/.test(p.get('_limit'))||limit<1||limit>20)throw Error('Invalid Materials Project limit');
 if(fields.includes('structure')&&(sel!=='material_ids'||limit!==1))throw Error('Structure lookup requires a single material ID');
 return MP_SUMMARY_ORIGIN+'/materials/summary/?'+p.toString();
}
async function relayMaterialsProject(request,allowed,upstreamFetch){
 let target;
 try{target=mpSummaryTarget(new URL(request.url).search.slice(1));}
 catch(error){return fail(400,error.message,allowed);}
 const key=request.headers.get('X-API-KEY')||'';
 if(!key||key.length>512||/[^\x21-\x7e]/.test(key))return fail(400,'Missing or invalid Materials Project key',allowed);
 const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
 try{
  const response=await upstreamFetch(target,{method:'GET',redirect:'manual',
   cache:'no-store',credentials:'omit',signal:controller.signal,
   headers:{'X-API-KEY':key,'Accept':'application/json',
    'User-Agent':'kristalyapi-mp-worker/'+WORKER_VERSION+' (+https://github.com/alorak/kristalyapi)'}});
  if(!response.ok||response.status>=300){
   const code=[400,401,403,404,408,429].includes(response.status)?response.status:502;
   return fail(code,'Materials Project upstream HTTP '+response.status,allowed);
  }
  const body=await boundedBody(response,MP_MAX_BYTES);
  let result;
  try{result=JSON.parse(new TextDecoder().decode(body));}
  catch{return fail(502,'Invalid Materials Project JSON',allowed);}
  if(!result||!Array.isArray(result.data)||result.data.length>100)return fail(502,'Invalid Materials Project response shape',allowed);
  return new Response(body,{status:200,headers:{...allowed,'Content-Type':'application/json; charset=utf-8',
   'Cache-Control':'no-store'}});
 }catch(error){
  return fail(error.message==='Upstream response too large'?413:504,
   error.message==='Upstream response too large'?'Materials Project response too large':'Materials Project upstream unavailable',allowed);
 }finally{clearTimeout(timeout);}
}

export async function handleRequest(request, env={}, upstreamFetch=fetch, options={}) {
  const origin=request.headers.get('Origin');
  const allowed=cors(origin,env);
  if (!allowed) return fail(403,'Origin not allowed');
  const target=new URL(request.url);
  if (request.method === 'OPTIONS') {
    if (!target.pathname.startsWith('/api/')) return fail(404,'Not found',allowed);
    return new Response(null,{status:204,headers:allowed});
  }
  if (request.method !== 'GET') return fail(405,'Method not allowed',allowed);
  if (target.pathname === '/health' && !target.search)
    return new Response(JSON.stringify({status:'ok',service:'kristalyapi-cod-worker',version:WORKER_VERSION,
      upstreams:COD_UPSTREAMS.map(hostOf),materialsProjectProxy:true}),{
      headers:{...allowed,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}
    });
  if(target.pathname==='/api/mp/summary')return relayMaterialsProject(request,allowed,upstreamFetch);
  let spec;
  try { spec=upstreamUrl(target.pathname,target.search.slice(1)); }
  catch (error) {return fail(400,error.message,allowed);}
  const contentType=spec.type==='json'?'application/json; charset=utf-8':'chemical/x-cif; charset=utf-8';
  const ttl=spec.type==='cif'?CACHE_TTL.cif:CACHE_TTL.json;
  const relay=(body,cacheState,source)=>new Response(body,{status:200,headers:{
    ...allowed,'Content-Type':contentType,'Cache-Control':'public, max-age='+ttl,
    'X-Kristalyapi-Cache':cacheState,...(source?{'X-Kristalyapi-Source':source}:{})
  }});
  // The cache is keyed by the canonical primary-server URL whichever host
  // answered, and stores no CORS headers, so one Origin's response is never
  // replayed with another Origin's grant.
  const cache=edgeCache(options);
  if (cache) {
    try {
      const hit=await cache.match(cacheKey(spec.url));
      if (hit) return relay(await hit.arrayBuffer(),'HIT');
    } catch {}
  }
  let result;
  try { result=await fetchUpstream(spec,upstreamFetch,options.upstream); }
  catch (error) {
    if (error.message==='Upstream response too large') return fail(413,error.message,allowed);
    if (allNotFound(error.failures)) return fail(404,'COD entry not found',allowed);
    return fail(502,failureSummary(error.failures),allowed);
  }
  if (cache) {
    const stored=Promise.resolve().then(()=>cache.put(cacheKey(spec.url),new Response(result.body,{status:200,headers:{
      'Content-Type':contentType,'Cache-Control':'public, max-age='+ttl
    }}))).catch(()=>{});
    if (options.ctx?.waitUntil) options.ctx.waitUntil(stored); else await stored;
  }
  return relay(result.body,'MISS',result.host);
}
export default {fetch(request,env,ctx){return handleRequest(request,env,fetch,{ctx});}};
