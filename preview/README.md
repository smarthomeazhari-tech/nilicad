# NiliCAD public preview

Built from `smarthomeazhari-tech/nilicad` branch `feat/browser-occt`, commit
`6d5e0c87e7026ab8de003e99692331e7c33edcdc`, with sample model and local Three.js
assets. This repository contains the generated public preview, not the main
application development branch.

Geometry runs locally in an Open CASCADE WebAssembly Worker. No CAD server or
ChatGPT sign-in is required. Initial geometry-engine download is about 22 MiB.
STEP import/export is supported; IGES and nonuniform scale/shear are not part of
this browser build. Physical iPad/Pencil acceptance remains to be checked.

Licenses and source/build links are retained in `browser-engine/dist/`.
