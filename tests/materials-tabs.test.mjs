import test from 'node:test';
import assert from 'node:assert/strict';
import {initMaterialsTabs} from '../materials-tabs.js';

function fakeDom(storage){
 const panels=new Map(),lists=new Map(),tabs=new Map();
 const definitions=[
  ['materialsTabs',[['materialsTabCards','materialsPanelCards'],['materialsTabCompare','materialsPanelCompare'],
   ['materialsTabMl','materialsPanelMl'],['materialsTabEvidence','materialsPanelEvidence'],
   ['materialsTabBulk','materialsPanelBulk']]],
  ['materialsMlTabs',[['materialsMlTabP0','materialsMlPaneP0'],['materialsMlTabP1','materialsMlPaneP1'],
   ['materialsMlTabP12','materialsMlPaneP12'],['materialsMlTabP13','materialsMlPaneP13']]]
 ];
 for(const [listId,items]of definitions){
  const buttons=[];
  for(const [id,panelId]of items){
   const attrs=new Map([['role','tab'],['aria-controls',panelId],['aria-selected','false']]);
   const listeners=new Map();
   const tab={id,tabIndex:-1,getAttribute:key=>attrs.get(key),setAttribute:(k,v)=>attrs.set(k,v),
    addEventListener:(k,fn)=>listeners.set(k,fn),focus(){tab.focused=true;},
    trigger:(kind,event={})=>listeners.get(kind)?.(event)};
   tabs.set(id,tab);buttons.push(tab);
   const panelAttrs=new Map([['role','tabpanel'],['aria-labelledby',id]]);
   panels.set(panelId,{hidden:false,getAttribute:key=>panelAttrs.get(key)});
  }
  lists.set(listId,{getAttribute:k=>k==='role'?'tablist':null,
   querySelectorAll:s=>s==='[role="tab"]'?buttons:[]});
 }
 const root={querySelector:s=>s[0]==='#'?(lists.get(s.slice(1))||panels.get(s.slice(1))||null):null};
 return {root,tabs,panels,storage};
}
function memoryStorage(){
 const entries=new Map();
 return {getItem:key=>entries.get(key)||null,setItem:(key,value)=>entries.set(key,value)};
}
test('section and model tabs hide only inactive panels, preserving nodes and listeners',()=>{
 const v=fakeDom(memoryStorage()),controller=initMaterialsTabs(v.root,{storage:v.storage});
 assert.equal(controller.activeMain(),'materialsTabCards');
 assert.equal(controller.activeMl(),'materialsMlTabP0');
 assert.equal(v.panels.get('materialsPanelMl').hidden,true);
 v.tabs.get('materialsTabMl').trigger('click');
 assert.equal(controller.activeMain(),'materialsTabMl');
 assert.equal(v.panels.get('materialsPanelMl').hidden,false);
 assert.equal(v.panels.get('materialsPanelCards').hidden,true);
 assert.equal(v.tabs.get('materialsTabCards').getAttribute('aria-selected'),'false');
 v.tabs.get('materialsMlTabP12').trigger('click');
 assert.equal(controller.activeMl(),'materialsMlTabP12');
 v.tabs.get('materialsMlTabP13').trigger('click');
 assert.equal(controller.activeMl(),'materialsMlTabP13');
 v.tabs.get('materialsMlTabP12').trigger('click');
 assert.equal(v.panels.get('materialsMlPaneP0').hidden,true);
 assert.equal(v.panels.get('materialsMlPaneP12').hidden,false);
 assert.equal(v.tabs.get('materialsMlTabP12').tabIndex,0);
 assert.equal(v.tabs.get('materialsMlTabP1').tabIndex,-1);
 controller.selectMain('materialsTabEvidence');
 assert.equal(v.panels.get('materialsPanelEvidence').hidden,false);
 assert.equal(v.panels.get('materialsMlPaneP12').hidden,false,
  'model selection state should persist even while parent panel is hidden');
});

test('arrow keys and Home/End use roving tabindex and focus without changing the browser route',()=>{
 const v=fakeDom(memoryStorage());const t=initMaterialsTabs(v.root,{storage:v.storage});
 let prevented=0;const event=key=>({key,preventDefault(){prevented++;}});
 v.tabs.get('materialsTabCards').trigger('keydown',event('ArrowRight'));
 assert.equal(t.activeMain(),'materialsTabCompare');
 assert.equal(v.tabs.get('materialsTabCompare').focused,true);
 v.tabs.get('materialsTabCompare').trigger('keydown',event('End'));
 assert.equal(t.activeMain(),'materialsTabBulk');
 v.tabs.get('materialsTabBulk').trigger('keydown',event('ArrowRight'));
 assert.equal(t.activeMain(),'materialsTabCards','horizontal navigation wraps');
 v.tabs.get('materialsTabCards').trigger('keydown',event('ArrowLeft'));
 assert.equal(t.activeMain(),'materialsTabBulk');
 v.tabs.get('materialsMlTabP0').trigger('keydown',event('End'));
 assert.equal(t.activeMl(),'materialsMlTabP13');
 v.tabs.get('materialsMlTabP13').trigger('keydown',event('Home'));
 assert.equal(t.activeMl(),'materialsMlTabP0');
 v.tabs.get('materialsMlTabP0').trigger('keydown',event('Tab'));
 assert.equal(t.activeMl(),'materialsMlTabP0','Tab should use native browser navigation');
 assert.equal(prevented,6);
});

test('selected tabs persist across Materials page re-initialization within the same session',()=>{
 const storage=memoryStorage(),a=fakeDom(storage),x=initMaterialsTabs(a.root,{storage});
 x.selectMain('materialsTabBulk');x.selectMl('materialsMlTabP1');
 const b=fakeDom(storage),y=initMaterialsTabs(b.root,{storage});
 assert.equal(y.activeMain(),'materialsTabBulk');
 assert.equal(y.activeMl(),'materialsMlTabP1');
 assert.equal(b.panels.get('materialsPanelBulk').hidden,false);
 assert.equal(b.panels.get('materialsMlPaneP1').hidden,false);
 assert.equal(b.panels.get('materialsPanelCards').hidden,true);
});

test('missing or mismatched accessible panel is refused, unknown selected id is refused',()=>{
 const storage=memoryStorage(),v=fakeDom(storage);
 v.panels.delete('materialsPanelMl');
 assert.throws(()=>initMaterialsTabs(v.root,{storage}),/ilişkisi geçersiz/);
 const w=fakeDom(storage),c=initMaterialsTabs(w.root,{storage});
 assert.throws(()=>c.selectMain('materialsTabFake'),/Bilinmeyen/);
});

test('storage failure never prevents tab navigation',()=>{
 const storage={getItem(){throw Error('blocked')},setItem(){throw Error('blocked')}};
 const v=fakeDom(storage),tabs=initMaterialsTabs(v.root,{storage});
 tabs.selectMain('materialsTabMl');
 tabs.selectMl('materialsMlTabP12');
 assert.equal(tabs.activeMain(),'materialsTabMl');
 assert.equal(tabs.activeMl(),'materialsMlTabP12');
});
