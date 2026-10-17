// Independent periodic-image oracle for the production crystal-app.js functions.
// No externally shipped dependencies: Node.js 22 native test runner only.
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const src=fs.readFileSync(require('node:path').join(__dirname,'../crystal-app.js'),'utf8');
const a=src.indexOf('function coordinationImageBounds('),b=src.indexOf('/* Choose a viable center',a);
assert.ok(a>=0&&b>a,'production coordination functions must be discoverable');
const cart=(d,B)=>[0,1,2].map(k=>d.reduce((s,v,i)=>s+v*B[i][k],0));
const ctx={
 frac:n=>((n%1)+1)%1,
 bondRange:(_a,_b,r)=>r,
 toCart:(d,B)=>{const [x,y,z]=cart(d,B);return {x,y,z,length:()=>Math.hypot(x,y,z)};}
};
vm.createContext(ctx);
vm.runInContext(src.slice(a,b)+';this.neighbors=coordinationNeighbors;this.geometry=coordinationGeometry;this.hull=coordinationHullMetrics;this.distortion=polyhedralDistortionMetrics',ctx);
const atom=(symbol,x,y,z,occupancy=1)=>({symbol,x,y,z,occupancy});
function independentImages(sites,B,range,search=6,centerIndex=0){
 const center=sites[centerIndex],result=[];
 for(let j=0;j<sites.length;j++){
  if((sites[j].occupancy??1)===0)continue;
  for(let x=-search;x<=search;x++)for(let y=-search;y<=search;y++)for(let z=-search;z<=search;z++){
   if(j===centerIndex&&!x&&!y&&!z)continue;
   const delta=[x,y,z].map((v,k)=>v+sites[j][['x','y','z'][k]]-center[['x','y','z'][k]]);
   const distance=Math.hypot(...cart(delta,B));
   if(distance<1e-5||distance<range[0]-1e-6||distance>range[1]+1e-6)continue;
   result.push({index:j,element:sites[j].symbol,shift:[x,y,z],distance,occupancy:sites[j].occupancy??1,delta});
  }
 }
 return result.sort((a,b)=>a.distance-b.distance||a.index-b.index||
   a.shift[0]-b.shift[0]||a.shift[1]-b.shift[1]||a.shift[2]-b.shift[2]);
}
function compare(name,sites,B,range,cn){
 test(name,()=>{
  const got=ctx.neighbors(sites,0,B,range,0,false,24);
  const expected=independentImages(sites,B,range);
  assert.equal(got.length,expected.length);
  if(cn!==undefined)assert.equal(got.length,cn);
  for(let i=0;i<got.length;i++){
   assert.equal(got[i].index,expected[i].index);
   assert.deepEqual([...got[i].shift],[...expected[i].shift]);
   assert.ok(Math.abs(got[i].distance-expected[i].distance)<1e-8);
   assert.equal(got[i].occupancy,expected[i].occupancy);
  }
 });
}
compare('P7.8 simple cubic CN6',[atom('Na',0,0,0)],[[3,0,0],[0,3,0],[0,0,3]],[2.99,3.01],6);
compare('P7.8 BCC CN8',[atom('Fe',0,0,0),atom('Fe',.5,.5,.5)],[[3,0,0],[0,3,0],[0,0,3]],[2.59,2.61],8);
compare('P7.8 FCC CN12',[atom('Cu',0,0,0),atom('Cu',0,.5,.5),atom('Cu',.5,0,.5),atom('Cu',.5,.5,0)],[[4,0,0],[0,4,0],[0,0,4]],[2.82,2.84],12);
compare('P7.8 triclinic periodic distances',[atom('Si',.1,.2,.3),atom('O',.4,.5,.6)],[[4,0,0],[1.5,4.5,0],[.8,1.1,5.2]],[.01,2.9]);
compare('P7.8 acute skew cell requires images beyond one unit cell',
 [atom('Si',0,0,0)],[[3,0,0],[2.85,.3,0],[0,0,4]],[.66,.68],2);

