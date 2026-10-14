# Change log

## [1.15.0] - 2026-10-14

### Added

- Import from fabrication files: drop a Gerber package (`.zip`) or loose Excellon drill files (`.drl`, `.xln`, ...) plus the outline layer on the dropzone. A review dialog lists the drill tools (plated lead-size holes on by default, vias and mounting holes off), groups neighbouring holes of the same diameter into one rotated rectangle (lone holes become circles) and previews the board. The panel gets the size of the board outline (`Edge.Cuts`), elements land at exact mm positions (pure translation, no Y flip), and an opaque rendered SVG top view of the board replaces the photo: top copper (traces, SMD and THT pads), exposed pads where the solder mask is open, silkscreen, outline and drilled holes. Photos stay at 25 % opacity
- `src/lib/gerber/` (pure, unit-tested): RS-274X plotter (`plotter.ts`: apertures C/R/O/P, aperture macros, strokes and arcs, regions, dark/clear polarity; step-and-repeat not supported) that turns the top copper, mask and silkscreen layers into SVG masks, Excellon parser (metric/inch, zero suppression, X2 tool attributes, slots skipped with a warning), RS-274X outline parser (arcs flattened), package reader, zip extraction with size limits (`fflate`, lazy chunk), element planner and SVG board renderer
- The import dialog offers **Add support legs** (on by default): legs are placed clear of SMD pads, silkscreen, every hole and the planned elements (`suggestLegs`), shown in the preview and counted in the summary
- `placeLegs` / `suggestLegs` (`src/lib/gerber/legs.ts`): support leg positions chosen by clearance to SMD pads, silkscreen, every drilled hole (vias and mounting holes too) and the planned elements, spread apart for stability. The _NE555 from Gerbers_ demo uses it (four legs, 0.6 – 2.2 mm from parts, 1.1 – 3.1 mm from holes on a crowded 23.6 × 16.2 mm board); `FabPackage.partKeepouts` carries the pad and silkscreen areas
- The demo _Open555_ is replaced by **NE555 from Gerbers**: its card loads `public/demo/ne555-gerbers.zip` through the very import a dropped `gerbers.zip` goes through (review dialog, project settings), so it demonstrates the Gerber workflow itself; there is no project file. The package is also linked on the card for download. Demo cards can show a _Gerber_ badge and have no source/licence (both optional), `Demo.file` is optional
- The dropzone says in bold that a `gerbers.zip` can be dragged and dropped (`Dropzone` takes its description as slot content)
- Photo and Gerber projects are told apart in the UI: a badge next to the zoom slider (_Photo overlay · scale from settings_ / _Gerber layout · exact size_) and a note in the project settings (_Photo has no scale_ / _Exact size from the Gerber board outline_); generated pictures are detected by `isGeneratedImage`
- Fabrication import hardened against the specifications and real CAD exports: Gerber Layer Format rev. 2026.05 (standard apertures with holes, macros with exposure, thermal/moire/legacy primitives, `LM/LR/LS`, block apertures `AB`, step and repeat `SR`, arcs `G74/G75`, regions, `IPNEG`, attribute dictionary, legacy `G54/G70/G90/G91`, `MI/OF/SF/IR/AS`, trailing zero omission, incremental coordinates, case and style variations) and XNC rev. 2021.11 / legacy Excellon (slots as `G85` and as routed `G00/M15/G01/M16`, repeats, incremental mode, CR/CRLF/BOM, unit guessed from tool sizes, undeclared coordinate layouts guessed from the board outline)
- Drills in Gerber format (X2 `FileFunction,Plated|NonPlated`, flashes = holes, draws = slots), tool roles from `.AperFunction` (`ComponentDrill`, `ViaDrill`, ...), blind/buried holes excluded, component pads of the copper layer as a fallback when there is no drill file, panel from the copper extent when there is no outline
- `.FilePolarity` is honoured for copper, mask and legend layers; layer detection by X2 attributes first, then by the naming of KiCad, Altium/Protel, Eagle (old and new), OrCAD, gEDA, DipTrace, EasyEDA/JLC and OSH Park (checked against the tracespace fixture catalogue and eight real boards)
- Slots become rotated rectangles; dense boards produce smaller pictures (batched strokes and flashes, micrometre precision)

### Changed

