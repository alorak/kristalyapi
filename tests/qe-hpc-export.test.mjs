import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {parsePwInput,validateResources,createTrubaPackage,createSlurm,zipStored} from '../qe-hpc-export.js';

if(!globalThis.crypto)globalThis.crypto=webcrypto;
const INPUT=[
 "&CONTROL",
 " calculation = 'relax',",
 " prefix = 'kristalyapi',",
 " pseudo_dir = './pseudo',",
 " outdir = './tmp',",
 "/",
 "&SYSTEM",
 " ibrav = 0,",
 " nat = 3, ntyp = 2,",
 "/",
 "ATOMIC_SPECIES",
 "Mo 95.95000 Mo.UPF",
 "S 32.06000 S.UPF",
 "CELL_PARAMETERS angstrom",
 "3.18 0 0",
 "0 3.18 0",
 "0 0 25",
 "ATOMIC_POSITIONS crystal",
 "Mo 0 0 0.5",
 "S 0.3333 0.6667 0.55",
 "S 0.3333 0.6667 0.45",
 "K_POINTS automatic",
 "4 4 1 0 0 0",
 ""
].join('\n');

async function zipEntries(blob){
 const data=new Uint8Array(await blob.arrayBuffer()),dv=new DataView(data.buffer);
 const result=new Map();let offset=0;
 const decoder=new TextDecoder();
 while(offset+4<data.length&&dv.getUint32(offset,true)===0x04034b50){
  const method=dv.getUint16(offset+8,true),len=dv.getUint32(offset+18,true);
  const fileNameLength=dv.getUint16(offset+26,true),extraLength=dv.getUint16(offset+28,true);
  assert.equal(method,0,'ZIP store method');
  const name=decoder.decode(data.subarray(offset+30,offset+30+fileNameLength));
  const from=offset+30+fileNameLength+extraLength;
  result.set(name,data.slice(from,from+len));
  offset=from+len;
 }
 assert.equal(dv.getUint32(offset,true),0x02014b50,'Central directory must follow local records');
 assert.equal(dv.getUint32(data.length-22,true),0x06054b50,'End of central directory must exist');
 return result;
}
test('QE input recognizes only SCF/relax and safe UPF names',()=>{
 const info=parsePwInput(INPUT);
 assert.equal(info.calculation,'relax');
 assert.deepEqual(info.pseudos,[{element:'Mo',file:'Mo.UPF'},{element:'S',file:'S.UPF'}]);
 assert.throws(()=>parsePwInput(INPUT.replace('Mo.UPF','../Mo.UPF')),/UPF/);
 assert.throws(()=>parsePwInput(INPUT.replace("'relax'","'vc-relax'")),/SCF veya relax/);
 assert.throws(()=>parsePwInput(INPUT.replace("pseudo_dir = './pseudo'","pseudo_dir = '/shared'")),/pseudo_dir/);
});
test('TRUBA resource values reject injection and out-of-profile allocations',()=>{
 assert.throws(()=>validateResources({account:'hello;rm -rf /'}),/hesap adı/);
 assert.throws(()=>validateResources({account:'ab',ntasks:1}),/MPI görev/);
 assert.throws(()=>validateResources({account:'ab',ntasks:57}),/56 veya 112/);
 assert.throws(()=>validateResources({account:'ab',ntasks:80}),/56 veya 112/);
 assert.throws(()=>validateResources({account:'ab',hours:73}),/Süre/);
 assert.throws(()=>validateResources({account:'ab',partition:'debug'}),/orfoz/);
 assert.deepEqual([validateResources({account:'project',ntasks:56,hours:72}).nodes,
  validateResources({account:'project'}).ntasks],[1,112]);
});
test('slurm script uses explicit module, task settings and UPF checks',()=>{
 const script=createSlurm(validateResources({account:'project_1',ntasks:56,hours:24}),parsePwInput(INPUT).pseudos);
 assert.match(script,/#SBATCH --time=1-00:00:00/);
 assert.match(script,/#SBATCH --ntasks=56/);
 assert.match(script,/#SBATCH --account=project_1/);
 assert.match(script,/apps\/espresso\/7\.4-epw-5\.9-oneapi-2024/);
 assert.match(script,/test -s "pseudo\/Mo\.UPF"/);
 assert.match(script,/mpirun pw\.x -in structure\.in > structure\.out/);
 assert.doesNotMatch(script,/\bsbatch\b/);
});
test('ZIP export without UPFs is explicit and inspectable',async()=>{
 const result=await createTrubaPackage({inputText:INPUT,account:'project_1',ntasks:56});
 assert.equal(result.manifest.status,'upf-required');
 assert.deepEqual(result.missing,['Mo.UPF','S.UPF']);
 assert.equal(result.manifest.execution_performed,false);
 const contents=await zipEntries(result.blob);
 assert.deepEqual([...contents.keys()],['structure.in','run.slurm','manifest.json','README.md','pseudo/README.txt']);
 assert.equal(new TextDecoder().decode(contents.get('structure.in')),INPUT);
 const manifest=JSON.parse(new TextDecoder().decode(contents.get('manifest.json')));
 assert.equal(manifest.structure_in_sha256,createHash('sha256').update(INPUT).digest('hex'));
 assert.equal(manifest.resources.qe_module,'apps/espresso/7.4-epw-5.9-oneapi-2024');
});
test('real selected UPF is embedded, hashed and checked at runtime',async()=>{
 const content=new TextEncoder().encode('<UPF version="2.0"><PP_HEADER element="Mo"/></UPF>');
 const file={name:'Mo.UPF',size:content.byteLength,arrayBuffer:async()=>content.buffer};
 const result=await createTrubaPackage({inputText:INPUT,account:'project_1',upfFiles:[file]});
 assert.deepEqual(result.missing,['S.UPF']);
 const entries=await zipEntries(result.blob);
 assert.deepEqual(entries.get('pseudo/Mo.UPF'),content);
 const hash=createHash('sha256').update(content).digest('hex');
 assert.equal(result.manifest.pseudopotentials[0].sha256,hash);
 assert.match(new TextDecoder().decode(entries.get('run.slurm')),new RegExp(hash));
 assert.match(new TextDecoder().decode(entries.get('run.slurm')),/sha256sum -c --status/);
});
test('invalid UPF files and unexpected names do not produce a package',async()=>{
 const fake=data=>({name:'Mo.UPF',size:data.length,arrayBuffer:async()=>new TextEncoder().encode(data).buffer});
 await assert.rejects(createTrubaPackage({inputText:INPUT,account:'project_1',
  upfFiles:[fake('not a pseudopotential')]}),/UPF başlığı/);
 await assert.rejects(createTrubaPackage({inputText:INPUT,account:'project_1',
  upfFiles:[{...fake('<UPF/>'),name:'unused.UPF'}]}),/kullanılmayan/);
 await assert.rejects(createTrubaPackage({inputText:INPUT,account:'project_1',
  upfFiles:[{...fake('<UPF/>'),name:'../Mo.UPF'}]}),/Güvensiz/);
});
test('offline app includes all P0 dependencies and route bindings',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const app=readFileSync(new URL('../crystal-app.js',import.meta.url),'utf8');
 const sw=readFileSync(new URL('../sw.js',import.meta.url),'utf8');
 for(const id of ['qeHpcAccount','qeHpcTasks','qeHpcHours','qeHpcUpfFiles','qeExportHpc','qeHpcExportStatus'])
  assert.match(html,new RegExp('id="'+id+'"'));
 assert.match(app,/createTrubaPackage/);
 assert.match(app,/\$\('qeExportHpc'\)\.onclick=qeExportTrubaPackage/);
 assert.match(sw,/qe-hpc-export\.js/);
});
