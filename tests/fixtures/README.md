# Geometry fixtures

`python-brep.json` is the existing cross-kernel B-Rep compatibility fixture.

`python-hole.iges` and `python-hole-inch.iges` were generated with native Python
CadQuery/OCP, independently of the browser converter. Both describe a centred
20 × 30 × 4 mm plate with a 6 mm through hole. Expected volume is
`2400 - 36*pi` mm³. One file declares millimetres and the other declares inches;
both must import to the same millimetre geometry. The file coordinates are Z-up,
so browser Y-up dimensions are X=20, Y=4, Z=30.

Regenerate using `python tests/fixtures/generate-iges.py` with the optional
backend's Python dependencies. Metadata timestamps can differ; geometric
expectations do not. These are synthetic models with no user project data.
