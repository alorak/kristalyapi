/* P0 conservative 2theta peak POSITION screening, NOT a phase or refinement tool.
 * No wavelength verification, background modeling, instrument deconvolution,
 * intensity-fit or automatic acceptance decision. */
const ok=n=>typeof n==='number'&&Number.isFinite(n);
export function measuredPeaks(rows,{minimumRelative=8,minimumProminence=4,windowSamples=16,maxPeaks=300}={}){
 if(!Array.isArray(rows)||rows.length<3||rows.length>300000)throw Error('Measured scan requires 3–300000 samples.');
 if(![minimumRelative,minimumProminence].every(x=>ok(x)&&x>=0&&x<=100)||
  !Number.isInteger(windowSamples)||windowSamples<2||windowSamples>100||
  !Number.isInteger(maxPeaks)||maxPeaks<1||maxPeaks>1000)throw Error('Invalid peak extraction parameters.');
 let max=0,last=-Infinity;
 for(const row of rows){
  if(!row||!ok(row.angle)||!ok(row.intensity)||row.intensity<0||row.angle<=last)
   throw Error('Measured angles must increase strictly with finite nonnegative intensities.');
  max=Math.max(max,row.intensity);last=row.angle;
 }
 if(max<=0)return [];
 const peaks=[];
 for(let i=1;i<rows.length-1;i++){
  const y=rows[i].intensity;
  if(y<=rows[i-1].intensity||y<rows[i+1].intensity||y/max*100<minimumRelative)continue;
  let left=y,right=y;
  for(let j=Math.max(0,i-windowSamples);j<i;j++)left=Math.min(left,rows[j].intensity);
  for(let j=i+1;j<=Math.min(rows.length-1,i+windowSamples);j++)right=Math.min(right,rows[j].intensity);
  const prominence=(y-Math.max(left,right))/max*100;
  if(prominence<minimumProminence)continue;
  peaks.push({angle:rows[i].angle,relative:Number((y/max*100).toFixed(5)),
   prominence:Number(prominence.toFixed(5)),sample:i});
 }
 return peaks.sort((a,b)=>b.prominence-a.prominence||b.relative-a.relative||a.angle-b.angle)
  .slice(0,maxPeaks).sort((a,b)=>a.angle-b.angle);
}
export function matchPowderPeaks(groups,rows,{toleranceDeg=.2,minimumRelative=8,minimumProminence=4,windowSamples=16}={}){
 if(!Array.isArray(groups)||groups.length>10000||
  groups.some(g=>!g||!ok(g.angle)||!ok(g.relative)||g.angle<0||g.relative<0))
  throw Error('Invalid theoretical peak list.');
 if(!ok(toleranceDeg)||toleranceDeg<=0||toleranceDeg>2)throw Error('Tolerance must be > 0 and ≤ 2°.');
 const measured=measuredPeaks(rows,{minimumRelative,minimumProminence,windowSamples});
 // Strong modeled reflections select their nearest remaining measured peak first.
 const candidates=groups.map((g,i)=>({index:i,angle:g.angle,relative:g.relative,hkl:Array.isArray(g.hkl)?g.hkl.join(' '):''}))
  .filter(g=>g.relative>=minimumRelative).sort((a,b)=>b.relative-a.relative||a.angle-b.angle);
 const used=new Set(),matches=[],unmatchedModel=[];
 for(const model of candidates){
  let best=-1,delta=Infinity;
  measured.forEach((peak,j)=>{
   if(used.has(j))return;
   const d=Math.abs(peak.angle-model.angle);
   if(d<=toleranceDeg && d<delta){best=j;delta=d;}
  });
  if(best<0){unmatchedModel.push(model);continue;}
  used.add(best);
  matches.push({model,measured:measured[best],deltaDeg:Number((measured[best].angle-model.angle).toFixed(6))});
 }
 return {toleranceDeg,minimumRelative,minimumProminence,windowSamples,
  measuredPeaks:measured.length,modelPeaks:candidates.length,
  matches:matches.sort((a,b)=>a.model.angle-b.model.angle),
  unmatchedModel:unmatchedModel.sort((a,b)=>a.angle-b.angle),
  unmatchedMeasured:measured.filter((_,j)=>!used.has(j))};
}
export function matchReportCsv(report,{wavelengthA='',measurementName=''}={}){
 const quote=v=>{
  const raw=String(v??'');
  const safe=typeof v==='string'&&/^[=+@-]/.test(raw.trimStart())?"'"+raw:raw;
  return '"'+safe.replace(/"/g,'""')+'"';
 };
 const data=[['Status','hkl','model_2theta_deg','model_relative_pct','measured_2theta_deg','measured_relative_pct','delta_2theta_deg','wavelength_A_user_entered','measurement_file']];
 const add=(status,model,measured,delta)=>data.push([status,model?.hkl??'',model?.angle??'',model?.relative??'',
  measured?.angle??'',measured?.relative??'',delta??'',wavelengthA,measurementName]);
 for(const m of report.matches)add('matched',m.model,m.measured,m.deltaDeg);
 for(const model of report.unmatchedModel)add('model_unmatched',model);
 for(const measured of report.unmatchedMeasured)add('observed_unmatched',null,measured);
 return '# Screening only: model and scan wavelength/geometry compatibility were confirmed by user; no phase identification, calibration or Rietveld fit.\n'+
  data.map(row=>row.map(quote).join(',')).join('\n')+'\n';
}
