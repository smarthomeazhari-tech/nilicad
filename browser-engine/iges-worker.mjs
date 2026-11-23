import {initializeIGES} from './iges-converter.mjs';

async function load(){
 postMessage({status:'loading',message:'دریافت مبدل اختیاری IGES (حدود ۱۱ مگابایت)…'});
 const response=await fetch(new URL('iges-manifest.json',import.meta.url));if(!response.ok)throw Error('فهرست مبدل IGES دریافت نشد');
 const manifest=await response.json();
 if(!Number.isSafeInteger(manifest.size)||manifest.size<1||manifest.size>32*1024*1024||!/^[a-f0-9]{64}$/.test(manifest.sha256)||!Array.isArray(manifest.parts)||!manifest.parts.length||manifest.parts.length>16)throw Error('فهرست IGES معتبر نیست');
 if(manifest.parts.some(p=>!/^iges-[a-f0-9]{12}-[0-9]+\.wasm$/.test(p.file)||!Number.isSafeInteger(p.size)||p.size<1||p.size>4*1024*1024)||manifest.parts.reduce((n,p)=>n+p.size,0)!==manifest.size)throw Error('بخش‌های مبدل IGES معتبر نیستند');
 let received=0;
 const parts=await Promise.all(manifest.parts.map(async part=>{const response=await fetch(new URL(part.file,import.meta.url));if(!response.ok)throw Error('دریافت مبدل IGES انجام نشد');const bytes=new Uint8Array(await response.arrayBuffer());if(bytes.length!==part.size)throw Error('بخش مبدل IGES ناقص است');received+=bytes.length;postMessage({status:'loading',message:'دریافت مبدل IGES: '+Math.round(received/manifest.size*100)+'٪'});return bytes}));
 const wasm=new Uint8Array(manifest.size);let offset=0;for(const part of parts){wasm.set(part,offset);offset+=part.length}
 const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',wasm)),b=>b.toString(16).padStart(2,'0')).join('');
 if(digest!==manifest.sha256)throw Error('بررسی صحت مبدل IGES موفق نبود');
 postMessage({status:'loading',message:'آماده‌سازی تبدیل دقیق IGES…'});return initializeIGES(wasm);
}
self.onmessage=async event=>{
 try{const engine=await load(),binary=engine.convert(event.data.binary,event.data.toIGES);postMessage({binary},[binary])}
 catch(error){postMessage({error:error instanceof Error?error.message:'تبدیل IGES انجام نشد'})}
};
