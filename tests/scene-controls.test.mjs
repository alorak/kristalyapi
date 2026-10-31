import test from 'node:test';
import assert from 'node:assert/strict';
import {validatedSiteAppearance,siteLabelText,validatedClipPlane,normalizedClipSettings,clipSignedDistance,
 insideClipPlanes,clipKeepMask,placeLabels,MAX_CLIP_PLANES} from '../scene-controls.js';

const close=(a,b,t=1e-9)=>assert.ok(Math.abs(a-b)<=t,a+' ≉ '+b);

test('per-site appearance: validated values, neutral values dropped, unsafe text refused',()=>{
 assert.deepEqual(validatedSiteAppearance({visualOpacity:'0.4',visualHidden:true,labelText:'  Fe(1) ',labelOffset:[1,'-0.5'],labelHidden:true}),
  {visualOpacity:.4,visualHidden:true,labelText:'Fe(1)',labelOffset:[1,-.5],labelHidden:true});
 assert.deepEqual(validatedSiteAppearance({visualHidden:false,labelText:'',labelOffset:[0,0],labelHidden:false}),{},
  'defaults are not stored');
 assert.throws(()=>validatedSiteAppearance({visualOpacity:0}),/opaklığı/);
 assert.throws(()=>validatedSiteAppearance({visualHidden:'yes'}),/gizleme/);
 assert.throws(()=>validatedSiteAppearance({labelText:'<script>'}),/Etiket metni/);
 assert.throws(()=>validatedSiteAppearance({labelText:'x'.repeat(25)}),/Etiket metni/);
 assert.throws(()=>validatedSiteAppearance({labelOffset:[7,0]}),/ofseti/);
 assert.throws(()=>validatedSiteAppearance({labelOffset:[1]}),/ofseti/);
 assert.equal(siteLabelText({symbol:'Si',label:'Si1'}),'Si');assert.equal(siteLabelText({symbol:'Si',label:'Si1'},'site'),'Si1');
 assert.equal(siteLabelText({symbol:'Si',label:'Si1',labelText:'T1'},'site'),'T1','own text wins');
});

test('clipping planes: validation, saved settings and signed distance along the (hkl) normal',()=>{
 assert.deepEqual(validatedClipPlane({h:'1',k:0,l:0,distance:'2.5',keep:'below'}),{h:1,k:0,l:0,distance:2.5,keep:'below',enabled:true});
 assert.throws(()=>validatedClipPlane({h:0,k:0,l:0,distance:0,keep:'below'}),/000/);
 assert.throws(()=>validatedClipPlane({h:9,k:0,l:0,distance:0,keep:'below'}),/−8…8/);
 assert.throws(()=>validatedClipPlane({h:1,k:0,l:0,distance:0,keep:'left'}),/taraf/);
 const saved=normalizedClipSettings({integrity:'bonded',planes:[{h:1,k:1,l:1,distance:1,keep:'above',enabled:false},{h:0,k:0,l:0},...Array(10).fill({h:0,k:0,l:1,distance:0,keep:'below'})]});
 assert.equal(saved.integrity,'bonded');assert.equal(saved.planes[0].enabled,false);
 assert.equal(saved.planes.length,MAX_CLIP_PLANES-1,'the invalid plane is dropped; only the first six are read');
 assert.deepEqual(normalizedClipSettings(undefined),{planes:[],integrity:'cut'});
 assert.equal(normalizedClipSettings({integrity:'all'}).integrity,'cut');
 // Cubic a = 4 Å: (100) has d = 4, (110) has d = 4/√2. The point x = 0.5 lies 2 Å along a.
 const a=4;
 close(clipSignedDistance([.5,0,0],{h:1,k:0,l:0,distance:0},a),2);
 close(clipSignedDistance([.5,.5,0],{h:1,k:1,l:0,distance:0},a/Math.SQRT2),a/Math.SQRT2,1e-12);
 // Equal to the projection of the Cartesian point on the unit normal (1,1,0)/√2.
 close(clipSignedDistance([.5,.5,0],{h:1,k:1,l:0,distance:0},a/Math.SQRT2),(2+2)/Math.SQRT2,1e-12);
 const below={h:0,k:0,l:1,distance:2,keep:'below',enabled:true},above={...below,keep:'above'};
 assert.equal(insideClipPlanes([0,0,.5],[below],[a]),true,'exactly on the plane is kept on both sides');
 assert.equal(insideClipPlanes([0,0,.5],[above],[a]),true);
 assert.equal(insideClipPlanes([0,0,.75],[below],[a]),false);
 assert.equal(insideClipPlanes([0,0,.75],[{...below,enabled:false}],[a]),true,'disabled planes do not clip');
 assert.equal(insideClipPlanes([.9,0,.25],[below,{h:1,k:0,l:0,distance:2,keep:'below',enabled:true}],[a,a]),false,'every plane must keep the atom');
});

test('clip integrity: cut, first bonded shell and whole bonded components',()=>{
 // Chain 0–1–2–3 and a separate pair 4–5; atoms 1 and 4 are inside.
 const inside=[false,true,false,false,true,false],pairs=[[0,1],[1,2],[2,3],[4,5]];
 assert.deepEqual(clipKeepMask(inside,pairs,'cut'),inside);
 assert.deepEqual(clipKeepMask(inside,pairs,'bonded'),[true,true,true,false,true,true]);
 assert.deepEqual(clipKeepMask(inside,pairs,'molecule'),[true,true,true,true,true,true]);
 assert.deepEqual(clipKeepMask([false,false,true],[[0,1]],'molecule'),[false,false,true],'components without an inside atom stay hidden');
 assert.throws(()=>clipKeepMask(inside,pairs,'all'),/bütünlüğü/);
});

test('label placement: no overlaps when room exists, fixed offsets respected, kept in the frame',()=>{
 const box=p=>[p.x-p.w/2,p.y-p.h,p.x+p.w/2,p.y+.25*p.h];
 const overlap=(a,b)=>a[0]<b[2]&&b[0]<a[2]&&a[1]<b[3]&&b[1]<a[3];
 // Five atoms in a tight row: labels above alone would all collide.
 const labels=[0,1,2,3,4].map(i=>({x:100+12*i,y:100,r:5,width:20,height:10,depth:i}));
 const placed=placeLabels(labels,{width:300,height:200});
 const boxes=placed.map((p,i)=>box({...p,w:20,h:10}));
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)assert.ok(!overlap(boxes[i],boxes[j]),i+' and '+j+' overlap');
 assert.ok(placed.every(p=>!p.overlap));
 assert.deepEqual([placed[0].x,placed[0].y],[100,100-5-3],'the front atom keeps the default place above');
 assert.ok(placed.slice(1).some(p=>p.moved));
 // An explicit offset of (1, 2) em moves the label 10 px right and 20 px up and is never moved.
 const fixed=placeLabels([{x:150,y:100,r:5,width:20,height:10,offset:[1,2]}],{width:300,height:200})[0];
 assert.deepEqual([fixed.x,fixed.y,fixed.moved],[160,100-5-3-20,false]);
 // Edges: the label stays inside the figure.
 const edge=placeLabels([{x:2,y:4,r:3,width:20,height:10}],{width:100,height:100})[0];
 assert.ok(edge.x>=10&&edge.y>=10,'clamped into the frame');
 // No room at all: the clash is reported rather than hidden.
 const crowded=placeLabels(Array.from({length:12},(_,i)=>({x:10,y:10,r:1,width:20,height:10,depth:i})),{width:22,height:22});
 assert.ok(crowded.some(p=>p.overlap));
});
