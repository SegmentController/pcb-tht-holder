# Demo projects: credits and licences

The demo projects under the dropzone are ready-made `.tht3d` files. Two are built from open-source KiCad
boards: each file embeds a cropped top-view picture of the board and hole/leg placements derived from the
footprints of the original design. The full licence text of each board is in [`licenses/`](./licenses).
The third, **NE555 from Gerbers**, was started straight from a Gerber package (see below).

| Demo                 | File                         | Design by                                   | Source                                                                            | Licence        | Licence text                                                                               |
| -------------------- | ---------------------------- | ------------------------------------------- | --------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------ |
| Servo Controller 555 | `servo-controller-555.tht3d` | [Shlok Chorge](https://github.com/shlok-ac) | [shlok-ac/Servo-Controller-555](https://github.com/shlok-ac/Servo-Controller-555) | CERN-OHL-S-2.0 | [`licenses/servo-controller-555-LICENSE.txt`](./licenses/servo-controller-555-LICENSE.txt) |
| Arduino ICSP Shield  | `arduino-icsp-shield.tht3d`  | [mprosk](https://github.com/mprosk)         | [mprosk/arduino_icsp_shield](https://github.com/mprosk/arduino_icsp_shield)       | MIT            | [`licenses/arduino-icsp-shield-LICENSE.txt`](./licenses/arduino-icsp-shield-LICENSE.txt)   |

## Started from Gerber files

| Demo               | File          | Gerber package      | Design                                                                  |
| ------------------ | ------------- | ------------------- | ----------------------------------------------------------------------- |
| NE555 from Gerbers | `ne555.tht3d` | `ne555-gerbers.zip` | Small NE555 example board of this project's author, made with tscircuit |

The project was created by dropping `ne555-gerbers.zip` on the dropzone with the default import settings:
the panel size (23.6 × 16.2 mm) comes from the board outline, the two-pin header holes became one rectangle,
and the picture is rendered from the top copper, solder mask and silkscreen layers. The package is offered
on the demo card so the drag and drop import can be tried with a real file.

## Notes

- Pictures: `assets/pcb-layout.png` (Servo Controller 555) and
  `img/render.png` (Arduino ICSP Shield) of the upstream repositories, cropped to the board outline,
  re-encoded as JPEG and scaled down. They are modified copies.
- Placement data (circles, rectangles, support legs) was generated from the upstream `.kicad_pcb` files and
  are part of this project's demo content, not of the upstream designs.
- **Servo Controller 555** is licensed under CERN-OHL-S-2.0 (strongly reciprocal). The original design files
  are available at the source repository above; the licence text is shipped in `licenses/`.
- **Arduino ICSP Shield**: the copyright and permission notices are kept in `licenses/`.
