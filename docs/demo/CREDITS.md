# Demo projects: credits and licences

The demo projects under the dropzone are ready-made `.tht3d` files built from three open-source KiCad
boards. Each file embeds a cropped top-view picture of the board and hole/leg placements derived from the
footprints of the original design. The full licence text of each board is in [`licenses/`](./licenses).

| Demo                 | File                         | Design by                                              | Source                                                                            | Licence        | Licence text                                                                               |
| -------------------- | ---------------------------- | ------------------------------------------------------ | --------------------------------------------------------------------------------- | -------------- | ------------------------------------------------------------------------------------------ |
| Open555              | `open555.tht3d`              | [cheyao](https://github.com/cheyao) (Hack Club Solder) | [cheyao/Open555](https://github.com/cheyao/Open555)                               | Zlib           | [`licenses/open555-LICENSE.txt`](./licenses/open555-LICENSE.txt)                           |
| Servo Controller 555 | `servo-controller-555.tht3d` | [Shlok Chorge](https://github.com/shlok-ac)            | [shlok-ac/Servo-Controller-555](https://github.com/shlok-ac/Servo-Controller-555) | CERN-OHL-S-2.0 | [`licenses/servo-controller-555-LICENSE.txt`](./licenses/servo-controller-555-LICENSE.txt) |
| Arduino ICSP Shield  | `arduino-icsp-shield.tht3d`  | [mprosk](https://github.com/mprosk)                    | [mprosk/arduino_icsp_shield](https://github.com/mprosk/arduino_icsp_shield)       | MIT            | [`licenses/arduino-icsp-shield-LICENSE.txt`](./licenses/arduino-icsp-shield-LICENSE.txt)   |

## Notes

- Pictures: `assets/pcb-front.png` (Open555), `assets/pcb-layout.png` (Servo Controller 555) and
  `img/render.png` (Arduino ICSP Shield) of the upstream repositories, cropped to the board outline,
  re-encoded as JPEG and scaled down. They are modified copies.
- Placement data (circles, rectangles, support legs) was generated from the upstream `.kicad_pcb` files and
  are part of this project's demo content, not of the upstream designs.
- **Servo Controller 555** is licensed under CERN-OHL-S-2.0 (strongly reciprocal). The original design files
  are available at the source repository above; the licence text is shipped in `licenses/`.
- **Open555** and **Arduino ICSP Shield**: the copyright and permission notices are kept in `licenses/`.
