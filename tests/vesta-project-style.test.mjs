import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {applyVesta3SiteAppearance,vesta3SectionTransferReport} from '../vesta-project-style.js';

const source=readFileSync(new URL('./fixtures/package9-3-signed.vesta',import.meta.url),'utf8');
const RADII={Fe:1.24,O:.66};
const inputs=()=>new Map([
 [1,{symbol:'Fe',label:'Fe1',x:.125,y:.25,z:.375,occupancy:1}],
 [2,{symbol:'O',label:'O1',x:.45,y:.55,z:.65,occupancy:.875}]
]);
const style=(text=source,byIndex=inputs(),radii=RADII)=>
 applyVesta3SiteAppearance(text.split(/\r?\n/),byIndex,radii,{atomScale:.8,ballRadiusScale:.52});

test('V17.1 real-grid-linked VESTA fixture maps RGB and visible radii without claiming GUI parity',()=>{
 const atoms=inputs(),result=style(source,atoms);
 assert.equal(atoms.get(1).visualColor,'#c85028');
 assert.equal(atoms.get(2).visualColor,'#28b4dc');
 assert.ok(atoms.get(1).visualScale>.2&&atoms.get(1).visualScale<3);
 assert.ok(atoms.get(2).visualScale>.2&&atoms.get(2).visualScale<3);
 assert.ok(Math.abs(atoms.get(1).visualScale*1.24*.8*.52-.5)<.000001);
 assert.ok(Math.abs(atoms.get(2).visualScale*.66*.8*.52-.5)<.000001);
 assert.ok(result.warnings.some(x=>/approximated/.test(x)));
 assert.match(result.method,/not a verified VESTA GUI/);
});

test('per-site SITET values override ATOMT element default, preserving occupancy',()=>{
 const fixture=source.replace('2 O1 0.5000 40 180 220','2 O1 0.2500 255 0 255');
 const atoms=inputs(),out=style(fixture,atoms);
 assert.equal(atoms.get(2).visualColor,'#ff00ff');
 assert.ok(Math.abs(atoms.get(2).visualScale*.66*.8*.52-.25)<.000001);
 assert.equal(atoms.get(2).occupancy,.875);
 assert.equal(out.stats.siteColors,2);
});

test('invalid/unrepresentable SITET radius warned and not silently clamped',()=>{
 const fixture=source.replace('1 Fe1 0.5000','1 Fe1 9.0000');
 const atoms=inputs(),out=style(fixture,atoms);
 assert.ok(Math.abs(atoms.get(1).visualScale*1.24*.8*.52-.5)<.000001);
 assert.ok(out.stats.skippedRadii>=1);
 assert.ok(out.warnings.some(w=>/cannot fit/.test(w)));
});

test('invalid style records warn; missing section terminator fails closed',()=>{
 const fixture=source.replace('1 Fe1 0.5000 200 80 40','1 Fe1 nan 999 80 40');
 const out=style(fixture,inputs());
 assert.ok(out.warnings.some(w=>/invalid/i.test(w)));
 assert.ok(out.stats.invalidRows>=1);
 const noEnd=source.replace(' 0 0 0 0 0 0\nATOMT','ATOMT');
 assert.throws(()=>style(noEnd,inputs()),/missing terminating 0/);
});

test('section transfer report flags unsupported camera, vector, ADP, polyhedron',()=>{
 const source2=source+'\nSCENE\n 1 2 3\nLMATRIX\n 1 0 0\nVECTR\n 1 0 0 1\nTHERI\n 1 2\nPOLYP\n 1 2\nIMPORT_STRUCTURE\n test.cif\n';
 const report=vesta3SectionTransferReport(source2.split(/\r?\n/));
 for(const k of ['LMATRIX','IMPORT_STRUCTURE'])
  assert.ok(report.skipped.includes(k),k);
 assert.equal(report.sections.find(item=>item.section==='SCENE')?.status,'conditional');
 assert.equal(report.sections.find(item=>item.section==='VECTR')?.status,'conditional');
 assert.equal(report.sections.find(item=>item.section==='THERI')?.status,'partial');
 assert.equal(report.sections.find(item=>item.section==='POLYP')?.status,'approximated');
 assert.ok(report.sections.some(x=>x.section==='SITET'&&x.status==='approximated'));
 assert.ok(report.sections.some(x=>x.section==='ISURF'&&x.status==='partial'));
 assert.match(report.note,/NOT lossless/);
});

test('reject pathological unknown or oversized style input',()=>{
 assert.throws(()=>applyVesta3SiteAppearance([],new Map(),null),/Invalid VESTA/);
 assert.throws(()=>vesta3SectionTransferReport(Array(100001).fill('ATOMT')),/too long/);
 const many='ATOMT\n'+Array.from({length:1001},(_,i)=>(i+1)+' Fe 0.5 1 2 3 1 2 3 204').join('\n')+'\n 0 0 0\n';
 assert.throws(()=>style(many,inputs()),/exceeds entry limit/);
});

test('runtime project module integrates V17.1 converter and explicit scale',()=>{
 const app=readFileSync(new URL('../crystal-app.js',import.meta.url),'utf8');
 assert.match(app,/from '\.\/vesta-project-style\.js'/);
 assert.match(app,/applyVesta3SiteAppearance\(lines,byIndex,RADII,\{atomScale:\.8,ballRadiusScale:\.52\}\)/);
 assert.match(app,/style:'ball',atomScale:\.8,cut:2\.65/);
 assert.match(app,/settingProvenance:vestaSettingProvenance,appearance,transferReport/);
});
