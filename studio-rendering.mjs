// Display-only studio setup. Helpers live outside the document/export group.
export function installStudioRendering({THREE,scene,renderer,grid,mat,selectedMat,getItems,getSelected}){
 renderer.shadowMap.autoUpdate=false;renderer.shadowMap.needsUpdate=true;
 renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.18;
 scene.background=new THREE.Color(0xf1f3f5);
 for(const child of [...scene.children])if(child.isLight)scene.remove(child);
 scene.add(new THREE.HemisphereLight(0xffffff,0x98a1ad,2.4));
 const key=new THREE.DirectionalLight(0xffffff,3.2);key.position.set(-80,150,100);key.castShadow=true;key.shadow.mapSize.set(1024,1024);key.shadow.bias=-.00015;key.shadow.normalBias=.08;key.shadow.radius=3;scene.add(key);scene.add(key.target);
 const fill=new THREE.DirectionalLight(0xf4f7ff,1.1);fill.position.set(100,60,-80);scene.add(fill);
 mat.color.set(0xb9c1ca);mat.metalness=.06;mat.roughness=.52;
 selectedMat.color.set(0x8ec9f1);selectedMat.metalness=.06;selectedMat.roughness=.5;
 grid.material.color.set(0xcbd2dc);grid.material.opacity=.28;grid.material.toneMapped=false;
 const helpers=new THREE.Group();helpers.name='Display helpers';helpers.userData.displayOnly=true;scene.add(helpers);
 const floor=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.ShadowMaterial({color:0x66788c,opacity:.17,depthWrite:false}));floor.rotation.x=-Math.PI/2;floor.receiveShadow=true;floor.userData.displayOnly=true;helpers.add(floor);
 const outlines=new Map();let lastScene=null,activeUntil=performance.now()+1500,lastRender=0;
 const wake=()=>{activeUntil=performance.now()+800};
 for(const type of ['pointerdown','pointerup','pointermove','wheel','keydown','input','resize'])window.addEventListener(type,wake,{passive:true,capture:true});
 renderer.domElement.addEventListener('webglcontextrestored',()=>{renderer.shadowMap.needsUpdate=true;key.shadow.needsUpdate=true;wake()});

 function remove(mesh,line){helpers.remove(line);line.geometry.dispose();line.material.dispose();outlines.delete(mesh)}
 function sync(){
  const items=getItems(),live=new Set(items.map(o=>o.mesh));
  for(const [mesh,line] of outlines)if(!live.has(mesh)||line.userData.geometry!==mesh.geometry)remove(mesh,line);
  const box=new THREE.Box3();
  for(const object of items){const mesh=object.mesh;mesh.castShadow=true;mesh.receiveShadow=true;
   if(!outlines.has(mesh)){const line=new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry,32),new THREE.LineBasicMaterial({color:0x536171,transparent:true,opacity:.3,depthWrite:false}));line.userData.geometry=mesh.geometry;line.userData.displayOnly=true;line.matrixAutoUpdate=false;line.renderOrder=2;outlines.set(mesh,line);helpers.add(line)}
   box.expandByObject(mesh);
  }
  const signature=items.map(o=>o.mesh.uuid+o.mesh.geometry.uuid+o.mesh.matrixWorld.elements.join(',')).join('|');
  if(signature===lastScene)return;lastScene=signature;wake();renderer.shadowMap.needsUpdate=true;key.shadow.needsUpdate=true;
  floor.visible=!!items.length;
  if(items.length){const center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3()),span=Math.max(80,size.length());floor.position.set(center.x,box.min.y-.04,center.z);floor.scale.setScalar(span*5);key.position.copy(center).add(new THREE.Vector3(-1,2,1.5).multiplyScalar(span));key.target.position.copy(center);Object.assign(key.shadow.camera,{left:-span,right:span,top:span,bottom:-span,near:.1,far:span*8});key.shadow.camera.updateProjectionMatrix()}
 }
 function update(){
  const selected=getSelected(),sub=(document.body.dataset.ncSubselection==='true'||document.body.dataset.ncPointselection==='true');selectedMat.color.set(sub?0xb9c1ca:0x8ec9f1);
  for(const [mesh,line] of outlines){mesh.updateMatrixWorld(true);line.matrix.copy(mesh.matrixWorld);line.visible=mesh.visible&&!!mesh.parent;const active=selected?.mesh===mesh&&!sub;line.material.color.set(active?0x338add:0x536171);line.material.opacity=active?.65:.3}
 }
 sync();const timer=setInterval(sync,200);return {update,needsRender(time){if(time-lastRender<(time<activeUntil?1000/45:250))return false;lastRender=time;return true},destroy(){clearInterval(timer);for(const [mesh,line] of outlines)remove(mesh,line);floor.geometry.dispose();floor.material.dispose();scene.remove(helpers,key,key.target,fill)}};
}
