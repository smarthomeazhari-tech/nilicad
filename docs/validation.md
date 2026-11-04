# Running and validating the paired changes

The main branches have not been modified or merged. PRs are stacked so each
stage can be reviewed independently. Deploy both repositories together after
review; the current public main deployment does not contain these changes.

## Local setup

Backend: `pip install -r requirements-dev.txt`, then
`python -m unittest discover -s tests -v` and
`python -m uvicorn server:app --host 127.0.0.1 --port 8765`.

Frontend: `npm ci`, `npx playwright install --with-deps chromium webkit`, then
`npm test`. Tests serve the frontend on a temporary HTTP port, use local pinned
Three.js assets, and call the backend on port 8765. Test-only lexical hooks are
injected into the served HTML; they are absent from the shipping application.
Production currently still loads Three.js from CDN.

To try the app, serve the frontend directory using `python -m http.server 8080`.
Configure the CAD engine address from the existing server settings. iPad needs
an accessible HTTPS backend and frontend; 127.0.0.1 on the iPad is the iPad.
The backend retains its existing open CORS and unauthenticated deployment model.

## Automated coverage

The OCCT unittest suite checks exact face areas, independently extruded region
volumes with no positive-volume overlaps, analytic circle/circle intersections,
nested holes, signed extrusion, single/coincident/disjoint profiles, all three
Boolean volumes, empty intersections, invalid requests, CAD round trips and
ranged STEP download.

Both Chromium and WebKit run the same browser scenarios: touch selection,
visible pull handle, extrusion, undo/redo, overlapping profile splitting,
multi-region negative extrusion, circular holes, exact Boolean volumes,
server failure preserving operands, JSON download/open with raw and exact
sketch regions, invalid project preserving the document, STEP/IGES file
save/import, STL/OBJ/3MF mesh round trips. Screenshots are test artifacts.
Tests use fixture setup through the module hook and actual pointer/form/file
interactions. They do not establish every freehand Pencil gesture.

CI pins a compatible backend commit; update that ref intentionally when its
API changes. No test result on Linux substitutes for physical device acceptance.

## Remaining acceptance boundary

Physical iPad Safari / Apple Pencil and an actual Windows browser are not
available in this executor. Keep the device acceptance issue open until those
checks are run. In particular check Pencil drawing, touch orbit vs selection,
flipping/dragging the pull handle, Files downloads, opening the saved project,
STEP/IGES import, mixed selection and page reload.

Mesh imports preserve triangles and transforms; they do not become analytic
B-Rep solids. Exact CAD operations on them deliberately report unavailable
history. A mesh-to-B-Rep conversion workflow is outside this patch.
