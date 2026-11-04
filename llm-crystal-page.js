/* Library LLM settings + right-hand crystal chat. Browser-only opt-in:
 * explicit submit sends a bounded structure snapshot to the selected provider.
 * Text is rendered with textContent, never interpreted as HTML/Markdown.
 */
import {
 normalizeLlmSettings,readLlmSettings,writeLlmSettings,llmReady,maskKeyState,
 getVllmModels,crystalSnapshot,readChatHistory,writeChatHistory,requestLlm,
 LLM_SETTINGS_KEY,LLM_HISTORY_KEY
} from './llm-crystal-core.js';
const $=id=>document.getElementById(id);
const t=(tr,en)=>window.CrystalI18n?.language==='en'?en:tr;
const el=(tag,cls='',value='')=>{
 const node=document.createElement(tag);
 if(cls)node.className=cls;
 node.textContent=value;
 return node;
};
export function initCrystalLlm({getStructure,getWorkspaceId,onOpenSettings}){
 let settings=readLlmSettings(localStorage);
 let sessions=readChatHistory(localStorage);
 let activeId=null,busy=false,pending=null;
 const status=(id,message,kind='')=>{$(id).textContent=message;$(id).dataset.status=kind;};
 const getSnapshot=()=>crystalSnapshot(getStructure(),getWorkspaceId());
 const active=()=>sessions.find(s=>s.id===activeId)||null;
 const persist=()=>{
  sessions.sort((a,b)=>b.updated-a.updated);
  // Preserve object identity while the HTTP request is pending; a response must
  // update the same session shown in the history list.
  writeChatHistory(localStorage,sessions);
 };
 const updateProvider=()=>{
  const vllm=$('llmProviderVllm').checked;
  $('llmGeminiFields').hidden=vllm;
  $('llmVllmFields').hidden=!vllm;
 };
 function settingsStatus(){
  const state=maskKeyState(settings);
  status('llmSettingsStatus',state.provider==='gemini'?
   (state.gemini?t('Gemini anahtarı tarayıcıda kayıtlı.','Gemini key saved in this browser.'):
    t('Gemini anahtarı henüz kayıtlı değil.','Gemini key not configured.')):
   (settings.vllmModel?t('vLLM adresi ve modeli kayıtlı.','vLLM address and model saved.'):
    t('vLLM modeli girilmedi.','No vLLM model configured.')),llmReady(settings)?'ready':'');
 }
 function renderSettings(){
  $('llmProviderGemini').checked=settings.provider==='gemini';
  $('llmProviderVllm').checked=settings.provider==='vllm';
  $('llmGeminiKey').value='';
  $('llmGeminiModel').value=settings.geminiModel;
  $('llmVllmUrl').value=settings.vllmUrl;
  $('llmVllmModel').value=settings.vllmModel;
  $('llmVllmToken').value='';
  updateProvider();settingsStatus();
 }
 function currentFormConfig(){
  return normalizeLlmSettings({
   provider:$('llmProviderVllm').checked?'vllm':'gemini',
   geminiKey:$('llmGeminiKey').value.trim()||settings.geminiKey,
   geminiModel:$('llmGeminiModel').value.trim(),
   vllmUrl:$('llmVllmUrl').value.trim(),
   vllmModel:$('llmVllmModel').value.trim(),
   vllmToken:$('llmVllmToken').value.trim()||settings.vllmToken
  });
 }
 for(const id of ['llmProviderGemini','llmProviderVllm'])$(id).addEventListener('change',updateProvider);
 $('llmSaveSettings').addEventListener('click',()=>{
  try{
   settings=writeLlmSettings(localStorage,currentFormConfig());
   renderSettings();renderChatHeader();
  }catch(error){status('llmSettingsStatus',t('Kaydedilemedi: ','Save failed: ')+error.message,'error');}
 });
 $('llmClearSettings').addEventListener('click',()=>{
  if(busy)pending?.abort();
  try{
   localStorage.removeItem(LLM_SETTINGS_KEY);
   settings=normalizeLlmSettings();renderSettings();renderChatHeader();
   status('llmSettingsStatus',t('LLM ayarları ve kayıtlı anahtarlar silindi. Sohbet geçmişi korundu.',
    'LLM settings and stored keys erased. Chat history retained.'),'ready');
  }catch(error){status('llmSettingsStatus',t('Ayarlar silinemedi: ','Could not erase settings: ')+error.message,'error');}
 });
 $('llmFetchModels').addEventListener('click',async()=>{
  $('llmFetchModels').disabled=true;
  status('llmSettingsStatus',t('vLLM modelleri sorgulanıyor…','Loading vLLM models…'));
  try{
   const config=currentFormConfig(),models=await getVllmModels(config);
   const list=$('llmVllmKnownModels');list.replaceChildren();
   for(const id of models){const opt=document.createElement('option');opt.value=id;list.append(opt);}
   if(models.length===1)$('llmVllmModel').value=models[0];
   status('llmSettingsStatus',models.length+
    t(' model bulundu. Model adını seçip ayarları kaydedin.',' models available. Select a model and save settings.'),'ready');
  }catch(error){status('llmSettingsStatus',
   t('Model listesi alınamadı: ','Could not list models: ')+error.message+
   t(' · CORS / ağ erişimini kontrol edin.',' · Check CORS / network access.'),'error');
  }finally{$('llmFetchModels').disabled=false;}
 });
 function renderChatHeader(){
  settings=readLlmSettings(localStorage);
  const cfg=settings;
  const title=cfg.provider==='gemini'?'Gemini · '+cfg.geminiModel:
   'vLLM · '+(cfg.vllmModel||t('model belirtilmedi','no model'));
  $('llmChatModel').textContent=title+(llmReady(cfg)?'':' · '+t('ayar gerekli','configure first'));
  const snapshot=getSnapshot(),session=active();
  $('llmChatStructure').textContent=session?
   session.snapshot.name+(session.snapshot.fingerprint===snapshot.fingerprint&&session.snapshot.workspaceId===snapshot.workspaceId?
    t(' · güncel yapı',' · current structure'):t(' · önceki yapı anlık görüntüsü',' · previous structure snapshot')):
   snapshot.name+t(' · güncel yapı',' · current structure');
 }
 function renderSessions(){
  const picker=$('llmChatHistory');picker.replaceChildren();
  const placeholder=document.createElement('option');placeholder.value='';
  placeholder.textContent=t('Sohbet seçin / yeni sohbet başlatın','Select a conversation / start a new chat');
  picker.append(placeholder);
  for(const session of sessions){
   const option=document.createElement('option');option.value=session.id;
   const date=session.updated?new Date(session.updated).toLocaleDateString():'';
   option.textContent=session.title+' · '+date;
   picker.append(option);
  }
  picker.value=activeId&&sessions.some(s=>s.id===activeId)?activeId:'';
  $('llmChatDelete').disabled=!active();
 }
 function renderMessages(){
  const host=$('llmChatMessages');host.replaceChildren();
  const session=active();
  if(!session||!session.messages.length){
   host.append(el('p','llm-chat-empty',
    t('Bu kristal hakkında soru sorun. Yanıtlar deneysel veya DFT doğrulaması yerine geçmez.',
      'Ask about this crystal. Answers are not experimental or DFT verification.')));
  }else{
   for(const msg of session.messages){
    const box=el('article','llm-chat-message '+(msg.role==='user'?'from-user':'from-model'));
    box.append(el('strong','llm-chat-message-role',msg.role==='user'?t('Siz','You'):t('Model','Model')));
    box.append(el('p','llm-chat-message-text',msg.content));
    host.append(box);
   }
  }
  renderChatHeader();
  renderSessions();
  host.scrollTop=host.scrollHeight;
 }
 function newSession(){
  const snapshot=getSnapshot();
  const uuid=typeof crypto!=='undefined'&&crypto.randomUUID?crypto.randomUUID():
   Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);
  const session={id:'chat-'+uuid,title:snapshot.name,updated:Date.now(),
   snapshot,messages:[],provider:settings.provider,model:''};
  sessions.unshift(session);activeId=session.id;
  if(sessions.length>30)sessions=sessions.slice(0,30);
  persist();renderMessages();return session;
 }
 function ensureCurrentSession(){
  const snapshot=getSnapshot(),selected=active();
  if(selected&&selected.snapshot.fingerprint===snapshot.fingerprint&&
   selected.snapshot.workspaceId===snapshot.workspaceId)return selected;
  return newSession();
 }
 $('llmChatHistory').onchange=e=>{
  if(busy)return;
  activeId=e.target.value||null;
  renderMessages();
 };
 $('llmChatNew').onclick=()=>{
  if(busy)return;
  try{newSession();status('llmChatStatus',t('Yeni sohbet açıldı.','New chat started.'));}
  catch(error){status('llmChatStatus',error.message,'error');}
 };
 $('llmChatDelete').onclick=()=>{
  if(busy)return;
  if(!activeId)return;
  sessions=sessions.filter(s=>s.id!==activeId);activeId=null;
  try{persist();renderMessages();status('llmChatStatus',t('Seçili sohbet silindi.','Conversation deleted.'));}
  catch(error){status('llmChatStatus',error.message,'error');}
 };
 $('llmChatClearAll').onclick=()=>{
  if(busy||!sessions.length)return;
  if(!window.confirm(t('Tüm yerel LLM sohbet geçmişi silinsin mi?','Delete all locally stored LLM chat history?')))return;
  try{localStorage.removeItem(LLM_HISTORY_KEY);sessions=[];activeId=null;
   renderMessages();status('llmChatStatus',t('Tüm sohbet geçmişi silindi.','All chat history erased.'));
  }catch(error){status('llmChatStatus',error.message,'error');}
 };
 $('llmChatOpenSettings').onclick=()=>onOpenSettings();
 $('llmChatAbort').onclick=()=>pending?.abort();
 function setBusy(value){
  busy=value;$('llmChatSend').disabled=value;$('llmChatNew').disabled=value;
  $('llmChatHistory').disabled=value;$('llmChatDelete').disabled=value||!active();
  $('llmChatClearAll').disabled=value;$('llmChatAbort').hidden=!value;
 }
 $('llmChatForm').addEventListener('submit',async event=>{
  event.preventDefault();if(busy)return;
  const question=$('llmChatPrompt').value.trim();
  if(!question)return;
  settings=readLlmSettings(localStorage);
  if(!llmReady(settings)){
   status('llmChatStatus',t('Önce Kütüphane → LLM Ayarları bölümünü yapılandırın.',
    'Configure Library → LLM Settings before chatting.'),'error');return;
  }
  let session,signal;
  try{
   session=ensureCurrentSession();
   session.messages.push({role:'user',content:question.slice(0,4000)});
   session.messages=session.messages.slice(-64);
   session.title=session.messages.filter(m=>m.role==='user').length===1?
    question.slice(0,52):session.title;
   session.updated=Date.now();session.provider=settings.provider;
   session.model=settings.provider==='gemini'?settings.geminiModel:settings.vllmModel;
   persist();$('llmChatPrompt').value='';renderMessages();
   setBusy(true);pending=new AbortController();signal=pending.signal;
   status('llmChatStatus',t('Model yanıtı bekleniyor…','Waiting for model response…'));
   const answer=await requestLlm(settings,session.snapshot,session.messages,{signal});
   if(signal.aborted)return;
   session.messages.push({role:'assistant',content:answer});
   session.messages=session.messages.slice(-64);
   session.updated=Date.now();
   persist();renderMessages();
   status('llmChatStatus',t('Yanıt tarayıcı geçmişine kaydedildi.','Answer saved to browser history.'),'ready');
  }catch(error){
   status('llmChatStatus',signal?.aborted?t('İstek iptal edildi.','Request cancelled.'):
    t('Sohbet hatası: ','Chat error: ')+error.message,'error');
  }finally{pending=null;setBusy(false);}
 });
 $('llmChatPrompt').addEventListener('keydown',event=>{
  if(event.key==='Enter'&&!event.shiftKey){
   event.preventDefault();$('llmChatForm').requestSubmit();
  }
 });
 window.addEventListener('crystal-language-change',()=>{renderSettings();renderMessages();});
 renderSettings();
 renderSessions();
 renderMessages();setBusy(false);
 return {
  onOpen(){
   settings=readLlmSettings(localStorage);
   const current=getSnapshot();
   const match=sessions.find(s=>s.snapshot.workspaceId===current.workspaceId&&
    s.snapshot.fingerprint===current.fingerprint);
   if(!active()||active().snapshot.workspaceId!==current.workspaceId)activeId=match?.id||null;
   renderMessages();
  }
 };
}
