import {readFile,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {fileURLToPath} from 'node:url';
const hash=data=>createHash('sha256').update(data).digest('hex');
export async function buildIGES(out){
 const manifest=JSON.parse(await readFile(new URL('./vendor/manifest.json',import.meta.url),'utf8'));
 for(const [name,expected] of Object.entries(manifest.source)){
  const source=(await readFile(new URL(name,import.meta.url),'utf8')).replace(/\r\n/g,'\n');
  if(hash(source)!==expected)throw Error('IGES source changed: rebuild the pinned converter before shipping');
 }
 const files={};
 for(const [name,expected] of Object.entries(manifest.files)){
  const data=gunzipSync(await readFile(new URL('./vendor/'+name+'.gz',import.meta.url)));
  if(data.length!==expected.size||hash(data)!==expected.sha256)throw Error('IGES artifact integrity check failed');
  files[name]=data;
 }
 const wasm=files['nilicad_iges.wasm'];if(wasm.length>32*1024*1024)throw Error('IGES converter exceeds the optional-engine size budget');
 await writeFile(new URL('nilicad-iges-runtime.mjs',out),files['nilicad_iges.js']);
 const sha256=hash(wasm),parts=[];
 for(let offset=0,index=0;offset<wasm.length;offset+=4*1024*1024,index++){
  const data=wasm.subarray(offset,Math.min(offset+4*1024*1024,wasm.length)),file=`iges-${sha256.slice(0,12)}-${index}.wasm`;
  await writeFile(new URL(file,out),data);parts.push({file,size:data.length});
 }
 await writeFile(new URL('iges-manifest.json',out),JSON.stringify({size:wasm.length,sha256,parts}));
 for(const [source,target] of [['LICENSE-LGPL-2.1.txt','IGES-LICENSE.txt'],['OCCT-LGPL-EXCEPTION.txt','IGES-OCCT-EXCEPTION.txt']])await writeFile(new URL(target,out),await readFile(new URL('./vendor/'+source,import.meta.url)));
 await writeFile(new URL('IGES-NOTICE.txt',out),'Optional NiliCAD IGES converter: Open CASCADE, LGPL-2.1 with OCCT exception.\nCorresponding converter source, build configuration and pinned source/build image: https://github.com/smarthomeazhari-tech/nilicad/tree/feat/private-preview-auth/browser-engine/iges\nUpstream source: https://github.com/taucad/opencascade.js/tree/ebd263f1 ; complete OCCT source is included at /occt in the pinned image in manifest.json.\nWASM SHA-256: '+sha256+'\n');
 await build({entryPoints:[fileURLToPath(new URL('../iges-worker.mjs',import.meta.url))],bundle:true,platform:'browser',format:'esm',target:'es2022',external:['node:*'],outfile:fileURLToPath(new URL('iges-worker.js',out)),minify:true,legalComments:'linked'});
}
