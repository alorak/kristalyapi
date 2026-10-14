// A tightly scoped COD gateway. Never accept an arbitrary upstream URL.
const COD = 'https://www.crystallography.net/cod';
const SEARCH_KEYS = new Set([
  'text','id','formula','spacegroup','journal','year','volume','issue','doi',
  'strictmin','strictmax','vmin','vmax','minZ','maxZ','minZprime','maxZprime',
  'has_fobs','include_duplicates','include_errors','include_theoretical'
]);
const CIF_LIMIT = 4_000_000;
const JSON_LIMIT = 6_500_000;

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

export async function handleRequest(request, env={}, upstreamFetch=fetch) {
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
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),12000);
  try {
    const response=await upstreamFetch(spec.url,{method:'GET',redirect:'manual',signal:controller.signal,
      headers:{Accept:spec.type==='json'?'application/json':'text/plain'}});
    if (!response.ok || response.status>=300)
      return fail(502,'COD upstream returned '+response.status,allowed);
    const body=await boundedBody(response,spec.limit);
    return new Response(body,{status:200,headers:{
      ...allowed,
      'Content-Type':spec.type==='json'?'application/json; charset=utf-8':'chemical/x-cif; charset=utf-8',
      'Cache-Control':spec.type==='cif'?'public, max-age=86400':'public, max-age=300'
    }});
  } catch (error) {
    return fail(error.message==='Upstream response too large'?413:502,
      error.message==='Upstream response too large'?error.message:'COD upstream timeout or connection failure',allowed);
  } finally {clearTimeout(timer);}
}
export default {fetch(request,env){return handleRequest(request,env);}};
