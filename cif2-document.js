/* V18.2: bounded typed CIF2 parser. NOT a general DDLm validator.
 * Treat Unicode strings as strings (never execute, eval, interpolate).
 * IUCr CIF2 List: whitespace-separated values; Table: quoted keys + colon.
 * Unknown typed metadata stays in a typed AST, not in crystallographic sites.
 */
import {isCif2} from './cif2-lex.js';
const RESERVED=/^(?:loop_|stop_|global_|save_.*|data_.+|_.+)$/i;
const SCIENCE=/^_(?:cell_|atom_site|space_group|symmetry_|geom_|diffrn_)/i;
const limits={bytes:4_000_000,line:2048,tokens:100_000,depth:12,nodes:8192,blocks:64};
const nameKey=s=>s.normalize('NFKC').toLowerCase();
export function readCif2Document(source){
 if(!isCif2(source))throw Error('CIF2 first line #\\#CIF_2.0 is required');
 if(source.length>limits.bytes)throw Error('CIF2 exceeds 4 MB limit');
 const s=source.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
 if(s.split('\n').some(x=>x.length>limits.line))throw Error('CIF2 line exceeds 2048 characters');
 if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(s))
  throw Error('CIF2 contains prohibited control characters');
 let i=0,col=0,nodes=0,tokens=0;
 const eat=()=>{const ch=s[i++];col=ch==='\n'?0:col+1;return ch};
 const blank=ch=>ch===' '||ch==='\t'||ch==='\n';
 const skip=()=>{while(i<s.length){if(blank(s[i])){eat();continue}
  if(s[i]==='#'){while(i<s.length&&s[i]!=='\n')eat();continue}break}};
 const item=()=>{
  if(++tokens>limits.tokens)throw Error('CIF2 too many lexical values');
  const start=i,ch=s[i],column=col;
  if(ch==="'"||ch==='"'){
   const width=s.slice(i,i+3)===ch.repeat(3)?3:1;for(let k=0;k<width;k++)eat();
   const begin=i;let found=false;
   while(i<s.length){
    if(s.slice(i,i+width)===ch.repeat(width)){
     const value=s.slice(begin,i);
     for(let j=0;j<width;j++)eat();
     const next=s[i];
     if(next!==undefined&&!blank(next)&&next!=='#'&&!']}:'.includes(next))
      throw Error('CIF2 quoted string must be separated from adjacent values');
     found=true;
     return {kind:'scalar',value,quoted:true,start,end:i};
    }
    if(width===1&&s[i]==='\n')break;
    eat();
   }
   if(!found)throw Error('CIF2 unterminated quoted string');
  }
  if(ch===';'&&column===0){
   eat();const begin=i;let closed=false;
   while(i<s.length){
    if(s[i]==='\n'&&s[i+1]===';'){
     const value=s.slice(begin,i);eat();eat();
     while(i<s.length&&s[i]!=='\n'){
      if(s[i]!==' '&&s[i]!=='\t'&&s[i]!=='#')
       throw Error('CIF2 malformed semicolon terminator');
      eat();
     }
     closed=true;return {kind:'scalar',value,quoted:true,start,end:i};
    }
    eat();
   }
   if(!closed)throw Error('CIF2 unterminated semicolon text');
  }
  if('[]{}:'.includes(ch)){eat();return {kind:'punct',value:ch,start,end:i}};
  const begin=i;
  while(i<s.length&&!blank(s[i])&&s[i]!=='#'&&!'[]{}'.includes(s[i]))eat();
  if(i===begin)throw Error('CIF2 invalid unquoted token');
  const value=s.slice(begin,i);
  if(value.startsWith("'")||value.startsWith('"'))
   throw Error('CIF2 illegal quote in whitespace-delimited string');
  return {kind:'scalar',value,quoted:false,start,end:i};
 };
 const stream=[];while(i<s.length){skip();if(i>=s.length)break;stream.push(item())}
 let cursor=0;
 const next=()=>stream[cursor];
 const command=t=>t?.kind==='scalar'&&!t.quoted&&RESERVED.test(t.value);
 const requireValue=(depth=0)=>{
  if(depth>limits.depth)throw Error('CIF2 compound nesting depth exceeded');
  if(++nodes>limits.nodes)throw Error('CIF2 compound node count exceeded');
  const token=stream[cursor++];if(!token)throw Error('CIF2 missing value');
  if(token.kind==='scalar'){
   if(command(token))throw Error('CIF2 directive cannot be used as unquoted value');
   return {kind:'scalar',value:token.value,quoted:token.quoted};
  }
  if(token.kind!=='punct')throw Error('Invalid CIF2 value');
  if(token.value==='['){
   const items=[];let prior=token;
   while(next()?.value!==']'){
    if(!next())throw Error('CIF2 unterminated List');
    if(items.length&&next().start===prior.end)throw Error('CIF2 List entries require whitespace');
    const before=cursor,datum=requireValue(depth+1);
    items.push(datum);prior=stream[cursor-1];
    if(before===cursor)throw Error('CIF2 List parser stalled');
   }
   cursor++;return {kind:'list',items};
  }
  if(token.value==='{'){
   const entries=[];const seen=new Set();let prior=token;
   while(next()?.value!=='}'){
    if(!next())throw Error('CIF2 unterminated Table');
    if(entries.length&&next().start===prior.end)throw Error('CIF2 Table entries require whitespace');
    const key=stream[cursor++];
    if(key?.kind!=='scalar'||!key.quoted)throw Error('CIF2 Table key must be quoted');
    const colon=stream[cursor++];
    if(colon?.value!==':'||colon.start!==key.end)throw Error('CIF2 Table key requires immediately adjacent colon');
    const normalized=nameKey(key.value);
    if(seen.has(normalized))throw Error('CIF2 duplicate Table key');
    seen.add(normalized);
    const value=requireValue(depth+1);
    entries.push({key:key.value,value});prior=stream[cursor-1];
   }
   cursor++;return {kind:'table',entries};
  }
  throw Error('CIF2 unexpected closing bracket/colon');
 };
 const blocks=[],blockNames=new Set();let active=null,frame=null;
 const addField=(scope,name,value)=>{
  const key=nameKey(name);if(scope.names.has(key))throw Error('Duplicate CIF2 data name: '+name);
  scope.names.add(key);scope.entries.push({kind:'scalar',name,value});
 };
 while(cursor<stream.length){
  const token=stream[cursor++],value=token.value;
  if(token.kind!=='scalar'||token.quoted)throw Error('CIF2 unexpected compound value at top level');
  if(/^data_\S+$/i.test(value)){
   if(frame)throw Error('CIF2 unterminated save frame');
   const name=value.slice(5),key=nameKey(name);
   if(blockNames.has(key))throw Error('CIF2 duplicate block code');
   if(blocks.length>=limits.blocks)throw Error('CIF2 too many data blocks');
   blockNames.add(key);
   active={name,entries:[],names:new Set(),frames:[],frameNames:new Set()};
   blocks.push(active);continue;
  }
  if(!active)throw Error('CIF2 data value outside data_ block');
  if(/^global_$|^stop_$/i.test(value))throw Error('CIF2 global_/stop_ not supported');
  if(/^save_/i.test(value)){
   if(value.toLowerCase()==='save_'){
    if(!frame)throw Error('CIF2 unpaired save_ terminator');
    frame=null;
   }else{
    if(frame)throw Error('CIF2 nested save frames forbidden');
    const name=value.slice(5),key=nameKey(name);
    if(active.frameNames.has(key))throw Error('CIF2 duplicate save-frame code');
    active.frameNames.add(key);
    frame={name,entries:[],names:new Set()};
    active.frames.push(frame);
   }
   continue;
  }
  const scope=frame||active;
  if(value.toLowerCase()==='loop_'){
   const names=[],local=new Set();
   while(next()?.kind==='scalar'&&!next().quoted&&next().value.startsWith('_')){
    const name=stream[cursor++].value,key=nameKey(name);
    if(scope.names.has(key)||local.has(key))throw Error('Duplicate CIF2 loop/data name: '+name);
    local.add(key);names.push(name);
   }
   if(!names.length)throw Error('CIF2 loop requires data names');
   const values=[];
   while(cursor<stream.length&&!command(next()))values.push(requireValue());
   if(!values.length||values.length%names.length)throw Error('CIF2 loop values misaligned');
   names.forEach(name=>scope.names.add(nameKey(name)));
   const rows=[];for(let p=0;p<values.length;p+=names.length)rows.push(values.slice(p,p+names.length));
   scope.entries.push({kind:'loop',names,rows});
   continue;
  }
  if(value.startsWith('_')){
   addField(scope,value,requireValue());continue;
  }
  throw Error('CIF2 unexpected top-level token: '+value);
 }
 if(frame)throw Error('CIF2 save frame not terminated');
 if(!blocks.length)throw Error('CIF2 requires a data_ block');
 return {schema:'CIF2_TYPED_AST_V18_2',blocks};
}
/* Preserve only audited, nonstructural typed metadata in project snapshots.
 * Zero-length metadata is valid. Reject malformed user-edited project JSON.
 */