- The README leads with the Gerber import (a "Start from your Gerber files" section with the photo/Gerber comparison); the feature list, demo description and the project structure follow the new folders
- Source layout: pure helpers moved to `src/lib/util/` (`math`, `geometry`, `format`, `download`), 2D canvas logic to `src/lib/designer/` (`alignment`, `fineMovement`, `measurement`, `zoom`, `elements/`), `switchType` to `src/lib/3d/`, canvas overlays to `src/components/designer/` and the Threlte scene to `src/components/mesh/`
- `DEFAULT_COMPONENTS` and `convertDefaultComponentToLibraryItem` moved from `src/types/Library.ts` to `src/lib/libraryDefaults.ts` (the type and schema stay in `types/Library.ts`)
- README screenshots (`step1.png` – `step4.png`) are retaken from v1.15.0 with the NE555 Gerber demo; new `step-gerber.png` shows the import dialog
- `ModalProjectSettings` takes the project `source` (`gerber` | `photo`) to show the matching note
- New runtime dependency: `fflate` (zip extraction, loaded lazily with the first import)

### Removed

- The _Open555_ demo (project file, thumbnail and licence text): replaced by _NE555 from Gerbers_
- Unused `src/app.d.ts`

### Tests

- New unit tests for element operations (`circle`, `rectangle`, `leg`), fine movement, measurement, the `shortcut` action, `meshClient`, the worker protocol, download, library defaults and the whole `src/lib/gerber/` library (plotter, macros, Excellon, Gerber drills, outline, package, planner, legs, board SVG), with real KiCad fixtures

## [1.14.4] - 2026-10-13

### Added

- Redo: `Ctrl+Shift+Z` / `Cmd+Shift+Z` or `Ctrl+Y`, and a "Redo: {name}" item in the Edit menu. Every history entry now carries an undo and a redo closure (`addUndo(name, undo, redo, coalesceKey?)`); a new change after an undo discards the redo history, File > New clears both
- Moving elements is undoable (and redoable): one step per mouse drag, and arrow-key nudges of one element within 1.5 s share one step. Drag and arrow keys go through `moveWithUndo` of the element collection (`moveCircle` / `moveRectangle` / `moveLeg`); a move to the same position registers nothing
- The Edit menu always lists Undo and Redo (disabled when empty) with the number of available steps (undo shows `n / 50`)

### Changed

- The Align toggle moved from the header into the Edit menu as a checkbox
- Undo/redo shortcuts are registered for the upper- and lowercase key and routed by Shift, so Caps Lock cannot turn redo into undo
- The Edit menu is wider (`w-88`) so the longer undo/redo labels and shortcuts stay on one line

## [1.14.3] - 2026-10-13

### Added

- Project settings: icon-only button next to the print label that copies the project name into the label while the label is empty (`mdi:content-copy` added to the bundled icons)

### Changed

- Demo projects: every element size has at most one decimal digit (the 2.94/8.02/5.48/15.68 mm rectangles are now 3/8.1/5.5/15.7 mm), and the SMD height is 1.5 mm (was 3 mm) so hollow mode shows more
- The header keeps a fixed width of 960 px (it was 60% of the viewport and collapsed too early on narrow windows); below 960 px it uses the full width

### Fixed

- Dialogs accepted only whole numbers: number fields had the browser default `step=1`, so a value such as `1.5` was rejected on submit. `NumberInputBound` now defaults to `step=0.1`

## [1.14.2] - 2026-10-11

### Added

- Three demo projects under the dropzone (Open555, Servo Controller 555, Arduino ICSP Shield): one click loads a ready-made project with holes and legs placed. Files and thumbnails live in `public/demo/` (credits and licences in `public/demo/CREDITS.md`), the catalogue is `src/lib/demos.ts`, the cards are `DemoPicker.svelte`
- `formatMm` (`src/lib/format.ts`) for millimetre display, with unit tests
- Demo thumbnails listed in `sitemap.xml` as image entries

### Changed

- Project loading from a `.tht3d` file and from a demo shares one `loadProjectData()` in `AppDropzone.svelte`
- A loaded project also restores its print label and zoom (previously only elements and panel settings)
- The SkipTheCAD partner badge hangs under the header below the `xl` breakpoint instead of overlapping the menu; it stays fixed in the top-right corner from `xl` up
- Dropzone sizes to its container (`w-auto` inside the margin) and its description has horizontal padding
- `sitemap.xml` dropped the stale `lastmod`

### Fixed

- The 3D view size line showed floating point noise (e.g. `96.19999999999999 mm`); it now shows at most two decimals
- File > New and uploading a new PCB image left the previous project's print label in place

## [1.14.1] - 2026-10-10

### Added

