/* Offline TRUBA/Slurm export for one Quantum ESPRESSO pw.x SCF or relax job.
 * No remote requests, automatic submission or pseudopotential download.
 * ZIP uses the standard stored (uncompressed) method; no CDN dependency.
 */
const UTF8=new TextEncoder();
const MODULE='apps/espresso/7.4-epw-5.9-oneapi-2024';
const UPF_NAME=/^[A-Za-z0-9][A-Za-z0-9_.+-]*\.upf$/i;
const MAX_UPF_BYTES=24*1024*1024;
const MAX_BUNDLE_BYTES=96*1024*1024;
function validInteger(value,label,lo,hi){
 const n=Number(value);
 if(!Number.isInteger(n)||n<lo||n>hi)throw Error(label+' '+lo+'–'+hi+' arasında tam sayı olmalı.');
 return n;
}
async function hexSha256(bytes){
 if(!globalThis.crypto?.subtle)throw Error('SHA-256 için güvenli tarayıcı ortamı (HTTPS) gerekli.');
 const data=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(data),b=>b.toString(16).padStart(2,'0')).join('');
}
function checkUpfName(name){
 if(!UPF_NAME.test(name))throw Error('Güvensiz UPF dosya adı: '+name);
 return name;
}
export function parsePwInput(inputText){
 if(typeof inputText!=='string'||!inputText.trim()||UTF8.encode(inputText).length>4*1024*1024)
  throw Error('Geçerli, 4 MiB altı QE girdi metni gerekli.');
 if(!/^\s*calculation\s*=\s*'(?:scf|relax)'/im.test(inputText))
  throw Error('TRUBA P0 yalnız pw.x SCF veya relax girdilerini destekliyor.');
 if(!/^\s*pseudo_dir\s*=\s*'\.\/pseudo'/im.test(inputText)||
    !/^\s*outdir\s*=\s*'\.\/tmp'/im.test(inputText))
  throw Error('Girdi pseudo_dir=./pseudo ve outdir=./tmp kullanmalı.');
 const lines=inputText.split(/\r?\n/);
 const start=lines.findIndex(line=>/^\s*ATOMIC_SPECIES\s*$/i.test(line));
 if(start<0)throw Error('ATOMIC_SPECIES bulunamadı.');
 const entries=[];
 for(const line of lines.slice(start+1)){
  const val=line.trim();
  if(!val||val.startsWith('!'))continue;
  const parts=val.split(/\s+/);
  if(parts.length!==3||!/^[A-Z][a-z]?$/.test(parts[0])||!Number.isFinite(Number(parts[1]))||Number(parts[1])<=0)break;
  entries.push({element:parts[0],file:checkUpfName(parts[2])});
  if(entries.length>118)throw Error('Çok fazla atom türü.');
 }
 if(!entries.length)throw Error('ATOMIC_SPECIES satırları okunamadı.');
 const names=new Set(),elements=new Set();
 for(const p of entries){
  if(names.has(p.file.toLowerCase()))throw Error('İki element aynı UPF dosyasını kullanamaz: '+p.file);
  if(elements.has(p.element))throw Error('Yinelenen atom türü: '+p.element);
  names.add(p.file.toLowerCase());elements.add(p.element);
 }
 return {calculation:inputText.match(/^\s*calculation\s*=\s*'(scf|relax)'/im)[1].toLowerCase(),pseudos:entries};
}
export function validateResources(options){
 const account=String(options.account??'').trim();
 if(!/^[A-Za-z][A-Za-z0-9_-]{1,63}$/.test(account))
  throw Error('TRUBA hesap adı zorunlu; 2–64 karakter (harf, sayı, _ ve -) olmalı.');
 const partition=options.partition||'orfoz';
 if(partition!=='orfoz')throw Error('P0 yalnız TRUBA orfoz profilini destekliyor.');
 const ntasks=validInteger(options.ntasks??112,'MPI görev sayısı',56,112);
 if(ntasks!==56&&ntasks!==112)throw Error('TRUBA orfoz için yalnızca 56 veya 112 MPI görevi kullanılabilir.');
 const hours=validInteger(options.hours??12,'Süre (saat)',1,72);
 const jobName=String(options.jobName||'qe-job').normalize('NFKD')
  .replace(/[^A-Za-z0-9_-]+/g,'-').replace(/^-+|-+$/g,'').slice(0,45)||'qe-job';
 return {account,partition,nodes:1,ntasks,cpus_per_task:1,hours,jobName,qe_module:MODULE};
}
export function createSlurm(resources,pseudos,upfHashes={},withCollector=false){
 const t=resources.hours>=24?Math.floor(resources.hours/24)+'-'+String(resources.hours%24).padStart(2,'0')+':00:00':
  String(resources.hours).padStart(2,'0')+':00:00';
 const lines=['#!/bin/bash',
  '#SBATCH --job-name='+resources.jobName,
  '#SBATCH --account='+resources.account,
  '#SBATCH --partition='+resources.partition,
  '#SBATCH --nodes=1',
  '#SBATCH --ntasks='+resources.ntasks,
  '#SBATCH --cpus-per-task=1',
  '#SBATCH --time='+t,
  '#SBATCH --output=slurm-%j.out',
  '#SBATCH --error=slurm-%j.err',
  '',
  'set -euo pipefail',
  'umask 077',
  'cd "$SLURM_SUBMIT_DIR"',
  ...(withCollector?["trap 'status=$?; if command -v python3 >/dev/null 2>&1; then python3 collect.py --bundle . --exit-code \"$status\" || true; else echo \"python3 unavailable: run collector later\" >&2; fi' EXIT"]:[]),
  'module purge',
  'module load '+resources.qe_module,
  'command -v pw.x >/dev/null || { echo "pw.x not available" >&2; exit 2; }',
  'command -v mpirun >/dev/null || { echo "mpirun not available" >&2; exit 2; }',
  'export OMP_NUM_THREADS=1',
  'mkdir -p tmp',
  '# Check UPFs before consuming the computation allocation.'
 ];
 for(const p of pseudos){
  lines.push('test -s "pseudo/'+p.file+'" || { echo "Missing or empty UPF: '+p.file+'" >&2; exit 3; }');
  if(upfHashes[p.file]){
   lines.push('printf "%s  %s\\n" "'+upfHashes[p.file]+'" "pseudo/'+p.file+'" | sha256sum -c --status || { echo "UPF SHA-256 mismatch: '+p.file+'" >&2; exit 4; }');
  }
 }
 lines.push('mpirun pw.x -in structure.in > structure.out',
  'grep -q "JOB DONE\\." structure.out || { echo "QE did not report JOB DONE" >&2; exit 5; }',
  'echo "QE finished; examine convergence and scientific validity separately."','');
 return lines.join('\n');
}
function crc32(bytes){
 let crc=-1;
 for(const b of bytes){
  crc^=b;
  for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xEDB88320:0);
 }
 return (crc^(-1))>>>0;
}
export function zipStored(files){
 if(files.length===0||files.length>100)throw Error('Geçersiz ZIP dosya sayısı.');
 const all=[],central=[];let offset=0;
 for(const {name,bytes} of files){
  if(!/^(?:[A-Za-z0-9_.+-]+\/)*[A-Za-z0-9_.+-]+$/.test(name)||name.includes('..'))
   throw Error('Geçersiz ZIP giriş adı.');
  const path=UTF8.encode(name),size=bytes.byteLength,crc=crc32(bytes);
  if(path.length>65535||size>MAX_BUNDLE_BYTES||offset+size>MAX_BUNDLE_BYTES)throw Error('ZIP boyut sınırı aşıldı.');
  const local=new Uint8Array(30+path.length),a=new DataView(local.buffer);
  a.setUint32(0,0x04034b50,true);a.setUint16(4,20,true);a.setUint16(6,0x0800,true);
  a.setUint32(14,crc,true);a.setUint32(18,size,true);a.setUint32(22,size,true);
  a.setUint16(26,path.length,true);local.set(path,30);
  const cd=new Uint8Array(46+path.length),v=new DataView(cd.buffer);
  v.setUint32(0,0x02014b50,true);v.setUint16(4,20,true);v.setUint16(6,20,true);
  v.setUint16(8,0x0800,true);v.setUint32(16,crc,true);
  v.setUint32(20,size,true);v.setUint32(24,size,true);v.setUint16(28,path.length,true);
  v.setUint32(42,offset,true);cd.set(path,46);
  all.push(local,bytes);central.push(cd);offset+=local.length+size;
 }
 const centralSize=central.reduce((total,b)=>total+b.length,0);
 const end=new Uint8Array(22),v=new DataView(end.buffer);
 v.setUint32(0,0x06054b50,true);v.setUint16(8,files.length,true);
 v.setUint16(10,files.length,true);v.setUint32(12,centralSize,true);
 v.setUint32(16,offset,true);
 return new Blob([...all,...central,end],{type:'application/zip'});
}
export async function createTrubaPackage({inputText,account,partition='orfoz',ntasks=112,hours=12,jobName='qe-job',upfFiles=[],collectorScript=''}){
 const {calculation,pseudos}=parsePwInput(inputText);
 const resources=validateResources({account,partition,ntasks,hours,jobName});
 if(!Array.isArray(upfFiles)||upfFiles.length>118)throw Error('UPF dosya listesi geçersiz.');
 const expected=new Map(pseudos.map(p=>[p.file,p]));
 const included=new Map(),hashes={};
 let totalSize=UTF8.encode(inputText).length;
 for(const file of upfFiles){
  const name=checkUpfName(file.name);
  if(!expected.has(name))throw Error('Bu hesapta kullanılmayan UPF dosyası: '+name);
  if(included.has(name))throw Error('Tekrar seçilen UPF dosyası: '+name);
  if(!Number.isFinite(file.size)||file.size<1||file.size>MAX_UPF_BYTES)
   throw Error('UPF boyutu 1 B – 24 MiB arasında olmalı: '+name);
  totalSize+=file.size;
  if(totalSize>MAX_BUNDLE_BYTES)throw Error('Toplam paket 96 MiB sınırını aşıyor.');
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(bytes.byteLength!==file.size)throw Error('UPF boyutu okuma sırasında değişti: '+name);
  const head=new TextDecoder().decode(bytes.subarray(0,Math.min(bytes.length,32768)));
  if(!/<UPF\b|<PP_HEADER\b/i.test(head))
   throw Error('UPF başlığı bulunamadı; gerçek pseudopotansiyel seçin: '+name);
  included.set(name,bytes);hashes[name]=await hexSha256(bytes);
 }
 if(typeof collectorScript!=='string'||UTF8.encode(collectorScript).length>128*1024)
  throw Error('Collector script must be a text file smaller than 128 KiB.');
 if(collectorScript&&!collectorScript.includes('kristalyapi.truba-qe-summary.v1'))
  throw Error('Collector script does not declare the supported P1 schema.');
 const missing=pseudos.filter(p=>!included.has(p.file)).map(p=>p.file);
 const slurmText=createSlurm(resources,pseudos,hashes,Boolean(collectorScript));
 const manifest={
  schema:'kristalyapi.truba-qe-slurm-package.v1',
  status:missing.length?'upf-required':'prepared-not-submitted',
  calculation,
  execution_performed:false,
  structure_in_sha256:await hexSha256(UTF8.encode(inputText)),
  run_slurm_sha256:await hexSha256(UTF8.encode(slurmText)),
  collector_included:Boolean(collectorScript),
  resources,
  pseudopotentials:pseudos.map(p=>({element:p.element,file:p.file,
   included:included.has(p.file),sha256:hashes[p.file]||null})),
  missing_upfs:missing,
  note:'No physical convergence or TRUBA resource availability is asserted.'
 };
 const readme=['# Kristal Yapi / TRUBA Quantum ESPRESSO (P1)',
  '',
  'This is an OFFLINE export; it has NOT been submitted or executed.',
  'Calculation: '+calculation+', target: TRUBA ARF orfoz, Quantum ESPRESSO pw.x.',
  'Input SHA-256: '+manifest.structure_in_sha256,
  '',
  '1. Connect to TRUBA by VPN/SSH. Check module avail and your partition/account access.',
  '2. Extract this ZIP into a new directory under your permitted scratch area.',
  '3. Copy the reviewed UPF files into ./pseudo, keeping the exact names.',
  '4. Run: sbatch run.slurm (from the extracted package root).',
  '5. Inspect: squeue -u "$USER", sacct -j JOB_ID; read structure.out and slurm-JOB_ID.err.',
  '6. Python collector runs automatically on SLURM script exit, if python3 is available.',
  '7. If summary.json is absent or needs rebuilding: python3 collect.py --bundle .',
  '8. Download summary.json and import it in DFT > Results > TRUBA summary.',
  '9. Keep the raw structure.out and import it separately for geometry inspection.',
  '',
  'Required UPFs: '+pseudos.map(p=>p.element+'='+p.file).join(', '),
  'UPFs missing from archive: '+(missing.join(', ')||'none'),
  'The script validates presence and, for included UPFs, SHA-256 before execution.',
  'The collector hashes input/UPF/run.slurm and records job status, last energy and forces.',
  'It does not calculate a physically converged result or modify crystal coordinates.',
  'Verify pseudopotential XC/valence compatibility, ecut, k-mesh, cell/vacuum,',
  'spin, MPI scaling, numerical convergence and allocated resources.',
  'Changing run.slurm, files or UPFs invalidates the recorded hashes.',
  'Verify TRUBA rules: https://docs.truba.gov.tr/2-temel_bilgiler/uygulamalar/QEspresso/index.html',
  '',''];
 const files=[
  {name:'structure.in',bytes:UTF8.encode(inputText)},
  {name:'run.slurm',bytes:UTF8.encode(slurmText)},
  {name:'manifest.json',bytes:UTF8.encode(JSON.stringify(manifest,null,2)+'\n')},
  {name:'README.md',bytes:UTF8.encode(readme.join('\n'))},
  {name:'pseudo/README.txt',bytes:UTF8.encode('Place the exact UPF files referenced by structure.in here. No UPFs fetched automatically.\n')}
 ];
 if(collectorScript)files.push({name:'collect.py',bytes:UTF8.encode(collectorScript)});
 for(const [name,bytes] of included)files.push({name:'pseudo/'+name,bytes});
 return {blob:zipStored(files),manifest,missing};
}
