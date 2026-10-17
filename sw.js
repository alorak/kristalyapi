/* Kristal Yapı offline shell. Keep this list in sync with the Pages artifact.
 * Only known, same-origin application files are cached; COD and user-provided
 * Cloudflare Worker requests must never be intercepted or stored. */
const CACHE_PREFIX='kristalyapi-shell-';
const CACHE_NAME=CACHE_PREFIX+'2026-10-17-v7';
const APP_FILES=[
 './','./index.html','./styles.css','./crystal-app.js','./volume-iso-worker.js','./translations.js',
 './reciprocal-page.js','./reciprocal-core.js','./favicon.svg','./manifest.webmanifest',
 './vendor/three/build/three.module.js','./vendor/three/build/three.core.js',
 './vendor/three/examples/jsm/controls/OrbitControls.js',
 './vendor/three/examples/jsm/geometries/ConvexGeometry.js',
 './vendor/three/examples/jsm/math/ConvexHull.js',
 './vendor/three/examples/jsm/exporters/STLExporter.js',
 './vendor/three/examples/jsm/exporters/GLTFExporter.js',
 './vendor/moyo_wasm.js','./vendor/moyo_wasm_bg.wasm'
];
const APP_URLS=APP_FILES.map(path=>new URL(path,self.registration.scope).href);
const APP_PATHS=new Set(APP_URLS.map(url=>new URL(url).pathname));

self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  // addAll is atomic: an incomplete upload must not become the offline shell.
  const cache=await caches.open(CACHE_NAME);
  await cache.addAll(APP_URLS);
 })());
});

self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const names=await caches.keys();
  await Promise.all(names.filter(name=>name.startsWith(CACHE_PREFIX)&&name!==CACHE_NAME)
   .map(name=>caches.delete(name)));
  await self.clients.claim();
 })());
});

self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin||!APP_PATHS.has(url.pathname))return;
 // Cache-first keeps an activated shell's HTML and modules on one version.
 // Deployments change CACHE_NAME, installing an entirely new shell together.
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE_NAME);
  const saved=await cache.match(url.href,{ignoreSearch:true});
  return saved||fetch(request);
 })());
});