test('P7.8 zero occupancy is ignored, partial mixed-site occupancies stay distinct',()=>{
 const B=[[4,0,0],[0,4,0],[0,0,4]];
 const sites=[atom('Ti',0,0,0),atom('O',.125,0,0,.4),atom('F',.125,0,0,.6),
              atom('N',.125,0,0,0)];
 const shell=ctx.neighbors(sites,0,B,[.49,.51],0,false,24);
 assert.equal(shell.length,2);
 // The production function executes in a separate vm context: Array.from
 // creates the comparison array in the test realm for strict deep equality.
 assert.deepEqual(Array.from(shell,n=>n.element).sort(),['F','O']);
 const env=ctx.geometry(shell,B);
 assert.equal(env.geometricCN,2);
 assert.ok(Math.abs(env.weightedCN-1)<1e-12);
 assert.equal(env.vertexCount,1,'two alternative species do not create two hull vertices');
 assert.equal(env.angles.length,0);
});

test('P7.8 full octahedral Ti–O geometry has six unique vertices and 90/180 degree angles',()=>{
 const B=[[4,0,0],[0,4,0],[0,0,4]];
 const sites=[atom('Ti',0,0,0),
  atom('O',.5,0,0),atom('O',0,.5,0),atom('O',0,0,.5)];
 const shell=ctx.neighbors(sites,0,B,[1.99,2.01],0,false,24);
 const env=ctx.geometry(shell,B);
 assert.equal(env.geometricCN,6);
 assert.equal(env.vertexCount,6);
 assert.equal(env.weightedCN,6);
 assert.equal(env.angles.length,15);
 const counts=env.angles.reduce((sum,a)=>{assert.ok(Math.min(Math.abs(a-90),Math.abs(a-180))<1e-8);return sum+(Math.abs(a-180)<1e-8?1:0);},0);
 assert.equal(counts,3);
 assert.ok(Math.abs(env.angleMin-90)<1e-9);
 assert.ok(Math.abs(env.angleMax-180)<1e-9);
});

test('P7.8 hull triangle soup matches independent tetrahedron area and volume',()=>{
 const vertices=[[0,0,0],[1,0,0],[0,1,0],[0,0,1]];
 const faces=[[0,2,1],[0,1,3],[0,3,2],[1,2,3]];
 const triples=faces.flatMap(face=>face.flatMap(i=>vertices[i]));
 const positions={count:triples.length/3,getX:i=>triples[i*3],getY:i=>triples[i*3+1],getZ:i=>triples[i*3+2]};
 const result=ctx.hull({getAttribute:key=>key==='position'?positions:null});
 assert.ok(Math.abs(result.volume-1/6)<1e-12);
 assert.ok(Math.abs(result.area-(3+Math.sqrt(3))/2)<1e-12);
});

test('P7.8 malformed and degenerate geometry cannot pass as valid hull',()=>{
 const vertices=Array.from({length:12},(_,i)=>[i,0,0]);
 const positions={count:vertices.length,getX:i=>vertices[i][0],getY:i=>0,getZ:i=>0};
 assert.throws(()=>ctx.hull({getAttribute:()=>positions}),/kapalı hacim/);
 const B=[[3,0,0],[2.99999,.00001,0],[0,0,3]];
 assert.throws(()=>ctx.neighbors([atom('Si',0,0,0)],0,B,[0,1],0,false,24),/çok büyük/);
 assert.throws(()=>ctx.neighbors([atom('Si',0,0,0),atom('O',.5,0,0,1.3)],0,
   [[4,0,0],[0,4,0],[0,0,4]],[0,4],0,false,24),/doluluğu/);
});


// Verify the other periodic features use the same metric-bounded image logic.
const c=src.indexOf('function minimumPeriodicImage('),d=src.indexOf('function planeNormal(',c);
assert.ok(c>=0&&d>c);
vm.runInContext(src.slice(c,d)+';this.minimum=minimumPeriodicImage;this.periodicSegments=periodicBondSegments',ctx);
const e=src.indexOf('function bondNetwork('),f=src.indexOf('function bondNetworkCsv(',e);
assert.ok(e>=0&&f>e);
ctx.basis=B=>B;
vm.runInContext(src.slice(e,f)+';this.network=bondNetwork',ctx);

test('P7.8 exact minimum-image calculation reaches a translated atom two cells away',()=>{
 const B=[[3,0,0],[2.85,.3,0],[0,0,4]];
 const result=ctx.minimum([0,0,0],[.4,.2,0],B);
 const best=independentImages([atom('Si',0,0,0),atom('O',.4,.2,0)],B,[0,10])
  .filter(x=>x.index===1)[0];
 assert.ok(Math.abs(result.distance-best.distance)<1e-9);
 assert.deepEqual([...result.shift],[...best.shift]);
 assert.deepEqual([...result.shift],[1,-2,0]);
});

