/*
 * MoS2/ACS Nano (2022) geometry preflight, not a DFT or optical simulator.
 * Scientific reference: https://doi.org/10.1021/acsnano.2c09209
 * Input sites must be explicit P1 atoms, never unexpanded CIF asymmetric sites.
 */

const PAPER_DOI = '10.1021/acsnano.2c09209';
const PAPER_TITLE = 'Utilizing Ultraviolet Photons to Generate Single-Photon Emitters in Semiconductor Monolayers';

function countMoPlanes(sites,cLength,tolerance=0.7){
  const positions=sites.filter(site=>site.symbol==='Mo')
    .map(site=>site.z*cLength).sort((a,b)=>a-b);
  if(!positions.length)return 0;
  let count=1;
  for(let i=1;i<positions.length;i++){
    if(positions[i]-positions[i-1]>tolerance)count++;
  }
  const wrappedGap=positions[0]+cLength-positions[positions.length-1];
  if(count>1&&wrappedGap<=tolerance)count--;
  return count;
}

function maxPeriodicGap(sites,cLength){
  if(!sites.length)return null;
  const sorted=sites.map(site=>site.z).sort((a,b)=>a-b);
  let largest=sorted[0]+1-sorted[sorted.length-1];
  for(let i=1;i<sorted.length;i++)largest=Math.max(largest,sorted[i]-sorted[i-1]);
  return largest*cLength;
}

/**
 * This is a *geometry preflight*. It cannot establish chemical adsorption,
 * relaxation, charge state, defect stability, optical emission or vacuum UV.
 * Only orthogonal a/b-to-c geometries permit the approximate gap estimate.
 */
