/* Structure exporters for SHELX .res, CASTEP .cell, Quantum ESPRESSO pw.x
 * input, XSF and magnetic CIF (P1). Each returns the file text and the list
 * of things the format could not carry ("losses"), which are also written
 * into the file as comments. Plain data in, text out; no DOM.
 *
 * model: {name, cell:{a,b,c,alpha,beta,gamma}, basis:[a,b,c] (Cartesian Å,
 * editor convention), sites:[{symbol,label,x,y,z,occupancy,uIso?,adp?,
 * magneticMoment?,disorderGroup?}], symmetry:{pairs:[[op,shift]...],name}
 * or null, nonPeriodic:boolean}. Sites are the asymmetric unit when
 * symmetry is given, otherwise every atom of the cell. */
import {parseSymop,formatSymop} from './geometry-table.js';
import {ELEMENT_DATA} from './element-data.js';

const LOSS={
 wavelength:['SHELX CELL dalga boyu bilinmiyor; 0.71073 Å (Mo Kα) yazıldı.','CELL wavelength unknown; 0.71073 A (Mo K-alpha) written.'],
 zerr:['Z ve hücre s.u. değerleri bilinmiyor; ZERR 1 ve sıfır s.u. yazıldı.','Z and cell s.u. unknown; ZERR 1 with zero s.u. written.'],
 uiso:['Uiso değeri olmayan atomlara 0.05 Å² yazıldı.','Atoms without Uiso were written with 0.05 A^2.'],
 labels:['SHELX atom adları en çok 4 karakter; bazı etiketler kısaltıldı.','SHELX atom names are at most 4 characters; some labels were shortened.'],
 disorder:['Düzensizlik grupları (PART) aktarılmadı.','Disorder groups (PART) were not written.'],
 magnetic:['Manyetik momentler bu biçime aktarılmadı.','Magnetic moments were not written.'],
 p1:['Simetri P1 olarak yazıldı; tüm atomlar açık listede.','Symmetry written as P1 with every atom listed.'],
 centring:['Merkezleme SHELX LATT türlerine uymadı; yapı P1 olarak yazıldı.','Centring does not match a SHELX LATT type; structure written as P1.'],
 adp:['Anizotropik ADP bu biçime aktarılmadı.','Anisotropic ADPs were not written.'],
 occupancy:['XSF doluluk taşımaz; kısmi dolu atomlar tam atom olarak yazıldı.','XSF has no occupancy; partially occupied atoms were written as full atoms.'],
 qePlaceholders:['Psödopotansiyel adları, ecutwfc/ecutrho ve k-noktası örgüsü yer tutucudur; hesaptan önce değiştirin.','Pseudopotential names, ecutwfc/ecutrho and the k-point mesh are placeholders; set them before running.'],
 castepPlaceholders:['Yalnız yapı yazıldı; hesap ayarları (.param) ve psödopotansiyeller ayrıca gerekir.','Only the structure was written; calculation settings (.param) and pseudopotentials are needed separately.'],
 molecule:['Periyodik olmayan yapı XSF ATOMS (molekül) olarak yazıldı.','Non-periodic structure written as an XSF ATOMS (molecule) block.']
};
const loss=key=>({code:key,tr:LOSS[key][0],en:LOSS[key][1]});
const f=(v,d=6)=>{if(!Number.isFinite(v))throw Error('Dışa aktarılacak sayı sonlu olmalı.');return (Math.abs(v)<10**-d?0:v).toFixed(d);};
const wrap=v=>{const w=v-Math.floor(v);return w>1-1e-9?0:w;};
const cartesian=(basis,p)=>[0,1,2].map(k=>p[0]*basis[0][k]+p[1]*basis[1][k]+p[2]*basis[2][k]);
const atomicNumber=symbol=>{const z=ELEMENT_DATA.symbols.indexOf(symbol)+1;if(z<1)throw Error('Element tanınmadı: '+symbol);return z;};

function validate(model){
 if(!model||!Array.isArray(model.sites)||!model.sites.length)throw Error('Dışa aktarılacak atom yok.');
 if(model.sites.length>5000)throw Error('Dışa aktarma en çok 5000 atom içindir.');
 for(const s of model.sites){
  if(![s.x,s.y,s.z].every(Number.isFinite))throw Error('Atom koordinatı sonlu olmalı: '+s.label);
  if(!(ELEMENT_DATA.mass[s.symbol]>0))throw Error('Element tanınmadı: '+s.symbol);
 }
}
const partial=model=>model.sites.some(s=>(s.occupancy??1)<1-1e-6);
const header=(losses,prefix)=>losses.map(l=>prefix+' Not exported / limitation: '+l.en);

