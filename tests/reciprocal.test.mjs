// Scientific regression tests for the dependency-free reciprocal-space core.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as R from '../reciprocal-core.js';

const approx=(a,b,eps=1e-9,msg='')=>assert.ok(Math.abs(a-b)<=eps,`${msg} ${a} ≠ ${b} (±${eps})`);
const cubic=a=>({a,b:a,c:a,alpha:90,beta:90,gamma:90});
const diamond=(()=>{const base=[[0,0,0],[0,.5,.5],[.5,0,.5],[.5,.5,0]];
 return [...base,...base.map(p=>p.map(v=>v+.25))].map(([x,y,z])=>({symbol:'Si',x,y,z}));})();
const rocksalt=[[0,0,0],[0,.5,.5],[.5,0,.5],[.5,.5,0]].flatMap(([x,y,z])=>
 [{symbol:'Na',x,y,z},{symbol:'Cl',x:(x+.5)%1,y,z}]);

test('reciprocal basis is dual to the real basis for a triclinic cell, with and without 2π',()=>{
 const A=R.cellVectors({a:4.1,b:5.3,c:6.2,alpha:78,beta:84,gamma:71});
 const B=R.reciprocalVectors(A),B2=R.reciprocalVectors(A,{twoPi:true});
 for(let i=0;i<3;i++)for(let j=0;j<3;j++){
  approx(R.dot(A[i],B[j]),i===j?1:0,1e-12);approx(R.dot(A[i],B2[j]),i===j?2*Math.PI:0,1e-11);
 }
 const p=R.reciprocalCellParameters(A);
 approx(p.volume*p.realVolume,1,1e-12,'V*·V');
});

test('d(hkl)=1/|G| matches the cubic formula and G is normal to the (hkl) plane',()=>{
 const A=R.cellVectors(cubic(5.431)),B=R.reciprocalVectors(A);
 approx(R.dSpacing([1,1,1],B),5.431/Math.sqrt(3),1e-12);
 approx(R.dSpacing([2,2,0],B),5.431/Math.sqrt(8),1e-12);
 const T=R.cellVectors({a:4.1,b:5.3,c:6.2,alpha:78,beta:84,gamma:71}),Bt=R.reciprocalVectors(T);
 const [h,k,l]=[2,-1,3],G=R.gVector([h,k,l],Bt);
 // Two in-plane vectors of the (hkl) plane: a/h − b/k and a/h − c/l.
 const u=R.sub(R.scale(T[0],1/h),R.scale(T[1],1/k)),v=R.sub(R.scale(T[0],1/h),R.scale(T[2],1/l));
 approx(R.dot(G,u),0,1e-12);approx(R.dot(G,v),0,1e-12);
 const polys=R.planeCellPolygons([h,k,l],T);
 assert.ok(polys.length>=4);
 for(const poly of polys)for(const p of poly.points)approx(R.dot(G,p),poly.t,1e-9,'plane point');
 assert.throws(()=>R.dSpacing([0,0,0],B));
});

test('relativistic electron wavelength and Mott–Bethe prefactor',()=>{
 approx(R.electronWavelength(200),0.025079,2e-6,'200 kV');
 approx(R.electronWavelength(300),0.019687,2e-6,'300 kV');
 approx(R.MOTT_BETHE_A,0.023934,2e-6);
 assert.throws(()=>R.mottBethe(14,10,0));
});

test('zone-axis reflections satisfy hu+kv+lw=0 and lie in the plane normal to [uvw]',()=>{
 const A=R.cellVectors(cubic(5.431));
 const zone=R.zoneAxisReflections(A,[1,1,0],1.2);
 assert.ok(zone.points.length>10);
 for(const p of zone.points){
  assert.equal(p.h+p.k,0);approx(R.dot(p.G,zone.normal),0,1e-12);
  approx(Math.hypot(p.x,p.y),p.g,1e-12);
 }
 // Electrons: in the ZOLZ with the beam along [uvw], s = −λg²/2 exactly.
 const lambda=R.electronWavelength(200),k=R.scale(zone.normal,1/lambda),p=zone.points[3];
 approx(R.excitationError(k,p.G),-lambda*p.g*p.g/2,1e-12);
 approx(R.shapeFactor(0,500),1);approx(R.shapeFactor(1/500,500),0,1e-12);
});

