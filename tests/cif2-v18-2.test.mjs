import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {readCif2Document,listCif2Structures,selectCif2Structure} from '../cif2-document.js';
const require=createRequire(import.meta.url);
const {parserFromHtml}=require('./validation/js_cif_runner.cjs');
const parse=parserFromHtml(fileURLToPath(new URL('../index.html',import.meta.url)));
const fixture=readFileSync(new URL('./validation/fixtures/synthetic/s13_cif2_multiblock_containers.cif',import.meta.url),'utf8');

const metadata=()=>readCif2Document(fixture).blocks[0];
test('nested CIF2 List and Table stay typed, including exact quoted table keys',()=>{
 const outer=metadata().entries.find(x=>x.name==='_local_model').value;
 assert.equal(outer.kind,'table');
 assert.deepEqual(outer.entries.map(x=>x.key),['rgb','nested','label']);
 assert.equal(outer.entries[0].value.kind,'list');
 assert.deepEqual(outer.entries[0].value.items.map(x=>x.value),['255','100','20']);
 assert.equal(outer.entries[1].value.entries[0].value.items[1].kind,'list');
 assert.equal(outer.entries[2].value.value,'α-sample');
});
test('save frames are parsed in their own scope and never mixed with atoms',()=>{
 const block=metadata();
 assert.equal(block.frames.length,1);
 assert.equal(block.frames[0].name,'record');
 assert.equal(block.frames[0].entries[0].value.kind,'table');
 assert.deepEqual(block.frames[0].entries[0].value.entries.map(x=>x.key),['url','tags']);
});
test('all structural data blocks are listed without mixing metadata blocks',()=>{
 assert.deepEqual(listCif2Structures(fixture).map(x=>[x.name,x.structural]),[
  ['metadata',false],['alpha',true],['beta',true]
 ]);
 assert.throws(()=>selectCif2Structure(fixture),/structure selection required/);
 assert.throws(()=>parse(fixture),/structure selection required/);
});
test('explicit block selection imports alpha only and beta only',()=>{
 const a=parse(fixture,'alpha'),b=parse(fixture,'beta');
 assert.equal(a.sites.length,1);
 assert.equal(a.sites[0].symbol,'C');
 assert.equal(a.cell.a,5);
 assert.equal(b.sites.length,2);
 assert.equal(b.sites[0].symbol,'Si');
 assert.equal(b.cell.a,4);
 assert.match(a.warning,/selected alpha/);
 assert.match(b.warning,/selected beta/);
});
test('non-structural compound loops are skipped, but typed metadata is available',()=>{
 const chosen=selectCif2Structure(fixture,'alpha');
 assert.deepEqual(chosen.ignoredCompoundNames,['_local_source_collection','_local_rgb_name','_local_rgb_value']);
 assert.equal(chosen.typedMetadata.length,2);
 assert.equal(chosen.typedMetadata[1].rows[0][1].kind,'list');
 assert.equal(chosen.tokens.includes('_local_rgb_value'),false);
});
test('compound values inside scientific fields fail closed (no numeric coercion)',()=>{
 const bad=fixture.replace('_cell_length_a 5','_cell_length_a [5 6]');
 assert.throws(()=>parse(bad,'alpha'),/compound scientific value unsupported/);
 const a=fixture.replace('C1 C .125 .25 .375','C1 C [.125 .250] .25 .375');
 assert.throws(()=>parse(a,'alpha'),/structural loop require typed scientific mapping/);
});
test('ambiguous or fake selected block names are rejected',()=>{
 assert.throws(()=>parse(fixture,'unknown'),/structure selection required/);
 assert.throws(()=>parse(fixture,'metadata'),/structure selection required/);
});
test('table keys must be quoted with adjacent colon and be unique',()=>{
 const bad=fixture.replace("'nested':{","nested:{");
 assert.throws(()=>readCif2Document(bad),/Table key must be quoted/);
 const gap=fixture.replace("'nested':{","'nested' :{");
 assert.throws(()=>readCif2Document(gap),/immediately adjacent colon/);
 const duplicate=fixture.replace("'nested':{","'rgb':{");
 assert.throws(()=>readCif2Document(duplicate),/duplicate Table key/);
});
test('CIF2 comma string is not misread as a three-entry list',()=>{
 const altered=fixture.replace('[1 0.25 0]','[1,0.25,0]');
 const parsed=readCif2Document(altered);
 const rgb=parsed.blocks[0].entries.find(item=>item.name==='_local_rgb').value;
 assert.equal(rgb.items.length,1);
 assert.equal(rgb.items[0].value,'1,0.25,0');
});
test('nested containers have strict end delimiters, depth and size bounds',()=>{
 assert.throws(()=>readCif2Document(fixture.replace('{"remark":','{"remark"')),/immediately adjacent colon|quoted/);
 assert.throws(()=>readCif2Document(fixture.replace('[red [1 2]','[red [1 2')),/unterminated|unexpected/i);
 const nesting='['.repeat(16)+'1'+']'.repeat(16);
 assert.throws(()=>readCif2Document(fixture.replace('[1 0.25 0]',nesting)),/nesting depth/);
});
test('CIF2 duplicate data block and save frame names are rejected',()=>{
 const dup=fixture.replace('data_beta','data_ALPHA');
 assert.throws(()=>readCif2Document(dup),/duplicate block code/);
 const nested=fixture.replace('save_record','save_record\nsave_inner');
 assert.throws(()=>readCif2Document(nested),/nested save frames/);
});
test('existing V18.1 scalar CIF2 and CIF1 paths remain usable',()=>{
 const v18=readFileSync(new URL('./validation/fixtures/synthetic/s11_cif2_pminus1.cif',import.meta.url),'utf8');
 const out=parse(v18);
 assert.equal(out.sites.length,4);
 const cif1=readFileSync(new URL('./validation/fixtures/synthetic/s01_p1_cubic.cif',import.meta.url),'utf8');
 assert.ok(parse(cif1).sites.length>0);
});
