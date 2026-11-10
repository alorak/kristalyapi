/* Experimental band gap: composition-only Matbench kNN baseline. Not DFT/PINN/GNN. */
import {ELEMENT_DATA} from './element-data.js';
const ELEMENTS=new Set(Object.keys(ELEMENT_DATA.mass));
export const MAX_SQUARED_DISTANCE=0.08;
function normalize(counts){
 const entries=Object.entries(counts).filter(([,v])=>v>0);
 const sum=entries.reduce((s,[,v])=>s+v,0);
 if(!entries.length||!(sum>0)||!Number.isFinite(sum))throw Error('Geçersiz malzeme bileşimi.');
 return entries.map(([e,n])=>[e,n/sum]).sort((a,b)=>a[0].localeCompare(b[0]));
}
export function parseCompositionFormula(formula){
 const src=String(formula).trim().replaceAll('[','(').replaceAll(']',')');
 if(!src||src.length>150)throw Error('Formül uzunluğu geçersiz.');
 const tokens=src.match(/([A-Z][a-z]?|\(|\)|(?:\d+(?:\.\d*)?|\.\d+))/g);
 if(!tokens||tokens.join('')!==src)throw Error('Desteklenmeyen kimyasal formül.');
 let i=0;
 function group(){
  const counts={};
  while(i<tokens.length&&tokens[i]!==')'){
   let sub;
   if(tokens[i]==='('){i++;sub=group();if(tokens[i++]!==')')throw Error('Eşleşmeyen parantez.');}
   else if(/^[A-Z]/.test(tokens[i])){
    const el=tokens[i++];if(!ELEMENTS.has(el))throw Error('Bilinmeyen element: '+el);
    sub={[el]:1};
   }else throw Error('Geçersiz formül çarpanı.');
   let factor=1;
   if(i<tokens.length&&/^(?:\d|\.)/.test(tokens[i]))factor=Number(tokens[i++]);
   if(!(factor>0&&Number.isFinite(factor)))throw Error('Geçersiz atom sayısı.');
   for(const [e,v] of Object.entries(sub))counts[e]=(counts[e]||0)+v*factor;
  }
  return counts;
 }
 const counts=group();
 if(i!==tokens.length)throw Error('Geçersiz formül sonu.');
 return normalize(counts);
}
export function compositionFromStructure(structure){
 if(!structure||structure.nonPeriodic||!Array.isArray(structure.sites)||
    structure.sites.length===0||structure.sites.length>1000)
  throw Error('ML tahmini için 1–1000 atom konumlu periyodik kristal gerekli.');
 const counts={};
 for(const s of structure.sites){
  const el=s.symbol,occupation=s.occupancy??1;
  if(!ELEMENTS.has(el)||!Number.isFinite(occupation)||occupation!==1)
   throw Error('P0 yalnız tam doluluklu ve bilinen elementli kristalleri destekliyor.');
  if(!['x','y','z'].every(k=>Number.isFinite(s[k])))throw Error('Atom koordinatları geçersiz.');
  counts[el]=(counts[el]||0)+1;
 }
 return normalize(counts);
}
export function squaredCompositionDistance(a,b){
 let i=0,j=0,d2=0;
 while(i<a.length||j<b.length){
  let x=0,y=0;
  if(j>=b.length||(i<a.length&&a[i][0]<b[j][0]))x=a[i++][1];
  else if(i>=a.length||b[j][0]<a[i][0])y=b[j++][1];
  else{x=a[i++][1];y=b[j++][1];}
  d2+=(x-y)**2;
 }
 return d2;
}
export function prepareGapModel(raw){
 if(raw?.schema!=='kristalyapi.materials-ml-knn.v1'||raw?.target!=='experimental_band_gap_eV'||
    !Array.isArray(raw.rows)||raw.rows.length<5||raw.rows.length>5000||
    raw.trainingCount!==raw.rows.length||!Number.isFinite(raw.validation?.maeEV)||
    !Number.isInteger(raw.validation?.samples))
  throw Error('Bilinmeyen veya eksik ML model şeması.');
 const seen=new Set();
 const rows=raw.rows.map(row=>{
  if(!Array.isArray(row)||row.length!==2||typeof row[0]!=='string'||
     !Number.isFinite(row[1])||row[1]<0||row[1]>16)throw Error('Geçersiz eğitim satırı.');
  const fractions=parseCompositionFormula(row[0]);
  const key=fractions.map(([k,v])=>k+':'+v.toFixed(5)).join(';');
  if(seen.has(key))throw Error('Yinelenen model bileşimi.');
  seen.add(key);return {formula:row[0],gapEV:row[1],fractions};
 });
 return {modelId:raw.modelId,trainingCount:raw.trainingCount,validation:{...raw.validation},rows};
}
export function predictExperimentalGap(model,fractions){
 if(!model?.rows?.length||!Array.isArray(fractions)||!fractions.length)throw Error('ML modeli veya bileşimi yok.');
 const nearest=[];
 for(const row of model.rows){
  const d2=squaredCompositionDistance(fractions,row.fractions);
  let i=0;while(i<nearest.length&&nearest[i].distanceSquared<=d2)i++;
  if(i<5)nearest.splice(i,0,{formula:row.formula,gapEV:row.gapEV,distanceSquared:d2});
  if(nearest.length>5)nearest.pop();
 }
 const best=nearest[0];
 if(best.distanceSquared<1e-10)return {status:'training-reference',gapEV:best.gapEV,nearest,modelId:model.modelId};
 if(best.distanceSquared>MAX_SQUARED_DISTANCE)return {status:'out-of-domain',gapEV:null,nearest,modelId:model.modelId};
 let num=0,den=0;
 for(const v of nearest){const weight=1/(v.distanceSquared+0.0001)**2;num+=weight*v.gapEV;den+=weight;}
 return {status:'prediction',gapEV:num/den,nearest,modelId:model.modelId};
}
