const fs=require('node:fs');
const path=require('node:path');
const http=require('node:http');

exports.startPrivateServer=async()=>{
 const {default:handler}=await import('../../private-preview/worker.mjs');
 const root=path.resolve(__dirname,'../../private-preview/dist');
 const credentials={username:'acceptance-owner',password:'acceptance-password-only-for-local-tests'};
 const env={AUTH_USERNAME:credentials.username,AUTH_PASSWORD:credentials.password,LOGIN_LIMITER:{limit:async()=>({success:true})},ASSETS:{fetch:async request=>{
  let name=decodeURIComponent(new URL(request.url).pathname).replace(/^\//,'');if(!name||name.endsWith('/'))name+='index.html';
  const file=path.resolve(root,name);if(!file.startsWith(root+path.sep))return new Response('Not found',{status:404});
  try{return new Response(fs.readFileSync(file),{headers:{'Content-Type':/\.(js|mjs)$/.test(file)?'application/javascript':file.endsWith('.json')?'application/json':file.endsWith('.wasm')?'application/wasm':'text/html'}})}catch{return new Response('Not found',{status:404})}
 }}};
 const server=http.createServer(async(req,res)=>{
  try{const result=await handler.fetch(new Request('https://private.example'+req.url,{method:req.method,headers:req.headers}),env);res.writeHead(result.status,Object.fromEntries(result.headers));res.end(Buffer.from(await result.arrayBuffer()))}
  catch{res.writeHead(500);res.end('Local adapter error')}
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 return {url:'http://127.0.0.1:'+server.address().port,credentials,close:async()=>{server.closeAllConnections();await new Promise(resolve=>server.close(resolve))}};
};
