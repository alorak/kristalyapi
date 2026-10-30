/* P1.2 offline TRUBA QE Slurm pipeline; explicit parameters, no submit from UI. */
import {parsePwInput,validateResources,zipStored} from './qe-hpc-export.mjs';
const encoder=new TextEncoder(), SCHEMA='kristalyapi.truba-qe-pipeline.v1';
async function sha(bytes){
 if(!globalThis.crypto?.subtle)throw Error('HTTPS/SHA-256 gerekli.');
 const hash=await crypto.subtle.digest('SHA-256',bytes);
 return Array.from(new Uint8Array(hash),v=>v.toString(16).padStart(2,'0')).join('');
}
function num(v,label,a,b,integer=false){
 const n=Number(v);
 if(v===undefined||v===null||String(v).trim()===''||!Number.isFinite(n)||
    (integer&&!Number.isInteger(n))||n<a||n>b)throw Error(label+' '+a+'–'+b+' aralığında olmalı.');
 return n;
}
export function parseBandPath(text){
 if(typeof text!=='string'||text.length>4096)throw Error('Bant yolu en fazla 4096 karakter.');
 const rows=text.split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#'));
 if(rows.length<2||rows.length>32)throw Error('2–32 k-yolu referans noktası gerekli.');
 const points=rows.map((row,i)=>{
  const p=row.split(/\s+/);
  if(p.length!==5||!/^[A-Za-z][A-Za-z0-9_-]{0,15}$/.test(p[0]))throw Error('Geçersiz k-yolu satırı: '+(i+1));
  const k=p.slice(1,4).map(v=>num(v,'k',-2,2));
  return {label:p[0],k,segments:num(p[4],'Segment',1,500,true)};
 });
 if(points.at(-1).segments!==1)throw Error('Son k-yolu segmenti 1 olmalı.');
 return points;
}
export function validatePipelineInput(input,opts){
 const {calculation,pseudos}=parsePwInput(input);
 for(const p of [/^\s*prefix\s*=\s*'kristalyapi'/im,/^\s*CELL_PARAMETERS\s+angstrom/im,
                 /^\s*ATOMIC_POSITIONS\s+crystal/im,/^\s*K_POINTS\s+automatic/im])
  if(!p.test(input))throw Error('Frontend QE prefix/cell/positions/K_POINTS formatı gerekli.');
 if(/^\s*(?:nspin|noncolin|lspinorb|tot_charge|starting_magnetization|nbnd)\s*=/im.test(input)||
    /^\s*&CELL\b/im.test(input))throw Error('Spin, SOC, yüklü hücre, vc-relax ve elle nbnd desteklenmiyor.');
 const nat=input.match(/^\s*nat\s*=\s*(\d+)/im),ntyp=input.match(/^\s*ntyp\s*=\s*(\d+)/im);
 if(!nat||!ntyp||num(ntyp[1],'ntyp',1,118,true)!==pseudos.length)throw Error('nat/ntyp uyumsuz.');
 const pos=input.match(/^ATOMIC_POSITIONS\s+crystal\s*\r?\n([\s\S]*?)^K_POINTS\s+automatic\s*$/im);
 if(!pos)throw Error('ATOMIC_POSITIONS bulunamadı.');
 const rows=pos[1].trim().split(/\r?\n/),names=new Set(pseudos.map(p=>p.element));
 if(rows.length!==num(nat[1],'nat',1,1000,true)||rows.some(row=>{
  const r=row.trim().split(/\s+/);
  return !names.has(r[0])||![4,7].includes(r.length)||
   r.slice(1,4).some(v=>!Number.isFinite(Number(v.replace(/[dD]/g,'e'))))||
   (r.length===7&&r.slice(4).some(v=>!['0','1'].includes(v)));
 }))throw Error('Atom sayısı veya pozisyon satırları geçersiz.');
 const kp=input.match(/^K_POINTS\s+automatic\s*\r?\n\s*(\d+)\s+(\d+)\s+(\d+)\s+[01]\s+[01]\s+[01]\s*$/im);
 if(!kp)throw Error('Kaynak k-örgüsü geçersiz.');
 kp.slice(1,4).forEach(v=>num(v,'Kaynak k',1,24,true));
 const nbnd=num(opts.nbnd,'nbnd',1,10000,true);
 const mesh=[opts.kx,opts.ky,opts.kz].map(v=>num(v,'NSCF k',1,48,true));
 const emin=num(opts.emin,'Emin',-100,100),emax=num(opts.emax,'Emax',-100,100);
 const delta_e=num(opts.deltaE,'DeltaE',0.005,0.5),degauss=num(opts.degauss,'degauss',0.0001,0.1);
 if(emax<=emin||emax-emin>150||Math.ceil((emax-emin)/delta_e)>20000)throw Error('DOS enerji penceresi geçersiz.');
 return {calculation,pseudos,electronic:{nbnd,mesh,emin,emax,delta_e,degauss,path:parseBandPath(opts.bandPath)}};
}
export function pipelineStages(calc){
 if(!['scf','relax'].includes(calc))throw Error('Geçersiz hesap türü.');
 return [...(calc==='relax'?['relax']:[]),'scf','bands','bands_pp','nscf','dos','projwfc'];
}
const tools={relax:['structure.in','relax.out','pw.x'],scf:['scf.in','scf.out','pw.x'],
 bands:['bands.in','bands.out','pw.x'],bands_pp:['bands_pp.in','bands_pp.out','bands.x'],
 nscf:['nscf.in','nscf.out','pw.x'],dos:['dos.in','dos.out','dos.x'],
 projwfc:['projwfc.in','projwfc.out','projwfc.x']};
