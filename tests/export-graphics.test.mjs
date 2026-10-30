import test from 'node:test';
import assert from 'node:assert/strict';
import zlib from 'node:zlib';
import {createRequire} from 'node:module';
import {EXPORT_GLYPHS} from '../export-glyphs.js';
import {textOutline,svgPathData,pdfPathData,postScriptPathData,pointOccluded,visibleLineIntervals,
 sphereShade,mixHex,crc32,pngWithDpi,lzwEncode} from '../export-graphics.js';

const {tiffLzwDecode}=createRequire(import.meta.url)('./tiff-lzw-decode.cjs');
const close=(actual,expected,tolerance=2e-3)=>assert.ok(Math.abs(actual-expected)<=tolerance,actual+' ≉ '+expected);

test('text outlines use real glyph advances and are centred on the anchor',()=>{
 const bold=EXPORT_GLYPHS.bold,advance=bold.glyphs.X[0]*13/bold.unitsPerEm;
 const x=textOutline('X',{x:100,y:50,size:13,bold:true});
 close(x.width,advance);
 const xs=x.commands.flatMap(([,...v])=>v.filter((_,i)=>i%2===0));
 assert.ok(Math.min(...xs)>=100-advance/2-1e-9&&Math.max(...xs)<=100+advance/2+1e-9,'X stays inside its centred advance box');
 const ys=x.commands.flatMap(([,...v])=>v.filter((_,i)=>i%2===1));
 close(Math.min(...ys),50-bold.capHeight*13/bold.unitsPerEm,0.05);close(Math.max(...ys),50,0.05);
 assert.equal(textOutline('Si',{size:12}).width>textOutline('S',{size:12}).width,true);
 assert.deepEqual(textOutline('☃',{size:10}).commands,textOutline('?',{size:10}).commands,'unknown characters fall back to ?');
 assert.deepEqual(textOutline('',{size:10}),{width:0,commands:[]});
 assert.ok(textOutline('Å α',{size:10}).commands.length>0);
 assert.throws(()=>textOutline('a',{size:0}),/boyutu/);
});

test('outline commands serialize to SVG, PDF and PostScript path operators',()=>{
 const commands=[['M',0,0],['L',1.25,0],['C',1,1,2,2,3,3],['Z']];
 assert.equal(svgPathData(commands),'M0 0L1.25 0C1 1 2 2 3 3Z');
 assert.equal(pdfPathData(commands),'0 0 m\n1.25 0 l\n1 1 2 2 3 3 c\nh');
 assert.equal(postScriptPathData(commands),'0 0 moveto\n1.25 0 lineto\n1 1 2 2 3 3 curveto\nclosepath');
 assert.throws(()=>svgPathData([['M',NaN,0]]),/sonlu/);
});

test('bonds stop at atom surfaces: the part inside the back atom is hidden too',()=>{
 // Orthographic view down -z. Atom A is in front, atom B behind and to the right.
 const A={center:[0,0,-10],radius:1},B={center:[2,0,-12],radius:1};
 const intervals=visibleLineIntervals(A.center,B.center,[A,B],{samples:64});
 assert.equal(intervals.length,1);
 const [s0,s1]=intervals[0];
 close(s0,0.5,0.01);   // hidden behind A's disc until x = 1
 // Hidden by B once 2 - x < sqrt(1 - (2 - x)^2), i.e. x > 2 - 1/sqrt(2).
 close(s1,1-Math.SQRT1_2/2,0.01);
 // Every visible point is outside both spheres and in front of B's surface.
 for(let k=1;k<10;k++){
  const s=s0+(s1-s0)*k/10,p=A.center.map((v,i)=>v+(B.center[i]-v)*s);
  assert.equal(pointOccluded(p,[A,B],false),false);
  assert.ok(Math.hypot(...p.map((v,i)=>v-B.center[i]))>=1-1e-3);
 }
});

