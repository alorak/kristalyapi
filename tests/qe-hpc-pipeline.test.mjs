import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {parseBandPath,validatePipelineInput,pipelineStages,stageSlurm,
 createTrubaPipelinePackage} from '../qe-hpc-pipeline.js';
import {parseTrubaPipelineSummary,renderTrubaPipelineSummary} from '../qe-truba-pipeline-view.js';

if(!globalThis.crypto)globalThis.crypto=webcrypto;
const input=[
 "&CONTROL"," calculation = 'scf',"," prefix = 'kristalyapi',",
 " pseudo_dir = './pseudo',"," outdir = './tmp',","/",
 "&SYSTEM"," ibrav = 0,"," nat = 2,"," ntyp = 1,",
 " ecutwfc = 50,"," ecutrho = 400,","/",
 "&ELECTRONS"," conv_thr = 1.0d-8,","/",
 "ATOMIC_SPECIES","Si 28.0855 Si.UPF",
 "CELL_PARAMETERS angstrom","5 0 0","0 5 0","0 0 5",
 "ATOMIC_POSITIONS crystal","Si 0 0 0","Si 0.25 0.25 0.25",
 "K_POINTS automatic","4 4 4 0 0 0",""
].join('\n');
const bandPath='G 0 0 0 20\nX 0.5 0 0 20\nL 0.5 0.5 0.5 1';
const opts={inputText:input,account:'project_1',ntasks:56,hours:12,nbnd:24,
 kx:8,ky:8,kz:8,bandPath,emin:-10,emax:10,deltaE:0.02,degauss:0.01};
