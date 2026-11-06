# Current validation and acceptance

The Cloudflare release branch is `feat/private-preview-auth`. Main remains
unchanged. The private deployment runs exact OCCT WebAssembly locally; it needs
no geometry server. See [browser-engine.md](browser-engine.md) and
[project-format.md](project-format.md).

## Linux Chromium and WebKit

```sh
npm ci
npx playwright install --with-deps chromium webkit
npm test
```

The 22 test groups cover exact primitives and Booleans (including empty
intersections), independent overlapping/nested regions, circular holes, signed
multiple extrusion, old Python B-Rep compatibility and asymmetric STEP round
trips. Browser tests exercise selection, actual drawing, pull drag/cancel,
interrupted pen events, private authenticated rendering, JSON save/open,
unfinished sketches, undo/redo, invalid-file preservation, and STL/OBJ/3MF.
Geometry requests must stay inside the browser. Private UI startup is tested
with a tablet viewport; blocked app downloads must show an error.
The protected Chromium scenario deliberately loses and restores its WebGL
context, checks the visible recovery status and unchanged document, then reads
rendered pixels again. A graphics-driver reset must not discard the project.

Boolean UI coverage selects the second body with a real touch, checks that both
consumed meshes leave the scene, and checks the exact resulting volume for all
three operations. Chromium also performs a real one-finger orbit after each
operation. Touch release must reach OrbitControls even when it selects a body.
Empty intersections and fully consumed Subtract results remove their operands;
Undo restores them. Errors and cancelled calculations preserve their operands.

## Windows Chromium

The `windows` job in `.github/workflows/cad-ui.yml` runs on `windows-latest`,
builds the private bundle on Windows, and runs geometry/authentication checks
plus all four Chromium browser scenarios. Each browser test prints the OS and
browser version; screenshots are uploaded as a separate Windows artifact.

To reproduce on Windows after `npm ci`:

```sh
npx playwright install chromium
npm run build:private
node --test tests/browser-kernel.test.cjs tests/private-auth.test.cjs
node --test --test-concurrency=1 --test-name-pattern=chromium tests/ui.test.cjs tests/private-auth-ui.test.cjs tests/project-draft.test.cjs tests/acceptance.test.cjs
```

Automated Chromium on a Windows runner establishes that tested configuration.
It does not establish every Windows browser or interactive hardware gesture.

## Optional Python engine

The existing `nilicad-occt-server` review branches remain available. In that
repository run `pip install -r requirements-dev.txt` then
`python -m unittest discover -s tests -v`. Eight test groups cover exact splitting,
holes, signed extrusion, all Booleans, STEP/IGES round trips, malformed requests
and ranged downloads. These server results do not imply browser IGES support.

## Physical acceptance and limits

The owner confirmed private login and the repaired viewport on their iPad
Safari. Pencil gestures, modeling, Files downloads and interoperable STEP still
need physical-device confirmation in GitHub issue #6. Linux WebKit is not a
physical Safari test. IGES is unavailable in the current serverless package
(issue #13); STEP is the supported exact interchange format. Nonuniform
scale/shear are rejected. Imported mesh files do not gain analytic CAD history.

See [DEPLOYMENT.md](../DEPLOYMENT.md) for the current Worker build branch,
commands and runtime login-secret settings. Browser test results alone do not
prove a particular Cloudflare deployment has received the latest commit.

## Shipping-build acceptance without internal hooks

`tests/acceptance.test.cjs` serves the actual protected distribution, without
injecting testEval or invoking private application functions. Both browsers draw
overlapping profiles with pointer input, select regions by touch, extrude in the
negative direction, use visible Undo/Redo, save/open JSON, export/import STEP,
and round-trip STL/OBJ/3MF. They then draw overlapping solids and run each Boolean
through visible controls. Saved output is independently checked with OCCT and
rectangle/box area-volume formulas. This caught missing visible history controls
and inconsistent sketch mode after new-project/load/extrusion.

Creating a new project cancels pending Boolean/move/draft state. Test files run
sequentially to avoid competing WebGL contexts, with explicit browser-test and
CI time limits. Screenshots include shipping-browser success/failure artifacts.

The shipping scenario also switches from Rectangle to Circle and draws a hole
inside that closed rectangle, checking `(rectangle area - pi*r^2)*depth`. It
draws a three-point arc with connected lines and checks extrusion against the
analytic circular-segment area. Chromium generates native pen-type pointer
events through CDP; an event observer verifies that pen input reached the page.
WebKit runs the same drawing/file workflow with mouse and touch input. Neither
case substitutes for a physical Apple Pencil test.