- Ctrl/Cmd + mouse wheel and trackpad pinch zoom the canvas in 10% steps and keep the point under the cursor in place
- Context menu keyboard support: focus moves into the menu, Arrow keys/Home/End navigate, Escape returns focus
- `<main>` landmark, labelled designer canvas region, `aria-haspopup`/`aria-expanded` on the File and Edit menus

### Changed

- Stylesheet 182 KB → 131 KB: the unused `.dark` rules of flowbite-svelte are stripped at build time (`dropDarkCss` in `vite.config.ts`; `postcss` is now a direct dev dependency)
- Zoom limits and step are shared constants for the slider, `+`/`-` shortcuts and wheel zoom
- Edit menu reads the leg count and library reactively from the stores (library sorted once instead of per render)

### Fixed

- A zoomed-in canvas wider than the window can be scrolled to its left edge (it used to be clipped by centering)

## [1.14.0] - 2026-10-10

### Added

- Mesh generation runs in a Web Worker (`mesh.worker.ts`, `meshClient.ts`); variants are generated on demand, memoized per project and cancelled when the 3D view closes
- Golden regression tests for the CSG pipeline (`mesh.test.ts`), element collection, geometry and undo coalescing tests
- Toast on library import success/failure; toast when autosave fails (storage full)
- Service worker generated at build time with a hashed-asset precache (`vite.config.ts`)
- Accessible names for icon-only buttons, `menu`/`menuitem` roles and Escape-to-close for the context menu

### Changed

- Project persistence: image under its own `project-image` key, debounced compact writes, one write per drag end (legacy single-key projects migrate transparently)
- CSG: disjoint holes/legs/pillars batched into one boolean operation, hollow holder sliced from the shared base solid, cavity + edge cutouts as one prism, text label sized in one pass
- 3D preview: one camera/controls/lights for all meshes, on-demand rendering, no per-toggle stringification of vertex arrays
- Entry bundle 420 KB → ~150 KB gzip (3D stack lazy), Tailwind sources restricted with `@source`, icons bundled (no runtime iconify API calls), font trimmed to Latin + Latin Extended-A
- Konva: image, elements and overlays on separate layers; grid drawn as two paths
- zod → zod/mini; single Tailwind pipeline (`src/app.css`, `@tailwindcss/vite`)
- Shortcuts no longer swallow Ctrl/Cmd/Alt combinations or keys typed in form controls
- Undo: cancelling "add" leaves no undo entry, repeated rotate presses coalesce, reset rotation is undoable
- Settings dialogs submit on Enter; context menu only replaces the native menu on the canvas
- Number inputs clamp to min/max on change as well as blur, so Enter cannot submit an out-of-range value
- Resize image dialog offers only widths that also respect the maximum height (tall images no longer stay above it)
- Library import reports invalid JSON/schema errors instead of failing silently
- Shared code extracted into `elements/collection.ts`, `geometry.ts`, `format.ts` (replaces dayjs) and `3d/placement.ts`
- Tests: `three-bvh-csg` is aliased to its ESM source in `vite.config.ts`, which removes the `THREE_CJS_DEPRECATED` warning (its UMD build loaded a second copy of three); `mesh.test.ts` now also asserts zero open edges and an origin-independent volume

### Fixed

- STL export: generated meshes were not watertight (slicers such as Bambu Studio reported thousands of open edges). Mesh variants now go through a repair pass (`src/lib/3d/meshRepair.ts`) after the CSG operations: near-duplicate vertices are welded, T-junctions are split, zero-area triangles and fins are dropped, flipped patches are re-oriented and small planar holes are filled. `mergeVertices` is no longer used.
- Hollow holder volumes in the golden tests were re-captured from the repaired meshes: the raw CSG output had small holes, so its signed volume depended on the origin by up to ~35 mm³

### Removed

- `canvas`, `dayjs`, `replace-in-file`, `@tailwindcss/postcss`, `postcss` dependencies; `postcss.config.mjs` and `src/app.postcss`; ASCII (text) STL writer, STL download is binary only; committed `public/service-worker.js`

## [1.13.13] - 2026-10-10

### Added

- `PartnerBadge.svelte`: SkipTheCAD partner badge shown in the top-right corner for 7 seconds after load, linking to the partner page
- SkipTheCAD "Listed on" badge in `README.md`

### Changed

