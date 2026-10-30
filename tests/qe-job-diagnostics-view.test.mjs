import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../qe-job-diagnostics-view.js',import.meta.url),'utf8');
const {parseJobDiagnostics,renderJobDiagnostics}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const fixture=()=>({schema:'kristalyapi.qe-job-diagnostics.v1',job_id:'a'.repeat(32),availability:'recorded',status:'failed',
 reason_code:'process_killed_unconfirmed',elapsed_seconds:2,active_stage:'nscf',stages:[],resources:{sampled_worker_memory_max_bytes:1000,
 memory_limit_bytes:2000,swap_limit_bytes:0,cgroup_oom_kill_delta:0,child_cpu_seconds:1}});
test('exit-kill explanation is distinct from measured OOM',()=>{
 assert.equal(parseJobDiagnostics(fixture()).reason_code,'process_killed_unconfirmed');
 const x=fixture();x.reason_code='cgroup_oom_kill';assert.throws(()=>parseJobDiagnostics(x),/OOM kanıtı/);
 x.resources.cgroup_oom_kill_delta=1;assert.equal(parseJobDiagnostics(x).reason_code,'cgroup_oom_kill');
});
test('old jobs preserve unavailable resources without inventing zero',()=>{
 const x=fixture();x.availability='unavailable';x.resources=null;x.elapsed_seconds=null;
 assert.equal(parseJobDiagnostics(x).resources,null);
});
test('invalid resource values and stage durations are rejected',()=>{
 for(const value of [NaN,-1,true]){const x=fixture();x.resources.sampled_worker_memory_max_bytes=value;assert.throws(()=>parseJobDiagnostics(x),/Kaynak/);}
 const x=fixture();x.stages=[{name:'scf',duration_seconds:-1}];assert.throws(()=>parseJobDiagnostics(x),/Aşama/);
});

test('renderer labels sampled memory and never describes it as a measured peak',()=>{
 const previous=globalThis.document;
 globalThis.document={createElement:tag=>({tag,textContent:''})};
 try{
  const host={children:[],replaceChildren(){this.children=[];},append(...items){this.children.push(...items);}};
  renderJobDiagnostics(host,fixture());
  const text=host.children.map(n=>n.textContent).join(' ');
  assert.match(text,/OOM teyit edilmedi/);assert.match(text,/garantili tepe RAM.*değildir/);
 }finally{globalThis.document=previous;}
});
