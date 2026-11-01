#!/usr/bin/env node
/* P1.1 independent offline artifact rehash + opt-in detached Ed25519 attestation.
 * Only verifies file integrity and holder of explicitly trusted signing key.
 * No scientific source authenticity, physical measurement or DFT claim. */
import {readFile,writeFile,lstat,realpath} from 'node:fs/promises';
import {basename,join,resolve} from 'node:path';
import {createHash,createPrivateKey,createPublicKey,sign,verify} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {verifyEvidenceBundle} from '../material-evidence-core.js';

const MAX_BUNDLE=2_000_000;
const MAX_ARTIFACT=12*1024*1024;
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
function assert(ok,message){if(!ok)throw Error(message);}
function safeBaseName(name){
 assert(typeof name==='string'&&name.length>0&&name.length<=180&&
  basename(name)===name&&name!=='.'&&name!=='..'&&!/[\\/\\\\\u0000-\u001f]/.test(name),
  'Unsafe evidence filename');
 return name;
}
async function strictFile(path,max){
 const stat=await lstat(path);
 assert(stat.isFile()&&!stat.isSymbolicLink(),'Evidence must be a regular file, not a symlink: '+path);
 assert(stat.size>=0&&stat.size<=max,'Evidence exceeds size limit: '+path);
 const bytes=await readFile(path);
 assert(bytes.length===stat.size,'Evidence size changed during reading');
 return bytes;
}
async function loadBundle(path){
 const raw=await strictFile(path,MAX_BUNDLE);
 const parsed=JSON.parse(raw.toString('utf8'));
 assert(parsed?.schema==='kristalyapi.material-evidence-bundle.v1','Unsupported bundle schema');
 assert(Array.isArray(parsed.cards)&&parsed.cards.length>0&&parsed.cards.length<=4,
  'Expected 1–4 material cards');
 await verifyEvidenceBundle(parsed.cards);
 return {raw,bundle:parsed};
}
export async function auditMaterialEvidence({bundlePath,filesDir}){
 assert(typeof bundlePath==='string'&&typeof filesDir==='string','Bundle and evidence directory required');
 const {raw,bundle}=await loadBundle(bundlePath);
 const directory=await realpath(filesDir);
 const report=[];
 for(const [i,card] of bundle.cards.entries()){
  const itemDir=join(directory,'card-'+(i+1));
  const entries=[];
  for(const entry of card.artifacts){
   const name=safeBaseName(entry.filename);
   const path=join(itemDir,name);
   const bytes=await strictFile(path,MAX_ARTIFACT);
   assert(bytes.length===entry.byteLength,'Evidence file byte count mismatch: '+name);
   assert(digest(bytes)===entry.sha256,'Evidence SHA-256 mismatch: '+name);
   entries.push({kind:entry.kind,sourceId:entry.sourceId,filename:name,
    sha256:entry.sha256,byteLength:bytes.length,rawBytesReverified:true});
  }
  report.push({cardIndex:i+1,geometrySha256:card.geometrySha256,
   geometryDigestVerified:true,artifacts:entries});
 }
 return {schema:'kristalyapi.material-evidence-audit.v1',bundleSha256:digest(raw),
  cards:report,artifactBytesReverified:true,sourceIdentitiesIndependentlyVerified:false,
  scientificAcceptance:false,
  limitation:'Hashes validate supplied bytes only. A signature authenticates possession of the separately trusted key, not the lab, device, CIF source or physical calculation.'};
}
function fingerprint(key){
 return digest(createPublicKey(key).export({type:'spki',format:'der'}));
}
export async function signEvidenceBundle({bundlePath,filesDir,privateKeyPath,signaturePath}){
 assert(typeof signaturePath==='string'&&signaturePath.length>0,'Signature output path required');
 await auditMaterialEvidence({bundlePath,filesDir});
 const bundle=await strictFile(bundlePath,MAX_BUNDLE);
 const pem=await strictFile(privateKeyPath,32768);
 const privateKey=createPrivateKey(pem);
 assert(privateKey.asymmetricKeyType==='ed25519','Only Ed25519 keys are supported');
 assert(resolve(signaturePath)!==resolve(bundlePath),'Signature must not replace evidence');
 const detached=sign(null,bundle,privateKey);
 // wx protects an existing signature from accidental overwrite.
 await writeFile(signaturePath,detached.toString('base64')+'\n',{flag:'wx',mode:0o600});
 return {signatureCreated:true,publicKeySpkiSha256:fingerprint(privateKey),
  bundleSha256:digest(bundle),signatureAlgorithm:'Ed25519',scientificAcceptance:false};
}
export async function verifyEvidenceSignature({bundlePath,signaturePath,publicKeyPath,trustedFingerprint}){
 assert(typeof trustedFingerprint==='string'&&/^[a-f0-9]{64}$/.test(trustedFingerprint),
  'An independently pinned trusted public key fingerprint is required');
 const data=await strictFile(bundlePath,MAX_BUNDLE);
 const signature=await strictFile(signaturePath,256);
 const base64=signature.toString('utf8').trim();
 assert(/^[A-Za-z0-9+/]{86}==?$/.test(base64),'Invalid detached Ed25519 signature encoding');
 const pem=await strictFile(publicKeyPath,32768);
 const pub=createPublicKey(pem);
 assert(pub.asymmetricKeyType==='ed25519','Only Ed25519 public keys are supported');
 const actual=fingerprint(pub);
 assert(actual===trustedFingerprint,'Untrusted public key fingerprint');
 assert(verify(null,data,pub,Buffer.from(base64,'base64')),'Detached bundle signature mismatch');
 return {signatureValidAgainstPinnedKey:true,publicKeySpkiSha256:actual,
  bundleSha256:digest(data),signerInstitutionAuthenticated:false,scientificAcceptance:false};
}
export async function run(argv){
 assert(argv.length>0&&['verify','sign'].includes(argv[0]),
  'Usage: verify|sign --bundle PATH --files-dir PATH [--signature PATH --public-key PATH --trusted-key-sha256 HEX | --private-key PATH --signature-out PATH] [--output PATH]');
 const mode=argv[0],args={};
 for(let i=1;i<argv.length;i+=2){
  const key=argv[i],value=argv[i+1];
  assert(key?.startsWith('--')&&value&&!value.startsWith('--'),'Expected option value: '+key);
  assert(!Object.hasOwn(args,key),'Duplicate option '+key);
  args[key]=value;
 }
 const known=['--bundle','--files-dir','--signature','--public-key','--trusted-key-sha256',
  '--private-key','--signature-out','--output'];
 for(const key of Object.keys(args))assert(known.includes(key),'Unknown option '+key);
 const basic={bundlePath:args['--bundle'],filesDir:args['--files-dir']};
 const audit=await auditMaterialEvidence(basic);
 if(mode==='sign'){
  assert(args['--private-key']&&args['--signature-out'],'Signing needs private key and signature output');
  audit.attestation=await signEvidenceBundle({...basic,privateKeyPath:args['--private-key'],
   signaturePath:args['--signature-out']});
 }else if(args['--signature']||args['--public-key']||args['--trusted-key-sha256']){
  assert(args['--signature']&&args['--public-key']&&args['--trusted-key-sha256'],
   'Signature verification requires signature, public key and independently trusted fingerprint');
  audit.attestation=await verifyEvidenceSignature({bundlePath:basic.bundlePath,
   signaturePath:args['--signature'],publicKeyPath:args['--public-key'],
   trustedFingerprint:args['--trusted-key-sha256']});
 }else{
  audit.attestation={signatureVerified:false,limitation:'No signed source attestation supplied.'};
 }
 const result=JSON.stringify(audit,null,2)+'\n';
 if(args['--output']){
  assert(resolve(args['--output'])!==resolve(args['--bundle']),'Output must not overwrite the bundle');
  await writeFile(args['--output'],result,{flag:'wx',mode:0o600});
 }else process.stdout.write(result);
 return audit;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 run(process.argv.slice(2)).catch(error=>{process.stderr.write('Evidence verification failed: '+error.message+'\n');process.exitCode=1;});
}
