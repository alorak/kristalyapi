import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {webcrypto} from 'node:crypto';
import {makeVesta3Export,vestaExportSha256} from '../vesta-project-export.js';
import {applyVesta3SiteAppearance,vesta3SectionTransferReport} from '../vesta-project-style.js';
import {parseVesta3View} from '../vesta-project-view.js';
import {parseVesta3ScientificStyles,validatedVestaDisplayVectors} from '../vesta-project-scientific.js';

const radii={Na:1.66,Cl:1.02,Si:1.11,O:.66,Fe:1.24};
const colors={Na:'#abcdee',Cl:'#67bc5e',Si:'#aabbcc',O:'#ff4433',Fe:'#334455'};
const options={radii,colorForSymbol:symbol=>colors[symbol]};
const source=()=>({
 name:'NaCl P1 reference',
 cell:{a:5.64,b:5.64,c:5.64,alpha:90,beta:90,gamma:90},
 sgNumber:1,sgSetting:'1',symmetryEnabled:false,nonPeriodic:false,
 rep:[1,1,1],bounds:[[0,1],[0,1],[0,1]],
 sites:[
  {symbol:'Na',label:'Na1',x:0,y:0,z:0,occupancy:1,visualColor:'#112233'},
  {symbol:'Cl',label:'Cl1',x:.5,y:.5,z:.5,occupancy:.7,visualScale:1.25}
 ],
 atomScale:.8,polyColor:'#54a1db',bondRules:'Na-Cl:2.10-3.00',
 bonds:true,labels:true,autoBond:false
});
function make(extra={}){
 const obj={...source(),...extra};
 return makeVesta3Export(obj,options);
}
// This is the ACTUAL KristalYapı importer function from the browser app,
// evaluated in a test-only isolated environment with cell validation stubs.
// It proves app->.vesta->same-app parser, NOT VESTA executable round-trip.
const application=readFileSync(new URL('../crystal-app.js',import.meta.url),'utf8');
function productionImporter(){
 const begin=application.indexOf('function vestaProjectData(source){');
 const end=application.indexOf('/* The browser',begin);
 assert.ok(begin>0&&end>begin);
 const extracted=application.slice(begin,end);
 const factory=new Function('validateCell','PERIODIC_SYMBOLS','cleanSymbol',
  'applyVesta3SiteAppearance','RADII','DEFAULT_BOUNDS','validatedBounds',
  'parseVesta3View','vesta3SectionTransferReport',
  'parseVesta3ScientificStyles','validatedVestaDisplayVectors',
  'preferredSetting','SPACE_GROUPS','validateSymmetryMetric',
  extracted+';return vestaProjectData;');
 return factory(x=>x,Object.keys(radii),x=>x[0].toUpperCase()+x.slice(1).toLowerCase(),
  applyVesta3SiteAppearance,radii,[[0,1],[0,1],[0,1]],x=>x,
  parseVesta3View,vesta3SectionTransferReport,parseVesta3ScientificStyles,
  validatedVestaDisplayVectors,()=>null,{},()=>false);
}
test('P1 VESTA export is bounded and contains real parseable structural subset',()=>{
 const output=make();
 assert.match(output.text,/^#VESTA_FORMAT_VERSION 3\.5\.0/m);
 for(const keyword of ['GROUP','SYMOP','CELLP','STRUC','BOUND','SBOND','SITET','ATOMT','POLYP'])
  assert.match(output.text,new RegExp('^'+keyword+'$','m'));
 assert.doesNotMatch(output.text,/IMPORT_(?:DENSITY|STRUCTURE|ORFFE|TEXTURE)/);
 assert.match(output.text,/^ 1 1 P 1$/m);
 assert.equal(output.manifest.exportSiteCount,2);
 assert.equal(output.manifest.scientificParity,'NOT_ESTABLISHED');
 assert.equal(output.manifest.vestaGuiStatus,'NOT_RUN');
});
test('generated .vesta can be read by actual KristalYapı VESTA importer (not desktop VESTA)',()=>{
 const imported=productionImporter()(make().text);
 assert.equal(imported.sites.length,2);
 assert.equal(imported.sgNumber,1);
 assert.equal(imported.symmetryEnabled,false);
 assert.equal(imported.sites[0].label,'Na1');
 assert.equal(imported.sites[0].visualColor,'#112233');
 assert.ok(Math.abs(imported.sites[1].occupancy-.7)<1e-9);
 assert.equal(imported.bondRules,'Na-Cl:2.1-3');
 assert.equal(imported.polyColor,'#54a1db');
 assert.ok(Math.abs(imported.sites[1].visualScale-1.25)<.00002);
});
test('P1 export rejects active higher symmetry, instead of silently losing symmetry',()=>{
 const s=source();s.sgNumber=225;s.symmetryEnabled=true;
 assert.throws(()=>makeVesta3Export(s,options),/refuses active non-P1 symmetry/);
 s.symmetryEnabled=false;
 const out=makeVesta3Export(s,options);
 assert.match(out.text,/^ 1 1 P 1$/m);
 assert.ok(out.manifest.entries.some(e=>e.field==='originalSpaceGroup'&&e.status==='DROPPED'));
});
test('no fabricated thermal/magnetic/volume values or unrestricted external file paths',()=>{
 const s=source();
 s.sites[0].adp=[.01,.02,.03,0,0,0];
 s.sites[1].magneticMoment=[1,0,0];
 s.vestaDisplayVectors=[{siteLabel:'Cl1',cartesian:[1,0,0]}];
 const out=makeVesta3Export(s,{...options,hasVolume:true});
 for(const name of ['ADP','magneticMoment','VECTR','volumeGrid/ISURF'])
  assert.ok(out.manifest.entries.some(e=>e.field===name),name);
 assert.deepEqual(out.manifest.externalFiles,
  [{role:'density-grid',path:null,sha256:null,status:'NOT_BUNDLED_NOT_HASHED'}]);
 assert.doesNotMatch(out.text,/IMPORT_DENSITY|VECTR|THERI/);
});
test('untrusted labels, site count, coordinates, occupancy, boundaries and bonds fail closed',()=>{
 const s=source();
 assert.throws(()=>makeVesta3Export({...s,sites:[{...s.sites[0],label:'Fe1\nIMPORT_DENSITY /etc/passwd'}]},options),/unsupported\/duplicate site/);
 assert.throws(()=>make({...s,bounds:[[1,0],[0,1],[0,1]]}),/low < high/);
 assert.throws(()=>make({...s,bondRules:'Na-Cl:1-20'}),/bond threshold/);
 assert.throws(()=>make({...s,sites:s.sites.map(site=>({...site,occupancy:1.2}))}),/invalid occupancy/);
 assert.throws(()=>make({...s,sites:s.sites.map(site=>({...site,x:NaN}))}),/invalid site x/);
 assert.throws(()=>make({...s,sites:[]}),/1\.\.1000/);
 assert.throws(()=>make({...s,nonPeriodic:true}),/refuses nonperiodic/);
});
test('single-token structural keyword title cannot shadow a VESTA section',()=>{
 for(const word of ['CELLP','STRUC','POLYP','BOUND','GROUP','CRYSTAL']){
  const s=source();s.name=word;
  const out=makeVesta3Export(s,options);
  assert.ok(out.text.includes('TITLE\nKristal '+word+'\n'));
  assert.equal(productionImporter()(out.text).sites.length,2);
 }
});
test('title never becomes an executable VESTA structural keyword',()=>{
 const s=source();s.name='CELL\nIMPORT_DENSITY /tmp/file';
 const out=makeVesta3Export(s,options);
 assert.doesNotMatch(out.text,/^IMPORT_DENSITY/m);
 assert.equal(productionImporter()(out.text).sites.length,2);
});
test('nonorthogonal lattice and selective occupancy survive six-decimal roundtrip',()=>{
 const s=source();s.cell={a:4.35,b:5.1,c:6.5,alpha:77.35,beta:99.7,gamma:106.3};
 s.sites[1].x=-.456789123;s.sites[1].occupancy=.1254;
 const imp=productionImporter()(makeVesta3Export(s,options).text);
 assert.ok(Math.abs(imp.cell.gamma-106.3)<1e-5);
 assert.ok(Math.abs(imp.sites[1].x-(-.456789))<2e-6);
 assert.ok(Math.abs(imp.sites[1].occupancy-.1254)<1e-5);
});
test('SHA256 loss manifest binding changes if any exported text is edited',async()=>{
 const output=make();
 const h=await vestaExportSha256(output.text,webcrypto);
 assert.match(h,/^[a-f0-9]{64}$/);
 assert.equal(await vestaExportSha256(output.text,webcrypto),h);
 assert.notEqual(await vestaExportSha256(output.text+'x',webcrypto),h);
 await assert.rejects(()=>vestaExportSha256(output.text,null),/SHA-256 unavailable/);
});
test('roundtrip remains explicitly lossy even when no optional fields present',()=>{
 const out=make();
 assert.equal(out.manifest.status,'LOSSY_NONVERIFIED');
 for(const field of ['SCENE/PROJT/LMATRIX/LIGHT','THERI','SBOND','SITET/ATOMT'])
  assert.ok(out.manifest.entries.some(e=>e.field===field));
 assert.equal(out.manifest.hasExternalVolume,false);
});
test('save dialog exposes separate VESTA and hash-linked loss report actions',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.match(html,/data-export="vesta"/);
 assert.match(html,/data-export="vesta-loss"/);
 assert.match(application,/from '\.\/vesta-project-export\.js'/);
 assert.match(application,/makeVesta3Export\(state/);
 assert.match(application,/vestaExportSha256\(output.text,globalThis.crypto\)/);
 assert.match(application,/const EXPORT_FORMATS=\['project','vesta','vesta-loss'/);
});
