import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {capturedMaterialCard,attachEvidenceFile} from '../material-evidence-core.js';
import {auditMaterialEvidence,signEvidenceBundle,verifyEvidenceSignature} from '../tools/material_evidence_attestation.mjs';

const structure={name:'synthetic GaN',symmetry:'operator-declared',workspace:'unit test',
 cell:{a:3.2,b:3.2,c:5.2,alpha:90,beta:90,gamma:120},
 sites:[{symbol:'Ga',x:0,y:0,z:0},{symbol:'N',x:.333333333333,y:.666666666667,z:.375}]};
const sha=x=>createHash('sha256').update(x).digest('hex');
async function setup(t){
 const root=await mkdtemp(join(tmpdir(),'kristalyapi-attestation-'));
 t.after(async()=>{await rm(root,{recursive:true,force:true});});
 const directory=join(root,'evidence');await mkdir(join(directory,'card-1'),{recursive:true});
 const bytes=Buffer.from('data_test\n_cell_length_a 3.2\n','utf8');
 const card=await capturedMaterialCard(structure,{capturedAt:'2026-11-01T00:00:00Z'});
 const file={name:'structure.cif',size:bytes.length,async arrayBuffer(){return Uint8Array.from(bytes).buffer;}};
 const withFile=await attachEvidenceFile(card,file,{kind:'cif',sourceId:'synthetic-only',recordedAt:'2026-11-01T00:00:00Z'});
 const bundle={schema:'kristalyapi.material-evidence-bundle.v1',cards:[withFile]};
 const bundlePath=join(root,'materials-evidence.json');
 await writeFile(bundlePath,JSON.stringify(bundle,null,2)+'\n');
 await writeFile(join(directory,'card-1','structure.cif'),bytes);
 const {publicKey,privateKey}=generateKeyPairSync('ed25519');
 const priv=join(root,'private.pem'),pub=join(root,'public.pem'),signaturePath=join(root,'manifest.sig');
 await writeFile(priv,privateKey.export({format:'pem',type:'pkcs8'}));
 await writeFile(pub,publicKey.export({format:'pem',type:'spki'}));
 const trustedFingerprint=sha(publicKey.export({format:'der',type:'spki'}));
 return {root,directory,bundlePath,priv,pub,signaturePath,trustedFingerprint,bytes,publicKey,privateKey};
}
test('audit rehashes raw artifact bytes and verifies canonical geometry',async t=>{
 const p=await setup(t);
 const report=await auditMaterialEvidence({bundlePath:p.bundlePath,filesDir:p.directory});
 assert.equal(report.cards.length,1);
 assert.equal(report.cards[0].artifacts[0].rawBytesReverified,true);
 assert.equal(report.sourceIdentitiesIndependentlyVerified,false);
 assert.equal(report.scientificAcceptance,false);
});
test('Ed25519 detached attestation requires independently pinned key fingerprint',async t=>{
 const p=await setup(t);
 const result=await signEvidenceBundle({bundlePath:p.bundlePath,filesDir:p.directory,
  privateKeyPath:p.priv,signaturePath:p.signaturePath});
 assert.equal(result.publicKeySpkiSha256,p.trustedFingerprint);
 const r=await verifyEvidenceSignature({bundlePath:p.bundlePath,signaturePath:p.signaturePath,
  publicKeyPath:p.pub,trustedFingerprint:p.trustedFingerprint});
 assert.equal(r.signatureValidAgainstPinnedKey,true);
 assert.equal(r.signerInstitutionAuthenticated,false);
 await assert.rejects(verifyEvidenceSignature({bundlePath:p.bundlePath,signaturePath:p.signaturePath,
  publicKeyPath:p.pub,trustedFingerprint:'0'.repeat(64)}),/Untrusted/);
 const old=await readFile(p.bundlePath);
 await writeFile(p.bundlePath,Buffer.concat([old,Buffer.from('\n')]));
 await assert.rejects(verifyEvidenceSignature({bundlePath:p.bundlePath,signaturePath:p.signaturePath,
  publicKeyPath:p.pub,trustedFingerprint:p.trustedFingerprint}),/signature mismatch/);
});
test('digest mismatch and absent artifact must fail closed',async t=>{
 const p=await setup(t);
 const input=join(p.directory,'card-1','structure.cif');
 await writeFile(input,Buffer.concat([p.bytes,Buffer.from('tamper')]));
 await assert.rejects(auditMaterialEvidence({bundlePath:p.bundlePath,filesDir:p.directory}),/SHA-256|byte count/);
 await rm(input);await assert.rejects(auditMaterialEvidence({bundlePath:p.bundlePath,filesDir:p.directory}));
});
test('path traversal, embedded separators and symlinks are rejected',async t=>{
 const p=await setup(t);
 const json=JSON.parse(await readFile(p.bundlePath,'utf8'));
 json.cards[0].artifacts[0].filename='../evil.cif';
 await writeFile(p.bundlePath,JSON.stringify(json));
 await assert.rejects(auditMaterialEvidence({bundlePath:p.bundlePath,filesDir:p.directory}),/Unsafe/);
 json.cards[0].artifacts[0].filename='structure.cif';
 await writeFile(p.bundlePath,JSON.stringify(json));
 const path=join(p.directory,'card-1','structure.cif');await rm(path);
 await symlink(p.bundlePath,path);
 await assert.rejects(auditMaterialEvidence({bundlePath:p.bundlePath,filesDir:p.directory}),/regular file|symlink/);
});
test('standalone CLI returns a JSON report and fails on missing evidence',async t=>{
 const p=await setup(t);
 const script=fileURLToPath(new URL('../tools/material_evidence_attestation.mjs',import.meta.url));
 const ok=spawnSync(process.execPath,[script,'verify','--bundle',p.bundlePath,'--files-dir',p.directory],{encoding:'utf8'});
 assert.equal(ok.status,0,ok.stderr);
 assert.equal(JSON.parse(ok.stdout).cards[0].artifacts[0].rawBytesReverified,true);
 const fail=spawnSync(process.execPath,[script,'verify','--bundle',p.bundlePath,'--files-dir',join(p.root,'missing')],{encoding:'utf8'});
 assert.notEqual(fail.status,0);
});
