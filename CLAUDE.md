# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PCB THT Holder is a web-based 3D STL file generator for THT (Through Hole Technology) PCB panels. It allows users to upload a PCB image, mark component positions (circles and rectangles), and generate a 3D printable holder that keeps THT components straight during soldering.

**Live deployment**: https://segmentcontroller.github.io/pcb-tht-holder/

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
├── types/            # Zod schemas and TypeScript types
│   └── panels/       # Panel-specific type definitions
├── lib/
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
   - Panel settings (width, height, PCB thickness, SMD height)
   - Component arrays: `circles[]`, `rectangles[]`, `legs[]`
   - Validated with Zod schemas at runtime

2. **Designer Interface** (`AppDesigner.svelte`):
   - Konva.js Stage for 2D canvas manipulation
   - User places circles/rectangles over PCB image
   - Supports pointer and measure modes
   - Context menus for element operations
   - Fine movement controls with keyboard shortcuts

3. **3D Mesh Generation** (`src/lib/3d/mesh.ts`):
   - Uses CSG boolean operations (ADDITION/SUBTRACTION) via three-bvh-csg
   - Generates two meshes: main holder and hollow version
   - Creates base structure, subtracts component holes, adds support legs
   - Optional text label engraving using Three.js TextGeometry
   - Loads Roboto font from `/roboto_regular.json`

4. **STL Export** (`src/lib/3d/stl.ts`):
   - Converts Three.js mesh vertices to STL format
   - Supports both text and binary STL output
   - Binary format uses custom buffer writing utilities

### Important Implementation Details

- **Global Variables**: `__PKG_VERSION__` and `__BASE_URL__` are injected at build time via Vite's define config
- **Service Worker**: PWA support with offline caching, version auto-updated during build
- **Environment Detection**: Production base path is `/pcb-tht-holder`, dev is empty string
- **Strict ESLint**: Uses unicorn/all config with custom overrides, enforces import sorting, no console/alert/debugger
- **Node Version**: Requires Node >=22.0.0, npm >=10.0.0

### Coordinate Systems and Rotation

**Critical: The 2D canvas and 3D mesh use different coordinate systems**

- **2D Konva Canvas**: Y-axis increases downward, rotation clockwise
- **3D Three.js Scene**: Y-axis increases upward, rotation counter-clockwise

**Rectangle Rotation Implementation:**

- Rectangles rotate around their **top-left corner** (origin at x, y position)
- 2D canvas (`AppDesigner.svelte`): Konva Rect with `rotation={rectangle.rotation}` property
- 3D mesh (`src/lib/3d/mesh.ts`):
  - Geometry is translated to shift pivot from center to top-left: `geometry.translate(width / 2, -height / 2, 0)`
  - Positioned at top-left corner in world space
  - Rotation angle is **negated** to match 2D direction: `box.rotateZ((-rectangle.rotation * Math.PI) / 180)`

**Boundary Limiting:**

- Rectangles with rotation require axis-aligned bounding box (AABB) calculation
- `limitBox()` function in `AppDesigner.svelte` rotates all 4 corners and finds min/max bounds
- Ensures rotated rectangles stay within panel boundaries

**Circles:**

- Center-based positioning (x, y is the circle center)
- Boundaries account for radius on all sides

### State Management Patterns

All stores export convenience functions:

```typescript
// Example from projectStore.ts
export const getProjectStoreValue = (): Project => get(projectStore);
export const setProjectStoreValue = (project: Project) => projectStore.set(project);
export const updateProjectStoreValue = (updater: Updater<Project>) => projectStore.update(updater);
```

Use `projectJsonSerializer` when working with project JSON to skip non-serializable properties (Konva internal state).

### CI/CD

GitHub Actions workflow (`.github/workflows/ci-dev.yaml`) runs on all non-main branches:

- Installs dependencies with `npm ci`
- Runs `format:check`, `lint:check`, and `ts:check`
- Uses Node 22.15.0

## Keyboard Shortcuts

The application has extensive keyboard shortcuts that are critical to the user experience:

### Mode Selection

- `P` - Pointer mode, `M` - Measure mode

### Creating Elements

- `Ctrl/Cmd+C` - Add circle, `Ctrl/Cmd+R` - Add rectangle, `Ctrl/Cmd+L` - Add leg

### Element Editing (when hovering over element)

- Arrow keys - Fine move (0.1mm), `Shift+Arrow` - Move 5x faster (0.5mm)
- `R` - Rotate rectangle +5°, `Shift+R` - Reset rotation to 0°
- `F` - Flip rectangle dimensions (swap width/height)
- Right-click - Context menu, Double-click - Edit properties

### Other

- `Ctrl/Cmd+Z` - Undo, `Ctrl/Cmd+P` - Project settings, `D` - Display 3D mesh

**Implementation**: All shortcuts are defined in `AppNavigation.svelte` using the `shortcut` action from `$lib/shortcut`.

## Element Operations

### Fine Movement System (`src/lib/fineMovement.ts`)

- Tracks selected elements via `Set<GenericElement>`
- Provides functions: `finemoveSelectedElement()`, `flipSelectedRectangleDimensions()`, `rotateSelectedRectangleDegrees()`, `resetSelectedRectangleRotation()`
- Updates project store to trigger Svelte reactivity

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
6. Generate 3D mesh → check wireframe and solid views
7. Export STL → validate file in slicer software
