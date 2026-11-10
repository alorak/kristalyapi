/* Accessible two-level Materials tab navigation.
 * Keeps all existing data-entry/result nodes mounted; switching never resets ML or cards. */
const GROUPS=Object.freeze([
 {listId:'materialsTabs',storageKey:'kristalyapi.materials-tabs.v1'},
 {listId:'materialsMlTabs',storageKey:'kristalyapi.materials-ml-tabs.v1'}
]);

export function initMaterialsTabs(root,{storage}={}){
 if(!root||typeof root.querySelector!=='function')
  throw Error('Malzemeler sekme kökü bulunamadı.');
 const save=storage===undefined?(typeof sessionStorage!=='undefined'?sessionStorage:null):storage;
 const groups=new Map();
 for(const {listId,storageKey} of GROUPS){
  const list=root.querySelector('#'+listId);
  if(!list||list.getAttribute('role')!=='tablist')
   throw Error('Malzemeler sekme listesi eksik: '+listId);
  const tabs=[...list.querySelectorAll('[role="tab"]')];
  if(!tabs.length)throw Error('Malzemeler sekme düğmeleri eksik.');
  const items=tabs.map(tab=>{
   const panelId=tab.getAttribute('aria-controls');
   const panel=panelId?root.querySelector('#'+panelId):null;
   if(!panel||panel.getAttribute('role')!=='tabpanel'||
      panel.getAttribute('aria-labelledby')!==tab.id)
    throw Error('Malzemeler sekme/panel ilişkisi geçersiz: '+tab.id);
   return {tab,panel};
  });
  const select=(id,{focus=false,remember=true}={})=>{
   const selected=items.find(item=>item.tab.id===id);
   if(!selected)throw Error('Bilinmeyen Malzemeler sekmesi: '+id);
   for(const item of items){
    const active=item===selected;
    item.tab.setAttribute('aria-selected',String(active));
    item.tab.tabIndex=active?0:-1;
    item.panel.hidden=!active;
   }
   if(remember)try{save?.setItem(storageKey,id);}catch{/* storage unavailable */}
   if(focus)selected.tab.focus();
   return selected.tab.id;
  };
  for(let i=0;i<items.length;i++){
   const item=items[i];
   item.tab.addEventListener('click',()=>select(item.tab.id));
   item.tab.addEventListener('keydown',event=>{
    let next=null;
    if(event.key==='ArrowRight')next=(i+1)%items.length;
    else if(event.key==='ArrowLeft')next=(i-1+items.length)%items.length;
    else if(event.key==='Home')next=0;
    else if(event.key==='End')next=items.length-1;
    if(next===null)return;
    event.preventDefault();
    select(items[next].tab.id,{focus:true});
   });
  }
  let stored=null;try{stored=save?.getItem(storageKey);}catch{/* storage unavailable */}
  select(items.some(item=>item.tab.id===stored)?stored:items[0].tab.id,{remember:false});
  groups.set(listId,{select,active:()=>items.find(item=>item.tab.getAttribute('aria-selected')==='true')?.tab.id});
 }
 return {
  selectMain(id){return groups.get('materialsTabs').select(id);},
  selectMl(id){return groups.get('materialsMlTabs').select(id);},
  activeMain(){return groups.get('materialsTabs').active();},
  activeMl(){return groups.get('materialsMlTabs').active();}
 };
}
