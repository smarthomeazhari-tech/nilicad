const {test}=require('node:test');
const assert=require('node:assert/strict');
const comparable=data=>JSON.parse(JSON.stringify(data,(key,value)=>key==='uuid'?undefined:value));
const {chromium,webkit}=require('playwright');
const {startPrivateServer}=require('./support/private-server.cjs');
for(const [name,engine] of Object.entries({chromium,webkit}))test(name+' shipping project recovery preserves unfinished drawings and explicit new documents',{timeout:90000},async()=>{
 const host=await startPrivateServer();let browser;
 try{
  browser=await engine.launch({args:name==='chromium'?['--no-sandbox']:[]});
  const context=await browser.newContext({httpCredentials:host.credentials,viewport:{width:1000,height:1100}});
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
  const ready=async()=>page.waitForFunction(()=>window.ncStartupReady);
  const saved=async()=>{const expected=JSON.stringify(await project());await page.waitForFunction(expected=>new Promise(resolve=>{const request=indexedDB.open('NiliCAD-recovery',1);request.onsuccess=()=>{const db=request.result,tx=db.transaction('projects');const get=tx.objectStore('projects').get('current');get.onsuccess=()=>resolve(get.result?.document===expected);tx.oncomplete=()=>db.close()};request.onerror=()=>resolve(false)}),expected)};
  const project=async()=>{const pending=page.waitForEvent('download');await page.locator('#saveBtn').evaluate(b=>b.click());const file=await pending;const stream=await file.createReadStream();const chunks=[];for await(const chunk of stream)chunks.push(chunk);return JSON.parse(Buffer.concat(chunks).toString())};
  await page.goto(host.url);await ready();const sample=await project();await saved();await page.reload();await ready();assert.deepEqual(comparable(await project()),comparable(sample));await page.locator('#ncHome').click();await page.locator('#ncSketch').click();await page.locator('[data-nctool="line"]').click();await page.locator('#ncTopView').count().then(async n=>{if(n)await page.locator('#ncTopView').click()});
  // An actual mouse gesture produces a saved, unfinished sketch in the shipped application.
  await page.mouse.move(360,380);await page.mouse.down();await page.mouse.move(540,460,{steps:8});await page.mouse.up();
  const before=await project();assert.ok(before.sketchDraft?.segments.length>0);
  await saved();await page.reload();await ready();assert.equal(await page.locator('#ncRecoveryStatus').getAttribute('data-state'),'restored');assert.deepEqual(await project(),before);
  await page.locator('#ncHome').click();await saved();await page.reload();await ready();const empty=await project();assert.equal(empty.objects.length,0);assert.equal(empty.sketchRegions.length,0);assert.equal(empty.sketchDraft,null);
  // A damaged record must not silently replace the startup document or break manual file saving.
  await page.evaluate(()=>new Promise((resolve,reject)=>{const r=indexedDB.open('NiliCAD-recovery',1);r.onsuccess=()=>{const db=r.result,tx=db.transaction('projects','readwrite');tx.objectStore('projects').put({version:1,document:'invalid JSON'},'current');tx.oncomplete=()=>{db.close();resolve()};tx.onerror=()=>reject(tx.error)}}));
  await page.reload();await ready();assert.equal(await page.locator('#ncRecoveryStatus').getAttribute('data-state'),'error');assert.ok((await project()).objects.length>0);assert.deepEqual(errors,[]);
  const blocked=await browser.newContext({httpCredentials:host.credentials});await blocked.addInitScript(()=>{indexedDB.open=()=>{throw new DOMException('Storage disabled','SecurityError')}});const denied=await blocked.newPage();await denied.goto(host.url);await denied.waitForFunction(()=>window.ncStartupReady);assert.equal(await denied.locator('#ncRecoveryStatus').getAttribute('data-state'),'error');const download=denied.waitForEvent('download');await denied.locator('#saveBtn').evaluate(b=>b.click());assert.ok((await download).suggestedFilename().endsWith('.json'));await blocked.close();
 }finally{await browser?.close();await host.close()}
});
