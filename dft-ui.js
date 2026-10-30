/* DFT workspace UI helpers: saved form settings, file pickers and tab keys.
 * They only touch the controls they are given and never contact a server. */

// DFT form settings survive reloads in this browser. The API key, chosen files
// and workspace-bound protocol selections are deliberately never stored.
export const DFT_SETTINGS_KEY='kristalyapi.dft-settings.v1';
export const DFT_SETTINGS_IDS=['qeApiAddress','qeJobProfile','qeJobWorkflow','qeElectronicSpin','qeSpinSeeds','qeSpinSmearing',
 'qeElectronicNbnd','qeElectronicMesh','qeBandFirst','qeBandLast','qeDosExplicit','qeDosMin','qeDosMax','qeDosStep','qeDosSigma',
 'qeElectronicPath','qeJobMaxSteps','qeJobEnergyThreshold','qeCalcType','qeOccupation','qeEcutwfc','qeEcutrho','qeKx','qeKy','qeKz',
 'qeForceThreshold','qeFreezeBottom','qePseudoFiles','qeHpcAccount','qeHpcPartition','qeHpcTasks','qeHpcHours','qeHpcPostHours','qeHpcNbnd',
 'qeHpcNscfKx','qeHpcNscfKy','qeHpcNscfKz','qeHpcBandPath','qeHpcEmin','qeHpcEmax','qeHpcDeltaE','qeHpcDegauss',
 'qeHpcBandFirst','qeHpcBandLast','qeHpcConvertElectronic'];
// Controls in Setup/Settings that are intentionally not saved.
export const DFT_UNSAVED_IDS=['qeApiToken','qeProtocolSelect','qeHpcUpfFiles'];
export const DFT_PREPARATION_MODES=['server','file','truba'];
const MODE_NAME='dftPreparationMode';

export function createDftSettings({doc=document,storage=()=>globalThis.localStorage}={}){
 const byId=id=>doc.getElementById(id);
 let defaults=null;
 const read=()=>{
  const values={};
  for(const id of DFT_SETTINGS_IDS){const el=byId(id);values[id]=el.type==='checkbox'?el.checked:el.value;}
  values.preparationMode=doc.querySelector('input[name="'+MODE_NAME+'"]:checked')?.value||'server';
  return values;
 };
 const apply=values=>{
  for(const id of DFT_SETTINGS_IDS){
   const el=byId(id),value=values?.[id];
   if(el.type==='checkbox'){if(typeof value==='boolean')el.checked=value;continue;}
   if(typeof value!=='string'||value.length>10000)continue;
   if(el.tagName==='SELECT'&&![...el.options].some(option=>option.value===value))continue;
   el.value=value;
  }
  const mode=DFT_PREPARATION_MODES.includes(values?.preparationMode)?values.preparationMode:'server';
  doc.querySelector('input[name="'+MODE_NAME+'"][value="'+mode+'"]').checked=true;
 };
 return {
  isSetting:target=>DFT_SETTINGS_IDS.includes(target?.id)||target?.name===MODE_NAME,
  save(){
   if(!defaults)return;
   try{storage().setItem(DFT_SETTINGS_KEY,JSON.stringify(read()));}catch{/* Private browsing or full storage. */}
  },
  // Captures the page defaults first, so reset can return to them.
  restore(){
   defaults=read();
   try{const saved=JSON.parse(storage().getItem(DFT_SETTINGS_KEY)||'null');if(saved&&typeof saved==='object')apply(saved);}
   catch{/* Ignore unreadable or foreign values; defaults stay. */}
  },
  reset(){
   try{storage().removeItem(DFT_SETTINGS_KEY);}catch{}
   if(defaults)apply(defaults);
  }
 };
}

// Native file buttons show the browser's language and cannot be styled
// consistently. A translatable label opens the same, still focusable input.
export function fileSelectionText(files){
 const count=files?.length||0;
 if(!count)return 'Dosya seçilmedi';
 return count===1?files[0].name:count+' dosya seçildi';
}
export function enhanceFilePickers(root,doc=document){
 for(const input of root.querySelectorAll('input[type=file]')){
  if(!input.id||input.closest('.dft-file-picker'))continue;
  const picker=doc.createElement('span');picker.className='dft-file-picker';
  // Inside an existing <label> the button is a span: labels must not nest, and the outer one already opens the input.
  const wrapped=!!input.closest('label');
  const button=doc.createElement(wrapped?'span':'label');button.className='dft-file-button';if(!wrapped)button.htmlFor=input.id;
  button.textContent=input.multiple?'Dosyaları seç':'Dosya seç';
  const name=doc.createElement('span');name.className='dft-file-name';name.setAttribute('aria-hidden','true');
  const update=()=>{name.textContent=fileSelectionText(input.files);};
  input.classList.add('dft-file-input');input.before(picker);picker.append(input,button,name);
  input.addEventListener('change',update);update();
 }
}

// WAI-ARIA tabs with automatic activation: arrows, Home and End move between
// tabs that are not locked and follow their links.
export function initTabKeys(tablist){
 tablist.addEventListener('keydown',event=>{
  const tabs=[...tablist.querySelectorAll('[role=tab]')].filter(tab=>tab.getAttribute('aria-disabled')!=='true');
  const index=tabs.indexOf(event.target.closest('[role=tab]'));
  if(index<0)return;
  const next={ArrowRight:index+1,ArrowLeft:index-1,Home:0,End:tabs.length-1}[event.key];
  if(next===undefined)return;
  event.preventDefault();
  const tab=tabs[(next+tabs.length)%tabs.length];
  tab.focus();tab.click();
 });
}
export function syncTabState(tablist,activeSection){
 for(const tab of tablist.querySelectorAll('[role=tab]')){
  const active=tab.dataset.dftSection===activeSection;
  tab.setAttribute('aria-selected',active?'true':'false');
  tab.tabIndex=active?0:-1;
 }
}
