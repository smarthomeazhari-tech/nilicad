const {test,before}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');let kernel;
before(async()=>{const oc=await require('replicad-opencascadejs')({wasmBinary:fs.readFileSync(require.resolve('replicad-opencascadejs/wasm'))});kernel=(await import('../browser-engine/kernel.mjs')).createKernel(oc)});
const close=(a,b,t=.001)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const box={type:'box',dims:{x:20,y:30,z:10}};
const pull=(top,face,distance)=>kernel.handle('/evaluate',{type:'facePull',brep:top.brep,faceIndex:face.index,distance});
test('Exact topology enumerates CAD faces and edges and pulls every outward box face both ways',async()=>{
 const top=await kernel.handle('/topology',box);assert.equal(top.faces.length,6);assert.equal(top.edges.length,12);close(top.faces.reduce((s,f)=>s+f.area,0),2200);close(top.edges.reduce((s,e)=>s+e.length,0),240);
 for(const f of top.faces){assert.equal(f.kind,'PLANE');close(Math.hypot(...f.normal),1);assert.ok(f.positions.length&&f.indices.length);assert.ok(f.center.reduce((s,v,i)=>s+v*f.normal[i],0)>0,'Normal must point outwards');
  for(const d of [2,-2]){const data=await pull(top,f,d);assert.equal(data.valid,true);assert.equal(data.solids,1);close(data.volume,6000+f.area*d)}
 }
 assert.ok(top.edges.every(e=>e.kind==='LINE'&&e.positions.length>=6&&e.positions.length%6===0));
});
test('Planar pulling preserves holes, transformed topology and exact STEP interchange',async()=>{
 const plate={op:'subtract',left:box,right:{type:'cylinder',dims:{x:6,y:6,z:20}}};const top=await kernel.handle('/topology',plate);const cap=top.faces.find(f=>f.normal?.[1]>.99);const area=600-Math.PI*9;
 close(cap.area,area);const data=await pull(top,cap,3);close(data.volume,area*13);assert.ok(top.faces.some(f=>f.kind==='CYLINDRE'));assert.ok(top.edges.some(e=>e.kind==='CIRCLE'));
 const recipe={type:'facePull',brep:top.brep,faceIndex:cap.index,distance:3};const step=await kernel.handle('/export-step',{objects:[recipe]});const imported=await kernel.handle('/import-cad/step',step.binary);close(imported.volume,data.volume);
 const rotated={op:'transform',shape:box,transform:[0,0,-1,0,0,1,0,0,1,0,0,0,17,6,-9,1]};const transformed=await kernel.handle('/topology',rotated);for(const f of transformed.faces)close((await pull(transformed,f,1)).volume,6000+f.area);
 const existing=await kernel.handle('/topology',{type:'brep',brep:imported.brep});const next=await pull(existing,existing.faces.find(f=>f.normal?.[1]>.99),-1);close(next.volume,area*12);
});
test('Invalid, curved and collapsing direct edits fail without corrupting later topology',async()=>{
 const top=await kernel.handle('/topology',box),face=top.faces.find(f=>f.normal[1]>.99);for(const distance of [0,NaN,Infinity,-10,-100,10001])await assert.rejects(pull(top,face,distance));
 for(const faceIndex of [-1,.5,99])await assert.rejects(kernel.handle('/evaluate',{type:'facePull',brep:top.brep,faceIndex,distance:1}));
 const sphere=await kernel.handle('/topology',{type:'sphere',dims:{x:10,y:10,z:10}});await assert.rejects(pull(sphere,sphere.faces[0],1));const good=await pull(top,face,1);close(good.volume,6600);
});
