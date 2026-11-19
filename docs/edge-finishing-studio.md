# Edge finishing and studio presentation

Select Edge (or Auto near a visible edge), choose Fillet or Chamfer, enter a
positive size in mm and Apply. Fillet uses radius; Chamfer uses equal offsets on
the adjacent faces. Add edges / Shift+click toggles multiple edges of one body.
The immutable canonical B-Rep supplies stable indices for that one transaction.
OCCT validates the new body before commit. Impossible sizes and failed blends
preserve the original; Undo/Redo, save/open, recovery and exact CAD export work
with self-contained edgeFinish recipes. Tangent chains may be propagated by
OCCT; this is not variable-radius or asymmetric chamfer editing.

The studio module uses neutral silver body materials, soft blue body selection,
stronger blue face/edge/point highlights, neutral lights, ACES tone mapping, soft
floor shadows and subdued crease outlines. Ground and outline helpers are in a
separate scene group and never participate in picking, document serialization,
fit bounds or CAD/mesh exports. Crease outlines are display aids; CAD picking
continues to use OCCT topology. Shadows refresh on model/transform changes;
viewport rendering stays responsive during input and drops to a low idle rate.
This avoids repeatedly rendering a fixed shadow map on software WebGL/Windows.

Geometry tests independently check every box edge's removed corner volume,
interacting multiple edges, circular edges, transforms/imports, exact STEP and
invalid-size recovery. Shipping tests verify numeric tools, multi-selection,
history, save/open, STEP, helper-free OBJ output, rendered pixels and screenshots.
The old claim that edge selection exposes no finishing tools is superseded by
this stage. Physical iPad/Pencil/GPU performance is not inferred from CI results.
