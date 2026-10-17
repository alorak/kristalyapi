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
vm.runInContext(src.slice(a,b)+';this.neighbors=coordinationNeighbors;this.geometry=coordinationGeometry;this.hull=coordinationHullMetrics',ctx);
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
 assert.deepEqual(shell.map(n=>n.element).sort(),['F','O']);
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
