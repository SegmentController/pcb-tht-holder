# Change log

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
