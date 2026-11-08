// Exact CAD subshape interaction. Display proxies never become document geometry.
function installDirectModeling({ THREE, canvas, camera, controls, scene, context, enterSelect, selectBody, regionAt, request, commit, setBusy, message }) {
  const ray = new THREE.Raycaster(), pointer = new THREE.Vector2(), layer = new THREE.Group();
  scene.add(layer);
  let filter = "auto", selection = null, cache = null, epoch = 0, gesture = null, applying = false, lastBody = null;
  const touches = /* @__PURE__ */ new Map();
  const bar = document.createElement("div");
  bar.id = "ncSelectionFilter";
  bar.setAttribute("role", "group");
  bar.setAttribute("aria-label", "Selection filter");
  bar.innerHTML = "<span>Select</span>" + ["auto", "body", "face", "edge"].map((kind) => `<button id="ncPick${kind[0].toUpperCase() + kind.slice(1)}" data-pick="${kind}" aria-pressed="${kind === filter}">${kind[0].toUpperCase() + kind.slice(1)}</button>`).join("");
  document.body.append(bar);
  const panel = document.createElement("aside");
  panel.id = "ncTopologyPanel";
  panel.hidden = true;
  panel.setAttribute("aria-label", "CAD face or edge");
  panel.innerHTML = '<div class="ncTopoCaption">CAD SELECTION</div><strong id="ncTopologyTitle"></strong><p id="ncTopologyInfo"></p><label id="ncFaceDistanceLabel">Distance · mm<input id="ncFaceDistance" type="number" step="0.1" value="0" aria-label="Face pull distance"></label><p id="ncTopologyHint"></p><div class="ncTopoActions"><button id="ncApplyFace">Apply</button><button id="ncCancelFace">Cancel</button></div>';
  document.body.append(panel);
  const handle = document.createElement("button");
  handle.id = "ncFaceGizmo";
  handle.hidden = true;
  handle.setAttribute("aria-label", "Drag selected face");
  handle.innerHTML = '<span style="display:block">↥</span>';
  document.body.append(handle);
  const style = document.createElement("style");
  style.textContent = `
 #ncSelectionFilter{position:fixed;top:74px;left:50%;transform:translateX(-50%);display:flex;align-items:center;gap:3px;padding:4px;background:#ffffffed;border:1px solid #e0e6ee;border-radius:8px;z-index:64;font:11px -apple-system,Arial;color:#8590a0;direction:ltr;box-shadow:0 2px 12px #25364a08}#ncSelectionFilter>span{padding:0 7px}#ncSelectionFilter button{border:0;border-radius:5px;background:transparent;color:#566579;font:500 11px -apple-system,Arial;min-height:34px;padding:6px 10px;cursor:pointer}#ncSelectionFilter button[aria-pressed=true]{background:#e7f0fe;color:#1769e0}#ncSelectionFilter button:focus-visible,#ncTopologyPanel button:focus-visible{outline:2px solid #1769e0}body[data-nc-subselection=true] #ncInspector{display:none!important}
 #ncTopologyPanel{position:fixed;right:20px;top:326px;width:210px;box-sizing:border-box;padding:16px;background:#fff;border:1px solid #e0e6ee;border-radius:10px;box-shadow:0 4px 20px #24364a0a;z-index:67;font:12px -apple-system,Arial;color:#40516a;direction:ltr}#ncTopologyPanel[hidden],#ncFaceGizmo[hidden],#ncFaceDistanceLabel[hidden]{display:none!important}.ncTopoCaption{font-size:9px;color:#8e9aaa;letter-spacing:1.4px;margin-bottom:10px}#ncTopologyPanel p{font-size:11px;color:#8491a2;line-height:1.7;margin:10px 0}#ncTopologyPanel input{box-sizing:border-box;width:100%;margin-top:6px;padding:9px;border:1px solid #b7ccef;border-radius:6px;background:#fbfcfe;font-size:14px;color:#294568}#ncTopologyPanel label{display:block;font-size:11px;color:#7c8c9f}.ncTopoActions{display:flex;gap:6px;margin-top:12px}.ncTopoActions button{flex:1;min-height:40px;border:1px solid #dde4ee;border-radius:6px;background:#fff;color:#607088;cursor:pointer}#ncApplyFace{background:#1769e0;color:white;border-color:#1769e0}#ncApplyFace:disabled{opacity:.4}#ncFaceGizmo{position:fixed;z-index:80;width:38px;height:48px;border:3px solid white;border-radius:8px;background:#1769e0;color:white;font-size:27px;box-shadow:0 2px 10px #1769e044;touch-action:none;cursor:ns-resize;transform:translate(-50%,-110%);user-select:none}
 @media(max-width:850px){#ncSelectionFilter{top:67px;left:47%}#ncTopologyPanel{right:12px;top:310px;width:180px}}@media(max-width:600px){#ncSelectionFilter{top:63px;left:46%;font-size:10px}#ncSelectionFilter>span{display:none}#ncSelectionFilter button{padding:5px 7px;font-size:10px}#ncTopologyPanel{top:auto;bottom:84px;right:8px;width:165px;padding:12px}}
 `;
  document.head.append(style);
  const $ = (id) => document.getElementById(id), amount = $("ncFaceDistance");
  function dispose(object) {
    object.geometry?.dispose();
    object.material?.dispose();
  }
  function release() {
    if (gesture) {
      const id = gesture.id;
      gesture = null;
      try {
        canvas.releasePointerCapture(id);
      } catch {
      }
      controls.enabled = true;
    }
  }
  function clear() {
    ++epoch;
    release();
    uncache();
    selection = null;
    for (const object of [...layer.children]) {
      layer.remove(object);
      dispose(object);
    }
    panel.hidden = true;
    handle.hidden = true;
    delete document.body.dataset.ncSubselection;
    amount.value = "0";
  }
  function snapshot(object) {
    object.mesh.updateMatrixWorld(true);
    return object.mesh.uuid + ":" + object.mesh.matrixWorld.elements.join(",");
  }
  function current(object, key) {
    const c = context();
    return c.selected === object && c.items.includes(object) && snapshot(object) === key;
  }
  function setupRay(e) {
    const rect = canvas.getBoundingClientRect();
    pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
    ray.setFromCamera(pointer, camera);
  }
  function bodyHit(e) {
    setupRay(e);
    return ray.intersectObjects(context().items.filter((o) => o.mesh.visible).map((o) => o.mesh), false)[0];
  }
  function nearBody(e) {
    if (filter === "face") return null;
    const rect = canvas.getBoundingClientRect(), candidates = [];
    for (const object of context().items) {
      if (!object.mesh.visible) continue;
      const box = new THREE.Box3().setFromObject(object.mesh), points = [];
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) points.push(new THREE.Vector3(x, y, z).project(camera));
      if (points.every((p) => p.z > 1 || p.z < -1)) continue;
      const xs = points.map((p) => rect.left + (p.x + 1) * rect.width / 2), ys = points.map((p) => rect.top + (1 - p.y) * rect.height / 2);
      if (e.clientX >= Math.min(...xs) - 9 && e.clientX <= Math.max(...xs) + 9 && e.clientY >= Math.min(...ys) - 9 && e.clientY <= Math.max(...ys) + 9) candidates.push({ object: object.mesh, distance: camera.position.distanceTo(box.getCenter(new THREE.Vector3())) });
    }
    return candidates.sort((a, b) => a.distance - b.distance)[0];
  }
  function proxy(face) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(face.positions, 3));
    g.setIndex(face.indices);
    g.computeVertexNormals();
    return new THREE.Mesh(g, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, color: 2526207, transparent: true, opacity: 0.38, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
  }
  function edgeProxy(edge) {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.Float32BufferAttribute(edge.positions, 3));
    return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 16752934, depthTest: false, linewidth: 3 }));
  }
  function uncache() {
    if (cache) {
      for (const o of [...cache.faces, ...cache.edges]) dispose(o);
      cache = null;
    }
  }
  async function topology(object, key, ticket) {
    if (cache?.object === object && cache.key === key) return cache;
    uncache();
    const data = await (await request("/topology", context().node(object))).json();
    if (ticket !== epoch || !current(object, key)) throw Error("انتخاب تغییر کرد؛ دوباره وجه را انتخاب کنید");
    const faces = data.faces.map((f) => {
      const m = proxy(f);
      m.userData.cadFace = f;
      return m;
    }), edges = data.edges.map((e) => {
      const m = edgeProxy(e);
      m.userData.cadEdge = e;
      return m;
    });
    return cache = { object, key, data, faces, edges };
  }
  function pickTopology(e, cached, body) {
    setupRay(e);
    const face = ray.intersectObjects(cached.faces, false)[0];
    if (!face && filter === "face") return null;
    const depth = face ? camera.position.distanceTo(face.point) : camera.position.distanceTo(new THREE.Box3().setFromObject(cached.object.mesh).getCenter(new THREE.Vector3())), unit = 2 * depth * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / canvas.clientHeight / camera.zoom;
    ray.params.Line.threshold = unit * 9;
    const edge = ray.intersectObjects(cached.edges, false).find((hit) => {
      if (face) return hit.distance <= face.distance + unit * 10;
      const projected = hit.point.clone().project(camera), visibility = new THREE.Raycaster();
      visibility.setFromCamera(new THREE.Vector2(projected.x, projected.y), camera);
      const blocker = visibility.intersectObjects(context().items.map((o) => o.mesh), false)[0];
      return !blocker || blocker.distance >= camera.position.distanceTo(hit.point) - unit;
    });
    if (filter === "edge") return edge ? { kind: "edge", data: edge.object.userData.cadEdge, point: edge.point } : null;
    if (filter === "auto" && edge) return { kind: "edge", data: edge.object.userData.cadEdge, point: edge.point };
    return face ? { kind: "face", data: face.object.userData.cadFace, point: face.point } : null;
  }
  function render() {
    if (!selection) return;
    const face = selection.kind === "face", canPull = face && selection.data.kind === "PLANE";
    panel.hidden = false;
    document.body.dataset.ncSubselection = "true";
    $("ncTopologyTitle").textContent = (face ? "Face " : "Edge ") + (selection.data.index + 1);
    $("ncTopologyInfo").textContent = selection.data.kind + " · " + Number(face ? selection.data.area : selection.data.length).toFixed(3) + (face ? " mm²" : " mm");
    $("ncFaceDistanceLabel").hidden = !canPull;
    $("ncApplyFace").hidden = !canPull;
    $("ncApplyFace").disabled = applying || !Number.isFinite(Number(amount.value)) || Math.abs(Number(amount.value)) < 0.01;
    $("ncTopologyHint").textContent = canPull ? "Drag this face or its arrow. Positive adds material; negative removes it." : face ? "Curved face selected. Direct pulling currently requires a planar face." : "Exact CAD edge selected. Orange highlight follows the original curve.";
    amount.disabled = applying;
    positionHandle();
  }
  function positionHandle() {
    if (!selection || selection.kind !== "face" || selection.data.kind !== "PLANE") {
      handle.hidden = true;
      return;
    }
    const p = selection.point.clone().addScaledVector(new THREE.Vector3(...selection.data.normal), Number(amount.value) || 0).project(camera), rect = canvas.getBoundingClientRect();
    const q = selection.point.clone().addScaledVector(new THREE.Vector3(...selection.data.normal), 10).project(camera), origin = selection.point.clone().project(camera), dx = (q.x - origin.x) * rect.width / 2, dy = -(q.y - origin.y) * rect.height / 2;
    handle.firstElementChild.style.transform = Math.hypot(dx, dy) > 10 ? "rotate(" + (Math.atan2(dy, dx) + Math.PI / 2) + "rad)" : "";
    handle.hidden = p.z < -1 || p.z > 1;
    handle.style.left = Math.max(20, Math.min(innerWidth - 20, rect.left + (p.x + 1) * rect.width / 2)) + "px";
    handle.style.top = Math.max(125, Math.min(innerHeight - 85, rect.top + (1 - p.y) * rect.height / 2)) + "px";
  }
  function show(pick2, object, key, cached) {
    for (const child of [...layer.children]) {
      layer.remove(child);
      dispose(child);
    }
    selection = { ...pick2, object, key, brep: cached.data.brep };
    amount.value = "0";
    const visual = pick2.kind === "face" ? proxy(pick2.data) : edgeProxy(pick2.data);
    visual.renderOrder = 20;
    layer.add(visual);
    selection.visual = visual;
    render();
    message(pick2.kind === "face" ? "وجه CAD انتخاب شد؛ برای تغییر حجم فلش را بکشید" : "لبه CAD انتخاب شد");
  }
  async function pick(e) {
    const hit = bodyHit(e) || nearBody(e);
    if (!hit) {
      uncache();
      clear();
      selectBody(null);
      return;
    }
    const object = context().items.find((o) => o.mesh === hit.object);
    if (!object) return;
    selectBody(object);
    lastBody = object;
    if (filter === "body") {
      uncache();
      clear();
      return;
    }
    const key = snapshot(object), ticket = ++epoch;
    try {
      const cached = await topology(object, key, ticket);
      if (ticket !== epoch || !context().enabled || !current(object, key)) return;
      const picked = pickTopology(e, cached, hit);
      if (!picked) {
        clear();
        message("نزدیک یک لبهٔ قابل مشاهده بزنید");
        return;
      }
      show(picked, object, key, cached);
    } catch (error) {
      if (ticket === epoch) {
        clear();
        message("انتخاب دقیق: " + error.message);
      }
    }
  }
  function ghost() {
    if (!selection || selection.kind !== "face") return;
    selection.visual.position.copy(new THREE.Vector3(...selection.data.normal).multiplyScalar(Number(amount.value) || 0));
    render();
  }
  async function apply() {
    if (!selection || selection.kind !== "face" || selection.data.kind !== "PLANE" || applying) return;
    const chosen = selection, distance = Number(amount.value);
    if (!Number.isFinite(distance) || Math.abs(distance) < 0.01 || Math.abs(distance) > 1e4) {
      message("فاصله باید بین ۰٫۰۱ و ۱۰۰۰۰ میلی‌متر باشد");
      return;
    }
    if (!current(chosen.object, chosen.key)) {
      uncache();
      clear();
      message("قطعه تغییر کرده است؛ وجه را دوباره انتخاب کنید");
      return;
    }
    const ticket = ++epoch;
    applying = true;
    setBusy(true);
    render();
    try {
      const recipe = { type: "facePull", brep: chosen.brep, faceIndex: chosen.data.index, distance };
      const data = await (await request("/evaluate", recipe)).json();
      if (ticket !== epoch || !current(chosen.object, chosen.key)) return;
      commit(chosen.object, data, recipe);
      uncache();
      clear();
      message("وجه با هندسهٔ دقیق جابجا شد؛ Undo برای بازگشت در دسترس است");
    } catch (error) {
      if (ticket === epoch) {
        amount.value = "0";
        ghost();
        message("جابجایی انجام نشد؛ قطعه حفظ شد: " + error.message);
      }
    } finally {
      applying = false;
      setBusy(false);
      render();
    }
  }
  function startDrag(e) {
    if (!selection || selection.kind !== "face" || selection.data.kind !== "PLANE" || applying) return;
    const a = selection.point.clone().project(camera), b = selection.point.clone().addScaledVector(new THREE.Vector3(...selection.data.normal), 10).project(camera), rect = canvas.getBoundingClientRect();
    let dx = (b.x - a.x) * rect.width / 2, dy = -(b.y - a.y) * rect.height / 2, length = Math.hypot(dx, dy), unit;
    if (length < 10) {
      dx = 0;
      dy = -1;
      unit = 2 * camera.position.distanceTo(selection.point) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / rect.height / camera.zoom;
    } else {
      dx /= length;
      dy /= length;
      unit = 10 / length;
    }
    gesture = { id: e.pointerId, x: e.clientX, y: e.clientY, dx, dy, unit, initial: Number(amount.value) || 0, moved: false };
    controls.enabled = false;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {
    }
    e.preventDefault();
    e.stopImmediatePropagation();
  }
  bar.querySelectorAll("button").forEach((button) => button.onclick = () => {
    if (applying) return;
    uncache();
    clear();
    filter = button.dataset.pick;
    bar.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
    enterSelect();
  });
  amount.addEventListener("input", ghost);
  $("ncApplyFace").onclick = apply;
  $("ncCancelFace").onclick = () => {
    uncache();
    clear();
    message("انتخاب لغو شد؛ قطعه حفظ شد");
  };
  handle.addEventListener("pointerdown", startDrag);
  document.addEventListener("pointerdown", (e) => {
    if (e.target !== canvas || !context().enabled || e.button !== 0) return;
    if (e.pointerType === "touch") {
      for (const t of touches.values()) t.multi = true;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY, multi: touches.size > 0 });
      return;
    }
    if (!["mouse", "pen"].includes(e.pointerType) || regionAt(e)) return;
    if (filter === "body") return;
    if (selection?.kind === "face" && cache && current(selection.object, selection.key)) {
      const same = pickTopology(e, cache);
      if (same?.kind === "face" && same.data.index === selection.data.index) {
        startDrag(e);
        return;
      }
    }
    pick({ clientX: e.clientX, clientY: e.clientY });
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);
  document.addEventListener("pointermove", (e) => {
    const touch = touches.get(e.pointerId);
    if (touch && Math.hypot(e.clientX - touch.x, e.clientY - touch.y) > 10) touch.moved = true;
    if (!gesture || gesture.id !== e.pointerId) return;
    const dx = e.clientX - gesture.x, dy = e.clientY - gesture.y;
    gesture.moved ||= Math.hypot(dx, dy) > 3;
    amount.value = (gesture.initial + (dx * gesture.dx + dy * gesture.dy) * gesture.unit).toFixed(2);
    ghost();
    e.preventDefault();
    e.stopImmediatePropagation();
  }, true);
  document.addEventListener("pointerup", (e) => {
    if (gesture?.id === e.pointerId) {
      const moved = gesture.moved;
      release();
      if (moved) apply();
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    const touch = touches.get(e.pointerId);
    touches.delete(e.pointerId);
    if (touch && !touch.multi && !touch.moved && context().enabled && !regionAt(e) && filter !== "body") pick({ clientX: e.clientX, clientY: e.clientY });
  }, true);
  for (const type of ["pointercancel", "lostpointercapture"]) document.addEventListener(type, (e) => {
    touches.delete(e.pointerId);
    if (gesture?.id === e.pointerId) {
      release();
      amount.value = "0";
      ghost();
    }
  }, true);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && selection) {
      uncache();
      clear();
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);
  controls.addEventListener("change", positionHandle);
  const timer = setInterval(() => {
    const c = context();
    bar.hidden = c.busy;
    bar.style.display = c.busy ? "none" : "flex";
    if (selection && (!current(selection.object, selection.key) || !c.enabled && !applying)) {
      uncache();
      clear();
    }
    if (c.selected !== lastBody && !applying) {
      lastBody = c.selected;
      if (selection && selection.object !== c.selected) {
        uncache();
        clear();
      }
    }
  }, 200);
  return { get active() {
    return !!selection;
  }, cancel() {
    uncache();
    clear();
  }, destroy() {
    clearInterval(timer);
    uncache();
    clear();
    scene.remove(layer);
  } };
}
export {
  installDirectModeling
};
