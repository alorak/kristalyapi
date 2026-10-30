/* Pure helpers for publication image exports: text outlines, line occlusion
 * by atoms, sphere shading, PNG resolution metadata and TIFF LZW coding.
 * They take plain numbers and byte arrays and never touch the DOM. */
import {EXPORT_GLYPHS} from './export-glyphs.js';

/* ---- Text as vector outlines ------------------------------------------ */

const glyphCache=new Map();
function glyphCommands(style,char){
 const key=style+'\u0000'+char;
 if(glyphCache.has(key))return glyphCache.get(key);
 const font=EXPORT_GLYPHS[style],entry=font.glyphs[char]||font.glyphs['?'];
 const commands=[],tokens=entry[1].match(/[MLCZ]|-?\d+/g)||[];
 for(let i=0;i<tokens.length;){
  const op=tokens[i++],count={M:2,L:2,C:6,Z:0}[op];
  commands.push([op,...tokens.slice(i,i+count).map(Number)]);i+=count;
 }
 const glyph={advance:entry[0],commands};glyphCache.set(key,glyph);return glyph;
}

/** Outline commands for one line of text in screen coordinates (y down).
 * x is the anchor position and y the baseline, as for SVG text. */
export function textOutline(text,{x=0,y=0,size=12,bold=false,anchor='middle'}={}){
 if(!Number.isFinite(x)||!Number.isFinite(y)||!Number.isFinite(size)||size<=0)throw Error('Yazı konumu veya boyutu geçersiz.');
 const style=bold?'bold':'regular',font=EXPORT_GLYPHS[style],scale=size/font.unitsPerEm;
 const glyphs=[...String(text??'')].map(char=>glyphCommands(style,char));
 const width=glyphs.reduce((sum,glyph)=>sum+glyph.advance,0)*scale;
 let pen=x-(anchor==='middle'?width/2:anchor==='end'?width:0);
 const commands=[];
 for(const glyph of glyphs){
  for(const [op,...v] of glyph.commands){
   const points=[];for(let i=0;i<v.length;i+=2)points.push(pen+v[i]*scale,y-v[i+1]*scale);
   commands.push([op,...points]);
  }
  pen+=glyph.advance*scale;
 }
 return {width,commands};
}
const num=value=>{if(!Number.isFinite(value))throw Error('Vektör yazı koordinatı sonlu olmalı.');return String(Number(value.toFixed(3)));};
export function svgPathData(commands){
 return commands.map(([op,...v])=>op+v.map(num).join(' ')).join('');
}
export function pdfPathData(commands){
 const ops={M:'m',L:'l',C:'c',Z:'h'};
 return commands.map(([op,...v])=>[...v.map(num),ops[op]].join(' ')).join('\n');
}
export function postScriptPathData(commands){
 const ops={M:'moveto',L:'lineto',C:'curveto',Z:'closepath'};
 return commands.map(([op,...v])=>[...v.map(num),ops[op]].join(' ')).join('\n');
}

/* ---- Lines hidden inside or behind atoms ------------------------------ */

/** True when an atom sphere hides view-space point p from the camera.
 * View space looks down -z; perspective rays start at the origin. */
export function pointOccluded(p,spheres,perspective){
 for(const {center:c,radius:r} of spheres){
  if(perspective){
   const distance=Math.hypot(p[0],p[1],p[2]);if(!(distance>0))continue;
   const d=[p[0]/distance,p[1]/distance,p[2]/distance];
   const b=d[0]*c[0]+d[1]*c[1]+d[2]*c[2],cc=c[0]*c[0]+c[1]*c[1]+c[2]*c[2]-r*r,disc=b*b-cc;
   if(disc<0)continue;
   const near=b-Math.sqrt(disc);
   if(near>0&&near<distance-1e-6*Math.max(1,distance))return true;
  }else{
   const rho2=(p[0]-c[0])**2+(p[1]-c[1])**2;if(rho2>=r*r)continue;
   const front=c[2]+Math.sqrt(r*r-rho2);
   if(p[2]<front-1e-6*Math.max(1,Math.abs(front)))return true;
  }
 }
 return false;
}

/** Visible parameter intervals [s0,s1] of segment a→b (view space).
 * Samples the segment and refines each visibility change by bisection,
 * so bonds stop at atom surfaces and cell edges vanish behind atoms. */
export function visibleLineIntervals(a,b,spheres,{perspective=false,samples=24}={}){
 if(!spheres.length)return [[0,1]];
 const at=s=>[a[0]+(b[0]-a[0])*s,a[1]+(b[1]-a[1])*s,a[2]+(b[2]-a[2])*s];
 const hidden=s=>pointOccluded(at(s),spheres,perspective);
 const n=Math.max(2,Math.min(256,Math.round(samples)));
 const states=Array.from({length:n+1},(_,i)=>hidden(i/n));
 const edges=[];
 for(let i=0;i<n;i++){
  if(states[i]===states[i+1])continue;
  let lo=i/n,hi=(i+1)/n;
  for(let k=0;k<14;k++){const mid=(lo+hi)/2;if(hidden(mid)===states[i])lo=mid;else hi=mid;}
  edges.push((lo+hi)/2);
 }
 const intervals=[];let start=states[0]?null:0;
 for(const edge of edges){
  if(start===null)start=edge;
  else{intervals.push([start,edge]);start=null;}
 }
 if(start!==null)intervals.push([start,1]);
 return intervals.filter(([s0,s1])=>s1-s0>1e-6);
}

