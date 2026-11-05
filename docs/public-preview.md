# Public browser-only preview

Preview artifacts live under `preview/`, built from browser-only source commit
`6d5e0c87e7026ab8de003e99692331e7c33edcdc` (PR #8). The generated worker includes
Open CASCADE WebAssembly and license/source notices. No CAD backend or ChatGPT
login is required. Initial engine download is about 22 MiB. STEP is supported;
IGES and nonuniform transforms are not included in this browser kernel.

This deployment branch preserves root `index.html` from main byte for byte.
The repository main branch is not modified. Pages uses this dedicated publication
branch to serve the existing root and the independent `/preview/` path.
If main changes later, refresh the root file from main in this publication branch
without overwriting preview assets. No merge into main is needed for publication.
