let worker,nextId=0;
const pending=new Map();
function stop(message){worker?.terminate();worker=null;for(const request of pending.values()){clearTimeout(request.timer);request.reject(Error(message))}pending.clear()}
function start(){
 if(worker)return;
 worker=new Worker(new URL('./dist/worker.js',import.meta.url),{type:'module'});
 worker.onmessage=event=>{const data=event.data;if(data.status){for(const request of pending.values())request.onStatus?.(data.message);return}const request=pending.get(data.id);if(!request)return;pending.delete(data.id);clearTimeout(request.timer);if(data.error)request.reject(Error(data.error));else request.resolve(data.result)};
 worker.onerror=()=>stop('موتور CAD اجرا نشد؛ صفحه را تازه‌سازی کنید و دوباره امتحان کنید');
 worker.onmessageerror=()=>stop('پاسخ موتور CAD قابل خواندن نیست');
}
export async function browserRequest(path,payload,onStatus){
 start();const id=++nextId;
 const data=await new Promise((resolve,reject)=>{const timer=setTimeout(()=>stop('مهلت محاسبه پایان یافت؛ مدل حفظ شده است. دوباره امتحان کنید'),120000);pending.set(id,{resolve,reject,timer,onStatus});try{worker.postMessage({id,path,payload})}catch(error){clearTimeout(timer);pending.delete(id);reject(error)}});
 return data.binary?new Response(data.binary,{headers:{'Content-Type':data.type}}):new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
}
export const shutdownBrowserEngine=()=>stop('موتور CAD بسته شد');
