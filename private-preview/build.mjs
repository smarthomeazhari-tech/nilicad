import {cp,copyFile,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {resolve,dirname,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {build as bundle} from 'esbuild';
const root=fileURLToPath(new URL('../',import.meta.url)),dist=resolve(root,'private-preview/dist');
const build=spawnSync(process.execPath,['browser-engine/build.mjs'],{cwd:root,stdio:'inherit'});if(build.status!==0)throw Error('Browser engine build failed');
await rm(dist,{recursive:true,force:true});await mkdir(resolve(dist,'browser-engine'),{recursive:true});await mkdir(resolve(dist,'vendor'),{recursive:true});
let html=await readFile(resolve(root,'index.html'),'utf8');html=html.replace('https://cdn.jsdelivr.net/npm/three@0.164.1/build/three.module.js','./vendor/three.module.js').replace('https://cdn.jsdelivr.net/npm/three@0.164.1/examples/jsm/','./vendor/addons/');
const marker='\n</script>\n<input type="file" id="ncCADFile"';
if(!html.includes(marker))throw Error('Application bootstrap location changed');
html=html.replace(marker,`\n(async()=>{try{const response=await fetch('./demo.json');if(!response.ok)throw Error('دریافت مدل نمونه انجام نشد');ncLoadProject(await response.json());document.getElementById('ncProject').textContent='Private CAD';camera.position.set(175,155,195);camera.zoom=1.15;camera.updateProjectionMatrix();controls.target.set(10,6,0);controls.update()}catch(error){ncMessage(error.message)}})();\n`+marker);
// A classic deferred bundle avoids an import-map/module dependency waterfall at login.
// Keep the geometry worker separate so the UI can render before OCCT is downloaded.
const application=html.match(/<script type="module">([\s\S]*?)<\/script>/);
if(!application)throw Error('Application module missing');
await bundle({stdin:{contents:application[1]+`\nwindow.ncStartupReady=true;clearTimeout(window.ncStartupTimer);\n`,resolveDir:root,sourcefile:'cad-application.js'},outfile:resolve(dist,'app.js'),bundle:true,format:'iife',target:['safari15'],plugins:[{name:'browser-worker-url',setup(build){build.onLoad({filter:/browser-engine[\\/]client\.mjs$/},async args=>({contents:(await readFile(args.path,'utf8')).replace("new URL('./dist/worker.js',import.meta.url)","new URL('./browser-engine/dist/worker.js',document.baseURI)"),loader:'js'}))}}]});
html=html.replace(application[0],'<script defer src="./app.js"></script>');
html=html.replace(/<script type="importmap">[\s\S]*?<\/script>/,'');
html=html.replace('</head>',`<script>
window.ncStartupTimer=setTimeout(function(){if(!window.ncStartupReady){var el=document.getElementById('startupError');if(el){el.hidden=false;el.textContent='فضای ترسیم راه‌اندازی نشد. صفحه را تازه‌سازی کنید؛ اگر مشکل ادامه داشت، تصویر این پیام را ارسال کنید.'}}},15000);
window.addEventListener('error',function(event){if(event.target&&event.target.tagName==='SCRIPT'){var el=document.getElementById('startupError');if(el){el.hidden=false;el.textContent='فایل رابط CAD دریافت نشد. اتصال اینترنت را بررسی و صفحه را تازه‌سازی کنید.'}}},true);
</script></head>`);
await writeFile(resolve(dist,'index.html'),html);await copyFile(resolve(root,'examples/precision-demo.json'),resolve(dist,'demo.json'));
await copyFile(resolve(root,'browser-engine/client.mjs'),resolve(dist,'browser-engine/client.mjs'));await cp(resolve(root,'browser-engine/dist'),resolve(dist,'browser-engine/dist'),{recursive:true});
await copyFile(resolve(root,'node_modules/three/build/three.module.js'),resolve(dist,'vendor/three.module.js'));
const modules=resolve(root,'node_modules/three/examples/jsm'),queue=['controls/OrbitControls.js','controls/TransformControls.js','exporters/STLExporter.js','exporters/OBJExporter.js','loaders/STLLoader.js','loaders/OBJLoader.js','loaders/3MFLoader.js','libs/fflate.module.js'].map(p=>resolve(modules,p)),seen=new Set();
while(queue.length){const file=queue.pop();if(seen.has(file))continue;seen.add(file);const target=resolve(dist,'vendor/addons',relative(modules,file));await mkdir(dirname(target),{recursive:true});await copyFile(file,target);const source=await readFile(file,'utf8');for(const match of source.matchAll(/(?:from\s*|import\s*)['"]([^'"]+)['"]/g)){if(match[1].startsWith('.'))queue.push(resolve(dirname(file),match[1]))}}
console.log('Private static CAD build ready. Authentication is enforced by the Worker, not the HTML.');