test('P7.8 periodic image indices canonicalize negative zero',()=>{
 const B=[[4,0,0],[0,4,0],[0,0,4]];
 const fcc=[atom('Cu',0,0,0),atom('Cu',0,.5,.5),
  atom('Cu',.5,0,.5),atom('Cu',.5,.5,0)];
 const neighbors=ctx.neighbors(fcc,0,B,[2.82,2.84],0,false,24);
 assert.equal(neighbors.length,12);
 for(const neighbor of neighbors)for(const shift of neighbor.shift)
  assert.equal(Object.is(shift,-0),false,'image indices must be canonical integers');
 const identical=ctx.minimum([.2,.3,.4],[.2,.3,.4],B);
 assert.deepEqual(Array.from(identical.shift),[0,0,0]);
 const skew=[[3,0,0],[2.85,.3,0],[0,0,4]];
 const shifted=ctx.minimum([0,0,0],[.4,.2,0],skew);
 for(const index of shifted.shift)assert.equal(Object.is(index,-0),false);
});

test('P7.8 skew-cell periodic bonds cross two unit cells in both graph and renderer',()=>{
 const B=[[3,0,0],[2.85,.3,0],[0,0,4]];
 const sites=[atom('Si',0,0,0)];
 const range=[.66,.68];
 const graph=ctx.network(sites,B,{periodic:true,rules:range,cut:.68,auto:false});
 assert.equal(graph.edges.length,1);
 assert.ok(Math.max(...graph.edges[0].shift.map(Math.abs))>=2);
 const clipped=ctx.periodicSegments(sites,[3,3,1],B,range,.68,6500,false);
 assert.ok(clipped.segments.length>0);
 assert.ok(!clipped.truncated);
 for(const [a,b] of clipped.segments){
  const distance=Math.hypot(a.x-b.x,a.y-b.y,a.z-b.z);
  assert.ok(distance>0&&distance<.69);
 }
});


/* Package 7.9: independent analytic fixtures. These tests intentionally use
   hand-constructed geometries, not production ConvexGeometry or CIF readers. */
function mockHull(vertices,triangles){
 const xyz=triangles.flatMap(t=>t.flatMap(i=>vertices[i]));
 const p={count:xyz.length/3,getX:i=>xyz[3*i],getY:i=>xyz[3*i+1],getZ:i=>xyz[3*i+2]};
 return {getAttribute:key=>key==='position'?p:null};
}
function centeredShell(points){
 return ctx.geometry(points.map((xyz,i)=>({
  index:i,element:'O',distance:Math.hypot(...xyz),
  delta:xyz,shift:[0,0,0],occupancy:1
 })),[[1,0,0],[0,1,0],[0,0,1]]);
}
function faceOutward(vertices,faces){
 return faces.map(face=>{
  const [a,b,c]=face.map(i=>vertices[i]),u=b.map((v,k)=>v-a[k]),v=c.map((w,k)=>w-a[k]);
  const normal=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  return a.reduce((sum,x,k)=>sum+x*normal[k],0)>0?face:[face[0],face[2],face[1]];
 });
}

test('P7.9 ideal octahedron matches VESTA D=0 ECoN=6 lambda=1 variance=0',()=>{
 const v=[[2,0,0],[-2,0,0],[0,2,0],[0,-2,0],[0,0,2],[0,0,-2]];
 const faces=[];for(const x of [0,1])for(const y of [2,3])for(const z of [4,5])faces.push([x,y,z]);
 const hull=mockHull(v,faceOutward(v,faces)),shape=ctx.hull(hull);
 const env=centeredShell(v);
 const m=ctx.distortion(env,hull,shape);
 assert.ok(Math.abs(shape.volume-32/3)<1e-12);
 assert.equal(m.polyhedronType,'octahedron');
 assert.equal(m.hullEdgeCount,12);
 assert.ok(Math.abs(m.meanBondLength-2)<1e-12);
 assert.ok(Math.abs(m.distortionIndex)<1e-12);
 assert.ok(Math.abs(m.econ-6)<1e-12);
 assert.ok(Math.abs(m.quadraticElongation-1)<1e-12);
 assert.ok(Math.abs(m.bondAngleVariance)<1e-12);
});

