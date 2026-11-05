import {createInterface} from 'node:readline/promises';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
async function hidden(prompt){
 if(!process.stdin.isTTY)throw Error('Run this setup in an interactive terminal.');
 process.stdout.write(prompt);process.stdin.setRawMode(true);process.stdin.resume();
 return new Promise((resolve,reject)=>{let value='';const handler=chunk=>{for(const char of chunk.toString()){if(char==='\u0003'){end();reject(Error('Cancelled'));return}if(char==='\r'||char==='\n'){end();resolve(value);return}if(char==='\u007f'||char==='\b')value=value.slice(0,-1);else if(char>=' ')value+=char}};function end(){process.stdin.off('data',handler);process.stdin.setRawMode(false);process.stdin.pause();process.stdout.write('\n')}process.stdin.on('data',handler)});
}
async function secret(name,value){
 await new Promise((resolve,reject)=>{const child=spawn(process.execPath,['node_modules/wrangler/bin/wrangler.js','secret','put',name,'--config','private-preview/wrangler.jsonc'],{cwd:root,stdio:['pipe','inherit','inherit']});child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(Error('Secret setup failed.')));child.stdin.end(value+'\n')});
}
const rl=createInterface({input:process.stdin,output:process.stdout});const username=(await rl.question('Username: ')).trim();rl.close();
if(!username||username.includes(':')||/[\r\n]/.test(username))throw Error('Choose a username without a colon or newline.');
const password=await hidden('Password (at least 16 characters, hidden): '),confirm=await hidden('Repeat password (hidden): ');
if(password.length<16||password!==confirm)throw Error('Password confirmation failed or password is shorter than 16 characters.');
await secret('AUTH_USERNAME',username);await secret('AUTH_PASSWORD',password);
console.log('Private credentials saved to Cloudflare secrets. No credential file was created.');
