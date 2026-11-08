# Read-only arbitrary point inspection

Choose Point in the selection strip, then tap a visible CAD edge or Sketch path.
A numeric native-normalized parameter `t ∈ [0,1]` selects arbitrary locations
between display vertices. CAD edges, raw line/arc/circle sketches, unfinished
segments, saved/split B-Rep regions and isolated draft points are supported.
The probe does not record history or change project geometry. A marker/tangent
helper lives outside the document/export group. Camera gestures remain available.

`/paths` returns standalone canonical Sketch edge B-Reps and display polylines.
`/path-point` accepts a canonical edge B-Rep, or a shape B-Rep plus edge index,
and either a world-space position or a normalized native parameter. Position
queries use OCCT minimum-distance projection and return its gap and ambiguity.
Coordinates/derivatives come from the native curve adaptor, not polyline finite
differences. The parameter direction is increasing native u; CAD topological
orientation is reported separately, including an oriented tangent.

The report provides XYZ, native/normalized parameter and range, endpoints,
length from u_min/remaining/total/fraction, tangent/normal/binormal, derivatives
through available order three, curvature/radius/center, torsion, azimuth X→Z and
elevation Y, closed/periodic state, degree/rational/pole/knot metadata where
applicable, and actual B-Rep tolerance. Lengths use mm; curvature/torsion use
1/mm. Derivatives use native u, not time. Material, loads and manufacturing/GD&T
tolerances cannot be inferred from a curve and are not invented.

Line/circle arc lengths are analytic. General curves use adaptive derivative
integration with a 1e-7 mm target and a convergence flag, rather than assuming
native parameter is arc length. Undefined Frenet normals/torsion on straight
lines and singular tangents are shown as undefined. Straight-line radius is
infinite; missing curvature is not labelled infinite. Junction data describes
the selected segment, whose adjacent segment may have different derivatives.

The panel exports the current computed report as JSON; export is disabled while
a changed parameter is pending. Epoch/snapshot guards discard cancelled or stale
results after mode changes, document edits or reopening. Tests verify independent
line/circle/arc/Bezier length/curvature formulas, nonzero cubic torsion, singular
points, transformed CAD edges, invalid requests and seeded points. Protected
shipping tests exercise CAD and Sketch picking, arbitrary parameters, report
exports, unchanged project JSON, camera gestures and cancelled pending probes
in Chromium/WebKit; Windows CI covers Chromium. Physical Pencil remains #6.
