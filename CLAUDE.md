# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PCB THT Holder is a web-based 3D STL file generator for THT (Through Hole Technology) PCB panels. It allows users to upload a PCB image, mark component positions (circles and rectangles), and generate a 3D printable holder that keeps THT components straight during soldering.

**Live deployment**: https://segmentcontroller.github.io/pcb-tht-holder/

**Purpose**: This tool solves the challenge of neat THT component installation for DIY PCB assembly. Users who order SMD-assembled PCBs but install THT components at home can create custom 3D-printed holders that keep components (relays, capacitors, resistors, terminals, pin-headers) perfectly straight during soldering. The tool works entirely client-side - no registration required, PCB images never leave the browser.

## Development Commands

### Core Development

```bash
npm run dev              # Start dev server with --host flag (accessible on network)
npm run build            # Build for production (outputs to docs/)
npm run preview          # Preview production build
```

### Code Quality

```bash
npm run ts:check         # Run TypeScript type checking with svelte-check
npm run format:check     # Check code formatting with Prettier
npm run format:fix       # Auto-fix formatting issues
npm run lint:check       # Run ESLint checks
npm run lint:fix         # Auto-fix linting issues
npm run all              # Run format:fix, lint:fix, ts:check, and build sequentially
```

### Other

```bash
npm run npm:reinstall    # Clean reinstall of all dependencies
```

## Build Process

The `prebuild` script automatically:

1. Copies `src/service-worker.template.js` to `public/service-worker.js`
2. Replaces `__VERSION__` placeholder with current package version

Build outputs to `docs/` directory (configured for GitHub Pages deployment).

## Architecture

### Technology Stack

- **Framework**: Svelte 5 with TypeScript
- **Build Tool**: Vite with custom path aliases
- **3D Rendering**: Three.js with @threlte/core and @threlte/extras
- **3D Operations**: three-bvh-csg for boolean mesh operations (CSG)
- **2D Canvas**: Konva.js via svelte-konva for designer interface
- **Validation**: Zod for runtime type validation
- **UI Components**: Flowbite Svelte with Tailwind CSS 4
- **State**: svelte-persisted-store for local storage persistence

### Path Aliases (configured in vite.config.ts and tsconfig.json)

- `$components/*` → `./src/components/*`
- `$lib/*` → `./src/lib/*`
- `$stores/*` → `./src/stores/*`
- `$types/*` → `./src/types/*`

### Key Directory Structure

```
src/
├── stores/           # Svelte stores (projectStore, modalStore, undoStore, libraryStore)
├── types/            # Zod schemas, TypeScript types, and type guards
│   ├── typeGuards.ts # Type guard functions (isCircle, isRectangle, isLeg)
│   └── panels/       # Panel-specific type definitions
├── lib/
│   ├── constants.ts  # Centralized constants (colors, opacity, movement deltas, alignment)
│   ├── alignment.ts  # Alignment guide detection and magnetic snapping calculations
│   ├── 3d/           # STL generation (stl.ts) and mesh operations (mesh.ts)
│   ├── elements/     # Circle, rectangle, and leg element operations
│   └── svelteModal/  # Modal management utilities
├── components/
│   ├── base/         # Reusable base components
│   ├── modal/        # Modal dialogs (settings, library, mesh display)
│   └── (root)        # Main designer components (3D scene, grid, crosshair)
└── cards/            # Card components for UI panels
    ├── SystemCards/
    └── PanelCards/
```

### Core Data Flow

1. **Project State**: Central `projectStore` (persisted to localStorage) holds:
   - PCB image (base64)
   - Panel settings (width, height, PCB thickness, SMD height, print tolerance)
   - Component arrays: `circles[]`, `rectangles[]`, `legs[]`
   - Validated with Zod schemas at runtime

2. **Designer Interface** (`AppDesigner.svelte`):
   - Konva.js Stage for 2D canvas manipulation
   - User places circles/rectangles over PCB image
   - Supports pointer and measure modes
   - Context menus for element operations
   - Fine movement controls with keyboard shortcuts
   - **Alignment guides with magnetic snapping** (v1.13.0+):
     - Visual blue lines display when elements align with other elements (centers/edges)
     - Automatic magnetic snapping within 0.2mm of alignment points during drag
     - Toggle controlled via Align switch in navigation bar (persisted to localStorage)
     - Snapping works independently on X and Y axes
     - Implementation in `src/lib/alignment.ts`:
       - `detectAlignments()`: Calculates and returns visual alignment lines
       - `calculateSnapPosition()`: Calculates snapped position for magnetic effect
       - Uses `ALIGNMENT_SNAP_THRESHOLD` (0.1mm) for visual detection
       - Uses `ALIGNMENT_SNAP_DISTANCE` (0.2mm) for magnetic snapping range

