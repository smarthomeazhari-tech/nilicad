const {test,before}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium,webkit}=require('playwright');
const {startPrivateServer}=require('./support/private-server.cjs');
let kernel;
before(async()=>{const oc=await require('replicad-opencascadejs')({wasmBinary:fs.readFileSync(require.resolve('replicad-opencascadejs/wasm'))});kernel=(await import('../browser-engine/kernel.mjs')).createKernel(oc)});
const close=(a,b,tolerance=.001)=>assert.ok(Math.abs(a-b)<tolerance,`${a} != ${b}`);
const volume=o=>o.dims.x*o.dims.y*o.dims.z;
const bounds=o=>[0,1,2].map((axis)=>{const size=[o.dims.x,o.dims.z,o.dims.y][axis];return [o.position[axis]-size/2,o.position[axis]+size/2]});
const overlap=(a,b)=>bounds(a).reduce((v,range,i)=>v*Math.max(0,Math.min(range[1],bounds(b)[i][1])-Math.max(range[0],bounds(b)[i][0])),1);

for(const [name,engine] of Object.entries({chromium,webkit}))test(name+' shipping CAD completes drawing, Boolean, history and CAD files without test hooks',{timeout:180000},async t=>{
 const host=await startPrivateServer();let browser,page;
 try{
  browser=await engine.launch({args:name==='chromium'?['--no-sandbox']:[]});t.diagnostic(`${process.platform} ${name} ${browser.version()}`);
  const context=await browser.newContext({httpCredentials:host.credentials,viewport:{width:1000,height:1100},hasTouch:true});
  page=await context.newPage();page.setDefaultTimeout(30000);
  const errors=[],remote=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/\/evaluate$|\/regions$|8765|onrender\.com/.test(r.url()))remote.push(r.url())});
  await page.goto(host.url);await page.waitForFunction(()=>window.ncStartupReady,{},{timeout:30000});
  assert.equal(await page.evaluate(()=>typeof window.testEval),'undefined');
  page.on('dialog',dialog=>dialog.type()==='confirm'?dialog.accept():dialog.dismiss());
  const files=async()=>{if(!await page.locator('#ncFilesGroup').isVisible())await page.locator('#ncFiles').click()};
  const save=async()=>{await files();const event=page.waitForEvent('download');await page.locator('#ncSave').click();const download=await event;return JSON.parse(fs.readFileSync(await download.path(),'utf8'))};
  const open=async project=>{await page.locator('#fileInput').setInputFiles({name:'acceptance.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(project))});await page.waitForFunction(()=>document.getElementById('fileInput').value==='');};
  const blank=async()=>{await page.locator('#ncHome').click();await page.waitForFunction(()=>document.getElementById('count').textContent==='0');await page.locator('#ncTopView').click();assert.equal(await page.locator('#ncUndo').isDisabled(),true);await page.locator('#ncSketch').click();await page.locator('[data-nctool="rectangle"]').waitFor({state:'visible'})};
  const drag=async(a,b)=>{await page.mouse.move(...a);await page.mouse.down();await page.mouse.move(...b,{steps:8});await page.mouse.up()};
  const extrude=async(depth,count)=>{await page.locator('#ncExtrude').click();await page.locator('#ncDepth').waitFor({state:'visible'});await page.locator('#ncDepth').fill(String(depth));await page.locator('#ncConfirm').click();await page.waitForFunction(n=>document.getElementById('count').textContent===String(n)&&document.getElementById('ncConfirm').style.display==='none',count,{timeout:30000})};
  // Draw two actual overlapping profiles and verify independently split regions.
  await blank();await page.locator('[data-nctool="rectangle"]').click();await drag([330,350],[520,500]);await drag([620,430],[440,600]);
  const raw=await save();assert.equal(raw.sketchRegions.length,2);
  const rectBounds=r=>{const xs=r.points.map(p=>p.x),ys=r.points.map(p=>p.y);return [[Math.min(...xs),Math.max(...xs)],[Math.min(...ys),Math.max(...ys)]]};
  const [a,b]=raw.sketchRegions.map(rectBounds),area=r=>(r[0][1]-r[0][0])*(r[1][1]-r[1][0]);
  const shared=[0,1].reduce((v,i)=>v*Math.max(0,Math.min(a[i][1],b[i][1])-Math.max(a[i][0],b[i][0])),1);assert.ok(shared>0);
  await page.locator('#ncSplit').click();await page.waitForFunction(()=>document.getElementById('ncStatus').textContent.includes('3 ناحیه'),{},{timeout:30000});
  const split=await save();assert.equal(split.sketchRegions.length,3);close(split.sketchRegions.reduce((n,r)=>n+r.area,0),area(a)+area(b)-shared);
  await page.touchscreen.tap(360,380);await page.touchscreen.tap(570,550);await extrude(-7,2);
  const project=await save();assert.equal(project.sketchRegions.length,1);
  const expected=(area(a)+area(b)-2*shared)*7;
  const shapes=await Promise.all(project.objects.map(o=>kernel.handle('/evaluate',o.exactRecipe)));close(shapes.reduce((n,o)=>n+o.volume,0),expected);
  close((await kernel.handle('/evaluate',{op:'intersect',left:project.objects[0].exactRecipe,right:project.objects[1].exactRecipe})).volume,0);
  await page.locator('#ncUndo').click();assert.equal((await save()).objects.length,0);await page.locator('#ncRedo').click();assert.equal((await save()).objects.length,2);
  await open(project);close((await save()).sketchRegions[0].area,shared);
  await files();await page.locator('#ncExportSTEP').click();await page.locator('#stepSaveNow').waitFor({state:'visible'});
  const stepEvent=page.waitForEvent('download');await page.locator('#stepSaveNow').click();const step=fs.readFileSync(await (await stepEvent).path());await page.locator('#stepSaveClose').click();
  const imported=await kernel.handle('/import-cad/step',step.buffer.slice(step.byteOffset,step.byteOffset+step.byteLength));close(imported.volume,expected);
  await page.locator('#ncCADFile').setInputFiles({name:'roundtrip.step',mimeType:'application/octet-stream',buffer:step});await page.waitForFunction(()=>document.getElementById('count').textContent==='3',{},{timeout:30000});
  for(const ext of ['STL','OBJ','3MF']){
   await open(project);await files();const event=page.waitForEvent('download');await page.locator('#ncExport'+ext).click();const data=fs.readFileSync(await (await event).path());assert.ok(data.length>100);
   await page.locator('#ncMeshFile').setInputFiles({name:'roundtrip.'+ext.toLowerCase(),mimeType:'application/octet-stream',buffer:data});await page.waitForFunction(()=>Number(document.getElementById('count').textContent)>2,{},{timeout:30000});
   const result=await save();assert.equal(result.objects.filter(o=>o.exactRecipe).length,2);assert.ok(result.objects.slice(2).every(o=>o.geometryJSON&&!o.exactRecipe));
  }
  // Build overlapping solids entirely through visible drawing controls.
  await blank();await page.locator('[data-nctool="rectangle"]').click();await drag([330,350],[520,500]);await extrude(10,1);
  await page.locator('#ncSketch').click();await page.locator('[data-nctool="rectangle"]').click();await drag([620,430],[440,600]);await extrude(10,2);
  const pair=await save(),[first,second]=pair.objects,common=overlap(first,second);assert.ok(common>0);
  for(const [op,want] of [['Union',volume(first)+volume(second)-common],['Subtract',volume(first)-common],['Intersect',common]]){
   await open(pair);await page.locator('#ncItems').click();await page.locator('#objectList .treeitem').first().click();await page.locator('#ncItems').click();
   if(!await page.locator('#ncBoolGroup').isVisible())await page.locator('#ncBool').click();await page.locator('#nc'+op).click();await page.touchscreen.tap(570,550);
   await page.waitForFunction(()=>document.getElementById('count').textContent==='1',{},{timeout:30000});
   const result=await save();close((await kernel.handle('/evaluate',result.objects[0].exactRecipe)).volume,want,.02);
   await page.locator('#ncUndo').click();assert.equal((await save()).objects.length,2);await page.locator('#ncRedo').click();assert.equal((await save()).objects.length,1);
  }
  await page.locator('#ncItems').click();await page.locator('#objectList .treeitem').first().click();await page.locator('#ncItems').click();await page.locator('#ncUnion').click();await blank();assert.equal(await page.locator('#booleanBanner').isVisible(),false);
  fs.mkdirSync(path.resolve(__dirname,'../test-results'),{recursive:true});await page.screenshot({path:path.resolve(__dirname,'../test-results/shipping-'+name+'.png')});
  assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
 }catch(error){if(page){fs.mkdirSync(path.resolve(__dirname,'../test-results'),{recursive:true});await page.screenshot({path:path.resolve(__dirname,'../test-results/shipping-'+name+'-failure.png'),timeout:5000}).catch(()=>{})}throw error}
 finally{await browser?.close();await host.close()}
});
