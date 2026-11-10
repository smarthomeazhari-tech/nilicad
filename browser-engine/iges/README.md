# Optional browser IGES converter

The application uses exact STEP as a bridge between its persistent modeling
kernel and a separate, short-lived IGES worker. `converter.cpp` exposes only
STEP-to-IGES and IGES-to-STEP conversion, checks OCCT shape validity, exports
millimetres and IGES B-Rep mode, and catches conversion failures. No modeling
data is sent to an HTTP geometry service.

The module was built in GitHub Actions run `42307271744`, artifact `13547580549`.
`vendor/manifest.json` records the pinned image, source hashes, uncompressed file
sizes and SHA-256 values. Compressed artifacts are checked and inflated during
the normal Node build, so Cloudflare and Windows do not need a C++ toolchain or
Docker. The build splits the 11 MiB WASM into authenticated <=4 MiB assets and
the Worker verifies the assembled SHA-256 before initialization.

## Rebuild and replace

On Linux with Docker and at least 10 GiB of available build space:

```sh
python3 browser-engine/iges/build.py
```

The script pulls the immutable amd64 image digest in `build.py` and compiles with
network disabled. It writes gzip artifacts, hashes and compiler provenance to
`generated/`. Review and test new output before replacing the corresponding
`vendor/*.gz` and `vendor/manifest.json`; source and hashes must match. Run
`npm run build:private` and `npm test`, then verify Windows CI as well. A normal
application build does not download or execute a build image.

The image is from `taucad/opencascade.js` source revision `ebd263f1` and contains
the complete corresponding OCCT source under `/occt`. The source/build image is
public at the exact digest in the manifest. The converter source and build
configuration are in this directory and can be modified/relinked to replace
the shipped module. OCCT's LGPL-2.1 license and exception are retained in
`vendor/`, copied into the static distribution, and referenced in its notice.

## Lifetime and validation boundary

The converter is downloaded on demand, has a 32 MiB initial WASM heap and a
512 MiB maximum, and is terminated after success, failure or a 120-second
timeout. Idle modeling workers are retired before conversion to reduce overlap;
the modeling engine can be loaded again on the next operation. Heap size is not
total process memory. CAD input and converted output files are limited to 20 MB.

Tests cover closed solids, holes, asymmetric dimensions/transforms, negative
extrusion and disconnected bodies, plus an independent Python OCCT IGES fixture.
The browser scenarios exercise real downloads/imports and missing/corrupt assets.
These establish the tested interchange cases, not every vendor-specific IGES
entity or physical iPad memory/peripheral configuration. Unsupported/corrupt
data must report an error and preserve the current document.

The original full `opencascade.js@1.1.1` probe was rejected for broken generated
CString bindings; the newer full beta used about 821 MiB RSS in a Node probe.
Neither is a runtime dependency. The minimal converter probe used the initial
32 MiB WASM heap; its total process RSS was approximately 327 MiB on that host.