function time(hours){return hours>=24?Math.floor(hours/24)+'-'+String(hours%24).padStart(2,'0')+':00:00':String(hours).padStart(2,'0')+':00:00';}
export function stageSlurm(step,resource){
 const entry=tools[step];if(!entry)throw Error('Bilinmeyen aşama.');
 const isPw=['relax','scf','bands','nscf'].includes(step);
 return [
  '#!/bin/bash','#SBATCH --job-name='+resource.jobName+'-'+step,
  '#SBATCH --account='+resource.account,'#SBATCH --partition='+resource.partition,
  '#SBATCH --nodes=1','#SBATCH --ntasks='+(isPw?resource.ntasks:1),
  '#SBATCH --cpus-per-task=1','#SBATCH --time='+time(resource.hours),
  '#SBATCH --output=logs/'+step+'-%j.out','#SBATCH --error=logs/'+step+'-%j.err',
  'set -euo pipefail','umask 077','cd "$SLURM_SUBMIT_DIR"','module purge',
  'module load '+resource.qe_module,'export OMP_NUM_THREADS=1',
  'command -v python3 >/dev/null || { echo "python3 unavailable" >&2; exit 10; }',
  'python3 -c "import sys; sys.exit(0 if sys.version_info >= (3,9) else 1)" || { echo "Python >=3.9 required" >&2; exit 10; }',
  'command -v '+entry[2]+' >/dev/null || { echo "QE binary unavailable" >&2; exit 11; }',
  ...(isPw?['command -v mpirun >/dev/null || { echo "mpirun unavailable" >&2; exit 12; }']:[]),
  "trap 'code=$?; if [ \"$code\" -ne 0 ]; then python3 pipeline.py fail "+step+" \"$code\" || true; fi' EXIT",
  'python3 pipeline.py prepare '+step,
  (isPw?'mpirun ':'')+entry[2]+' -in '+entry[0]+' > '+entry[1],
  'python3 pipeline.py finish '+step,
  ...(step==='projwfc'?['python3 pipeline.py summary']:[]),''
 ].join('\n');
}
export function submitScript(stages){
 const lines=['#!/bin/bash','set -euo pipefail','umask 077','cd "$(dirname "$0")"',
  'command -v sbatch >/dev/null || { echo "sbatch required" >&2; exit 2; }',
  'if test -e submissions.txt || test -e .submission-lock; then echo "Already submitted" >&2; exit 3; fi',
  'mkdir .submission-lock','mkdir -p logs reports tmp','previous=""',
  '# afterok serializes shared QE prefix.save, preventing concurrent writes.'
 ];
 for(const step of stages){
  lines.push('if test -n "$previous"; then',
   ' response=$(sbatch --parsable --dependency=afterok:"$previous" stages/'+step+'.slurm)',
   'else',' response=$(sbatch --parsable stages/'+step+'.slurm)','fi',
   'id="$'+'{response%%;*}"',
   'case "$id" in ""|*[!0-9]*) echo "Invalid SLURM job id" >&2; exit 4 ;; esac',
   'printf "%s %s\\n" "'+step+'" "$id" >> submissions.txt','previous="$id"','');
 }
 return lines.concat(['echo "Queued afterok stages; inspect submissions.txt, squeue and sacct."','']).join('\n');
}
export async function createTrubaPipelinePackage(args){
 const {inputText,pipelineScript,upfFiles=[]}=args;
 const {calculation,pseudos,electronic}=validatePipelineInput(inputText,args);
 const resources=validateResources({account:args.account,partition:args.partition||'orfoz',
  ntasks:args.ntasks,hours:args.hours,jobName:args.jobName||'qe-pipeline'});
 if(typeof pipelineScript!=='string'||pipelineScript.length>128000||!pipelineScript.includes(SCHEMA))
  throw Error('Uyumlu pipeline.py dosyası gerekli.');
 if(!Array.isArray(upfFiles)||upfFiles.length>118)throw Error('UPF listesi geçersiz.');
 const expected=new Set(pseudos.map(p=>p.file)),included=new Map(),hashes={};
 let total=encoder.encode(inputText).length+encoder.encode(pipelineScript).length;
 for(const file of upfFiles){
  const name=String(file.name||'');
  if(!/^[A-Za-z0-9][A-Za-z0-9_.+-]*\.upf$/i.test(name)||name.includes('..')||
     !expected.has(name)||included.has(name))throw Error('UPF dosyası güvensiz veya beklenmiyor: '+name);
  if(!Number.isInteger(file.size)||file.size<1||file.size>24*1024*1024)throw Error('UPF 1 B–24 MiB olmalı.');
  total+=file.size;if(total>96*1024*1024)throw Error('ZIP 96 MiB sınırını aşıyor.');
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(bytes.length!==file.size)throw Error('UPF boyutu değişti.');
  const header=new TextDecoder().decode(bytes.subarray(0,Math.min(32768,bytes.length)));
  if(!/<UPF\b|<PP_HEADER\b/i.test(header))throw Error('UPF başlığı bulunamadı.');
  included.set(name,bytes);hashes[name]=await sha(bytes);
 }
 const stages=pipelineStages(calculation);
 const scripts=stages.map(step=>({name:'stages/'+step+'.slurm',text:stageSlurm(step,resources)}));
 const submit=submitScript(stages);
 const file_sha256={'structure.in':await sha(encoder.encode(inputText)),
  'pipeline.py':await sha(encoder.encode(pipelineScript)),
  'submit.sh':await sha(encoder.encode(submit))};
 for(const script of scripts)file_sha256[script.name]=await sha(encoder.encode(script.text));
 const missing=pseudos.filter(p=>!included.has(p.file)).map(p=>p.file);
 const manifest={schema:SCHEMA,status:missing.length?'upf-required':'prepared-not-submitted',
  calculation,execution_performed:false,stages,resources,file_sha256,
  pseudopotentials:pseudos.map(p=>({element:p.element,file:p.file,
   included:included.has(p.file),sha256:hashes[p.file]||null})),
  missing_upfs:missing,electronic,
  note:'No calculation submitted or physical convergence proven.'};
 const readme=['# TRUBA QE: P1.2 offline afterok pipeline','','NOT SUBMITTED.',
  'Stages: '+stages.join(' -> '),
  '1. Extract into NEW persistent shared scratch directory; confirm account/module.',
  '2. Place correct real UPFs in pseudo/ and validate k-path, nbnd and DOS settings.',
  '3. Submit explicitly: bash submit.sh',
  '4. Inspect submissions.txt, squeue, sacct, logs/, reports/ and the raw outputs.',
  '5. After the last stage: pipeline-summary.json (or python3 pipeline.py summary).',
  'Do NOT delete ./tmp/kristalyapi.save or run stages concurrently.',
  'A failed stage prevents successors via afterok; no automatic restart/resume.',
  'No inferred high-symmetry path, magnetic/SOC/variable-cell workflow or certified scientific convergence.',
  'Missing UPF files: '+(missing.join(', ')||'none'), '',''];
 const files=[
  {name:'structure.in',bytes:encoder.encode(inputText)},
  {name:'pipeline.py',bytes:encoder.encode(pipelineScript)},
  {name:'submit.sh',bytes:encoder.encode(submit)},
  {name:'pipeline.json',bytes:encoder.encode(JSON.stringify(manifest,null,2)+'\n')},
  {name:'README.md',bytes:encoder.encode(readme.join('\n'))},
  {name:'pseudo/README.txt',bytes:encoder.encode('Place real UPFs from pipeline.json here.\n')}
 ];
 for(const item of scripts)files.push({name:item.name,bytes:encoder.encode(item.text)});
 for(const [name,bytes] of included)files.push({name:'pseudo/'+name,bytes});
 return {blob:zipStored(files),manifest,missing};
}
