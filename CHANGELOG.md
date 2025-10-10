# Change log

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

### Fixed

- Rectangle rotation implementation
  - Restored top-left origin for rectangles (removed offsetX/offsetY)
  - Fixed 3D mesh rotation direction to match 2D canvas
  - Fixed 3D mesh rotation pivot point (now uses top-left corner)
  - Backward compatibility with saved projects maintained
- Boundary limiting bugs
  - Fixed rectangle boundary check using actual dimensions instead of LEG_SIZE
  - Added rotation-aware boundary checking (calculates axis-aligned bounding box)
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
