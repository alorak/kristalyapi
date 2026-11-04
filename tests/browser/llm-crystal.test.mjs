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
 const errors=[],calls=[];
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
  calls.push({provider:'gemini',url:request.url(),headers:request.headers(),
   body:JSON.parse(request.postData()||'{}')});
  await route.fulfill({status:200,headers:cors,body:JSON.stringify({
   candidates:[{content:{parts:[{text:'Bu kristal yapısı hakkında test yanıtı.'}]}}]
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
 assert.equal(await rail.nth(1).getAttribute('data-right-tool'),'ai');

 await page.locator('#libraryNav').click();
 await page.locator('#libLlmTab').click();
 assert.equal(await page.locator('#libLlmPane').isVisible(),true);
 await page.locator('#llmGeminiKey').fill('synthetic-gemini-browser-key');
 await page.locator('#llmGeminiModel').fill('gemini-2.5-flash');
 await page.locator('#llmSaveSettings').click();
 assert.equal(await page.locator('#llmGeminiKey').inputValue(),'');
 assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('kristalyapi.llm.settings.v1')).geminiKey),
  'synthetic-gemini-browser-key');
 await page.locator('#homeLink').click();
 await page.locator('#rightToolRail [data-right-tool="ai"]').click();
 await page.locator('#llmChatPrompt').fill('Bu kristalin simetrisi nedir?');
 await page.locator('#llmChatSend').click();
 await page.waitForFunction(()=>document.getElementById('llmChatMessages')?.textContent?.includes('Bu kristal yapısı hakkında test yanıtı.'),null,{timeout:15000});
 assert.equal(calls[0].provider,'gemini');
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
 await page.locator('#rightToolRail [data-right-tool="ai"]').click();
 await page.waitForFunction(()=>document.getElementById('llmChatMessages')?.textContent?.includes('Bu kristal yapısı hakkında test yanıtı.'));
 assert.equal(await page.locator('#llmChatHistory option').count(),2,'saved session should survive reload');
 await page.locator('#llmChatNew').click();
 assert.equal(await page.locator('#llmChatHistory option').count(),3,'separate conversation');
 await page.locator('#llmChatDelete').click();
 assert.equal(await page.locator('#llmChatHistory option').count(),2,'deleting a session updates history');

 await page.locator('#llmChatOpenSettings').click();
 assert.equal(await page.locator('#libLlmPane').isVisible(),true);
 await page.locator('#llmProviderVllm').check();
 await page.locator('#llmVllmUrl').fill('http://127.0.0.1:18000/v1');
 await page.locator('#llmFetchModels').click();
 await page.waitForFunction(()=>document.querySelectorAll('#llmVllmKnownModels option').length===1);
 await page.locator('#llmVllmModel').fill('Qwen/Qwen3-8B');
 await page.locator('#llmSaveSettings').click();
 await page.locator('#homeLink').click();
 await page.locator('#rightToolRail [data-right-tool="ai"]').click();
 await page.locator('#llmChatNew').click();
 await page.locator('#llmChatPrompt').fill('Bu yapının hücre parametrelerini açıkla.');
 await page.locator('#llmChatSend').click();
 await page.waitForFunction(()=>document.getElementById('llmChatMessages')?.textContent?.includes('Yerel model yanıtı.'),null,{timeout:15000});
 assert.equal(calls.at(-1).provider,'vllm');
 assert.equal(calls.at(-1).body.messages[0].role,'system');
 assert.equal(calls.at(-1).body.model,'Qwen/Qwen3-8B');

 await page.locator('#llmChatClearAll').click();
 page.once('dialog',dialog=>dialog.accept());
 // The click above opens the confirmation; the handler accepts it.
 await page.waitForFunction(()=>localStorage.getItem('kristalyapi.llm.history.v1')===null);
 await page.locator('#llmChatOpenSettings').click();
 await page.locator('#llmClearSettings').click();
 assert.equal(await page.evaluate(()=>localStorage.getItem('kristalyapi.llm.settings.v1')),null);
 assert.deepEqual(errors,[],errors.join('\n'));
}finally{
 await browser?.close();await new Promise(resolve=>server.close(resolve));
}
