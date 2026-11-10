/* P1.2 CIF-trained kNN: both bond lengths and coordination were fitted with validation-only weights.
 * Same-composition TiO2 polymorph labels are external test only and NOT training targets. */
import {parseCompositionFormula,squaredCompositionDistance} from './materials-ml-core.js';

export const P12_SCHEMA='kristalyapi.materials-ml-p12-knn.v1';
const NUMBER=x=>typeof x==='number'&&Number.isFinite(x);
const TARGETS={gap:{key:'hybridDirectGapEV',sourceIndex:5},formation:{key:'formationEnergyEVPerAtom',sourceIndex:6}};
function featureError(msg){throw Error('P1.2: '+msg);}
export function prepareP12Model(raw){
 if(raw?.schema!==P12_SCHEMA||raw.license!=='CC-BY-4.0'||
   !Array.isArray(raw.rows)||raw.rows.length<80||raw.rows.length>1000||
   raw.rows.length!==raw.metrics?.train+raw.metrics?.val||
   raw.neighborCount!==7||!raw.metrics?.externalPolymorph?.allExcludedFromTraining)
   featureError('eksik veya bilinmeyen model şeması.');
 const ids=new Set();
 const rows=raw.rows.map(row=>{
  if(!Array.isArray(row)||row.length!==7||typeof row[0]!=='string'||typeof row[1]!=='string'||
     !row.slice(2).every(NUMBER)||row[2]<2||row[2]>300||row[3]<.45||row[3]>12||
     row[4]<1||row[4]>50||row[5]<0||row[5]>16||row[6]<-15||row[6]>10)
    featureError('geçersiz eğitim satırı.');
  if(ids.has(row[0]))featureError('yinelenen kimlik.');
  ids.add(row[0]);
  return {id:row[0],formula:row[1],vpa:row[2],bond:row[3],coord:row[4],
   gap:row[5],formation:row[6],fractions:parseCompositionFormula(row[1])};
 });
 for(const t of Object.keys(TARGETS)){
  const m=raw.metrics[t];
  if(!m||!Array.isArray(m.weights)||m.weights.length!==2||
    m.weights.some(x=>!NUMBER(x)||x<=0)||!NUMBER(m.testP12Mae)||!NUMBER(m.testBaselineMae))
   featureError('eğitilmiş özellik ağırlığı veya test sonucu eksik.');
 }
 return {modelId:raw.modelId,rows,metrics:raw.metrics,source:raw.source};
}
export function rankP12(model,features,target,{ablation=false}={}){
 if(!model?.rows?.length||!TARGETS[target])featureError('model veya hedef eksik.');
 if(!Array.isArray(features?.fractions)||!features.fractions.length||
  ![features.volumePerAtomA3,features.meanClosestBondA,features.meanCoordination].every(NUMBER)||
  features.volumePerAtomA3<=0||features.meanClosestBondA<=0||features.meanCoordination<0)
  featureError('geometrik girdi eksik.');
 const weights=ablation?[0,0]:model.metrics[target].weights,best=[];
 for(const row of model.rows){
  const compositionD2=squaredCompositionDistance(features.fractions,row.fractions);
  const logVpa=Math.log(features.volumePerAtomA3/row.vpa);
  const logBond=Math.log(features.meanClosestBondA/row.bond);
  const coordDifference=(features.meanCoordination-row.coord)/6;
  const distance=compositionD2+.03*logVpa**2+
   weights[0]*logBond**2+weights[1]*coordDifference**2;
  let i=0;while(i<best.length&&best[i].distance<distance)i++;
  if(i<7)best.splice(i,0,{id:row.id,formula:row.formula,distance,compositionD2,logVpa,
   vpa:row.vpa,bond:row.bond,coord:row.coord,targetValue:row[target]});
  if(best.length>7)best.pop();
 }
 let numerator=0,denominator=0;
 for(const v of best){const w=1/(v.distance+.01)**2;numerator+=w*v.targetValue;denominator+=w;}
 const first=best[0],known=first.distance<1e-12;
 const lookup=known?model.rows.find(r=>r.id===first.id):null;
 const rawValue=lookup?lookup[target]:numerator/denominator;
 const admitted=first.compositionD2<=.12&&Math.abs(first.logVpa)<=.6;
 return {value:admitted?rawValue:null,rawValue,status:!admitted?'out-of-domain':known?'training-reference':'prediction',
  neighbors:best};
}
export function predictP12(model,features){
 const gap=rankP12(model,features,'gap'),formation=rankP12(model,features,'formation');
 const admitted=gap.status!=='out-of-domain'&&formation.status!=='out-of-domain';
 return {
  status:!admitted?'out-of-domain':gap.status==='training-reference'&&
   formation.status==='training-reference'?'training-reference':'prediction',
  hybridDirectGapEV:admitted?gap.value:null,
  formationEnergyEVPerAtom:admitted?formation.value:null,
  nearest:formation.neighbors,modelId:model.modelId,metrics:model.metrics
 };
}
export function polymorphPairwise(reference){
 if(!Array.isArray(reference)||reference.length<3)featureError('en az üç polimorf gerekli.');
 let pairs=0,rankAgree=0,abs=0;
 for(let i=0;i<reference.length;i++)for(let j=i+1;j<reference.length;j++){
  const truth=reference[i].truth-reference[j].truth;
  const estimate=reference[i].prediction-reference[j].prediction;
  abs+=Math.abs(estimate-truth);
  if(Math.sign(estimate)===Math.sign(truth))rankAgree++;
  pairs++;
 }
 return {pairs,pairwiseMae:abs/pairs,rankAgreement:rankAgree/pairs};
}