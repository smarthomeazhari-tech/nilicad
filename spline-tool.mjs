// One cubic Bezier edge, closed by its straight endpoint chord.
export const splineDefaults={points:[{x:-30,y:0},{x:-30,y:30},{x:30,y:30},{x:30,y:0}]};
const cross=(a,b)=>a.x*b.y-a.y*b.x;
export function splineSettings(input=splineDefaults){
 if(!input||!Array.isArray(input.points)||input.points.length!==4)throw Error('چهار نقطه کنترل برای Bézier لازم است');
 const points=input.points.map(p=>{if(!p||![p.x,p.y].every(v=>Number.isFinite(v)&&Math.abs(v)<=1e6))throw Error('مختصات نقطه کنترل معتبر نیست');return {x:p.x,y:p.y}});
 const [p0,p1,p2,p3]=points,dx=p3.x-p0.x,dy=p3.y-p0.y,length=Math.hypot(dx,dy);
 if(length<.01||Math.hypot(p1.x-p0.x,p1.y-p0.y)<1e-8||Math.hypot(p3.x-p2.x,p3.y-p2.y)<1e-8)throw Error('نقاط انتهایی و مماس‌ها باید متمایز باشند');
 const local=p=>({x:((p.x-p0.x)*dx+(p.y-p0.y)*dy)/length**2,y:((p.y-p0.y)*dx-(p.x-p0.x)*dy)/length**2}),q1=local(p1),q2=local(p2);
 if(q1.y*q2.y<0)throw Error('منحنی از خط بسته‌شدن عبور می‌کند؛ کنترل‌ها را در یک سمت قرار دهید');
 if(Math.max(Math.abs(q1.y),Math.abs(q2.y))*length<1e-6)throw Error('منحنی و خط بسته‌شدن سطح ایجاد نمی‌کنند');
 const a={x:3*q1.x-3*q2.x+1,y:3*q1.y-3*q2.y},b={x:-6*q1.x+3*q2.x,y:-6*q1.y+3*q2.y},c={x:3*q1.x,y:3*q1.y},det=cross(a,b);
 if(Math.abs(det)>1e-12){const u=-cross(a,c)/det,k=Math.abs(a.x)>Math.abs(a.y)?'x':'y',w=-(b[k]*u+c[k])/a[k],v=u*u-w,disc=u*u-4*v;if(disc>=-1e-12){const root=Math.sqrt(Math.max(0,disc)),t=(u-root)/2,s=(u+root)/2;if(t>=-1e-9&&s<=1+1e-9)throw Error('منحنی دارای تقاطع یا نقطه تکین است')}}
 const k=Math.abs(a.x)+Math.abs(b.x)+Math.abs(c.x)>Math.abs(a.y)+Math.abs(b.y)+Math.abs(c.y)?'x':'y',A=3*a[k],B=2*b[k],C=c[k];let roots=[];
 if(Math.abs(A)<1e-12){if(Math.abs(B)>1e-12)roots=[-C/B]}else{const d=B*B-4*A*C;if(d>=0)roots=[(-B-Math.sqrt(d))/(2*A),(-B+Math.sqrt(d))/(2*A)]}
 if(roots.some(t=>t>0&&t<1&&Math.hypot(3*a.x*t*t+2*b.x*t+c.x,3*a.y*t*t+2*b.y*t+c.y)<1e-8))throw Error('مماس منحنی در یک نقطه تعریف نمی‌شود');
 const area=Math.abs(cross(c,b)/6+cross(c,a)/4+cross(b,a)/10)*length**2;if(area<1e-6)throw Error('مساحت پروفیل بسیار کوچک است');
 return {points};
}
export function splinePoint(input,t){const p=input.points;if(!Number.isFinite(t)||t<0||t>1)throw Error('پارامتر منحنی معتبر نیست');const u=1-t;return {x:u**3*p[0].x+3*u*u*t*p[1].x+3*u*t*t*p[2].x+t**3*p[3].x,y:u**3*p[0].y+3*u*u*t*p[1].y+3*u*t*t*p[2].y+t**3*p[3].y}}
export function splinePreview(input,count=96){const settings=splineSettings(input);return Array.from({length:count+1},(_,i)=>splinePoint(settings,i/count))}
export function installSplineTool({create,message}){
 const button=document.querySelector('[data-nctool="spline"]');button.disabled=false;button.innerHTML='<span class="ncIcon">〰</span><span>Spline · Bézier</span>';
 const fields=document.createElement('div');fields.id='ncSplineOptions';fields.hidden=true;fields.innerHTML='<strong>Cubic Bézier · XZ</strong>'+splineDefaults.points.map((p,i)=>`<div class="ncSplineRow"><label>P${i} X<input id="ncSpline${i}X" aria-label="Control ${i} X" type="number" step="any" value="${p.x}"></label><label>P${i} Z<input id="ncSpline${i}Z" aria-label="Control ${i} Z" type="number" step="any" value="${p.y}"></label></div>`).join('')+'<p id="ncSplineInfo"></p><button id="ncSplineCreate" class="ncBtn">Create profile</button><p>Pick P0, P1, P2, P3 with pen/mouse. P0/P3 are endpoints; P1/P2 are control handles. A straight chord closes the profile.</p>';button.after(fields);
 const style=document.createElement('style');style.textContent='#ncSplineOptions{padding:9px 7px;background:#f8faff;border:1px solid #e0e8f1;border-radius:7px;font:10px/1.6 Arial;color:#718397;direction:ltr}#ncSplineOptions[hidden]{display:none!important}#ncSplineOptions .ncSplineRow{display:flex;gap:5px}#ncSplineOptions label{display:block;min-width:0;flex:1;margin-top:6px}#ncSplineOptions input{box-sizing:border-box;width:100%;padding:7px 5px;border:1px solid #d6e0ed;border-radius:5px;color:#354d69}#ncSplineOptions .ncBtn{justify-content:center;background:#e8f1ff!important;color:#1769e0!important}#ncSplineOptions .ncBtn:disabled{display:flex!important;opacity:.4}';document.head.append(style);
 const $=id=>document.getElementById('ncSpline'+id);let saved=splineSettings(),busy=false;
 const raw=()=>({points:[0,1,2,3].map(i=>({x:Number($(i+'X').value),y:Number($(i+'Z').value)}))});
 function metrics(){try{saved=splineSettings(raw());$('Info').textContent='Exact cubic curve + closing line';$('Create').disabled=busy}catch(error){$('Info').textContent=error.message;$('Create').disabled=true}}
 function set(input){const s=splineSettings(input);for(const [i,p]of s.points.entries()){ $(i+'X').value=p.x;$(i+'Z').value=p.y }metrics()}
 for(const input of fields.querySelectorAll('input'))input.addEventListener('input',metrics);
 $('Create').onclick=async()=>{try{await create(splineSettings(raw()))}catch(error){message(error.message)}};
 metrics();return {read:()=>splineSettings(raw()),get:()=>structuredClone(saved),set,show:active=>fields.hidden=!active,setBusy:value=>{busy=value;metrics()}};
}
