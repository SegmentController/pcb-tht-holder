# 3D mesh generation (src/lib/3d)

- **3D Mesh Generation** (`src/lib/3d/mesh.ts`):
  - Runs in a Web Worker (`mesh.worker.ts`, via `meshClient.ts`) with progress tracking; falls back to the UI thread
  - Variants are generated on demand and memoized per project (`createMeshSession`): Main (full-depth),
    Hollow (material-saving, sliced from the shared base solid), Positive (PCB visualization, display only)
  - Disjoint cutters/legs/pillars are merged into one CSG operand per batch (`partitionDisjoint`);
    overlapping ones must stay in separate batches (parity-based inside test)
  - **Leg collision detection**: Auto-filters overlapping legs before mesh generation (`legOverlap.ts`, pure and unit-tested; `hiddenLegsCount` is reported to the UI)
  - **Print tolerance**: Configurable 0-2mm (enlarges holes, shrinks panel)
  - Optional text label engraving (Three.js TextGeometry, Roboto font; the font is only loaded when the project has a label, `createMeshSession(project, font?)` throws on a label without a font)
- **Mesh repair** (`src/lib/3d/meshRepair.ts`, pure and unit-tested, called from `toMeshInfo`):
  three-bvh-csg output has float-noise seams, T-junctions, zero-area slivers, fins, flipped patches
  and small holes, which slicers report as thousands of "open edges". `repairMesh(positions, index?)` takes the
  indexed CSG geometry as is (no non-indexed expansion) and welds (2e-4 mm),
  drops degenerate triangles, splits edges at T-junctions, re-orients flipped patches, removes fins and
  fills small planar holes; `countOpenEdges` matches vertices by exact coordinates like a slicer does.
  - Larger weld radii (1e-3 and up) make seams _worse_; keep tolerance and weld radius equal.
  - `mesh.test.ts` asserts zero open edges **and** origin-independent volume (closed, consistently
    oriented). Raw CSG volumes of the hollow variant were origin-dependent by tens of mm³.
  - Edges shared by 4 triangles (two parts touching along a line) are left as they are.
- **STL Export** (`src/lib/3d/stl.ts`): Binary STL only

### Async Mesh Generation

Flow: `AppNavigation.openDisplay()` → `showModalMesh(name, project)` → `ModalMeshDisplay` →
`createMeshClient(project).generate(kind, onProgress)` → `mesh.worker.ts` → `createMeshSession().generate(kind)`.

- The worker keeps the latest session (keyed by project content without zoom), so reopening the 3D view or
  toggling Hollow/PCB reuses solids; closing the modal sends a cancel that stops at the next operation.
- Progress via `onProgress(current, total)`. `YIELD_DELAY_MS` in mesh.ts (0 for prod, 10+ for testing).
- Operation count per variant is derived from the batches (`solidOperations`, `mainOperations`,
  `hollowOperations`, `positiveOperations` in `createMeshSession`): keep them in sync when adding CSG steps
  or the progress bar misreports.
- Regression tests (`mesh.test.ts`) compare volume and bounds, not triangle counts, and require zero
  open edges and an origin-independent volume (see Mesh repair above). Positive pillars sink
  1 mm into the base plate (coplanar contact faces blow up the CSG triangulation).
- three-bvh-csg 0.0.18 logs a deprecated `maxLeafSize` warning; it is filtered in the worker.
