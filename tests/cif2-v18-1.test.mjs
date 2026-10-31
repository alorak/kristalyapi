import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {isCif2,tokenizeCif2} from '../cif2-lex.js';
import {validateCif2Symmetry} from '../cif2-symmetry.js';

const require=createRequire(import.meta.url);
const {parserFromHtml}=require('./validation/js_cif_runner.cjs');
const parse=parserFromHtml(fileURLToPath(new URL('../index.html',import.meta.url)));
const fixture=name=>readFileSync(new URL('./validation/fixtures/synthetic/'+name,import.meta.url),'utf8');
const base=[
 '#\\#CIF_2.0','data_A','_cell_length_a 5','_cell_length_b 6','_cell_length_c 7',
 '_cell_angle_alpha 90','_cell_angle_beta 90','_cell_angle_gamma 90',
 '_space_group_IT_number 1','loop_','_atom_site_label','_atom_site_type_symbol',
 '_atom_site_fract_x','_atom_site_fract_y','_atom_site_fract_z','C1 C .125 .25 .375',''
].join('\n');

test('CIF2 marker, triple-quote Unicode text and quotes tokenize without false data block',()=>{
 const s=fixture('s11_cif2_pminus1.cif');
 assert.equal(isCif2(s),true);
 const tokens=tokenizeCif2(s);
 assert.equal(tokens.filter(t=>t==='data_cif2_inversion').length,1);
 assert.ok(tokens.some(t=>t.includes('Kübik olmayan α model')));
 assert.ok(tokens.some(t=>t.includes("O'Brien")));
 assert.equal(tokens.includes('-x,-y,-z'),true);
});
test('actual browser CIF2 importer expands inversion atoms without changing mixed occupancy',()=>{
 const out=parse(fixture('s11_cif2_pminus1.cif'));
 assert.equal(out.sgNumber,2);
 assert.equal(out.sites.length,4);
 assert.equal(out.sites.filter(s=>s.symbol==='Si').length,2);
 assert.equal(out.sites.filter(s=>s.symbol==='O').length,2);
 assert.ok(out.sites.filter(s=>s.symbol==='O').every(s=>s.occupancy===.5));
 assert.match(out.warning,/setting\/origin NOT inferred/);
 assert.match(out.warning,/CIF2 V18\.2/);
});
test('explicit monoclinic screw group preserves nonorthogonal metric',()=>{
 const out=parse(fixture('s12_cif2_p21_origin.cif'));
 assert.equal(out.sgNumber,4);
 assert.equal(out.sites.length,2);
 assert.ok(Math.abs(out.cell.beta-101)<1e-7);
 assert.ok(out.sites.some(site=>Math.abs(site.y-.725)<1e-7));
 assert.match(out.warning,/IT setting\/origin NOT inferred/);
});
test('CIF2 rejects missing explicit operators for SG>1, never assumes canonical origin',()=>{
 const s=base.replace('_space_group_IT_number 1','_space_group_IT_number 14');
 assert.throws(()=>parse(s),/without explicit operations/);
});
test('CIF2 rejects invalid symmetry metric, incomplete and repeated affine operations',()=>{
 const original=fixture('s12_cif2_p21_origin.cif');
 const mismatch=original.replace("'-x,y+1/2,-z'","'-y,x,z'");
 assert.throws(()=>parse(mismatch),/incompatible with cell metric/);
 const missing=fixture('s11_cif2_pminus1.cif').replace("'-x,-y,-z'","'x+1/3,y,z'");
 assert.throws(()=>parse(missing),/not closed|missing identity|CIF2/);
 const duplicates=fixture('s11_cif2_pminus1.cif').replace("'-x,-y,-z'","'x,y,z'");
 assert.throws(()=>parse(duplicates),/duplicate equivalent symmetry operators/);
});
test('CIF2 rejects malformed quote, unknown container, duplicate name and orphan loop',()=>{
 assert.throws(()=>tokenizeCif2(base+"_journal_name_full '''unfinished"),/Unterminated CIF2/);
 assert.equal(parse(base+"_colour_rgb [1 0 0]").sites.map(x=>x.symbol).join(','),'C');
 assert.throws(()=>parse(base+"_cell_length_a 8"),/Duplicate CIF2 data name/);
 assert.throws(()=>parse(base.replace('C1 C .125 .25 .375','C1 C .125 .25')),/loop values misaligned/);
 assert.equal(parse(base+'data_B\n_cell_length_a 3\n').sites.length,1);
});
test('CIF2 line length, banned controls and text-field syntax fail closed',()=>{
 assert.throws(()=>tokenizeCif2(base+'#'+'a'.repeat(2050)),/2048-character/);
 assert.throws(()=>parse(base+'\n_journal_name_full \u0000'),/control character/);
 const semicolon=base+'_journal_name_full\n;A multiline text\nwith # visible\n;\n';
 assert.equal(tokenizeCif2(semicolon).at(-1),'A multiline text\nwith # visible');
});
test('CIF1 pathway remains separate; it does not require CIF2 header',()=>{
 const content=fixture('s01_p1_cubic.cif');
 assert.equal(isCif2(content),false);
 const out=parse(content);
 assert.ok(out.sites.length>=1);
});
test('explicit group closure can be checked on pure helper independently',()=>{
 const identity='x,y,z',inversion='-x,-y,-z';
 const fake=(op,p)=>op===identity?p:p.map(x=>-x);
 const out=validateCif2Symmetry([identity,inversion],{a:5,b:6,c:7,alpha:90,beta:90,gamma:90},fake);
 assert.equal(out.count,2);
 assert.equal(out.groupClosed,true);
 assert.equal(out.originSetting,'EXPLICIT_OPERATORS_ONLY_NOT_RECONCILED_WITH_IT_NUMBER');
});
