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

Saving requires the explicit Save command and file download. Automatic recovery
after closing a tab is not implemented; merely opening a project does not save
later edits back into that file.