test('Ewald section: points on the circle obey Bragg 2θ and powder shells intersect correctly',()=>{
 const lambda=1.5406,g=1/3.1356,twoTheta=2*Math.asin(lambda*g/2);
 // ω = 0: beam along +x, Ewald centre C = (−1/λ, 0). A point C + R(cosφ, sinφ)
 // has |G|² = 2R²(1 − cosφ); choose φ so that |G| = g.
 const R0=1/lambda,phi=Math.acos(1-g*g/(2*R0*R0)),x=-R0+R0*Math.cos(phi),y=R0*Math.sin(phi);
 const pts=[{x:0,y:0.01},{x,y}];
 const sec=R.ewaldSection(pts,lambda,0,1e-9);
 approx(Math.hypot(x,y),g,1e-12,'constructed |G|');
 assert.equal(sec.points[1].onSphere,true);assert.equal(sec.points[0].onSphere,false);
 approx(sec.points[1].twoTheta,twoTheta*180/Math.PI,1e-9);
 // Scattering angle = angle between incident k and diffracted (G − C).
 const kout=[x-sec.center[0],y-sec.center[1]];
 approx(Math.acos(kout[0]/Math.hypot(...kout)),twoTheta,1e-12,'2θ from geometry');
 const w=Math.PI/6,C30=[-R0*Math.cos(w),-R0*Math.sin(w)];
 for(const P of R.powderShellIntersections(lambda,30,g)){
  approx(Math.hypot(...P),g,1e-12,'on shell');
  approx(Math.hypot(P[0]-C30[0],P[1]-C30[1]),R0,1e-12,'on Ewald circle');
 }
 assert.deepEqual(R.powderShellIntersections(lambda,0,2/lambda+1e-3),[]);
});

test('Bragg rotations put each zone reflection exactly on the Ewald circle',()=>{
 const A=R.cellVectors(cubic(5.431)),lambda=1.5406;
 const zone=R.zoneAxisReflections(A,[0,0,1],2/lambda);
 const rotations=R.braggRotations(zone.points,lambda);
 assert.ok(rotations.length>=2*zone.points.length-4);
 for(const r of rotations.slice(0,40)){
  const p=zone.points.find(q=>q.h===r.h&&q.k===r.k&&q.l===r.l);
  const sec=R.ewaldSection([p],lambda,-r.omega,1e-9);
  assert.ok(sec.points[0].onSphere,`${r.h}${r.k}${r.l} at ω=${r.omega}`);
 }
 const next=R.nextBraggRotation(zone.points,lambda,20);
 assert.ok(next.omega>20&&rotations.every(r=>r.omega<=20+1e-3||r.omega>=next.omega));
 assert.equal(R.nextBraggRotation(zone.points,lambda,359.99).omega,rotations[0].omega,'wraps around');
});

test('pure translations detect F, I and P lattices and reject species-changing shifts',()=>{
 assert.equal(R.pureTranslations(diamond).length,3);
 assert.equal(R.pureTranslations(rocksalt).length,3);
 assert.equal(R.pureTranslations([{symbol:'Fe',x:0,y:0,z:0},{symbol:'Fe',x:.5,y:.5,z:.5}]).length,1);
 assert.equal(R.pureTranslations([{symbol:'Cs',x:0,y:0,z:0},{symbol:'Cl',x:.5,y:.5,z:.5}]).length,0);
 const prim=R.primitiveLattice(R.cellVectors(cubic(5.431)),R.pureTranslations(diamond));
 approx(prim.volume,5.431**3/4,1e-9);approx(R.det3(prim.vectors),prim.volume,1e-9);
 for(const v of prim.vectors)approx(R.norm(v),5.431/Math.SQRT2,1e-9,'fcc primitive length');
});

test('Bravais classification of the editor examples',()=>{
 assert.equal(R.bravaisType(cubic(5.431),R.pureTranslations(diamond)),'FCC');
 assert.equal(R.bravaisType(cubic(4),[]),'CUB');
 assert.equal(R.bravaisType(cubic(2.87),[[.5,.5,.5]]),'BCC');
 assert.equal(R.bravaisType({a:2.46,b:2.46,c:6.7,alpha:90,beta:90,gamma:120},[]),'HEX');
 assert.equal(R.bravaisType({a:3,b:3,c:5,alpha:90,beta:90,gamma:90},[]),'TET');
 assert.equal(R.bravaisType({a:3,b:4,c:5,alpha:90,beta:90,gamma:90},[]),'ORC');
 assert.equal(R.bravaisType({a:3,b:4,c:5,alpha:90,beta:100,gamma:90},[]),null);
});

