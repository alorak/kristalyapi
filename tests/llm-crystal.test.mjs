import test from 'node:test';
import assert from 'node:assert/strict';
import {
 LLM_SETTINGS_KEY,LLM_HISTORY_KEY,GEMINI_API,validateVllmUrl,
 normalizeLlmSettings,llmReady,readLlmSettings,writeLlmSettings,
 crystalSnapshot,readChatHistory,writeChatHistory,buildLlmRequest,
 requestLlm,getVllmModels,getGeminiModels,llmHttpError
} from '../llm-crystal-core.js';

const mem=()=>{const data=new Map();return {
 getItem:key=>data.get(key)||null,
 setItem:(key,val)=>data.set(key,String(val)),
 removeItem:key=>data.delete(key),data
};};
const gemini={provider:'gemini',geminiKey:'synthetic-test-key',geminiModel:'gemini-2.5-flash'};
const vllm={provider:'vllm',vllmUrl:'http://127.0.0.1:8000/v1',vllmModel:'Qwen/Qwen3-8B'};
const snapshot=crystalSnapshot({
 name:'Si',cell:{a:5.43,b:5.43,c:5.43,alpha:90,beta:90,gamma:90},
 sites:[{symbol:'Si',label:'Si1',x:0,y:0,z:0,occupancy:1},
  {symbol:'Si',label:'Si2',x:.25,y:.25,z:.25,occupancy:1}],
 sgNumber:227,sgSetting:'227-1',symmetryEnabled:true,rep:[2,2,2]
},'workspace-fixture');
const chat=[{role:'user',content:'What is the coordination?'}];
test('settings persist only in provided browser storage and restore after reload',()=>{
 const storage=mem();
 assert.equal(llmReady(readLlmSettings(storage)),false);
 const saved=writeLlmSettings(storage,gemini);
 assert.equal(saved.geminiKey,'synthetic-test-key');
 assert.equal(JSON.parse(storage.getItem(LLM_SETTINGS_KEY)).provider,'gemini');
 assert.equal(readLlmSettings(storage).geminiKey,'synthetic-test-key');
 storage.removeItem(LLM_SETTINGS_KEY);
 assert.equal(readLlmSettings(storage).geminiKey,'');
 assert.equal(llmReady(normalizeLlmSettings(vllm)),true);
 assert.throws(()=>normalizeLlmSettings({geminiModel:'../../unsafe'}),/model/i);
});
test('local vLLM addresses are bounded, credentials and public HTTP prohibited',()=>{
 assert.equal(validateVllmUrl('http://127.0.0.1:30000'),'http://127.0.0.1:30000/v1');
 assert.equal(validateVllmUrl('http://192.168.1.24:8000/v1'),'http://192.168.1.24:8000/v1');
 assert.equal(validateVllmUrl('http://localhost:8000/v1'),'http://localhost:8000/v1');
 assert.equal(validateVllmUrl('https://llm.example.org/v1'),'https://llm.example.org/v1');
 for(const value of ['file:///etc/passwd','javascript:alert(1)','http://user:pass@localhost:8000',
  'http://8.8.8.8:8000','http://localhost:8000/v1/chat/completions',
  'http://localhost:8000/v1?key=secret','http://localhost:8000/#secret'])
  assert.throws(()=>validateVllmUrl(value));
});
test('crystal structure snapshot preserves coordinate units and is bounded',()=>{
 assert.equal(snapshot.siteCount,2);
 assert.equal(snapshot.symmetryApplied,true);
 assert.equal(snapshot.sites[1].fractional[0],.25);
 assert.equal(snapshot.cell_A_degrees.a,5.43);
 assert.ok(snapshot.fingerprint.startsWith('site-'));
 assert.equal(snapshot.compositionBySiteOccupancy.Si,2);
 const lots=crystalSnapshot({sites:Array.from({length:150},(_,i)=>({symbol:'C',x:i/150,y:0,z:0}))});
 assert.equal(lots.sites.length,80);
 assert.equal(lots.omittedSites,70);
 assert.notEqual(crystalSnapshot({...snapshot,sites:[{symbol:'Si',x:1,y:0,z:0}]}).fingerprint,snapshot.fingerprint);
});
test('Gemini request keeps key out of URL and includes a precise structure system instruction',()=>{
 const req=buildLlmRequest(gemini,snapshot,chat);
 assert.equal(req.url,GEMINI_API+'/v1beta/models/gemini-2.5-flash:generateContent');
 assert.equal(req.headers['x-goog-api-key'],'synthetic-test-key');
 assert.ok(!req.url.includes('synthetic-test-key'));
 assert.equal(req.body.contents[0].role,'user');
 assert.equal(req.body.systemInstruction.parts[0].text.includes('"name":"Si"'),true);
 assert.match(req.body.systemInstruction.parts[0].text,/not a DFT or experimental/i);
});
test('vLLM uses OpenAI chat completions; optional auth token sent only as header',()=>{
 const req=buildLlmRequest({...vllm,vllmToken:'private-vllm-token'},snapshot,chat);
 assert.equal(req.url,'http://127.0.0.1:8000/v1/chat/completions');
 assert.equal(req.headers.Authorization,'Bearer private-vllm-token');
 assert.equal(req.body.model,'Qwen/Qwen3-8B');
 assert.equal(req.body.messages[0].role,'system');
 assert.equal(req.body.messages[1].role,'user');
 assert.ok(!req.url.includes('private-vllm-token'));
 assert.ok(!JSON.stringify(req.body).includes('private-vllm-token'));
});
test('Gemini mocked response and vLLM mocked response are text-only and credentials omitted',async()=>{
 const captured=[];
 const mock=data=>async(url,options)=>{
  captured.push({url,options});
  return {ok:true,headers:{get:()=>null},text:async()=>JSON.stringify(data)};
 };
 assert.equal(await requestLlm(gemini,snapshot,chat,{fetcher:mock({
  candidates:[{content:{parts:[{text:'Si has a diamond structure.'}]}}]
 })}),'Si has a diamond structure.');
 assert.equal(await requestLlm(vllm,snapshot,chat,{fetcher:mock({
  choices:[{message:{content:'Four nearest neighbors.'}}]
 })}),'Four nearest neighbors.');
 assert.equal(captured.length,2);
 for(const c of captured){assert.equal(c.options.credentials,'omit');assert.equal(c.options.cache,'no-store');
  assert.equal(c.options.referrerPolicy,'no-referrer');}
 assert.ok(captured[0].options.headers['x-goog-api-key']);
 assert.ok(!captured[1].options.headers['x-goog-api-key']);
});
test('vLLM model listing uses fixed /v1/models and handles records',async()=>{
 const urls=[];
 const names=await getVllmModels(vllm,{fetcher:async(url)=>{
  urls.push(url);
  return {ok:true,headers:{get:()=>null},text:async()=>JSON.stringify({data:[{id:'Qwen/Qwen3-8B'},{id:'local-checkpoint'}]})};
 }});
 assert.deepEqual(names,['Qwen/Qwen3-8B','local-checkpoint']);
 assert.deepEqual(urls,['http://127.0.0.1:8000/v1/models']);
});
test('history survives page refresh and stores per-session frozen structure without provider keys',()=>{
 const storage=mem();
 const sessions=[{id:'chat-123',title:'Si atomları',updated:Date.now(),
  snapshot,messages:[...chat,{role:'assistant',content:'Four.'}],provider:'gemini',model:'gemini-2.5-flash'}];
 writeChatHistory(storage,sessions);
 const saved=storage.getItem(LLM_HISTORY_KEY);
 assert.ok(!saved.includes('synthetic-test-key'));
 assert.ok(!saved.includes('private-vllm-token'));
 const restored=readChatHistory(storage);
 assert.equal(restored[0].snapshot.workspaceId,'workspace-fixture');
 assert.equal(restored[0].messages.length,2);
 assert.deepEqual(restored[0].snapshot.sites,snapshot.sites);
 storage.removeItem(LLM_HISTORY_KEY);
 assert.deepEqual(readChatHistory(storage),[]);
});
test('invalid server body and HTTP failure do not leak an API key',async()=>{
 const mock=async()=>({ok:false,status:403,headers:{get:()=>null}});
 await assert.rejects(requestLlm(gemini,snapshot,chat,{fetcher:mock}),err=>{
  assert.ok(!err.message.includes('synthetic-test-key'));
  return /HTTP 403/.test(err.message);
 });
 await assert.rejects(requestLlm(vllm,snapshot,chat,{fetcher:async()=>({
  ok:true,headers:{get:()=>null},text:async()=>JSON.stringify({choices:[{message:{content:''}}]})
 })}),/metin yanıtı/);
});

