/* Browser-only SVG -> PNG, and high-resolution JPEG-in-PDF print export.
 * The original SVG is retained as fully editable vectors. PDF is explicitly
 * a 300-dpi raster image (no promise of editable PDF vector geometry).
 */
const encoder=new TextEncoder();
function num(n){return Number(n.toFixed(3));}
function concatenate(parts){
 const length=parts.reduce((s,a)=>s+a.length,0),out=new Uint8Array(length);
 let p=0;for(const a of parts){out.set(a,p);p+=a.length;}return out;
}
const bytes=s=>encoder.encode(s);
export function buildFigurePdf(jpeg,pixelWidth,pixelHeight){
 if(!(jpeg instanceof Uint8Array)||jpeg.length<4||jpeg[0]!==0xff||jpeg[1]!==0xd8||
  jpeg[jpeg.length-2]!==0xff||jpeg[jpeg.length-1]!==0xd9)
  throw Error('PDF için geçerli JPEG verisi gerekiyor.');
 if(!Number.isInteger(pixelWidth)||!Number.isInteger(pixelHeight)||pixelWidth<1||pixelHeight<1||
   pixelWidth>8192||pixelHeight>8192)throw Error('PDF boyutları geçersiz.');
 const maxW=842,maxH=1190,ratio=Math.min(maxW/pixelWidth,maxH/pixelHeight,1);
 // Export at 150 px/in or better in the PDF page; do not enlarge pixels above 1 pt.
 const pageWidth=num(pixelWidth*ratio),pageHeight=num(pixelHeight*ratio);
 const content=bytes('q\n'+pageWidth+' 0 0 '+pageHeight+' 0 0 cm\n/Figure Do\nQ\n');
 const chunks=[],offsets=[0];let length=0;
 const append=part=>{chunks.push(part);length+=part.length;};
 append(bytes('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n'));
 function obj(n,parts){
  offsets[n]=length;
  append(bytes(n+' 0 obj\n'));
  for(const part of parts)append(part);
  append(bytes('\nendobj\n'));
 }
 obj(1,[bytes('<< /Type /Catalog /Pages 2 0 R >>')]);
 obj(2,[bytes('<< /Type /Pages /Kids [3 0 R] /Count 1 >>')]);
 obj(3,[bytes('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 '+pageWidth+' '+pageHeight+
   '] /Resources << /XObject << /Figure 4 0 R >> >> /Contents 5 0 R >>')]);
 obj(4,[bytes('<< /Type /XObject /Subtype /Image /Width '+pixelWidth+' /Height '+pixelHeight+
   ' /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length '+jpeg.length+
   ' >>\nstream\n'),jpeg,bytes('\nendstream')]);
 obj(5,[bytes('<< /Length '+content.length+' >>\nstream\n'),content,bytes('endstream')]);
 const xref=length;
 append(bytes('xref\n0 6\n0000000000 65535 f \n'));
 for(let i=1;i<=5;i++)append(bytes(String(offsets[i]).padStart(10,'0')+' 00000 n \n'));
 append(bytes('trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n'+xref+'\n%%EOF\n'));
 return concatenate(chunks);
}
export function saveBlob(blob,name){
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
 setTimeout(()=>URL.revokeObjectURL(url),5000);
}
export async function svgToCanvas(svg,width,height,{scale=2}={}){
 if(!Number.isInteger(width)||!Number.isInteger(height)||width<1||height<1||
 width>4096||height>4096||![1,2,3].includes(scale)||width*height*scale*scale>20_000_000)
 throw Error('Görsel boyutu güvenli raster sınırının dışında.');
 const blob=new Blob([svg],{type:'image/svg+xml;charset=utf-8'});
 const url=URL.createObjectURL(blob),img=new Image();
 try{
  await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('SVG raster yüklenemedi.'));img.src=url;});
  const canvas=document.createElement('canvas');
  canvas.width=width*scale;canvas.height=height*scale;
  const ctx=canvas.getContext('2d');if(!ctx)throw Error('Tarayıcı 2B Canvas açamadı.');
  ctx.fillStyle='#ffffff';ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.drawImage(img,0,0,canvas.width,canvas.height);
  return canvas;
 }finally{URL.revokeObjectURL(url);}
}
export async function figurePng(svg,width,height){
 const canvas=await svgToCanvas(svg,width,height,{scale:2});
 const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(Error('PNG oluşturulamadı.')),'image/png'));
 return blob;
}
export async function figurePdf(svg,width,height){
 const canvas=await svgToCanvas(svg,width,height,{scale:2});
 const base64=canvas.toDataURL('image/jpeg',.94).split(',')[1];
 const raw=atob(base64),jpeg=new Uint8Array(raw.length);
 for(let i=0;i<raw.length;i++)jpeg[i]=raw.charCodeAt(i);
 return new Blob([buildFigurePdf(jpeg,canvas.width,canvas.height)],{type:'application/pdf'});
}
