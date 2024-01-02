# PCB THT holder

3D STL file generator for THT PCB panels, online access: https://segmentcontroller.github.io/pcb-tht-holder/

I make almost all of my printed circuit boards with online design software and entrust the manufacturing company to install the SMD components. I install the THT (through hole technology) components at home for two reasons:

- What they charge for meticulous manual work cannot be called cheap.
- Not all THT parts are needed, in many cases only 2 of the 6 relays are installed. This can reduce costs.

> I would also like to do the THT installation at home nicely. However, with many panels there are "traces of haste".

## That's why I created an **online tool** that:

- Based on the photo of the PCB, it helps to leave the place of the protruding (THT) parts empty.
- It creates a 3D format (STL) output that, if you print, will keep the parts straight during soldering.
- It can work without registration and without uploading (and storing) a photo of the PCB.

In its current state, it facilitates the installation of circular and oblong components. This is sufficient in the following cases: **relays, capacitors, resistors, terminals and pin-headers.** It automatically calculates the required area and volume based on the height of the parts. But it doesn't mean that there aren't any mistakes in it: if you experience anything, I welcome your comments.