test('cell edges disappear only where an atom covers them',()=>{
 const atom={center:[0,0,-10],radius:1},behind=[[-3,0,-15],[3,0,-15]];
 const ortho=visibleLineIntervals(...behind,[atom],{samples:48});
 assert.equal(ortho.length,2);close(ortho[0][1],1/3);close(ortho[1][0],2/3);
 // Perspective: the shadow cone widens behind the atom (half-width 15·tan(asin(0.1))).
 const half=15*Math.tan(Math.asin(.1)),perspective=visibleLineIntervals(...behind,[atom],{perspective:true,samples:48});
 close(perspective[0][1],(3-half)/6);close(perspective[1][0],(3+half)/6);
 assert.deepEqual(visibleLineIntervals([-3,0,-5],[3,0,-5],[atom],{samples:48}),[[0,1]],'a line in front of the atom stays whole');
 assert.deepEqual(visibleLineIntervals([-3,5,-15],[3,5,-15],[atom],{samples:48}),[[0,1]],'a line beside the atom stays whole');
 assert.deepEqual(visibleLineIntervals([0,0,-9.5],[0,0,-10.5],[atom]),[],'a line inside an atom is hidden');
});

test('sphere shading is shared and opaque',()=>{
 assert.deepEqual(sphereShade('#CC3300'),{light:'#f1c6b8',base:'#cc3300',dark:'#852100'});
 assert.equal(mixHex('#000000','#ffffff',.5),'#808080');
 assert.throws(()=>sphereShade('red'),/rengi/);
});

function minimalPng(extra=[]){
 const chunk=(type,data)=>{
  const body=Buffer.concat([Buffer.from(type,'latin1'),data]),out=Buffer.alloc(body.length+8);
  out.writeUInt32BE(data.length,0);body.copy(out,4);out.writeUInt32BE(zlib.crc32(body),body.length+4);return out;
 };
 const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(1,0);ihdr.writeUInt32BE(1,4);ihdr[8]=8;ihdr[9]=2;
 return new Uint8Array(Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),
  ...extra.map(([type,data])=>chunk(type,data)),chunk('IDAT',zlib.deflateSync(Buffer.from([0,255,0,0]))),chunk('IEND',Buffer.alloc(0))]));
}
function chunks(png){
 const out=[],b=Buffer.from(png);
 for(let at=8;at<b.length;){
  const length=b.readUInt32BE(at),type=b.toString('latin1',at+4,at+8),data=b.subarray(at+8,at+8+length);
  assert.equal(b.readUInt32BE(at+8+length),zlib.crc32(b.subarray(at+4,at+8+length)),type+' CRC');
  out.push({type,data});at+=12+length;
 }
 return out;
}

test('PNG gains a pHYs chunk with the print resolution, replacing any old one',()=>{
 assert.equal(crc32(new TextEncoder().encode('IEND')),0xae426082);
 const out=chunks(pngWithDpi(minimalPng(),300));
 assert.deepEqual(out.map(c=>c.type),['IHDR','pHYs','IDAT','IEND']);
 const phys=out[1].data;
 assert.equal(phys.readUInt32BE(0),11811);assert.equal(phys.readUInt32BE(4),11811);assert.equal(phys[8],1,'unit: metre');
 const replaced=chunks(pngWithDpi(minimalPng([['pHYs',Buffer.alloc(9)]]),600));
 assert.deepEqual(replaced.map(c=>c.type),['IHDR','pHYs','IDAT','IEND']);
 assert.equal(replaced[1].data.readUInt32BE(0),23622);
 assert.throws(()=>pngWithDpi(new Uint8Array(40),300),/PNG/);
 assert.throws(()=>pngWithDpi(minimalPng(),0),/DPI/);
});

test('TIFF LZW round-trips through an independent decoder, including table resets',()=>{
 let seed=7;const random=()=>(seed=(seed*1103515245+12345)>>>0)>>>24;
 const noisy=Uint8Array.from({length:60000},random);
 const smooth=Uint8Array.from({length:200000},(_,i)=>i%600<300?255:(i>>4)&255);
 for(const input of [new Uint8Array(0),Uint8Array.of(9),Uint8Array.of(1,1,1,1,1,1,1),noisy,smooth]){
  assert.deepEqual(Uint8Array.from(tiffLzwDecode(lzwEncode(input))),input);
 }
 assert.ok(lzwEncode(smooth).length<smooth.length/5,'flat image regions compress well');
 assert.throws(()=>lzwEncode([1,2,3]),/bayt/);
});
