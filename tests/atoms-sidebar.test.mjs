import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import vm from 'node:vm';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const editor=readFileSync(resolve(root,'crystal-app.js'),'utf8');
const styles=readFileSync(resolve(root,'styles.css'),'utf8');
const html=readFileSync(resolve(root,'index.html'),'utf8');

test('left atom tab is a vertical list with immediate editable coordinates and square color controls',()=>{
 assert.match(html,/id="siteRows" class="site-list" role="list"/);
 assert.match(html,/id="siteStyleColor" type="color"/);
 assert.doesNotMatch(html,/Asimetrik konumlar \/ atomlar/);
 assert.doesNotMatch(html,/class="site-table"/);
 assert.match(editor,/head\.append\(choose,colorLabel,remove\)/);
 assert.match(editor,/card\.append\(head,coordinates,meta\)/);
 assert.match(editor,/coordinates\.className='site-entry-coordinates'/);
 assert.match(editor,/color\.type='color';color\.className='site-entry-color-input'/);
 assert.match(styles,/#leftAtomsPane \.site-entry\.is-selected/);
 assert.match(styles,/\.site-entry-color-input/);
 assert.match(styles,/width:28px;height:28px/);
});
test('scene selections map periodic and symmetry-expanded copies to their source row',()=>{
 const from=editor.indexOf('function sourceSiteIndexForAtom(item){');
 const until=editor.indexOf('function renderSites(){',from);
 assert.ok(from>0&&until>from);
 const direct={label:'Si1'},other={label:'O1'};
 const classes=[new Set(),new Set()];
 const buttons=[{},{}],badges=[{hidden:true},{hidden:true}];
 const cards=[0,1].map(i=>({
  dataset:{siteIndex:String(i)},
  classList:{toggle(name,on){if(on)classes[i].add(name);else classes[i].delete(name);}},
  querySelector(selector){
   return selector==='.site-entry-select'?{setAttribute(name,value){buttons[i][name]=value}}:
    selector==='.site-entry-selected-label'?badges[i]:null;
  }
 }));
 const ordered=cards.slice();
 const list={
  children:ordered,
  querySelectorAll:()=>ordered.slice(),
  insertBefore(card,before){
   const original=ordered.indexOf(card);
   if(original>=0)ordered.splice(original,1);
   const target=before?ordered.indexOf(before):-1;
   ordered.splice(target>=0?target:ordered.length,0,card);
  }
 };
 const context={
  state:{sites:[direct,other]},
  atomData:[
   {site:{...direct,sourceSiteIndex:0},shown:true},
   {site:{...direct,sourceSiteIndex:0},shown:true},
   {site:{...other,sourceSiteIndex:1},shown:true},
   {site:other,shown:true}
  ],
  selected:[1,2],
  $:()=>list
 };
 vm.createContext(context);
 vm.runInContext(editor.slice(from,until),context);
 assert.equal(vm.runInContext('sourceSiteIndexForAtom(atomData[0])',context),0);
 assert.equal(vm.runInContext('sourceSiteIndexForAtom(atomData[1])',context),0);
 assert.equal(vm.runInContext('sourceSiteIndexForAtom(atomData[3])',context),1);
 vm.runInContext('syncSelectedSiteRows()',context);
 assert.ok(classes[0].has('is-selected'));
 assert.ok(classes[1].has('is-selected'));
 assert.equal(buttons[0]['aria-pressed'],'true');
 assert.equal(badges[1].hidden,false);
 context.selected=[2]; // Only second site is selected: it must move to the top.
 vm.runInContext('syncSelectedSiteRows()',context);
 assert.equal(ordered[0],cards[1]);
 context.selected=[0];
 vm.runInContext('syncSelectedSiteRows()',context);
 assert.equal(ordered[0],cards[0]);
 assert.ok(classes[0].has('is-selected'));
 assert.ok(!classes[1].has('is-selected'));
 assert.equal(buttons[1]['aria-pressed'],'false');
 assert.equal(badges[1].hidden,true);
 context.selected=[];
 vm.runInContext('syncSelectedSiteRows()',context);
 assert.ok(!classes[0].has('is-selected'));
 assert.deepEqual(ordered,cards,'clearing selection restores source site order');
});

test('appearance controls are on demand and the redundant compass selector is absent',()=>{
 assert.match(html,/id="siteAppearanceDock" hidden/);
 assert.match(html,/id="siteAppearancePanel"/);
 assert.doesNotMatch(html,/Atom \/ çokyüzlü görünümü/);
 assert.doesNotMatch(html,/id="axisCompassMode"/);
 assert.match(editor,/appearance\.onclick=\(\)=>showSiteAppearance/);
 assert.match(styles,/\.site-entry-appearance-toggle/);
});

test('bond cutoff sliders follow the longest unit-cell edge and clamp on cell changes',()=>{
 const start=editor.indexOf('function syncBondCutLimits(){');
 const end=editor.indexOf('function syncControls(){',start);
 assert.ok(start>0&&end>start);
 const controls=Object.fromEntries(['bondCut','quickBondCut','bondCutVal','quickBondCutVal'].map(k=>[k,{}]));
 const context={state:{cell:{a:11.4,b:8,c:7},cut:8},$:id=>controls[id]};
 vm.createContext(context);
 vm.runInContext(editor.slice(start,end),context);
 vm.runInContext('syncBondCutLimits()',context);
 assert.equal(controls.bondCut.max,'11.4');
 assert.equal(controls.quickBondCut.max,'11.4');
 context.state.cut=15;
 vm.runInContext('syncBondCutLimits()',context);
 assert.equal(context.state.cut,11.4);
 assert.equal(controls.quickBondCut.value,'11.4');
 context.state.cell={a:3,b:5.2,c:4};
 vm.runInContext('syncBondCutLimits()',context);
 assert.equal(context.state.cut,5.2);
 assert.equal(controls.bondCut.max,'5.2');
 assert.match(html,/id="quickBondCut"[^>]*max="1000"/);
});

test('moving the bond slider switches to manual distance rather than auto radii',()=>{
 const start=editor.indexOf('function applyManualBondCut(value){');
 const end=editor.indexOf("for(const [id,key,out] of [['atomScale'",start);
 assert.ok(start>0&&end>start,'manual cutoff helper is wired by input listeners');
 const checkbox={checked:true},context={state:{autoBond:true,cut:2.65},$:id=>id==='autoBond'?checkbox:null};
 vm.createContext(context);
 vm.runInContext(editor.slice(start,end),context);
 vm.runInContext('applyManualBondCut(8.75)',context);
 assert.equal(context.state.autoBond,false,'manual adjustment disables radii cutoff');
 assert.equal(checkbox.checked,false,'quickbar auto mode icon must be off');
 assert.equal(context.state.cut,8.75);
 assert.match(editor,/if\(key==='cut'\)applyManualBondCut\(e\.target\.value\)/);
 // Explicit pair rules and automatic radius cap remain available on demand.
 assert.match(editor,/auto\?Math\.min\(cut,estimate\):cut/);
});
