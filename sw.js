/* Kristal Yapı offline shell. Keep this list in sync with the Pages artifact.
 * Only known, same-origin application files are cached; COD and user-provided
 * Cloudflare Worker requests must never be intercepted or stored. */
const CACHE_PREFIX='kristalyapi-shell-';
const CACHE_NAME=CACHE_PREFIX+'2026-11-10-powder-indexing-p0';
const APP_FILES=[
 './','./index.html','./styles.css','./dft-workspace.css','./browser-dft-lab.css','./browser-dft-lab.js','./browser-tb-core.js','./gansu-local-engine.js','./gansu-geometry-scan.js',
 './vendor/gansu-lite/scf-worker.js','./vendor/gansu-lite/basis/sto-3g.gbs',
 './vendor/gansu-lite/wasm/wasm_eri_bg.wasm','./vendor/gansu-lite/wasm/wasm_eri_simd_bg.wasm',
 './vendor/gansu-lite/LICENSE','./semiconductor-p0.css','./crystal-app.js','./layered-2d-figure.js','./layered-2d-page.js','./layered-2d-cif.js','./layered-2d-export.js','./vesta-project-style.js','./vesta-project-view.js','./vesta-project-scientific.js','./vesta-project-export.js','./cif2-lex.js','./cif2-symmetry.js','./cif2-document.js','./qe-hpc-export.js','./qe-hpc-pipeline.js','./qe-truba-pipeline-view.js','./tools/qe_hpc_pipeline.py','./tools/qe_hpc_electronic.py','./tools/qe_pdos.py','./qe-truba-summary-view.js','./tools/qe_hpc_collect.py','./qe-electronic-view.js','./qe-electronic-setup.js','./dft-ui.js','./export-graphics.js','./export-glyphs.js','./element-data.js','./view-settings.js','./geometry-table.js','./structure-export.js','./scene-controls.js','./setting-transform.js','./phase-alignment.js','./volume-analysis.js','./sigmaa.js','./qe-convergence-view.js','./qe-job-diagnostics-view.js','./qe-job-tracking.js','./qe-protocol-templates.js','./qe-defect-compare-view.js','./qe-api-client.js','./qe-relax-view.js','./mos2-defect-study-core.js','./volume-iso-worker.js','./translations.js',
 './reciprocal-page.js','./reciprocal-core.js','./lesson-pages.js','./lesson-core.js',
  './powder-camera-page.js','./powder-camera-core.js','./powder-camera.css',
  './powder-indexing-core.js','./powder-indexing-page.js','./powder-indexing.css',
 './semiconductor-p0.js','./semiconductor-physics-p0-core.js','./llm-crystal-core.js','./llm-crystal-page.js','./llm-markdown.js','./materials-project-core.js','./materials-project-page.js','./material-cards-core.js','./material-evidence-core.js','./bulk-study-preparation.js','./materials-page.js','./materials-tabs.js','./materials-ml-core.js','./materials-ml-page.js','./materials-ml-p1-core.js','./materials-ml-p1-page.js','./materials-ml-p12-core.js','./materials-ml-p12-page.js','./materials-ml-p12-worker.js','./materials-ml-p13-core.js','./materials-ml-p13-page.js','./materials-ml-p13-worker.js','./models/jarvis-polymorph-p12-source.json','./models/zebra-structural-p1.json','./models/matbench-expt-gap-knn-p0.json','./xrd-acquisition-core.js','./xrd-peak-match-core.js','./xrd-factor-core.js','./powder-planes-view.js',
 './favicon.svg','./manifest.webmanifest',
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
  // The complete replacement shell is cached before taking control, so an
  // existing tab can pick up the new JS/CSS graph after a single reload.
  await self.skipWaiting?.();
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
