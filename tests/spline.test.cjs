const {test,before}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');let kernel,settings,preview,defaults;
before(async()=>{({splineSettings:settings,splinePreview:preview,splineDefaults:defaults}=await import('../spline-tool.mjs'));const oc=await require('replicad-opencascadejs')({wasmBinary:fs.readFileSync(require.resolve('replicad-opencascadejs/wasm'))});kernel=(await import('../browser-engine/kernel.mjs')).createKernel(oc)});
const close=(a,b,t=1e-5)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`);
const bernstein=(p,t)=>{const u=1-t;return [0,1].map(k=>{const key=k?'y':'x';return u*u*u*p[0][key]+3*u*u*t*p[1][key]+3*u*t*t*p[2][key]+t*t*t*p[3][key]})};
const derivatives=(p,t)=>[1,2].map(order=>['x','y'].map(k=>order===1?3*((1-t)**2*(p[1][k]-p[0][k])+2*(1-t)*t*(p[2][k]-p[1][k])+t*t*(p[3][k]-p[2][k])):6*((1-t)*(p[2][k]-2*p[1][k]+p[0][k])+t*(p[3][k]-2*p[2][k]+p[1][k]))));
const simpson=(fn,a,b,n=4096)=>{const h=(b-a)/n;let s=fn(a)+fn(b);for(let i=1;i<n;i++)s+=(i%2?4:2)*fn(a+i*h);return s*h/3};
test('Cubic Bezier sampling preserves endpoints, independent Bernstein values and caller data',()=>{
 const original=structuredClone(defaults),p=preview(defaults);assert.deepEqual(defaults,original);assert.equal(p.length,97);assert.deepEqual(p[0],defaults.points[0]);assert.deepEqual(p.at(-1),defaults.points[3]);for(const [i,v]of p.entries()){const q=bernstein(defaults.points,i/96);close(v.x,q[0]);close(v.y,q[1])}
});
test('Exact cubic profiles preserve affine area, signed extrusion, STEP and independently computed curve derivatives',async()=>{
 for(const map of [p=>p,p=>({x:2*p.x+.3*p.y+13,y:.2*p.x+1.5*p.y-7}),p=>({x:-p.x+4,y:p.y+2})]){
  const spline={points:defaults.points.map(map)},p=spline.points,area=Math.abs((p[3].x-p[0].x)*(p[1].y-p[0].y)-(p[3].y-p[0].y)*(p[1].x-p[0].x))*3/5,region=(await kernel.handle('/regions',{profiles:[{spline}]})).regions[0];close(region.area,area);
  for(const depth of [-7,4]){const recipe={type:'profile',spline,depth},body=await kernel.handle('/evaluate',recipe);assert.equal(body.valid,true);close(body.volume,area*Math.abs(depth));const step=await kernel.handle('/export-step',{objects:[recipe]});close((await kernel.handle('/import-cad/step',step.binary)).volume,body.volume)}
  const paths=(await kernel.handle('/paths',{profiles:[{spline}]})).paths;assert.equal(paths.length,1);assert.equal(paths[0].kind,'BEZIER_CURVE');const t=.373,probe=await kernel.handle('/path-point',{brep:paths[0].brep,normalized:t}),v=bernstein(p,t),[d,d2]=derivatives(p,t),speed=Math.hypot(...d);close(probe.point[0],v[0]);close(probe.point[2],v[1]);close(probe.curvature,Math.abs(d[0]*d2[1]-d[1]*d2[0])/speed**3);close(probe.totalLength,simpson(u=>Math.hypot(...derivatives(p,u)[0]),0,1));close(probe.lengthFromStart,simpson(u=>Math.hypot(...derivatives(p,u)[0]),0,t));
 }
});
test('Canonical cubic profiles split holes and overlaps and retain exact Boolean volumes',async()=>{
 const a=(await kernel.handle('/regions',{profiles:[{spline:defaults}]})).regions[0],b=(await kernel.handle('/regions',{profiles:[{spline:{points:defaults.points.map(p=>({x:p.x+20,y:p.y}))}}]})).regions[0];
 const nested=(await kernel.handle('/regions',{profiles:[{brep:a.brep},{circle:{center:{x:0,y:10},r:3}}]})).regions;assert.equal(nested.length,2);const ring=nested.reduce((x,y)=>x.area>y.area?x:y);close(ring.area,1080-9*Math.PI);close((await kernel.handle('/evaluate',{type:'profile',brep:ring.brep,depth:-3})).volume,ring.area*3);
 const split=(await kernel.handle('/regions',{profiles:[{brep:a.brep},{brep:b.brep}]})).regions;assert.equal(split.length,3);
 const height=x=>{if(x<=-30||x>=30)return 0;let lo=0,hi=1;for(let i=0;i<45;i++){const mid=(lo+hi)/2;if(-30+180*mid*mid-120*mid**3<x)lo=mid;else hi=mid}const t=(lo+hi)/2;return 90*t*(1-t)};
 const overlap=simpson(x=>Math.min(height(x),height(x-20)),-10,30,32768);close(split.reduce((s,r)=>s+r.area,0),2160-overlap,.001);
 for(const [op,area]of [['union',2160-overlap],['subtract',1080-overlap],['intersect',overlap]]){const result=await kernel.handle('/evaluate',{op,left:{type:'profile',brep:a.brep,depth:5},right:{type:'profile',brep:b.brep,depth:5}});assert.equal(result.valid,true);close(result.volume,area*5,.005)}
});
test('Degenerate, crossing and self-intersecting cubic profiles fail without poisoning the next edit',async()=>{
 const bad=[null,{points:[]},{points:[{x:0,y:0},{x:1,y:0},{x:2,y:0},{x:3,y:0}]},{points:[{x:0,y:0},{x:0,y:2},{x:3,y:-2},{x:3,y:0}]},{points:[{x:0,y:0},{x:0,y:0},{x:3,y:3},{x:3,y:0}]},{points:[{x:0,y:0},{x:4,y:4},{x:-3,y:4},{x:1,y:0}]},{points:defaults.points.map((p,i)=>i===1?{x:NaN,y:1}:p)},{points:defaults.points.map((p,i)=>i===2?{x:1000001,y:1}:p)}];
 for(const spline of bad){assert.throws(()=>settings(spline));await assert.rejects(()=>kernel.handle('/regions',{profiles:[{spline:spline||{}}]}))}
 close((await kernel.handle('/evaluate',{type:'profile',spline:defaults,depth:2})).volume,2160);
});
