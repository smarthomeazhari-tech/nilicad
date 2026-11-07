"""Regenerate independent native Python OCCT fixtures, outside the WASM converter."""
from pathlib import Path
import cadquery as cq
from OCP.IGESControl import IGESControl_Writer

shape = cq.Workplane("XY").box(20, 30, 4).faces(">Z").workplane().hole(6).val()
for unit, name in (("MM", "python-hole.iges"), ("IN", "python-hole-inch.iges")):
    writer = IGESControl_Writer(unit, 1)
    assert writer.AddShape(shape.wrapped)
    writer.ComputeModel()
    assert writer.Write(str(Path(__file__).resolve().parent / name))
