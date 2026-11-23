import {build} from 'esbuild';
import {mkdir,copyFile,writeFile,readFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {buildIGES} from './iges/assets.mjs';
const require=createRequire(import.meta.url),out=new URL('./dist/',import.meta.url);
await rm(out,{recursive:true,force:true});await mkdir(out,{recursive:true});
await build({entryPoints:[fileURLToPath(new URL('./worker.mjs',import.meta.url))],bundle:true,platform:'browser',format:'esm',target:'es2022',external:['node:*'],outfile:fileURLToPath(new URL('worker.js',out)),minify:true,legalComments:'linked'});
const wasm=await readFile(require.resolve('replicad-opencascadejs/wasm')),sha256=createHash('sha256').update(wasm).digest('hex'),parts=[];
for(let offset=0,index=0;offset<wasm.length;offset+=4*1024*1024,index++){const data=wasm.subarray(offset,Math.min(offset+4*1024*1024,wasm.length)),file=`occt-${sha256.slice(0,12)}-${index}.wasm`;await writeFile(new URL(file,out),data);parts.push({file,size:data.length})}
await writeFile(new URL('occt-manifest.json',out),JSON.stringify({size:wasm.length,sha256,parts}));
await copyFile(new URL('../node_modules/replicad-opencascadejs/LICENSE',import.meta.url),new URL('OCCT-LICENSE.txt',out));
await copyFile(new URL('../node_modules/replicad/LICENSE',import.meta.url),new URL('REPLICAD-LICENSE.txt',out));
await writeFile(new URL('NOTICE.txt',out),'NiliCAD browser CAD engine uses unmodified replicad-opencascadejs 1.1.0 (LGPL-2.1-only) and replicad 1.2.0 (MIT).\nSource and build instructions: https://github.com/sgenoud/replicad\nOpen CASCADE source: https://github.com/Open-Cascade-SAS/OCCT\nThe corresponding package source versions and their licenses are available through npm: replicad-opencascadejs@1.1.0 and replicad@1.2.0.\n');
console.log('Browser OCCT worker and single-threaded WASM built.');
await buildIGES(out);
console.log('Optional isolated IGES converter built.');
