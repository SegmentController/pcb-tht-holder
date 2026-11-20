# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PCB THT Holder is a web-based 3D STL generator for THT PCB panels. Users upload a PCB image, mark component positions, and generate a 3D printable holder that keeps THT components straight during soldering.

**Live**: https://segmentcontroller.github.io/pcb-tht-holder/

**Purpose**: Enables neat DIY THT component installation for users who order SMD-assembled PCBs. Works entirely client-side - no registration, PCB images never leave browser.

## Build Process

The `service-worker` Vite plugin (`vite.config.ts`) emits `service-worker.js` from
`src/service-worker.template.js`, filling in `__VERSION__` (package version) and `__PRECACHE__`
(app shell + entry assets + the lazy `AppDesigner` chunk with its static imports; navigations are network-first
with a 3 s timeout). The 2D designer (Konva) is a lazy chunk `App.svelte` loads once a picture exists, and the 3D stack
(three, CSG, threlte) is a lazy chunk loaded when the 3D view opens; the `drop-unused-threlte-assets` plugin removes unreferenced draco/basis files.
The `drop-dark-css` plugin strips every `.dark …` rule (~50 KB, flowbite-svelte emits them) from the
emitted CSS with `postcss`; the app has no dark mode. Remove the plugin before adding one.

Tailwind sources are explicit `@source` directives in `src/app.css` — add a flowbite-svelte
directory there when using a new flowbite component, otherwise its classes are missing.

Outputs to `docs/` directory for GitHub Pages. `docs/` is committed build output that the maintainer
regenerates with `npm run all` before a release: never `git checkout`/`git clean` it or rebuild it on your own
to "verify" something (use `ts:check`, `test`, `lint:check`), and expect it to differ from `public/`
(e.g. `docs/demo/CREDITS.md`) until the next release build.

CI (`.github/workflows/ci-dev.yaml`, every non-`main` push): `npm ci`, then `format:check`, `lint:check`,
`ts:check`, `test`, `build` on Node 24. A release bumps the version in `package.json` (the service worker cache name
and the header version come from it), moves `[Unreleased]` in `CHANGELOG.md` to a dated version and refreshes the
README screenshots (`step*.png`, repo root) when the UI changed.

## Architecture

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
3. **3D mesh generation, mesh repair, STL export and the async worker flow** (`src/lib/3d/`): see `src/lib/3d/CLAUDE.md`

### Coordinate Systems (CRITICAL)

- **2D Konva**: Y-down, clockwise rotation
- **3D Three.js**: Y-up, counter-clockwise rotation

**Rectangles**: Rotate around center, 3D rotation negated: `box.rotateZ((-rotation * Math.PI) / 180)`

**Circles**: Center-based positioning (x, y = center)

**Legs**: Top-left positioning (x, y = top-left corner, no rotation support)

### State Management

Outside components, `projectStore` is read and written through `getProjectStoreValue()`, `setProjectStoreValue()` and `updateProjectStoreValue()`; `libraryStore` has the get and set pair. The other stores have their own APIs.

Use `projectJsonSerializer` to skip non-serializable Konva properties.

#### Undo/Redo System (`undoStore.ts`)

- Two LIFO stacks, max 50 undo operations, non-persistent; the redo stack is bounded by it
- `addUndo(name, undo, redo, coalesceKey?)`: every entry carries both closures (absolute values / element
  references, so interleaved moves cannot corrupt them). A new entry clears the redo stack; coalescing
  (`rotate:<id>`, 1.5 s) keeps the oldest `undo` and replaces `redo` with the newest
- Tracks: deletions, property edits, rotation, dimension flip, moves (`moveWithUndo` in `lib/designer/elements/collection.ts`: one entry
  per mouse drag, arrow-key nudges coalesce per element as `nudge:<id>`; a move to the same position adds none)
- Error handling: toast notifications, console logging, entry stays on its stack for retry
- UI: `Ctrl+Z`, `Ctrl/Cmd+Shift+Z` and `Ctrl+Y` (redo; `Cmd+Y` is the browser's History and left alone). The Edit
  menu always lists "Undo: {name}" / "Redo: {name}" (disabled when empty) with the step counts from `undoStoreHistory`;
  the Align checkbox lives in the same menu
- The shortcut matches `event.key` exactly and the key case flips with Shift (and can with Caps Lock), so the
  handler is registered for both `z` and `Z` and routes by `shiftKey`

### Type Guards (`src/types/typeGuards.ts`)

Tell element kinds apart with these guards, not by testing for a field such as `'radius' in element`:

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

See `components/mesh/Mesh3DScene.svelte` for the canonical example.

### Implementation Details

- **Globals**: `__PKG_VERSION__`, `__BASE_URL__` injected at build time
- **Service Worker**: PWA with offline caching, version auto-updated
- **SEO**: Meta tags, sitemap.xml, Google Search Console verification
- **Project loading** (`AppDropzone.svelte`): `.tht3d` uploads (read as text, not base64) and demos both go through `loadProjectData()`
  (Zod validation, one store write incl. label and zoom, embedded image via `onFileUpload`); a new image upload
  and File > New clear the print label
- **Gerber import** (`AppDropzone.svelte` → `importFabFiles`, `ModalGerberImport.svelte`) and the standards the gerber library follows: see `src/lib/gerber/CLAUDE.md`
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
- **ESLint**: unicorn/all config, import sorting, no console/alert/debugger. Naming that trips
  `unicorn/prevent-abbreviations`: loop variables are `index` (not `i`), `separatorIndex` (not `sepIndex`),
  `length_` for a local that would clash with `.length`; single-statement `if`/`else` take no braces
  (`curly: multi`); vector components `nx, ny, nz, ex, ey, ez, fx, fy, fz` are allowed
- **Requirements**: Node >=24.0.0, npm >=11.0.0
- **Svelte 5 rune syntax**: all components use `$props()`, `$state()`, `$derived()` — no `export let` props

## Keyboard Shortcuts

All shortcuts are disabled while a modal is open (except ESC); the `shortcut` action in `src/lib/shortcut.ts` checks `modalStore`.
Shift+letter combos are used to avoid browser shortcuts (copy, reload, print, address bar).

## Element Operations

- **Fine Movement** (`lib/designer/fineMovement.ts`): Tracks via `Set<GenericElement>`, provides move/rotate/flip functions
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
schemas/type guards, project serializer, undo/toast/library/modal stores, gerber macros and drills, element
operations (`lib/designer/elements/*`, with `$stores/modalStore` mocked via `vi.mock`), fine movement, measurement, the
`shortcut` action (DOM stubbed by hand), `meshClient` (fake `Worker`). Keep logic that must be
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
