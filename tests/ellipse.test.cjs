const {test,before}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');let kernel,settings,points,fromPoints;
before(async()=>{({ellipseSettings:settings,ellipsePoints:points,ellipseFromPoints:fromPoints}=await import('../ellipse-tool.mjs'));const oc=await require('replicad-opencascadejs')({wasmBinary:fs.readFileSync(require.resolve('replicad-opencascadejs/wasm'))});kernel=(await import('../browser-engine/kernel.mjs')).createKernel(oc)});
const close=(a,b,t=1e-5)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
test('Exact rotated ellipses preserve independent area, signed volume, axes, paths and STEP',async()=>{
 for(const [rx,ry,angle]of [[25,15,0],[10,30,33],[12,12,90],[30,1,127]]){
  const ellipse={rx,ry,angle,center:{x:4,y:-7}},region=(await kernel.handle('/regions',{profiles:[{ellipse}]})).regions[0];close(region.area,Math.PI*rx*ry);
  const paths=(await kernel.handle('/paths',{profiles:[{ellipse}]})).paths;assert.equal(paths.length,1);assert.ok(['ELLIPSE','CIRCLE'].includes(paths[0].kind));
  for(const depth of [-6,4]){const recipe={type:'profile',ellipse,depth},body=await kernel.handle('/evaluate',recipe);assert.equal(body.valid,true);close(body.volume,Math.PI*rx*ry*Math.abs(depth));const step=await kernel.handle('/export-step',{objects:[recipe]});close((await kernel.handle('/import-cad/step',step.binary)).volume,body.volume)}
  const probe=await kernel.handle('/path-point',{brep:paths[0].brep,normalized:.23});const t=angle*Math.PI/180,x=probe.point[0]-4,y=probe.point[2]+7;close(((x*Math.cos(t)+y*Math.sin(t))/rx)**2+((-x*Math.sin(t)+y*Math.cos(t))/ry)**2,1);assert.ok(probe.curvature>0);
 }
});
test('Canonical ellipse B-Reps split overlaps and nested holes without losing analytic area',async()=>{
 const ellipse={rx:30,ry:20,angle:0,center:{x:0,y:0}},e=(await kernel.handle('/regions',{profiles:[{ellipse}]})).regions[0],circle=(await kernel.handle('/regions',{profiles:[{circle:{center:{x:0,y:0},r:5}}]})).regions[0];
 const nested=(await kernel.handle('/regions',{profiles:[{brep:e.brep},{brep:circle.brep}]})).regions;assert.equal(nested.length,2);const ring=nested.reduce((a,b)=>a.area>b.area?a:b);close(ring.area,Math.PI*(600-25));close((await kernel.handle('/evaluate',{type:'profile',brep:ring.brep,depth:3})).volume,ring.area*3);
 const shifted=(await kernel.handle('/regions',{profiles:[{ellipse:{...ellipse,center:{x:30,y:0}}}]})).regions[0],split=(await kernel.handle('/regions',{profiles:[{brep:e.brep},{brep:shifted.brep}]})).regions;assert.equal(split.length,3);const overlap=400*Math.PI-300*Math.sqrt(3);close(split.reduce((sum,f)=>sum+f.area,0),1200*Math.PI-overlap,.001);
});
test('Ellipse drafting validates bounds and samples the rotated equation without mutating settings',()=>{
 const input={rx:12,ry:24,angle:-30,center:{x:4,y:8}},copy=structuredClone(input),p=points(input);assert.deepEqual(input,copy);assert.equal(p.length,128);const angle=-Math.PI/6;for(const v of p){const x=v.x-4,y=v.y-8;close(((x*Math.cos(angle)+y*Math.sin(angle))/12)**2+((-x*Math.sin(angle)+y*Math.cos(angle))/24)**2,1)}
 assert.deepEqual(fromPoints({x:3,y:4},{x:-9,y:-20}),{rx:12,ry:24,angle:0,center:{x:3,y:4}});
 for(const bad of [null,{...input,rx:0},{...input,ry:NaN},{...input,rx:10001},{...input,angle:Infinity},{...input,center:{x:999999,y:0}}])assert.throws(()=>settings(bad));
});
