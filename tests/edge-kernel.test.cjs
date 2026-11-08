const {test,before}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');let kernel;
before(async()=>{const oc=await require('replicad-opencascadejs')({wasmBinary:fs.readFileSync(require.resolve('replicad-opencascadejs/wasm'))});kernel=(await import('../browser-engine/kernel.mjs')).createKernel(oc)});
const box={type:'box',dims:{x:20,y:30,z:10}},close=(a,b,t=.002)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const recipe=(top,index,mode,amount=2)=>({type:'edgeFinish',brep:top.brep,edgeIndices:Array.isArray(index)?index:[index],mode,amount});
test('Exact single-edge fillet/chamfer agrees with independent corner-volume formula for every box edge',async()=>{
 const top=await kernel.handle('/topology',box);
 for(const edge of top.edges)for(const mode of ['fillet','chamfer']){const data=await kernel.handle('/evaluate',recipe(top,edge.index,mode));assert.equal(data.valid,true);assert.equal(data.solids,1);close(data.volume,6000-edge.length*(mode==='fillet'?4*(1-Math.PI/4):2));const changed=await kernel.handle('/topology',{type:'brep',brep:data.brep});assert.ok(changed.faces.some(f=>f.kind===(mode==='fillet'?'CYLINDRE':'PLANE')));assert.ok(changed.faces.length>6)}
});
test('Multiple edges, curved edges, transformed and imported solids retain exact CAD geometry',async()=>{
 const top=await kernel.handle('/topology',box);const a=top.edges[0],b=top.edges.find(e=>e.index!==a.index&&e.length===a.length&&e.positions.every((v,i)=>i%3!==1||Math.abs(v-a.positions[i])>1));
 // All twelve box edges also exercise interacting corner blends.
 for(const mode of ['fillet','chamfer']){const rec=recipe(top,top.edges.map(e=>e.index),mode,1);const data=await kernel.handle('/evaluate',rec);assert.ok(data.volume>0&&data.volume<6000);const step=await kernel.handle('/export-step',{objects:[rec]});const loaded=await kernel.handle('/import-cad/step',step.binary);close(loaded.volume,data.volume)}
 const cylinder=await kernel.handle('/topology',{type:'cylinder',dims:{x:20,y:20,z:10}});for(const mode of ['fillet','chamfer']){const circle=cylinder.edges.find(e=>e.kind==='CIRCLE');const data=await kernel.handle('/evaluate',recipe(cylinder,circle.index,mode,1));assert.equal(data.valid,true);assert.ok(data.volume<Math.PI*1000&&data.volume>2900)}
 const transformed=await kernel.handle('/topology',{op:'transform',shape:box,transform:[0,0,-1,0,0,1,0,0,1,0,0,0,11,7,-3,1]});const edge=transformed.edges[0];close((await kernel.handle('/evaluate',recipe(transformed,edge.index,'chamfer',1))).volume,6000-edge.length/2);
 const imported=await kernel.handle('/topology',{type:'brep',brep:(await kernel.handle('/evaluate',recipe(top,0,'fillet',1))).brep});const next=await kernel.handle('/evaluate',recipe(imported,imported.edges.find(e=>e.kind==='LINE').index,'chamfer',.5));assert.equal(next.valid,true);
});
test('Invalid and oversized edge finishes fail without poisoning the next valid edit',async()=>{
 const top=await kernel.handle('/topology',box);for(const amount of [0,-1,NaN,Infinity,10001,1000])await assert.rejects(kernel.handle('/evaluate',recipe(top,0,'fillet',amount)));
 for(const indices of [[],[0,0],[-1],[.5],[999]])await assert.rejects(kernel.handle('/evaluate',recipe(top,indices,'chamfer')));await assert.rejects(kernel.handle('/evaluate',{...recipe(top,0,'fillet'),mode:'other'}));close((await kernel.handle('/evaluate',recipe(top,0,'chamfer',1))).volume,6000-top.edges[0].length/2);
});
