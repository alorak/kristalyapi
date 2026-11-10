import {GRAPHENE_DEMO,grapheneGeometry,grapheneBands,grapheneDos} from './browser-tb-core.js';

// No automatic requests and no code fetched from a third-party origin.
// GANSU Lite runs on its own origin: this is an explicit finite-XYZ handoff,
// NOT an embedded, locally bundled Kohn–Sham DFT solver.
const GANSU_URL='https://yasuaki-ito.github.io/GANSU-Lite/';
const PRESETS={
 h2:'2\nH2 · 0.74 Å\nH 0 0 0\nH 0 0 0.74',
 water:'3\nH2O · experimental-inspired geometry\nO 0 0 0\nH 0.757 0.586 0\nH -0.757 0.586 0'
};
const $=(root,id)=>root.querySelector('#'+id);
const svgNS='http://www.w3.org/2000/svg';
function svgNode(tag,attrs={},text){
 const node=document.createElementNS(svgNS,tag);
 for(const [name,value] of Object.entries(attrs))node.setAttribute(name,String(value));
 if(text!==undefined)node.textContent=text;
 return node;
}
function drawAxes(svg,w,h,{minX,maxX,minY,maxY}){
 const left=55,right=w-18,top=18,bottom=h-34;
 const x=v=>left+(v-minX)/(maxX-minX)*(right-left);
 const y=v=>bottom-(v-minY)/(maxY-minY)*(bottom-top);
 svg.append(svgNode('line',{x1:left,y1:bottom,x2:right,y2:bottom,stroke:'currentColor','stroke-opacity':0.5}));
 svg.append(svgNode('line',{x1:left,y1:top,x2:left,y2:bottom,stroke:'currentColor','stroke-opacity':0.5}));
 for(let i=0;i<=4;i++){
  const value=minY+(maxY-minY)*i/4,yy=y(value);
  svg.append(svgNode('line',{x1:left,y1:yy,x2:right,y2:yy,stroke:'currentColor','stroke-opacity':0.12}));
  svg.append(svgNode('text',{x:left-8,y:yy+4,'text-anchor':'end','font-size':11,fill:'currentColor'},value.toFixed(1)));
 }
 return {x,y,top,bottom};
}
function chart(title,data,{valueX,valueY,extraY,marks=[],yMin,yMax,xLabel,yLabel}){
 const w=720,h=270;
 const svg=svgNode('svg',{viewBox:'0 0 '+w+' '+h,role:'img','aria-label':title});
 const xs=data.map(valueX),ys=data.flatMap(d=>extraY?[valueY(d),extraY(d)]:[valueY(d)]);
 const minX=Math.min(...xs),maxX=Math.max(...xs),lo=yMin??Math.min(...ys),hi=yMax??Math.max(...ys);
 const {x,y,top,bottom}=drawAxes(svg,w,h,{minX,maxX,minY:lo,maxY:hi});
 for(const mark of marks){
  const xx=x(mark.distance);
  svg.append(svgNode('line',{x1:xx,y1:top,x2:xx,y2:bottom,stroke:'currentColor','stroke-opacity':0.17,'stroke-dasharray':'3 5'}));
  svg.append(svgNode('text',{x:xx,y:bottom+18,fill:'currentColor','font-size':12,'text-anchor':'middle'},mark.label));
 }
 const renderLine=(fn,color)=>{
  const points=data.map(p=>x(valueX(p)).toFixed(2)+','+y(fn(p)).toFixed(2)).join(' ');
  svg.append(svgNode('polyline',{points,fill:'none',stroke:color,'stroke-width':2.2,'stroke-linecap':'round','stroke-linejoin':'round'}));
 };
 renderLine(valueY,'#2276b8');if(extraY)renderLine(extraY,'#d28b45');
 svg.append(svgNode('text',{x:15,y:16,'font-size':11,fill:'currentColor'},yLabel));
 svg.append(svgNode('text',{x:w-12,y:h-8,'text-anchor':'end','font-size':11,fill:'currentColor'},xLabel));
 return svg;
}
function numeric(root,id){const value=Number($(root,id).value);if(!Number.isFinite(value))throw Error('Sayısal parametre geçersiz: '+id);return value;}
function csv(rows){return rows.map(row=>row.map(x=>typeof x==='number'?Number(x).toPrecision(12):String(x)).join(',')).join('\n')+'\n';}
function saveCsv(filename,content){
 const url=URL.createObjectURL(new Blob([content],{type:'text/csv;charset=utf-8'}));
 const anchor=document.createElement('a');anchor.href=url;anchor.download=filename;
 document.body.append(anchor);anchor.click();anchor.remove();setTimeout(()=>URL.revokeObjectURL(url),0);
}
function finiteXyz(structure){
 if(!structure||!Array.isArray(structure.cell)||structure.cell.length!==3||!Array.isArray(structure.atoms))throw Error('Aktif hücre verileri okunamadı.');
 if(structure.atoms.length===0||structure.atoms.length>24)throw Error('GANSU aktarımı için 1–24 atomlu bir sonlu küme seçin.');
 const rows=[];
 for(const atom of structure.atoms){
  const f=atom.fractional;
  if(!/^[A-Z][a-z]?$/.test(atom.element)||!Array.isArray(f)||f.length!==3||!f.every(Number.isFinite))
   throw Error('XYZ için geçerli element ve kesirli koordinat gerekli.');
  if(!['H','He','Li','Be','B','C','N','O','F','Ne','Na','Mg','Al','Si','P','S','Cl','Ar'].includes(atom.element))
   throw Error('H–Ar dışındaki atomların baz seti doğrulanmadı. Bu geçiş Ni ve ağır elementler için devre dışıdır.');
  const coords=[0,1,2].map(i=>f.reduce((s,v,j)=>s+v*structure.cell[j][i],0));
  if(!coords.every(Number.isFinite))throw Error('XYZ koordinatları sonlu değil.');
  rows.push(atom.element+' '+coords.map(v=>v.toFixed(8)).join(' '));
 }
 return rows.length+'\nActive unit cell as FINITE cluster (not periodic; unpassivated)\n'+rows.join('\n');
}
export function initBrowserDftLab({root,getStructure}){
 if(!root||typeof getStructure!=='function')throw Error('DFT tarayıcı laboratuvarı başlatılamadı.');
 const xyz=$ (root,'browserDftXyz'),xyzStatus=$(root,'browserDftXyzStatus');
 let bands=null,dos=null,sourceLabel='Demonstrasyon: ideal grafen';
 function xyzRefresh(){
  const choice=$(root,'browserDftXyzSource').value;
  if(choice==='active'){
   if(!$(root,'browserDftClusterConsent').checked){
    xyz.value='';xyzStatus.textContent='Aktif periyodik hücreyi sonlu molekül gibi ele almak için onay kutusunu işaretleyin.';return;
   }
   try{xyz.value=finiteXyz(getStructure());xyzStatus.textContent='Sonlu XYZ oluşturuldu. Periyodik bağlar kesilir; atom uçları pasifleştirilmez. GANSU içinde uygun yük, spin ve baz seçin.';}
   catch(error){xyz.value='';xyzStatus.textContent=error.message;}
  }else{xyz.value=PRESETS[choice]||PRESETS.h2;xyzStatus.textContent='Bu örnek moleküldür; gerçek DFT hesabını GANSU Lite uygulamasında ayrıca başlatmanız gerekir.';}
 }
 $(root,'browserDftXyzSource').onchange=xyzRefresh;
 $(root,'browserDftClusterConsent').onchange=xyzRefresh;
 $(root,'browserDftXyzCopy').onclick=async()=>{
  try{
   if(!xyz.value.trim())throw Error('Önce geçerli XYZ hazırlayın.');
   if(!navigator.clipboard?.writeText)throw Error('Güvenli pano API erişimi yok. XYZ alanından elle kopyalayabilirsiniz.');
   await navigator.clipboard.writeText(xyz.value);
   xyzStatus.textContent='XYZ panoya kopyalandı. GANSU Lite uygulamasında XYZ girdisine yapıştırın ve yöntemi seçerek hesabı başlatın.';
  }catch(error){xyzStatus.textContent=error.message;xyz.focus();xyz.select();}
 };
 $(root,'browserDftGansuOpen').href=GANSU_URL;
 const tbStatus=$(root,'browserTbStatus');
 const bandHost=$(root,'browserTbBands'),dosHost=$(root,'browserTbDos');
 function calculate(){
  tbStatus.textContent='Hesaplanıyor…';
  bandHost.replaceChildren();dosHost.replaceChildren();
  bands=null;dos=null;$(root,'browserTbCsvBands').disabled=true;$(root,'browserTbCsvDos').disabled=true;
  try{
   const active=$(root,'browserTbSource').value==='active';
   const source=active?getStructure():GRAPHENE_DEMO,model=grapheneGeometry(source);
   const hopping=numeric(root,'browserTbHopping'),mesh=numeric(root,'browserTbMesh'),sigma=numeric(root,'browserTbSigma');
   bands=grapheneBands(model,{hopping,steps:50});
   dos=grapheneDos(model,{hopping,mesh,sigma});
   const span=3*hopping+0.6;
   bandHost.append(chart('Grafen π bant modeli, DFT değil',bands.points,{
    valueX:p=>p.distance,valueY:p=>p.energies[0],extraY:p=>p.energies[1],
    marks:bands.marks,yMin:-span,yMax:span,xLabel:'k yolu (Å⁻¹)',yLabel:'Enerji (eV)'}));
   const top=Math.max(...dos.points.map(p=>p.density))*1.08;
   dosHost.append(chart('Grafen π durum yoğunluğu, DFT değil',dos.points,{
    valueX:p=>p.energy,valueY:p=>p.density,yMin:0,yMax:top,
    xLabel:'Enerji (eV)',yLabel:'DOS (durum/eV/hücre/spin)'}));
   sourceLabel=active?'Aktif yapı (grafen ilkel hücresi)':'Demonstrasyon: ideal grafen';
   tbStatus.textContent=sourceLabel+' · C–C '+model.bondLength.toFixed(4)+' Å · t '+hopping.toFixed(2)+
    ' eV · K noktasında bant ayrımı '+bands.diracGap.toExponential(2)+' eV · spin başına iki π bant. Parametreli TB; DFT/SCF değildir.';
   $(root,'browserTbCsvBands').disabled=false;$(root,'browserTbCsvDos').disabled=false;
  }catch(error){tbStatus.textContent='Hesap başlatılmadı: '+error.message;}
 }
 $(root,'browserTbRun').onclick=calculate;
 $(root,'browserTbCsvBands').onclick=()=>{
  if(!bands)return;
  saveCsv('graphene-tb-bands.csv','# model: nearest-neighbor pz TB, not DFT\n# source: '+sourceLabel+'\n'+
   csv([['k_distance_inv_angstrom','k_fractional_x','k_fractional_y','valence_eV','conduction_eV'],
   ...bands.points.map(p=>[p.distance,...p.k,...p.energies])]));
 };
 $(root,'browserTbCsvDos').onclick=()=>{
  if(!dos)return;
  saveCsv('graphene-tb-dos.csv','# model: graphene pz TB, states/(eV cell spin), not DFT\n# source: '+sourceLabel+'\n'+
   csv([['energy_eV','states_per_eV_cell_spin'],...dos.points.map(p=>[p.energy,p.density])]));
 };
 xyzRefresh();calculate();
 return {recalculate:calculate};
}
