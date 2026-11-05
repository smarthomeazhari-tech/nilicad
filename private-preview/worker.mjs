/** Server-side HTTP Basic authentication. Static files must never bypass this Worker. */
const encoder=new TextEncoder();
const challenge='Basic realm="NiliCAD Private", charset="UTF-8"';
function response(body,status,headers={}){
 return new Response(body,{status,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'private, no-store','CDN-Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...headers}});
}
function credentials(header){
 if(!header||header.length>4096||!/^Basic\s+/i.test(header))return null;
 try{const base64=header.replace(/^Basic\s+/i,'');if(!/^[A-Za-z0-9+/]+={0,2}$/.test(base64))return null;const binary=atob(base64),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0)),text=new TextDecoder('utf-8',{fatal:true}).decode(bytes),colon=text.indexOf(':');if(colon<1)return null;return {username:text.slice(0,colon),password:text.slice(colon+1)}}catch{return null}
}
async function equal(actual,expected){
 const [a,b]=await Promise.all([crypto.subtle.digest('SHA-256',encoder.encode(actual)),crypto.subtle.digest('SHA-256',encoder.encode(expected))]);
 const aa=new Uint8Array(a),bb=new Uint8Array(b);let mismatch=0;for(let i=0;i<aa.length;i++)mismatch|=aa[i]^bb[i];return mismatch===0;
}
export default {
 async fetch(request,env){
  if(new URL(request.url).protocol!=='https:')return response('HTTPS is required.',403);
  // A deployment without configured secrets must not serve the application.
  if(typeof env.AUTH_USERNAME!=='string'||!env.AUTH_USERNAME||env.AUTH_USERNAME.includes(':')||typeof env.AUTH_PASSWORD!=='string'||env.AUTH_PASSWORD.length<16||!env.LOGIN_LIMITER?.limit||!env.ASSETS?.fetch)return response('ورود خصوصی هنوز توسط مالک سایت تنظیم نشده است.',503);
  const supplied=credentials(request.headers.get('Authorization'));
  const [userOK,passwordOK]=await Promise.all([equal(supplied?.username||'',env.AUTH_USERNAME),equal(supplied?.password||'',env.AUTH_PASSWORD)]);
  if(!supplied||!userOK||!passwordOK){
   // A missing header is the normal browser challenge, not a failed password attempt.
   if(request.headers.has('Authorization')){try{const key='failed-login:'+request.headers.get('CF-Connecting-IP');const {success}=await env.LOGIN_LIMITER.limit({key});if(!success)return response('تعداد تلاش‌ها زیاد است؛ یک دقیقه دیگر امتحان کنید.',429,{'Retry-After':'60'})}catch{return response('کنترل ورود موقتاً در دسترس نیست.',503)}}
   return response('برای ورود به NiliCAD نام کاربری و رمز عبور لازم است.',401,{'WWW-Authenticate':challenge});
  }
  if(!['GET','HEAD'].includes(request.method))return response('Method not allowed.',405,{'Allow':'GET, HEAD'});
  // Do not pass credentials on to the asset binding.
  const headers=new Headers(request.headers);headers.delete('Authorization');headers.delete('Cookie');
  const asset=await env.ASSETS.fetch(new Request(request,{headers}));
  const secured=new Response(asset.body,asset);secured.headers.set('Cache-Control','private, no-store');secured.headers.set('CDN-Cache-Control','no-store');secured.headers.set('X-Content-Type-Options','nosniff');secured.headers.set('Referrer-Policy','no-referrer');secured.headers.set('Content-Security-Policy',"frame-ancestors 'none'; base-uri 'self'; object-src 'none'");
  return secured;
 }
};
