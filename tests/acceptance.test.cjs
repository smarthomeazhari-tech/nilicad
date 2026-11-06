const {test,before}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {chromium,webkit}=require('playwright');
const {startPrivateServer}=require('./support/private-server.cjs');
let kernel,iges;
async function igesConverter(){if(!iges)iges=await (await import('../browser-engine/iges-converter.mjs')).initializeIGES(require('node:zlib').gunzipSync(fs.readFileSync(path.join(__dirname,'../browser-engine/iges/vendor/nilicad_iges.wasm.gz'))));return iges}
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
  const pen=name==='chromium'?await context.newCDPSession(page):null;
  if(pen)await page.evaluate(()=>{window.observedPenDowns=0;document.addEventListener('pointerdown',e=>{if(e.pointerType==='pen')window.observedPenDowns++},true)});
  const drag=async(a,b)=>{if(!pen){await page.mouse.move(...a);await page.mouse.down();await page.mouse.move(...b,{steps:8});await page.mouse.up();return}await pen.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:a[0],y:a[1],pointerType:'pen'});await pen.send('Input.dispatchMouseEvent',{type:'mousePressed',x:a[0],y:a[1],button:'left',buttons:1,clickCount:1,pointerType:'pen',force:.5});for(let i=1;i<=8;i++)await pen.send('Input.dispatchMouseEvent',{type:'mouseMoved',x:a[0]+(b[0]-a[0])*i/8,y:a[1]+(b[1]-a[1])*i/8,buttons:1,pointerType:'pen',force:.5});await pen.send('Input.dispatchMouseEvent',{type:'mouseReleased',x:b[0],y:b[1],button:'left',buttons:0,clickCount:1,pointerType:'pen'})};
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
  for(const ext of ['STEP','IGES']){
   await open(project);await files();await page.locator('#ncExport'+ext).click();await page.locator('#stepSaveNow').waitFor({state:'visible'});
   const event=page.waitForEvent('download');await page.locator('#stepSaveNow').click();const downloaded=await event,data=fs.readFileSync(await downloaded.path());assert.ok(downloaded.suggestedFilename().endsWith('.'+ext.toLowerCase()));await page.locator('#stepSaveClose').click();
   const step=ext==='IGES'?(await igesConverter()).convert(data,false):data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength);
   const imported=await kernel.handle('/import-cad/step',step);close(imported.volume,expected);
   await page.locator('#ncCADFile').setInputFiles({name:'roundtrip.'+ext.toLowerCase(),mimeType:'application/octet-stream',buffer:data});await page.waitForFunction(()=>document.getElementById('count').textContent==='3',{},{timeout:30000});
   for(let i=0;i<50&&page.workers().some(w=>w.url().includes('iges-worker'));i++)await page.waitForTimeout(50);
   assert.equal(page.workers().some(w=>w.url().includes('iges-worker')),false,'The optional converter must release its Worker after each operation');
  }
  for(const ext of ['STL','OBJ','3MF']){
   await open(project);await files();const event=page.waitForEvent('download');await page.locator('#ncExport'+ext).click();const data=fs.readFileSync(await (await event).path());assert.ok(data.length>100);
   await page.locator('#ncMeshFile').setInputFiles({name:'roundtrip.'+ext.toLowerCase(),mimeType:'application/octet-stream',buffer:data});await page.waitForFunction(()=>Number(document.getElementById('count').textContent)>2,{},{timeout:30000});
   const result=await save();assert.equal(result.objects.filter(o=>o.exactRecipe).length,2);assert.ok(result.objects.slice(2).every(o=>o.geometryJSON&&!o.exactRecipe));
  }
  // Incomplete converter assets must preserve the document and permit a clean retry.
  await open(project);const beforeAssetFailure=await save();
  await context.route('**/iges-*.wasm',route=>route.fulfill({status:200,contentType:'application/wasm',body:Buffer.from('incomplete')}));
  await page.locator('#ncExportIGES').click();await page.waitForFunction(()=>document.getElementById('ncStatus').textContent.includes('خطای IGES'),{},{timeout:30000});
  assert.equal(await page.locator('#stepSavePanel').isVisible(),false);assert.deepEqual((await save()).objects,beforeAssetFailure.objects);
  await context.unroute('**/iges-*.wasm');await page.locator('#ncExportIGES').click();await page.locator('#stepSaveNow').waitFor({state:'visible'});await page.locator('#stepSaveClose').click();
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
  // Explicitly switch tools and draw a hole inside an existing closed rectangle.
  await page.locator('[data-nctool="rectangle"]').click();await drag([330,350],[620,600]);
  await page.locator('[data-nctool="circle"]').click();assert.equal(await page.locator('#ncExtrude').isDisabled(),true);await drag([470,470],[500,470]);
  const holeProfiles=await save();assert.equal(holeProfiles.sketchRegions.length,2,'The inner circle must be drawn instead of selecting/extruding the outer face');
  const outer=holeProfiles.sketchRegions.find(r=>!r.circle),circle=holeProfiles.sketchRegions.find(r=>r.circle).circle;
  await page.locator('#ncSplit').click();await page.waitForFunction(()=>document.getElementById('ncStatus').textContent.includes('2 ناحیه'),{},{timeout:30000});
  await page.touchscreen.tap(360,380);await extrude(5,1);
  const plate=await save(),plateShape=await kernel.handle('/evaluate',plate.objects[0].exactRecipe);close(plateShape.volume,(area(rectBounds(outer))-Math.PI*circle.r*circle.r)*5);
  // Three-point arc followed by lines must stay analytic through extrusion.
  await blank();await page.locator('[data-nctool="arc"]').click();
  for(const point of [[400,400],[450,350],[500,400]])await drag(point,point);
  await page.locator('[data-nctool="line"]').click();await drag([500,400],[500,500]);await drag([500,500],[400,500]);await drag([400,500],[400,400]);
  const arcProject=await save(),segments=arcProject.sketchRegions[0].segments;assert.ok(segments.some(s=>s.kind==='arc'));
  let signedArea=0;
  for(const seg of segments){signedArea+=(seg.a.x*seg.b.y-seg.b.x*seg.a.y)/2;if(seg.kind==='arc'){const {a,m,b}=seg,det=2*(a.x*(m.y-b.y)+m.x*(b.y-a.y)+b.x*(a.y-m.y)),aa=a.x*a.x+a.y*a.y,mm=m.x*m.x+m.y*m.y,bb=b.x*b.x+b.y*b.y,cx=(aa*(m.y-b.y)+mm*(b.y-a.y)+bb*(a.y-m.y))/det,cy=(aa*(b.x-m.x)+mm*(a.x-b.x)+bb*(m.x-a.x))/det,r2=(a.x-cx)**2+(a.y-cy)**2,angle=p=>Math.atan2(p.y-cy,p.x-cx),normalize=x=>(x+Math.PI*4)%(Math.PI*2);let theta=normalize(angle(b)-angle(a));if(normalize(angle(m)-angle(a))>theta)theta-=Math.PI*2;signedArea+=r2*(theta-Math.sin(theta))/2}}
  await extrude(4,1);const arcSolid=(await save()).objects[0];close((await kernel.handle('/evaluate',arcSolid.exactRecipe)).volume,Math.abs(signedArea)*4);
  // A malformed mesh must not add a broken body or partially commit a valid sibling.
  const intact=await save();
  const brokenOBJ='o valid\nv 0 0 0\nv 10 0 0\nv 0 10 0\nf 1 2 3\no invalid\nv NaN 0 0\nv 1 0 0\nv 0 1 0\nf 4 5 6\n';
  for(const [ext,data] of [['stl','solid empty\n'+' '.repeat(200)+'\nendsolid empty'],['obj',brokenOBJ],['3mf','not a zip']]){
   await page.locator('#ncMeshFile').setInputFiles({name:'invalid.'+ext,mimeType:'application/octet-stream',buffer:Buffer.from(data)});await page.waitForFunction(()=>document.getElementById('ncMeshFile').value==='');
   assert.deepEqual((await save()).objects,intact.objects,'Invalid '+ext+' must preserve every original body');
  }
  for(const ext of ['step','iges']){
   await page.locator('#ncCADFile').setInputFiles({name:'invalid.'+ext,mimeType:'application/octet-stream',buffer:Buffer.from('invalid CAD')});await page.waitForFunction(()=>document.getElementById('ncCADFile').value==='');assert.deepEqual((await save()).objects,intact.objects,'Invalid CAD must preserve the document');
  }
  await page.locator('#ncUndo').click();assert.equal((await save()).objects.length,0);await page.locator('#ncRedo').click();assert.equal((await save()).objects.length,1);
  if(pen){assert.ok(await page.evaluate(()=>window.observedPenDowns)>10,'Chromium must receive real pen-type input');await pen.detach()}
  fs.mkdirSync(path.resolve(__dirname,'../test-results'),{recursive:true});await page.screenshot({path:path.resolve(__dirname,'../test-results/shipping-'+name+'.png')});
  assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);
 }catch(error){if(page){fs.mkdirSync(path.resolve(__dirname,'../test-results'),{recursive:true});await page.screenshot({path:path.resolve(__dirname,'../test-results/shipping-'+name+'-failure.png'),timeout:5000}).catch(()=>{})}throw error}
 finally{await browser?.close();await host.close()}
});
