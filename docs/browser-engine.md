# Browser-only Open CASCADE

The default CAD engine now runs in a dedicated module Web Worker, using the
single-threaded WebAssembly build of Open CASCADE from replicad-opencascadejs
1.1.0 and replicad 1.2.0. No geometry requests leave the browser in this mode.
The Python server stays available as an optional existing engine.

## Build and serve

`npm ci && npm run build:engine`

Serve the repository over HTTP(S). Deploy `index.html`, `browser-engine/client.mjs`,
and the generated `browser-engine/dist/` together. Preserve its license/notice
files. The generated worker, WASM and license files are ignored in Git and built
from pinned lockfile dependencies. The WASM file is about 22 MiB and is fetched
lazily on first exact operation; it needs static hosting, not a CAD server.
The build is single-threaded and does not require SharedArrayBuffer or COOP/COEP.

## Supported geometry

- Existing primitive, B-Rep, profile, Boolean and transform recipes.
- Exact planar splitting preserving circular/arc boundaries and nested holes.
- Atomic multi-region signed extrusion, exact Boolean operations and tessellation.
- Self-contained B-Rep project persistence, including Python OCCT-produced files.
- STEP export/import in millimetres, converting browser Y-up to file Z-up.

IGES import/export is provided by an optional, isolated 11 MiB OCCT converter.
It transfers exact B-Rep through STEP, uses millimetres, and does not convert CAD
to a triangle mesh for exchange. The adapter starts the converter only for IGES,
checks its asset hashes, and terminates it after each conversion. When idle the
main geometry worker is released first to reduce simultaneous engine memory.
The converter has a 32 MiB initial WASM heap and a 512 MiB maximum; the tested
models stay in the initial heap. Heap size is not total process memory.
See [iges/README](../browser-engine/iges/README.md) for source, pinned build,
artifact provenance and limitations. CAD inputs/converted outputs are limited
to 20 MB. Nonuniform transforms remain unsupported. Uniform transforms are supported; unsupported nonuniform scale/shear is
rejected instead of silently distorting geometry. Imported triangle meshes do
not become analytic CAD solids.

The worker processes requests sequentially, releases owned OCCT handles after
each request, reports initialization state and times out after 120 seconds.
Failures preserve the live document. Pull-handle previews are debounced.

## Verification

`npm test` builds the engine and runs six WASM geometry test groups plus the
complete Chromium and WebKit scenarios. They cover Boolean volumes and empty
results, signed multiple extrusion, independent overlapping faces, circular holes,
analytic circle intersections, legacy Python B-Rep, STEP bounds/volume round trips,
invalid input, IGES round trips, an independent Python IGES fixture and malformed-file preservation. Browser tests assert that no geometry
request is sent to the former backend and exercise real drawing, handle drag and
cancel, selection, project undo/redo, file round trips and atomic failures.
CI installs no Python backend and starts no Uvicorn service.

Physical iPad Safari/Pencil and Windows acceptance still require actual devices;
Linux WebKit is not a substitute for those checks. See issue #6.

The input regression also interrupts pen strokes with `pointercancel` and
`lostpointercapture`, verifies that transient lines are removed without changing
the document, and draws a new closed profile after each interrupted input.

## Distribution

The generated distribution retains the upstream LGPL-2.1 and MIT license files,
source/build links and bundle legal notices. WASM is copied unmodified from its
pinned npm package. `npm ci && npm run build:engine` reproduces it.

## Exact topology and planar face pulling

`/topology` takes an exact recipe and returns a canonical B-Rep snapshot plus
indexed CAD faces (mesh, surface kind, area, mass center and oriented unit normal)
and CAD edges (curve kind, exact length and display line segments). Faces and
edges are OCCT subshapes; tessellation boundaries are not selectable CAD edges.
Indices are valid only with the immutable returned B-Rep, not across edits.
Queries reject more than 2,000 faces or 4,000 edges.

`/evaluate` accepts `{type:'facePull',brep,faceIndex,distance}`. For a planar face,
a prism of its full bounded face, including holes, adds material along its outward
normal for positive distance or removes material inward for negative distance.
The result is validated with OCCT; zero/oversized values, curved faces, invalid
indices and complete collapse fail. The recipe is self-contained for project
history, further transforms and STEP/IGES exchange. This is a planar face-footprint
push/pull, not a general adjacent-surface extension/offset solver for curved or
tapered models. The original document is committed only after a valid result.

## Edge finishing

`{type:'edgeFinish',brep,edgeIndices,mode,amount}` evaluates exact OCCT Fillet or
symmetric equal-distance Chamfer on the selected snapshot edges. Modes are
`fillet`/`chamfer`; amount is a positive radius/distance in mm (0.01–10000).
One to 100 unique valid indices are accepted. OCCT determines geometrical
feasibility; invalid/oversized blends fail instead of changing a display mesh.
The self-contained recipe supports transforms, history and CAD exchange.
