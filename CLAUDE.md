# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Project Overview

PCB THT Holder is a web-based 3D STL generator for THT PCB panels. Users upload a PCB image, mark component positions, and generate a 3D printable holder that keeps THT components straight during soldering.

**Live**: https://segmentcontroller.github.io/pcb-tht-holder/

**Purpose**: Enables neat DIY THT component installation for users who order SMD-assembled PCBs. Works entirely client-side - no registration, PCB images never leave browser.

## Development Commands

```bash
npm run dev              # Start dev server with --host (network accessible)
npm run build            # Production build (outputs to docs/)
npm run preview          # Preview production build

npm run ts:check         # TypeScript checking
npm run format:check     # Check formatting
npm run format:fix       # Auto-fix formatting
npm run lint:check       # ESLint checks
npm run lint:fix         # Auto-fix linting
npm run all              # Run format:fix, lint:fix, ts:check, build

npm run npm:reinstall    # Clean reinstall dependencies
```

## Build Process

Prebuild script:

1. Copies `src/service-worker.template.js` to `public/service-worker.js`
2. Replaces `__VERSION__` placeholder with package version

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
- **State**: svelte-persisted-store (localStorage)

### Key Directory Structure

```
src/
├── stores/           # projectStore, modalStore, undoStore, toastStore, libraryStore
├── types/            # Zod schemas, TypeScript types, type guards (typeGuards.ts)
├── lib/
│   ├── constants.ts  # Centralized constants
│   ├── alignment.ts  # Alignment guide + magnetic snapping
│   ├── 3d/           # STL generation (stl.ts) + mesh operations (mesh.ts)
│   ├── elements/     # Circle, rectangle, leg operations
│   └── svelteModal/  # Modal utilities
├── components/
│   ├── base/         # Reusable components
│   ├── modal/        # Modal dialogs
│   └── (root)        # Main designer components
└── cards/            # Card components
```

### Core Data Flow

1. **projectStore** (persisted): PCB image (base64), panel settings, components (`circles[]`, `rectangles[]`, `legs[]`)
2. **AppDesigner.svelte**: Konva.js Stage for 2D canvas, pointer/measure modes, context menus, keyboard shortcuts
   - **Alignment guides**: Visual blue lines + magnetic snapping (0.2mm range), toggle via Align switch
3. **3D Mesh Generation** (`src/lib/3d/mesh.ts`):
   - Async with progress tracking, yields after each CSG operation
   - Generates 3 meshes: Main (full-depth), Hollow (material-saving), Positive (PCB visualization)
   - **Leg collision detection**: Auto-filters overlapping legs before mesh generation
   - **Print tolerance**: Configurable 0-2mm (enlarges holes, shrinks panel)
   - Optional text label engraving (Three.js TextGeometry, Roboto font)
4. **STL Export** (`src/lib/3d/stl.ts`): Converts to text/binary STL format

### Async Mesh Generation

Flow: `AppNavigation.openDisplay()` → `showModalMesh(meshGenerator)` → `ModalMeshDisplay` → `generateMeshLazy()`

Progress tracking via `onProgress(current, total)` callback. `YIELD_DELAY_MS` in mesh.ts (0 for prod, 10+ for testing).

Operation count: 2 base + 2 empty space + 8 cutouts + (components × 2) + (legs × 2) + positive components + 1 label

### Coordinate Systems (CRITICAL)

- **2D Konva**: Y-down, clockwise rotation
- **3D Three.js**: Y-up, counter-clockwise rotation

**Rectangles**: Rotate around center, 3D rotation negated: `box.rotateZ((-rotation * Math.PI) / 180)`

**Circles**: Center-based positioning (x, y = center)

**Legs**: Top-left positioning (x, y = top-left corner, no rotation support)

### State Management

All stores export: `get{Store}Value()`, `set{Store}Value()`, `update{Store}Value()`

Use `projectJsonSerializer` to skip non-serializable Konva properties.

#### Undo System (`undoStore.ts`)

- Stack-based LIFO, max 50 operations, non-persistent
- Tracks: deletions, property edits, rotation, dimension flip
- Error handling: toast notifications, console logging, retry on failure
- UI: `Ctrl+Z`, Edit menu shows "Undo: {name}"

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

**Default Components**: 14 pre-defined THT components (DIP sockets, capacitors, buzzers, terminals, relays)

- Loaded via `loadDefaultsToLibrary()` with duplicate detection (O(1) Set lookup)
- UI: "Load defaults", Import, Export, Clear buttons in Library modal

**Workflow**: Load defaults → add custom → export JSON → import in future projects

### Constants (`src/lib/constants.ts`)

```typescript
ELEMENT_OPACITY = 0.75;
((CIRCLE_COLOR = 'orange'), (RECTANGLE_COLOR = 'green'), (LEG_COLOR = 'gray'));
POSITIVE_MESH_COLOR = '#ff8811';
FINE_MOVEMENT_DELTA = 0.1; // mm, SHIFT multiplier = 5
((ALIGNMENT_SNAP_THRESHOLD = 0.1), (ALIGNMENT_SNAP_DISTANCE = 0.2));
((ALIGNMENT_LINE_COLOR = '#0088ff'), (ALIGNMENT_LINE_WIDTH = 0.1));
ELEMENT_SKIP_JSON_PROPERTIES = ['fill', 'draggable', 'opacity'];
```

### Type Guards (`src/types/typeGuards.ts`)

**ALWAYS use type guards, NEVER use `'radius' in element`**

```typescript
isCircle(element: GenericElement): element is CircleData
isRectangle(element: GenericElement): element is RectangleData
isLeg(element: GenericElement): element is LegData
```

### Implementation Details

- **Globals**: `__PKG_VERSION__`, `__BASE_URL__` injected at build time
- **Service Worker**: PWA with offline caching, version auto-updated
- **SEO**: Meta tags, sitemap.xml, Google Search Console verification
- **Environment**: Production base path `/pcb-tht-holder`, dev empty string
- **ESLint**: unicorn/all config, import sorting, no console/alert/debugger
- **Requirements**: Node >=24.0.0, npm >=11.0.0

## Keyboard Shortcuts

**Mode**: `P` (Pointer), `M` (Measure)
**Create**: `Shift+C` (circle), `Shift+R` (rectangle), `Shift+L` (leg)
**Edit**: Arrow keys (0.1mm), Shift+Arrow (0.5mm), `R` (rotate +5°), `Shift+R` (reset rotation), `F` (flip dimensions)
**Other**: `Ctrl+Z` (undo), `Shift+P` (settings), `D` (display 3D), `ESC` (close modals)

**Modal Awareness**: All shortcuts disabled when modals open (except ESC). Prevents text input interference.

**Browser Conflict Avoidance**: Shift+letter combos avoid browser shortcuts (copy, reload, print, address bar).

Implementation: `shortcut` action in `src/lib/shortcut.ts` checks `modalStore` state.

## Element Operations

- **Fine Movement** (`fineMovement.ts`): Tracks via `Set<GenericElement>`, provides move/rotate/flip functions
- **Context Menus**: Per-element generators return `ContextMenuItem[]`
- **Hover Info** (`HoverInfo.svelte`): Shows element info + shortcuts, positioned right to avoid overlap

## Testing Workflow

Manual only:

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
