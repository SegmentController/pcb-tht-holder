# Gerber / fabrication file import (src/lib/gerber)

- **Gerber import** (`AppDropzone.svelte` → `importFabFiles`, review dialog `ModalGerberImport.svelte`): routed by file
  name extension (`isFabFileName`), before the MIME check. Stored y is plain CAM Y-up (`y = gerberY - outlineMinY`,
  the designer flips the picture itself); the board outline bbox (rounded up to 0.1) is the panel, clamped to the 10–999 mm
  limits of the settings dialog. The review dialog's _Add support legs_ option (on by default) calls `suggestLegs`. Holes of the same diameter within `groupDistance` form one part: lone hole → circle,
  several → min-area oriented rectangle padded by half the pitch (rotation = CCW angle in CAM coordinates). The project
  image is a generated SVG data URL (no image-less projects), so restore, `.tht3d` and 3D work unchanged. The designer draws generated (SVG) pictures opaque and photos at 25 % (`isGeneratedImage`). Layers are SVG `<mask>`s in CAM coordinates (dark = white, clear = black, so clear polarity needs no special case); mask-layer dark objects are the openings. Pictures above 1.5 MB fall back to outline + holes (`renderProjectImage`)
- **Standards followed by the gerber library** (`src/lib/gerber/`): Ucamco Gerber Layer Format (plotter, rev. 2026.05) and
  XNC (drills, rev. 2021.11) plus the dialects of real CAD output. Layer role: X2 `FileFunction` first, then names
  (`roleOf`); polarity: `.FilePolarity`/`IPNEG` (mask dark = openings unless declared Positive). Excellon without a
  declared layout is parsed with the defaults and re-parsed with candidate layouts when the holes miss the outline
  (`refineLayout`). Tool defaults (`defaultToolKeys`): component role or plated >= 0.7 mm, never vias, non-plated or blind.
  When adding syntax support add a case to `plotter.test.ts` / `excellon.test.ts` that cites the spec section