- `vite.config.ts`: ESM-native config (`node:path`, `import.meta.dirname`, JSON import attribute); `chunkSizeWarningLimit` raised to 2000 for the larger Three.js/Threlte bundle
- `shortcut.ts`: formatting-only change to `ShortcutModifierDefinition` (prettier-plugin-svelte 4)
- Updated dependencies
  - three 0.183.2 → 0.186.1
  - @types/three 0.183.1 → 0.186.0
  - @threlte/core 8.5.9 → 8.6.1
  - @threlte/extras 9.14.5 → 9.22.0
  - konva 10.2.5 → 10.7.1
  - svelte 5.55.3 → 5.57.2
  - zod 4.3.6 → 4.6.5
  - dayjs 1.11.20 → 1.11.23
  - nanoid 5.1.7 → 5.1.16
  - @iconify/svelte 5.2.1 → 5.2.2
  - vite 8.0.8 → 8.3.4
  - @sveltejs/vite-plugin-svelte 7.0.0 → 7.3.1
  - tailwindcss, @tailwindcss/postcss, @tailwindcss/vite 4.2.2 → 4.3.3
  - typescript 6.0.2 → 6.0.3
  - eslint 10.2.0 → 10.12.0
  - @eslint/eslintrc 3.3.5 → 3.3.7
  - eslint-plugin-simple-import-sort 13.0.0 → 14.0.0 (major version upgrade)
  - eslint-plugin-svelte 3.17.0 → 3.23.1
  - svelte-eslint-parser 1.6.0 → 1.9.0
  - @typescript-eslint/eslint-plugin, @typescript-eslint/parser 8.58.1 → 8.71.1
  - prettier 3.8.2 → 3.9.10
  - prettier-plugin-svelte 3.5.1 → 4.1.1 (major version upgrade)
  - replace-in-file 8.4.0 → 9.0.0 (major version upgrade)
  - svelte-check 4.4.6 → 4.7.6
  - postcss 8.5.9 → 8.5.29

## [1.13.12] - 2026-04-12

### Fixed

- `Mesh3DScene.svelte`: production build crash caused by `T.BufferAttribute args` array in Vite 8 — replaced with `T.BufferGeometry oncreate` to set buffer attributes directly

### Changed

- Migrated `Mesh3DScene.svelte` props from Svelte 4 `export let` syntax to Svelte 5 `$props()` rune
- Updated dependencies
  - @typescript-eslint/eslint-plugin 8.58.0 → 8.58.1
  - @typescript-eslint/parser 8.58.0 → 8.58.1
  - postcss 8.5.8 → 8.5.9
  - prettier 3.8.1 → 3.8.2
  - vite 8.0.7 → 8.0.8
  - @threlte/core 8.5.7 → 8.5.9
  - @threlte/extras 9.14.4 → 9.14.5
  - flowbite-svelte 1.33.0 → 1.33.1
  - konva 10.2.3 → 10.2.5
  - svelte 5.55.1 → 5.55.3

## [1.13.11] - 2026-04-07

### Changed

- Updated dependencies
  - typescript 5.9.3 → 6.0.2 (major version upgrade)
  - vite 7.3.1 → 8.0.7 (major version upgrade)
  - @sveltejs/vite-plugin-svelte 6.2.4 → 7.0.0 (major version upgrade)
  - eslint-plugin-unicorn 63.0.0 → 64.0.0 (major version upgrade)
  - eslint-plugin-simple-import-sort 12.1.1 → 13.0.0 (major version upgrade)
  - eslint 10.0.2 → 10.2.0
  - eslint-plugin-svelte 3.15.0 → 3.17.0
  - svelte-eslint-parser 1.5.1 → 1.6.0
  - @typescript-eslint/eslint-plugin 8.56.1 → 8.58.0
  - @typescript-eslint/parser 8.56.1 → 8.58.0
  - @threlte/core 8.4.0 → 8.5.7
  - @threlte/extras 9.8.1 → 9.14.4
  - flowbite-svelte 1.31.0 → 1.33.0
  - svelte 5.53.5 → 5.55.1
  - @tailwindcss/postcss 4.2.1 → 4.2.2
  - @tailwindcss/vite 4.2.1 → 4.2.2
  - tailwindcss 4.2.1 → 4.2.2
  - svelte-check 4.4.4 → 4.4.6
  - prettier-plugin-svelte 3.5.0 → 3.5.1
  - @eslint/eslintrc 3.3.4 → 3.3.5
  - postcss 8.5.6 → 8.5.8
  - canvas 3.2.1 → 3.2.3
  - konva 10.2.0 → 10.2.3
  - three 0.183.1 → 0.183.2
  - dayjs 1.11.19 → 1.11.20
  - nanoid 5.1.6 → 5.1.7

### Removed

- `svelte-preprocess` devDependency (no longer needed)

## [1.13.10] - 2026-02-26

### Changed

