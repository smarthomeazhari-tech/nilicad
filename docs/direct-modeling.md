# Direct interaction with CAD topology

The selection strip offers Auto, Body, Face and Edge. It switches from Sketch to
selection without throwing away a completed profile. Auto prefers a visible CAD
edge within a nine-pixel pick radius; otherwise it selects the exact face. Body
retains whole-body selection for transforms and Boolean operands. Sketch regions
in front of a body retain their existing interaction. Selection on empty space
clears the subshape. Items selection, geometry changes, history navigation and
mode changes invalidate stale face/edge selections.

`direct-modeling.mjs` requests `/topology` using the body's complete world-space
exact recipe. It creates independent face and edge pick proxies from the returned
CAD subshapes, highlights the selected face or curve, and displays exact area or
length. It does not infer edges from triangle boundaries. Edge picking rejects
curves occluded behind the nearest face. The returned canonical B-Rep plus face
index is an immutable edit snapshot; indices are not reused after a body changes.

A planar face exposes a normal-directed arrow and numeric signed distance. Pen or
primary mouse can also drag the already-selected face. The arrow supports touch;
fingers on the viewport retain orbit/pan/pinch and short-tap selection. Right
mouse orbit preserves selection. The projected face normal sets drag direction;
view-normal faces use upward screen movement for positive distance. During a
gesture, a translated face highlight is a display preview. Releasing commits one
exact edit; pointer cancellation discards the preview. Numeric Apply follows the
same transaction. No mesh deformation is saved as an exact result.

The controller evaluates an OCCT face prism and fuse/cut, validates it, constructs
the replacement body, and only then records history and replaces the old body.
Errors, stale selections and late results after Cancel cannot replace the document.
The old solid remains until success. Undo/Redo is disabled while an edit runs, and
the original body, exact recipe, display and local recovery remain coherent.
Edits retain the body id/name and use a self-contained recipe compatible with
save/open, further transforms, STEP and IGES. The optional HTTP backend has no
new topology API; these interactions use the default browser kernel.

Curved faces are selectable/measurable but direct pulling is disabled. The planar
operation adds/removes the footprint of the bounded face, including holes. It is
not a general offset/extension solver for curved or taper-adjacent surfaces.
Imported triangle-only meshes cannot supply exact B-Rep subshapes; use STEP/IGES
or exact native bodies for these interactions. Edge selection does not imply
new fillet/chamfer operations. Physical iPad/Pencil acceptance remains in #6.

Geometry tests check all six box normals, signed volume changes, holes, exact
edge lengths, transformed/imported/Boolean bodies, STEP exchange, invalid indices,
curved edits and collapse. Shipping-build Chromium/WebKit scenarios use actual
pointer/pen input and public controls, plus Chromium touch for arrow dragging and
camera orbit. They verify selected faces/straight/circular edges, rotated bodies,
positive/negative edits, one-step history, pointer cancellation, cancellation with
injected Worker latency, rejected collapse, reopening exact edits and camera
navigation. The tests do not expose application-private state hooks.
