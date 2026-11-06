const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
const {chromium,webkit}=require('playwright');

for(const [name,engine] of Object.entries({chromium,webkit}))test(name+' saves, reopens and completes unfinished sketch without losing the document',async t=>{
 const root=path.resolve(__dirname,'..');
 const server=http.createServer((req,res)=>{
  const file=path.resolve(root,req.url==='/'?'index.html':req.url.slice(1));
  if(!file.startsWith(root+path.sep)){res.writeHead(404);res.end();return}
  try{
   let data=fs.readFileSync(file);
   if(path.basename(file)==='index.html')data=Buffer.from(data.toString()
    .replace('https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js','/node_modules/three/build/three.module.js')
    .replace('https://cdn.jsdelivr.net/npm/three@0.164.1/examples/jsm/','/node_modules/three/examples/jsm/')
    .replace('\n</script>\n<input type="file" id="ncCADFile"','\nwindow.testEval=code=>eval(code);\n</script>\n<input type="file" id="ncCADFile"'));
   res.setHeader('Content-Type',/\.(mjs|js)$/.test(file)?'application/javascript':file.endsWith('.json')?'application/json':file.endsWith('.wasm')?'application/wasm':'text/html');res.end(data);
  }catch{res.writeHead(404);res.end()}
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;
 try{
  browser=await engine.launch({args:name==='chromium'?['--no-sandbox']:[]});t.diagnostic('OS '+process.platform+' '+require('node:os').release()+'; '+name+' '+browser.version());
  const page=await browser.newPage({viewport:{width:1100,height:800},hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.testEval);
  await page.locator('#ncTopView').click();
  const points=await page.evaluate(()=>testEval(`camera.updateMatrixWorld();[{x:-25,y:-20},{x:25,y:-20},{x:25,y:20},{x:-25,y:20}].map(q=>{const p=new THREE.Vector3(q.x,0,q.y).project(camera),r=canvas.getBoundingClientRect();return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2}})`));
  const drag=async(a,b)=>{await page.mouse.move(a.x,a.y);await page.mouse.down();await page.mouse.move(b.x,b.y,{steps:5});await page.mouse.up()};
  await drag(points[0],points[1]);await drag(points[1],points[2]);
  const draft=await page.evaluate(()=>testEval('ncDraftData()'));assert.equal(draft.segments.length,2);
  await page.locator('#ncFiles').click();
  const event=page.waitForEvent('download');await page.locator('#ncSave').click();const saved=await event,filename=await saved.path();
  const project=JSON.parse(fs.readFileSync(filename,'utf8'));assert.deepEqual(project.sketchDraft,draft);assert.equal(project.sketchRegions.length,0);
  await page.evaluate(()=>testEval('ncSketchReset()'));
  await page.locator('#fileInput').setInputFiles(filename);await page.waitForFunction(()=>document.getElementById('fileInput').value==='');assert.deepEqual(await page.evaluate(()=>testEval('ncDraftData()')),draft);
  assert.equal(await page.evaluate(()=>testEval('nc.mode')), 'sketch');
  // Invalid drafts must leave every object and sketch intact.
  for(const bad of [{...draft,points:[{x:null,y:0}]},{...draft,tool:'unknown'},{...draft,segments:[{kind:'arc',a:{x:0,y:0},m:{x:1,y:0},b:{x:2,y:0}}]}]){
   await page.locator('#fileInput').setInputFiles({name:'invalid.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({...project,sketchDraft:bad}))});await page.waitForFunction(()=>document.getElementById('fileInput').value==='');
   assert.deepEqual(await page.evaluate(()=>testEval('ncDraftData()')),draft);
  }
  await page.evaluate(()=>testEval(`document.getElementById('undoBtn').click()`));assert.equal(await page.evaluate(()=>testEval('ncDraftData()')),null);
  await page.evaluate(()=>testEval(`document.getElementById('redoBtn').click()`));assert.deepEqual(await page.evaluate(()=>testEval('ncDraftData()')),draft);
  await page.locator('#ncFiles').click();
  await drag(points[2],points[3]);await drag(points[3],points[0]);
  assert.equal(await page.evaluate(()=>testEval('skClosed')),true);
  await page.locator('#ncExtrude').click();await page.locator('#ncPull').waitFor({state:'visible'});await page.locator('#ncDepth').fill('5');await page.locator('#ncConfirm').click();
  await page.waitForFunction(()=>testEval('items.length===1&&!ncBusy'));
  const volume=await page.evaluate(()=>testEval(`(async()=>(await (await ncRequest('/evaluate',makeExactNode(items[0]))).json()).volume)()`));
  assert.ok(Math.abs(volume-10000)<100,'Reopened drawing must produce the expected exact solid');
  // Pending circle/arc/rectangle inputs also survive a save/load cycle.
  for(const pending of [{tool:'arc',arcPoints:[{x:0,y:0},{x:5,y:5}]},{tool:'circle',arcPoints:[{x:3,y:4}]},{tool:'rectangle',rectStart:{x:7,y:8}}]){
   const expected={tool:pending.tool,segments:[],points:[],arcPoints:[],rectStart:null,...pending};
   const actual=await page.evaluate(data=>testEval(`ncLoadProject(${JSON.stringify(data)});ncDraftData()`),{format:'NiliCAD-Web',version:'5.0',objects:[],sketchDraft:expected});
   assert.deepEqual(actual,expected);
  }
  assert.deepEqual(errors,[]);
 }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r))}
});
