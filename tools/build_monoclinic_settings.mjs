#!/usr/bin/env node
/* Add monoclinic cell choices 2 and 3 (unique axis b and c) to the editor's
 * SPACE_GROUPS table, and the H-M symbols of all monoclinic cell choices to
 * SETTING_HM.
 *
 * Input: tools/monoclinic_settings.json (from build_monoclinic_settings.py,
 * Gemmi's tables). For each new setting the operations and centring come from
 * Gemmi; the Wyckoff positions are those of cell choice 1 of the same unique
 * axis, carried over with the verified setting transformation (P, p):
 * x' = P⁻¹(x − p). Cell choice 1 itself is checked to equal Gemmi's b1/c1.
 *
 * Usage: node tools/build_monoclinic_settings.mjs   (rewrites crystal-app.js)
 */
import fs from 'node:fs';
import {findSettingTransform,settingTransformValid,inv3} from '../setting-transform.js';
import {parseSymop,formatSymop,symmetryOperations} from '../geometry-table.js';

const root=new URL('../',import.meta.url);
const appPath=new URL('crystal-app.js',root);
let app=fs.readFileSync(appPath,'utf8');
const line=app.match(/^const SPACE_GROUPS=(\{.*\});$/m);
const SG=JSON.parse(line[1]);
const data=JSON.parse(fs.readFileSync(new URL('tools/monoclinic_settings.json',root),'utf8'));
const pairsOf=s=>s.operations.flatMap(op=>s.centring.map(c=>[op,c]));
const tablePairs=key=>{const [c,o]=SG[key];return o.flatMap(op=>c.map(t=>[op,t]));};
const I=[[1,0,0],[0,1,0],[0,0,1]];
const wrap=v=>{const r=v-Math.floor(v);return Math.abs(r-1)<1e-9||Math.abs(r)<1e-9?0:r;};
const KEYS={b1:'-b',b2:'-b2',b3:'-b3',c1:'-c',c2:'-c2',c3:'-c3'};

const added={},hm={};
for(const setting of data.settings){
 const key=setting.number+KEYS[setting.qualifier];
 hm[key]={full:setting.hm,short:setting.short};
 if(setting.qualifier.endsWith('1')){
  // Cell choice 1 already exists: it must be Gemmi's operation set.
  const same=settingTransformValid(symmetryOperations(tablePairs(key)),symmetryOperations(pairsOf(setting)),I,[0,0,0]);
  if(!same)throw Error(key+' differs from Gemmi '+setting.hm);
  continue;
 }
 const baseKey=setting.number+(setting.qualifier[0]==='b'?'-b':'-c');
 const t=findSettingTransform(tablePairs(baseKey),pairsOf(setting));
 if(!t)throw Error('no transformation '+baseKey+' → '+setting.hm);
 const Pi=inv3(t.P);
 const wyckoff=SG[baseKey][2].map(([letter,multiplicity,symmetry,formula])=>{
  const {R,t:b}=parseSymop(formula);
  const A=Pi.map(row=>[0,1,2].map(j=>Math.round(row.reduce((s,v,k)=>s+v*R[k][j],0))));
  const shift=Pi.map(row=>wrap(row.reduce((s,v,k)=>s+v*(b[k]-t.p[k]),0)));
  // A general position spans the whole cell: write it as x,y,z.
  const det=A[0][0]*(A[1][1]*A[2][2]-A[1][2]*A[2][1])-A[0][1]*(A[1][0]*A[2][2]-A[1][2]*A[2][0])+A[0][2]*(A[1][0]*A[2][1]-A[1][1]*A[2][0]);
  return [letter,multiplicity,symmetry,det!==0?'x,y,z':formatSymop({R:A,t:shift})];
 });
 added[key]=[setting.centring,setting.operations,wyckoff];
}
// Keep each group's settings together: b, b2, b3, c, c2, c3.
const next={};
for(const key of Object.keys(SG)){
 next[key]=SG[key];
 const m=key.match(/^(\d+)-([bc])$/);
 if(m)for(const suffix of ['2','3']){const k=m[1]+'-'+m[2]+suffix;if(added[k])next[k]=added[k];}
}
app=app.replace(line[0],'const SPACE_GROUPS='+JSON.stringify(next)+';');
const hmLine='const SETTING_HM='+JSON.stringify(hm)+';';
app=/^const SETTING_HM=.*;$/m.test(app)?app.replace(/^const SETTING_HM=.*;$/m,hmLine):app.replace(/^(const SPACE_GROUPS=.*;)$/m,'$1\n'+hmLine);
fs.writeFileSync(appPath,app);
console.log('settings:',Object.keys(next).length,'added:',Object.keys(added).length);
