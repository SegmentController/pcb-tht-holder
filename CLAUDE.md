# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PCB THT Holder is a web-based 3D STL generator for THT PCB panels. Users upload a PCB image, mark component positions, and generate a 3D printable holder that keeps THT components straight during soldering.

**Live**: https://segmentcontroller.github.io/pcb-tht-holder/

**Purpose**: Enables neat DIY THT component installation for users who order SMD-assembled PCBs. Works entirely client-side - no registration, PCB images never leave browser.

## Development Commands

```bash
npm run dev              # Start dev server with --host (network accessible)
npm run build            # Production build (outputs to docs/)
npm run preview          # Preview production build

npm run test             # Unit tests (Vitest, Node env)
npm run test:watch       # Vitest watch mode
npx vitest run src/lib/alignment.test.ts   # Single test file
npx vitest run -t "snaps legs"              # Tests matching a name
npm run ts:check         # TypeScript checking
npm run format:check     # Check formatting
npm run format:fix       # Auto-fix formatting
npm run lint:check       # ESLint checks
npm run lint:fix         # Auto-fix linting
npm run all              # Run format:fix, lint:fix, ts:check, test, build

npm run npm:reinstall    # Clean reinstall dependencies
```

## Build Process

The `service-worker` Vite plugin (`vite.config.ts`) emits `service-worker.js` from
`src/service-worker.template.js`, filling in `__VERSION__` (package version) and `__PRECACHE__`
(app shell + hashed entry assets). The 3D stack (three, CSG, threlte) is a lazy chunk loaded when the
3D view opens; the `drop-unused-threlte-assets` plugin removes unreferenced draco/basis files.
The `drop-dark-css` plugin strips every `.dark …` rule (~50 KB, flowbite-svelte emits them) from the
emitted CSS with `postcss`; the app has no dark mode. Remove the plugin before adding one.

Tailwind sources are explicit `@source` directives in `src/app.css` — add a flowbite-svelte
directory there when using a new flowbite component, otherwise its classes are missing.

Outputs to `docs/` directory for GitHub Pages.

## Architecture

### Technology Stack

- **Framework**: Svelte 5 + TypeScript
- **Build**: Vite with path aliases (`$components/*`, `$lib/*`, `$stores/*`, `$types/*`)
- **3D Rendering**: Three.js + @threlte/core
- **3D Operations**: three-bvh-csg for CSG boolean operations
- **2D Canvas**: Konva.js via svelte-konva
- **Validation**: Zod for runtime schemas
- **UI**: Flowbite Svelte + Tailwind CSS 4
- **State**: Svelte stores persisted to localStorage (`projectStore` is hand-rolled, `libraryStore` uses svelte-persisted-store)

### Key Directory Structure

```
src/
├── stores/           # projectStore, modalStore, undoStore, toastStore, libraryStore
├── types/            # Zod schemas, TypeScript types, type guards (typeGuards.ts)
├── lib/
│   ├── constants.ts  # Centralized constants
│   ├── alignment.ts  # Alignment guide + magnetic snapping
│   ├── geometry.ts   # Pure 2D helpers (rotated rectangle extents)
│   ├── zoom.ts       # Wheel/pinch zoom: pure step helpers (unit-tested) + `wheelZoom` action
│   ├── format.ts     # File name timestamp, `formatMm` (display mm, max 2 decimals)
│   ├── gerber/       # Fabrication file import (pure, tested): excellon.ts, gerberOutline.ts, package.ts, unzip.ts (fflate, lazy), plan.ts (clustering → circles/rectangles), plotter.ts (RS-274X layer → SVG), boardSvg.ts (top-view SVG with copper/mask/silk used as the project picture)
│   ├── demos.ts      # Demo project catalogue (files in public/demo/, credits + licences in public/demo/CREDITS.md)
│   ├── 3d/           # STL generation (stl.ts), CSG meshes (mesh.ts), worker + client, placement.ts (dependency-free constants), leg overlap (legOverlap.ts), watertight repair of CSG output (meshRepair.ts)
│   ├── elements/     # Circle, rectangle, leg operations; collection.ts (shared store commit/remove/undo)
│   └── svelteModal/  # Modal utilities
├── components/
│   ├── base/         # Reusable components (ContextMenu, HoverInfo, ToastContainer, PartnerBadge), `input/NumberInputBound.svelte` (min/max clamped number field, `step` 0.1)
│   ├── DemoPicker.svelte  # Demo cards under the dropzone (AppDropzone fetches public/demo/*.tht3d)
│   ├── modal/        # Modal dialogs
│   └── (root)        # Main designer components
└── App*.svelte       # AppDesigner (Konva canvas), AppNavigation (menu, 3D/export), AppDropzone (image/project load)
```