test('Gemini models.list fetches available generateContent models and paginates without leaking the key in URLs',async()=>{
 const visited=[];
 const result=await getGeminiModels(gemini,{fetcher:async(url,options)=>{
  visited.push({url,options});
  return {
   ok:true,status:200,headers:{get:()=>null},
   text:async()=>JSON.stringify(visited.length===1?{
    models:[
     {name:'models/gemini-2.5-flash',displayName:'Gemini 2.5 Flash',supportedGenerationMethods:['generateContent','countTokens']},
     {name:'models/text-embedding-004',displayName:'Embedding',supportedGenerationMethods:['embedContent']},
     {name:'models/gemini-2.5-flash',displayName:'Duplicate',supportedGenerationMethods:['generateContent']}
    ],nextPageToken:'page-2'
   }:{
    models:[{name:'models/gemini-2.5-flash-lite',displayName:'Gemini 2.5 Flash Lite',
      supportedGenerationMethods:['generateContent']}]
   })
  };
 }});
 assert.deepEqual(result,[
  {id:'gemini-2.5-flash',name:'Gemini 2.5 Flash'},
  {id:'gemini-2.5-flash-lite',name:'Gemini 2.5 Flash Lite'}
 ]);
 assert.equal(visited.length,2);
 assert.match(visited[0].url,/^https:\/\/generativelanguage\.googleapis\.com\/v1beta\/models\?pageSize=100$/);
 assert.ok(visited[1].url.includes('pageToken=page-2'));
 for(const visit of visited){
  assert.ok(!visit.url.includes('synthetic-test-key'));
  assert.equal(visit.options.headers['x-goog-api-key'],'synthetic-test-key');
  assert.equal(visit.options.credentials,'omit');
  assert.equal(visit.options.cache,'no-store');
  assert.equal(visit.options.method,'GET');
 }
 await assert.rejects(getGeminiModels({...gemini,geminiKey:''}),/API anahtarı/);
});
test('Gemini HTTP 402 diagnoses billing, while wrong/unsupported model indicates 404',async()=>{
 const payment=llmHttpError('gemini',402);
 assert.match(payment.message,/Gemini HTTP 402/);
 assert.match(payment.message,/kredi|faturalandırma/);
 assert.match(llmHttpError('gemini',404).message,/Model bulunamadı/);
 assert.match(llmHttpError('gemini',429).message,/kota/);
 assert.doesNotMatch(llmHttpError('gemini',402).message,/synthetic-test-key/);
 await assert.rejects(
  requestLlm(gemini,snapshot,chat,{fetcher:async()=>({
   ok:false,status:402,headers:{get:()=>null}
  })}),/Gemini HTTP 402.*kredi/
 );
 const vllmPayment=llmHttpError('vllm',402);
 assert.doesNotMatch(vllmPayment.message,/Google AI Studio/);
});