/* ---- Symmetry helpers ---------------------------------------------------- */

const CENTRINGS={1:[[0,0,0]],2:[[0,0,0],[.5,.5,.5]],3:[[0,0,0],[2/3,1/3,1/3],[1/3,2/3,2/3]],
 4:[[0,0,0],[0,.5,.5],[.5,0,.5],[.5,.5,0]],5:[[0,0,0],[0,.5,.5]],6:[[0,0,0],[.5,0,.5]],7:[[0,0,0],[.5,.5,0]]};
const fraction=s=>String(s).split(',').map(x=>{const [n,d]=x.split('/');return Number(n)/(d?Number(d):1);});
const sameSet=(a,b)=>a.length===b.length&&a.every(v=>b.some(w=>w.every((x,i)=>Math.abs(wrap(x)-wrap(v[i]))<1e-6)));
/** SHELX LATT number (sign: centrosymmetric with inversion at the origin) and SYMM list. */
export function shelxSymmetry(pairs){
 const shifts=[],ops=[];
 for(const [op,shift] of pairs){
  const t=fraction(shift||'0,0,0');
  if(!shifts.some(s=>s.every((v,i)=>Math.abs(wrap(v)-wrap(t[i]))<1e-6)))shifts.push(t);
  const parsed=parseSymop(op);
  if(!ops.some(o=>o.R.every((r,i)=>r.every((v,j)=>v===parsed.R[i][j]))&&o.t.every((v,i)=>Math.abs(wrap(v)-wrap(parsed.t[i]))<1e-6)))ops.push(parsed);
 }
 const type=Object.entries(CENTRINGS).find(([,c])=>sameSet(c,shifts));
 if(!type)return null;
 const isIdentity=o=>o.R.every((r,i)=>r.every((v,j)=>v===(i===j?1:0)))&&o.t.every(v=>Math.abs(wrap(v))<1e-6);
 const inverse=o=>({R:o.R.map(r=>r.map(v=>-v)),t:o.t.map(v=>-v)});
 const equal=(a,b)=>a.R.every((r,i)=>r.every((v,j)=>v===b.R[i][j]))&&a.t.every((v,i)=>Math.abs(wrap(v)-wrap(b.t[i]))<1e-6);
 const centrosymmetric=ops.some(o=>equal(o,inverse({R:[[1,0,0],[0,1,0],[0,0,1]],t:[0,0,0]})));
 const listed=[];
 for(const o of ops){
  if(isIdentity(o))continue;
  if(centrosymmetric&&(equal(o,inverse({R:[[1,0,0],[0,1,0],[0,0,1]],t:[0,0,0]}))||listed.some(l=>equal(inverse(l),o))))continue;
  listed.push(o);
 }
 return {latt:(centrosymmetric?1:-1)*Number(type[0]),symm:listed.map(o=>formatSymop(o).toUpperCase()),
  count:ops.length*shifts.length};
}
/** Number of distinct positions of a site under all operations (its multiplicity). */
function multiplicity(pairs,site){
 const seen=[];
 for(const [op,shift] of pairs){
  const p=parseSymop(op),t=fraction(shift||'0,0,0');
  const x=p.R.map((r,i)=>wrap(r[0]*site.x+r[1]*site.y+r[2]*site.z+p.t[i]+t[i]));
  if(!seen.some(s=>s.every((v,i)=>{const d=Math.abs(v-x[i]);return Math.min(d,1-d)<1e-4;})))seen.push(x);
 }
 return seen.length;
}

/* ---- SHELX .res ------------------------------------------------------------ */

