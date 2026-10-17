const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const src=fs.readFileSync(require('node:path').join(__dirname,'../crystal-app.js'),'utf8');
const a=src.indexOf('function coordinationNeighbors('),b=src.indexOf('/* Choose a viable center',a);
assert.ok(a>=0&&b>a);
const ctx={frac:n=>((n%1)+1)%1,bondRange:(_a,_b,r)=>r,toCart:(d,B)=>({length:()=>Math.hypot(...[0,1,2].map(k=>d.reduce((s,v,i)=>s+v*B[i][k],0)))})};
vm.createContext(ctx);vm.runInContext(src.slice(a,b)+';this.fn=coordinationNeighbors',ctx);
const run=(name,sites,B,range,cn)=>test(name,()=>{
 const got=ctx.fn(sites,0,B,range,0,false,24);
 const expected=[];
 for(let j=0;j<sites.length;j++)for(let x=-2;x<=2;x++)for(let y=-2;y<=2;y++)for(let z=-2;z<=2;z++){
  if(j===0&&!x&&!y&&!z)continue;
  const d=[x,y,z].map((v,k)=>v+sites[j][['x','y','z'][k]]-sites[0][['x','y','z'][k]]);
  const dist=Math.hypot(...[0,1,2].map(k=>d.reduce((s,v,i)=>s+v*B[i][k],0)));
  if(dist>1e-5&&dist>=range[0]-1e-6&&dist<=range[1]+1e-6)expected.push(dist);
 }
 assert.equal(got.length,expected.length);
 if(cn!==undefined)assert.equal(got.length,cn);
 const actual=got.map(x=>x.distance).sort((a,b)=>a-b),ref=expected.sort((a,b)=>a-b);
 actual.forEach((v,i)=>assert.ok(Math.abs(v-ref[i])<1e-8));
});
const atom=(symbol,x,y,z)=>({symbol,x,y,z});
run('simple cubic CN6',[atom('Na',0,0,0)],[[3,0,0],[0,3,0],[0,0,3]],[2.99,3.01],6);
run('bcc CN8',[atom('Fe',0,0,0),atom('Fe',.5,.5,.5)],[[3,0,0],[0,3,0],[0,0,3]],[2.59,2.61],8);
run('fcc CN12',[atom('Cu',0,0,0),atom('Cu',0,.5,.5),atom('Cu',.5,0,.5),atom('Cu',.5,.5,0)],[[4,0,0],[0,4,0],[0,0,4]],[2.82,2.84],12);
run('triclinic distances',[atom('Si',.1,.2,.3),atom('O',.4,.5,.6)],[[4,0,0],[1.5,4.5,0],[.8,1.1,5.2]],[.01,2.9]);
