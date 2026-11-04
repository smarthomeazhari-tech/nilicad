const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
for(const [name,engine] of Object.entries({chromium,webkit}))test(name+' CAD geometry, interaction and file round trips',async()=>{
 const root=path.resolve(__dirname,'..');
 const server=http.createServer((req,res)=>{
  let file=req.url==='/'?'index.html':req.url.slice(1);
  try{let data=fs.readFileSync(path.join(root,file));if(file==='index.html')data=Buffer.from(data.toString().replace('https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js','/node_modules/three/build/three.module.js').replace('https://cdn.jsdelivr.net/npm/three@0.164.1/examples/jsm/','/node_modules/three/examples/jsm/').replace('\n</script>\n<input type="file" id="ncCADFile"','\nwindow.testEval=code=>eval(code);\n</script>\n<input type="file" id="ncCADFile"'));res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':'text/html');res.end(data)}catch{res.writeHead(404);res.end()}
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;try{
 browser=await engine.launch({headless:true,args:name==='chromium'?['--no-sandbox']:[]});const page=await browser.newPage({viewport:{width:1100,height:800},hasTouch:true});
 const errors=[];page.on('pageerror',e=>(errors.push(e.message),console.error(e.message)));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>typeof window.testEval==='function',{},{timeout:10000});await page.waitForTimeout(100);
 await page.evaluate(()=>testEval(`skPoints=[{x:-20,y:-20},{x:20,y:-20},{x:20,y:20},{x:-20,y:20}];skSegments=skPoints.map((a,i)=>({kind:'line',a,b:skPoints[(i+1)%4]}));skClosed=true;ncDraw();ncSaveRegion();skClosed=false;skSegments=[];skPoints=[];ncClearVisual();nc.mode='select';`));
 const screen=await page.evaluate(()=>testEval(`(()=>{const p=new THREE.Vector3(0,0,0).project(camera),r=canvas.getBoundingClientRect();return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2}})()`));
 await page.touchscreen.tap(screen.x,screen.y);
 assert.equal(await page.evaluate(()=>testEval('ncSelectedRegions.size')),1);
 assert.equal(await page.locator('#ncExtrude').isEnabled(),true);
 await page.locator('#ncExtrude').click();await page.locator('#ncPull').waitFor({state:'visible'});
 const box=await page.locator('#ncPull').boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<1100&&box.y+box.height<800);
 const handle=await page.locator('#ncPull .handle').boundingBox();await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2);await page.mouse.down();await page.mouse.move(handle.x+handle.width/2,handle.y+handle.height/2-25);assert.ok(await page.locator('#ncDepth').inputValue()>0);await page.mouse.up();
 await page.locator('#ncPull .handle').dispatchEvent('pointercancel');assert.equal(await page.evaluate(()=>testEval('nc.drag')),null);
 await page.locator('#ncDepth').fill('12');await page.locator('#ncDepth').dispatchEvent('change');await page.locator('#ncConfirm').click();
 await page.waitForFunction(()=>testEval('items.length')===1);
 assert.equal(await page.evaluate(()=>testEval('items.length')),1);
 assert.equal(await page.evaluate(()=>testEval('items[0].dims.z')),12);
 await page.evaluate(()=>testEval(`document.getElementById('undoBtn').click()`));assert.equal(await page.evaluate(()=>testEval('items.length')),0);assert.equal(await page.evaluate(()=>testEval('ncRegions.length')),1);
 await page.evaluate(()=>testEval(`document.getElementById('redoBtn').click()`));assert.equal(await page.evaluate(()=>testEval('items.length')),1);
 // Exact overlapping regions: no positive-volume overlap between independent extrusions.
 await page.evaluate(()=>testEval(`items.forEach(o=>world.remove(o.mesh));items=[];ncClearRegions();nc.mode='select';
 window.fixtureRect=function(x,y,w,h){skPoints=[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}];skSegments=skPoints.map((a,i)=>({kind:'line',a,b:skPoints[(i+1)%4]}));skClosed=true;ncDraw();ncSaveRegion();skClosed=false;skSegments=[];skPoints=[];ncClearVisual()}
 fixtureRect(-20,-10,20,20);fixtureRect(-10,-10,20,20);`));
 await page.locator('#ncSplit').click();await page.waitForFunction(()=>testEval('ncRegions.length===3&&ncRegions.every(r=>r.brep)'));
 const points=await page.evaluate(()=>testEval(`ncRegions.map(r=>{const g=r.mesh.geometry,p=g.attributes.position,idx=g.index;const v=new THREE.Vector3();for(let k=0;k<3;k++)v.add(new THREE.Vector3().fromBufferAttribute(p,idx.getX(k)));v.multiplyScalar(1/3);v.y=.035;v.project(camera);const rect=canvas.getBoundingClientRect();return {x:rect.left+(v.x+1)*rect.width/2,y:rect.top+(1-v.y)*rect.height/2}})`));
 for(const p of points.slice(0,2))await page.mouse.click(p.x,p.y);
 assert.equal(await page.evaluate(()=>testEval('ncSelectedRegions.size')),2);
 await page.locator('#ncExtrude').click();await page.locator('#ncPull').waitFor({state:'visible'});await page.locator('#ncDepth').fill('-5');await page.locator('#ncDepth').dispatchEvent('change');await page.locator('#ncConfirm').click();
 await page.waitForFunction(()=>testEval('items.length===2&&!ncBusy'));
 const volumes=await page.evaluate(()=>testEval(`Promise.all(items.map(async o=>(await (await ncRequest('/evaluate',makeExactNode(o))).json()).volume))`));
 volumes.forEach(v=>assert.ok(Math.abs(v-1000)<1e-6));
 // Hole selection is based on exact faces; the inner disk remains independently selectable.
 await page.evaluate(()=>testEval(`items.forEach(o=>world.remove(o.mesh));items=[];ncClearRegions();nc.mode='select';fixtureRect(-20,-20,40,40);skCircle={center:{x:0,y:0},r:5};skClosed=false;ncDraw();ncSaveRegion();skCircle=null;ncClearVisual();`));
 await page.locator('#ncSplit').click();await page.waitForFunction(()=>testEval('ncRegions.length===2&&ncRegions.every(r=>r.brep)'));
 await page.evaluate(()=>testEval(`ncSelectRegion(ncRegions.reduce((a,b)=>a.area>b.area?a:b));`));
 await page.locator('#ncExtrude').click();await page.locator('#ncPull').waitFor({state:'visible'});await page.locator('#ncDepth').fill('3');await page.locator('#ncConfirm').click();await page.waitForFunction(()=>testEval('items.length===1&&!ncBusy'));
 const volume=await page.evaluate(()=>testEval(`(async()=>{return (await (await ncRequest('/evaluate',makeExactNode(items[0]))).json()).volume})()`));
 assert.ok(Math.abs(volume-(1600-Math.PI*25)*3)<1e-5);
 // Exact viewport Boolean path, not just the server kernel.
 for(const [op,want] of [['union',1500],['subtract',500],['intersect',500]]){
  const actual=await page.evaluate(op=>testEval(`(async()=>{items.forEach(o=>world.remove(o.mesh));items=[];ncClearRegions();addObject('box',{x:10,y:10,z:10},'A');addObject('box',{x:10,y:10,z:10},'B');items[0].mesh.position.set(0,0,0);items[1].mesh.position.set(5,0,0);await performBoolean(items[0],items[1],${JSON.stringify(op)});return (await (await ncRequest('/evaluate',makeExactNode(items[0]))).json()).volume})()`),op);
  assert.ok(Math.abs(actual-want)<1e-6);
 }
 // Project download and open preserve exact recipes and both raw/exact sketch regions.
 // A server error must leave both operands and their recipes untouched.
 await page.evaluate(()=>testEval(`addObject('box',{x:10,y:10,z:10},'Failure operand');`));
 const operands=await page.evaluate(()=>testEval('JSON.stringify(state())'));
 await page.route('**/evaluate',route=>route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({detail:'Regression: unavailable kernel'})}));
 await page.evaluate(()=>testEval(`performBoolean(items[0],items[1],'union')`));
 assert.equal(await page.evaluate(()=>testEval('JSON.stringify(state())')),operands);await page.unroute('**/evaluate');
 await page.evaluate(()=>testEval(`const extra=items.pop();world.remove(extra.mesh);fixtureRect(30,30,10,10);`));
 await page.locator('#ncSplit').click();await page.waitForFunction(()=>testEval('ncRegions.length===1&&ncRegions[0].brep'));
 await page.evaluate(()=>testEval(`fixtureRect(50,50,10,10);`));
 await page.locator('#ncFiles').click();
 const savedEvent=page.waitForEvent('download');await page.locator('#ncSave').click();const saved=await savedEvent;const projectPath=await saved.path();const project=JSON.parse(fs.readFileSync(projectPath,'utf8'));
 assert.equal(project.version,'5.0');assert.equal(project.sketchRegions.length,2);assert.ok(project.objects[0].exactRecipe);
 await page.evaluate(()=>testEval(`ncClearRegions();items.forEach(o=>world.remove(o.mesh));items=[];`));
 await page.locator('#fileInput').setInputFiles(projectPath);await page.waitForFunction(()=>testEval('items.length===1&&ncRegions.length===2'));
 const before=await page.evaluate(()=>testEval('JSON.stringify(ncProjectData())'));
 await page.locator('#fileInput').setInputFiles({name:'broken.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...project,objects:[{...project.objects[0],position:[null,0,0]}]}))});
 assert.equal(await page.evaluate(()=>testEval('JSON.stringify(ncProjectData())')),before);
 // Sketches participate in undo/redo along with solids.
 await page.evaluate(()=>testEval(`snapshot();ncClearRegions();`));await page.evaluate(()=>testEval(`document.getElementById('undoBtn').click()`));assert.equal(await page.evaluate(()=>testEval('ncRegions.length')),2);
 await page.evaluate(()=>testEval(`document.getElementById('redoBtn').click()`));assert.equal(await page.evaluate(()=>testEval('ncRegions.length')),0);
 // Real browser CAD downloads and imports preserve exact volume.
 for(const [button,extension] of [['ncExportSTEP','step'],['ncExportIGES','iges']]){
  await page.locator('#'+button).click();await page.locator('#stepSaveNow').waitFor({state:'visible'});const event=page.waitForEvent('download');await page.locator('#stepSaveNow').click();const file=await event;assert.ok(file.suggestedFilename().endsWith('.'+extension));
  const data=fs.readFileSync(await file.path());assert.ok(data.length>500);await page.locator('#stepSaveClose').click();
  const n=await page.evaluate(()=>testEval('items.length'));await page.locator('#ncCADFile').setInputFiles({name:'roundtrip.'+extension,mimeType:'application/octet-stream',buffer:data});await page.waitForFunction(n=>testEval('items.length')===n+1,n);
  const volume=await page.evaluate(()=>testEval(`(async()=>(await (await ncRequest('/evaluate',makeExactNode(items.at(-1)))).json()).volume)()`));assert.ok(Math.abs(volume-500)<1e-5);
  await page.evaluate(()=>testEval(`const last=items.pop();world.remove(last.mesh);`));
 }
 for(const [button,extension] of [['ncExportSTL','stl'],['ncExportOBJ','obj'],['ncExport3MF','3mf']]){
  const event=page.waitForEvent('download');await page.locator('#'+button).click();const file=await event;const data=fs.readFileSync(await file.path());assert.ok(data.length>100);
  const n=await page.evaluate(()=>testEval('items.length'));await page.locator('#ncMeshFile').setInputFiles({name:'mesh.'+extension,mimeType:'application/octet-stream',buffer:data});await page.waitForFunction(n=>testEval('items.length')===n+1,n);
  const dims=await page.evaluate(()=>testEval('items.at(-1).dims'));assert.ok(Math.abs(dims.x-5)<.01);assert.ok(Math.abs(dims.y-10)<.01);assert.ok(Math.abs(dims.z-10)<.01);
  await page.evaluate(()=>testEval(`const last=items.pop();world.remove(last.mesh);`));
 }
 // Draw a rectangle through real pointer gestures on the workplane.
 await page.evaluate(()=>testEval(`items.forEach(o=>world.remove(o.mesh));items=[];ncClearRegions();ncSketchReset();ncSetTool('rectangle');`));
 const stroke=await page.evaluate(()=>testEval(`[{x:-10,y:-5},{x:10,y:5}].map(q=>{const p=new THREE.Vector3(q.x,0,q.y).project(camera),r=canvas.getBoundingClientRect();return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2}})`));
 await page.mouse.move(stroke[0].x,stroke[0].y);await page.mouse.down();await page.mouse.move(stroke[1].x,stroke[1].y,{steps:5});await page.mouse.up();assert.equal(await page.evaluate(()=>testEval('skClosed')),true);const drawnArea=await page.evaluate(()=>testEval(`Math.abs((skPoints[2].x-skPoints[0].x)*(skPoints[2].y-skPoints[0].y))`));assert.ok(Math.abs(drawnArea-200)<10);
 await page.locator('#ncExtrude').click();await page.locator('#ncPull').waitFor({state:'visible'});await page.locator('#ncDepth').fill('5');await page.locator('#ncConfirm').click();await page.waitForFunction(()=>testEval('items.length===1&&!ncBusy'));
 const drawnVolume=await page.evaluate(()=>testEval(`(async()=>(await (await ncRequest('/evaluate',makeExactNode(items[0]))).json()).volume)()`));assert.ok(Math.abs(drawnVolume-drawnArea*5)<.0001);
 fs.mkdirSync(path.join(root,'test-results'),{recursive:true});await page.screenshot({path:path.join(root,'test-results',name+'.png')});
 assert.deepEqual(errors,[]);
 }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r))}
});
