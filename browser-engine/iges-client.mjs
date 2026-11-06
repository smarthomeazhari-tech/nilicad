const active=new Map();
export function convertIGES(binary,toIGES,onStatus){
 return new Promise((resolve,reject)=>{
  let worker;
  try{worker=new Worker(new URL('./dist/iges-worker.js',import.meta.url),{type:'module'})}catch{reject(Error('Worker مبدل IGES اجرا نشد'));return}
  const finish=(error,data)=>{const request=active.get(worker);if(!request)return;clearTimeout(request.timer);active.delete(worker);worker.terminate();error?reject(Error(error)):resolve(data)};
  const timer=setTimeout(()=>finish('مهلت تبدیل IGES پایان یافت؛ پروژه حفظ شده است'),120000);active.set(worker,{timer,finish});
  worker.onmessage=event=>{const data=event.data;if(data.status){onStatus?.(data.message);return}finish(data.error,data.binary)};
  worker.onerror=()=>finish('مبدل IGES متوقف شد؛ پروژه حفظ شده است');worker.onmessageerror=()=>finish('پاسخ مبدل IGES معتبر نیست');
  try{worker.postMessage({binary,toIGES},[binary])}catch{finish('دادهٔ فایل IGES قابل ارسال نیست')}
 });
}
export function shutdownIGES(){for(const request of [...active.values()])request.finish('مبدل IGES بسته شد')}