- Updated dependencies
  - eslint 9.39.2 → 10.0.2 (major version upgrade, added @eslint/eslintrc and @eslint/js)
  - @tailwindcss/postcss 4.1.18 → 4.2.1
  - @tailwindcss/vite 4.1.18 → 4.2.1
  - tailwindcss 4.1.18 → 4.2.1
  - @types/three 0.182.0 → 0.183.1
  - @typescript-eslint/eslint-plugin 8.56.0 → 8.56.1
  - @typescript-eslint/parser 8.56.0 → 8.56.1
  - prettier-plugin-svelte 3.4.1 → 3.5.0
  - svelte-check 4.4.0 → 4.4.4
  - svelte-eslint-parser 1.4.1 → 1.5.1
  - @threlte/core 8.3.1 → 8.4.0
  - @threlte/extras 9.7.1 → 9.8.1
  - svelte 5.51.3 → 5.53.5
  - three 0.182.0 → 0.183.1

### Fixed

- **Type compatibility** in `Mesh3DScene.svelte` after Threlte update (`makeDefault` prop cast)
- **Code cleanup** in `AppDesigner.svelte`: removed unnecessary zero-initialization of boundary variables

## [1.13.9] - 2026-02-17

### Fixed

- **Label vertical centering** now uses the solid wall region only
  - Previously centered within the full side height, causing the label to appear too low
  - Now subtracts the PCB cavity recess (`pcbThickness + smdHeight`) so the label is centered in the visible wall portion
- **STL export: computed face normals** instead of hardcoded zero normals
  - Text and binary STL files now include correctly calculated per-face normals
  - Improves slicer compatibility and mesh quality analysis tools
- **STL export: vertex deduplication** before normal computation
  - Applied `mergeVertices` + `toNonIndexed` pass on all three meshes (main, hollow, positive)
  - Fixes non-manifold edges caused by floating-point seam vertices from CSG operations
  - Results in cleaner, watertight geometry for all exported STL files

### Changed

- Updated dependencies
  - @tsconfig/svelte 5.0.6 → 5.0.8
  - @typescript-eslint/eslint-plugin 8.53.0 → 8.56.0
  - @typescript-eslint/parser 8.53.0 → 8.56.0
  - eslint-plugin-svelte 3.14.0 → 3.15.0
  - eslint-plugin-unicorn 62.0.0 → 63.0.0
  - prettier 3.8.0 → 3.8.1
  - svelte-check 4.3.5 → 4.4.0
  - svelte 5.46.4 → 5.51.3
  - three-bvh-csg 0.0.17 → 0.0.18
  - zod 4.3.5 → 4.3.6

## [1.13.8] - 2026-01-17

### Changed

- Updated dependencies to address security vulnerabilities
  - @sveltejs/vite-plugin-svelte 6.2.1 → 6.2.4
  - @typescript-eslint/eslint-plugin 8.50.1 → 8.53.0
  - @typescript-eslint/parser 8.50.1 → 8.53.0
  - eslint-plugin-svelte 3.13.1 → 3.14.0
  - prettier 3.7.4 → 3.8.0
  - vite 7.3.0 → 7.3.1
  - @iconify/svelte 5.1.0 → 5.2.1
  - canvas 3.2.0 → 3.2.1
  - konva 10.0.12 → 10.2.0
  - svelte 5.46.0 → 5.46.4
  - zod 4.2.1 → 4.3.5

## [1.13.7] - 2025-12-10

### Added

- **Default library items** for common THT components
  - Pre-defined library of 14 standard components with datasheet-sourced dimensions
  - Includes DIP IC sockets (DIP-8, DIP-14/16, DIP-28, DIP-40)
  - Electrolytic capacitors (Ø5×11, Ø8×12, Ø10×16)
  - PCB-mount buzzers (small Ø14×8, large Ø31×14)
  - Screw terminal blocks (2×5.08, 3×5.08 pitch)
  - Generic relays (small and large)
  - "Load defaults" button in Library modal to populate library with standard footprints
  - Automatic duplicate detection - components with existing names are skipped
  - Saves time by eliminating need to manually measure and enter common component dimensions

### Changed

- **Library modal improvements**
  - Reorganized button layout with new "Load defaults" option
  - Added "Clear" button to remove all library items with confirmation dialog
  - Improved workflow for managing component templates

## [1.13.6] - 2025-12-04

### Added

- **Toast notification system**
  - Visual error notifications for failed undo operations
  - Toast appears in bottom-right corner with red error styling
  - Auto-dismisses after 5 seconds
  - Detailed error logging to console for debugging
  - Implemented using Flowbite Svelte Toast component with Iconify icons