const sha=data=>createHash('sha256').update(data).digest('hex');
async function entries(blob){
 const data=new Uint8Array(await blob.arrayBuffer()),dv=new DataView(data.buffer);
 const result=new Map();let n=0;
 while(n+4<data.length&&dv.getUint32(n,true)===0x04034b50){
  const size=dv.getUint32(n+18,true),nameLength=dv.getUint16(n+26,true);
  const name=new TextDecoder().decode(data.subarray(n+30,n+30+nameLength));
  result.set(name,data.slice(n+30+nameLength,n+30+nameLength+size));
  n+=30+nameLength+size;
 }
 assert.equal(dv.getUint32(n,true),0x02014b50);
 return result;
}
test('band path is explicit, bounded and last segment 1',()=>{
 assert.equal(parseBandPath(bandPath).length,3);
 assert.throws(()=>parseBandPath('G 0 0 0 20\nX 0.5 0 0 20'),/Son/);
 assert.throws(()=>parseBandPath('G 0 0 0 20\nX 3 0 0 1'),/aralığında/);
 assert.throws(()=>parseBandPath('G 0 0 0 20\nX 0.5 0 0 -1'),/1–500/);
});
test('reject unsafe spin, malformed coordinates and bad electronic setup',()=>{
 const result=validatePipelineInput(input,opts);
 assert.equal(result.electronic.nbnd,24);
 assert.deepEqual(result.electronic.mesh,[8,8,8]);
 assert.throws(()=>validatePipelineInput(input.replace(" nat = 2,"," nat = 3,"),opts),/Atom sayısı/);
 assert.throws(()=>validatePipelineInput(input.replace(" nat = 2,"," nat = 2,\n nspin = 2,"),opts),/Spin/);
 assert.throws(()=>validatePipelineInput(input,{...opts,nbnd:0}),/nbnd/);
 assert.throws(()=>validatePipelineInput(input,{...opts,kx:0}),/NSCF/);
 assert.throws(()=>validatePipelineInput(input,{...opts,emin:12,emax:4}),/DOS/);
});
test('stages are serialized, no parallel QE writes and postprocessors use one rank',()=>{
 const plan=pipelineStages('relax');
 assert.deepEqual(plan,['relax','scf','bands','bands_pp','nscf','dos','projwfc']);
 assert.equal(pipelineStages('scf')[0],'scf');
 const script=stageSlurm('dos',{
  jobName:'qe-job',account:'project_1',partition:'orfoz',ntasks:56,hours:12,
  qe_module:'apps/espresso/7.4-epw-5.9-oneapi-2024'
 });
 assert.match(script,/#SBATCH --ntasks=1/);
 assert.match(script,/dos\.x -in dos\.in > dos\.out/);
 assert.match(script,/python3 pipeline\.py finish dos/);
});
test('P1.2 ZIP contains ordered afterok scripts, actual Python and pinned files',async()=>{
 const pipelineScript=readFileSync(new URL('../tools/qe_hpc_pipeline.py',import.meta.url),'utf8');
 const result=await createTrubaPipelinePackage({...opts,pipelineScript});
 assert.equal(result.manifest.schema,'kristalyapi.truba-qe-pipeline.v1');
 assert.deepEqual(result.missing,['Si.UPF']);
 assert.equal(result.manifest.execution_performed,false);
 const file=await entries(result.blob),decode=name=>new TextDecoder().decode(file.get(name));
 assert.equal(decode('pipeline.py'),pipelineScript);
 assert.equal(decode('structure.in'),input);
 assert.equal(result.manifest.file_sha256['pipeline.py'],sha(pipelineScript));
 assert.equal(result.manifest.file_sha256['submit.sh'],sha(decode('submit.sh')));
 assert.match(decode('submit.sh'),/--dependency=afterok:/);
 assert.match(decode('submit.sh'),/\.submission-lock/);
 assert.equal(file.has('stages/relax.slurm'),false);
 assert.equal(file.has('stages/projwfc.slurm'),true);
 assert.match(decode('stages/scf.slurm'),/mpirun pw\.x/);
 const relax=await createTrubaPipelinePackage({...opts,inputText:input.replace("'scf'","'relax'"),pipelineScript});
 assert.equal((await entries(relax.blob)).has('stages/relax.slurm'),true);
});
test('P1.3 converter is pinned, embedded and must succeed before final receipt',async()=>{
 const pipelineScript=readFileSync(new URL('../tools/qe_hpc_pipeline.py',import.meta.url),'utf8');
 const converterScript=readFileSync(new URL('../tools/qe_hpc_electronic.py',import.meta.url),'utf8');
 const pdosHelperScript=readFileSync(new URL('../tools/qe_pdos.py',import.meta.url),'utf8');
 const result=await createTrubaPipelinePackage({...opts,pipelineScript,converterScript,pdosHelperScript});
 const files=await entries(result.blob);
 const decode=name=>new TextDecoder().decode(files.get(name));
 assert.equal(decode('electronic.py'),converterScript);
 assert.equal(decode('qe_pdos.py'),pdosHelperScript);
 assert.equal(result.manifest.file_sha256['electronic.py'],sha(converterScript));
 assert.equal(result.manifest.file_sha256['qe_pdos.py'],sha(pdosHelperScript));
 assert.equal(result.manifest.electronic_converter_included,true);
 await assert.rejects(createTrubaPipelinePackage({...opts,pipelineScript,converterScript,
  pdosHelperScript,nbnd:301}),/görüntülenecek ilk ve son bant/);
 const wide=await createTrubaPipelinePackage({...opts,pipelineScript,converterScript,
  pdosHelperScript,nbnd:800,bandFirst:'301',bandLast:'380'});
 assert.equal(wide.manifest.electronic.nbnd,800);
 assert.deepEqual(wide.manifest.electronic.band_window,[301,380]);
 assert.equal(wide.manifest.electronic_converter_included,true);
 await assert.rejects(createTrubaPipelinePackage({...opts,pipelineScript,converterScript,
  pdosHelperScript,nbnd:800,bandFirst:301}),/ilk ve son bant birlikte/);
 await assert.rejects(createTrubaPipelinePackage({...opts,pipelineScript,converterScript,
  pdosHelperScript,nbnd:800,bandFirst:501,bandLast:801}),/aralığında/);
 await assert.rejects(createTrubaPipelinePackage({...opts,pipelineScript,converterScript,
  pdosHelperScript,nbnd:800,bandFirst:301,bandLast:601}),/en fazla 300 bant/);
 const longPath=Array.from({length:11},(_,i)=>'K'+i+' '+(i/10)+' 0 0 '+(i===10?1:500)).join('\\n');
 await assert.rejects(createTrubaPipelinePackage({...opts,pipelineScript,converterScript,
  pdosHelperScript,nbnd:100,bandFirst:1,bandLast:30,bandPath:longPath}),/120.000/);
 const largeRaw=await createTrubaPipelinePackage({...opts,pipelineScript,nbnd:301});
 assert.equal(largeRaw.manifest.electronic_converter_included,false);
 const slurm=decode('stages/projwfc.slurm');
 assert.match(slurm,/python3 electronic\.py --bundle \./);
 assert.ok(slurm.indexOf('python3 electronic.py --bundle .')<
  slurm.indexOf('python3 pipeline.py finish projwfc'));
 assert.ok(slurm.indexOf('python3 pipeline.py finish projwfc')<
  slurm.indexOf('python3 pipeline.py summary'));
 const legacy=await createTrubaPipelinePackage({...opts,pipelineScript});
 assert.equal(legacy.manifest.electronic_converter_included,false);
 assert.equal((await entries(legacy.blob)).has('electronic.py'),false);
 await assert.rejects(createTrubaPipelinePackage({...opts,pipelineScript,converterScript}),
  /dönüştürücü/);
});
test('P1.2 uploaded UPF is pinned; unknown and untrusted files rejected',async()=>{
 const pipelineScript=readFileSync(new URL('../tools/qe_hpc_pipeline.py',import.meta.url),'utf8');
 const data=new TextEncoder().encode('<UPF version="2.0">Si</UPF>');
 const file={name:'Si.UPF',size:data.byteLength,arrayBuffer:async()=>data.buffer};
 const result=await createTrubaPipelinePackage({...opts,pipelineScript,upfFiles:[file]});
 assert.deepEqual(result.missing,[]);
 assert.equal(result.manifest.pseudopotentials[0].sha256,sha(data));
 await assert.rejects(createTrubaPipelinePackage({...opts,pipelineScript,
  upfFiles:[{...file,name:'../Si.UPF'}]}),/UPF/);
});
test('pipeline summary parser rejects fabricated completed states and unknown stages',()=>{
 const summary={
  schema:'kristalyapi.truba-qe-pipeline-summary.v1',status:'completed',
  scientific_convergence_verified:false,all_upfs_pinned:true,
  structure_in_sha256:sha(input),pipeline_manifest_sha256:sha('manifest'),
  stages:pipelineStages('scf').map(stage=>({stage,status:'completed',file_count:3,job_id:'1234'}))
 };
 assert.equal(parseTrubaPipelineSummary(summary),summary);
 const bad=structuredClone(summary);bad.stages[2].status='missing';
 assert.throws(()=>parseTrubaPipelineSummary(bad),/Tamamlandı/);
 const forged=structuredClone(summary);forged.scientific_convergence_verified=true;
 assert.throws(()=>parseTrubaPipelineSummary(forged),/şeması/);
 const invalid=structuredClone(summary);invalid.stages[0].stage='../../escape';
 assert.throws(()=>parseTrubaPipelineSummary(invalid),/sırası/);
});
test('pipeline report rendering is readonly text and UI contains bindings',()=>{
 const summary={
  schema:'kristalyapi.truba-qe-pipeline-summary.v1',status:'incomplete',
  scientific_convergence_verified:false,all_upfs_pinned:false,
  structure_in_sha256:sha(input),pipeline_manifest_sha256:sha('manifest'),
  stages:pipelineStages('scf').map(stage=>({stage,status:'missing'}))
 };
 class Element{
  constructor(type){this.type=type;this.textContent='';this.children=[];}
  append(...children){this.children.push(...children);}
  replaceChildren(...children){this.children=[...children];}
 }
 const old=globalThis.document;
 try{
  globalThis.document={createElement:type=>new Element(type)};
  const host=new Element('section');
  renderTrubaPipelineSummary(host,summary);
  assert.ok(host.children.length>=4);
 }finally{globalThis.document=old;}
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const app=readFileSync(new URL('../crystal-app.js',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 for(const id of ['qeHpcConvertElectronic','qeHpcBandFirst','qeHpcBandLast','qeHpcBandWindowHint','qeHpcPipelineExport','qeHpcPipelineStatus','qeHpcBandPath',
  'qeHpcNbnd','qeHpcNscfKx','qeHpcNscfKy','qeHpcNscfKz',
  'qeHpcEmin','qeHpcEmax','qeHpcDeltaE','qeHpcDegauss'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(app,/qeExportTrubaPipeline/);
 assert.match(sw,/qe-hpc-pipeline\.js/);
 assert.match(sw,/qe_hpc_pipeline\.py/);
});
