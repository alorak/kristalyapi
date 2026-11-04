/**
 * Browser-only safe Markdown presentation for untrusted LLM text.
 * Never uses innerHTML, scriptable attributes, or HTML parsing.
 * Conservative subset: headings, emphasis, links, code, lists,
 * quotes, rules, tables and readable common inline mathematical notation.
 */
const make=(tag,cls='',str)=>{
 const node=document.createElement(tag);
 if(cls)node.className=cls;
 if(str!==undefined)node.textContent=String(str);
 return node;
};
function safeLink(input){
 try{
  const url=new URL(input);
  return (url.protocol==='https:'||url.protocol==='http:')?url.href:null;
 }catch{return null;}
}
const mathSymbols={
 '\\alpha':'α','\\beta':'β','\\gamma':'γ','\\delta':'δ','\\epsilon':'ε',
 '\\theta':'θ','\\lambda':'λ','\\mu':'μ','\\pi':'π','\\sigma':'σ','\\tau':'τ',
 '\\omega':'ω','\\Delta':'Δ','\\Gamma':'Γ','\\Omega':'Ω','\\AA':'Å',
 '\\circ':'°','\\times':'×','\\pm':'±','\\leq':'≤','\\geq':'≥',
 '\\approx':'≈','\\neq':'≠','\\infty':'∞','\\cdot':'·','\\rightarrow':'→'
};
function readableMath(raw){
 return raw
  .replace(/\\(?:text|mathrm)\{([^{}]*)\}/g,'$1')
  .replace(/\\bar\{([^{}]+)\}/g,(_,letter)=>letter+'\u0304')
  .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g,'($1)/($2)')
  .replace(/\\(?:left|right)\b/g,'')
  .replace(/\\[A-Za-z]+/g,word=>mathSymbols[word]||word)
  .replace(/\^\{?([0-9+-]+)\}?/g,(_,s)=>s.replace(/[0-9+-]/g,c=>
   ({'0':'⁰','1':'¹','2':'²','3':'³','4':'⁴','5':'⁵','6':'⁶','7':'⁷','8':'⁸','9':'⁹','+':'⁺','-':'⁻'})[c]))
  .replace(/_\{?([0-9+-]+)\}?/g,(_,s)=>s.replace(/[0-9+-]/g,c=>
   ({'0':'₀','1':'₁','2':'₂','3':'₃','4':'₄','5':'₅','6':'₆','7':'₇','8':'₈','9':'₉','+':'₊','-':'₋'})[c]));
}
function appendInline(host,source,depth=0){
 const input=String(source||'');
 if(depth>4){host.append(document.createTextNode(input));return;}
 const pattern=/(?<!\\)(\x60[^\x60\n]+\x60|\*\*[^*\n]+?\*\*|__[^_\n]+?__|~~[^~\n]+?~~|\*[^*\n]+?\*|(?<!\w)_[^_\n]+?_(?!\w)|\[[^\]\n]{1,200}\]\(https?:\/\/[^\s)]+\)|\$[^$\n]{1,300}\$)/g;
 let previous=0,match;
 while((match=pattern.exec(input))!==null){
  if(match.index>previous)host.append(document.createTextNode(input.slice(previous,match.index)));
  const token=match[0];
  if(token.charCodeAt(0)===96)host.append(make('code','',token.slice(1,-1)));
  else if(token.startsWith('**')||token.startsWith('__')){
   const b=make('strong');appendInline(b,token.slice(2,-2),depth+1);host.append(b);
  }else if(token.startsWith('~~')){
   const del=make('del');appendInline(del,token.slice(2,-2),depth+1);host.append(del);
  }else if(token.startsWith('*')||token.startsWith('_')){
   const em=make('em');appendInline(em,token.slice(1,-1),depth+1);host.append(em);
  }else if(token.startsWith('$')){
   const math=make('span','llm-math',readableMath(token.slice(1,-1)));math.title=token.slice(1,-1);
   host.append(math);
  }else if(token.startsWith('[')){
   const parts=/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/.exec(token);
   const href=parts&&safeLink(parts[2]);
   if(href){
    const link=make('a','llm-safe-link',parts[1]);
    link.href=href;link.target='_blank';link.rel='noopener noreferrer';host.append(link);
   }else host.append(document.createTextNode(token));
  }
  previous=match.index+token.length;
 }
 if(previous<input.length)host.append(document.createTextNode(input.slice(previous)));
}
const tableRow=line=>{
 let trimmed=line.trim();
 if(trimmed.startsWith('|'))trimmed=trimmed.slice(1);
 if(trimmed.endsWith('|'))trimmed=trimmed.slice(0,-1);
 return trimmed.split(/(?<!\\)\|/).map(cell=>cell.trim().replace(/\\\|/g,'|'));
};
const divider=/^\s*(?:[-*_]\s*){3,}$/;
const fence=/^\s{0,3}(\x60{3,}|~{3,})([a-zA-Z0-9+#._-]*)\s*$/;
const heading=/^\s{0,3}(#{1,6})\s+(.+)$/;
const bullet=/^\s{0,3}([-+*]|\d+[.)])\s+(.+)$/;
const quote=/^\s{0,3}>\s?(.*)$/;
const tableSeparator=line=>{
 const cells=tableRow(line);
 return cells.length>0&&cells.every(x=>/^:?-{3,}:?$/.test(x));
};
const special=(line,next='')=>fence.test(line)||heading.test(line)||divider.test(line)||
 bullet.test(line)||quote.test(line)||
 (line.includes('|')&&next.includes('|')&&tableSeparator(next));

/** Render a capped Markdown string as DOM. All user content remains inert text. */
export function renderLlmMarkdown(host,markdown){
 if(!host||typeof host.replaceChildren!=='function')throw Error('Markdown hedefi geçersiz.');
 const source=String(markdown??'').slice(0,18000).replace(/\r\n?/g,'\n');
 const lines=source.split('\n'),fragment=document.createDocumentFragment();
 const appendTextBlock=(tag,value,cls='')=>{
  const node=make(tag,cls);appendInline(node,value);fragment.append(node);return node;
 };
 let i=0;
 while(i<lines.length){
  const line=lines[i];
  if(!line.trim()){i++;continue;}
  let m=fence.exec(line);
  if(m){
   const marker=m[1],lang=m[2],body=[];i++;
   while(i<lines.length&&!new RegExp('^\\s{0,3}'+marker[0]+'{'+marker.length+',}\\s*$').test(lines[i]))body.push(lines[i++]);
   if(i<lines.length)i++;
   const pre=make('pre','llm-md-codeblock'),code=make('code','',body.join('\n'));
   if(lang)code.dataset.language=lang.slice(0,30);
   pre.append(code);fragment.append(pre);continue;
  }
  m=heading.exec(line);
  if(m){appendTextBlock('h'+m[1].length,m[2]);i++;continue;}
  if(divider.test(line)){fragment.append(make('hr'));i++;continue;}
  if(line.includes('|')&&i+1<lines.length&&tableSeparator(lines[i+1])){
   const heads=tableRow(line),table=make('table'),thead=make('thead'),tr=make('tr');
   heads.slice(0,12).forEach(text=>{const th=make('th');appendInline(th,text);tr.append(th);});
   thead.append(tr);table.append(thead);
   const tbody=make('tbody');i+=2;
   let count=0;
   while(i<lines.length&&lines[i].includes('|')&&count<80){
    const row=make('tr');tableRow(lines[i]).slice(0,12).forEach(cell=>{
     const td=make('td');appendInline(td,cell);row.append(td);
    });tbody.append(row);i++;count++;
   }
   table.append(tbody);
   const wrap=make('div','llm-md-table-wrap');wrap.append(table);fragment.append(wrap);continue;
  }
  if(bullet.test(line)){
   const ordered=/^\s{0,3}\d+[.)]\s/.test(line),list=make(ordered?'ol':'ul');
   let count=0;
   while(i<lines.length&&bullet.test(lines[i])&&count<250){
    const value=bullet.exec(lines[i])[2],item=make('li');
    appendInline(item,value);list.append(item);i++;count++;
   }
   fragment.append(list);continue;
  }
  if(quote.test(line)){
   const parts=[];
   while(i<lines.length&&quote.test(lines[i])){parts.push(quote.exec(lines[i])[1]);i++;}
   appendTextBlock('blockquote',parts.join(' '));continue;
  }
  const para=[line.trim()];i++;
  while(i<lines.length&&lines[i].trim()&&!special(lines[i],lines[i+1])){
   para.push(lines[i].trim());i++;
  }
  appendTextBlock('p',para.join(' '));
 }
 host.replaceChildren(fragment);
}
