import test from 'node:test';
import assert from 'node:assert/strict';
import {DFT_SETTINGS_IDS,DFT_SETTINGS_KEY,createDftSettings,fileSelectionText,initTabKeys,syncTabState} from '../dft-ui.js';

function fakeDoc(){
 const elements=new Map(DFT_SETTINGS_IDS.map(id=>[id,{id,type:'text',tagName:'INPUT',value:'default-'+id,checked:false}]));
 elements.set('qeJobWorkflow',{id:'qeJobWorkflow',type:'select-one',tagName:'SELECT',value:'relax-scf',options:[{value:'scf'},{value:'relax-scf'},{value:'electronic'}]});
 elements.set('qeDosExplicit',{id:'qeDosExplicit',type:'checkbox',tagName:'INPUT',checked:false});
 elements.set('qeApiToken',{id:'qeApiToken',type:'password',tagName:'INPUT',value:'secret-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaa'});
 const modes=['server','file','truba'].map(value=>({value,checked:value==='server'}));
 return {elements,modes,
  getElementById:id=>elements.get(id),
  querySelector(selector){
   if(selector.endsWith(':checked'))return modes.find(mode=>mode.checked)||null;
   const value=/value="([^"]+)"/.exec(selector)[1];
   return {set checked(on){for(const mode of modes)mode.checked=mode.value===value&&on;}};
  }};
}
const memoryStorage=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,String(v)),removeItem:k=>map.delete(k),map};};

test('settings persist form values but never the API key, and reset restores page defaults',()=>{
 const doc=fakeDoc(),storage=memoryStorage(),settings=createDftSettings({doc,storage:()=>storage});
 settings.save();
 assert.equal(storage.map.size,0,'nothing is written before defaults are captured');
 settings.restore();
 doc.elements.get('qeEcutwfc').value='77';doc.elements.get('qeDosExplicit').checked=true;doc.modes[2].checked=true;doc.modes[0].checked=false;
 settings.save();
 const saved=storage.map.get(DFT_SETTINGS_KEY);
 assert.ok(!saved.includes('secret-token'),'API key is never stored');
 assert.deepEqual([JSON.parse(saved).qeEcutwfc,JSON.parse(saved).qeDosExplicit,JSON.parse(saved).preparationMode],['77',true,'truba']);
 const fresh=fakeDoc(),restored=createDftSettings({doc:fresh,storage:()=>storage});restored.restore();
 assert.equal(fresh.elements.get('qeEcutwfc').value,'77');
 assert.equal(fresh.elements.get('qeDosExplicit').checked,true);
 assert.equal(fresh.modes.find(mode=>mode.checked).value,'truba');
 restored.reset();
 assert.equal(storage.map.has(DFT_SETTINGS_KEY),false);
 assert.equal(fresh.elements.get('qeEcutwfc').value,'default-qeEcutwfc');
 assert.equal(fresh.modes.find(mode=>mode.checked).value,'server');
});

test('restored values must still fit the current form',()=>{
 const doc=fakeDoc(),storage=memoryStorage();
 storage.setItem(DFT_SETTINGS_KEY,JSON.stringify({qeJobWorkflow:'removed-option',qeEcutwfc:'x'.repeat(10001),qeKx:5,qeDosExplicit:'yes',preparationMode:'cloud'}));
 createDftSettings({doc,storage:()=>storage}).restore();
 assert.equal(doc.elements.get('qeJobWorkflow').value,'relax-scf');
 assert.equal(doc.elements.get('qeEcutwfc').value,'default-qeEcutwfc');
 assert.equal(doc.elements.get('qeKx').value,'default-qeKx','non-string values are ignored');
 assert.equal(doc.elements.get('qeDosExplicit').checked,false);
 assert.equal(doc.modes.find(mode=>mode.checked).value,'server');
 storage.setItem(DFT_SETTINGS_KEY,'{not json');
 assert.doesNotThrow(()=>createDftSettings({doc:fakeDoc(),storage:()=>storage}).restore());
 assert.doesNotThrow(()=>createDftSettings({doc:fakeDoc(),storage:()=>{throw Error('blocked');}}).restore());
});

test('file picker text names one file and counts several',()=>{
 assert.equal(fileSelectionText(null),'Dosya seçilmedi');
 assert.equal(fileSelectionText([{name:'electronic-results.json'}]),'electronic-results.json');
 assert.equal(fileSelectionText([{name:'Mo.UPF'},{name:'S.UPF'}]),'2 dosya seçildi');
});

test('arrow, Home and End keys move between unlocked tabs and wrap around',()=>{
 const tab=(section,disabled=false)=>{const attrs={role:'tab','aria-disabled':disabled?'true':'false'};
  return {dataset:{dftSection:section},attrs,tabIndex:-1,focused:false,clicked:0,getAttribute:k=>attrs[k]??null,
   setAttribute(k,v){attrs[k]=v;},closest(){return this;},focus(){this.focused=true;},click(){this.clicked++;}};};
 const tabs=[tab('hazirlik'),tab('isler',true),tab('sonuclar'),tab('ayarlar')];
 let handler;const list={addEventListener:(type,fn)=>{handler=fn;},querySelectorAll:()=>tabs};
 initTabKeys(list);
 const press=(key,from)=>{let prevented=false;handler({key,target:from,preventDefault:()=>{prevented=true;}});return prevented;};
 assert.equal(press('ArrowRight',tabs[0]),true);
 assert.equal(tabs[2].clicked,1,'the locked jobs tab is skipped');
 press('ArrowLeft',tabs[0]);assert.equal(tabs[3].clicked,1,'left from the first tab wraps to the last');
 press('Home',tabs[3]);assert.equal(tabs[0].clicked,1);
 assert.equal(press('Enter',tabs[0]),false,'other keys keep their default action');
 syncTabState(list,'sonuclar');
 assert.deepEqual(tabs.map(t=>[t.attrs['aria-selected'],t.tabIndex]),[['false',-1],['false',-1],['true',0],['false',-1]]);
});
