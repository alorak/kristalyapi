import test from 'node:test';
import assert from 'node:assert/strict';
import {mpSearchUrl,mpStructureUrl,normalizeMpSummary,normalizeMpResponse,
 mpCompareRows,mpStructureToCif,mpApiGet} from '../materials-project-core.js';

const Si={material_id:'mp-149',formula_pretty:'Si',nsites:2,
 symmetry:{symbol:'Fd-3m',number:227},band_gap:.6,is_gap_direct:false,
 energy_above_hull:0,formation_energy_per_atom:0,density:2.33,
 last_updated:'2026-10-31',has_props:['dos','bandstructure']};
const structure={
 lattice:{matrix:[[4,0,0],[0,4,0],[0,0,4]]},
 sites:[
  {abc:[0,0,0],species:[{element:'Si',occu:1}]},
  {abc:[.25,.25,.25],species:[{element:'Si',occu:1}]}
 ]};
test('search URL accepts only formula, chemical system or validated ID and selects limited fields',()=>{
 const u=new URL(mpSearchUrl('SrTiO3'));
 assert.equal(u.origin,'https://api.materialsproject.org');
 assert.equal(u.pathname,'/materials/summary/');
 assert.equal(u.searchParams.get('formula'),'SrTiO3');
 assert.equal(u.searchParams.get('_limit'),'20');
 assert.equal(u.searchParams.get('structure'),null);
 assert.equal(new URL(mpSearchUrl('mp-149')).searchParams.get('material_ids'),'mp-149');
 assert.equal(new URL(mpSearchUrl('Sr-Ti-O')).searchParams.get('chemsys'),'Sr-Ti-O');
 for(const value of ['','foo','../../test','mp-1?X-API-KEY=secret','Si;O'])assert.throws(()=>mpSearchUrl(value));
 assert.equal(new URL(mpStructureUrl('mp-149')).searchParams.get('_fields'),'material_id,formula_pretty,structure,last_updated');
 assert.throws(()=>mpStructureUrl('https://evil.example'));
});
test('summary response preserves explicit missing values and separates computed properties',()=>{
 const row=normalizeMpSummary(Si);
 assert.equal(row.materialId,'mp-149');
 assert.equal(row.bandGap,.6);
 assert.equal(row.direct,false);
 assert.equal(row.hull,0);
 assert.deepEqual(row.hasProps,['dos','bandstructure']);
 assert.equal(normalizeMpSummary({material_id:'mp-1'}).bandGap,null);
 assert.deepEqual(normalizeMpResponse({data:[Si]}),[row]);
 assert.throws(()=>normalizeMpResponse({foo:1}));
 const rows=mpCompareRows([row,normalizeMpSummary({material_id:'mp-1'})]);
 assert.equal(rows.find(r=>r.key==='hull').values[0],0);
 assert.equal(rows.find(r=>r.key==='bandGap').values[1],null);
 assert.throws(()=>mpCompareRows([]));
 assert.throws(()=>mpCompareRows([row,row,row,row,row]));
});
test('MP lattice and fractional sites convert to a bounded P1 CIF for the existing parser',()=>{
 const cif=mpStructureToCif({...Si,structure},'mp-149');
 assert.match(cif,/data_mp_149/);
 assert.match(cif,/_cell_length_a 4\.000000000/);
 assert.match(cif,/_cell_angle_alpha 90\.000000000/);
 assert.match(cif,/_symmetry_space_group_name_H-M 'P 1'/);
 assert.match(cif,/Si2 Si 0\.250000000 0\.250000000 0\.250000000 1\.0000000/);
 assert.match(cif,/not an experimental CIF/);
 assert.throws(()=>mpStructureToCif({...Si,structure},'mp-2'),/uyuşmuyor/);
 const bad={lattice:structure.lattice,sites:[{abc:[0,0,0],species:[{element:'Si',occu:.5},{element:'Ge',occu:.5}]}]};
 assert.throws(()=>mpStructureToCif({...Si,structure:bad},'mp-149'),/Karma/);
 assert.throws(()=>mpStructureToCif({...Si,structure:{...structure,sites:Array.from({length:1001},()=>structure.sites[0])}},'mp-149'),/1000/);
});
test('API request sends key in header only; omits credentials and refuses unexpected hosts',async()=>{
 let sent;
 const mock=async(url,opts)=>{
  sent={url,opts};return {ok:true,status:200,headers:{get:()=>null},
   text:async()=>JSON.stringify({data:[Si]})};
 };
 const data=await mpApiGet(mpSearchUrl('Si'),'local-test-key',{fetcher:mock});
 assert.equal(data.data[0].material_id,'mp-149');
 assert.equal(sent.opts.headers['X-API-KEY'],'local-test-key');
 assert.equal(sent.opts.credentials,'omit');
 assert.equal(sent.opts.cache,'no-store');
 assert.ok(!sent.url.includes('local-test-key'));
 assert.ok(!sent.url.includes('API_KEY='));
 await assert.rejects(mpApiGet('https://example.org/materials/summary/','key',{fetcher:mock}));
 await assert.rejects(mpApiGet(mpSearchUrl('Si'),'',{fetcher:mock}));
});
test('HTTP and data failures are surfaced without exposing keys',async()=>{
 const u=mpSearchUrl('Si');
 await assert.rejects(mpApiGet(u,'secret',{fetcher:async()=>({ok:false,status:401,headers:{get:()=>null}})}),/401/);
 await assert.rejects(mpApiGet(u,'secret',{fetcher:async()=>({ok:true,status:200,headers:{get:()=>null},text:async()=>JSON.stringify({errors:['no']})})}),/data/);
});