/* ---- Shaded spheres --------------------------------------------------- */

const channels=hex=>[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16));
const toHex=rgb=>'#'+rgb.map(v=>Math.max(0,Math.min(255,Math.round(v))).toString(16).padStart(2,'0')).join('');
export function mixHex(a,b,t){const x=channels(a),y=channels(b);return toHex(x.map((v,i)=>v+(y[i]-v)*t));}
/** One radial gradient for SVG, PDF and EPS spheres, so the formats match.
 * The light spot is opaque, so a sphere never shows what lies behind it. */
export const SPHERE_GRADIENT={cx:.32,cy:.26,r:.78,baseOffset:.36};
export function sphereShade(hex){
 if(!/^#[0-9a-f]{6}$/i.test(hex))throw Error('Küre rengi geçersiz.');
 const base=hex.toLowerCase();
 return {light:mixHex(base,'#ffffff',.72),base,dark:toHex(channels(base).map(v=>v*.65))};
}

/* ---- PNG physical resolution ------------------------------------------ */

const CRC_TABLE=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
export function crc32(bytes){let c=0xffffffff;for(const b of bytes)c=CRC_TABLE[(c^b)&255]^(c>>>8);return (c^0xffffffff)>>>0;}

/** Copy of a PNG with a pHYs chunk, so layout programs place it at its
 * real print size instead of assuming 72 or 96 DPI. */
export function pngWithDpi(png,dpi){
 if(!Number.isFinite(dpi)||dpi<1||dpi>10000)throw Error('PNG DPI değeri geçersiz.');
 const signature=[137,80,78,71,13,10,26,10];
 if(!(png instanceof Uint8Array)||png.length<33||signature.some((v,i)=>png[i]!==v))throw Error('Geçerli bir PNG dosyası gerekli.');
 const view=new DataView(png.buffer,png.byteOffset,png.byteLength),parts=[png.subarray(0,8)];
 const ppm=Math.round(dpi/0.0254),chunk=new Uint8Array(21),cv=new DataView(chunk.buffer);
 cv.setUint32(0,9);chunk.set([112,72,89,115],4);cv.setUint32(8,ppm);cv.setUint32(12,ppm);chunk[16]=1;
 cv.setUint32(17,crc32(chunk.subarray(4,17)));
 for(let at=8;at<png.length;){
  if(at+12>png.length)throw Error('PNG parçası kesik.');
  const length=view.getUint32(at),end=at+12+length;
  if(end>png.length)throw Error('PNG parçası kesik.');
  const type=String.fromCharCode(...png.subarray(at+4,at+8));
  if(type!=='pHYs')parts.push(png.subarray(at,end));
  if(type==='IHDR')parts.push(chunk);
  at=end;
 }
 const out=new Uint8Array(parts.reduce((s,p)=>s+p.length,0));let at=0;
 for(const part of parts){out.set(part,at);at+=part.length;}
 return out;
}

/* ---- TIFF LZW (compression 5) ----------------------------------------- */

/** TIFF 6.0 LZW, MSB-first codes, same code-width steps as libtiff. */
export function lzwEncode(input){
 if(!(input instanceof Uint8Array)&&!(input instanceof Uint8ClampedArray))throw Error('LZW girdisi bayt dizisi olmalı.');
 const CLEAR=256,EOI=257,FIRST=258,MAX=4095;
 const codes=new Uint16Array(4096*256),stamps=new Uint32Array(4096*256);
 let generation=1,out=new Uint8Array(Math.max(1024,input.length>>1)),length=0,buffer=0,bits=0,width=9,next=FIRST;
 const put=code=>{
  buffer=(buffer<<width)|code;bits+=width;
  while(bits>=8){
   if(length===out.length){const grown=new Uint8Array(out.length*2);grown.set(out);out=grown;}
   bits-=8;out[length++]=(buffer>>>bits)&255;
  }
  buffer&=(1<<bits)-1;
 };
 const grow=()=>{
  if(next===MAX-1){put(CLEAR);generation++;next=FIRST;width=9;}
  else if(next>(1<<width)-1)width++;
 };
 put(CLEAR);
 if(input.length){
  let prefix=input[0];
  for(let i=1;i<input.length;i++){
   const byte=input[i],key=(prefix<<8)|byte;
   if(stamps[key]===generation){prefix=codes[key];continue;}
   put(prefix);stamps[key]=generation;codes[key]=next++;grow();
   prefix=byte;
  }
  put(prefix);next++;grow();
 }
 put(EOI);
 if(bits>0){
  if(length===out.length){const grown=new Uint8Array(out.length+1);grown.set(out);out=grown;}
  out[length++]=(buffer<<(8-bits))&255;
 }
 return out.slice(0,length);
}
