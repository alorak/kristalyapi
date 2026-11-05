import test from 'node:test';
import assert from 'node:assert/strict';
import {analyzeCifLayers,buildCifLayerFigure} from '../layered-2d-cif.js';
import {buildFigurePdf} from '../layered-2d-export.js';

const sample={
 name:'MoS2_FROM_ACTIVE_CIF',workspace:'Yapı 4',cell:{a:3.16,b:3.16,c:20,alpha:90,beta:90,gamma:120},
 sites:[{symbol:'Mo',x:0,y:0,z:.5},{symbol:'S',x:1/3,y:2/3,z:.578},
  {symbol:'S',x:1/3,y:2/3,z:.422}]
};
test('actual fractional coordinates and lattice generate 2D SVG, not ideal MoS2 preset',()=>{
 const structure=structuredClone(sample);
 structure.sites[0].symbol='W';structure.name='WS2_from_imported_CIF';
 const data=analyzeCifLayers(structure);
 assert.equal(data.groups.length,1);
 assert.equal(data.groups[0].atomCount,3);
 assert.ok(data.gaps[0]>15);
 const fig=buildCifLayerFigure({structure,na:4,nb:4,mode:'compare'});
 assert.equal(fig.panels.length,2);
 assert.equal(fig.atomsPerPhase,48);
 assert.match(fig.svg,/WS2_from_imported_CIF/);
 assert.match(fig.svg,/<circle/);
 assert.match(fig.svg,/data-view="top"/);
 assert.match(fig.svg,/data-view="side"/);
 assert.ok(!fig.svg.includes('Mo · metal'));
});
test('layer separation identifies two periodic groups, and layer selection changes atoms',()=>{
 const structure={...sample,cell:{...sample.cell,c:30},sites:[
  {symbol:'Mo',x:0,y:0,z:.2},{symbol:'S',x:.33,y:.67,z:.24},{symbol:'S',x:.33,y:.67,z:.16},
  {symbol:'W',x:.5,y:.5,z:.7},{symbol:'Se',x:.8,y:.5,z:.74},{symbol:'Se',x:.8,y:.5,z:.66}
 ]};
 const layers=analyzeCifLayers(structure,{axis:'c',minGap:2.2});
 assert.equal(layers.groups.length,2);
 const a=buildCifLayerFigure({structure,layerIndex:0,na:2,nb:2,mode:'top'});
 const b=buildCifLayerFigure({structure,layerIndex:1,na:2,nb:2,mode:'top'});
 assert.equal(a.panels.length,1);assert.equal(b.panels.length,1);
 assert.equal(a.atomsPerPhase,12);assert.equal(b.atomsPerPhase,12);
 assert.notEqual(a.svg,b.svg);
});
test('dense periodic structure with no clear layer gap fails explicitly',()=>{
 const structure={name:'bulk cubic',cell:{a:5,b:5,c:5,alpha:90,beta:90,gamma:90},
  sites:[0,.25,.5,.75].map(z=>({symbol:'Si',x:z,y:z,z}))};
 assert.throws(()=>analyzeCifLayers(structure),/ayırıcı boşluk/);
});
test('bad cells, oversized atom count, partial occupancy and XSS are not rendered',()=>{
 assert.throws(()=>analyzeCifLayers({...sample,cell:{...sample.cell,gamma:0}}),/geçersiz/i);
 assert.throws(()=>analyzeCifLayers({...sample,sites:[{symbol:'Mo',x:0,y:0,z:0,occupancy:.5}]}),/Kısmi/);
 assert.throws(()=>buildCifLayerFigure({structure:sample,na:7}),/tekrarı/);
 const evil={...sample,name:'<script>alert(1)</script>'};
 const fig=buildCifLayerFigure({structure:evil});
 assert.ok(!fig.svg.includes('<script>'));
 assert.ok(fig.svg.includes('&lt;script&gt;'));
});
test('image-based PDF builder produces PDF 1.4 object tree and xref',()=>{
 // Structural PDF test with minimal marker bytes; actual JPEG content tested in Chromium.
 const jpeg=new Uint8Array([255,216,255,217]);
 const pdf=buildFigurePdf(jpeg,1200,800);
 const text=new TextDecoder('latin1').decode(pdf);
 assert.match(text,/^%PDF-1\.4/);
 assert.match(text,/\/Subtype \/Image/);
 assert.match(text,/\/MediaBox/);
 assert.match(text,/xref\n0 6/);
 assert.match(text,/%%EOF/);
});
