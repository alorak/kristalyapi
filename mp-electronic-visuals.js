/* Materials Project chart-only helpers. Do not alter numerical source data.
 * Shared visible ENERGY window is a view convenience, not source alignment:
 * band and DOS each subtract their own reported Fermi energy. */
export const MP_ENERGY_WINDOWS=Object.freeze({
 near:[-3,3],standard:[-6,6],wide:[-12,12]
});
const finite=n=>typeof n==='number'&&Number.isFinite(n);
export function mpVisibleEnergyWindow(result,option='standard'){
 if(Object.hasOwn(MP_ENERGY_WINDOWS,option))return [...MP_ENERGY_WINDOWS[option]];
 if(option!=='full')throw Error('MP energy viewport unknown.');
 let min=0,max=0;
 if(result.band)for(const rows of Object.values(result.band.spins))
  for(const band of rows)for(const absolute of band){
   const value=absolute-result.band.efermi;
   min=Math.min(min,value);max=Math.max(max,value);
  }
 if(result.dos)for(const absolute of result.dos.energy){
  const value=absolute-result.dos.efermi;
  min=Math.min(min,value);max=Math.max(max,value);
 }
 const pad=Math.max((max-min)*0.03,0.25);
 return [min-pad,max+pad];
}
export function mpCumulativeDos(energies,states){
 if(!Array.isArray(energies)||!Array.isArray(states)||energies.length!==states.length||energies.length<2)
  throw Error('MP integral DOS: enerji yoğunluk dizileri uyuşmuyor.');
 const result=[0];
 for(let i=1;i<energies.length;i++){
  const delta=energies[i]-energies[i-1];
  if(!finite(delta)||delta<=0||!finite(states[i])||!finite(states[i-1])||
    states[i]<0||states[i-1]<0)throw Error('MP integral DOS: geçersiz nokta.');
  result.push(result[i-1]+delta*(states[i-1]+states[i])/2);
 }
 return result;
}
export function mpVisibleDensityMax(energy,values,range){
 let max=0;
 for(let i=0;i<energy.length;i++)if(energy[i]>=range[0]&&energy[i]<=range[1])
  max=Math.max(max,values[i]);
 return max>0?max*1.07:1;
}
export function mpFermiMarker(svg,range){
 if(!(range[0]<0&&range[1]>0))return svg;
 const viewBox=svg.getAttribute('viewBox')?.split(/\s+/).map(Number);
 if(!viewBox||viewBox.length!==4||!viewBox.every(finite))throw Error('MP Fermi chart geometry invalid.');
 const width=viewBox[2],height=viewBox[3];
 // QE generic SVG chart uses left 57, right 12, top 18, bottom 42;
 // marker drawn only in MP charts and never changes the QE renderer.
 const left=57,right=12,top=18,bottom=42;
 const zero=top+(range[1]/(range[1]-range[0]))*(height-top-bottom);
 const ns='http://www.w3.org/2000/svg';
 const line=document.createElementNS(ns,'line');
 for(const [name,value] of Object.entries({
  x1:left,y1:zero,x2:width-right,y2:zero,stroke:'#b45309',
  'stroke-width':1.5,'stroke-dasharray':'6 4','data-mp-fermi':'true'
 }))line.setAttribute(name,String(value));
 svg.append(line);
 const label=document.createElementNS(ns,'text');
 for(const [name,value] of Object.entries({
  x:width-right-2,y:Math.max(top+12,zero-6),'text-anchor':'end',
  'font-size':11,fill:'#b45309','data-font':11
 }))label.setAttribute(name,String(value));
 label.textContent='E_F = 0 eV';
 svg.append(label);
 return svg;
}
