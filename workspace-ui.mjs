// Workspace presentation and navigation. Exact geometry stays in the CAD controller.
function installWorkspaceUI({ state, action }) {
  const $ = (id) => document.getElementById(id);
  const paths = { home: "M3 10 12 3l9 7v11H3Z M9 21v-8h6v8", sketch: "m4 17-1 4 4-1L20 7l-3-3Z M14 7l3 3", tools: "M4 4h10v10H4Z M10 10h10v10H10", items: "M3 5h18v5H3Z M3 14h18v5H3", files: "M12 16V3 M7 8l5-5 5 5 M4 14v7h16v-7", move: "M12 2v20 M2 12h20 M8 6l4-4 4 4 M8 18l4 4 4-4 M6 8l-4 4 4 4 M18 8l4 4-4 4", undo: "M9 4 3 10l6 6 M3 10h10a7 7 0 0 1 7 7", redo: "m15 4 6 6-6 6 M21 10h-10a7 7 0 0 0-7 7", line: "M4 20 20 4", arc: "M3 17C3 3 21 3 21 17", circle: "M21 12a9 9 0 1 1-18 0 9 9 0 1 1 18 0", rectangle: "M3 5h18v14H3Z", grid: "M3 3h18v18H3Z M9 3v18 M15 3v18 M3 9h18 M3 15h18", fit: "M3 8V3h5 M16 3h5v5 M21 16v5h-5 M8 21H3v-5", help: "M9 8a3 3 0 1 1 5 2c-2 1-2 2-2 4 M12 18h.01", close: "m6 6 12 12 M18 6 6 18", check: "m5 12 4 4L19 6" };
  const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="${paths[name] || paths.tools}"/></svg>`;
  const label = (id, name, text) => {
    const el = $(id);
    el.innerHTML = icon(name) + `<span>${text}</span>`;
    el.title = text;
    el.setAttribute("aria-label", text);
  };
  const style = document.createElement("style");
  style.id = "ncProfessionalStyle";
  style.textContent = `
 :root{--ws-blue:#1769e0;--ws-ink:#243144;--ws-border:#e1e5eb;--ws-rail:70px}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif!important}
 #ncTop{position:fixed;inset:0 0 auto 0;transform:none;max-width:none;height:62px;box-sizing:border-box;border:0;border-bottom:1px solid var(--ws-border);border-radius:0;background:#fff;box-shadow:none;padding:0 20px 0 14px;gap:12px;z-index:90}
 #ncTop .ncTitle{font-size:14px;font-weight:600;flex:1;padding:0;color:#374151}#ncTop .ncTitle small{font-weight:400;color:#8993a1;margin-left:12px;font-size:11px}.ncBrand{display:grid;place-items:center;width:30px;height:30px;background:#1769e0;border-radius:7px;color:white;font-weight:800;font-size:18px}
 .ncBtn[hidden]{display:none!important} .ncBtn{font:500 12px -apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif!important;color:var(--ws-ink)!important;min-height:42px;border:0!important;border-radius:7px!important;background:transparent!important;box-shadow:none;gap:10px;touch-action:manipulation;transition:background .12s,color .12s}.ncBtn:hover{background:#edf2f8!important}.ncBtn.active{background:#e8f0fe!important;color:#1769e0!important}.ncBtn:focus-visible{outline:2px solid #1769e0;outline-offset:2px}.ncBtn:disabled{opacity:.32}.ncBtn svg,.ncWSButton svg{width:21px;height:21px;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0}#ncTop .ncBtn{min-width:40px;justify-content:center}#ncTop #ncFiles{color:#1769e0!important;background:#eef4ff!important;padding:0 14px}#ncMenu{display:none}
 #ncLeft{position:fixed;top:94px;bottom:72px;left:7px;width:64px;max-width:none;overflow:visible;gap:5px;z-index:75;align-items:stretch}#ncLeft>.ncBtn{flex-direction:column;justify-content:center;gap:5px;min-height:64px;padding:8px 2px;font-size:10px!important;color:#647084!important}#ncLeft>.ncBtn.active{color:#1769e0!important}#ncLeft .ncSeparator{width:36px;align-self:center;margin:5px 0}#ncLeft>.ncBtn svg{width:24px;height:24px}#ncLeft>.ncBtn#ncItems{margin-top:auto}#ncLeft>#ncConstruct,#ncLeft>#ncTools{display:none}
 #ncSketchGroup,#ncFilesGroup,#ncBoolGroup,#ncTransformGroup{position:fixed;top:94px;left:84px;width:184px;max-height:calc(100dvh - 180px);overflow:auto;margin:0;padding:10px;background:#fff;border:1px solid var(--ws-border);border-radius:11px;box-shadow:0 8px 28px #24364a12;gap:2px;z-index:76}#ncSketchGroup .ncBtn,#ncFilesGroup .ncBtn,#ncBoolGroup .ncBtn,#ncTransformGroup .ncBtn{min-height:40px;width:100%;justify-content:flex-start;font-size:12px!important;padding:8px 10px}#ncSketchGroup [disabled]{display:none}#ncSketchGroup .ncSmall{display:none}#ncFilesGroup{top:70px;left:auto;right:16px;width:230px;z-index:94}#ncFilesGroup:not(.open),#ncBoolGroup:not(.open),#ncTransformGroup:not(.open){display:none!important}.ncPanelTitle{font-size:10px;text-transform:uppercase;letter-spacing:1.3px;color:#8b95a3;margin:4px 10px 8px;font-weight:600}.ncPanelFoot{border-top:1px solid #edf0f4;padding-top:7px;margin-top:6px}
 #ncRight{position:fixed;top:84px;right:24px;max-height:none;overflow:visible;gap:9px;align-items:center;z-index:65}#ncTopView{width:64px;height:58px;border:1px solid #c9d3df!important;background:linear-gradient(145deg,#fff,#e9edf3)!important;box-shadow:5px 6px 0 #d9e1eb;transform:skewY(-8deg);font-size:11px!important;font-weight:700!important;justify-content:center}#ncTopView svg{display:none}#ncRight .ncBtn:not(#ncTopView){background:#ffffffd9!important;border:1px solid #e4e8ee!important;min-width:40px;min-height:38px;justify-content:center}#ncRight .ncBtn svg{width:17px;height:17px}#ncRight #ncConstraints{display:none}#ncIsoView span,#ncGrid span,#ncFit span{display:none}
 #ncBottom{position:fixed;left:84px;right:18px;bottom:22px;transform:none;border:0;background:transparent;box-shadow:none;padding:0;max-width:none;overflow:visible;gap:8px;min-height:44px}#ncStatus{margin-right:auto;max-width:52%;font-size:11px;color:#788596;line-height:1.6}#ncBottom>.ncBtn{background:#fff!important;border:1px solid #dde4ed!important;box-shadow:0 2px 9px #24364a09;padding:9px 15px;white-space:nowrap}#ncBottom>#ncConfirm{background:#1769e0!important;color:#fff!important;border-color:#1769e0!important}#ncExtrude:not(:disabled){color:#1769e0!important}
 #ncToast{position:fixed;bottom:83px;left:50%;max-width:min(480px,65vw);font-size:12px;border:1px solid #e1e7ef;box-shadow:0 4px 16px #25364b12;z-index:95}#ncPull .handle{background:#1769e0;border:3px solid white;color:#fff;border-radius:8px;width:42px;height:48px;font-size:29px;box-shadow:0 3px 12px #1769e033}#ncPull input{border:1px solid #1769e0;border-radius:6px;width:90px;font-variant-numeric:tabular-nums}#ncPull>.ncSmall{background:white;padding:2px 6px;border-radius:4px}
 .workspace .panel.left.ncItemsVisible{position:fixed;left:84px;top:94px;bottom:88px;height:auto;max-height:none;width:240px;max-width:calc(100vw - 170px);padding:16px;background:#fff;border:1px solid var(--ws-border);border-radius:11px;box-shadow:0 8px 30px #24364a12;z-index:83;overflow:auto;box-sizing:border-box;direction:ltr}.panel.left h3{font-size:12px;font-weight:600;margin:2px 0 16px}.panel.left .note{font-size:11px;color:#8490a0;line-height:1.8;direction:rtl}.treeitem{border:0;border-radius:6px;padding:10px 8px;margin-bottom:4px;background:transparent;color:#405065;cursor:pointer}.treeitem.selected{background:#e8f0fe;color:#1769e0}.treeitem small{color:#8c97a5}.treeitem span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
 #ncInspector{position:fixed;right:20px;top:326px;width:196px;direction:ltr;padding:14px;box-sizing:border-box;border:1px solid var(--ws-border);border-radius:10px;background:#ffffffed;z-index:64;color:#415064;font-size:12px;box-shadow:0 4px 20px #24364a08}#ncInspector[hidden]{display:none}#ncInspector strong{display:block;font-size:12px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}#ncInspector p{color:#8894a3;font-size:11px;line-height:1.6;margin:6px 0 12px}.ncInspectorActions{display:flex;flex-direction:column;gap:3px}#ncInspector .ncBtn{padding:7px 8px;min-height:38px;font-size:11px!important}.ncWSButton{font:inherit;color:inherit;background:#fff;border:1px solid #e1e6ed;border-radius:7px;padding:8px;cursor:pointer;min-height:40px}#ncInspector dl{display:grid;grid-template-columns:1fr auto;margin:12px 0;font-size:11px;gap:6px}#ncInspector dt{color:#8b95a3}#ncInspector dd{margin:0;font-variant-numeric:tabular-nums}#ncSelectionActions{display:flex;gap:4px;margin-top:9px}#ncSelectionActions button{flex:1}.ncTransformValues{display:flex;gap:5px;padding:0 8px}.ncTransformValues label{font-size:10px;color:#7a8797;min-width:0;flex:1}.ncTransformValues input{box-sizing:border-box;width:100%;min-width:0;padding:8px 3px;margin-top:5px;border:1px solid #dbe2ec;border-radius:5px;background:#fafbfd;color:#344258;font-size:12px}#ncTransformUnit{font-size:10px;color:#8b95a3;padding:0 8px}#ncTransformFields:has(button:disabled){opacity:.5}
 #ncRenameLabel{display:block;font-size:10px;color:#8b95a3;margin-top:12px}#ncRenameLabel[hidden]{display:none}#ncRenameBody{width:100%;box-sizing:border-box;border:1px solid #dce3ed;border-radius:5px;padding:7px;margin-top:4px;color:#405065;background:#fafbfd} #ncHelpDialog{color:#344258;border:1px solid #dce3ed;border-radius:14px;padding:24px;width:min(430px,80vw);font:13px -apple-system,Arial;box-shadow:0 20px 100px #1e304433}#ncHelpDialog::backdrop{background:#22304744}#ncHelpDialog p{line-height:1.9;direction:rtl}#ncHelpDialog button{float:right}.ncHintKey{padding:3px 6px;background:#f0f3f8;border-radius:4px;font-size:11px}#ncRecoveryStatus{bottom:4px!important;font-size:10px!important;color:#929cac!important}
 @media(max-width:850px){#ncTop{height:56px;padding:0 10px;gap:5px}#ncTop .ncTitle small{display:none}#ncTop .ncTitle{font-size:12px}#ncTop #ncFiles{padding:0 9px}#ncLeft{top:80px;left:3px;width:60px}#ncSketchGroup,#ncBoolGroup,#ncTransformGroup{left:71px;top:80px;width:164px}#ncRight{right:15px;top:76px}#ncInspector{right:12px;top:310px;width:170px}#ncBottom{left:74px;right:12px;bottom:20px}#ncStatus{max-width:40%;font-size:10px}#ncBottom>.ncBtn{padding:8px 10px;font-size:11px!important}.workspace .panel.left.ncItemsVisible{left:71px;top:80px;width:210px}}
 @media(max-width:600px){#ncTop .ncBrand{display:none}#ncTop .ncTitle{max-width:140px}#ncTop .ncBtn{padding:6px;min-width:32px}#ncTop #ncFiles span{display:none}#ncLeft{width:52px}#ncLeft>.ncBtn{min-height:58px;font-size:9px!important}#ncSketchGroup,#ncBoolGroup,#ncTransformGroup{left:62px;width:151px;max-height:calc(100dvh - 165px)}#ncInspector{top:auto;bottom:86px;right:8px;width:160px}#ncInspector dl,#ncInspector p{display:none}#ncBottom{left:65px;right:8px;gap:4px}#ncStatus{display:none}#ncBottom>.ncBtn{flex:1;justify-content:center;padding:8px 6px}.workspace .panel.left.ncItemsVisible{left:62px;width:200px}#ncRight{right:13px}#ncTopView{width:46px;height:44px}#ncRight .ncBtn{min-height:34px}.ncTitle small{display:none}}
 #ncViewCube{position:relative;width:78px;height:80px;margin-bottom:0}#ncRight #ncViewCube #ncTopView{position:absolute;inset:0 auto auto 0;width:78px;height:40px;min-height:0;border:0!important;box-shadow:none;transform:none;clip-path:polygon(50% 0,100% 32%,50% 100%,0 32%);background:#fff!important;font-size:9px!important;padding:0 0 8px;cursor:pointer}#ncViewCube .ncCubeFace{position:absolute;top:13px;width:39px;height:62px;border:0;background:#e7ecf3;color:#617084;font:600 8px Arial;cursor:pointer;padding:4px 0 0;clip-path:polygon(0 0,100% 44%,100% 100%,0 56%)}#ncViewfront{left:0}#ncViewCube #ncViewright{left:39px;clip-path:polygon(0 44%,100% 0,100% 56%,0 100%);background:#dce4ee}#ncViewCube button:hover{filter:brightness(.95)}
 @media(prefers-reduced-motion:reduce){.ncBtn{transition:none}}
 `;
  document.head.appendChild(style);
  for (const [id, name, text] of [["ncHome", "home", "New project"], ["ncSketch", "sketch", "Sketch"], ["ncBool", "tools", "Tools"], ["ncTransform", "move", "Transform"], ["ncItems", "items", "Items"], ["ncFiles", "files", "Export / Import"], ["ncUndo", "undo", "Undo"], ["ncRedo", "redo", "Redo"], ["ncGrid", "grid", "Grid"], ["ncTopView", "rectangle", "TOP"], ["ncIsoView", "tools", "3D"], ["ncCloseLoop", "check", "Close profile"], ["ncUndoPoint", "undo", "Undo point"], ["ncClear", "close", "Clear sketch"]]) label(id, name, text);
  document.querySelectorAll("[data-nctool]").forEach((button) => {
    const tool = button.dataset.nctool;
    if (paths[tool]) {
      button.innerHTML = icon(tool) + `<span>${tool[0].toUpperCase() + tool.slice(1)}</span>`;
      button.setAttribute("aria-label", tool);
    }
  });
  const top = $("ncTop"), brand = document.createElement("span");
  brand.className = "ncBrand";
  brand.textContent = "N";
  top.insertBefore(brand, top.firstChild);
  document.querySelector("#ncTop .ncTitle").innerHTML = '<span id="ncProject">Untitled Project</span><small>NiliCAD · <span id="ncWorkspaceMode">Modeling</span></small>';
  top.insertBefore($("ncFiles"), $("ncMenu"));
  const history = document.createElement("div");
  history.id = "ncHistory";
  history.style.cssText = "display:flex;gap:2px;border-left:1px solid #e7ebf0;padding-left:8px";
  history.append($("ncUndo"), $("ncRedo"));
  top.insertBefore(history, $("ncFiles"));
  $("ncLeft").append($("ncItems"));
  for (const [id, title] of [["ncSketchGroup", "Sketch tools"], ["ncBoolGroup", "Solid tools"], ["ncFilesGroup", "Project & exchange"]]) {
    const heading = document.createElement("div");
    heading.className = "ncPanelTitle";
    heading.textContent = title;
    $(id).prepend(heading);
  }
  const hideItems = () => {
    document.querySelector(".panel.left").classList.remove("ncItemsVisible");
    $("ncItems").classList.remove("active");
  };
  for (const id of ["ncSketch", "ncBool", "ncTransform"]) $(id).addEventListener("click", hideItems);
  const done = document.createElement("button");
  done.className = "ncBtn ncPanelFoot";
  done.id = "ncDoneSketch";
  done.innerHTML = icon("check") + "<span>Finish sketch</span>";
  done.onclick = () => {
    if (state().mode === "sketch") $("ncSketch").click();
  };
  $("ncSketchGroup").append(done);
  const transform = document.createElement("div");
  transform.id = "ncTransformGroup";
  transform.className = "ncGroup";
  transform.innerHTML = '<div class="ncPanelTitle">Transform body</div><button class="ncBtn" id="ncMoveBody">Move</button><button class="ncBtn" id="ncRotateBody">Rotate</button><div id="ncTransformFields"><p id="ncTransformUnit">Offset · mm</p><div class="ncTransformValues"><label>X<input id="ncDeltaX" type="number" step="any" value="0"></label><label>Y<input id="ncDeltaY" type="number" step="any" value="0"></label><label>Z<input id="ncDeltaZ" type="number" step="any" value="0"></label></div><button class="ncBtn" id="ncApplyTransform">Apply offset</button></div><button class="ncBtn ncPanelFoot" id="ncDoneTransform">Done</button>';
  document.body.append(transform);
  $("ncTransform").disabled = false;
  $("ncTransform").onclick = () => {
    transform.classList.toggle("open");
    $("ncTransform").classList.toggle("active", transform.classList.contains("open"));
  };
  let transformMode = "move";
  const setTransform = (mode) => {
    transformMode = mode;
    $("ncTransformUnit").textContent = mode === "move" ? "Offset · mm" : "Rotate around body center · °";
    $("ncApplyTransform").textContent = mode === "move" ? "Apply offset" : "Apply rotation";
    $("ncMoveBody").classList.toggle("active", mode === "move");
    $("ncRotateBody").classList.toggle("active", mode === "rotate");
    action(mode);
  };
  $("ncMoveBody").onclick = () => setTransform("move");
  $("ncRotateBody").onclick = () => setTransform("rotate");
  $("ncApplyTransform").onclick = () => {
    const values = ["X", "Y", "Z"].map((axis) => Number($("ncDelta" + axis).value));
    action("transform", { mode: transformMode, values });
  };
  $("ncDoneTransform").onclick = () => {
    action("finishTransform");
    transform.classList.remove("open");
    $("ncTransform").classList.remove("active");
  };
  const inspector = document.createElement("aside");
  inspector.id = "ncInspector";
  inspector.hidden = true;
  inspector.setAttribute("aria-label", "Selection inspector");
  inspector.innerHTML = '<strong id="ncSelectionTitle"></strong><label id="ncRenameLabel">Name<input id="ncRenameBody" aria-label="Body name" maxlength="80"></label><p id="ncSelectionHint"></p><dl id="ncSelectionDimensions"></dl><div class="ncInspectorActions"><button class="ncBtn" id="ncContextExtrude">Extrude selection</button><button class="ncBtn" id="ncContextTools">Solid tools</button><button class="ncBtn" id="ncContextMove">Move / Rotate</button></div><div id="ncSelectionActions"><button class="ncWSButton" id="ncDeselect">Deselect</button><button class="ncWSButton" id="ncRemoveSelection">Delete</button></div>';
  document.body.append(inspector);
  $("ncRenameBody").onchange = () => action("rename", $("ncRenameBody").value);
  $("ncContextExtrude").onclick = () => $("ncExtrude").click();
  $("ncContextTools").onclick = () => {
    hideItems();
    $("ncBoolGroup").classList.add("open");
  };
  $("ncContextMove").onclick = () => {
    $("ncTransform").click();
    $("ncMoveBody").click();
  };
  $("ncDeselect").onclick = () => action("deselect");
  $("ncRemoveSelection").onclick = () => $("ncDelete").click();
  const cube = document.createElement("div");
  cube.id = "ncViewCube";
  cube.setAttribute("aria-label", "Orientation cube");
  $("ncRight").prepend(cube);
  cube.append($("ncTopView"));
  for (const [face, letter] of [["front", "FRONT"], ["right", "RIGHT"]]) {
    const button = document.createElement("button");
    button.id = "ncView" + face;
    button.className = "ncCubeFace";
    button.textContent = letter;
    button.title = face + " view";
    button.onclick = () => action(face);
    cube.append(button);
  }
  const fit = document.createElement("button");
  fit.id = "ncFit";
  fit.className = "ncBtn";
  fit.innerHTML = icon("fit") + "<span>Fit</span>";
  fit.title = "Fit all · F";
  fit.onclick = () => action("fit");
  $("ncRight").append(fit);
  const help = document.createElement("button");
  help.id = "ncHelp";
  help.className = "ncBtn";
  help.innerHTML = icon("help") + "<span>Help</span>";
  help.title = "Navigation & shortcuts";
  $("ncLeft").append(help);
  const dialog = document.createElement("dialog");
  dialog.id = "ncHelpDialog";
  dialog.innerHTML = '<strong>Navigation & shortcuts</strong><p>قلم یا ماوس: ترسیم با ابزار فعال · لمس کوتاه: انتخاب<br>یک انگشت: چرخش · دو انگشت: جابه‌جایی و بزرگ‌نمایی<br>ماوس راست: چرخش · چرخ ماوس: بزرگ‌نمایی</p><p><span class="ncHintKey">Esc</span> خروج از ابزار / لغو عملیات<br><span class="ncHintKey">F</span> نمایش همه · <span class="ncHintKey">1</span> بالا · <span class="ncHintKey">2</span> سه‌بعدی<br><span class="ncHintKey">⌘ / Ctrl Z</span> بازگشت · <span class="ncHintKey">⌘ / Ctrl S</span> ذخیره فایل</p><button class="ncWSButton" id="ncCloseHelp">Got it</button>';
  document.body.append(dialog);
  help.onclick = () => dialog.showModal();
  $("ncCloseHelp").onclick = () => dialog.close();
  const itemsHeading = document.querySelector(".panel.left h3");
  if (itemsHeading) itemsHeading.textContent = "Items";
  for (const id of ["ncFiles", "ncBool", "ncTransform"]) $(id).addEventListener("click", () => {
    for (const other of ["ncFiles", "ncBool", "ncTransform"]) if (other !== id) $(other + "Group").classList.remove("open");
  });
  $("ncFilesGroup").addEventListener("click", (event) => {
    if (event.target.closest("button")) $("ncFilesGroup").classList.remove("open");
  });
  for (const id of ["ncHome", "ncSketch", "ncTopView", "ncIsoView", "ncItems"]) $(id).addEventListener("click", () => {
    for (const group of ["ncFilesGroup", "ncBoolGroup", "ncTransformGroup"]) $(group).classList.remove("open");
  });
  document.addEventListener("pointerdown", (event) => {
    if (!event.target.closest("#ncFiles,#ncFilesGroup")) $("ncFilesGroup").classList.remove("open");
  }, true);
  $("ncMenu").onclick = () => $("ncFiles").click();
  document.addEventListener("keydown", (event) => {
    if (event.target.closest("input,textarea,select,[contenteditable]") || dialog.open) return;
    const mod = event.ctrlKey || event.metaKey;
    const key = event.key.toLowerCase();
    if (mod && key === "s") {
      event.preventDefault();
      $("ncSave").click();
    } else if (mod && key === "z") {
      event.preventDefault();
      $(event.shiftKey ? "ncRedo" : "ncUndo").click();
    } else if (!mod && (key === "delete" || key === "backspace")) {
      event.preventDefault();
      $("ncDelete").click();
    } else if (key === "escape") {
      for (const id of ["ncFilesGroup", "ncBoolGroup", "ncTransformGroup"]) $(id).classList.remove("open");
      action("cancel");
    } else if (!mod && key === "f") action("fit");
    else if (!mod && key === "1") $("ncTopView").click();
    else if (!mod && key === "2") $("ncIsoView").click();
  });
  let last = "";
  function refresh() {
    const s = state();
    const key = JSON.stringify([s, ...["ncFiles", "ncBool", "ncTransform"].map((id) => $(id + "Group").classList.contains("open"))]);
    if (key === last) return;
    last = key;
    const face = !!s.regions || s.closed, body = !!s.body;
    inspector.hidden = !(face || body) || s.mode === "pull" || s.mode === "sketch" && !face;
    if ($("ncCancelOperation")) $("ncCancelOperation").hidden = s.mode !== "pull" && !s.boolean && !s.transform;
    $("ncSelectionTitle").textContent = face ? `${s.regions || 1} sketch region${s.regions > 1 ? "s" : ""}` : s.body?.name || "";
    $("ncRenameLabel").hidden = !body || face;
    if (body && document.activeElement !== $("ncRenameBody")) $("ncRenameBody").value = s.body.name;
    $("ncSelectionHint").textContent = face ? "Select regions, then pull to create a solid." : "Body selected · exact geometry preserved";
    $("ncContextExtrude").hidden = !face;
    $("ncContextTools").hidden = !body;
    $("ncContextMove").hidden = !body;
    $("ncRemoveSelection").hidden = !body;
    $("ncSelectionDimensions").replaceChildren();
    if (body && !face) for (const axis of ["x", "y", "z"]) {
      const dt = document.createElement("dt"), dd = document.createElement("dd");
      dt.textContent = axis.toUpperCase() + " size";
      dd.textContent = Number(s.body.dims[axis]).toFixed(2) + " mm";
      $("ncSelectionDimensions").append(dt, dd);
    }
    $("ncTransform").classList.toggle("active", s.transform || $("ncTransformGroup").classList.contains("open"));
    for (const id of ["ncUnion", "ncSubtract", "ncIntersect", "ncDelete"]) $(id).disabled = !body;
    $("ncMoveBody").disabled = !body;
    $("ncRotateBody").disabled = !body;
    $("ncApplyTransform").disabled = !body;
    $("ncGrid").setAttribute("aria-pressed", String(s.grid));
    $("ncWorkspaceMode").textContent = s.mode === "sketch" ? "Sketch · XZ · mm" : "Modeling · mm";
    $("ncSketch").setAttribute("aria-pressed", String(s.mode === "sketch"));
    for (const id of ["ncFiles", "ncBool", "ncTransform"]) $(id).setAttribute("aria-expanded", String($(id + "Group").classList.contains("open")));
  }
  const cancel = document.createElement("button");
  cancel.id = "ncCancelOperation";
  cancel.className = "ncBtn";
  cancel.innerHTML = icon("close") + "<span>Cancel</span>";
  cancel.onclick = () => action("cancel");
  $("ncBottom").append(cancel);
  const timer = setInterval(refresh, 200);
  refresh();
  return { refresh, destroy: () => clearInterval(timer) };
}
export {
  installWorkspaceUI
};
