# Project persistence

Project JSON uses `format: "NiliCAD-Web"`, `version: "5.0"`, and millimetres.
Objects retain their display meshes, transforms, exact B-Rep recipes and feature
history. Closed sketch regions are stored independently in `sketchRegions`.

The optional `sketchDraft` stores the unfinished active sketch: `tool`,
`segments`, `points`, `arcPoints`, and `rectStart`. This includes a partially
drawn line loop, a pending three-point arc, a circle centre, and a rectangle's
first corner. Completed profiles are stored as regions, avoiding duplicates.
The field is additive; older files without it still open normally.

Draft points and curve types are validated before replacing the current
document. Invalid drafts leave the current objects and sketches intact.
Undo/redo snapshots retain drafts and completed active profiles as well.

`tests/project-draft.test.cjs` uses real pointer gestures to draw an open loop,
downloads its JSON, reopens it through the file input, completes and extrudes it,
and verifies the exact OCCT volume in Chromium and WebKit. It also exercises
invalid files, undo/redo, and pending arc/circle/rectangle data.

Saving a portable project requires the explicit Save command and file download.
Local recovery is described below; opening a project does not save later edits
back into the original downloaded file.

## Local recovery

The application keeps one recovery document in IndexedDB (`NiliCAD-recovery`, store `projects`, key `current`). This uses the same validated v5 JSON as explicit project files, including exact B-Rep recipes, sketch regions and unfinished strokes. Startup restores it before considering the bundled example. Recovery does not restore Undo/Redo history or the camera. A new project replaces the recovery document with an empty project.

Completed pointer gestures, changes and button actions request an atomic write; a 1.5-second fallback also captures other document changes. Writes skip active geometry operations and strokes. The status at the bottom reports committed saves, restoration or storage failure. Page visibility changes request a final write, but abrupt process termination can lose changes not yet committed. IndexedDB is local to the browser profile and origin, can be cleared/evicted by the browser, and is not cloud sync or a substitute for downloaded project files. Concurrent tabs share the same last-written recovery slot.

Malformed records and denied storage never replace a valid document or prevent explicit saving. Malformed records are retained for diagnosis rather than silently overwritten. The protected shipping-build tests verify exact-model data, unfinished sketches, explicit new documents, corrupt records and denied storage in Chromium and WebKit.

## Regular polygon construction

The optional v5 `polygonTool` field preserves side count, circumradius, angle and center for the next construction. A pending two-tap polygon uses `sketchDraft.tool = "polygon"` and `rectStart`. Completed polygons are ordinary exact line profiles. See [polygon-sketch.md](polygon-sketch.md) for limits and validation.
