/* P1.2 supervised, phase-held-out kNN trained on actual periodic bond/coordination descriptors.
 * A deliberately bounded research baseline, not PINN, GNN or new DFT calculations.
 * JARVIS OptB88vdW labels are not interchangeable with P0 experiment or P1 ZEBRA targets.
 */
import {structureDescriptorsP1} from './materials-ml-p1-core.js';
import {squaredCompositionDistance,parseCompositionFormula} from './materials-ml-core.js';

const SOURCE_SCHEMA='kristalyapi.jarvis-polymorph-source.p12.v1';
export const MODEL_ID='jarvis-p12-composition-bond-coordination-knn';
const K=5;
const VOLUME_WEIGHT=0.05;
const PARAMS=[
 {bond:0.05,coord:0.02},{bond:0.05,coord:0.10},{bond:0.05,coord:0.40},
 {bond:0.20,coord:0.02},{bond:0.20,coord:0.10},{bond:0.20,coord:0.40},
 {bond:0.80,coord:0.02},{bond:0.80,coord:0.10},{bond:0.80,coord:0.40}
];
const fnv32=s=>{let n=2166136261;for(let i=0;i<s.length;i++){n^=s.charCodeAt(i);n=Math.imul(n,16777619);}return n>>>0;};
const valid=n=>typeof n==='number'&&Number.isFinite(n);
const rounded=n=>Number(n.toFixed(6));
function decodeRow(row){
 if(!Array.isArray(row)||row.length!==7||typeof row[0]!=='string'||typeof row[1]!=='string'||
    !Number.isInteger(row[2])||row[2]<1||row[2]>230||!valid(row[3])||row[3]<0||
    !valid(row[4])||!row[5]||!Array.isArray(row[6])||row[6].length>128||
    row[6].length<1)throw Error('Geçersiz JARVIS kristal kaydı.');
 const [id,formula,sg,gapEV,formationEVPerAtom,cell,rawSites]=row;
 const sites=rawSites.map(r=>{
  if(!Array.isArray(r)||r.length!==4||typeof r[0]!=='string'||
     !r.slice(1).every(valid))throw Error('Geçersiz atom koordinatı.');
  return {symbol:r[0],x:r[1],y:r[2],z:r[3]};
 });
 return {id,formula,sg,gapEV,formationEVPerAtom,
  structure:{name:formula+' · '+id,nonPeriodic:false,cell,sites}};
}
export function preparePolymorphCorpus(source){
 if(source?.schema!==SOURCE_SCHEMA||!Array.isArray(source.records)||
    source.records.length<100||source.records.length>500||
    source.totalOriginal!==184||typeof source.archiveSha256!=='string'||
    typeof source.memberSha256!=='string')throw Error('P1.2 kaynak sürümü eksik veya değişmiş.');
 const rows=[],rejected=[];
 const seen=new Set();
 for(const raw of source.records){
  const id=Array.isArray(raw)?raw[0]:null;
  if(seen.has(id))throw Error('Yinelenen JARVIS kimliği: '+id);
  seen.add(id);
  try{
   const x=decodeRow(raw),d=structureDescriptorsP1(x.structure);
   if(d.meanClosestBondA<0.45||d.meanClosestBondA>8||
      d.meanCoordination<1||d.meanCoordination>36)throw Error('Geçersiz komşuluk.');
   // Reject a provenance mismatch between provider formula and actual atoms.
   const formulaFractions=parseCompositionFormula(x.formula);
   if(squaredCompositionDistance(d.fractions,formulaFractions)>1e-7)
    throw Error('JARVIS formül ve atom konumları eşleşmiyor.');
   rows.push({id:x.id,formula:x.formula,sg:x.sg,
    targetGapEV:x.gapEV,targetFormationEVPerAtom:x.formationEVPerAtom,
    fractions:d.fractions,vpa:d.volumePerAtomA3,
    bond:d.meanClosestBondA,coord:d.meanCoordination});
  }catch(e){rejected.push({id:String(id||'?'),reason:String(e.message||e)});}
 }
 if(rows.length<90)throw Error('Geometri kontrollerinden yeterli JARVIS yapısı geçmedi.');
 return {rows,rejected,source:{archiveSha256:source.archiveSha256,memberSha256:source.memberSha256}};
}
export function splitPolymorphCorpus(rows){
 // Group by chemical formula and provider symmetry number before splitting.
 // A space-group group cannot occur across training/validation/test, and any
 // evaluated formula must also be represented by a DIFFERENT SG in training.
 const byFormula=new Map();
 for(const row of rows){
  if(!byFormula.has(row.formula))byFormula.set(row.formula,new Map());
  const groups=byFormula.get(row.formula);
  if(!groups.has(row.sg))groups.set(row.sg,[]);
  groups.get(row.sg).push(row);
 }
 const train=[],validation=[],test=[];
 for(const [formula,byGroup]of byFormula){
  const ordered=[...byGroup].sort((a,b)=>{
   const ha=fnv32(formula+'|'+a[0]),hb=fnv32(formula+'|'+b[0]);
   return ha-hb||a[0]-b[0];
  });
  for(let i=0;i<ordered.length;i++){
   const target=ordered.length>=2&&i===0?test:
    ordered.length>=3&&i===1?validation:train;
   target.push(...ordered[i][1]);
  }
 }
 if(!train.length||validation.length<10||test.length<10)throw Error('Polimorf grup ayrımı çok küçük.');
 const groups=rows=>new Set(rows.map(r=>r.formula+'|'+r.sg));
 const tr=groups(train),va=groups(validation),te=groups(test);
 if([...va].some(x=>tr.has(x)||te.has(x))||[...te].some(x=>tr.has(x)))throw Error('Uzay grubu veri sızıntısı.');
 const trForm=new Set(train.map(r=>r.formula));
 if([...validation,...test].some(r=>!trForm.has(r.formula)))throw Error('Test formülü eğitimde bulunmuyor.');
 return {train,validation,test,groups:{train:tr.size,validation:va.size,test:te.size},
  formulas:{train:trForm.size,validation:new Set(validation.map(r=>r.formula)).size,
   test:new Set(test.map(r=>r.formula)).size}};
}
function squaredDistance(a,b,params){
 const compositionD2=squaredCompositionDistance(a.fractions,b.fractions);
 const volumeLog=Math.log(a.vpa/b.vpa);
 const bondLog=Math.log(a.bond/b.bond);
 const coordinationDelta=(a.coord-b.coord)/6;
 return compositionD2+VOLUME_WEIGHT*volumeLog**2+
  params.bond*bondLog**2+params.coord*coordinationDelta**2;
}
export function polymorphNeighbors(train,input,params){
 const nearest=[];
 for(const row of train){
  const d=squaredDistance(input,row,params);
  let i=0;
  while(i<nearest.length&&(nearest[i].distance<d||
       (nearest[i].distance===d&&nearest[i].id<row.id)))i++;
  if(i<K)nearest.splice(i,0,{...row,distance:d});
  if(nearest.length>K)nearest.pop();
 }
 return nearest;
}
export function polymorphPredict(train,input,target,params){
 const neighbours=polymorphNeighbors(train,input,params);
 if(!neighbours.length)throw Error('Eğitim kaydı bulunamadı.');
 let numerator=0,denominator=0;
 for(const n of neighbours){const w=1/(n.distance+0.01)**2;numerator+=w*n[target];denominator+=w;}
 return {estimate:numerator/denominator,neighbours};
}
function measure(rows,train,target,params){
 let abs=0,sq=0,count=0,perGroup=new Map();
 const list=[];
 for(const row of rows){
  const pred=polymorphPredict(train,row,target,params);
  const e=Math.abs(pred.estimate-row[target]);
  abs+=e;sq+=e*e;count++;
  const k=row.formula+'|'+row.sg;
  if(!perGroup.has(k))perGroup.set(k,[]);
  perGroup.get(k).push(e);
  list.push({id:row.id,formula:row.formula,spacegroup:row.sg,
   actual:row[target],estimated:pred.estimate,absoluteError:e,
   nearestJid:pred.neighbours[0].id});
 }
 return {count,mae:rounded(abs/count),rmse:rounded(Math.sqrt(sq/count)),
  phaseGroupCount:perGroup.size,
  phaseMacroMae:rounded([...perGroup.values()].reduce((a,arr)=>
   a+arr.reduce((x,y)=>x+y,0)/arr.length,0)/perGroup.size),
  sampleRows:list};
}
export function geometricallyDistinctPolymorphs(test,training){
 // More conservative secondary cohort: reject SG-separated rows if a same-formula
 // training row is also near-identical in V/atom, mean shortest bond and CN.
 // Still a descriptor-based proxy, NOT full structural equivalence matching.
 return test.filter(x=>!training.some(y=>y.formula===x.formula&&
   Math.abs(Math.log(x.vpa/y.vpa))<0.02&&
   Math.abs(Math.log(x.bond/y.bond))<0.02&&
   Math.abs(x.coord-y.coord)<0.3));
}
export function trainPolymorphModel(source){
 const corpus=preparePolymorphCorpus(source),split=splitPolymorphCorpus(corpus.rows);
 const trained=[...split.train,...split.validation];
 const distinctTest=geometricallyDistinctPolymorphs(split.test,trained);
 const targetNames=['targetGapEV','targetFormationEVPerAtom'];
 const comparisons={};
 for(const target of targetNames){
  const tuned=PARAMS.map(p=>({params:p,score:measure(split.validation,split.train,target,p).mae}));
  tuned.sort((a,b)=>a.score-b.score||a.params.bond-b.params.bond||a.params.coord-b.params.coord);
  const selected=tuned[0].params;
  comparisons[target]={
   selected,validation:measure(split.validation,split.train,target,selected),
   heldout:measure(split.test,trained,target,selected),
   baseline:measure(split.test,trained,target,{bond:0,coord:0}),
   distinctGeometryHoldout:distinctTest.length?
    measure(distinctTest,trained,target,selected):null,
   distinctGeometryBaseline:distinctTest.length?
    measure(distinctTest,trained,target,{bond:0,coord:0}):null
  };
 }
 return {
  schema:'kristalyapi.jarvis-polymorph-trained.p12.v1',
  modelId:MODEL_ID,source:corpus.source,
  counts:{original:source.totalOriginal,sourceRecords:source.records.length,
   accepted:corpus.rows.length,rejected:corpus.rejected.length,
   train:split.train.length,validation:split.validation.length,test:split.test.length,
   structurallyDistinctTest:distinctTest.length,
   ...split.groups,formulas:split.formulas},
  exclusionReasons:corpus.rejected,
  weights:comparisons,
  training:trained,
  testIdentities:split.test.map(r=>r.id),
  disclaimer:'Separate JARVIS OptB88vdW target. Space-group-held-out proxy for polymorphs, not independent phase certification or uncertainty calibration.'
 };
}
export function inferPolymorphProperties(model,structure){
 if(model?.schema!=='kristalyapi.jarvis-polymorph-trained.p12.v1')throw Error('P1.2 modeli tanınmıyor.');
 const d=structureDescriptorsP1(structure);
 const input={fractions:d.fractions,vpa:d.volumePerAtomA3,
  bond:d.meanClosestBondA,coord:d.meanCoordination};
 const results={};
 for(const [label,target] of [['gap','targetGapEV'],['formation','targetFormationEVPerAtom']]){
  const tuned=model.weights[target].selected;
  const p=polymorphPredict(model.training,input,target,tuned);
  const close=p.neighbours[0];
  const compD2=squaredCompositionDistance(d.fractions,close.fractions);
  const domain=compD2<=0.08&&Math.abs(Math.log(input.vpa/close.vpa))<=0.65&&
    Math.abs(Math.log(input.bond/close.bond))<=0.5&&Math.abs(input.coord-close.coord)<=4;
  results[label]={value:domain?p.estimate:null,status:domain?'prediction':'out-of-domain',
   nearest:p.neighbours.map(n=>({jid:n.id,formula:n.formula,spacegroup:n.sg,
    distance:rounded(n.distance),target:n[target]})),parameters:tuned};
 }
 return {modelId:model.modelId,features:d,targets:results,validation:model.weights,
  trainingCount:model.counts.train+model.counts.validation};
}
