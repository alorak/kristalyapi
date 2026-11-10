// GANSU Lite 2026-11-10 pinned browser-worker bridge (BSD-3-Clause upstream).
// Only same-origin, preverified SCF worker/WASM assets; no remote inference or QE calls.
export const GANSU_UPSTREAM_COMMIT='58237bc616e9795f393b3d5272805ecef6d377ad';
export const GANSU_WORKER_BLOB='12abad7da0324589d51b96698e1ee4ff765ca763';
export const GANSU_BASIS_BLOB='2c6b503c18c6f344a3afd5b0df492fbaabd60884';
export const GANSU_MAX_ATOMS=12;
const Z={H:1,He:2,Li:3,Be:4,B:5,C:6,N:7,O:8,F:9,Ne:10,Si:14};
const FUNCTIONALS=new Set(['SVWN','PBE','B3LYP']);
const GRIDS=new Set(['coarse','medium']);
export const GANSU_ASSET_ROOT=new URL('./vendor/gansu-lite/',import.meta.url);
const workerUrl=new URL('scf-worker.js',GANSU_ASSET_ROOT);
const basisUrl=new URL('basis/sto-3g.gbs',GANSU_ASSET_ROOT);
let basisPromise=null;

export function parseGansuXyz(xyz){
 if(typeof xyz!=='string'||xyz.length>8000)throw Error('XYZ girdisi boş veya boyut sınırını aşıyor.');
 const lines=xyz.trim().split(/\r?\n/),count=Number(lines[0]?.trim());
 if(!Number.isInteger(count)||count<1||count>GANSU_MAX_ATOMS||lines.length!==count+2)
  throw Error('XYZ: İlk satır 1–'+GANSU_MAX_ATOMS+' atom, ikinci satır yorum, devamında tam olarak N atom satırı olmalı.');
 const atoms=lines.slice(2).map(line=>{
  const parts=line.trim().split(/\s+/);
  if(parts.length!==4||!Object.hasOwn(Z,parts[0]))throw Error('Yerleşik DFT için şu an yalnız H–Ne ve Si atomları için doğrulanmış STO-3G bazlı XYZ desteklenir.');
  const coord=parts.slice(1).map(Number);
  if(!coord.every(Number.isFinite)||coord.some(x=>Math.abs(x)>500))throw Error('XYZ koordinatları geçersiz.');
  return {symbol:parts[0],xyz:coord,atomicNumber:Z[parts[0]]};
 });
 for(let i=0;i<atoms.length;i++)for(let j=i+1;j<atoms.length;j++){
  const d=Math.hypot(...atoms[i].xyz.map((v,k)=>v-atoms[j].xyz[k]));
  if(d<0.25)throw Error('İki atom 0,25 Å sınırından daha yakın; geometriyi düzeltin.');
 }
 return atoms;
}
export function validateGansuRequest({xyz,charge=0,multiplicity=1,functional='SVWN',grid='coarse'}={}){
 const atoms=parseGansuXyz(xyz);
 if(!Number.isInteger(charge)||charge< -2||charge>2)throw Error('Yük -2 ile +2 arasında tam sayı olmalı.');
 if(!Number.isInteger(multiplicity)||multiplicity<1||multiplicity>3)throw Error('Spin çokluğu 1–3 arasında tam sayı olmalı.');
 const electrons=atoms.reduce((n,a)=>n+a.atomicNumber,0)-charge;
 if(electrons<1||electrons<multiplicity-1||(electrons-multiplicity+1)%2)
  throw Error('Elektron sayısı, yük ve spin çokluğu tutarsız.');
 if(!FUNCTIONALS.has(functional)||!GRIDS.has(grid))throw Error('Desteklenmeyen fonksiyonel veya grid.');
 return {atoms,electrons,charge,multiplicity,functional,grid};
}
export async function loadGansuBasis(fetcher=fetch){
 if(!basisPromise){
  basisPromise=(async()=>{
   const response=await fetcher(basisUrl,{credentials:'omit',cache:'force-cache'});
   if(!response.ok)throw Error('Yerel STO-3G baz dosyası bulunamadı: HTTP '+response.status);
   const content=await response.text();
   if(content.length<10000||content.length>100000||!content.includes('****'))
    throw Error('Yerel STO-3G baz verisi geçersiz veya eksik.');
   return content;
  })().catch(error=>{basisPromise=null;throw error;});
 }
 return basisPromise;
}
export async function runGansuDft(settings,{onProgress=()=>{},signal,timeoutMs=120000,workerFactory,fetcher}={}){
 const config=validateGansuRequest(settings);
 if(signal?.aborted)throw new DOMException('İşlem iptal edildi','AbortError');
 if(!Number.isFinite(timeoutMs)||timeoutMs<500||timeoutMs>300000)throw Error('Geçersiz zaman sınırı.');
 const text=await loadGansuBasis(fetcher);
 if(signal?.aborted)throw new DOMException('İşlem iptal edildi','AbortError');
 const create=workerFactory??(url=>new Worker(url,{type:'classic'}));
 const runner=create(workerUrl);
 let backend=null,iterations=0;
 return await new Promise((resolve,reject)=>{
  let finished=false;
  const cleanup=()=>{
   clearTimeout(timer);
   signal?.removeEventListener('abort',abort);
   runner.terminate();
  };
  const done=(error,result)=>{
   if(finished)return;
   finished=true;cleanup();
   if(error)reject(error);else resolve(result);
  };
  const abort=()=>done(new DOMException('İşlem iptal edildi','AbortError'));
  const timer=setTimeout(()=>done(Error('GANSU hesaplama zaman sınırını aştı.')),timeoutMs);
  signal?.addEventListener('abort',abort,{once:true});
  runner.onerror=event=>{event.preventDefault?.();done(Error('GANSU Worker yükleme veya çalışma hatası: '+(event.message||'unknown')));};
  runner.onmessage=event=>{
   const msg=event.data;
   if(!msg||typeof msg!=='object')return;
   if(msg.type==='progress'){
    const value=String(msg.message||'').slice(0,300);
    if(/^Config: /i.test(value)){
     backend=/^Config: WASM/i.test(value)?'wasm':/^Config: JS/i.test(value)?'js':null;
     if(backend==='js'){done(Error('WASM yüklenemedi. JS fallback sonuçları P0.2 için kabul edilmez.'));return;}
    }
    onProgress({type:'progress',message:value,backend});
   }else if(msg.type==='iteration'){
    if(Number.isInteger(msg.iter)&&Number.isFinite(msg.energy)){
     iterations=Math.max(iterations,msg.iter);
     onProgress({type:'iteration',iter:msg.iter,energy:msg.energy,deltaE:Number(msg.deltaE)});
    }
   }else if(msg.type==='error'){
    done(Error('GANSU SCF hatası: '+String(msg.message).slice(0,300)));
   }else if(msg.type==='result'){
    if(backend!=='wasm'){done(Error('WASM yürütme kanıtı yok; hesap kabul edilmedi.'));return;}
    const e=msg.totalEnergy;
    if(!Number.isFinite(e)||!Array.isArray(msg.orbitalEnergies)||
       msg.orbitalEnergies.some(v=>!Number.isFinite(v))||
       !Array.isArray(msg.mullikenCharges)||msg.mullikenCharges.length!==config.atoms.length){
      done(Error('GANSU sonuç veri yapısı eksik veya sayısal olarak geçersiz.'));return;
    }
    done(null,{
     schema:'kristalyapi.gansu-molecular-dft.v1',upstreamCommit:GANSU_UPSTREAM_COMMIT,
     backend:'WASM',method:config.multiplicity===1?'RKS':'UKS',
     functional:config.functional,basis:'STO-3G',grid:config.grid,
     charge:config.charge,multiplicity:config.multiplicity,electrons:config.electrons,
     atoms:config.atoms.map(a=>a.symbol),iterations,
     energyHartree:e,energyEv:e*27.211386245988,
     orbitalEnergiesHartree:msg.orbitalEnergies,
     orbitalEnergiesBetaHartree:Array.isArray(msg.orbitalEnergiesBeta)?msg.orbitalEnergiesBeta:[],
     occupiedOrbitals:msg.numOccupied,
     mullikenCharges:msg.mullikenCharges,dipoleDebye:msg.dipole?.debye??null,
     gridElectrons:msg.gridElectrons??null,gridPoints:msg.gridPoints??null
    });
   }
  };
  try{runner.postMessage({
   type:'run-scf',xyzText:settings.xyz,basisGBS:text,basisPurity:'auto',
   method:config.multiplicity===1?'RHF':'UHF',
   charge:config.charge,multiplicity:config.multiplicity,
   eriBackend:'wasm',initialGuess:'core',baseUrl:GANSU_ASSET_ROOT.pathname,
   dftConfig:{functional:config.functional,gridLevel:config.grid},
   runMP2:false,runMP3:false,runCCSD:false,runGradient:false,runHessian:false
  });}catch(error){done(error);}
 });
}
