const {test,before}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {gunzipSync}=require('node:zlib');
let converter,kernel;
before(async()=>{
 const oc=await require('replicad-opencascadejs')({wasmBinary:fs.readFileSync(require.resolve('replicad-opencascadejs/wasm'))});
 kernel=(await import('../browser-engine/kernel.mjs')).createKernel(oc);
 converter=await (await import('../browser-engine/iges-converter.mjs')).initializeIGES(gunzipSync(fs.readFileSync(path.join(__dirname,'../browser-engine/iges/vendor/nilicad_iges.wasm.gz'))));
});
const close=(a,b,tolerance=.001)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
const bounds=positions=>[0,1,2].map(axis=>positions.reduce((range,v,i)=>i%3===axis?[Math.min(range[0],v),Math.max(range[1],v)]:range,[Infinity,-Infinity]));
const rect=(x,y,w,h)=>{const p=[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];return {segments:p.map((a,i)=>({kind:'line',a,b:p[(i+1)%4]}))}};
test('IGES exact asymmetric, holed, negative and multi-body round trips preserve volume and bounds',async t=>{
 const {regions}=await kernel.handle('/regions',{profiles:[rect(0,0,20,20),{circle:{center:{x:10,y:10},r:5}}]});
 const ring={type:'profile',brep:regions.reduce((a,b)=>a.area>b.area?a:b).brep,depth:-4};
 const box={type:'box',dims:{x:10,y:20,z:30},transform:[1,0,0,0,0,1,0,0,0,0,1,0,50,9,11,1]};
 for(const objects of [[box],[ring],[box,ring]]){
  const originals=[];for(const object of objects)originals.push(await kernel.handle('/evaluate',object));
  const step=await kernel.handle('/export-step',{objects});
  const iges=converter.convert(step.binary,true);assert.ok(iges.byteLength>100);assert.match(new TextDecoder().decode(iges),/S\s*1/);
  const imported=await kernel.handle('/import-cad/step',converter.convert(iges,false));
  assert.equal(imported.valid,true);assert.equal(imported.solids,objects.length);close(imported.volume,originals.reduce((n,o)=>n+o.volume,0));
  const expected=bounds(originals.flatMap(o=>o.positions)),actual=bounds(imported.positions);
  for(let axis=0;axis<3;axis++)for(let end=0;end<2;end++)close(actual[axis][end],expected[axis][end]);
 }
 assert.ok(converter.heapBytes()<=128*1024*1024);t.diagnostic('IGES WASM heap bytes for tested models: '+converter.heapBytes());
});
test('IGES imports independent millimetre and inch Python OCCT fixtures',async()=>{
 for(const name of ['python-hole.iges','python-hole-inch.iges']){
 const bytes=fs.readFileSync(path.join(__dirname,'fixtures',name));
 const imported=await kernel.handle('/import-cad/step',converter.convert(bytes,false));
 assert.equal(imported.valid,true);assert.equal(imported.solids,1);close(imported.volume,2400-36*Math.PI);
 const size=bounds(imported.positions).map(([a,b])=>b-a);close(size[0],20);close(size[1],4);close(size[2],30);
 }
});
test('IGES rejects malformed/empty/oversized files and remains usable after a failed conversion',async()=>{
 for(const toIGES of [true,false])for(const input of [new Uint8Array(),new Uint8Array(20000001),new TextEncoder().encode('invalid CAD')])assert.throws(()=>converter.convert(input,toIGES));
 const data=await kernel.handle('/export-step',{objects:[{type:'box',dims:{x:4,y:5,z:6}}]});
 const recovered=await kernel.handle('/import-cad/step',converter.convert(converter.convert(data.binary,true),false));close(recovered.volume,120);
});
