const {test,before}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');let kernel,r;
before(async()=>{const oc=await require('replicad-opencascadejs')({wasmBinary:fs.readFileSync(require.resolve('replicad-opencascadejs/wasm'))});kernel=(await import('../browser-engine/kernel.mjs')).createKernel(oc);r=await import('replicad')});
const close=(a,b,t=1e-6)=>assert.ok(Math.abs(a-b)<t,`${a} != ${b}`),near=(a,b)=>a.forEach((v,i)=>close(v,b[i]));
const path=async profile=>(await kernel.handle('/paths',{profiles:[profile]})).paths[0];const probe=(p,data)=>kernel.handle('/path-point',{brep:p.brep,...data});
test('Arbitrary line points project exactly and report consistent parameters, frames and lengths',async()=>{
 const p=await path({segments:[{kind:'line',a:{x:0,y:0},b:{x:10,y:0}}]});const data=await probe(p,{position:[3.7,2,0]});near(data.point,[3.7,0,0]);near(data.tangent,[1,0,0]);close(data.totalLength,10);close(data.lengthFromStart,3.7);close(data.projectionDistance,2);close(data.curvature,0);assert.equal(data.radius,null);assert.equal(data.normal,null);assert.equal(data.torsion,null);
 for(const t of [0,.123456789,.5,1]){const d=await probe(p,{normalized:t});near(d.point,[10*t,0,0]);close(d.lengthFraction,t)}
 const seed=(await kernel.handle('/paths',{profiles:[{segments:[],points:[{x:2,y:3}]}]})).paths[0];const point=await kernel.handle('/path-point',{vertex:seed.point});near(point.point,[2,0,3]);assert.equal(point.regular,false);
});
test('Circle, arc and nonuniform Bezier parameters have independently verified curvature and arc lengths',async()=>{
 const circle=await path({circle:{center:{x:0,y:0},r:5}});for(const t of [.123,.5,.876]){const d=await probe(circle,{normalized:t});close(Math.hypot(...d.point),5);close(d.curvature,.2);close(d.radius,5);close(d.torsion,0);close(d.lengthFromStart,2*Math.PI*5*t);near(d.curvatureCenter,[0,0,0]);close(d.tangent.reduce((sum,v,i)=>sum+v*d.point[i],0),0)}
 const arc=await path({segments:[{kind:'arc',a:{x:5,y:0},m:{x:0,y:5},b:{x:-5,y:0}}]});const a=await probe(arc,{normalized:.5});near(a.point,[0,0,5]);close(a.totalLength,Math.PI*5);close(a.radius,5);
 const bezier=r.makeBezierCurve([[0,0,0],[5,5,0],[10,0,0]]);try{const d=await kernel.handle('/path-point',{brep:bezier.serialize(),normalized:.5});near(d.point,[5,2.5,0]);near(d.tangent,[1,0,0]);close(d.curvature,.2);close(d.torsion,0);const expected=5*(Math.sqrt(2)+Math.asinh(1));close(d.totalLength,expected,1e-5);close(d.lengthFromStart,expected/2,1e-5);assert.equal(d.lengthMethod,'adaptive integration');assert.equal(d.degree,2);assert.equal(d.poles,3);assert.equal(d.rational,false);assert.equal(d.lengthConverged,true)}finally{bezier.delete()}
});
test('Canonical CAD edges, split Sketch B-Reps, endpoints and invalid queries preserve later probes',async()=>{
 const top=await kernel.handle('/topology',{type:'box',dims:{x:20,y:30,z:10},transform:[1,0,0,0,0,1,0,0,0,0,1,0,17,4,-8,1]});const edge=top.edges[0];const d=await kernel.handle('/path-point',{brep:top.brep,edgeIndex:edge.index,normalized:.37});close(d.totalLength,edge.length);close(d.lengthFromStart,edge.length*.37);
 const region=(await kernel.handle('/regions',{profiles:[{circle:{center:{x:0,y:0},r:5}}]})).regions[0];const paths=await kernel.handle('/paths',{profiles:[{brep:region.brep}]});assert.ok(paths.paths.some(p=>p.kind==='CIRCLE'));
 for(const normalized of [-.1,1.1,NaN,Infinity])await assert.rejects(kernel.handle('/path-point',{brep:top.brep,edgeIndex:0,normalized}));await assert.rejects(kernel.handle('/path-point',{brep:top.brep,edgeIndex:999,normalized:.5}));await assert.rejects(probe(paths.paths[0],{position:[null,0,0]}));close((await probe(paths.paths[0],{normalized:.25})).radius,5);
});

test('Spatial cubic torsion and singular tangent quantities are distinguished',async()=>{
 const curve=r.makeBezierCurve([[0,0,0],[1,0,0],[1,1,0],[1,1,1]]);try{const d=await kernel.handle('/path-point',{brep:curve.serialize(),normalized:.5});near(d.point,[.875,.5,.125]);close(d.torsion,16/9);close(Math.hypot(...d.tangent),1);close(d.curvature,Math.sqrt(60.75)/3.375**1.5)}finally{curve.delete()}
 const cusp=r.makeBezierCurve([[-1,0,0],[1,0,0],[-1,0,0]]);try{const d=await kernel.handle('/path-point',{brep:cusp.serialize(),normalized:.5});assert.equal(d.regular,false);assert.equal(d.tangent,null);assert.equal(d.curvature,null);assert.equal(d.torsion,null)}finally{cusp.delete()}
});