export function shelxResText(model){
 validate(model);
 const losses=[loss('wavelength'),loss('zerr')];
 let pairs=model.symmetry?.pairs||[['x,y,z','0,0,0']];
 let sym=shelxSymmetry(pairs),sites=model.sites;
 if(!sym){losses.push(loss('centring'));pairs=[['x,y,z','0,0,0']];sym=shelxSymmetry(pairs);sites=model.expandedSites||model.sites;}
 const general=sym.count;
 const elements=[...new Set(sites.map(s=>s.symbol))];
 const counts=elements.map(e=>sites.filter(s=>s.symbol===e).reduce((n,s)=>n+(s.occupancy??1)*multiplicity(pairs,s),0));
 // Unique names of at most four characters that start with a letter.
 const used=new Set(),names=sites.map(s=>{
  let base=String(s.label||s.symbol).replace(/[^A-Za-z0-9]/g,'');
  if(!/^[A-Za-z]/.test(base))base=s.symbol+base;
  let name=base.slice(0,4),n=1;
  while(used.has(name.toUpperCase()))name=(s.symbol+String(n++)).slice(0,4);
  used.add(name.toUpperCase());
  if(name!==s.label)losses.push(loss('labels'));
  return name;
 });
 if(sites.some(s=>!(s.uIso>0)&&!s.adp))losses.push(loss('uiso'));
 if(sites.some(s=>s.disorderGroup))losses.push(loss('disorder'));
 if(sites.some(s=>s.magneticMoment))losses.push(loss('magnetic'));
 const c=model.cell;
 const rows=['TITL '+String(model.name||'structure').replace(/[^\x20-\x7e]/g,'?').slice(0,70),
  ...header(dedupe(losses),'REM'),
  'CELL 0.71073 '+[c.a,c.b,c.c,c.alpha,c.beta,c.gamma].map(v=>f(v,5)).join(' '),
  'ZERR 1 0 0 0 0 0 0','LATT '+sym.latt,...sym.symm.map(s=>'SYMM '+s),
  'SFAC '+elements.join(' '),'UNIT '+counts.map(v=>Number(v.toFixed(2))).join(' '),'L.S. 4','FVAR 1.00000'];
 sites.forEach((s,i)=>{
  // SHELX occupancies are relative to the general position: special sites get m/M.
  const sof=10+(s.occupancy??1)*multiplicity(pairs,s)/general;
  const u=s.adp?s.adp.map(v=>f(v,5)):[f(s.uIso>0?s.uIso:.05,5)];
  const line=[names[i].padEnd(4),elements.indexOf(s.symbol)+1,f(s.x),f(s.y),f(s.z),f(sof,5),...u].join(' ');
  rows.push(...(line.length>78?[line.slice(0,line.lastIndexOf(' ',76))+' =','   '+line.slice(line.lastIndexOf(' ',76)+1)]:[line]));
 });
 rows.push('HKLF 4','END');
 return {text:rows.join('\n')+'\n',losses:dedupe(losses)};
}
function dedupe(list){const seen=new Set();return list.filter(l=>!seen.has(l.code)&&seen.add(l.code));}

/* ---- CASTEP .cell ---------------------------------------------------------- */

export function castepCellText(model){
 validate(model);
 if(partial(model))throw Error('Kısmi dolu atomlar CASTEP .cell dosyasına aktarılamaz.');
 const losses=[loss('castepPlaceholders')];
 if(model.sites.some(s=>s.magneticMoment))losses.push(loss('magnetic'));
 const rows=['# '+String(model.name||'structure').replace(/[^\x20-\x7e]/g,'?'),...header(losses,'#'),
  '%BLOCK LATTICE_CART','ang',...model.basis.map(v=>v.map(x=>f(x,9)).join(' ')),'%ENDBLOCK LATTICE_CART','',
  '%BLOCK POSITIONS_FRAC',...model.sites.map(s=>[s.symbol,f(wrap(s.x),9),f(wrap(s.y),9),f(wrap(s.z),9)].join(' ')),'%ENDBLOCK POSITIONS_FRAC'];
 return {text:rows.join('\n')+'\n',losses};
}

/* ---- Quantum ESPRESSO pw.x --------------------------------------------- */

export function qeStructureInputText(model){
 validate(model);
 if(partial(model))throw Error('Kısmi dolu atomlar Quantum ESPRESSO girdisine aktarılamaz.');
 const losses=[loss('qePlaceholders')];
 if(model.sites.some(s=>s.magneticMoment))losses.push(loss('magnetic'));
 const species=[...new Set(model.sites.map(s=>s.symbol))];
 const rows=['! '+String(model.name||'structure').replace(/[^\x20-\x7e]/g,'?'),...header(losses,'!'),
  '&CONTROL',"  calculation = 'scf'","  prefix = 'structure'",'/','&SYSTEM','  ibrav = 0','  nat = '+model.sites.length,'  ntyp = '+species.length,
  '  ecutwfc = 40.0  ! placeholder','  ecutrho = 320.0  ! placeholder','/','&ELECTRONS','/','ATOMIC_SPECIES',
  ...species.map(e=>e+' '+f(ELEMENT_DATA.mass[e],5)+' '+e+'.UPF'),
  'CELL_PARAMETERS angstrom',...model.basis.map(v=>v.map(x=>f(x,9)).join(' ')),
  'ATOMIC_POSITIONS crystal',...model.sites.map(s=>[s.symbol,f(wrap(s.x),9),f(wrap(s.y),9),f(wrap(s.z),9)].join(' ')),
  'K_POINTS automatic','4 4 4 0 0 0'];
 return {text:rows.join('\n')+'\n',losses};
}