### Changed

- **Comprehensive undo system improvements**
  - Added undo support for property modifications:
    - Circle property edits (radius, depth)
    - Rectangle property edits (width, height, depth, rotation)
    - Rectangle rotation via keyboard (R key)
    - Rectangle dimension flip via keyboard (F key)
  - Implemented stack size limit (50 operations) to prevent memory issues
  - Added automatic undo stack clearing on project reset
  - Only creates undo entries when values actually change (optimization)
  - Each rotation/flip creates individual undo entry for granular control
- **Improved error handling**
  - Failed undo operations now show toast notification to user
  - Detailed console logging with operation name, error details, and stack trace
  - Failed operations re-added to stack for retry

### Fixed

- **Cross-project undo contamination**
  - Undo stack now clears when resetting project (File > New)
  - Prevents accidentally restoring elements from previous project
  - No more "ghost undos" after project reset

## [1.13.5] - 2025-12-01

### Changed

- **Keyboard shortcuts modified to avoid browser conflicts**
  - `Ctrl+C` → `Shift+C` (Add circle)
  - `Ctrl+R` → `Shift+R` (Add rectangle)
  - `Ctrl+L` → `Shift+L` (Add leg)
  - `Ctrl+P` → `Shift+P` (Project settings)
  - `Ctrl+Z` remains unchanged (standard undo)
  - All UI hints updated to reflect new shortcuts

### Fixed

- **ESC key modal closing bug**
  - Fixed critical bug where pressing ESC to close modals didn't decrement the modal counter
  - Modal counter now correctly decrements when ESC is pressed
  - Keyboard shortcuts properly re-enabled after closing modals with ESC
  - Solution: Modified shortcut handler to allow ESC key through even when modals are open
  - All modals now have consistent ESC behavior (equivalent to clicking Cancel button)
- **Modal text input interference resolved**
  - All keyboard shortcuts now automatically disabled when any modal dialog is open
  - Prevents letter shortcuts (D, P, M, R, F) from triggering while typing in text fields
  - No more accidental operations during form input
  - Implementation: Shortcut action checks `modalStore` state before processing any shortcuts

## [1.13.1] - 2025-11-12

### Changed

- Updated dependencies to latest versions
  - Svelte 5.43.6
  - Vite 7.2.2
  - Three.js 0.181.1
  - Tailwind CSS 4.1.17
  - Zod 4.1.12
  - TypeScript 5.9.3
  - ESLint 9.39.1
  - And other supporting packages
- **Node.js requirement increased to >=24.0.0** (previously >=22.0.0)
- **npm requirement increased to >=11.0.0** (previously >=10.0.0)

## [1.13.0] - 2025-10-15

### Added

- **Magnetic snapping for alignment guides**
  - Elements now snap to alignment positions when within 0.2mm of other elements
  - Snaps to centers, edges, and alignment points automatically during drag
  - Works independently on X and Y axes for precise positioning
  - Configurable snap distance via `ALIGNMENT_SNAP_DISTANCE` constant
  - Only active when Align toggle is enabled
  - Reduces manual fine-tuning and improves alignment accuracy

### Changed

- **UI improvements**
  - Moved Align toggle next to Pointer/Measure mode buttons for better discoverability
  - Improved visual grouping of related controls in navigation bar

## [1.12.0] - 2025-10-13

### Added

- **Async mesh generation with progress tracking**
  - Mesh generation now yields control to the event loop after every CSG operation
  - Prevents UI freezing when generating meshes with 100+ components
  - Real-time progress bar in mesh display modal showing percentage and visual indicator
  - Smooth UI updates throughout the generation process
  - Configurable `YIELD_DELAY_MS` constant for testing (set to 0 for production, 10+ for testing)

### Changed

- **Improved 3D mesh generation architecture**
  - `generateMesh()` function is now async and accepts optional `onProgress` callback
  - `generateMeshLazy()` updated to accept and pass through progress callback
  - Modal component now receives mesh generator function instead of Promise
  - Progress tracking integrated into modal for real-time feedback
  - Total operation count calculated before generation starts for accurate progress
  - Leg filtering moved earlier to ensure accurate operation count

### Fixed

- **Print tolerance positioning bug**
  - Fixed element centers shifting when print tolerance was applied
  - Component holes now stay in their original positions
  - Only hole sizes and panel cavity dimensions are affected by tolerance
  - Changed tolerance direction: panel cavity now correctly shrinks (was incorrectly growing)