export function analyzeMos2Structure({cell,sites,explicitP1=false,nonPeriodic=false}={}){
  const errors=[],warnings=[];
  if(!cell||!['a','b','c','alpha','beta','gamma'].every(k=>Number.isFinite(Number(cell[k]))))
    errors.push('Tam hücre metrikleri (a, b, c, alpha, beta, gamma) gerekli.');
  else if([cell.a,cell.b,cell.c].some(n=>Number(n)<=0))
    errors.push('Hücre uzunlukları pozitif olmalı.');
  if(!Array.isArray(sites)||!sites.length||sites.length>1000)
    errors.push('1–1000 açık atom konumu gerekli.');
  const atoms=Array.isArray(sites)?sites:[];
  if(atoms.some(a=>!a||typeof a.symbol!=='string'||!['x','y','z'].every(k=>Number.isFinite(Number(a[k]))&&Number(a[k])>=0&&Number(a[k])<1)))
    errors.push('Atom türleri ve 0 ≤ kesirli koordinatlar < 1 doğrulanmalı.');
  if(atoms.some(a=>!Number.isFinite(Number(a.occupancy??1))||Math.abs(Number(a.occupancy??1)-1)>1e-9))
    errors.push('Kısmi/karışık konum dolulukları bu ön denetimde desteklenmiyor.');

  const counts={};
  for(const atom of atoms){
    if(atom&&typeof atom.symbol==='string')counts[atom.symbol]=(counts[atom.symbol]||0)+1;
  }
  const mo=counts.Mo||0,s=counts.S||0,o=counts.O||0,other=Object.keys(counts).filter(k=>!['Mo','S','O'].includes(k));
  if(!mo)warnings.push('Mo atomu yok; bu yapı MoS₂ modeli olarak sınıflandırılamaz.');
  if(other.length)warnings.push('Ek elementler ('+other.join(', ')+') var; hBN heteroyapısı ve diğer katkılar ayrı modelleme gerektirir.');
  if(!explicitP1)warnings.push('Önce simetriyi ve görüntüleme tekrarlarını açık P1 atomlarına dönüştürün.');
  if(nonPeriodic)warnings.push('Bu analiz periyodik 2B süperhücre varsayar; periyodik olmayan model desteklenmez.');

  const deficit=2*mo-s;
  let candidate='unknown',candidateLabel='Stokiyometriden sınıflandırılamıyor';
  if(mo>0&&!other.length){
    if(deficit===0&&o===0){candidate='pristine';candidateLabel='Kusursuz MoS₂ (stokiyometrik aday)';}
    else if(deficit===1&&o===0){candidate='V_S';candidateLabel='Tek S boşluğu adayı (V_S)';}
    else if(deficit===2&&o===0){candidate='V_2S';candidateLabel='İki S boşluğu adayı (V_2S; komşuluk doğrulanmadı)';}
    else if(deficit===1&&o===1){candidate='O_S';candidateLabel='O ikamesi adayı (O_S; bağlanma doğrulanmadı)';}
    else if(deficit===1&&o===2){candidate='O2_at_VS_candidate';candidateLabel='S boşluğu + iki O adayı (O₂ adsorpsiyonu doğrulanmadı)';}
  }
  if(deficit<0)warnings.push('S sayısı 2×Mo değerinden fazla; standart MoS₂ kusur seti dışında.');
  if(candidate==='unknown')warnings.push('Kusur türü yalnız atom sayısından kesin belirlenemez; atomik komşuluk ve başlangıç yapısı kaydı gerekir.');
  if(['O_S','O2_at_VS_candidate'].includes(candidate))
    warnings.push('Oksijen ikamesi ve O₂ kemisorpsiyonu farklı fiziksel modellerdir; stokiyometri kimyasal bağı doğrulamaz.');
  if(candidate==='V_2S')
    warnings.push('İki boşluğun komşu mu uzak mı olduğu bu kontrolde doğrulanmaz.');

  let moPlanes=null,gapAngstrom=null,cellAligned=false;
  if(!errors.length){
    cellAligned=Math.abs(Number(cell.alpha)-90)<=2&&Math.abs(Number(cell.beta)-90)<=2;
    if(cellAligned){
      const clean=atoms.map(a=>({symbol:a.symbol,z:Number(a.z)}));
      moPlanes=countMoPlanes(clean,Number(cell.c));
      gapAngstrom=maxPeriodicGap(clean,Number(cell.c));
      if(moPlanes!==1)warnings.push('Bir Mo düzlemi bulunmadı; çok katmanlı/yığılmış ya da bozulmuş yapı olabilir.');
      if(gapAngstrom<15)warnings.push('c yönündeki en büyük periyodik atomsuz aralık 15 Å altında: 2B vakum yakınsaması kontrol edilmeli.');
    }else{
      warnings.push('c ekseni ab düzlemine dik değil; basitleştirilmiş düzlem/vakum testi uygulanamaz.');
    }
  }
  const geometryReady=!errors.length&&Boolean(explicitP1)&&!nonPeriodic&&mo>0&&other.length===0&&candidate!=='unknown'&&cellAligned&&moPlanes===1&&gapAngstrom>=15;
  warnings.push('Bu yalnız geometri ön denetimidir; pseudopotansiyel, k-ağı, cutoff, spin, DFT yakınsaması ve deneysel UV vakumu kontrol edilmedi.');
  return {
    kind:'geometry-preflight',paperDoi:PAPER_DOI,counts,moCount:mo,sCount:s,oCount:o,
    sulfurDeficit:mo>0?deficit:null,candidate,candidateLabel,moPlanes,
    largestPeriodicEmptyGapAngstrom:gapAngstrom===null?null:Number(gapAngstrom.toFixed(3)),
    approximateCNormal:cellAligned,geometryReady,errors,warnings
  };
}

export function createMos2StudyManifest(model){
  const analysis=analyzeMos2Structure(model);
  if(analysis.errors.length)throw Error(analysis.errors.join(' '));
  const sites=model.sites.map(atom=>({
    symbol:atom.symbol,x:Number(atom.x),y:Number(atom.y),z:Number(atom.z),
    occupancy:Number(atom.occupancy??1)
  }));
  return {
    schema:'kristalyapi.mos2-defect-preflight.v1',
    reference:{doi:PAPER_DOI,title:PAPER_TITLE,figure:'Figure 4 (atomic models, bands and PDOS)'},
    name:String(model.name||'MoS2 study').slice(0,160),
    cell:Object.fromEntries(['a','b','c','alpha','beta','gamma'].map(k=>[k,Number(model.cell[k])])),
    sites,analysis,
    calculation:{performed:false,solver:null,relaxation:null,bands:null,pdos:null,opticalTransitions:null},
    experiment:{performed:false,uvIrradiation:false,photoluminescence:false,photonAntibunching:false},
    limitations:[
      'This is not a KristalYapı project JSON or DFT input file.',
      'Stoichiometry does not establish vacancy adjacency or O2 chemisorption.',
      'Simulation-cell vacuum is not physical UV irradiation in experimental vacuum.',
      'No prediction or proof of single-photon emission is provided.'
    ]
  };
}
