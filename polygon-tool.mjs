export const polygonDefaults={sides:6,radius:20,angle:0,center:{x:0,y:0}};
export function polygonSettings(input=polygonDefaults){
 if(!input||typeof input!=='object')throw Error('تنظیمات چندضلعی معتبر نیست');
 const {sides,radius,angle,center}=input;
 if(!Number.isInteger(sides)||sides<3||sides>64)throw Error('تعداد اضلاع باید عدد صحیح بین ۳ و ۶۴ باشد');
 if(!Number.isFinite(radius)||radius<.01||radius>10000)throw Error('شعاع باید بین ۰٫۰۱ و ۱۰۰۰۰ میلی‌متر باشد');
 if(!Number.isFinite(angle)||Math.abs(angle)>360000)throw Error('زاویه معتبر نیست');
 if(!center||![center.x,center.y].every(v=>Number.isFinite(v)&&Math.abs(v)<=1e6))throw Error('مرکز چندضلعی معتبر نیست');
 return {sides,radius,angle:((angle%360)+360)%360,center:{x:center.x,y:center.y}};
}
export function regularPolygon(input){
 const settings=polygonSettings(input),{sides,radius,angle,center}=settings,theta=angle*Math.PI/180;
 const points=Array.from({length:sides},(_,i)=>({x:center.x+radius*Math.cos(theta+i*2*Math.PI/sides),y:center.y+radius*Math.sin(theta+i*2*Math.PI/sides)}));
 if(points.some(p=>Math.max(Math.abs(p.x),Math.abs(p.y))>1e6))throw Error('چندضلعی خارج از محدوده مختصات است');
 const sideLength=2*radius*Math.sin(Math.PI/sides);
 return {settings,points,segments:points.map((a,i)=>({kind:'line',a,b:points[(i+1)%sides]})),sideLength,perimeter:sides*sideLength,apothem:radius*Math.cos(Math.PI/sides),area:sides*radius**2*Math.sin(2*Math.PI/sides)/2};
}
export function installPolygonTool({create,message}){
 const button=document.querySelector('[data-nctool="polygon"]');button.disabled=false;button.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 8 5v8l-8 5-8-5V8Z"/></svg><span>Polygon</span>';
 const fields=document.createElement('div');fields.id='ncPolygonOptions';fields.hidden=true;fields.innerHTML='<div class="ncPanelTitle">Regular polygon · XZ</div><label>Sides<input id="ncPolygonSides" type="number" min="3" max="64" step="1" value="6" aria-label="Polygon sides"></label><label>Circumradius · mm<input id="ncPolygonRadius" type="number" min="0.01" max="10000" step="any" value="20" aria-label="Polygon radius"></label><label>Angle · °<input id="ncPolygonAngle" type="number" step="any" value="0" aria-label="Polygon angle"></label><div class="ncPolygonCenter"><label>Center X<input id="ncPolygonX" type="number" step="any" value="0"></label><label>Center Z<input id="ncPolygonZ" type="number" step="any" value="0"></label></div><p id="ncPolygonMetrics"></p><button class="ncBtn" id="ncPolygonCreate">Create polygon</button><p class="ncPolygonHint">Drag center → vertex with pen/mouse, or pick center then vertex.</p>';button.after(fields);
 const style=document.createElement('style');style.textContent='#ncPolygonOptions{padding:8px 7px;border:1px solid #e0e8f1;border-radius:7px;background:#f8faff;margin:3px 0 6px;direction:ltr}#ncPolygonOptions[hidden]{display:none!important}#ncPolygonOptions .ncBtn:disabled{display:flex!important;opacity:.4}#ncPolygonOptions label{display:block;font:10px Arial;color:#718397;margin-top:6px}#ncPolygonOptions input{box-sizing:border-box;width:100%;padding:7px 5px;background:white;border:1px solid #d6e0ed;border-radius:5px;color:#354d69;font-size:12px;margin-top:3px}#ncPolygonOptions .ncPolygonCenter{display:flex;gap:6px}#ncPolygonOptions .ncPolygonCenter label{min-width:0;flex:1}#ncPolygonOptions .ncPanelTitle{font-size:9px;margin:2px 0 7px;letter-spacing:.6px}#ncPolygonMetrics,.ncPolygonHint{font:10px/1.6 Arial;color:#8b98a8;margin:8px 0}#ncPolygonOptions #ncPolygonCreate{justify-content:center;background:#e8f1ff!important;color:#1769e0!important;min-height:36px}';document.head.append(style);
 const $=id=>document.getElementById(id);let saved=polygonSettings();
 const raw=()=>({sides:Number($('ncPolygonSides').value),radius:Number($('ncPolygonRadius').value),angle:Number($('ncPolygonAngle').value),center:{x:Number($('ncPolygonX').value),y:Number($('ncPolygonZ').value)}});
 function read(){return polygonSettings(raw())}
 function metrics(){try{const p=regularPolygon(raw());saved=p.settings;$('ncPolygonMetrics').textContent=`Side ${p.sideLength.toFixed(3)} mm · apothem ${p.apothem.toFixed(3)} mm · area ${p.area.toFixed(3)} mm²`;$('ncPolygonCreate').disabled=false}catch(error){$('ncPolygonMetrics').textContent=error.message;$('ncPolygonCreate').disabled=true}}
 function set(input){const s=polygonSettings(input);saved=s;for(const [id,value]of [['ncPolygonSides',s.sides],['ncPolygonRadius',s.radius],['ncPolygonAngle',s.angle],['ncPolygonX',s.center.x],['ncPolygonZ',s.center.y]])$(id).value=value;metrics()}
 for(const input of fields.querySelectorAll('input'))input.addEventListener('input',metrics);
 $('ncPolygonCreate').onclick=()=>{try{create(read())}catch(error){message(error.message)}};
 metrics();return {read,get:()=>structuredClone(saved),set,show:active=>fields.hidden=!active};
}
