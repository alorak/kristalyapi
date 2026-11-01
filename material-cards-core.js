/* P0 material cards: structural observations only, never inferred device properties.
 * Inputs are expanded, explicit P1 workspace sites; no COD/DFT provenance is invented. */
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const fields=['a','b','c','alpha','beta','gamma'];
const round=(n,d=6)=>Number(n.toFixed(d));
export function materialCard(structure,{sourceLabel='',sourceReference='',capturedAt=''}={}){
 if(!structure||typeof structure!=='object'||structure.nonPeriodic)throw Error('A periodic crystal structure is required.');
 const cell=structure.cell||{};
 for(const key of fields)if(!finite(cell[key]))throw Error('Invalid lattice parameter: '+key);
 if(fields.slice(0,3).some(key=>cell[key]<=0)||fields.slice(3).some(key=>cell[key]<=0||cell[key]>=180))
  throw Error('Cell lengths and angles must be physically valid.');
 const [alpha,beta,gamma]=fields.slice(3).map(key=>cell[key]*Math.PI/180);
 const cosine=[Math.cos(alpha),Math.cos(beta),Math.cos(gamma)];
 const gram=1+2*cosine[0]*cosine[1]*cosine[2]-cosine.reduce((s,x)=>s+x*x,0);
 if(gram<=1e-12)throw Error('Degenerate unit cell.');
 const sites=structure.sites;
 if(!Array.isArray(sites)||sites.length===0||sites.length>1000)throw Error('Expanded P1 sites must contain 1–1000 atoms.');
 const counts=new Map(),occupancies=[];
 for(const site of sites){
  if(!site||!/^([A-Z][a-z]?)$/.test(site.symbol)||!['x','y','z'].every(k=>finite(site[k])))
   throw Error('Invalid atom identity or position.');
  const occupancy=site.occupancy===undefined||site.occupancy===null?1:Number(site.occupancy);
  if(!Number.isFinite(occupancy)||occupancy<=0||occupancy>1)throw Error('Invalid occupancy.');
  counts.set(site.symbol,(counts.get(site.symbol)||0)+occupancy);
  occupancies.push(occupancy);
 }
 const symbols=[...counts.keys()].sort((a,b)=>a.localeCompare(b,'en'));
 const composition=Object.fromEntries(symbols.map(symbol=>[symbol,round(counts.get(symbol))]));
 const formula=symbols.map(symbol=>symbol+(Math.abs(composition[symbol]-1)<1e-8?'':String(composition[symbol]))).join('');
 return {
  schema:'kristalyapi.material-card.v1',
  name:String(structure.name||'Unnamed structure').slice(0,180),
  workspace:String(structure.workspace||'').slice(0,180),
  symmetry:String(structure.symmetry||'Not specified').slice(0,100),
  source:{kind:'workspace-snapshot',label:String(sourceLabel||structure.workspace||'Local workspace').slice(0,200),
   reference:String(sourceReference||'').slice(0,500),capturedAt:String(capturedAt||'')},
  cell:Object.fromEntries(fields.map(key=>[key,cell[key]])),
  volumeA3:round(cell.a*cell.b*cell.c*Math.sqrt(gram)),
  formula,composition,siteCount:sites.length,
  partialOccupancy:occupancies.some(v=>v<1),
  warnings:['Source identifiers describe user-provided data; no independent structure verification or DFT calculation was performed.']
 };
}
export const CARD_FIELDS=[
 ['formula','Composition','—'],
 ['symmetry','Space group / setting','—'],
 ['siteCount','P1 atom sites','count'],
 ['volumeA3','Cell volume','Å³'],
 ...['a','b','c'].map(k=>[k,'Cell '+k,'Å']),
 ...['alpha','beta','gamma'].map(k=>[k,'Cell '+k,'°'])
];
const value=(card,key)=>key in card.cell?card.cell[key]:card[key];
export function materialComparison(cards){
 if(!Array.isArray(cards)||cards.length<1||cards.length>4||cards.some(c=>c?.schema!=='kristalyapi.material-card.v1'))
  throw Error('Provide 1–4 material cards.');
 const basis=cards[0];
 return CARD_FIELDS.map(([key,label,unit])=>({key,label,unit,values:cards.map(c=>value(c,key)),
  deltas:cards.map((c,i)=>{
   if(i===0||!['a','b','c','alpha','beta','gamma','volumeA3'].includes(key))return null;
   const first=value(basis,key),next=value(c,key);
   return first===0?null:round((next-first)/first*100,4);
  })}));
}
function csvCell(value){const s=String(value??'');return /[",\n\r]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;}
export function materialComparisonCsv(cards){
 const rows=[['Field','Unit',...cards.map((c,i)=>'Structure '+(i+1)+': '+c.name)]];
 for(const row of materialComparison(cards))rows.push([row.label,row.unit,...row.values]);
 rows.push(['Source reference','',...cards.map(c=>c.source.reference||'Not supplied')]);
 rows.push(['Source type','',...cards.map(c=>c.source.kind)]);
 rows.push(['Snapshot at','',...cards.map(c=>c.source.capturedAt)]);
 rows.push(['Partial occupancy','',...cards.map(c=>String(c.partialOccupancy))]);
 return rows.map(row=>row.map(csvCell).join(',')).join('\n')+'\n';
}
