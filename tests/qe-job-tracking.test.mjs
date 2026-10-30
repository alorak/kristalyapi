import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const {createJobPoller,jobProgress}=await import('data:text/javascript;base64,'+Buffer.from(readFileSync(new URL('../qe-job-tracking.js',import.meta.url))).toString('base64'));
function harness(refresh=async()=>true){
 let job=null,visible=true,calls=0,stops=0;const timers=new Map();let serial=0;
 const poller=createJobPoller({current:()=>job,eligible:j=>visible&&j.status==='running',refresh:async j=>{calls++;return refresh(j);},
  onFailureLimit:()=>stops++,setTimer:(fn,ms)=>{timers.set(++serial,{fn,ms});return serial;},clearTimer:id=>timers.delete(id)});
 return {poller,timers,get calls(){return calls;},get stops(){return stops;},set job(value){job=value;},set visible(value){visible=value;},
  async tick(){const [id,item]=timers.entries().next().value;timers.delete(id);item.fn();await new Promise(setImmediate);}};
}
test('navigation with no job and hidden pages never schedules or reads',()=>{
 const h=harness();h.poller.sync();assert.equal(h.timers.size,0);
 h.job={status:'running'};h.visible=false;h.poller.sync();assert.equal(h.timers.size,0);
 h.visible=true;h.poller.sync();assert.equal(h.timers.size,1);h.visible=false;h.poller.sync();assert.equal(h.timers.size,0);assert.equal(h.calls,0);
});
test('read failures back off and stop after three; explicit refresh recovers',async()=>{
 let success=false;const h=harness(async()=>success);h.job={status:'running'};h.poller.sync();
 for(const delay of [5000,10000,20000]){assert.equal([...h.timers.values()][0].ms,delay);await h.tick();}
 assert.equal(h.calls,3);assert.equal(h.stops,1);assert.equal(h.timers.size,0);
 success=true;await h.poller.refresh();assert.equal(h.poller.failures,0);assert.equal(h.timers.size,1);h.poller.dispose();
});
test('manual and timer refresh share one in-flight read',async()=>{
 let release;const h=harness(()=>new Promise(resolve=>release=resolve));h.job={status:'running'};
 const a=h.poller.refresh(),b=h.poller.refresh();assert.equal(h.calls,1);release(true);assert.deepEqual(await Promise.all([a,b]),[true,true]);assert.equal(h.timers.size,1);h.poller.dispose();
});
test('completed, paused and terminal jobs do not continue polling',async()=>{
 const h=harness(async job=>{job.status='completed';return true;});h.job={status:'running'};await h.poller.refresh();assert.equal(h.timers.size,0);
 h.job={status:'paused'};h.poller.sync();assert.equal(h.timers.size,0);h.poller.dispose();
});
test('switching jobs does not overlap the previous network read',async()=>{
 let release;let index=0;const h=harness(()=>++index===1?new Promise(resolve=>release=resolve):Promise.resolve(true));h.job={status:'running'};
 const a=h.poller.refresh();h.job={status:'running'};const b=h.poller.refresh();assert.equal(h.calls,1);release(true);await Promise.all([a,b]);assert.equal(h.calls,2);h.poller.dispose();
});
test('progress uses explicit completed stages, never elapsed-time percentages',()=>{
 const data={active_stage:'nscf',stages:[{name:'scf',status:'completed'},{name:'bands',status:'failed'}]};
 const steps=jobProgress({status:'running',calculation:'electronic'},data);
 assert.deepEqual(steps.map(s=>s.state),['completed','failed','pending','running','pending','pending']);
 assert.equal(jobProgress({status:'paused',calculation:'electronic'},data)[3].state,'pending');
 assert.deepEqual(jobProgress({status:'running'},data),[]);
});

test('a mutation refresh waits for an older read then requests fresh status',async()=>{
 let release;let index=0;const h=harness(()=>++index===1?new Promise(resolve=>release=resolve):Promise.resolve(true));h.job={status:'running'};
 const old=h.poller.refresh(),fresh=h.poller.refresh({fresh:true});release(true);await Promise.all([old,fresh]);assert.equal(h.calls,2);h.poller.dispose();
});
test('spin progress includes independent bands.x stages with seven total steps',()=>{
 const steps=jobProgress({calculation:'electronic',spin:'polarized',status:'running'},{active_stage:'bands_pp_down',stages:['scf','bands','bands_pp_up'].map(name=>({name,status:'completed'}))});
 assert.equal(steps.length,7);assert.equal(steps.filter(s=>s.state==='completed').length,3);assert.equal(steps.find(s=>s.name==='bands_pp_down').state,'running');assert.ok(!steps.some(s=>s.name==='bands_pp'));
});
