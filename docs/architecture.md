# NiliCAD architecture audit (2026-11-03)

Audited frontend main f64ede0 and backend main aa3ebdf. No build system, tests,
CI or AGENTS.md exists in either baseline repository.

## Actual frontend
`nilicad/index.html` is the entire application: styles, Persian markup and an
inline ES module. Three.js 0.164.1 and addons load through an import map from
jsDelivr. Three-bvh-csg loads dynamically from esm.sh/jsDelivr. Hosting must
serve the module over HTTP(S); offline support is absent.

`items` owns meshes, dimensions, transforms, optional exactRecipe and
exactBaseMatrix. `state`/`restore` implement object-only undo. Several generations
of sketch UI and pointer listeners coexist; the final `nc*` functions route the
visible v4.2 interface. Sketches use the world XZ plane, Y is height, units mm.
Line/arc/circle profiles become THREE.Shape, then ExtrudeGeometry and
booleanMesh. `ncRegions` and a selection Set are separate from object undo.
Containment heuristics add holes; intersecting profiles are not split.

The active Boolean command evaluates triangle meshes in the browser. It may
retain a recursive exact recipe, but the displayed result does not come from
OCCT. Feature edits also rebuild through browser CSG. Imported meshes and
custom sketch extrusions have no exact recipe in the baseline.

## Actual backend
`nilicad-occt-server/server.py` is a stateless FastAPI service using CadQuery/OCP.
`make` recursively evaluates primitive, transform and union/subtract/intersect
nodes. Unsupported profiles are rejected. Three.js column-major transforms
are converted to gp_Trsf. STEP export rotates (x,y,z) to (x,-z,y), converting
Y-up to Z-up after evaluating the whole feature tree.

Routes: GET /health, POST /export-step, POST /prepare-step,
GET /download-step/{job_id}. STEP jobs are temporary, in-memory indexed,
one-hour TTL, process-local and support HTTP Range. Docker/Render runs one
uvicorn worker. Open CORS permits browser clients. No authentication, durable
database or shared job store is implemented.

## Persistence and interoperability
JSON contains meshes, transforms and optional exact recipes. STL/OBJ/3MF use
Three.js loaders/exporters; these are mesh formats and cannot recover analytic
surfaces. Exact STEP uses server settings in localStorage, a two-stage download
and an explicit user-gesture save panel for Safari. STEP/IGES import and IGES
export are only placeholder alerts in the baseline. Sketch restoration calls
ncSaveRegion without rebuilding nc.surface, so saved regions may be lost.

## Verified defects and required boundaries
Selection does not enable Extrude; touch selection is absent; overlapping
profiles remain overlapping; nested holes are inferred rather than represented
as independent faces. Pull placement ignores the offset parent's position.
Pointer cancel does not reset pull dragging. Multiple-region preview tests only
the last preview mesh when deciding whether a click confirms.

CAD work should use server-evaluated B-Rep with tessellation only for display.
Store self-contained B-Rep recipes for imported/split faces so JSON does not
depend on ephemeral jobs. Preserve analytic arcs during splitting and extrusion.
Do not present successful code generation as validated CAD behavior. Automated
Chromium/WebKit tests are useful, but physical Safari/iPad Pencil and Windows
browser checks remain a separate acceptance step.

## Browser engine update (2026-11-05)

The audit above describes the original baseline. The browser now defaults to a
single-threaded OCCT WebAssembly kernel in a Web Worker. `ncRequest` selects the
local worker adapter in browser mode and the existing HTTP adapter only when a
remote/local server is explicitly chosen. Exact recipes and returned display
meshes use the same data model, so existing projects remain compatible. STEP
import/export runs in the worker. A later optional isolated converter adds IGES
through exact STEP transfer; nonuniform transformations remain unsupported. See browser-engine.md.

## Private release workspace and recovery (2026-11-07)

The current protected build bundles the inline CAD controller together with
`workspace-ui.mjs` into a classic deferred application. The latter owns workspace
presentation/navigation and calls a small state/action bridge; it does not
implement geometry. All display/OCCT assets are hosted locally behind the Worker.
The optional IGES bridge is implemented and tested; see browser-engine.md and
browser-engine/iges/README.md.

History now includes objects, independent sketch regions and unfinished drafts.
The same validated v5 document is downloaded as JSON and stored atomically in
IndexedDB for local recovery, before sample loading. Recovery is not a remote
project service; browsers can evict it and uncommitted changes can be lost.
Corrupt/unavailable storage leaves explicit file workflows usable.

The new workspace offers contextual region/body tools, Items, numeric and gizmo
Move/Rotate, world bounds, a sketch flyout with Finish/Cancel, file/history
navigation and orientation controls. Pointer selection yields to TransformControls;
a legacy pointer-release deselection listener was removed because it detached
finished gizmo drags. Pen/primary mouse draws, fingers navigate, and right mouse
orbits. See workspace.md for interactions and remaining feature boundaries.

Shipping-build workflows, exact volume/bounds tests, protected asset access and
recovery are covered in Chromium/WebKit and Windows Chromium CI. These automated
checks do not replace physical iPad/Pencil or OS Files acceptance in issue #6.

## Exact subshape interaction (2026-11-08)

`direct-modeling.mjs` adds the Auto/Body/Face/Edge selection strip, OCCT subshape
pick proxies, area/length inspection and direct planar face gestures. The browser
kernel returns a canonical B-Rep snapshot for topology indices and evaluates
self-contained `facePull` recipes before replacing a document body. History,
recovery and CAD export retain exact geometry. Cancel/stale-result guards prevent
late worker results from changing the original. The legacy box-only subshape
panel is not used by the new workspace. See direct-modeling.md for behavior,
validation and the bounded planar-footprint operation's limitations.
