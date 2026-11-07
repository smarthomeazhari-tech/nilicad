const {test,before}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium,webkit}=require('playwright');
const {startPrivateServer}=require('./support/private-server.cjs');
let kernel;before(async()=>{const oc=await require('replicad-opencascadejs')({wasmBinary:fs.readFileSync(require.resolve('replicad-opencascadejs/wasm'))});kernel=(await import('../browser-engine/kernel.mjs')).createKernel(oc)});
for(const [name,engine] of Object.entries({chromium,webkit}))test(name+' professional shipping workspace supports contextual actions, keyboard and responsive navigation',{timeout:120000},async()=>{
 const host=await startPrivateServer();let browser;
 try{
  browser=await engine.launch({args:name==='chromium'?['--no-sandbox']:[]});const context=await browser.newContext({httpCredentials:host.credentials,viewport:{width:1366,height:900},hasTouch:true});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.type()==='confirm'?d.accept():d.dismiss());await page.goto(host.url);await page.waitForFunction(()=>window.ncStartupReady);assert.equal(await page.evaluate(()=>typeof window.testEval),'undefined');
  const files=async()=>{if(!await page.locator('#ncFilesGroup').isVisible())await page.locator('#ncFiles').click()};
  const save=async()=>{await files();const event=page.waitForEvent('download');await page.locator('#ncSave').click();const download=await event;return JSON.parse(fs.readFileSync(await download.path(),'utf8'))};
  const sample=await save();assert.equal(await page.locator('#ncFilesGroup').isVisible(),false);
  await page.locator('#ncItems').click();await page.locator('#objectList .treeitem').first().click();await page.locator('#ncInspector').waitFor({state:'visible'});assert.equal(await page.locator('#ncContextExtrude').isVisible(),false);assert.equal(await page.locator('#ncContextMove').isVisible(),true);
  await page.locator('#ncRenameBody').fill('Precision part');await page.locator('#ncRenameBody').press('Tab');await page.locator('#ncContextMove').click();await page.locator('#ncMoveBody').click();
  for(const [axis,value] of [['X','12'],['Y','-3'],['Z','7']])await page.locator('#ncDelta'+axis).fill(value);
  await page.locator('#ncApplyTransform').click();const moved=await save();assert.deepEqual(moved.objects[0].position,sample.objects[0].position.map((v,i)=>v+[12,-3,7][i]));assert.equal(moved.objects[0].name,'Precision part');assert.deepEqual(moved.objects[0].exactRecipe,sample.objects[0].exactRecipe);
  await page.keyboard.press('ControlOrMeta+z');const undone=await save();assert.deepEqual(undone.objects[0].position,sample.objects[0].position);assert.equal(undone.objects[0].name,'Precision part');await page.keyboard.press('ControlOrMeta+Shift+z');assert.deepEqual((await save()).objects[0].position,moved.objects[0].position);
  // Focused numeric fields must keep editing keys rather than triggering global shortcuts.
  await page.locator('#ncItems').click();await page.locator('#objectList .treeitem').first().click();await page.locator('#ncContextMove').click();await page.locator('#ncRotateBody').click();await page.locator('#ncDeltaX').fill('0');await page.locator('#ncDeltaY').fill('90');await page.locator('#ncDeltaZ').fill('0');await page.locator('#ncApplyTransform').click();const rotated=await save();assert.ok(Math.abs(rotated.objects[0].rotation[1]-Math.PI/2)<1e-6);assert.deepEqual(rotated.objects[0].exactRecipe,sample.objects[0].exactRecipe);
  await files();await page.locator('#ncExportSTEP').click();await page.locator('#stepSaveNow').waitFor({state:'visible'});const stepEvent=page.waitForEvent('download');await page.locator('#stepSaveNow').click();const step=fs.readFileSync(await (await stepEvent).path());await page.locator('#stepSaveClose').click();const imported=await kernel.handle('/import-cad/step',step.buffer.slice(step.byteOffset,step.byteOffset+step.byteLength));
  const originals=await Promise.all(sample.objects.map(o=>kernel.handle('/evaluate',o.exactRecipe)));assert.ok(Math.abs(imported.volume-originals.reduce((sum,o)=>sum+o.volume,0))<.001);
  const expectedBounds=[0,1,2].map(axis=>{const ranges=rotated.objects.map((o,i)=>{const dims=i===0?[o.dims.y,o.dims.z,o.dims.x]:[o.dims.x,o.dims.z,o.dims.y];return [o.position[axis]-dims[axis]/2,o.position[axis]+dims[axis]/2]});return [Math.min(...ranges.map(r=>r[0])),Math.max(...ranges.map(r=>r[1]))]});for(const axis of [0,1,2]){const values=imported.positions.filter((_,i)=>i%3===axis);assert.ok(Math.abs(Math.min(...values)-expectedBounds[axis][0])<.001);assert.ok(Math.abs(Math.max(...values)-expectedBounds[axis][1])<.001)}
  await page.keyboard.press('Escape');assert.equal(await page.locator('#ncTransformGroup').isVisible(),false);await page.keyboard.press('1');await page.keyboard.press('2');await page.keyboard.press('f');
  await page.locator('#ncItems').click();await page.locator('#ncSketch').click();await page.locator('[data-nctool="rectangle"]').click();await page.mouse.move(400,360);await page.mouse.down();await page.mouse.move(600,480,{steps:8});await page.mouse.up();await page.locator('#ncContextExtrude').waitFor({state:'visible'});await page.locator('#ncContextExtrude').click();await page.locator('#ncDepth').waitFor({state:'visible'});await page.locator('#ncCancelOperation').click();assert.equal(await page.locator('#ncPull').isVisible(),false);assert.equal(Number(await page.locator('#count').textContent()),sample.objects.length);if(!await page.locator('#ncSketchGroup').isVisible())await page.locator('#ncSketch').click();await page.locator('#ncDoneSketch').click();assert.equal(await page.locator('#ncSketchGroup').isVisible(),false);assert.ok((await save()).sketchRegions.length>sample.sketchRegions.length);
  const pending=page.waitForEvent('download');await page.keyboard.press('ControlOrMeta+s');assert.ok((await pending).suggestedFilename().endsWith('.json'));
  await page.locator('#ncHelp').click();assert.equal(await page.locator('#ncHelpDialog').isVisible(),true);await page.locator('#ncCloseHelp').click();
  for(const [width,height] of [[1366,900],[1024,768],[768,1024],[390,844]]){
   await page.setViewportSize({width,height});await page.locator('#ncSketch').click();
   for(const selector of ['#ncTop','#ncLeft','#ncBottom','#ncSketchGroup','#ncRight']){const box=await page.locator(selector).boundingBox();assert.ok(box&&box.x>=-1&&box.y>=-1&&box.x+box.width<=width+1&&box.y+box.height<=height+1,`${selector} overflows ${width}x${height}: ${JSON.stringify(box)}`)}
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   fs.mkdirSync(path.resolve(__dirname,'../test-results'),{recursive:true});await page.screenshot({path:path.resolve(__dirname,`../test-results/workspace-${name}-${width}.png`)});await page.locator('#ncDoneSketch').click();
  }
  assert.deepEqual(errors,[]);
 }catch(error){console.error(error.stack);throw error}finally{await browser?.close();await host.close()}
});
