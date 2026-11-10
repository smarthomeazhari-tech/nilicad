export const ellipseDefaults={rx:25,ry:15,angle:0,center:{x:0,y:0}};
export function ellipseSettings(input=ellipseDefaults){
 if(!input||typeof input!=='object')throw Error('تنظیمات بیضی معتبر نیست');
 const {rx,ry,angle,center}=input;
 if(![rx,ry].every(v=>Number.isFinite(v)&&v>=.01&&v<=10000))throw Error('نیم‌محورها باید بین ۰٫۰۱ و ۱۰۰۰۰ میلی‌متر باشند');
 if(!Number.isFinite(angle)||Math.abs(angle)>360000)throw Error('زاویه معتبر نیست');
 if(!center||![center.x,center.y].every(v=>Number.isFinite(v)&&Math.abs(v)<=1e6))throw Error('مرکز بیضی معتبر نیست');
 const degrees=((angle%360)+360)%360,t=degrees*Math.PI/180;
 const xExtent=Math.hypot(rx*Math.cos(t),ry*Math.sin(t)),yExtent=Math.hypot(rx*Math.sin(t),ry*Math.cos(t));
 if(Math.abs(center.x)+xExtent>1e6||Math.abs(center.y)+yExtent>1e6)throw Error('بیضی خارج از محدوده مختصات است');
 return {rx,ry,angle:degrees,center:{x:center.x,y:center.y}};
}
export function ellipsePoints(input,count=128){const {rx,ry,angle,center}=ellipseSettings(input),t=angle*Math.PI/180;return Array.from({length:count},(_,i)=>{const u=2*Math.PI*i/count,x=rx*Math.cos(u),y=ry*Math.sin(u);return {x:center.x+x*Math.cos(t)-y*Math.sin(t),y:center.y+x*Math.sin(t)+y*Math.cos(t)}})}
export function ellipseFromPoints(center,vertex){return ellipseSettings({center,rx:Math.abs(vertex.x-center.x),ry:Math.abs(vertex.y-center.y),angle:0})}
export function installEllipseTool({create,message}){
 const button=document.querySelector('[data-nctool="ellipse"]');button.disabled=false;button.innerHTML='<span class="ncIcon">⬭</span><span>Ellipse</span>';
 const fields=document.createElement('div');fields.id='ncEllipseOptions';fields.hidden=true;fields.innerHTML='<div>Ellipse · XZ</div>'+[['RX','Semi-axis X · mm',25],['RY','Semi-axis Z · mm',15],['Angle','Angle · °',0],['X','Center X · mm',0],['Z','Center Z · mm',0]].map(([id,label,value])=>`<label>${label}<input id="ncEllipse${id}" type="number" step="any" value="${value}" aria-label="${label}"></label>`).join('')+'<p id="ncEllipseMetrics"></p><button class="ncBtn" id="ncEllipseCreate">Create ellipse</button><p>Drag center → bounding corner, or pick those two points. Pointer construction uses X/Z axes.</p>';button.after(fields);
 const style=document.createElement('style');style.textContent='#ncEllipseOptions{padding:9px 7px;background:#f8faff;border:1px solid #e0e8f1;border-radius:7px;font:10px/1.6 Arial;color:#718397;direction:ltr}#ncEllipseOptions[hidden]{display:none!important}#ncEllipseOptions label{display:block;margin-top:6px}#ncEllipseOptions input{box-sizing:border-box;width:100%;padding:7px 5px;border:1px solid #d6e0ed;border-radius:5px;color:#354d69}#ncEllipseOptions .ncBtn{justify-content:center;background:#e8f1ff!important;color:#1769e0!important}#ncEllipseOptions .ncBtn:disabled{display:flex!important;opacity:.4}';document.head.append(style);
 const $=id=>document.getElementById('ncEllipse'+id);let saved=ellipseSettings(),busy=false;
 const raw=()=>({rx:Number($('RX').value),ry:Number($('RY').value),angle:Number($('Angle').value),center:{x:Number($('X').value),y:Number($('Z').value)}});
 function metrics(){try{const s=ellipseSettings(raw());saved=s;$('Metrics').textContent=`Area ${(Math.PI*s.rx*s.ry).toFixed(3)} mm²`;$('Create').disabled=busy}catch(error){$('Metrics').textContent=error.message;$('Create').disabled=true}}
 function set(input){const s=ellipseSettings(input);for(const [id,value]of [['RX',s.rx],['RY',s.ry],['Angle',s.angle],['X',s.center.x],['Z',s.center.y]])$(id).value=value;metrics()}
 for(const input of fields.querySelectorAll('input'))input.addEventListener('input',metrics);
 $('Create').onclick=async()=>{try{await create(ellipseSettings(raw()))}catch(error){message(error.message)}};
 metrics();return {read:()=>ellipseSettings(raw()),get:()=>structuredClone(saved),set,show:active=>fields.hidden=!active,setBusy:value=>{busy=value;metrics()}};
}