3. **3D Mesh Generation** (`src/lib/3d/mesh.ts`):
   - **Async architecture** (v1.12.0+):
     - `generateMesh()` is async and yields control to event loop after every CSG operation
     - Prevents UI freezing with 100+ components
     - Accepts optional `onProgress(current, total)` callback for real-time progress tracking
     - `YIELD_DELAY_MS` constant controls yield delay (0 for production, 10+ for testing)
     - Total operations calculated upfront for accurate progress percentage
   - Uses CSG boolean operations (ADDITION/SUBTRACTION) via three-bvh-csg
   - Generates three meshes:
     - **Main mesh**: Full-depth holder with component holes
     - **Hollow mesh**: Shallow version with reduced material usage
     - **Positive mesh**: Inverted design showing components as pillars (for PCB visualization)
   - Creates base structure, subtracts component holes, adds support legs
   - **Automatic leg collision detection** (v1.11.3+):
     - Legs overlapping with components are automatically filtered before mesh generation
     - Prevents CSG conflicts where geometry is both subtracted (component holes) and added (legs)
     - `isLegOverlappingCircle()`: Closest-point-on-rectangle algorithm for circle collision
     - `isLegOverlappingRectangle()`: AABB test for non-rotated, corner-in-shape test for rotated rectangles
     - Returns `hiddenLegsCount` in `MeshInfoTuple` for user notification
     - Warning displayed in mesh modal when legs are filtered
     - Leg filtering done early to ensure accurate operation count for progress tracking
   - **Print tolerance** application (v1.11.2+, fixed in v1.12.0):
     - Configurable tolerance setting (0-2mm with 0.1mm precision, default 0mm)
     - Compensates for 3D printer dimensional inaccuracies
     - Enlarges component holes: adds tolerance to circle radius and rectangle dimensions
     - Shrinks holder panel: subtracts tolerance from panel width/height (fixed direction in v1.12.0)
     - Component centers stay in original positions (fixed in v1.12.0)
     - Ensures THT components fit easily while holder grips PCB snugly
     - Not applied to positive mesh (visualization only)
     - Configured via Project Settings modal (`printTolerance` field in PanelSettings)
   - Optional text label engraving using Three.js TextGeometry
   - Loads Roboto font from `/roboto_regular.json`

4. **STL Export** (`src/lib/3d/stl.ts`):
   - Converts Three.js mesh vertices to STL format
   - Supports both text and binary STL output
   - Binary format uses custom buffer writing utilities

### Async Mesh Generation & Progress Tracking

**Architecture** (v1.12.0+):

The mesh generation uses an async generator pattern to provide progress feedback and prevent UI blocking:

1. **AppNavigation.svelte** (`openDisplay()` function):
   - Creates a `meshGenerator` function that accepts a progress callback
   - Passes generator to `showModalMesh()` instead of a Promise

2. **modalStore.ts** (`showModalMesh()`):
   - Accepts `meshGenerator: (onProgress) => Promise<MeshInfoTuple>`
   - Passes generator function to modal component

3. **ModalMeshDisplay.svelte**:
   - Creates local `progressCallback` that updates reactive `progress` state
   - Calls `meshGenerator(progressCallback)` to start generation with progress tracking
   - Displays progress bar UI with percentage and visual indicator
   - Shows "Initializing..." before first progress update

4. **mesh.ts** (`generateMesh()` and `generateMeshLazy()`):
   - Async functions that accept optional `onProgress(current, total)` callback
   - Calculates total operations upfront (base meshes, cutouts, components, legs)
   - After each CSG operation: calls `onProgress()` then `await yieldToEventLoop()`
   - `yieldToEventLoop()` uses `setTimeout(resolve, YIELD_DELAY_MS)` to yield control

**Operation Counting:**

Total operations =

- 2 (base meshes: main + hollow)
- 2 (empty space subtraction: main + hollow)
- 8 (edge cutouts: 4 positions × 2 meshes)
- `rectangles.length * 2` (holes in main + hollow per rectangle)
- `circles.length * 2` (holes in main + hollow per circle)
- `filteredLegs.length * 2` (additions to main + hollow per leg)
- `rectangles.length + circles.length` (positive mesh components)
- 1 (optional text label)

**Performance:**

With 100 rectangles:

- ~207 total operations
- With `YIELD_DELAY_MS = 0`: Instant yielding, UI stays responsive, generation takes <1 second
- With `YIELD_DELAY_MS = 10`: Visible progress animation, generation takes ~2 seconds

**Configuration:**