/* ---- XSF ------------------------------------------------------------------ */

export function xsfStructureText(model){
 validate(model);
 const losses=[];
 if(partial(model))losses.push(loss('occupancy'));
 if(model.sites.some(s=>s.magneticMoment))losses.push(loss('magnetic'));
 if(model.sites.some(s=>s.adp))losses.push(loss('adp'));
 const atoms=model.sites.map(s=>atomicNumber(s.symbol)+' '+cartesian(model.basis,[s.x,s.y,s.z]).map(v=>f(v,9)).join(' '));
 let rows;
 if(model.nonPeriodic){
  losses.push(loss('molecule'));
  rows=[...header(losses,'#'),'ATOMS',...atoms];
 }else rows=[...header(losses,'#'),'CRYSTAL','PRIMVEC',...model.basis.map(v=>v.map(x=>f(x,9)).join(' ')),
  'PRIMCOORD',model.sites.length+' 1',...atoms];
 return {text:rows.join('\n')+'\n',losses};
}

/* ---- Magnetic CIF (P1, BNS 1.1) --------------------------------------------- */

const cifText=v=>/^[A-Za-z0-9_.+-]+$/.test(v)?v:"'"+String(v).replace(/'/g,'')+"'";
export function magneticCifText(model){
 validate(model);
 if(model.symmetry)throw Error('mCIF dışa aktarımı için yapı P1 olmalı; manyetik simetri işlemleri desteklenmiyor.');
 if(!model.sites.some(s=>Array.isArray(s.magneticMoment)))throw Error('Yapıda manyetik moment yok.');
 const losses=[];
 if(model.sites.some(s=>s.adp))losses.push(loss('adp'));
 // Moments are Cartesian μB; mCIF crystalaxis components are along unit a, b, c.
 const B=model.basis,lengths=B.map(v=>Math.hypot(...v));
 const det=B[0][0]*(B[1][1]*B[2][2]-B[1][2]*B[2][1])-B[1][0]*(B[0][1]*B[2][2]-B[0][2]*B[2][1])+B[2][0]*(B[0][1]*B[1][2]-B[0][2]*B[1][1]);
 const solve=m=>{
  // Cramer's rule for m = Σ f_i B_i.
  const col=(i,v)=>B.map((row,k)=>k===i?v:row);
  const d3=M=>M[0][0]*(M[1][1]*M[2][2]-M[1][2]*M[2][1])-M[1][0]*(M[0][1]*M[2][2]-M[0][2]*M[2][1])+M[2][0]*(M[0][1]*M[1][2]-M[0][2]*M[1][1]);
  return [0,1,2].map(i=>d3(col(i,m))/det);
 };
 const c=model.cell;
 const rows=['# '+String(model.name||'structure').replace(/[^\x20-\x7e]/g,'?'),...header(losses,'#'),
  'data_'+String(model.name||'structure').replace(/[^A-Za-z0-9_.-]+/g,'_').slice(0,60)+'_mcif',
  "_audit_creation_method 'Kristal Yapi'",
  '_cell_length_a '+f(c.a,5),'_cell_length_b '+f(c.b,5),'_cell_length_c '+f(c.c,5),
  '_cell_angle_alpha '+f(c.alpha,4),'_cell_angle_beta '+f(c.beta,4),'_cell_angle_gamma '+f(c.gamma,4),
  '_space_group_magn.number_BNS 1.1',"_space_group_magn.name_BNS 'P 1'",
  'loop_','_space_group_symop_magn_operation.id','_space_group_symop_magn_operation.xyz','1 x,y,z,+1',
  'loop_','_space_group_symop_magn_centering.id','_space_group_symop_magn_centering.xyz','1 x,y,z,+1',
  'loop_','_atom_site_label','_atom_site_type_symbol','_atom_site_fract_x','_atom_site_fract_y','_atom_site_fract_z','_atom_site_occupancy',
  ...model.sites.map(s=>[cifText(s.label),s.symbol,f(s.x),f(s.y),f(s.z),f(s.occupancy??1,4)].join(' ')),
  'loop_','_atom_site_moment.label','_atom_site_moment.crystalaxis_x','_atom_site_moment.crystalaxis_y','_atom_site_moment.crystalaxis_z',
  ...model.sites.filter(s=>Array.isArray(s.magneticMoment)).map(s=>{
   const frac=solve(s.magneticMoment);
   return [cifText(s.label),...frac.map((v,i)=>f(v*lengths[i],5))].join(' ');
  })];
 return {text:rows.join('\n')+'\n',losses};
}