Tests are co-located as `*.test.ts` next to the module they cover.

### Core Data Flow

1. **projectStore** (persisted): PCB image (base64), panel settings, components (`circles[]`, `rectangles[]`, `legs[]`)
   - Not `svelte-persisted-store`: hand-rolled in `projectStore.ts`. Image lives under its own
     localStorage key (`project-image`) and is only rewritten when it changed; writes are debounced
     (250ms) and flushed on `pagehide`/hidden; other tabs are adopted via the `storage` event.
   - `projectJsonSerializer.parse` and `parseStoredProject` fall back to the empty project when
     **any** field fails Zod validation (e.g. rectangle `rotation` outside 0–359 wipes the project),
     so keep schema constraints and the values the UI can produce in sync.
2. **AppDesigner.svelte**: Konva.js Stage for 2D canvas, pointer/measure modes, context menus, keyboard shortcuts
   - **Alignment guides**: Visual blue lines + magnetic snapping (0.2mm range), toggle via Align switch
3. **3D Mesh Generation** (`src/lib/3d/mesh.ts`):
   - Runs in a Web Worker (`mesh.worker.ts`, via `meshClient.ts`) with progress tracking; falls back to the UI thread
   - Variants are generated on demand and memoized per project (`createMeshSession`): Main (full-depth),
     Hollow (material-saving, sliced from the shared base solid), Positive (PCB visualization, display only)
   - Disjoint cutters/legs/pillars are merged into one CSG operand per batch (`partitionDisjoint`);
     overlapping ones must stay in separate batches (parity-based inside test)
   - **Leg collision detection**: Auto-filters overlapping legs before mesh generation (`legOverlap.ts`, pure and unit-tested; `hiddenLegsCount` is reported to the UI)
   - **Print tolerance**: Configurable 0-2mm (enlarges holes, shrinks panel)
   - Optional text label engraving (Three.js TextGeometry, Roboto font)
4. **Mesh repair** (`src/lib/3d/meshRepair.ts`, pure and unit-tested, called from `toMeshInfo`):
   three-bvh-csg output has float-noise seams, T-junctions, zero-area slivers, fins, flipped patches
   and small holes, which slicers report as thousands of "open edges". `repairMesh` welds (2e-4 mm),
   drops degenerate triangles, splits edges at T-junctions, re-orients flipped patches, removes fins and
   fills small planar holes; `countOpenEdges` matches vertices by exact coordinates like a slicer does.
   - Larger weld radii (1e-3 and up) make seams _worse_; keep tolerance and weld radius equal.
   - `mesh.test.ts` asserts zero open edges **and** origin-independent volume (closed, consistently
     oriented). Raw CSG volumes of the hollow variant were origin-dependent by tens of mm³.
   - Edges shared by 4 triangles (two parts touching along a line) are left as they are.
5. **STL Export** (`src/lib/3d/stl.ts`): Binary STL only (the ASCII writer was removed in 1.14.0)

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

### Coordinate Systems (CRITICAL)

- **2D Konva**: Y-down, clockwise rotation
- **3D Three.js**: Y-up, counter-clockwise rotation

**Rectangles**: Rotate around center, 3D rotation negated: `box.rotateZ((-rotation * Math.PI) / 180)`