test('P7.9 ideal tetrahedron matches regular tetrahedral analytical values',()=>{
 const v=[[1,1,1],[1,-1,-1],[-1,1,-1],[-1,-1,1]];
 const faces=faceOutward(v,[[0,1,2],[0,1,3],[0,2,3],[1,2,3]]);
 const hull=mockHull(v,faces),shape=ctx.hull(hull);
 const m=ctx.distortion(centeredShell(v),hull,shape);
 assert.ok(Math.abs(shape.volume-8/3)<1e-12);
 assert.equal(m.polyhedronType,'tetrahedron');
 assert.equal(m.hullEdgeCount,6);
 assert.ok(Math.abs(m.distortionIndex)<1e-12);
 assert.ok(Math.abs(m.econ-4)<1e-12);
 assert.ok(Math.abs(m.quadraticElongation-1)<1e-12);
 assert.ok(Math.abs(m.bondAngleVariance)<1e-12);
 assert.ok(Math.abs(m.idealAngle-Math.acos(-1/3)*180/Math.PI)<1e-12);
});

test('P7.9 bond length distortion agrees with independent Baur mean and Hoppe weights',()=>{
 const points=[[1.6,0,0],[-2,0,0],[0,2.3,0],[0,-2,0],[0,0,2],[0,0,-2]];
 const env=centeredShell(points),m=ctx.distortion(env);
 const lengths=[1.6,2,2.3,2,2,2],mean=lengths.reduce((a,b)=>a+b,0)/6;
 const D=lengths.reduce((sum,v)=>sum+Math.abs(v-mean)/mean,0)/6;
 assert.ok(Math.abs(m.meanBondLength-mean)<1e-12);
 assert.ok(Math.abs(m.distortionIndex-D)<1e-12);
 // Official Hoppe reference: lav from lmin, then w_i from lav (power six).
 const weights=lengths.map(l=>Math.exp(1-(l/1.6)**6));
 const lav=lengths.reduce((sum,l,i)=>sum+l*weights[i],0)/weights.reduce((a,b)=>a+b,0);
 const econ=lengths.reduce((sum,l)=>sum+Math.exp(1-(l/lav)**6),0);
 assert.ok(Math.abs(m.hoppeMean-lav)<1e-12);
 assert.ok(Math.abs(m.econ-econ)<1e-12);
 assert.ok(m.econ<6);
});

test('P7.9 distorted octahedron has nonzero quadratic elongation and angle variance',()=>{
 const v=[[2.2,.12,0],[-2,0,0],[0,2.0,.1],[0,-2,0],[0,0,2],[0,0,-2]];
 const faces=[];for(const x of [0,1])for(const y of [2,3])for(const z of [4,5])faces.push([x,y,z]);
 const hull=mockHull(v,faceOutward(v,faces)),shape=ctx.hull(hull);
 const m=ctx.distortion(centeredShell(v),hull,shape);
 assert.equal(m.polyhedronType,'octahedron');
 assert.ok(m.distortionIndex>0);
 assert.ok(m.quadraticElongation>1);
 assert.ok(m.bondAngleVariance>0);
});

test('P7.9 triangular prism must not be misclassified as an octahedron',()=>{
 const h=Math.sqrt(3)/2;
 const v=[[1,0,-1],[-.5,h,-1],[-.5,-h,-1],
   [1,0,1],[-.5,h,1],[-.5,-h,1]];
 const faces=faceOutward(v,[[0,2,1],[3,4,5],
   [0,1,4],[0,4,3],[1,2,5],[1,5,4],[2,0,3],[2,3,5]]);
 const hull=mockHull(v,faces),shape=ctx.hull(hull);
 const m=ctx.distortion(centeredShell(v),hull,shape);
 assert.equal(m.polyhedronType,null);
 assert.equal(m.quadraticElongation,null);
 assert.equal(m.bondAngleVariance,null);
 assert.ok(Number.isFinite(m.econ));
});

