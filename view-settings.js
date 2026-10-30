/* Scene appearance and crystallographic viewing helpers: view directions
 * along lattice vectors or plane normals, background / depth cueing /
 * lighting settings, display radius sets and colour schemes.
 * Plain arrays and numbers only; the editor applies them to Three.js. */
import {ELEMENT_DATA} from './element-data.js';

const dot=(u,v)=>u[0]*v[0]+u[1]*v[1]+u[2]*v[2];
const cross=(u,v)=>[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
const scale=(u,s)=>u.map(x=>x*s);
const add=(u,v)=>u.map((x,i)=>x+v[i]);
const norm=u=>Math.sqrt(dot(u,u));
const unit=u=>{const n=norm(u);if(!(n>1e-12))throw Error('Bakış yönü sıfır uzunlukta.');return scale(u,1/n);};

/** Reciprocal basis a*, b*, c* (without 2π) of Cartesian direct vectors. */
export function reciprocalBasis([a,b,c]){
 const volume=dot(a,cross(b,c));
 if(!(Math.abs(volume)>1e-12))throw Error('Tekil örgü matrisi.');
 return [scale(cross(b,c),1/volume),scale(cross(c,a),1/volume),scale(cross(a,b),1/volume)];
}

/** Unit view direction and screen-up vector for a crystallographic direction.
 * kind 'direct': [uvw] = u a + v b + w c; kind 'reciprocal': normal of (hkl)
 * = h a* + k b* + l c*. The direction points toward the viewer, so the named
 * axis comes out of the screen. Up is c (or b when c is nearly parallel)
 * projected onto the screen plane, as in common structure drawings. */
export function crystallographicView(basis,indices,kind='direct'){
 if(!Array.isArray(indices)||indices.length!==3||indices.some(v=>!Number.isFinite(v)))throw Error('Doğrultu indisleri üç sonlu sayı olmalı.');
 if(indices.every(v=>v===0))throw Error('Doğrultu indislerinin hepsi sıfır olamaz.');
 if(!['direct','reciprocal'].includes(kind))throw Error('Doğrultu türü geçersiz.');
 const frame=kind==='direct'?basis:reciprocalBasis(basis);
 const direction=unit(frame.reduce((sum,v,i)=>add(sum,scale(v,indices[i])),[0,0,0]));
 let up=null,upAxis='';
 for(const [name,axis] of [['c',basis[2]],['b',basis[1]],['a',basis[0]]]){
  const along=unit(axis),projected=add(along,scale(direction,-dot(along,direction)));
  if(norm(projected)>.15){up=unit(projected);upAxis=name;break;}
 }
 return {direction,up,upAxis};
}

/** Rotate vector v about unit axis by angle (degrees), Rodrigues formula. */
export function rotateVector(v,axis,degrees){
 const k=unit(axis),t=degrees*Math.PI/180,c=Math.cos(t),s=Math.sin(t);
 return add(add(scale(v,c),scale(cross(k,v),s)),scale(k,dot(k,v)*(1-c)));
}

/* ---- Appearance ------------------------------------------------------- */

// Defaults reproduce the original scene exactly: white stage, no fog, a
// hemisphere light of 1.15 and a key light of 2.15 from (8, -13, 18).
export const DEFAULT_VIEW_SETTINGS=Object.freeze({
 background:'#ffffff',depthCue:Object.freeze({enabled:false,start:.35,end:1}),
 light:Object.freeze({ambient:1.15,key:2.15,azimuth:Math.atan2(-13,8)*180/Math.PI,elevation:Math.atan2(18,Math.hypot(8,13))*180/Math.PI}),
 cell:Object.freeze({color:'#546a7c',dashed:false})
});
const hex=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
const within=(value,low,high)=>Number.isFinite(value)&&value>=low&&value<=high;
/** Validated copy of saved view settings; unknown or invalid values fall back to defaults. */
export function normalizedViewSettings(input){
 const d=DEFAULT_VIEW_SETTINGS,v=input&&typeof input==='object'?input:{};
 const fog=v.depthCue&&typeof v.depthCue==='object'?v.depthCue:{},light=v.light&&typeof v.light==='object'?v.light:{},cell=v.cell&&typeof v.cell==='object'?v.cell:{};
 const start=within(fog.start,0,1)?fog.start:d.depthCue.start,end=within(fog.end,0,1)?fog.end:d.depthCue.end;
 return {
  background:hex(v.background)?v.background.toLowerCase():d.background,
  depthCue:{enabled:fog.enabled===true,start:Math.min(start,end-.01),end:Math.max(end,start+.01)},
  light:{ambient:within(light.ambient,0,4)?light.ambient:d.light.ambient,key:within(light.key,0,6)?light.key:d.light.key,
   azimuth:within(light.azimuth,-180,180)?light.azimuth:d.light.azimuth,elevation:within(light.elevation,-90,90)?light.elevation:d.light.elevation},
  cell:{color:hex(cell.color)?cell.color.toLowerCase():d.cell.color,dashed:cell.dashed===true}
 };
}
/** Key light direction (unit, world frame) from azimuth/elevation in degrees. */
export function lightDirection({azimuth,elevation}){
 const a=azimuth*Math.PI/180,e=elevation*Math.PI/180;
 return [Math.cos(e)*Math.cos(a),Math.cos(e)*Math.sin(a),Math.sin(e)];
}
/** Linear depth cue: 0 in front of start, 1 beyond end. start/end are
 * fractions of the scene depth [near, far] seen by the camera. */
export function depthCueFactor(depth,near,far,{start,end}){
 const a=near+(far-near)*start,b=near+(far-near)*end;
 return b>a?Math.max(0,Math.min(1,(depth-a)/(b-a))):0;
}
/** Black or white text, whichever contrasts more with the background. */
export function contrastingInk(background){
 const [r,g,b]=[1,3,5].map(i=>parseInt(background.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
 return .2126*r+.7152*g+.0722*b>.25?'#203047':'#f2f6fa';
}

/* ---- Radius sets and colour schemes ---------------------------------- */

export const RADIUS_SETS=['default','vdw','ionic'];
export const COLOR_SCHEMES=['app','jmol','cpk'];
export const ELEMENT_DATA_SOURCE=ELEMENT_DATA.source;
const ROMAN=['I','II','III','IV','V','VI','VII','VIII','IX','X','XI','XII','XIV'];
/** Shannon entries for an element: [{charge, coordination, spin, radius}]. */
export function shannonOptions(symbol){
 const table=ELEMENT_DATA.shannon[symbol]||{},options=[];
 for(const [charge,byCn] of Object.entries(table))for(const [coordination,bySpin] of Object.entries(byCn))
  for(const [spin,radius] of Object.entries(bySpin))options.push({charge:Number(charge),coordination,spin,radius});
 const order=cn=>{const i=ROMAN.indexOf(cn.replace(/[A-Z]{2}$/,''));return i<0?99:i;};
 return options.sort((a,b)=>a.charge-b.charge||order(a.coordination)-order(b.coordination)||a.coordination.localeCompare(b.coordination)||a.spin.localeCompare(b.spin));
}
/** Display radius in Å. The default set keeps the editor's covalent table.
 * vdW and ionic values never fall back silently: `fallback` says when the
 * default radius was used because the chosen table has no entry. */
export function displayRadius(symbol,set,defaultRadius,ionic={}){
 if(!RADIUS_SETS.includes(set))throw Error('Yarıçap seti geçersiz.');
 if(set==='vdw'){
  const r=ELEMENT_DATA.vdw[symbol];
  return r?{radius:r,fallback:false}:{radius:defaultRadius,fallback:true};
 }
 if(set==='ionic'){
  const choice=ionic[symbol];
  const r=choice&&ELEMENT_DATA.shannon[symbol]?.[String(choice.charge)]?.[choice.coordination]?.[choice.spin??''];
  return r?{radius:r,fallback:false}:{radius:defaultRadius,fallback:true};
 }
 return {radius:defaultRadius,fallback:false};
}
/** Element colour for a scheme, or null to use the editor's own table. */
export function schemeColor(symbol,scheme){
 if(!COLOR_SCHEMES.includes(scheme))throw Error('Renk şeması geçersiz.');
 return scheme==='app'?null:ELEMENT_DATA[scheme][symbol]||null;
}
/** Validated ionic radius choices: {El: {charge, coordination, spin}} that exist in the table. */
export function normalizedIonicChoices(input){
 const out={};
 if(!input||typeof input!=='object')return out;
 for(const [symbol,choice] of Object.entries(input)){
  if(!choice||typeof choice!=='object')continue;
  const spin=typeof choice.spin==='string'?choice.spin:'';
  if(ELEMENT_DATA.shannon[symbol]?.[String(choice.charge)]?.[choice.coordination]?.[spin]!==undefined)
   out[symbol]={charge:Number(choice.charge),coordination:String(choice.coordination),spin};
 }
 return out;
}
