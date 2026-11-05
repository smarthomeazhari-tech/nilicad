import * as r from 'replicad';

export function createKernel(oc) {
 r.setOC(oc);
 let owned=[];
 const own=value=>{owned.push(value);return value};
 const finite=value=>{const n=Number(value);if(!Number.isFinite(n)||Math.abs(n)>1e6)throw Error('مختصات نامعتبر است');return n};
 const point=p=>[finite(p.x),0,finite(p.y)];
 const valid=shape=>{const check=own(new oc.BRepCheck_Analyzer(shape.wrapped,true));if(shape.isNull||!check.IsValid())throw Error('هندسه OCCT معتبر نیست');return shape};
 const load=data=>{if(typeof data!=='string'||data.length>20000000)throw Error('داده B-Rep نامعتبر است');return valid(own(r.deserializeShape(data)))};
 function face(node){
  if(node.brep){const shape=load(node.brep);const faces=shape instanceof r.Face?[shape]:shape.faces.map(own);if(faces.length!==1)throw Error('یک سطح مسطح لازم است');const f=faces[0];if(f.geomType!=='PLANE')throw Error('سطح باید مسطح باشد');return f}
  let edges;
  if(node.circle){const radius=finite(node.circle.r);if(radius<=0)throw Error('شعاع باید مثبت باشد');edges=[own(r.makeCircle(radius,point(node.circle.center),[0,1,0]))]}
  else {if(!Array.isArray(node.segments)||node.segments.length<2||node.segments.length>2000)throw Error('مسیر بسته معتبر لازم است');edges=node.segments.map(seg=>{if(seg.kind==='line')return own(r.makeLine(point(seg.a),point(seg.b)));if(seg.kind==='arc')return own(r.makeThreePointArc(point(seg.a),point(seg.m),point(seg.b)));throw Error('نوع منحنی پشتیبانی نمی‌شود')})}
  return valid(own(r.makeFace(own(r.assembleWire(edges)))));
 }
 function extrude(profile,depth){depth=finite(depth);if(Math.abs(depth)<.01||Math.abs(depth)>10000)throw Error('عمق باید بین ۰٫۰۱ و ۱۰۰۰۰ میلی‌متر باشد');return valid(own(r.basicFaceExtrusion(profile,own(new r.Vector([0,depth,0])))))}
 function transform(shape,m){
  if(!Array.isArray(m)||m.length!==16)throw Error('ماتریس نامعتبر است');m=m.map(finite);if([3,7,11].some(i=>Math.abs(m[i])>1e-9)||Math.abs(m[15]-1)>1e-9)throw Error('ماتریس affine لازم است');
  // gp_Trsf supports rigid and uniform scale transforms. Reject unsupported shear/scale.
  const columns=[[m[0],m[1],m[2]],[m[4],m[5],m[6]],[m[8],m[9],m[10]]],lengths=columns.map(v=>Math.hypot(...v));
  if(Math.min(...lengths)<1e-9||lengths.some(v=>Math.abs(v-lengths[0])>1e-6)||columns.some((a,i)=>columns.some((b,j)=>i<j&&Math.abs(a.reduce((n,x,k)=>n+x*b[k],0))>1e-6)))throw Error('موتور مرورگر فعلاً مقیاس غیریکنواخت و shear را پشتیبانی نمی‌کند');
  const tr=own(new oc.gp_Trsf());tr.SetValues(m[0],m[4],m[8],m[12],m[1],m[5],m[9],m[13],m[2],m[6],m[10],m[14]);const builder=own(new oc.BRepBuilderAPI_Transform(shape.wrapped,tr,true));return own(r.cast(builder.Shape()));
 }
 function make(node,level=0){
  if(!node||level>40)throw Error('تاریخچه هندسی نامعتبر است');
  if(node.op==='transform')return transform(make(node.shape,level+1),node.transform);
  if(node.op){const a=make(node.left,level+1),b=make(node.right,level+1);if(node.op==='union')return own(a.fuse(b));if(node.op==='subtract')return own(a.cut(b));if(node.op==='intersect')return own(a.intersect(b));throw Error('عملیات پشتیبانی نمی‌شود')}
  let shape;
  if(node.type==='brep')shape=load(node.brep);
  else if(node.type==='profile')shape=extrude(face(node),node.depth);
  else {
   const d=node.dims||{},x=finite(d.x??40),y=finite(d.y??30),z=finite(d.z??20);if(Math.min(x,y,z)<=0)throw Error('ابعاد باید مثبت باشد');
   switch(node.type){
    case 'box':case 'extrudeRect':shape=own(r.makeBox([-x/2,-z/2,-y/2],[x/2,z/2,y/2]));break;
    case 'cylinder':case 'extrudeCircle':shape=own(r.makeCylinder(x/2,z,[0,-z/2,0],[0,1,0]));break;
    case 'sphere':shape=own(r.makeSphere(x/2));break;
    case 'hexPrism':{const pts=Array.from({length:6},(_,i)=>({x:x/2*Math.cos(i*Math.PI/3),y:x/2*Math.sin(i*Math.PI/3)}));const f=face({segments:pts.map((a,i)=>({kind:'line',a,b:pts[(i+1)%6]}))});shape=own(extrude(f,z).translateY(-z/2));break;}
    case 'cone':{const pts=[[0,-z/2,0],[x/2,-z/2,0],[0,z/2,0]],edges=pts.map((a,i)=>own(r.makeLine(a,pts[(i+1)%3]))),f=own(r.makeFace(own(r.assembleWire(edges))));shape=own(r.revolution(f,[0,0,0],[0,1,0]));break;}
    default:throw Error('هندسه دقیق این قطعه پشتیبانی نمی‌شود');
   }
  }
  return node.transform?transform(shape,node.transform):shape;
 }
 function mesh(shape){const data=shape.mesh({tolerance:.05,angularTolerance:.1});return {positions:Array.from(data.vertices),indices:Array.from(data.triangles)}}
 function result(shape){valid(shape);const solids=shape.solids.map(own);return {...mesh(shape),brep:shape.serialize(),volume:solids.length?Math.abs(r.measureVolume(shape)):0,solids:solids.length,valid:true}}
 function split(nodes){
  if(!Array.isArray(nodes)||!nodes.length||nodes.length>100)throw Error('بین ۱ و ۱۰۰ پروفیل لازم است');
  const sources=nodes.map(face);let faces=sources;
  if(sources.length>1){const list=own(new oc.NCollection_List_TopoDS_Shape());for(const f of sources)list.Append(f.wrapped);const builder=own(new oc.BRepAlgoAPI_Splitter());builder.SetArguments(list);builder.SetNonDestructive(true);builder.Build();if(!builder.IsDone())throw Error('تقسیم نواحی انجام نشد');const shape=own(r.cast(builder.Shape()));faces=shape.faces.map(own)}
  const regions=[];
  for(const f of faces){const area=r.measureArea(f);if(area<1e-8)continue;const data=mesh(f),triangle=data.indices.slice(0,3),p=[0,1,2].map(axis=>triangle.reduce((sum,i)=>sum+data.positions[i*3+axis],0)/3),vertex=own(r.makeVertex(p));const sourcesForFace=sources.flatMap((source,i)=>r.measureDistanceBetween(source,vertex)<1e-6?[i]:[]);const owner=sourcesForFace.reduce((best,i)=>best===null||r.measureArea(sources[i])<r.measureArea(sources[best])?i:best,null);regions.push({...data,brep:f.serialize(),area,sources:sourcesForFace,owner})}
  return {regions};
 }
 async function handle(path,payload){
  owned=[];
  try{
   if(path==='/health')return {ok:true,kernel:'Open CASCADE WebAssembly',mode:'browser',features:['regions','extrude','boolean','step']};
   if(path==='/evaluate')return result(make(payload));
   if(path==='/regions')return split(payload.profiles);
   if(path==='/export-step'){
    if(!Array.isArray(payload.objects)||!payload.objects.length||payload.objects.length>100)throw Error('بین ۱ و ۱۰۰ قطعه لازم است');
    const shapes=payload.objects.map(node=>({shape:own(make(node).rotate(90,[0,0,0],[1,0,0]))}));const blob=r.exportSTEP(shapes,{unit:'MM',modelUnit:'MM'});return {binary:await blob.arrayBuffer(),type:'model/step'};
   }
   if(/^\/import-cad\/(step|stp)$/.test(path)){if(payload.byteLength>20000000)throw Error('حداکثر حجم فایل ۲۰ مگابایت است');const shape=own(await r.importSTEP(new Blob([payload])));return result(own(shape.rotate(-90,[0,0,0],[1,0,0])))}
   if(path.includes('iges')||/\/import-cad\/(iges|igs)$/.test(path))throw Error('IGES در موتور مرورگر موجود نیست؛ برای تبادل CAD از STEP استفاده کنید');
   throw Error('این عملیات در موتور مرورگر پشتیبانی نمی‌شود');
  }finally{for(const value of owned.reverse()){try{value.delete()}catch{}}owned=[]}
 }
 return {handle};
}
