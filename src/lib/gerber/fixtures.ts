/** Sample fabrication files (tscircuit NE555 board: 2-pin header, nine vias, two mounting holes) */
const files = import.meta.glob<string>('./fixtures/*', {
	eager: true,
	import: 'default',
	query: '?raw'
});

const fixture = (name: string) => files[`./fixtures/${name}`];

export const drillPth = fixture('drill-L1-L2.drl');
export const drillNpth = fixture('drill_npth.drl');
export const edgeCuts = fixture('Edge_Cuts.gbr');
export const copperTop = fixture('F_Cu.gbr');
export const maskTop = fixture('F_Mask.gbr');
export const silkTop = fixture('F_SilkScreen.gbr');