## [1.11.3] - 2025-10-13

### Added

- **Automatic leg collision detection** during 3D mesh generation
  - Legs that overlap with component holes are automatically filtered out
  - Prevents CSG (Constructive Solid Geometry) conflicts in mesh generation
  - Warning message displays count of hidden legs in mesh display modal
  - Collision detection handles both circular and rectangular components (including rotated rectangles)
  - No workflow changes required - users can place legs anywhere during design phase

### Changed

- **Improved mesh generation reliability**
  - `MeshInfoTuple` type now includes `hiddenLegsCount` field for tracking filtered legs
  - Added `isLegOverlappingCircle()` and `isLegOverlappingRectangle()` collision detection functions
  - Both main and hollow meshes now use filtered leg lists to prevent geometry errors

## [1.11.2] - 2025-10-13

### Added

- **Print Tolerance feature** for 3D printer calibration compensation
  - Adjustable tolerance setting (0-2mm with 0.1mm precision)
  - Compensates for 3D printer dimensional inaccuracies by:
    - Enlarging component holes (adds tolerance to circle radius and rectangle dimensions)
    - Shrinking holder panel (subtracts tolerance from panel width/height)
  - Ensures THT components fit easily while holder grips PCB snugly
  - Configuration available in Project Settings modal
  - Not applied to positive mesh (PCB visualization uses exact dimensions)
- **SEO improvements**
  - Added sitemap.xml for better search engine indexing
  - Added Google Search Console verification file

### Changed

- **Code documentation**
  - Added comprehensive JSDoc comments throughout the codebase
  - Improved code comments for type definitions, stores, and components
  - Enhanced inline documentation for better maintainability

## [1.11.1] - 2025-10-12

### Added

- **SEO metadata** in index.html
  - Added meta description, keywords, and Open Graph tags
  - Improved search engine discoverability
  - Enhanced social media sharing preview

### Fixed

- Library rename item functionality
  - Fixed bug preventing proper renaming of saved library items

### Changed

- Code quality improvements across multiple components
  - Simplified logic in AppDesigner, AppNavigation, and modal components
  - Reduced code complexity in mesh generation, fine movement, and measurement utilities
  - Eliminated 17 lines of unnecessary code for better maintainability

## [1.11.0] - 2025-10-11

### Added

- **Positive mesh (PCB) visualization** in 3D mesh display modal
  - Toggle between holder mesh and PCB component visualization
  - Adjustable distance slider (0-50mm) to separate holder and PCB views
  - PCB mesh shows components as pillars extending from thin base plate
  - Useful for visualizing component layout and holder fit
  - Both meshes rendered simultaneously with adjustable spacing

### Changed

- **Major code quality improvements** across entire codebase
  - Created `src/lib/constants.ts` for centralized configuration
    - Element visual properties: `ELEMENT_OPACITY`, `ELEMENT_DRAGGABLE`
    - Element colors: `CIRCLE_COLOR`, `RECTANGLE_COLOR`, `LEG_COLOR`
    - Fine movement constants: `FINE_MOVEMENT_DELTA`, `FINE_MOVEMENT_SHIFT_MULTIPLIER`
    - Unified `ELEMENT_SKIP_JSON_PROPERTIES` (replaced 3 separate arrays)
  - Created `src/types/typeGuards.ts` for type-safe element discrimination
    - Replaced 10+ unsafe string checks with proper TypeScript type guards
    - `isCircle()`, `isRectangle()`, `isLeg()` functions with full type inference
  - Fixed naming: `empytMeasurementInfo` → `emptyMeasurementInfo`
  - Improved type safety and IDE support throughout
  - ~150 lines of duplicated code eliminated
  - No functional changes, purely internal improvements

## [1.10.1] - 2025-10-11

### Changed

- Code cleanup: refactored mesh generation code (`src/lib/3d/mesh.ts`)
  - Fixed typo: `componentHeigh` → `componentHeight`
  - Added named constants for magic numbers (`PANEL_EDGE_FACTOR`, `PANEL_CENTER_FACTOR`, `POSITIVE_BASE_THICKNESS`)
  - Replaced all hardcoded division values with named constants for better maintainability
  - Added comprehensive JSDoc documentation for main functions
  - Improved inline comments for clarity throughout mesh generation process
  - No functional changes, purely internal code quality improvements

## [1.10.0] - 2025-10-11

### Added

- Rectangle rotation feature (0-359 degrees)
  - R key: rotate +5°
  - SHIFT+R: reset rotation to 0°
  - F key: flip dimensions (swap width/height)
  - Rotation field in rectangle settings modal
  - Rotation displayed in context menu and hover info
  - 3D mesh generation with rotation applied
