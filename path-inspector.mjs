function installPathInspector({ THREE, canvas, camera, controls, scene, context, request, selectBody, message }) {
  const ray = new THREE.Raycaster(), pointer = new THREE.Vector2(), layer = new THREE.Group();
  layer.userData.displayOnly = true;
  scene.add(layer);
  let epoch = 0, selected = null, sketchCache = null, bodyCache = null, timerInput = null, pending = false;
  const touches = /* @__PURE__ */ new Map();
  const panel = document.createElement("aside");
  panel.id = "ncPointPanel";
  panel.hidden = true;
  panel.setAttribute("aria-label", "Path point technical properties");
  panel.innerHTML = '<div class="ncPointCaption">POINT INSPECTION · mm</div><strong id="ncPointSource"></strong><label>Parameter t · 0–1<input id="ncPointT" type="number" min="0" max="1" step="any" value="0" aria-label="Normalized curve parameter"></label><div class="ncPointActions"><button id="ncPointGo">Inspect</button><button id="ncPointExport">Export point</button><button id="ncPointClose">×</button></div><div id="ncPointProperties"></div>';
  document.body.append(panel);
  const style = document.createElement("style");
  style.textContent = `body[data-nc-pointselection=true] #ncInspector{display:none!important}#ncPointPanel{position:fixed;right:20px;top:326px;width:260px;padding:14px;box-sizing:border-box;border:1px solid #dce5ef;background:#fff;border-radius:10px;z-index:69;font:11px -apple-system,Arial;color:#485a71;direction:ltr;box-shadow:0 4px 20px #24364a0a}#ncPointPanel[hidden]{display:none!important}.ncPointCaption{font-size:9px;letter-spacing:1px;color:#8b99aa;margin-bottom:9px}#ncPointPanel strong{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:12px;margin-bottom:10px}#ncPointPanel label{display:block;color:#8392a5;font-size:10px}#ncPointT{box-sizing:border-box;width:100%;padding:8px;margin-top:5px;border:1px solid #b9cfed;border-radius:5px;color:#3e5875;background:#fbfcfe}.ncPointActions{display:flex;gap:5px;margin:9px 0}.ncPointActions button{min-height:36px;padding:6px 8px;border:1px solid #dce5ef;background:#f7faff;border-radius:5px;color:#3577bc;cursor:pointer;font-size:10px}#ncPointProperties{max-height:calc(100dvh - 530px);overflow:auto;min-height:110px}#ncPointProperties dl{margin:0;display:grid;grid-template-columns:1fr 1.3fr;gap:7px 9px;font-size:10px;line-height:1.6}#ncPointProperties dt{color:#8795a8}#ncPointProperties dd{margin:0;overflow-wrap:anywhere;font-variant-numeric:tabular-nums}#ncPointProperties p{color:#8c98a7;line-height:1.7;font-size:10px}@media(max-width:850px){#ncPointPanel{right:10px;top:310px;width:220px}#ncPointProperties{max-height:calc(100dvh - 515px)}}@media(max-width:600px){#ncPointPanel{top:auto;bottom:80px;width:210px;max-height:60dvh}#ncPointProperties{max-height:25dvh}}`;
  document.head.append(style);
  const $ = (id) => document.getElementById(id), mode = () => document.getElementById("ncPickPoint")?.getAttribute("aria-pressed") === "true";
  function dispose(object) {
    object.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
  }
  function cleanLayer() {
    for (const o of [...layer.children]) {
      layer.remove(o);
      dispose(o);
    }
  }
  function clear() {
    ++epoch;
    clearTimeout(timerInput);
    selected = null;
    pending = false;
    touches.clear();
    $("ncPointExport").disabled = true;
    cleanLayer();
    panel.hidden = true;
    delete document.body.dataset.ncPointselection;
  }
  function meshKey(object) {
    object.mesh.updateMatrixWorld(true);
    return object.mesh.uuid + ":" + object.mesh.matrixWorld.elements.join(",");
  }
  function valid(source) {
    const c = context();
    if (!mode() || !c.enabled) return false;
    return source.object ? c.items.includes(source.object) && meshKey(source.object) === source.key : c.sketches().signature === source.key;
  }
  function setup(e) {
    const rect = canvas.getBoundingClientRect();
    pointer.set((e.clientX - rect.left) / rect.width * 2 - 1, -(e.clientY - rect.top) / rect.height * 2 + 1);
    ray.setFromCamera(pointer, camera);
  }
  function candidate(e) {
    setup(e);
    const items = context().items, hit = ray.intersectObjects(items.filter((o) => o.mesh.visible).map((o) => o.mesh), false)[0];
    if (hit) return items.find((o) => o.mesh === hit.object);
    const rect = canvas.getBoundingClientRect();
    return items.filter((o) => {
      const b = new THREE.Box3().setFromObject(o.mesh), p = [];
      for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) p.push(new THREE.Vector3(x, y, z).project(camera));
      const xs = p.map((v) => rect.left + (v.x + 1) * rect.width / 2), ys = p.map((v) => rect.top + (1 - v.y) * rect.height / 2);
      return o.mesh.visible && e.clientX >= Math.min(...xs) - 10 && e.clientX <= Math.max(...xs) + 10 && e.clientY >= Math.min(...ys) - 10 && e.clientY <= Math.max(...ys) + 10;
    }).sort((a, b) => camera.position.distanceTo(a.mesh.position) - camera.position.distanceTo(b.mesh.position))[0];
  }
  function proxies(paths2, meta) {
    return paths2.map((p) => {
      const item = { ...p, ...meta };
      if (p.positions?.length) {
        const g = new THREE.BufferGeometry();
        g.setAttribute("position", new THREE.Float32BufferAttribute(p.positions, 3));
        item.proxy = new THREE.LineSegments(g, new THREE.LineBasicMaterial());
        item.proxy.userData.path = item;
      }
      return item;
    });
  }
  function drop(cache) {
    if (cache) {
      for (const p of cache.paths) if (p.proxy) dispose(p.proxy);
    }
  }
  async function paths(e, ticket) {
    const all = [], c = context(), sketch = c.sketches();
    if (sketch.profiles.length) {
      if (sketchCache?.key !== sketch.signature) {
        const data = await (await request("/paths", { profiles: sketch.profiles })).json();
        if (ticket !== epoch || !mode()) return [];
        drop(sketchCache);
        sketchCache = { key: sketch.signature, paths: proxies(data.paths, { key: sketch.signature, object: null, source: "sketch" }) };
      }
      all.push(...sketchCache.paths);
    }
    const object = candidate(e);
    if (object) {
      const key = meshKey(object);
      if (bodyCache?.object !== object || bodyCache.key !== key) {
        try {
          const data = await (await request("/topology", c.node(object))).json();
          if (ticket !== epoch || !mode() || !context().items.includes(object) || meshKey(object) !== key) return [];
          drop(bodyCache);
          bodyCache = { object, key, paths: proxies(data.edges.map((edge) => ({ ...edge, edgeIndex: edge.index, brep: data.brep })), { object, key, source: "body" }) };
        } catch (error) {
          if (!all.length) throw error;
        }
      }
      if (bodyCache?.object === object && bodyCache.key === key) all.push(...bodyCache.paths);
    }
    return all;
  }
  function visible(point) {
    const q = point.clone().project(camera), r = new THREE.Raycaster();
    r.setFromCamera(new THREE.Vector2(q.x, q.y), camera);
    const blocker = r.intersectObjects(context().items.map((o) => o.mesh), false)[0];
    return !blocker || blocker.distance >= camera.position.distanceTo(point) - 0.05;
  }
  function hitPath(e, all) {
    setup(e);
    const unit = 2 * camera.position.distanceTo(controls.target) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / canvas.clientHeight / camera.zoom;
    ray.params.Line.threshold = unit * 10;
    const hits = ray.intersectObjects(all.map((p) => p.proxy).filter(Boolean), false).filter((h) => visible(h.point)).map((h) => ({ path: h.object.userData.path, point: h.point, gap: ray.ray.distanceToPoint(h.point) / unit }));
    const rect = canvas.getBoundingClientRect();
    for (const p of all) if (p.kind === "VERTEX") {
      const point = new THREE.Vector3(...p.point), q = point.clone().project(camera), gap = Math.hypot(e.clientX - (rect.left + (q.x + 1) * rect.width / 2), e.clientY - (rect.top + (1 - q.y) * rect.height / 2));
      if (gap <= 10 && visible(point)) hits.push({ path: p, point, gap });
    }
    return hits.sort((a, b) => a.gap - b.gap)[0];
  }
  const scalar = (v) => v == null ? "Undefined" : typeof v === "boolean" ? v ? "Yes" : "No" : typeof v === "string" ? v : Math.abs(v) < 1e-12 ? "0" : Number(v).toPrecision(9);
  const vector = (v) => v ? v.map(scalar).join(", ") : "Undefined";
  function display(data, source) {
    panel.hidden = false;
    document.body.dataset.ncPointselection = "true";
    $("ncPointSource").textContent = source.object ? source.object.name + " · edge " + (source.edgeIndex + 1) : "Sketch " + (source.profileIndex + 1) + " · path " + (source.segmentIndex + 1);
    $("ncPointT").value = data.normalized;
    $("ncPointT").disabled = data.kind === "VERTEX";
    $("ncPointGo").disabled = data.kind === "VERTEX";
    const rows = [["Curve", data.kind], ["Degree", data.degree], ["Rational", data.rational], ["Control poles", data.poles], ["Knots", data.knots], ["B-Rep tolerance · mm", data.edgeTolerance], ["XYZ · mm", vector(data.point)], ["t · native normalized", data.normalized], ["Native u", data.parameter], ["u minimum", data.parameterStart], ["u maximum", data.parameterEnd], ["Total length · mm", data.totalLength], ["From u_min · mm", data.lengthFromStart], ["Remaining · mm", data.remainingLength], ["Length fraction", data.lengthFraction], ["Tangent · unit", vector(data.tangent)], ["Oriented tangent", vector(data.orientedTangent)], ["Normal · unit", vector(data.normal)], ["Binormal · unit", vector(data.binormal)], ["Curvature · 1/mm", data.curvature], ["Radius · mm", data.curvature === 0 ? "∞ · straight" : data.radius], ["Torsion · 1/mm", data.torsion], ["Curvature center", vector(data.curvatureCenter)], ["D1 · mm/u", vector(data.derivatives?.first)], ["D2 · mm/u²", vector(data.derivatives?.second)], ["D3 · mm/u³", vector(data.derivatives?.third)], ["Azimuth X→Z · °", data.azimuth], ["Elevation Y · °", data.elevation], ["Start · mm", vector(data.start)], ["End · mm", vector(data.end)], ["Closed", data.closed], ["Periodic", data.periodic], ["Period", data.period], ["Edge orientation", data.orientation], ["Regular point", data.regular], ["Derivative order", data.derivativeOrder], ["Projection gap · mm", data.projectionDistance], ["Ambiguous projection", data.ambiguous], ["Length method", data.lengthMethod], ["Length estimator converged", data.lengthConverged], ["Length target tol · mm", data.lengthTolerance]];
    $("ncPointExport").disabled = false;
    const dl = document.createElement("dl");
    for (const [label, value] of rows) {
      const dt = document.createElement("dt"), dd = document.createElement("dd");
      dt.textContent = label;
      dd.textContent = scalar(value);
      dl.append(dt, dd);
    }
    const note = document.createElement("p");
    note.textContent = "Lengths follow increasing native u. Tangents/curvature describe the selected segment; a junction may have different adjacent derivatives. Undefined values are not assigned. Geometric data only.";
    $("ncPointProperties").replaceChildren(dl, note);
    cleanLayer();
    const point = new THREE.Points(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...data.point)]), new THREE.PointsMaterial({ color: 1280492, size: 10, sizeAttenuation: false, depthTest: false }));
    point.renderOrder = 40;
    layer.add(point);
    if (data.tangent) {
      const unit = 2 * camera.position.distanceTo(new THREE.Vector3(...data.point)) * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / canvas.clientHeight / camera.zoom;
      const a = new THREE.Vector3(...data.point), b = a.clone().addScaledVector(new THREE.Vector3(...data.tangent), unit * 25);
      layer.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color: 1280492, depthTest: false })));
    }
  }
  async function inspect(source, query, ticket, baseline) {
    const payload = source.kind === "VERTEX" ? { vertex: source.point } : { brep: source.brep, ...source.source === "body" ? { edgeIndex: source.edgeIndex } : {}, ...query };
    const data = await (await request("/path-point", payload)).json();
    if (ticket !== epoch || !valid(source) || context().selected !== baseline) return;
    selectBody(source.object || null);
    selected = { source, data };
    display(data, source);
    message("مشخصات نقطه از هندسهٔ مسیر محاسبه شد");
  }
  async function pick(e) {
    selected = null;
    cleanLayer();
    panel.hidden = true;
    delete document.body.dataset.ncPointselection;
    pending = true;
    const baseline = context().selected, ticket = ++epoch;
    try {
      const all = await paths(e, ticket);
      if (ticket !== epoch || !mode()) return;
      const hit = hitPath(e, all);
      if (!hit) {
        clear();
        message("روی یک لبه یا مسیر Sketch بزنید");
        return;
      }
      await inspect(hit.path, { position: hit.point.toArray() }, ticket, baseline);
    } catch (error) {
      if (ticket === epoch) {
        clear();
        message("بازرسی نقطه: " + error.message);
      }
    } finally {
      if (ticket === epoch) pending = false;
    }
  }
  async function parameter() {
    clearTimeout(timerInput);
    if (!selected) return;
    const value = Number($("ncPointT").value);
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      message("پارامتر باید بین صفر و یک باشد");
      return;
    }
    const source = selected.source, ticket = ++epoch;
    pending = true;
    $("ncPointExport").disabled = true;
    $("ncPointGo").disabled = true;
    try {
      await inspect(source, { normalized: value }, ticket, context().selected);
    } catch (error) {
      if (ticket === epoch) message("بازرسی نقطه: " + error.message);
    } finally {
      if (ticket === epoch) {
        pending = false;
        $("ncPointExport").disabled = false;
        $("ncPointGo").disabled = selected?.data.kind === "VERTEX";
      }
    }
  }
  $("ncPointGo").onclick = parameter;
  $("ncPointT").oninput = () => {
    ++epoch;
    pending = false;
    $("ncPointExport").disabled = true;
    $("ncPointGo").disabled = false;
    clearTimeout(timerInput);
    timerInput = setTimeout(parameter, 120);
  };
  $("ncPointT").onkeydown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      parameter();
    }
  };
  $("ncPointClose").onclick = clear;
  $("ncPointExport").onclick = () => {
    if (pending || !selected || !valid(selected.source) || Number($("ncPointT").value) !== selected.data.normalized) return;
    const blob = new Blob([JSON.stringify({ source: $("ncPointSource").textContent, ...selected.data }, null, 2)], { type: "application/json" }), url = URL.createObjectURL(blob), a = document.createElement("a");
    a.href = url;
    a.download = "NiliCAD-point.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1e3);
  };
  document.addEventListener("pointerdown", (e) => {
    if (e.target !== canvas || !mode() || !context().enabled || e.button !== 0) return;
    if (e.pointerType === "touch") {
      for (const t of touches.values()) t.multi = true;
      touches.set(e.pointerId, { x: e.clientX, y: e.clientY, multi: touches.size > 0 });
      return;
    }
    if (["mouse", "pen"].includes(e.pointerType)) {
      pick({ clientX: e.clientX, clientY: e.clientY });
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);
  document.addEventListener("pointermove", (e) => {
    const t = touches.get(e.pointerId);
    if (t && Math.hypot(e.clientX - t.x, e.clientY - t.y) > 10) t.moved = true;
  }, true);
  document.addEventListener("pointerup", (e) => {
    const t = touches.get(e.pointerId);
    touches.delete(e.pointerId);
    if (t && !t.multi && !t.moved && mode() && context().enabled) queueMicrotask(() => pick({ clientX: e.clientX, clientY: e.clientY }));
  }, true);
  document.addEventListener("pointercancel", (e) => touches.delete(e.pointerId), true);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && mode()) {
      clear();
      e.preventDefault();
      e.stopImmediatePropagation();
    }
  }, true);
  document.getElementById("ncSelectionFilter").addEventListener("click", clear);
  const interval = setInterval(() => {
    if (selected && (!valid(selected.source) || context().selected !== (selected.source.object || null))) clear();
  }, 200);
  return { get active() {
    return !!selected || pending;
  }, cancel: clear, destroy() {
    clearInterval(interval);
    drop(bodyCache);
    drop(sketchCache);
    clear();
    scene.remove(layer);
  } };
}
export {
  installPathInspector
};
