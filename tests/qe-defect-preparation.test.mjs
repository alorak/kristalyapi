import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const {parserFromHtml}=require('./validation/js_cif_runner.cjs');
const root=new URL('../',import.meta.url);
const parse=parserFromHtml(fileURLToPath(new URL('index.html',root)));
const bundle=new URL('validation-results/qe-mos2-d5-preparation-20261029/',root);

for(const name of ['pristine','V_S','V_2S','O_S']){
  test(`D5 ${name} CIF opens in production parser with original explicit atoms`,()=>{
    const expected=JSON.parse(readFileSync(new URL(`${name}/structure.json`,bundle),'utf8'));
    const parsed=parse(readFileSync(new URL(`${name}/initial.cif`,bundle),'utf8'));
    assert.equal(parsed.sites.length,expected.atoms.length);
    assert.equal(Number(parsed.sgNumber),1);
    assert.ok(Math.abs(parsed.cell.c-24)<1e-10);
    assert.ok(Math.abs(parsed.cell.gamma-120)<1e-10);
    parsed.sites.forEach((site,index)=>{
      const atom=expected.atoms[index];
      assert.equal(site.symbol,atom.element);
      assert.equal(Number(site.occupancy??1),1);
      [site.x,site.y,site.z].forEach((v,k)=>assert.ok(Math.abs(v-atom.fractional[k])<1e-10));
    });
  });
}
