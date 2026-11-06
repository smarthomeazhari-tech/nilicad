const {test,before}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
let engine;
before(async()=>{const init=require('replicad-opencascadejs');const oc=await init({wasmBinary:fs.readFileSync(require.resolve('replicad-opencascadejs/wasm'))});const {createKernel}=await import('../browser-engine/kernel.mjs');engine=createKernel(oc)});
const rect=(x,y,w,h)=>{const p=[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];return {segments:p.map((a,i)=>({kind:'line',a,b:p[(i+1)%4]}))}};
const close=(actual,expected,tolerance=1e-5)=>assert.ok(Math.abs(actual-expected)<tolerance,`${actual} != ${expected}`);
test('WASM exact primitives, Boolean volumes and empty intersection',async()=>{
 const a={type:'box',dims:{x:10,y:10,z:10}},b={...a,transform:[1,0,0,0,0,1,0,0,0,0,1,0,5,0,0,1]};
 for(const [op,volume] of [['union',1500],['subtract',500],['intersect',500]]){const data=await engine.handle('/evaluate',{op,left:a,right:b});assert.equal(data.valid,true);close(data.volume,volume);assert.ok(data.brep&&data.indices.length)}
 const empty=await engine.handle('/evaluate',{op:'intersect',left:a,right:{...b,transform:[1,0,0,0,0,1,0,0,0,0,1,0,100,0,0,1]}});close(empty.volume,0);assert.equal(empty.indices.length,0);
 for(const type of ['cylinder','sphere','hexPrism','cone']){const shape=await engine.handle('/evaluate',{type,dims:{x:10,y:10,z:10}});assert.equal(shape.valid,true);assert.ok(shape.volume>0)}
});
test('WASM exact independent overlap regions and signed multi-region extrusion',async()=>{
 const {regions}=await engine.handle('/regions',{profiles:[rect(0,0,10,10),rect(5,0,10,10)]});assert.equal(regions.length,3);
 for(const region of regions){close(region.area,50);assert.ok(region.owner!==null);const shape=await engine.handle('/evaluate',{type:'profile',brep:region.brep,depth:-4});close(shape.volume,200);assert.equal(shape.valid,true)}
});
test('WASM preserves circular holes, nested faces and analytic intersections',async()=>{
 const circle=(x,r)=>({circle:{center:{x,y:5},r}});
 const {regions}=await engine.handle('/regions',{profiles:[rect(0,0,10,10),circle(5,2),circle(5,1)]});assert.equal(regions.length,3);close(regions.reduce((v,r)=>v+r.area,0),100);
 const ring=regions.reduce((a,b)=>a.area>b.area?a:b);const result=await engine.handle('/evaluate',{type:'profile',brep:ring.brep,depth:3});close(result.volume,(100-4*Math.PI)*3);
 const intersections=await engine.handle('/regions',{profiles:[circle(0,5),circle(5,5)]});assert.equal(intersections.regions.length,3);close(Math.min(...intersections.regions.map(r=>r.area)),50*Math.acos(.5)-2.5*Math.sqrt(75));
});
test('WASM reads existing Python OCCT B-Rep projects',async()=>{
 const fixture=JSON.parse(fs.readFileSync(require('path').join(__dirname,'fixtures/python-brep.json'),'utf8'));const b=await engine.handle('/evaluate',{type:'brep',brep:fixture.solid});close(b.volume,6000);const circle=await engine.handle('/evaluate',{type:'profile',brep:fixture.face,depth:3});close(circle.volume,Math.PI*25*3);
});
test('WASM STEP round trip preserves asymmetric dimensions and orientation',async()=>{
 const node={type:'box',dims:{x:10,y:20,z:30},transform:[1,0,0,0,0,1,0,0,0,0,1,0,7,9,11,1]};const original=await engine.handle('/evaluate',node);const data=await engine.handle('/export-step',{objects:[node]});assert.ok(new TextDecoder().decode(data.binary).includes('ISO-10303-21'));
 const imported=await engine.handle('/import-cad/step',data.binary);close(imported.volume,6000);
 for(const axis of [0,1,2]){const bounds=r=>{const values=r.positions.filter((_,i)=>i%3===axis);return [Math.min(...values),Math.max(...values)]};bounds(original).forEach((v,i)=>close(bounds(imported)[i],v,.001))}
});
test('Base WASM rejects invalid inputs; IGES routes through the isolated adapter',async()=>{
 for(const [path,payload] of [['/regions',{profiles:[]}],['/evaluate',{type:'profile',...rect(0,0,10,10),depth:0}],['/evaluate',{type:'brep',brep:'bad'}],['/import-cad/iges',new ArrayBuffer(0)]])await assert.rejects(engine.handle(path,payload));
});
