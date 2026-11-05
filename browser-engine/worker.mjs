import initializeOCCT from 'replicad-opencascadejs';
import {createKernel} from './kernel.mjs';
let kernelPromise,queue=Promise.resolve();
function kernel(){
 if(!kernelPromise){
  postMessage({status:'loading',message:'بارگذاری موتور CAD داخل مرورگر (حدود ۲۲ مگابایت)…'});
  kernelPromise=(async()=>{const response=await fetch(new URL('occt.wasm',import.meta.url));if(!response.ok)throw Error('فایل موتور دریافت نشد؛ صفحه را دوباره باز کنید');const wasmBinary=await response.arrayBuffer();postMessage({status:'compiling',message:'آماده‌سازی Open CASCADE…'});const oc=await initializeOCCT({wasmBinary});postMessage({status:'ready',message:'موتور CAD مرورگر آماده است؛ سرور لازم نیست'});return createKernel(oc)})().catch(error=>{kernelPromise=null;throw error});
 }
 return kernelPromise;
}
self.onmessage=event=>{const {id,path,payload}=event.data;queue=queue.then(async()=>{try{const engine=await kernel(),result=await engine.handle(path,payload);if(result.binary)postMessage({id,result},[result.binary]);else postMessage({id,result})}catch(error){postMessage({id,error:error instanceof Error?error.message:'عملیات هندسی OCCT انجام نشد'})}})};