const shape=(type,cell,sites)=>{
 const r=R.brillouinAnalysis(cell,sites);
 return {r,faces:r.zone.faces.length,vertices:r.zone.vertices.length};
};
test('first Brillouin zone shapes and volume (2π)³/V_prim',()=>{
 const fcc=shape('FCC',cubic(5.431),diamond);
 assert.equal(fcc.faces,14);assert.equal(fcc.vertices,24); // truncated octahedron
 assert.equal(fcc.r.zone.faces.filter(f=>f.vertices.length===6).length,8);
 approx(fcc.r.zone.volume,(2*Math.PI)**3/(5.431**3/4),1e-6*fcc.r.zone.volume);
 const bcc=shape('BCC',cubic(2.87),[{symbol:'Fe',x:0,y:0,z:0},{symbol:'Fe',x:.5,y:.5,z:.5}]);
 assert.equal(bcc.faces,12);assert.equal(bcc.vertices,14); // rhombic dodecahedron
 const sc=shape('CUB',cubic(4),[{symbol:'Po',x:0,y:0,z:0}]);
 assert.equal(sc.faces,6);assert.equal(sc.vertices,8);
 const hex=shape('HEX',{a:3,b:3,c:5,alpha:90,beta:90,gamma:120},[{symbol:'Mg',x:0,y:0,z:0}]);
 assert.equal(hex.faces,8);assert.equal(hex.vertices,12); // hexagonal prism
 approx(hex.r.zone.volume,hex.r.zoneVolumeExpected,1e-6*hex.r.zoneVolumeExpected);
 const tri=R.brillouinAnalysis({a:4.1,b:5.3,c:6.2,alpha:78,beta:84,gamma:71},[{symbol:'O',x:0,y:0,z:0}]);
 assert.equal(tri.type,null);
 approx(tri.zone.volume,tri.zoneVolumeExpected,1e-6*tri.zoneVolumeExpected);
});

test('Setyawan–Curtarolo special points sit on the zone boundary (Γ inside)',()=>{
 const check=(cell,sites,onSurface,vertices=[])=>{
  const r=R.brillouinAnalysis(cell,sites);assert.ok(r.path,'path for '+r.type);
  assert.ok(R.wignerSeitzMargin(r.zone,r.path.points['Γ'])<0);
  const scaleK=Math.max(...r.zone.vertices.map(R.norm));
  for(const label of onSurface)approx(R.wignerSeitzMargin(r.zone,r.path.points[label]),0,1e-9*scaleK,r.type+' '+label);
  for(const label of vertices)assert.ok(r.zone.vertices.some(v=>R.norm(R.sub(v,r.path.points[label]))<1e-9*scaleK),r.type+' vertex '+label);
  return r;
 };
 check(cubic(5.431),diamond,['X','W','K','L','U'],['W']);
 check(cubic(2.87),[{symbol:'Fe',x:0,y:0,z:0},{symbol:'Fe',x:.5,y:.5,z:.5}],['H','N','P'],['H','P']);
 check(cubic(4),[{symbol:'Po',x:0,y:0,z:0}],['X','M','R'],['R']);
 check({a:3,b:3,c:5,alpha:90,beta:90,gamma:120},[{symbol:'Mg',x:0,y:0,z:0}],['M','K','A','L','H'],['H']);
 check({a:3,b:3,c:5,alpha:90,beta:90,gamma:90},[{symbol:'Sn',x:0,y:0,z:0}],['X','M','Z','R','A'],['A']);
 check({a:3,b:4,c:5,alpha:90,beta:90,gamma:90},[{symbol:'Ga',x:0,y:0,z:0}],['X','Y','Z','S','U','T','R'],['R']);
});

test('k-path sampling joins "|" segments and empty-lattice bands fold correctly at Γ and X',()=>{
 const a=5.431,r=R.brillouinAnalysis(cubic(a),diamond),s=R.sampleKPath(r.path,{density:40});
 assert.equal(s.ticks[0].label,'Γ');
 assert.ok(s.ticks.some(t=>t.label==='K|U'));
 assert.ok(s.samples.every((p,i)=>i===0||p.x>=s.samples[i-1].x-1e-12));
 const unit=R.HBAR2_2ME_EV_A2*(2*Math.PI/a)**2;
 const bands=R.emptyLatticeBands([{k:[0,0,0]},{k:r.path.points.X}],r.reciprocalPrimitive,{nBands:16});
 // fcc at Γ: |G|² in (2π/a)² units = 0, 3 (×8), 4 (×6)
 approx(bands[0][0],0,1e-9);
 for(let i=1;i<=8;i++)approx(bands[0][i],3*unit,1e-9*unit,'Γ 111 shell');
 for(let i=9;i<=14;i++)approx(bands[0][i],4*unit,1e-9*unit,'Γ 200 shell');
 // At X = (2π/a)(0,1,0): the two lowest bands are degenerate (|k|² = |k−G|² = 1).
 approx(bands[1][0],unit,1e-9*unit);approx(bands[1][1],unit,1e-9*unit);
 const heavy=R.emptyLatticeBands([{k:r.path.points.X}],r.reciprocalPrimitive,{nBands:1,mass:2});
 approx(heavy[0][0],unit/2,1e-9*unit);
});

test('kinematic structure factor reproduces diamond extinctions (200 forbidden, 220 allowed)',()=>{
 const A=R.cellVectors(cubic(5.431)),B=R.reciprocalVectors(A),amp=()=>1;
 approx(R.kinematicF(diamond,[2,0,0],B,amp).intensity,0,1e-20);
 approx(R.kinematicF(diamond,[1,0,0],B,amp).intensity,0,1e-20);
 approx(R.kinematicF(diamond,[2,2,0],B,amp).intensity,64,1e-9);
 approx(R.kinematicF(diamond,[1,1,1],B,amp).intensity,32,1e-9);
});
