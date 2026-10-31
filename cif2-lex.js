/* V18.1 bounded CIF2 lexical subset — not a complete CIF2 container parser.
 * Triple-quoted Unicode/string scalars are supported; compound List/Table
 * values are intentionally REJECTED until type-aware loop handling exists.
 * CIF1 tokenizer remains unmodified; all CIF2 errors fail closed.
 * Source: IUCr CIF2 2.0 syntax, J. Appl. Cryst. 49, 277-284 (2016).
 */
const MAGIC=/^(?:\uFEFF)?#\\#CIF_2\.0(?:[ \t]|$)/;
const CONTROL=/^(?:loop_|stop_|global_|save_(?:.*)|data_(?:.*)|_.*)$/i;
const RESERVED=/^(?:loop_|stop_|global_|save_.*|data_.*|_.*)$/i;
export function isCif2(source){
 return typeof source==='string'&&MAGIC.test(source.replace(/\r\n?/g,'\n').split('\n',1)[0]);
}
export function tokenizeCif2(source){
 if(!isCif2(source))throw Error('CIF2 requires first-line #\\#CIF_2.0 marker');
 if(source.length>4_000_000)throw Error('CIF2 document exceeds 4MB');
 const s=source.replace(/^\uFEFF/,'').replace(/\r\n?/g,'\n');
 const lines=s.split('\n');
 if(lines.some(line=>line.length>2048))throw Error('CIF2 2048-character line limit exceeded');
 if(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(s))
  throw Error('CIF2 disallowed control character');
 const tokens=[];let i=0,column=0;
 const eat=()=>{const ch=s[i++];if(ch==='\n')column=0;else column++;return ch;};
 const whitespace=ch=>ch===' '||ch==='\t'||ch==='\n';
 const takeQuote=(quote,offset)=>{
  // A CIF2 delimiter is either one or three quote characters.
  const triple=s.slice(i,i+3)===quote.repeat(3),width=triple?3:1;
  for(let k=0;k<width;k++)eat();
  const start=i;
  while(i<s.length){
   if(s.slice(i,i+width)===quote.repeat(width)){
    const value=s.slice(start,i);
    for(let k=0;k<width;k++)eat();
    const next=s[i];
    if(next!==undefined&&!whitespace(next)&&next!=='#')
     throw Error('CIF2 quoted value must be followed by whitespace');
    // Existing high-level parser uses string tokens, not a token AST.
    // Prevent a quoted data_/loop_/_tag from becoming a false directive.
    if(RESERVED.test(value))throw Error('CIF2 reserved keyword as quoted string needs typed parser');
    tokens.push(value);return;
   }
   if(!triple&&s[i]==='\n')throw Error('CIF2 single-quoted value cannot span lines');
   eat();
  }
  throw Error('Unterminated CIF2 '+(triple?'triple':'single')+' quoted value');
 };
 while(i<s.length){
  const ch=s[i];
  if(whitespace(ch)){eat();continue;}
  if(ch==='#'){while(i<s.length&&s[i]!=='\n')eat();continue;}
  if(ch===';'&&column===0){
   eat();const bodyStart=i;
   while(i<s.length){
    if(s[i]==='\n'&&s[i+1]===';'){
     const value=s.slice(bodyStart,i);eat();eat();
     // CIF2 text field is terminated at start of its closing line.
     // Consume only trailing inline whitespace/comment.
     while(i<s.length&&s[i]!=='\n'){
      if(s[i]!==' '&&s[i]!=='\t'&&s[i]!=='#')
       throw Error('Text field closing delimiter has trailing data');
      eat();
     }
     if(RESERVED.test(value.trim()))throw Error('CIF2 reserved keyword inside text field needs typed parser');
     tokens.push(value);break;
    }
    eat();
   }
   if(i===s.length&&tokens.at(-1)!==s.slice(bodyStart,i)) {
    // A closing semicolon at end-of-file is accepted only when found.
    if(!s.endsWith('\n;'))throw Error('Unterminated CIF2 text field');
   }
   continue;
  }
  if(ch==="'"||ch==='"'){takeQuote(ch);continue;}
  if(ch==='['||ch===']'||ch==='{'||ch==='}')
   throw Error('CIF2 List/Table values are not yet supported in crystallographic importer');
  const start=i;
  while(i<s.length&&!whitespace(s[i])&&s[i]!=='#'){
   if('[]{}'.includes(s[i]))throw Error('CIF2 List/Table values require typed parser');
   eat();
  }
  if(start===i)throw Error('Invalid CIF2 token');
  const token=s.slice(start,i);
  if(tokens.length>100000)throw Error('Too many CIF2 tokens');
  tokens.push(token);
 }
 assertCif2Flat(tokens);
 return tokens;
}
function assertCif2Flat(tokens){
 const seen=new Set();let blocks=0;
 for(let i=0;i<tokens.length;){
  const current=tokens[i],lower=current.toLowerCase();
  if(/^data_\S+$/i.test(current)){
   if(++blocks>1)throw Error('CIF2 multiple data blocks unsupported: select one structural block');
   i++;continue;
  }
  if(/^save_|^global_$|^stop_$/i.test(lower))
   throw Error('CIF2 save/global/stop directives require typed parser');
  if(lower==='loop_'){
   const names=[];i++;
   while(i<tokens.length&&tokens[i].startsWith('_')){
    const key=tokens[i++].toLowerCase();
    if(seen.has(key))throw Error('Duplicate CIF2 data name: '+key);
    seen.add(key);names.push(key);
   }
   if(!names.length)throw Error('CIF2 loop has no data names');
   let count=0;
   while(i<tokens.length&&!CONTROL.test(tokens[i])){i++;count++;}
   if(count===0||count%names.length!==0)throw Error('CIF2 loop values misaligned');
   continue;
  }
  if(current.startsWith('_')){
   const key=lower;
   if(seen.has(key))throw Error('Duplicate CIF2 data name: '+key);
   seen.add(key);
   if(i+1>=tokens.length||CONTROL.test(tokens[i+1]))
    throw Error('CIF2 scalar has missing value: '+key);
   i+=2;continue;
  }
  if(i===0||/^data_\S+$/i.test(tokens[i-1])){
   if(blocks===0)throw Error('CIF2 must contain data_ block');
   throw Error('Unexpected value directly after CIF2 block heading');
  }
  throw Error('Unexpected CIF2 top-level token: '+current);
 }
 if(blocks!==1)throw Error('CIF2 requires exactly one data_ block');
}