**Circles**: Center-based positioning (x, y = center)

**Legs**: Top-left positioning (x, y = top-left corner, no rotation support)

### State Management

All stores export: `get{Store}Value()`, `set{Store}Value()`, `update{Store}Value()`

Use `projectJsonSerializer` to skip non-serializable Konva properties.

#### Undo/Redo System (`undoStore.ts`)

- Two LIFO stacks, max 50 undo operations, non-persistent; the redo stack is bounded by it
- `addUndo(name, undo, redo, coalesceKey?)`: every entry carries both closures (absolute values / element
  references, so interleaved moves cannot corrupt them). A new entry clears the redo stack; coalescing
  (`rotate:<id>`, 1.5 s) keeps the oldest `undo` and replaces `redo` with the newest
- Tracks: deletions, property edits, rotation, dimension flip, moves (`moveWithUndo` in `collection.ts`: one entry
  per mouse drag, arrow-key nudges coalesce per element as `nudge:<id>`; a move to the same position adds none)
- Error handling: toast notifications, console logging, entry stays on its stack for retry
- UI: `Ctrl+Z`, `Ctrl/Cmd+Shift+Z` and `Ctrl+Y` (redo; `Cmd+Y` is the browser's History and left alone). The Edit
  menu always lists "Undo: {name}" / "Redo: {name}" (disabled when empty) with the step counts from `undoStoreHistory`;
  the Align checkbox lives in the same menu
- The shortcut matches `event.key` exactly and the key case flips with Shift (and can with Caps Lock), so the
  handler is registered for both `z` and `Z` and routes by `shiftKey`

#### Toast Notifications (`toastStore.ts`)

- Types: `success`, `error`, `warning`, `info`
- Auto-removal via setTimeout, manual dismiss via UUID
- Position: bottom-right, z-50
- Usage: `toastStore.error(message, duration)`, `toastStore.push(type, message, duration)`

#### Library System (`libraryStore.ts`)

Saves component specs (dimensions, depth, rotation) for reuse. Persisted to localStorage.

**Data**: Array of `LibraryItem` (circle | rectangle)

```typescript
// Circle: { type: 'circle', name, radius, depth }
// Rectangle: { type: 'rectangle', name, width, height, depth, rotation }
```

**Default Components**: 13 pre-defined THT components (DIP sockets, capacitors, buzzers, terminals, relays)

- Loaded via `loadDefaultsToLibrary()` with duplicate detection (O(1) Set lookup)
- UI: "Load defaults", Import, Export, Clear buttons in Library modal

**Workflow**: Load defaults → add custom → export JSON → import in future projects

### Constants (`src/lib/constants.ts`)

```text
ELEMENT_OPACITY = 0.75
CIRCLE_COLOR = 'orange'; RECTANGLE_COLOR = 'green'; LEG_COLOR = 'gray'
POSITIVE_MESH_COLOR = '#ff8811'
FINE_MOVEMENT_DELTA = 0.1 // mm, SHIFT multiplier = 5
ALIGNMENT_SNAP_THRESHOLD = 0.1; ALIGNMENT_SNAP_DISTANCE = 0.2
ALIGNMENT_LINE_COLOR = '#0088ff'; ALIGNMENT_LINE_WIDTH = 0.1
ZOOM_MIN = 10; ZOOM_MAX = 300; ZOOM_STEP = 10; ZOOM_DEFAULT = 100 // percent, shared by slider, +/-/* and wheel
ELEMENT_SKIP_JSON_PROPERTIES = ['fill', 'draggable', 'opacity']
```

### Type Guards (`src/types/typeGuards.ts`)

**ALWAYS use type guards, NEVER use `'radius' in element`**

```typescript
isCircle(element: GenericElement): element is CircleData
isRectangle(element: GenericElement): element is RectangleData
isLeg(element: GenericElement): element is LegData
```

### Threlte BufferGeometry Pattern

**NEVER use `T.BufferAttribute` with `args` array** — in Vite 8 production builds this causes a `byteLength` crash.

**Use `T.BufferGeometry oncreate` instead** to set buffer attributes and compute normals:

```svelte
import { BufferAttribute } from 'three';

const setupGeometry = (geo: BufferGeometry) => {
  geo.setAttribute('position', new BufferAttribute(vertices, 3));
  geo.computeVertexNormals();
};
// ...
<T.BufferGeometry oncreate={setupGeometry} />
```

See `Mesh3DScene.svelte` for the canonical example.

### Implementation Details

- **Globals**: `__PKG_VERSION__`, `__BASE_URL__` injected at build time
- **Service Worker**: PWA with offline caching, version auto-updated
- **SEO**: Meta tags, sitemap.xml, Google Search Console verification
- **Project loading** (`AppDropzone.svelte`): `.tht3d` uploads and demos both go through `loadProjectData()`
  (Zod validation, one store write incl. label and zoom, embedded image via `onFileUpload`); a new image upload
  and File > New clear the print label
- **Gerber import** (`AppDropzone.svelte` → `importFabFiles`, review dialog `ModalGerberImport.svelte`): routed by file
  name extension (`isFabFileName`), before the MIME check. Stored y is plain CAM Y-up (`y = gerberY - outlineMinY`,
  the designer flips the picture itself); the board outline bbox (rounded up to 0.1) is the panel, clamped to the 10–999 mm
  limits of the settings dialog. Holes of the same diameter within `groupDistance` form one part: lone hole → circle,
  several → min-area oriented rectangle padded by half the pitch (rotation = CCW angle in CAM coordinates). The project
  image is a generated SVG data URL (no image-less projects), so restore, `.tht3d` and 3D work unchanged. The designer draws generated (SVG) pictures opaque and photos at 25 % (`isGeneratedImage`). Layers are SVG `<mask>`s in CAM coordinates (dark = white, clear = black, so clear polarity needs no special case); mask-layer dark objects are the openings. Pictures above 1.5 MB fall back to outline + holes (`renderProjectImage`)
- **Standards followed by the gerber library** (`src/lib/gerber/`): Ucamco Gerber Layer Format (plotter, rev. 2026.05) and
  XNC (drills, rev. 2021.11) plus the dialects of real CAD output. Layer role: X2 `FileFunction` first, then names
  (`roleOf`); polarity: `.FilePolarity`/`IPNEG` (mask dark = openings unless declared Positive). Excellon without a
  declared layout is parsed with the defaults and re-parsed with candidate layouts when the holes miss the outline
  (`refineLayout`). Tool defaults (`defaultToolKeys`): component role or plated >= 0.7 mm, never vias, non-plated or blind.
  When adding syntax support add a case to `plotter.test.ts` / `excellon.test.ts` that cites the spec section
- **Partner Badge** (`PartnerBadge.svelte`): SkipTheCAD listing badge, fixed top-right from `xl` up and below the header on smaller screens, auto-hides after 7s; mounted once in `App.svelte` right after `AppNavigation`
- **Number fields** (`NumberInputBound.svelte`): `step` defaults to 0.1 so one decimal digit is valid (the browser
  default of 1 rejects decimals and blocks the dialog's submit); all dialogs use it. Values with two or more
  decimals fail native validation, so keep demo/library sizes at one decimal
- **Header** (`AppNavigation.svelte`): `NavContainer` is `fluid` with a fixed `w-[960px] max-w-full` (px, not %), so it
  only shrinks below 960 px viewports
- **Project settings**: the Print label row has an icon-only button that copies the project name into the label
  (enabled only while the label is empty)
- **Icons** (`src/lib/icons.ts`): MDI icons are bundled offline (`addCollection`); a new `mdi:` icon must be added
  there or it will not render
- **Vite config**: ESM-native — `node:path`, `import.meta.dirname` (no `__dirname`), `package.json` imported with `with { type: 'json' }`
- **Environment**: Production base path `/pcb-tht-holder`, dev empty string
- **ESLint**: unicorn/all config, import sorting, no console/alert/debugger
- **Requirements**: Node >=24.0.0, npm >=11.0.0
- **Svelte 5 rune syntax**: all components use `$props()`, `$state()`, `$derived()` — no `export let` props

## Keyboard Shortcuts

**Mode**: `P` (Pointer), `M` (Measure)
**Create**: `Shift+C` (circle), `Shift+R` (rectangle), `Shift+L` (leg)
**Edit**: Arrow keys (0.1mm), Shift+Arrow (0.5mm), `R` (rotate +5°), `Shift+R` (reset rotation), `F` (flip dimensions)
**View**: `+` / `-` (zoom ±10%), `*` (reset zoom), `Ctrl/Cmd+wheel` or trackpad pinch (zoom at cursor, `wheelZoom` action in `zoom.ts`)
**Other**: `Ctrl+Z` (undo), `Ctrl/Cmd+Shift+Z` or `Ctrl+Y` (redo), `Shift+P` (settings), `D` (display 3D), `ESC` (close modals)

**Modal Awareness**: All shortcuts disabled when modals open (except ESC). Prevents text input interference.

**Browser Conflict Avoidance**: Shift+letter combos avoid browser shortcuts (copy, reload, print, address bar).

Implementation: `shortcut` action in `src/lib/shortcut.ts` checks `modalStore` state.

## Element Operations

- **Fine Movement** (`fineMovement.ts`): Tracks via `Set<GenericElement>`, provides move/rotate/flip functions
- **Context Menus**: Per-element generators return `ContextMenuItem[]`; `ContextMenu.svelte` moves focus into the
  menu on open, handles Arrow/Home/End (stopping propagation so fine movement does not fire) and restores focus on ESC
- **Canvas wrapper** (`AppDesigner.svelte`): `justify-center-safe overflow-x-auto` keeps a zoomed-in canvas
  scrollable from its left edge; `ContextMenu` uses page coordinates, so keep the wrapper non-positioned
- **Accessibility**: `<main>` landmark in `App.svelte`, labelled canvas region, `aria-haspopup`/`aria-expanded` on
  the File/Edit triggers; the Edit menu reads `$projectStore`/`$libraryStore` (never `get()`) so it stays current
- **Hover Info** (`HoverInfo.svelte`): Shows element info + shortcuts, positioned right to avoid overlap

## Testing Workflow

### Unit tests (Vitest)

`npm run test` runs `src/**/*.test.ts` in a Node environment (no DOM). Tests are co-located with the
module they cover. Covered: alignment, STL export, mesh repair, leg overlap (`src/lib/3d/legOverlap.ts`), Zod
schemas/type guards, project serializer, undo/toast/library/modal stores. Keep logic that must be
tested free of `three-bvh-csg`, Konva and `.svelte` imports (extract it into a plain `.ts` module);
tests use explicit `import { describe, it, expect } from 'vitest'` (no globals). CI runs the suite.

`vite.config.ts` aliases `three-bvh-csg` to its ESM source for tests: its UMD `main` would
`require('three')` and load a second, deprecated copy (`three.cjs`) with a warning.

### Manual checklist (visual / 3D)

1. Upload PCB → verify transparency/flip
2. Place components → adjust depth/height/rotation
3. Test rotation → verify 2D/3D match
4. Test boundaries → rotated rectangles stay in panel
5. Add legs → verify positioning
6. Generate mesh → check wireframe/solid/positive mesh
7. Export STL → validate in slicer

## Code Quality Standards

### Use Type Guards

```typescript
// Good
if (isCircle(element)) { ... }
// Bad
if ('radius' in element) { ... }
```

### Use Constants

```typescript
import { CIRCLE_COLOR, ELEMENT_OPACITY, FINE_MOVEMENT_DELTA } from '$lib/constants';
```

### Coordinate System Awareness

- Rectangles rotate around **center** (not top-left)
- Negate rotation for 2D → 3D: `(-rotation * Math.PI) / 180`
- Account for Y-axis flip: Konva (down) vs Three.js (up)
