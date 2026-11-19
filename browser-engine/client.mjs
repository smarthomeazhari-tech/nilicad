import {convertIGES,shutdownIGES} from './iges-client.mjs';
let worker,nextId=0;
const pending=new Map();
function stop(message){const previous=worker;worker=null;if(previous){previous.onmessage=null;previous.onerror=null;previous.onmessageerror=null;previous.terminate()}for(const request of pending.values()){clearTimeout(request.timer);request.reject(Error(message))}pending.clear()}
function retireIdleCore(){if(!pending.size)stop('موتور CAD برای تبدیل IGES آزاد شد')}
function start(){
 if(worker)return;
 worker=new Worker(new URL('./dist/worker.js',import.meta.url),{type:'module'});
 worker.onmessage=event=>{const data=event.data;if(data.status){for(const request of pending.values())request.onStatus?.(data.message);return}const request=pending.get(data.id);if(!request)return;pending.delete(data.id);clearTimeout(request.timer);if(data.error)request.reject(Error(data.error));else request.resolve(data.result)};
 worker.onerror=()=>stop('موتور CAD اجرا نشد؛ صفحه را تازه‌سازی کنید و دوباره امتحان کنید');
 worker.onmessageerror=()=>stop('پاسخ موتور CAD قابل خواندن نیست');
}
async function coreRequest(path,payload,onStatus){
 start();const id=++nextId;
 const data=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>stop('مهلت محاسبه پایان یافت؛ مدل حفظ شده است. دوباره امتحان کنید'),120000);pending.set(id,{resolve,reject,timer,onStatus});try{worker.postMessage({id,path,payload})}catch(error){clearTimeout(timer);pending.delete(id);reject(error)}});
 return data.binary?new Response(data.binary,{headers:{'Content-Type':data.type}}):new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
}
export async function browserRequest(path,payload,onStatus){
 if(path==='/export-iges'){
  const step=await (await coreRequest('/export-step',payload,onStatus)).arrayBuffer();
  retireIdleCore();
  return new Response(await convertIGES(step,true,onStatus),{headers:{'Content-Type':'model/iges'}});
 }
 if(/^\/import-cad\/(iges|igs)$/.test(path)){retireIdleCore();return coreRequest('/import-cad/step',await convertIGES(payload,false,onStatus),onStatus)}
 return coreRequest(path,payload,onStatus);
}
export const shutdownBrowserEngine=()=>{stop('موتور CAD بسته شد');shutdownIGES()};