export function safeCif2Metadata(raw){
 if(raw===undefined||raw===null)return [];
 if(!Array.isArray(raw)||raw.length>256)throw Error('Invalid CIF2 typed metadata');
 const visit=(node,depth=0)=>{
  if(depth>12||!node||typeof node!=='object')throw Error('Invalid CIF2 metadata nesting');
  if(node.kind==='scalar'){
   if(typeof node.value!=='string'||node.value.length>8192||typeof node.quoted!=='boolean')
    throw Error('Invalid CIF2 metadata string');
   return {kind:'scalar',value:node.value,quoted:node.quoted};
  }
  if(node.kind==='list'){
   if(!Array.isArray(node.items)||node.items.length>512)throw Error('Invalid CIF2 metadata List');
   return {kind:'list',items:node.items.map(v=>visit(v,depth+1))};
  }
  if(node.kind==='table'){
   if(!Array.isArray(node.entries)||node.entries.length>512)throw Error('Invalid CIF2 metadata Table');
   const seen=new Set();
   return {kind:'table',entries:node.entries.map(entry=>{
    if(typeof entry.key!=='string'||entry.key.length>256)throw Error('Invalid CIF2 Table key');
    const key=nameKey(entry.key);
    if(seen.has(key))throw Error('Duplicate CIF2 Table key');
    seen.add(key);return {key:entry.key,value:visit(entry.value,depth+1)};
   })};
  }
  throw Error('Unsupported CIF2 metadata kind');
 };
 const out=raw.map(entry=>{
  if(typeof entry.name==='string'&&/^_[a-z0-9_.-]{1,128}$/i.test(entry.name))
   return {name:entry.name,value:visit(entry.value)};
  if(Array.isArray(entry.names)&&entry.names.length<=64&&
      entry.names.every(n=>typeof n==='string'&&/^_[a-z0-9_.-]{1,128}$/i.test(n))&&
      Array.isArray(entry.rows)&&entry.rows.length<=512&&entry.rows.every(row=>
       Array.isArray(row)&&row.length===entry.names.length))
   return {names:entry.names.slice(),rows:entry.rows.map(row=>row.map(v=>visit(v)))};
  throw Error('Invalid CIF2 typed metadata entry');
 });
 if(JSON.stringify(out).length>60000)throw Error('CIF2 typed metadata exceeds 60 KB project limit');
 return out;
}

