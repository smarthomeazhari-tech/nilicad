# Public browser-only preview

Preview artifacts live under `preview/`, built from browser-only source commit
`6d5e0c87e7026ab8de003e99692331e7c33edcdc` (PR #8). The generated worker includes
Open CASCADE WebAssembly and license/source notices. No CAD backend or ChatGPT
login is required. Initial engine download is about 22 MiB. STEP is supported;
IGES and nonuniform transforms are not included in this browser kernel.

This deployment branch preserves root `index.html` from main byte for byte.
The repository main branch is not modified. Configure Pages to use this dedicated publication branch to serve the existing
root and the independent `/preview/` path.
If main changes later, refresh the root file from main in this publication branch
without overwriting preview assets. No merge into main is needed for publication.

## Required owner action

The connected GitHub integration can push this branch but cannot change Pages
configuration or environment branch policies (HTTP 403: Resource not accessible
by integration). No Pages settings have been changed by this publication.

Open https://github.com/smarthomeazhari-tech/nilicad/settings/pages and under
Build and deployment choose Deploy from a branch, then branch
`deploy/github-pages-preview`, folder `/(root)`, and Save.
After GitHub finishes its build the preview is expected at
https://smarthomeazhari-tech.github.io/nilicad/preview/ . It returns 404 until
that configuration is applied. The root page remains the preserved main version.

The exact `/nilicad/preview/` path was exercised locally in Chromium and WebKit:
sample project loaded, relative module/worker/WASM assets loaded, the exact cube
volume was 1000 mm³, and no HTTP geometry requests or asset failures occurred.
