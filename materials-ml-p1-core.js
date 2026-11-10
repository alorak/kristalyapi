/* P1: crystal-volume-aware kNN with an independent PBC coordination validity audit.
 * The regressor is trained on composition + volume/atom, NOT neighbor distances.
 * Targets: hybrid-DFT DIRECT gap and DFT formation energy, never experimental data. */
import {compositionFromStructure,parseCompositionFormula,squaredCompositionDistance} from './materials-ml-core.js';
import {ELEMENT_DATA} from './element-data.js';
import {neighbourLists,symmetryOperations} from './geometry-table.js';

export const ZEBRA_SCHEMA='kristalyapi.zebra-structural-knn.v1';
const AMU_PER_A3_TO_GCM3=1.66053906660;
const VALIDITY={compositionD2Max:0.12,logVolumePerAtomMax:0.6};
const finite=value=>typeof value==='number'&&Number.isFinite(value);
export function cellVolumeA3(cell){
 if(!cell||!['a','b','c','alpha','beta','gamma'].every(k=>finite(cell[k])))throw Error('Hücre metrikleri eksik.');
 const {a,b,c,alpha,beta,gamma}=cell;
 if([a,b,c].some(v=>v<=0)||[alpha,beta,gamma].some(v=>v<=0||v>=180))throw Error('Hücre kenarı veya açısı geçersiz.');
 const [ca,cb,cg]=[alpha,beta,gamma].map(x=>Math.cos(x*Math.PI/180));
 const factor=1+2*ca*cb*cg-ca*ca-cb*cb-cg*cg;
 if(factor<=1e-10)throw Error('Hücre dejenere.');
 const volume=a*b*c*Math.sqrt(factor);
 if(!finite(volume)||volume<=0)throw Error('Hücre hacmi geçersiz.');
 return volume;
}
export function structureDescriptorsP1(structure){
 const fractions=compositionFromStructure(structure);
 const n=structure.sites.length;
 if(n>128)throw Error('P1 komşuluk analizi en fazla 128 atomlu P1 hücreleri destekler.');
 const volumeA3=cellVolumeA3(structure.cell),vpa=volumeA3/n;
 if(vpa<2||vpa>300)throw Error('Atom başına hacim P1 eğitim aralığının dışında.');
 const mass=structure.sites.reduce((sum,s)=>sum+ELEMENT_DATA.mass[s.symbol],0);
 if(!finite(mass))throw Error('Atom kütlesi bulunamadı.');
 // The active editor supplies symmetry-expanded P1 sites. Do not re-expand them.
 const sites=structure.sites.map(s=>({symbol:s.symbol,x:s.x-Math.floor(s.x),y:s.y-Math.floor(s.y),z:s.z-Math.floor(s.z)}));
 const indices=new Set();
 for(const site of sites){
  const k=[site.x,site.y,site.z].map(v=>Math.round(v*1e5)).join(':');
  if(indices.has(k))throw Error('Üst üste binen periyodik atom konumları var.');
  indices.add(k);
 }
 const cutoff=Math.min(8,Math.max(4,2.7*Math.cbrt(vpa)));
 const identity=symmetryOperations([['x,y,z','0,0,0']]);
 const lists=neighbourLists(sites,structure.cell,identity,()=>[0.1,cutoff],{periodic:true,limit:40000});
 if(lists.some(list=>!list.length))throw Error('Periyodik atom komşuları bulunamadı.');
 const closest=lists.map(list=>list[0].distance);
 if(closest.some(v=>!finite(v)||v<0.45))throw Error('Yapıda örtüşen veya fiziksel olmayan yakın atomlar var.');
 const meanClosestBondA=closest.reduce((a,b)=>a+b,0)/n;
 const meanCoordination=lists.reduce((sum,list,i)=>
  sum+list.filter(entry=>entry.distance<=closest[i]*1.35+1e-7).length,0)/n;
 return {
  fractions,siteCount:n,volumeA3,volumePerAtomA3:vpa,
  densityGcm3:mass*AMU_PER_A3_TO_GCM3/volumeA3,
  nearestBondA:Math.min(...closest),meanClosestBondA,meanCoordination,
  neighborCutoffA:cutoff,coordinationMethod:'P1 periodic neighbors; shell <= 1.35x per-site nearest'
 };
}
export function prepareStructuralModel(raw){
 if(raw?.schema!==ZEBRA_SCHEMA||raw.license!=='CC-BY-4.0'||
    !Array.isArray(raw.rows)||raw.rows.length<50||raw.rows.length>2500||
    raw.rows.length!==raw.meta?.train||raw.meta?.test<50||
    raw.neighbors!==7||!finite(raw.meta?.gap?.maeEV)||!finite(raw.meta?.formation?.maeEV))
  throw Error('P1 model sürümü veya değerlendirme verisi geçersiz.');
 const rows=raw.rows.map(v=>{
  if(!Array.isArray(v)||v.length!==5||typeof v[0]!=='string'||typeof v[1]!=='string'||
    !v.slice(2).every(finite)||v[2]<2||v[2]>300||v[3]<0||v[3]>15||v[4]<-15||v[4]>10)
   throw Error('P1 eğitim girdisi geçersiz.');
  return {id:v[0],formula:v[1],vpa:v[2],gap:v[3],formation:v[4],fractions:parseCompositionFormula(v[1])};
 });
 const ids=new Set(rows.map(v=>v.id));
 if(ids.size!==rows.length)throw Error('P1 yinelenen eğitim kimliği.');
 return {modelId:raw.modelId,rows,meta:raw.meta,source:raw.source};
}
function rank(model,features,target,weight){
 const best=[];
 for(const row of model.rows){
  const compositionD2=squaredCompositionDistance(features.fractions,row.fractions);
  const logVpa=Math.log(features.volumePerAtomA3/row.vpa);
  const distance=compositionD2+weight*logVpa*logVpa;
  let i=0;
  while(i<best.length&&best[i].distance<distance)i++;
  if(i<7)best.splice(i,0,{id:row.id,formula:row.formula,vpa:row.vpa,compositionD2,logVpa,distance,value:row[target]});
  if(best.length>7)best.pop();
 }
 let num=0,den=0;
 for(const item of best){const w=1/Math.pow(item.distance+0.01,2);num+=w*item.value;den+=w;}
 return {value:num/den,neighbors:best};
}
export function predictStructuralProperties(model,features){
 if(!model?.rows?.length||!features?.fractions||!finite(features.volumePerAtomA3))
  throw Error('P1 tahmini için model veya geometri tanımlayıcıları eksik.');
 const gap=rank(model,features,'gap',model.meta.gap.chosenWeight);
 const formation=rank(model,features,'formation',model.meta.formation.chosenWeight);
 const closest=gap.neighbors[0];
 const accepted=closest.compositionD2<=VALIDITY.compositionD2Max&&
  Math.abs(closest.logVpa)<=VALIDITY.logVolumePerAtomMax;
 const known=closest.compositionD2<1e-10&&Math.abs(closest.logVpa)<1e-6;
 const source=known?model.rows.find(row=>row.id===closest.id):null;
 return {
  status:!accepted?'out-of-domain':known?'training-reference':'prediction',
  hybridDirectGapEV:accepted?(source?source.gap:gap.value):null,
  formationEnergyEVPerAtom:accepted?(source?source.formation:formation.value):null,
  neighbors:gap.neighbors,
  modelId:model.modelId,validity:VALIDITY,
  evaluation:{gap:model.meta.gap,formation:model.meta.formation,acceptance:model.meta.acceptance}
 };
}
