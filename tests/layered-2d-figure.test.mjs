import test from 'node:test';
import assert from 'node:assert/strict';
import {idealMx2Monolayer,mx2Supercell,buildLayeredFigure,MX2_SOURCE} from '../layered-2d-figure.js';

const approx=(actual,expected,tolerance=1e-8)=>assert.ok(Math.abs(actual-expected)<tolerance,actual+' ≠ '+expected);

test('ideal 1H and 1T monolayers contain 1 Mo and 2 S sites with correct layer registries',()=>{
 const h=idealMx2Monolayer('1H'),t=idealMx2Monolayer('1T');
 for(const cell of [h,t]){
  assert.deepEqual(cell.sites.map(s=>s.symbol),['Mo','S','S']);
  assert.equal(cell.cell.gamma,120);
  assert.equal(cell.cell.c,20);
  approx(cell.cell.a,3.166);
  approx((cell.sites[1].f[2]-cell.sites[2].f[2])*20,MX2_SOURCE.planeSeparation);
 }
 assert.deepEqual(h.sites[1].f.slice(0,2),h.sites[2].f.slice(0,2),
  '1H top/bottom sulfur planes are aligned in top projection');
 assert.notDeepEqual(t.sites[1].f.slice(0,2),t.sites[2].f.slice(0,2),
  '1T sulfur planes are staggered');
 assert.throws(()=>idealMx2Monolayer('2H'),/fazı/);
});

test('5×5 slab preserves correct counts and six in-plane nearest-neighbor M-X links',()=>{
 for(const phase of ['1H','1T']){
  const patch=mx2Supercell(phase,5,5);
  assert.equal(patch.atoms.length,75);
  assert.equal(patch.atoms.filter(a=>a.symbol==='Mo').length,25);
  assert.equal(patch.atoms.filter(a=>a.symbol==='S').length,50);
  const id=phase+'-2-2-0';
  const neighbors=patch.bonds.filter(b=>b.from===id);
  assert.equal(neighbors.length,6,phase+' center Mo must have six S neighbors');
  neighbors.forEach(b=>approx(b.length,Math.hypot(3.166/Math.sqrt(3),3.092/2),.01));
 }
});

test('independent 2D SVG renders phase comparison without raster or canvas',()=>{
 const figure=buildLayeredFigure({mode:'compare',na:5,nb:4});
 assert.equal(figure.panels.length,4);
 assert.deepEqual(figure.panels,[{phase:'1H',view:'top'},{phase:'1T',view:'top'},
  {phase:'1H',view:'side'},{phase:'1T',view:'side'}]);
 assert.equal(figure.atomsPerPhase,60);
 assert.match(figure.svg,/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
 assert.equal((figure.svg.match(/class="mx2-panel"/g)||[]).length,4);
 assert.ok(figure.svg.includes('MoS₂'));
 assert.ok(!/data:image|<image|<canvas|foreignObject/.test(figure.svg));
 assert.match(figure.svg,/stroke-dasharray=/);
 assert.ok(figure.width>1000&&figure.height>600);
});

test('top / side / single phase modes share the same validated geometry options',()=>{
 for(const mode of ['top','side']){
  const figure=buildLayeredFigure({mode,phase:'both',na:3,nb:2});
  assert.equal(figure.panels.length,2);
  assert.ok(figure.panels.every(p=>p.view===mode));
 }
 const one=buildLayeredFigure({mode:'top',phase:'1T',showBonds:false,showCell:false,showLegend:false});
 assert.equal(one.panels.length,1);
 assert.ok(!one.svg.includes('stroke="#8795a5"'));
 assert.ok(!one.svg.includes('stroke-dasharray'));
 assert.ok(!one.svg.includes('Mo · metal'));
});

test('bounded input cannot trigger huge SVG or NaN/Infinity coordinates',()=>{
 for(const bad of [0,7,-1,1.2,NaN,Infinity,'abc'])
  assert.throws(()=>buildLayeredFigure({na:bad}),/a tekrarı/);
 assert.throws(()=>buildLayeredFigure({phase:'2H'}),/faz seçimi/);
 assert.throws(()=>buildLayeredFigure({mode:'spin'}),/figür düzeni/);
 const full=buildLayeredFigure({na:6,nb:6});
 assert.ok(!/NaN|Infinity/.test(full.svg));
 assert.ok(full.svg.length<1_000_000);
 assert.equal(full.atomsPerPhase,108);
});
