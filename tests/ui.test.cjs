const {test}=require('node:test');
const assert=require('node:assert/strict');
const {chromium,webkit}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');
for(const [name,engine] of Object.entries({chromium,webkit}))test(name+' selection and extrusion interaction',async()=>{
 const root=path.resolve(__dirname,'..');
 const server=http.createServer((req,res)=>{
  let file=req.url==='/'?'index.html':req.url.slice(1);
  try{let data=fs.readFileSync(path.join(root,file));if(file==='index.html')data=Buffer.from(data.toString().replace('https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js','/node_modules/three/build/three.module.js').replace('https://cdn.jsdelivr.net/npm/three@0.164.1/examples/jsm/','/node_modules/three/examples/jsm/').replace('\n</script>\n<input type="file" id="ncMeshFile"','\nwindow.testEval=code=>eval(code);\n</script>\n<input type="file" id="ncMeshFile"'));res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':'text/html');res.end(data)}catch{res.writeHead(404);res.end()}
 });await new Promise(r=>server.listen(0,'127.0.0.1',r));
 let browser;try{
 browser=await engine.launch({headless:true,args:name==='chromium'?['--no-sandbox']:[]});const page=await browser.newPage({viewport:{width:1100,height:800},hasTouch:true});
 const errors=[];page.on('pageerror',e=>(errors.push(e.message),console.error(e.message)));
 await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>typeof window.testEval==='function',{},{timeout:10000});await page.waitForTimeout(100);
 await page.evaluate(()=>testEval(`skPoints=[{x:-20,y:-20},{x:20,y:-20},{x:20,y:20},{x:-20,y:20}];skSegments=skPoints.map((a,i)=>({kind:'line',a,b:skPoints[(i+1)%4]}));skClosed=true;ncDraw();ncSaveRegion();skClosed=false;skSegments=[];skPoints=[];ncClearVisual();nc.mode='select';`));
 const screen=await page.evaluate(()=>testEval(`(()=>{const p=new THREE.Vector3(0,0,0).project(camera),r=canvas.getBoundingClientRect();return {x:r.left+(p.x+1)*r.width/2,y:r.top+(1-p.y)*r.height/2}})()`));
 await page.mouse.click(screen.x,screen.y);
 assert.equal(await page.locator('#ncExtrude').isEnabled(),true);
 await page.locator('#ncExtrude').click();await page.locator('#ncPull').waitFor({state:'visible'});
 const box=await page.locator('#ncPull').boundingBox();assert.ok(box.x>=0&&box.y>=0&&box.x+box.width<1100&&box.y+box.height<800);
 await page.locator('#ncDepth').fill('12');await page.locator('#ncDepth').dispatchEvent('change');await page.locator('#ncConfirm').click();
 assert.equal(await page.evaluate(()=>testEval('items.length')),1);
 assert.equal(await page.evaluate(()=>testEval('items[0].dims.z')),12);
 assert.deepEqual(errors,[]);
 }finally{await browser?.close();server.closeAllConnections();await new Promise(r=>server.close(r))}
});
