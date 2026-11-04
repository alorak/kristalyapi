/* Browser acceptance with synthetic Gemini/vLLM responses only.
 * No real credentials or external model calls. */
import assert from 'node:assert/strict';
import {chromium} from 'playwright';
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const base=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const mime=f=>f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':
 f.endsWith('.wasm')?'application/wasm':f.endsWith('.svg')?'image/svg+xml':'text/html';
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://localhost');
 const file=path.resolve(base,'.'+(url.pathname==='/'?'/index.html':url.pathname));
 if(!file.startsWith(base+path.sep)){res.writeHead(403).end();return;}
 try{res.writeHead(200,{'Content-Type':mime(file)}).end(await fs.readFile(file));}
 catch{res.writeHead(404).end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
let browser;
try{
 browser=await chromium.launch({headless:true,args:[
  '--enable-webgl','--use-gl=angle','--use-angle=swiftshader',
  '--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const page=await browser.newPage({viewport:{width:1480,height:940}});
 const errors=[],calls=[],modelRequests=[];
 page.on('pageerror',error=>errors.push(error.message));
 const cors={
  'access-control-allow-origin':'*',
  'access-control-allow-methods':'POST,GET,OPTIONS',
  'access-control-allow-headers':'content-type,x-goog-api-key,authorization',
  'content-type':'application/json'
 };
 await page.route('https://generativelanguage.googleapis.com/**',async route=>{
  const request=route.request();
  if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers:cors});return;}
  if(request.method()==='GET'){
   modelRequests.push({url:request.url(),headers:request.headers()});
   await route.fulfill({status:200,headers:cors,body:JSON.stringify({
    models:[
     {name:'models/gemini-2.5-flash',displayName:'Gemini 2.5 Flash',supportedGenerationMethods:['generateContent']},
     {name:'models/gemini-2.5-flash-lite',displayName:'Gemini 2.5 Flash Lite',supportedGenerationMethods:['generateContent']},
     {name:'models/text-embedding-004',displayName:'Embedding',supportedGenerationMethods:['embedContent']}
    ]
   })});return;
  }
  calls.push({provider:'gemini',url:request.url(),headers:request.headers(),
   body:JSON.parse(request.postData()||'{}')});
  // Delayed synthetic completion verifies animation and hide/show without
  // cancelling the pending provider request.
  await new Promise(resolve=>setTimeout(resolve,3000));
  const text='### Kristal Özeti\n\n**Bu kristal yapısı hakkında test yanıtı.**\n\n- Si komşuluğu\n- Hücre\n\n| Element | Sayı |\n| --- | --- |\n| Si | 2 |\n\n<img src=x onerror=alert(1)>';
  await route.fulfill({status:200,headers:cors,body:JSON.stringify({
   candidates:[{content:{parts:[{text}]}}]
  })});
 });
 await page.route('http://127.0.0.1:18000/v1/**',async route=>{
  const request=route.request();
  if(request.method()==='OPTIONS'){await route.fulfill({status:204,headers:cors});return;}
  if(request.url().endsWith('/models')){
   await route.fulfill({status:200,headers:cors,body:JSON.stringify({data:[{id:'Qwen/Qwen3-8B'}]})});
   return;
  }
  calls.push({provider:'vllm',url:request.url(),headers:request.headers(),
   body:JSON.parse(request.postData()||'{}')});
  await route.fulfill({status:200,headers:cors,body:JSON.stringify({
   choices:[{message:{role:'assistant',content:'Yerel model yanıtı.'}}]
  })});
 });
 await page.goto('http://127.0.0.1:'+server.address().port+'/index.html');
 await page.waitForFunction(()=>document.getElementById('renderStatus')?.textContent?.startsWith('WebGL'),null,{timeout:45000});
 await page.locator('#languageTurkish').click();
 const rail=page.locator('#rightToolRail [data-right-tool]');
 assert.equal(await rail.nth(0).getAttribute('data-right-tool'),'info');
 assert.equal(await rail.nth(1).getAttribute('data-right-tool'),'comparison');
 assert.equal(await rail.count(),15);
 assert.equal(await page.locator('[data-right-tool="ai"]').count(),0);
 assert.equal(await page.locator('#llmChatDock').isVisible(),false);

 await page.locator('#libraryNav').click();
 await page.locator('#libLlmTab').click();
 assert.equal(await page.locator('#libLlmPane').isVisible(),true);
 await page.locator('#llmGeminiKey').fill('synthetic-gemini-browser-key');
 await page.locator('#llmFetchGeminiModels').click();
 await page.waitForFunction(()=>document.querySelectorAll('#llmGeminiModel option').length===2);
 assert.equal(modelRequests.length,1);
 assert.ok(modelRequests[0].url.includes('/v1beta/models?pageSize=100'));
 assert.equal(modelRequests[0].headers['x-goog-api-key'],'synthetic-gemini-browser-key');
 assert.ok(!modelRequests[0].url.includes('synthetic-gemini-browser-key'));
 await page.locator('#llmGeminiModel').selectOption('gemini-2.5-flash-lite');
 await page.locator('#llmSaveSettings').click();
 assert.equal(await page.locator('#llmGeminiKey').inputValue(),'');
 assert.equal(await page.locator('#llmGeminiModel').inputValue(),'gemini-2.5-flash-lite');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('kristalyapi.llm.settings.v1')).geminiKey),
  'synthetic-gemini-browser-key');
 await page.locator('#homeLink').click();
 await page.locator('#llmChatToggle').click();
 assert.equal(await page.locator('#llmChatDock').isVisible(),true);
 assert.equal(await page.locator('#llmChatToggle').getAttribute('aria-expanded'),'true');
 assert.equal(await page.locator('#llmChatDock').evaluate(el=>el.parentElement.id),'viewport',
  'chat dock must be mounted inside the 3D workspace, not above the tool rail');
 assert.equal(await page.locator('#llmChatPrompt').getAttribute('placeholder'),'Sormak istediğinizi sorabilirsiniz.');
 const assertChatFitsWorkspace=async()=>{
  const rects=await page.evaluate(()=>{
   const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();return {left:r.left,right:r.right};};
   const bar=document.getElementById('workbenchQuickbar').getBoundingClientRect();
   return {chat:{...rect('llmChatDock'),bottom:document.getElementById('llmChatDock').getBoundingClientRect().bottom},
    workspace:rect('viewport'),rail:rect('rightToolRail'),quickbarTop:bar.top};
  });
  assert.ok(rects.chat.right<=rects.workspace.right-6,'chat overflows workspace: '+JSON.stringify(rects));
  assert.ok(rects.chat.right<=rects.rail.left-6,'chat covers the right inspector icons: '+JSON.stringify(rects));
  assert.ok(rects.chat.bottom<=rects.quickbarTop-6,'quickbar intercepts chat composer: '+JSON.stringify(rects));
 };
 await assertChatFitsWorkspace();
 await page.setViewportSize({width:1000,height:760});
 await assertChatFitsWorkspace();
 await page.setViewportSize({width:1480,height:940});
 assert.equal(await page.locator('#llmChatModel').count(),0,'large provider settings card removed');
 assert.equal(await page.locator('#llmChatOpenSettings').count(),0,'large settings link removed');
 assert.equal(await page.locator('#llmChatClearAll').count(),0,'delete-all button removed');
 assert.equal(await page.locator('#llmChatHistoryPanel').isVisible(),false,'history collapsed initially');
 assert.equal(await page.locator('#llmChatMessages').evaluate(el=>el.classList.contains('is-empty')),true);
 await page.locator('#llmChatPrompt').fill('Bu kristalin simetrisi nedir?');
 await page.locator('#llmChatSend').click();
 assert.equal(await page.locator('#llmChatThinking').isVisible(),true,'animated progress is at the top of the panel');
 assert.equal(await page.locator('#llmChatStatus').textContent(),'','static waiting status is suppressed');
 await page.locator('#llmChatDockHide').click();
 assert.equal(await page.locator('#llmChatDock').isVisible(),false);
 await page.locator('#llmChatToggle').click();
 assert.equal(await page.locator('#llmChatDock').isVisible(),true);
 await page.waitForFunction(()=>document.getElementById('llmChatMessages')?.textContent?.includes('Bu kristal yapısı hakkında test yanıtı.'),null,{timeout:15000});
 assert.equal(await page.locator('#llmChatThinking').isVisible(),false);
 assert.equal(await page.locator('#llmChatMessages .llm-md h3').count(),1,'Markdown heading is rendered');
 assert.equal(await page.locator('#llmChatMessages .llm-md strong').count(),1,'Markdown emphasis is rendered');
 assert.equal(await page.locator('#llmChatMessages .llm-md li').count(),2,'Markdown list is rendered');
 assert.equal(await page.locator('#llmChatMessages .llm-md table').count(),1,'Markdown table is rendered');
 assert.equal(await page.locator('#llmChatMessages img').count(),0,'untrusted HTML must never run');
 assert.ok((await page.locator('#llmChatMessages').textContent()).includes('<img src=x'));
 assert.equal(calls[0].provider,'gemini');
 assert.ok(calls[0].url.includes('gemini-2.5-flash-lite:generateContent'));
 assert.equal(calls[0].headers['x-goog-api-key'],'synthetic-gemini-browser-key');
 assert.ok(!calls[0].url.includes('synthetic-gemini-browser-key'));
 assert.ok(calls[0].body.systemInstruction.parts[0].text.includes('STRUCTURE_DATA_JSON'));
 const firstHistory=await page.evaluate(()=>JSON.parse(localStorage.getItem('kristalyapi.llm.history.v1')));
 assert.equal(firstHistory.length,1);
 assert.equal(firstHistory[0].messages.length,2);
 assert.ok(firstHistory[0].snapshot.siteCount>0);
 assert.ok(!JSON.stringify(firstHistory).includes('synthetic-gemini-browser-key'));

 await page.reload();
 await page.waitForFunction(()=>document.getElementById('renderStatus')?.textContent?.startsWith('WebGL'),null,{timeout:45000});
 await page.locator('#llmChatToggle').click();
 await page.waitForFunction(()=>document.getElementById('llmChatMessages')?.textContent?.includes('Bu kristal yapısı hakkında test yanıtı.'));
 assert.equal(await page.locator('#llmChatHistoryPanel').isVisible(),false,'history collapsed after reload');
 assert.equal(await page.locator('#llmChatHistory option').count(),2,'saved session should survive reload');
 await page.locator('#llmChatHistoryToggle').click();
 assert.equal(await page.locator('#llmChatHistoryPanel').isVisible(),true,'history opens on demand');
 await page.locator('#llmChatNew').click();
 assert.equal(await page.locator('#llmChatHistory option').count(),3,'separate conversation');
 await page.locator('#llmChatDelete').click();
 assert.equal(await page.locator('#llmChatHistory option').count(),2,'deleting a session updates history');

 await page.locator('#libraryNav').click();
 await page.locator('#libLlmTab').click();
 assert.equal(await page.locator('#libLlmPane').isVisible(),true);
 await page.locator('#llmProviderVllm').check();
 await page.locator('#llmVllmUrl').fill('http://127.0.0.1:18000/v1');
 await page.locator('#llmFetchModels').click();
 await page.waitForFunction(()=>document.querySelectorAll('#llmVllmKnownModels option').length===1);
 await page.locator('#llmVllmModel').fill('Qwen/Qwen3-8B');
 await page.locator('#llmSaveSettings').click();
 await page.locator('#homeLink').click();
 await page.locator('#llmChatToggle').click();
 await page.locator('#llmChatNew').click();
 await page.locator('#llmChatPrompt').fill('Bu yapının hücre parametrelerini açıkla.');
 await page.locator('#llmChatSend').click();
 await page.waitForFunction(()=>document.getElementById('llmChatMessages')?.textContent?.includes('Yerel model yanıtı.'),null,{timeout:15000});
 assert.equal(calls.at(-1).provider,'vllm');
 assert.equal(calls.at(-1).body.messages[0].role,'system');
 assert.equal(calls.at(-1).body.model,'Qwen/Qwen3-8B');

 await page.locator('#llmChatHistoryToggle').click();
 await page.locator('#llmChatDelete').click();
 assert.equal(await page.locator('#llmChatHistory option').count(),2);
 await page.locator('#llmChatHistory').selectOption({index:1});
 await page.locator('#llmChatDelete').click();
 assert.equal(await page.locator('#llmChatHistory option').count(),1);
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('kristalyapi.llm.history.v1')).length),0);
 await page.locator('#libraryNav').click();
 await page.locator('#libLlmTab').click();
 await page.locator('#llmClearSettings').click();
 assert.equal(await page.evaluate(()=>localStorage.getItem('kristalyapi.llm.settings.v1')),null);
 assert.deepEqual(errors,[],errors.join('\n'));
}finally{
 await browser?.close();await new Promise(resolve=>server.close(resolve));
}
