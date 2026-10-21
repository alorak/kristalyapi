/* XRD teaching examples use the same IT92 structure-factor engine as the
 * application. Conventional cubic P1 site lists are intentional: this is a
 * structure-factor lesson, not space-group refinement or Rietveld indexing.
 */
const FCC=[[0,0,0],[0,.5,.5],[.5,0,.5],[.5,.5,0]];
const cell=a=>({a,b:a,c:a,alpha:90,beta:90,gamma:90});
const atom=(symbol,[x,y,z],studyGroup=false)=>({symbol,x,y,z,occupancy:1,studyGroup});
const wrap=x=>((x%1)+1)%1;

export const XRD_FACTOR_EXAMPLES=Object.freeze([
 {id:'si',name:'Si · elmas kübik',a:5.431,description:'FCC örgü + (¼, ¼, ¼) baz; (200) sönüktür.'},
 {id:'fe',name:'Fe · hacim merkezli kübik (BCC)',a:2.866,description:'Köşeler ve gövde merkezi; h+k+l tekse sönüm.'},
 {id:'nacl',name:'NaCl · kaya tuzu',a:5.640,description:'İç içe iki FCC alt örgü; Na ve Cl genlikleri farklıdır.'}
]);

export function xrdFactorStructure(id,active=null){
 if(id==='active'){
  if(!active?.cell||!Array.isArray(active?.sites)||!active.sites.length)throw Error('Seçili kristal bulunamadı.');
  return {...active,sites:active.sites.map((site,index)=>({...site,studyGroup:index===0})),
   lessonTarget:'İlk atomik konum'};
 }
 if(id==='si'){
  return {name:'Si · elmas kübik',symmetry:'Fd-3m (P1 konum listesi)',cell:cell(5.431),
   lessonTarget:'İkinci Si alt örgüsü (4 konum)',
   sites:FCC.flatMap(point=>[atom('Si',point),atom('Si',point.map(v=>wrap(v+.25)),true)])};
 }
 if(id==='fe'){
  return {name:'Fe · BCC',symmetry:'Im-3m (P1 konum listesi)',cell:cell(2.866),
   lessonTarget:'Gövde merkezindeki Fe',
   sites:[atom('Fe',[0,0,0]),atom('Fe',[.5,.5,.5],true)]};
 }
 if(id==='nacl'){
  return {name:'NaCl · kaya tuzu',symmetry:'Fm-3m (P1 konum listesi)',cell:cell(5.640),
   lessonTarget:'Na alt örgüsü (4 konum)',
   sites:[...FCC.map(point=>atom('Cl',point)),...FCC.map(point=>atom('Na',[wrap(point[0]+.5),point[1],point[2]],true))]};
 }
 throw Error('Bilinmeyen yapı faktörü örneği: '+id);
}

export function xrdFactorPerturb(structure,{occupancy=1,shift=0}={}){
 if(!Number.isFinite(occupancy)||occupancy<0||occupancy>1||
    !Number.isFinite(shift)||shift<-.25||shift>.25)throw Error('Doluluk veya konum kaydırması geçersiz.');
 return {...structure,sites:structure.sites.map(site=>site.studyGroup?{
  ...site,occupancy:Number(site.occupancy??1)*occupancy,x:wrap(Number(site.x)+shift)
 }:{...site})};
}

export function xrdFactorResult(factor,structure,hkl,{occupancy=1,shift=0,lambda=1.5406}={}){
 if(typeof factor!=='function'||!Array.isArray(hkl)||hkl.length!==3||
    !hkl.every(Number.isInteger)||!hkl.some(Boolean))throw Error('Geçerli, sıfırdan farklı Miller indisleri gerekli.');
 const modified=xrdFactorPerturb(structure,{occupancy,shift});
 const [h,k,l]=hkl;
 const f=factor(h,k,l,modified.sites,modified.cell,'xray');
 const reference=factor(2,2,0,modified.sites,modified.cell,'xray');
 const arg=lambda/(2*f.d),twoTheta=arg>0&&arg<=1?2*Math.asin(arg)*180/Math.PI:null;
 return {structure:modified,hkl,f,reference,
  amplitude:Math.hypot(f.real,f.imag),intensity:f.intensity,
  relative220:reference.intensity>1e-12?100*f.intensity/reference.intensity:null,
  extinct:f.intensity<1e-8,twoTheta};
}

export function xrdFactorCompare(factor,hkl){
 return XRD_FACTOR_EXAMPLES.map(example=>{
  const state=xrdFactorStructure(example.id);
  const result=xrdFactorResult(factor,state,hkl);
  return {id:example.id,name:example.name,...result};
 });
}
