/* P1: tamper-evident local structure snapshots and file digest ledger.
 * SHA-256 checks integrity of supplied bytes, never provenance authenticity,
 * calculation validity, measurement quality, or identity of an external source. */
import {materialCard} from './material-cards-core.js';

const HEX=/^[a-f0-9]{64}$/;
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const limited=(v,n)=>String(v??'').trim().slice(0,n);
const kindSet=new Set(['cif','xrd-scan','qe-input','qe-output','qe-protocol','other']);
const coordinates=['x','y','z'];
const cellKeys=['a','b','c','alpha','beta','gamma'];
function assertStructure(s){
 materialCard(s); // Reuse P0 lattice, occupancy and explicit P1 validation.
 if(s.nonPeriodic)throw Error('A periodic structure is required.');
}
// Exact, strictly typed geometry normalization; excludes name, visual styles, URLs,
// atom labels and symmetry claims. Sorting makes atom listing order irrelevant.
export function canonicalMaterialGeometry(structure){
 assertStructure(structure);
 const sites=structure.sites.map(atom=>({
  symbol:atom.symbol,
  fractional:coordinates.map(k=>Number(atom[k])),
  occupancy:atom.occupancy==null?1:Number(atom.occupancy)
 }));
 sites.sort((a,b)=>a.symbol.localeCompare(b.symbol,'en')||
  a.fractional[0]-b.fractional[0]||a.fractional[1]-b.fractional[1]||
  a.fractional[2]-b.fractional[2]||a.occupancy-b.occupancy);
 return {schema:'kristalyapi.geometry.v1',
  cell:Object.fromEntries(cellKeys.map(k=>[k,structure.cell[k]])),sites};
}
export async function sha256Hex(bytes){
 if(!globalThis.crypto?.subtle)throw Error('Web Crypto SHA-256 requires a secure browser context.');
 const payload=typeof bytes==='string'?new TextEncoder().encode(bytes):bytes;
 if(!(payload instanceof ArrayBuffer)&&!ArrayBuffer.isView(payload))throw Error('Unsupported digest payload.');
 const digest=await globalThis.crypto.subtle.digest('SHA-256',payload);
 return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
export async function capturedMaterialCard(structure,opts={}){
 const card=materialCard(structure,opts);
 const geometry=canonicalMaterialGeometry(structure);
 return {...card,evidenceSchema:'kristalyapi.evidence-card.v1',geometry,
  geometrySha256:await sha256Hex(JSON.stringify(geometry)),artifacts:[]};
}
export function validateEvidenceMeta(meta){
 if(!meta||!kindSet.has(meta.kind)||!limited(meta.sourceId,400)||
  !HEX.test(meta.sha256)||!Number.isSafeInteger(meta.byteLength)||
  meta.byteLength<0||meta.byteLength>12*1024*1024||
  typeof meta.filename!=='string'||meta.filename.length>180)
  throw Error('Evidence metadata is incomplete or invalid.');
 return {schema:'kristalyapi.evidence-record.v1',kind:meta.kind,
  sourceId:limited(meta.sourceId,400),filename:limited(meta.filename,180),
  byteLength:meta.byteLength,sha256:meta.sha256,structureSha256:meta.structureSha256,
  recordedAt:limited(meta.recordedAt,60),
  verification:'bytes-hashed-locally;source-identity-unverified'};
}
export async function attachEvidenceFile(card,file,{kind,sourceId,recordedAt}={}){
 if(card?.evidenceSchema!=='kristalyapi.evidence-card.v1'||!HEX.test(card.geometrySha256))
  throw Error('A P1 structure card is required.');
 if(!file||!Number.isSafeInteger(file.size)||file.size<0||file.size>12*1024*1024)
  throw Error('Evidence file must be at most 12 MiB.');
 if(!kindSet.has(kind)||!limited(sourceId,400))throw Error('Evidence type and reference are required.');
 if(!Array.isArray(card.artifacts)||card.artifacts.length>=12)throw Error('Maximum 12 evidence records per structure.');
 const bytes=await file.arrayBuffer();
 if(bytes.byteLength!==file.size)throw Error('File changed during reading.');
 const record=validateEvidenceMeta({kind,sourceId,sha256:await sha256Hex(bytes),
  filename:file.name,byteLength:file.size,structureSha256:card.geometrySha256,
  recordedAt:recordedAt||new Date().toISOString()});
 return {...card,artifacts:[...card.artifacts,record]};
}
export async function verifyEvidenceBundle(cards){
 if(!Array.isArray(cards)||cards.length>4)throw Error('At most four evidence cards can be verified.');
 const report=[];
 for(const [index,card] of cards.entries()){
  if(card?.evidenceSchema!=='kristalyapi.evidence-card.v1'||!card.geometry||
    !HEX.test(card.geometrySha256))throw Error('Invalid evidence-card schema.');
  const {cell,sites}=card.geometry;
  if(card.geometry.schema!=='kristalyapi.geometry.v1'||!Array.isArray(sites))throw Error('Invalid geometry schema.');
  const structure={cell,sites:sites.map(s=>({
   symbol:s.symbol,x:s.fractional?.[0],y:s.fractional?.[1],z:s.fractional?.[2],occupancy:s.occupancy
  }))};
  const normalized=canonicalMaterialGeometry(structure);
  if(JSON.stringify(normalized)!==JSON.stringify(card.geometry))throw Error('Geometry is not in canonical form.');
  const digest=await sha256Hex(JSON.stringify(normalized));
  if(digest!==card.geometrySha256)throw Error('Geometry SHA-256 mismatch for card '+(index+1));
  const original=materialCard(structure);
  if(original.formula!==card.formula||original.siteCount!==card.siteCount||
    original.volumeA3!==card.volumeA3||JSON.stringify(original.composition)!==JSON.stringify(card.composition))
    throw Error('Structure summary mismatch for card '+(index+1));
  if(!Array.isArray(card.artifacts)||card.artifacts.length>12)throw Error('Invalid evidence records.');
  for(const raw of card.artifacts){
   const validated=validateEvidenceMeta(raw);
   if(JSON.stringify(validated)!==JSON.stringify(raw)||validated.structureSha256!==digest)
    throw Error('Evidence record does not bind to card geometry.');
  }
  report.push({index,structureDigestVerified:true,artifactCount:card.artifacts.length,
   artifactBytesAvailable:false,independentSourceVerified:false});
 }
 return report;
}
