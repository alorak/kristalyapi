import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseVesta3ScientificStyles,validatedVestaDisplayVectors} from '../vesta-project-scientific.js';
import {vesta3SectionTransferReport} from '../vesta-project-style.js';

// Adapted, NOT a byte-for-byte file or proof of visual parity:
// VECTR/VECTT triples from public lucydot/vesta_vectors/data/vectors.vesta,
// THERI/POLYP field shape from public WMD-group/Phonons/MAPbI3-Cubic.vesta.
const source=(extra='')=>[
 'STRUC',
 ' 16 Cd Cd16 1.0000 0.15 0.25 0.35 1a 1',
 ' 0 0 0 0',
 'THERI 0',
 ' 16 Cd16 1.000000',
 ' 0 0 0',
 'SITET',
 ' 16 Cd16 0.5000 200 80 40 200 80 40 204 0',
 ' 0 0 0 0 0',
 'VECTR',
 ' 16 0.4250557000000007 -0.42500378479999923 0.4250557 0',
 ' 16 0 0 0 0',
 ' 0 0 0 0 0',
 ' 0 0 0 0 0',
 'VECTT',
 ' 16 1.0 255 0 0 0',
 ' 0 0 0 0 0',
 'STYLE',
 ' VECTS 1.0',
 'POLYP',
 ' 204 1 1.000 180 180 180',
 extra
].join('\n').split('\n');
const sites=()=>new Map([[16,{symbol:'Cd',label:'Cd16',x:.15,y:.25,z:.35}]]);
const parse=(extra)=>parseVesta3ScientificStyles(source(extra),sites());

test('read real-shaped VESTA vector triple into separate UNTyped display arrow',()=>{
 const result=parse();
 assert.equal(result.vectors.length,1);
 const v=result.vectors[0];
 assert.equal(v.atomIndex,16);
 assert.equal(v.siteLabel,'Cd16');
 assert.deepEqual(v.cartesian,[.4250557000000007,-.42500378479999923,.4250557]);
 assert.equal(v.style.color,'#ff0000');
 assert.equal(v.displayScale,1);
 assert.equal(v.semanticType,'UNSPECIFIED_DISPLAY_ARROW');
 assert.equal(result.guiParity,'NOT_ESTABLISHED');
 assert.ok(result.warnings.some(w=>w.includes('NOT assumed magnetic')));
});

test('THERI has site display multipliers, not temperature B/U or tensor data',()=>{
 const result=parse();
 assert.equal(result.thermal.present,true);
 assert.equal(result.thermal.status,'METADATA_ONLY');
 assert.deepEqual(result.thermal.siteFactors,[{siteId:16,label:'Cd16',displayMultiplier:1}]);
 assert.equal(result.thermal.modeCode,0);
 assert.ok(result.warnings.some(w=>w.includes('no Uij')));
 assert.ok(!Object.hasOwn(sites().get(16),'adp'));
 assert.ok(!Object.hasOwn(sites().get(16),'uIso'));
});

test('POLYP global RGB is read as color without automatic facet/geometry claims',()=>{
 const result=parse();
 assert.equal(result.polyhedron.status,'COLOR_ONLY');
 assert.equal(result.polyhedron.color,'#b4b4b4');
 assert.deepEqual(result.polyhedron.otherParameters,[204,1,1]);
 assert.ok(result.warnings.some(w=>w.includes('no per-face colors')));
});

test('invalid VECTR anchor rejects complete vector block instead of assigning wrong atom',()=>{
 const s=source().map(line=>line===' 16 0 0 0 0'?' 13 0 0 0 0':line);
 const result=parseVesta3ScientificStyles(s,sites());
 assert.equal(result.vectors.length,0);
 assert.ok(result.warnings.some(w=>w.includes('Unmatched')));
});
test('nonzero lattice offset and unmatched VECTT style reject vectors',()=>{
 const o=source().map(line=>line===' 16 0 0 0 0'?' 16 1 0 0 0':line);
 assert.equal(parseVesta3ScientificStyles(o,sites()).vectors.length,0);
 const p=source().map(line=>line===' 16 1.0 255 0 0 0'?' 15 1.0 255 0 0 0':line);
 assert.equal(parseVesta3ScientificStyles(p,sites()).vectors.length,0);
});
test('malformed THERI sentinel rejects thermal metadata without fabricating ADP',()=>{
 const s=source().map(line=>line===' 16 Cd16 1.000000'?' 16 Cd16 NaN':line);
 const r=parseVesta3ScientificStyles(s,sites());
 assert.equal(r.thermal.status,'REJECTED');
 assert.deepEqual(r.thermal.siteFactors,[]);
});
test('negative/invalid POLYP colors and malformed row cannot alter polyhedron style',()=>{
 const s=source().map(line=>line===' 204 1 1.000 180 180 180'?' 204 1 1.000 900 180 180':line);
 const r=parseVesta3ScientificStyles(s,sites());
 assert.equal(r.polyhedron.status,'REJECTED');
 assert.equal(r.polyhedron.color,undefined);
});
test('saved vector validator forbids fabricated magnetic semantics and site mismatches',()=>{
 const v=parse().vectors;
 assert.equal(validatedVestaDisplayVectors(v,['Cd16'])[0].semanticType,'UNSPECIFIED_DISPLAY_ARROW');
 assert.throws(()=>validatedVestaDisplayVectors(v,['Other']),/Unsupported saved/);
 assert.throws(()=>validatedVestaDisplayVectors([{...v[0],cartesian:[NaN,0,1]}],['Cd16']),/Unsupported saved/);
 assert.throws(()=>validatedVestaDisplayVectors([{...v[0],style:{color:'#ffffxx'}}],['Cd16']),/Unsupported saved/);
});
test('no VECTR/THERI/POLYP is valid empty style rather than fake scientific data',()=>{
 const r=parseVesta3ScientificStyles(['STRUC',' 1 C C1 1 0 0 0 1a 1',' 0 0 0 0 0'],new Map([[1,{label:'C1'}]]));
 assert.deepEqual(r.vectors,[]);
 assert.equal(r.thermal.status,'NOT_AVAILABLE');
 assert.equal(r.polyhedron.status,'NOT_AVAILABLE');
});
test('V17.3 transfer report distinguishes partial/approximate from lossless',()=>{
 const r=vesta3SectionTransferReport(source());
 for(const name of ['VECTR','VECTT','VECTS'])assert.equal(r.sections.find(x=>x.section===name)?.status,'conditional');
 assert.equal(r.sections.find(x=>x.section==='THERI')?.status,'partial');
 assert.equal(r.sections.find(x=>x.section==='POLYP')?.status,'approximated');
});
test('editor renders imported arrows with their own layer and preserves JSON data',()=>{
 const app=readFileSync(new URL('../crystal-app.js',import.meta.url),'utf8');
 assert.match(app,/from '\.\/vesta-project-scientific\.js'/);
 assert.match(app,/\['vestaVectors','VESTA çizim okları/);
 assert.match(app,/addLayerObject\(mesh,'vestaVectors'\)/);
 assert.match(app,/vestaDisplayVectors:validatedVestaDisplayVectors\(obj.vestaDisplayVectors/);
 assert.match(app,/vestaDisplayVectors:applicableVestaVectors\(state\)/);
 assert.match(app,/function applicableVestaVectors\(current\)/);
 assert.match(app,/polyColor:scientific.polyhedron.status==='COLOR_ONLY'/);
 assert.match(app,/if\(!state.symmetryEnabled\)/);
});