test('P7.9 disordered mixed-site shell flags a geometric-only interpretation',()=>{
 const env=ctx.geometry([
  {delta:[1,0,0],distance:1,occupancy:.4,element:'O'},
  {delta:[1,0,0],distance:1,occupancy:.6,element:'F'},
  {delta:[-1,0,0],distance:1,occupancy:1,element:'O'}
 ],[[1,0,0],[0,1,0],[0,0,1]]);
 const m=ctx.distortion(env);
 assert.equal(env.geometricCN,3);
 assert.equal(env.vertexCount,2);
 assert.equal(env.weightedCN,2);
 assert.ok(m.occupancyCaveat);
 assert.ok(Math.abs(m.econ-2)<1e-12);
});

// The BVS model must share the reciprocal-metric image bounds with the
// coordination and bond renderer; it must not truncate to [-2,+2].
ctx.cleanSymbol=s=>s;
const bvsStart=src.indexOf('const BVS_PARAMETERS=['),bvsEnd=src.indexOf('function bvsCsv(',bvsStart);
assert.ok(bvsStart>0&&bvsEnd>bvsStart);
vm.runInContext(src.slice(bvsStart,bvsEnd)+';this.bvs=bondValenceSum',ctx);

test('P7.9 BVS acute cell agrees with exhaustive ±7 reference including shifts >2',()=>{
 const B=[[3,0,0],[2.85,.3,0],[0,0,4]];
 const sites=[atom('Na',0,0,0),atom('Cl',.25,0,0,.7)];
 const cutoff=1.4,got=ctx.bvs(sites,0,B,'Na1-Cl',cutoff),expected=[];
 for(let x=-7;x<=7;x++)for(let y=-7;y<=7;y++)for(let z=-7;z<=7;z++){
  const d=Math.hypot(...cart([x+.25,y,z],B));
  if(d<1e-6||d>cutoff+1e-8)continue;
  expected.push({shift:[x,y,z],distance:d,contribution:.7*Math.exp((2.15-d)/.37)});
 }
 assert.equal(got.count,expected.length);
 assert.ok(expected.some(n=>Math.max(...n.shift.map(Math.abs))>2));
 const actual=new Map(got.neighbors.map(n=>[n.shift.join('/'),n]));
 for(const ref of expected){
  const n=actual.get(ref.shift.join('/'));assert.ok(n);
  assert.ok(Math.abs(n.distance-ref.distance)<1e-9);
  assert.ok(Math.abs(n.contribution-ref.contribution)<1e-8*Math.max(1,ref.contribution));
 }
 const sum=expected.reduce((total,n)=>total+n.contribution,0);
 assert.ok(Math.abs(got.sum-sum)<1e-8*Math.max(1,sum));
});

test('P7.9 BVS zero-occupancy and invalid input do not emit phantom bonds',()=>{
 const B=[[4,0,0],[0,4,0],[0,0,4]];
 const sites=[atom('Na',0,0,0),atom('Cl',.5,0,0,0)];
 const result=ctx.bvs(sites,0,B,'Na1-Cl',3.5);
 assert.equal(result.count,0);
 assert.equal(result.sum,0);
 const absent=ctx.bvs([atom('Na',0,0,0,0),atom('Cl',.5,0,0)],0,B,'Na1-Cl',3.5);
 assert.equal(absent.count,0);
 assert.throws(()=>ctx.bvs([atom('Na',0,0,0),atom('Cl',.5,0,0,1.5)],0,B,'Na1-Cl',3.5),/doluluğu/);
});


test('P7.9 expected equal bond length uses formal charge and occupancy-weighted neighbor count',()=>{
 const B=[[5.64,0,0],[0,5.64,0],[0,0,5.64]];
 const sites=[atom('Na',0,0,0),atom('Cl',.5,0,0,.5)];
 const result=ctx.bvs(sites,0,B,'Na1-Cl',3.5);
 assert.equal(result.count,2);
 assert.ok(Math.abs(result.weightedCount-1)<1e-12);
 assert.ok(Math.abs(result.expectedBondLength-2.15)<1e-12);
 const full=ctx.bvs([atom('Na',0,0,0),atom('Cl',.5,0,0)],0,B,'Na1-Cl',3.5);
 assert.ok(Math.abs(full.expectedBondLength-(2.15-.37*Math.log(1/2)))<1e-12);
 const empty=ctx.bvs([atom('Na',0,0,0),atom('Cl',.5,0,0,0)],0,B,'Na1-Cl',3.5);
 assert.equal(empty.expectedBondLength,null);
});