Set `YIELD_DELAY_MS` in `src/lib/3d/mesh.ts`:

- `0` for production (recommended - instant yielding, no artificial delay)
- `10+` for testing progress UI visibility

### Important Implementation Details

- **Global Variables**: `__PKG_VERSION__` and `__BASE_URL__` are injected at build time via Vite's define config
- **Service Worker**: PWA support with offline caching, version auto-updated during build
- **SEO Infrastructure**:
  - `index.html` includes meta description, keywords, and Open Graph tags for search engines and social media
  - `sitemap.xml` in public/ directory for search engine indexing
  - Google Search Console verification file for site ownership verification
- **Environment Detection**: Production base path is `/pcb-tht-holder`, dev is empty string
- **Strict ESLint**: Uses unicorn/all config with custom overrides, enforces import sorting, no console/alert/debugger
- **Node Version**: Requires Node >=24.0.0, npm >=11.0.0
- **Code Documentation**: Codebase includes comprehensive JSDoc comments for functions, types, and complex logic

### Coordinate Systems and Rotation

**Critical: The 2D canvas and 3D mesh use different coordinate systems**

- **2D Konva Canvas**: Y-axis increases downward, rotation clockwise
- **3D Three.js Scene**: Y-axis increases upward, rotation counter-clockwise

**Rectangle Rotation Implementation (v1.10.0+):**

- Rectangles rotate around their **center** (x, y is the center position)
- 2D canvas (`AppDesigner.svelte`): Konva Rect with `offsetX`/`offsetY` set to center, `rotation={rectangle.rotation}`
- 3D mesh (`src/lib/3d/mesh.ts`):
  - Geometry created at center (no translation needed)
  - Positioned at center in world space
  - Rotation angle is **negated** to match 2D direction: `box.rotateZ((-rectangle.rotation * Math.PI) / 180)`

**Boundary Limiting:**

- Rectangles with rotation require axis-aligned bounding box (AABB) calculation
- `limitBox()` function in `AppDesigner.svelte` rotates all 4 corners around center and finds min/max bounds
- Ensures rotated rectangles stay within panel boundaries

**Circles:**

- Center-based positioning (x, y is the circle center)
- Boundaries account for radius on all sides

**Legs:**

- Top-left corner positioning (x, y is the top-left corner, unlike circles/rectangles)
- Always axis-aligned (no rotation support)
- **Collision Detection** (v1.11.3+):
  - Automatically filtered if overlapping with any component (circle or rectangle)
  - Leg-to-circle: Uses closest-point-on-rectangle algorithm (distance check)
  - Leg-to-rectangle: AABB test for non-rotated, corner-in-shape test for rotated rectangles
  - Filtered legs are not added to mesh, preventing CSG conflicts
  - Count of hidden legs tracked and displayed to user

### State Management Patterns

All stores export convenience functions:

```typescript
// Example from projectStore.ts
export const getProjectStoreValue = (): Project => get(projectStore);
export const setProjectStoreValue = (project: Project) => projectStore.set(project);
export const updateProjectStoreValue = (updater: Updater<Project>) => projectStore.update(updater);
```

Use `projectJsonSerializer` when working with project JSON to skip non-serializable properties (Konva internal state).

### Constants and Configuration (`src/lib/constants.ts`)

Centralized configuration for maintainability:

```typescript
// Element visual properties
ELEMENT_OPACITY = 0.75;
ELEMENT_DRAGGABLE = true;

// Element colors
CIRCLE_COLOR = 'orange';
RECTANGLE_COLOR = 'green';
LEG_COLOR = 'gray';

// 3D mesh colors
POSITIVE_MESH_COLOR = '#ff8811'; // Orange color for PCB visualization mesh

// Fine movement
FINE_MOVEMENT_DELTA = 0.1; // mm per arrow key press
FINE_MOVEMENT_SHIFT_MULTIPLIER = 5; // 5x faster with shift (0.5mm)

// Alignment guides
ALIGNMENT_SNAP_THRESHOLD = 0.1; // mm tolerance for visual alignment detection
ALIGNMENT_SNAP_DISTANCE = 0.2; // mm distance for magnetic snapping effect
ALIGNMENT_LINE_COLOR = '#0088ff'; // bright blue for visibility
ALIGNMENT_LINE_WIDTH = 0.1; // mm stroke width

// JSON serialization
ELEMENT_SKIP_JSON_PROPERTIES = ['fill', 'draggable', 'opacity'];
```

### Type Guards (`src/types/typeGuards.ts`)

Type-safe element discrimination:

```typescript
export type GenericElement = CircleData | RectangleData | LegData;

// Use these instead of string property checks
isCircle(element: GenericElement): element is CircleData
isRectangle(element: GenericElement): element is RectangleData
isLeg(element: GenericElement): element is LegData
```

