import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,resolve} from 'node:path';
import {mpIntegrationPresentation} from '../materials-project-page.js';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const read=path=>readFileSync(resolve(root,path),'utf8');

test('MP integration badge distinguishes configuration from connection verification',()=>{
 const off=mpIntegrationPresentation({});
 assert.deepEqual(off,{state:'inactive',label:'Entegrasyon kapalı',detail:'API anahtarı kayıtlı değil.'});
 const configured=mpIntegrationPresentation({hasKey:true,persisted:true});
 assert.equal(configured.state,'active');
 assert.equal(configured.label,'Entegrasyon aktif');
 assert.match(configured.detail,/henüz doğrulanmadı/);
 assert.ok(!configured.detail.includes('doğrulandı.'));
 const verified=mpIntegrationPresentation({hasKey:true,persisted:true,connection:'verified'});
 assert.equal(verified.state,'active');
 assert.equal(verified.detail,'API bağlantısı doğrulandı.');
 const failure=mpIntegrationPresentation({hasKey:true,persisted:true,connection:'error'});
 assert.equal(failure.state,'warning');
 assert.equal(failure.label,'Bağlantı sorunu');
 const ephemeral=mpIntegrationPresentation({hasKey:true});
 assert.equal(ephemeral.state,'active');
 assert.match(ephemeral.detail,/yalnızca bu oturumda/);
});
test('MP indicator has independent English labels',()=>{
 const active=mpIntegrationPresentation({hasKey:true,persisted:true,language:'en'});
 assert.equal(active.label,'Integration active');
 assert.match(active.detail,/not yet verified/);
 const off=mpIntegrationPresentation({language:'en'});
 assert.equal(off.label,'Integration off');
 const verified=mpIntegrationPresentation({hasKey:true,persisted:true,connection:'verified',language:'en'});
 assert.equal(verified.detail,'API connection verified.');
});
test('MP settings separates fixed-width form from text, without losing controls',()=>{
 const html=read('index.html');
 const start=html.indexOf('<section id="libMpSettingsPane"');
 const end=html.indexOf('</section>',start);
 assert.ok(start>=0&&end>start);
 const section=html.slice(start,end);
 assert.match(section,/class="mp-settings-grid"/);
 assert.match(section,/class="mp-settings-config"/);
 assert.match(section,/class="mp-settings-info"/);
 assert.ok(section.indexOf('mp-settings-config')<section.indexOf('mp-settings-info'));
 for(const id of ['mpIntegrationBadge','mpIntegrationDetail','mpApiKey','mpUseWorker',
  'mpKeyReveal','mpKeySave','mpKeyClear','mpKeyStatus','mpWorkerHelp']){
  assert.equal((section.match(new RegExp('id="'+id+'"','g'))||[]).length,1,'missing/duplicate '+id);
 }
 assert.match(section,/localStorage/);
 assert.match(section,/materialsproject\.org/);
});
test('MP settings typography is scoped, compact and responsive',()=>{
 const css=read('styles.css');
 assert.match(css,/#libMpSettingsPane\{font-size:12px;line-height:1\.5/);
 assert.match(css,/#libMpSettingsPane \.mp-settings-grid\{display:grid;grid-template-columns:minmax\(0,390px\) minmax\(0,1fr\)/);
 assert.match(css,/#libMpSettingsPane \.mp-settings-info \.hint\{font-size:12px!important;/);
 assert.match(css,/#libMpSettingsPane \.mp-integration-badge\[data-state="active"\]/);
 assert.match(css,/@media\(max-width:920px\)[\s\S]*?#libMpSettingsPane \.mp-settings-grid\{grid-template-columns:minmax\(0,1fr\)/);
});
test('badge refreshes on save, clear, transport changes and successful/failed API responses',()=>{
 const src=read('materials-project-page.js');
 assert.match(src,/const refreshIntegration=\(\)=>/);
 assert.match(src,/const keyStatus=\(\)=>\{/);
 assert.match(src,/connection='verified';refreshIntegration\(\)/);
 assert.match(src,/connection='error';refreshIntegration\(\)/);
 assert.match(src,/connection='unverified';refreshIntegration\(\)/);
 assert.match(src,/apiKey=key;[\s\S]{0,90}connection='unverified'/);
 assert.match(src,/connection='unverified';[\s\S]{0,110}const erased=eraseSavedKey/);
 assert.match(src,/window\.addEventListener\('crystal-language-change'/);
});
