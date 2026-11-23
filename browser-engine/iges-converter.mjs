import initialize from './dist/nilicad-iges-runtime.mjs';

export async function initializeIGES(wasmBinary){
 const oc=await initialize({wasmBinary,print:()=>{},printErr:()=>{}});
 if(typeof oc.NiliCADIGES?.Convert!=='function')throw Error('مبدل IGES معتبر نیست');
 return {
  heapBytes:()=>oc.wasmMemory.buffer.byteLength,
  convert(binary,toIGES){
   const bytes=binary instanceof ArrayBuffer?new Uint8Array(binary):binary;
   if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>20000000)throw Error('فایل CAD باید بین ۱ بایت و ۲۰ مگابایت باشد');
   const input=toIGES?'/input.step':'/input.iges',output=toIGES?'/output.iges':'/output.step';
   try{
    oc.FS.writeFile(input,bytes);
    if(!oc.NiliCADIGES.Convert(input,output,!!toIGES))throw Error('تبدیل دقیق IGES انجام نشد؛ فایل یا هندسه معتبر نیست');
    const size=oc.FS.stat(output).size;if(!size||size>20000000)throw Error('حجم فایل خروجی CAD بیش از حد مجاز است');
    return oc.FS.readFile(output).slice().buffer;
   }finally{for(const name of [input,output])try{oc.FS.unlink(name)}catch{}}
  }
 };
}
