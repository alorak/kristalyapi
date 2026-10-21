// A tightly scoped COD gateway. Never accept an arbitrary upstream URL.
const COD = 'https://www.crystallography.net/cod';
const SEARCH_KEYS = new Set([
  'text','id','formula','spacegroup','journal','year','volume','issue','doi',
  'strictmin','strictmax','vmin','vmax','minZ','maxZ','minZprime','maxZprime',
  'has_fobs','include_duplicates','include_errors','include_theoretical'
]);
const CIF_LIMIT = 4_000_000;
const JSON_LIMIT = 6_500_000;
// COD sits behind Cloudflare and intermittently answers a cold request with
// 52x (origin unreachable / TLS handshake) or times out, while an immediate
// retry of the same URL succeeds. Retry only those transient failures, within
// one wall-clock budget so the browser (which waits ~25 s) still gets an answer.
const UPSTREAM_BUDGET_MS = 20_000;
const UPSTREAM_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [400, 1200];
const RETRYABLE_STATUS = new Set([408,425,429,500,502,503,504,520,521,522,523,524,525,526,530]);
const USER_AGENT = 'kristalyapi-cod-worker/1.1 (+https://github.com/alorak/kristalyapi)';
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
    'Access-Control-Allow-Headers': 'Content-Type'
  };
  if (origin) headers['Access-Control-Allow-Origin'] = origin;
  return headers;
}
function fail(status, error, headers = {}) {
  return new Response(JSON.stringify({error}), {
    status, headers:{...headers,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}
  });
}
function validId(s) { return /^\d{6,9}$/.test(s); }
function validSearchKey(k) {
  return SEARCH_KEYS.has(k) || /^el[1-8]$/.test(k) || /^nel[1-4]$/.test(k);
}
export function upstreamUrl(path, search) {
  const params = new URLSearchParams(search);
  if (params.size > 40 || search.length > 2400) throw new Error('Query is too large');
  if (path === '/api/search') {
    if ([...params.keys()].some(k => !validSearchKey(k) && k !== 'format') ||
        [...params.values()].some(v => v.length > 150) ||
        (params.has('format') && params.get('format') !== 'json') ||
        ![...params.keys()].some(k => k !== 'format' && !k.startsWith('include_'))) {
      throw new Error('Invalid COD search query');
    }
    params.set('format','json');
    return {url:COD+'/result.php?'+params.toString(),type:'json',limit:JSON_LIMIT};
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
    return {url:COD+'/optimade/v1/structures?'+params.toString(),type:'json',limit:JSON_LIMIT};
  }
  const cif = path.match(/^\/api\/cif\/(\d{6,9})$/);
  if (cif && !search) return {url:COD+'/'+cif[1]+'.cif',type:'cif',limit:CIF_LIMIT};
  const item = path.match(/^\/api\/structures\/(\d{6,9})$/);
  if (item && !search) return {url:COD+'/optimade/v1/structures/'+item[1],type:'json',limit:JSON_LIMIT};
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
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Fetch one validated COD URL, retrying transient upstream failures.
// Non-transient answers (404, redirects, 403 rate limiting, oversize bodies)
// are returned at once: retrying them would not help and could worsen limits.
export async function fetchUpstream(spec, upstreamFetch=fetch, {
  attempts=UPSTREAM_ATTEMPTS, budgetMs=UPSTREAM_BUDGET_MS, delays=RETRY_DELAYS_MS, sleep=wait, now=Date.now
}={}) {
  const deadline=now()+budgetMs;
  let lastError=null;
  for (let attempt=0; attempt<attempts; attempt++) {
    if (attempt>0) {
      const delay=delays[Math.min(attempt-1,delays.length-1)]||0;
      if (now()+delay>=deadline) break;
      await sleep(delay);
    }
    const remaining=deadline-now();
    if (remaining<=0) break;
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),remaining);
    try {
      const response=await upstreamFetch(spec.url,{method:'GET',redirect:'manual',signal:controller.signal,
        headers:{Accept:spec.type==='json'?'application/json':'text/plain','User-Agent':USER_AGENT}});
      if (response.ok && response.status<300) return await boundedBody(response,spec.limit);
      response.body?.cancel?.().catch(()=>{});
      lastError=new UpstreamStatus(response.status);
      if (!RETRYABLE_STATUS.has(response.status)) throw lastError;
    } catch (error) {
      if (error instanceof UpstreamStatus && !RETRYABLE_STATUS.has(error.status)) throw error;
      if (error.message==='Upstream response too large') throw error;
      lastError=error;
    } finally {clearTimeout(timer);}
  }
  throw lastError||new Error('COD upstream timeout');
}

function cacheKey(url) { return new Request(url,{method:'GET'}); }
function edgeCache(options) {
  if ('cache' in options) return options.cache;
  try { return globalThis.caches?.default||null; } catch { return null; }
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
    return new Response(JSON.stringify({status:'ok',service:'kristalyapi-cod-worker'}),{
      headers:{...allowed,'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'}
    });
  let spec;
  try { spec=upstreamUrl(target.pathname,target.search.slice(1)); }
  catch (error) {return fail(400,error.message,allowed);}
  const contentType=spec.type==='json'?'application/json; charset=utf-8':'chemical/x-cif; charset=utf-8';
  const ttl=spec.type==='cif'?CACHE_TTL.cif:CACHE_TTL.json;
  const relay=(body,cacheState)=>new Response(body,{status:200,headers:{
    ...allowed,'Content-Type':contentType,'Cache-Control':'public, max-age='+ttl,'X-Kristalyapi-Cache':cacheState
  }});
  // The cache is keyed by the fixed upstream URL and stores no CORS headers,
  // so one Origin's response is never replayed with another Origin's grant.
  const cache=edgeCache(options);
  if (cache) {
    try {
      const hit=await cache.match(cacheKey(spec.url));
      if (hit) return relay(await hit.arrayBuffer(),'HIT');
    } catch {}
  }
  let body;
  try { body=await fetchUpstream(spec,upstreamFetch,options.upstream); }
  catch (error) {
    if (error.message==='Upstream response too large') return fail(413,error.message,allowed);
    if (error instanceof UpstreamStatus) return fail(502,error.message,allowed);
    return fail(502,'COD upstream timeout or connection failure',allowed);
  }
  if (cache) {
    const stored=Promise.resolve().then(()=>cache.put(cacheKey(spec.url),new Response(body,{status:200,headers:{
      'Content-Type':contentType,'Cache-Control':'public, max-age='+ttl
    }}))).catch(()=>{});
    if (options.ctx?.waitUntil) options.ctx.waitUntil(stored); else await stored;
  }
  return relay(body,'MISS');
}
export default {fetch(request,env,ctx){return handleRequest(request,env,fetch,{ctx});}};
