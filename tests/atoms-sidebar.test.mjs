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
 const list={querySelectorAll:()=>cards};
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
 context.selected=[0];
 vm.runInContext('syncSelectedSiteRows()',context);
 assert.ok(classes[0].has('is-selected'));
 assert.ok(!classes[1].has('is-selected'));
 assert.equal(buttons[1]['aria-pressed'],'false');
 assert.equal(badges[1].hidden,true);
 context.selected=[];
 vm.runInContext('syncSelectedSiteRows()',context);
 assert.ok(!classes[0].has('is-selected'));
});