export function listCif2Structures(source){
 const doc=readCif2Document(source);
 return doc.blocks.map(block=>{
  const names=new Set(block.entries.flatMap(e=>e.kind==='scalar'?[nameKey(e.name)]:e.names.map(nameKey)));
  const structure=names.has('_cell_length_a')&&names.has('_atom_site_fract_x');
  return {name:block.name,structural:structure,frames:block.frames.length};
 });
}
export function selectCif2Structure(source,selectedName=null){
 const doc=readCif2Document(source);
 const candidates=listCif2StructuresFrom(doc);
 const chosen=selectedName===null?
    (candidates.length===1?candidates[0]:null):
    candidates.find(b=>nameKey(b.name)===nameKey(String(selectedName)));
 if(!chosen){
  const suffix=candidates.length?candidates.map(b=>b.name).join(', '):'none';
  throw Error('CIF2 structure selection required ('+suffix+'); choose exactly one data_ block');
 }
 const block=doc.blocks.find(b=>nameKey(b.name)===nameKey(chosen.name));
 const tokens=['data_'+block.name],compound=[],dropped=[];
 const dangerous=value=>typeof value==='string'&&/^(?:_|loop_|data_.+|save_.*|global_|stop_)$/i.test(value);
 for(const entry of block.entries){
  if(entry.kind==='scalar'){
   if(entry.value.kind==='scalar'){
    if(dangerous(entry.value.value)){
     if(SCIENCE.test(entry.name))throw Error('CIF2 reserved keyword cannot be converted to scientific scalar: '+entry.name);
     dropped.push(entry.name);continue;
    }
    tokens.push(entry.name,entry.value.value);
   }else if(SCIENCE.test(entry.name))throw Error('CIF2 compound scientific value unsupported: '+entry.name);
   else {compound.push({name:entry.name,value:entry.value});dropped.push(entry.name)}
   continue;
  }
  const complex=entry.rows.some(row=>row.some(v=>v.kind!=='scalar'||dangerous(v.value)));
  if(complex){
   if(entry.names.some(name=>SCIENCE.test(name)))
    throw Error('CIF2 compound values in structural loop require typed scientific mapping');
   compound.push({names:entry.names,rows:entry.rows});
   dropped.push(...entry.names);
  }else{
   tokens.push('loop_',...entry.names);
   for(const row of entry.rows)for(const cell of row)tokens.push(cell.value);
  }
 }
 return {name:block.name,tokens,blockCount:doc.blocks.length,
  structures:candidates.map(b=>b.name),ignoredSaveFrames:block.frames.length,
  typedMetadata:compound,ignoredCompoundNames:dropped};
}
function listCif2StructuresFrom(doc){
 return doc.blocks.filter(block=>{
  const tags=new Set(block.entries.flatMap(e=>e.kind==='scalar'?[nameKey(e.name)]:e.names.map(nameKey)));
  return tags.has('_cell_length_a')&&tags.has('_atom_site_fract_x');
 }).map(block=>({name:block.name}));
}