**Never use** `'radius' in element` or `'width' in element` checks - always use type guards.

### CI/CD

GitHub Actions workflow (`.github/workflows/ci-dev.yaml`) runs on all non-main branches:

- Installs dependencies with `npm ci`
- Runs `format:check`, `lint:check`, and `ts:check`
- Uses Node 24.x (configured in workflow file)

## Keyboard Shortcuts

The application has extensive keyboard shortcuts that are critical to the user experience:

### Mode Selection

- `P` - Pointer mode, `M` - Measure mode

### Creating Elements

- `Shift+C` - Add circle, `Shift+R` - Add rectangle, `Shift+L` - Add leg

### Element Editing (when hovering over element)

- Arrow keys - Fine move (0.1mm), `Shift+Arrow` - Move 5x faster (0.5mm)
- `R` - Rotate rectangle +5°, `Shift+R` - Reset rotation to 0°
- `F` - Flip rectangle dimensions (swap width/height)
- Right-click - Context menu, Double-click - Edit properties

### Other

- `Ctrl/Cmd+Z` - Undo, `Shift+P` - Project settings, `D` - Display 3D mesh

### Shortcut Behavior

**Modal Awareness:**
All keyboard shortcuts are automatically disabled when any modal dialog is open. This prevents:

- Letter shortcuts (D, P, M, R, F) from interfering with text input
- Accidental operations while filling out modal forms

Implementation: The `shortcut` action in `src/lib/shortcut.ts` checks `modalStore` state before processing any shortcuts. When the modal stack is non-empty, all shortcuts are suppressed.

**Browser Conflict Avoidance:**
Element creation and settings shortcuts use Shift+letter combinations to avoid conflicts with browser shortcuts:

- Shift+C instead of Ctrl+C (browser copy)
- Shift+R instead of Ctrl+R (browser reload)
- Shift+P instead of Ctrl+P (browser print)
- Shift+L instead of Ctrl+L (browser address bar)

Ctrl+Z (Undo) is preserved as it's a universal standard.

**Implementation**: All shortcuts are defined in `AppNavigation.svelte` using the `shortcut` action from `$lib/shortcut`.

## Element Operations

### Fine Movement System (`src/lib/fineMovement.ts`)

- Tracks selected elements via `Set<GenericElement>`
- Provides functions: `finemoveSelectedElement()`, `flipSelectedRectangleDimensions()`, `rotateSelectedRectangleDegrees()`, `resetSelectedRectangleRotation()`
- Updates project store to trigger Svelte reactivity
- Uses type guards for element discrimination (not string property checks)

### Context Menus

Each element type (circle, rectangle, leg) has its own context menu generator:

- `getContextMenuItemForCircle()`, `getContextMenuItemForRectangle()`, `getContextMenuItemForLeg()`
- Returns `ContextMenuItem[]` with name and onClick callback
- Displayed via `ContextMenu.svelte` component

### Hover Info

- `HoverInfo.svelte` shows element info and available shortcuts when hovering
- Positioned to the right of element using `getClientRect()` to avoid overlap
- Content generated by `getSelectedElementInfo()` in `fineMovement.ts`

## Testing Workflow

Manual testing only. Key test scenarios:

1. Upload PCB image → verify transparency and flip
2. Place components (circles/rectangles) → adjust depth/height/rotation
3. Test rotation: rotate rectangle, verify 2D and 3D mesh match
4. Test boundaries: ensure rotated rectangles cannot move outside panel
5. Add support legs → verify positioning
6. Generate 3D mesh → check wireframe and solid views, toggle positive mesh (PCB) view
7. Test positive mesh: verify component visualization with adjustable distance slider
8. Export STL → validate file in slicer software

## Code Quality Standards

### Always Use Type Guards

**Bad:**

```typescript
if ('radius' in element) { ... }
if ('width' in element && 'depth' in element) { ... }
```

**Good:**

```typescript
import { isCircle, isRectangle, isLeg } from '$types/typeGuards';

if (isCircle(element)) { ... }
if (isRectangle(element)) { ... }
```

### Use Constants for Configuration

Import from `src/lib/constants.ts` instead of hardcoding:

```typescript
import { CIRCLE_COLOR, ELEMENT_OPACITY, FINE_MOVEMENT_DELTA } from '$lib/constants';
```

### Coordinate System Awareness

When working with rotation or positioning:

- Remember rectangles rotate around **center** (not top-left)
- Negate rotation angles when converting 2D → 3D: `(-rotation * Math.PI) / 180`
- Account for Y-axis flip between Konva (down) and Three.js (up)
