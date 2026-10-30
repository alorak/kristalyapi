'use strict';
/* Independent TIFF 6.0 LZW decoder for tests: MSB-first codes and the
 * "early change" code-width rule that libtiff readers apply. */
function tiffLzwDecode(bytes){
 const out=[];
 let dict,width,bit=0,previous=null;
 const reset=()=>{dict=[];for(let i=0;i<256;i++)dict.push([i]);dict.push(null,null);width=9;};
 const read=()=>{
  let code=0;
  for(let i=0;i<width;i++,bit++)code=(code<<1)|((bytes[bit>>3]>>(7-(bit&7)))&1);
  return code;
 };
 reset();
 while(bit+width<=bytes.length*8){
  const code=read();
  if(code===257)return out;
  if(code===256){reset();previous=null;continue;}
  let entry;
  if(code<dict.length&&dict[code])entry=dict[code];
  else if(code===dict.length&&previous)entry=[...previous,previous[0]];
  else throw Error('invalid LZW code '+code);
  for(const value of entry)out.push(value);
  if(previous)dict.push([...previous,entry[0]]);
  previous=entry;
  if(dict.length+1>=(1<<width)&&width<12)width++;
 }
 throw Error('LZW stream has no end-of-information code');
}
module.exports={tiffLzwDecode};