- Hover info panel for elements
  - Shows element dimensions and type
  - Displays available keyboard shortcuts
  - Positioned to avoid overlapping elements
- Library support for rotated rectangles

### Changed

- Keyboard shortcuts remapped for consistency
  - Creation shortcuts: SHIFT+C/R/L → CTRL/CMD+C/R/L (circle/rectangle/leg)
  - Project settings: SHIFT+P → CTRL+P
  - SHIFT modifier now reserved for element modifications
- Fine movement enhanced: SHIFT+arrow keys move 5x faster (0.5mm vs 0.1mm)
- **Rectangle coordinate system changed to center-based** (matching circles)
  - Rectangles now store center position (x, y) instead of top-left corner
  - Rotation now happens around the center point
  - Konva rendering updated with `offsetX`/`offsetY` for center-based rendering
  - 3D mesh generation simplified (removed pivot point translation)
  - Boundary limiting logic updated for center-based calculations
  - **Breaking change**: Existing saved projects with rectangles will need manual repositioning

### Fixed

- Rectangle rotation implementation
  - Fixed 3D mesh rotation direction to match 2D canvas
  - Simplified rotation logic (no longer needs pivot point adjustments)
- Boundary limiting bugs
  - Fixed rectangle boundary check using actual dimensions instead of LEG_SIZE
  - Added rotation-aware boundary checking (calculates axis-aligned bounding box from center)
  - Rectangles and legs now properly constrained on all edges

## [1.9.1] - 2025-10-10

### Fixed

- Three.js memory leak when closing 3D mesh modal (proper disposal of BufferGeometry and Material)

### Removed

- Unused `ieee754` dependency

### Changed

- Code cleanup: removed unnecessary brackets from single-line statements in TypeScript files

## [1.9.0] - 2025-06-29

### Fix

- Update deps

## [1.8.6] - 2025-04-27

### Fix

- Update deps

## [1.8.1] - 2025-02-22

### Fix

- Update deps

## [1.8.0] - 2025-02-18

### Feat

- Add hollow postfix for download filename
- Add date and time for download filename
- Remove text STL file download button
- Some UI fix

## [1.7.1] - 2025-01-30

### Fix

- Update deps

## [1.7.0] - 2025-01-25

### New

- Image resize to avoid using zoom after loading (if larger than 1280x1024)

## [1.6.6] - 2025-01-24

### Fix

- Disable doubleclick editor when measure mode
- Rename Coverage to Hollow

## [1.6.3] - 2025-01-22

### New

- Measurement tool: can display distance in 1/10th millimeter, available by pressing M button

## [1.5.5] - 2025-01-19

### New

- Change icons to @sveltify
- Allow undo component deletes (ctrl+z)
- Delete all legs in one step
- Add corner legs automatically in one step

### Change

- Move zoom slider to top
- Change zoom range to 10..300%

### Fixed

- 3D light and shadow

## [1.5.0] - 2025-01-18

### Chore

- Updated to Svelte5

## [1.4.1] - 2024-02-04

### Fixed

- Update dependencies

## [1.4.0] - 2024-01-23

### Added

- Printable label: set a label to print as text onto the side of cuboid

## [1.3.3] - 2024-01-22

### Added

- Image zoom: allow zoom PCB image in range 10...200%

## [1.3.2] - 2024-01-19

### Changed

- PWA mode: allow install as application

## [1.3.1] - 2024-01-10

### Changed

- Remove flowbite icons, use svg instead

## [1.3.0] - 2024-01-10

### Changed

- Drop SvelteKit and use Svelte only with Vite: smaller bundle size, faster loading

## [1.2.1] - 2024-01-09

### Added

- Coverage option: you can see only top layert
- Shortcuts

## [1.2.0] - 2024-01-08

### Changed

- Restructure export and import formats
- UI improvement
- Library export to JSON file
- Library import from JSON file

## [1.1.0] - 2024-01-07

### Added

- Shape context menu: Properties, Duplicate and Delete
- Library, favorite items
- Rotate rectangle

### Changed

- Input values use boundaries

### Fixed

- Handle mesh generation errors
- Removed and manually implemented buffer emulation

## [1.0.5] - 2024-01-05

### Added

- Open sideparts for easy removal

### Fixed

- Wireframe checkbox layout

## [1.0.4] - 2024-01-05

- First public version

## Unreleased

### Added

### Changed

### Removed

### Fixed
