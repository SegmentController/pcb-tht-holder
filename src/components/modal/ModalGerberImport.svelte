<script lang="ts">
	import { Button, Checkbox, Label, Modal } from 'flowbite-svelte';
	import { createEventDispatcher, untrack } from 'svelte';

	import NumberInputBound from '$components/base/input/NumberInputBound.svelte';
	import AutoFocus from '$components/modal/util/AutoFocus.svelte';
	import EscapeClose from '$components/modal/util/EscapeClose.svelte';
	import { formatMm } from '$lib/format';
	import { renderBoardSvg, svgToDataUrl } from '$lib/gerber/boardSvg';
	import { suggestLegs } from '$lib/gerber/legs';
	import {
		DEFAULT_GROUP_DISTANCE,
		DEFAULT_MARGIN,
		defaultToolKeys,
		type ElementPlan,
		planElements
	} from '$lib/gerber/plan';
	import type { DrillTool, FabPackage } from '$lib/gerber/types';
	import { LEG_SIZE } from '$types/LegData';

	const dispatch = createEventDispatcher<{
		resolve: {
			confirmed: boolean;
			plan: ElementPlan | undefined;
			/** Top-left corners of the support legs to add */
			legs: { x: number; y: number }[];
		};
	}>();

	interface Properties {
		fabPackage: FabPackage;
		name: string;
	}
	let { fabPackage, name }: Properties = $props();

	const selection = $state<Record<string, boolean>>(
		untrack(() => {
			const defaults = new Set(defaultToolKeys(fabPackage.tools));
			return Object.fromEntries(fabPackage.tools.map((tool) => [tool.key, defaults.has(tool.key)]));
		})
	);
	let groupDistance = $state(DEFAULT_GROUP_DISTANCE);
	let minMargin = $state(DEFAULT_MARGIN);
	let circleDepth = $state(5);
	let rectangleDepth = $state(5);
	let addLegs = $state(true);

	const plan = $derived(
		planElements(fabPackage.holes, fabPackage.outline, {
			toolKeys: Object.keys(selection).filter((key) => selection[key]),
			groupDistance,
			minMargin,
			circleDepth,
			rectangleDepth
		})
	);
	// Legs keep clear of pads, silkscreen, every hole and the planned elements
	const legs = $derived(
		addLegs ? suggestLegs(plan, fabPackage.holes, fabPackage.partKeepouts ?? []) : []
	);
	const preview = $derived(
		svgToDataUrl(
			renderBoardSvg(plan, {
				shapes: {
					circles: plan.circles,
					rectangles: plan.rectangles,
					legs: legs.map((leg) => ({ ...leg, width: LEG_SIZE, height: LEG_SIZE }))
				},
				layout: fabPackage.layout
			})
		)
	);
	const warnings = $derived([...fabPackage.warnings, ...plan.warnings]);
	const holeCount = $derived(plan.holes.filter((hole) => hole.selected).length);
	const isEmpty = $derived(plan.circles.length + plan.rectangles.length === 0);

	const kindLabel = (tool: DrillTool) => {
		const labels: Partial<Record<DrillTool['role'], string>> = {
			component: 'component',
			via: 'via',
			mechanical: 'mechanical',
			blind: 'blind/buried',
			pad: 'component pad'
		};
		return `${labels[tool.role] ?? 'drill'}${tool.plated ? '' : ', non-plated'}`;
	};
	const resolve = (confirmed: boolean) =>
		dispatch('resolve', {
			confirmed,
			plan: confirmed ? plan : undefined,
			legs: confirmed ? legs : []
		});
</script>

<EscapeClose on:escape={() => resolve(false)}>
	<Modal dismissable={false} open={true} size="xl" title={`Import holes: ${name}`}>
		<AutoFocus />
		<form
			onsubmit={(event) => {
				event.preventDefault();
				if (!isEmpty) resolve(true);
			}}
		>
			<div class="grid gap-6 md:grid-cols-2">
				<div class="flex flex-col gap-4">
					<div>
						<p class="mb-2 text-sm font-semibold text-gray-700">Drill tools to import</p>
						{#if fabPackage.tools.length === 0}
							<p class="text-sm text-gray-500">No drilled holes found.</p>
						{:else}
							<table class="w-full text-sm">
								<thead>
									<tr class="text-left text-gray-500">
										<th class="pb-1 font-medium">Use</th>
										<th class="pb-1 font-medium">Drill</th>
										<th class="pb-1 font-medium">Holes</th>
										<th class="pb-1 font-medium">Kind</th>
										<th class="pb-1 font-medium">File</th>
									</tr>
								</thead>
								<tbody>
									{#each fabPackage.tools as tool (tool.key)}
										<tr>
											<td class="py-0.5"><Checkbox bind:checked={selection[tool.key]} /></td>
											<td class="py-0.5">{formatMm(tool.diameter)} mm</td>
											<td class="py-0.5">{tool.count}</td>
											<td class="py-0.5">{kindLabel(tool)}</td>
											<td class="py-0.5 truncate max-w-32" title={tool.file}>{tool.file}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						{/if}
					</div>
					<Checkbox bind:checked={addLegs}
						>Add support legs ({legs.length}), clear of parts and holes</Checkbox
					>
					<div class="grid grid-cols-2 gap-4">
						<div>
							<Label class="mb-2" for="groupDistance">Group holes closer than (mm)</Label>
							<NumberInputBound id="groupDistance" max={50} min={0} bind:value={groupDistance} />
						</div>
						<div>
							<Label class="mb-2" for="minMargin">Wall around a hole (mm)</Label>
							<NumberInputBound id="minMargin" max={5} min={0} bind:value={minMargin} />
						</div>
						<div>
							<Label class="mb-2" for="circleDepth">Circle depth (mm)</Label>
							<NumberInputBound id="circleDepth" max={99} min={0.5} bind:value={circleDepth} />
						</div>
						<div>
							<Label class="mb-2" for="rectangleDepth">Rectangle depth (mm)</Label>
							<NumberInputBound
								id="rectangleDepth"
								max={99}
								min={0.5}
								bind:value={rectangleDepth}
							/>
						</div>
					</div>
				</div>
				<div class="flex flex-col gap-2">
					<img
						class="w-full rounded border border-gray-300 bg-white"
						alt="Board preview with the planned holder elements"
						src={preview}
					/>
					<p class="text-sm text-gray-700">
						{holeCount} hole(s) &rarr; {plan.rectangles.length} rectangle(s), {plan.circles.length}
						circle(s){addLegs ? `, ${legs.length} support leg(s)` : ''}. Board {formatMm(
							plan.panel.width
						)} x {formatMm(plan.panel.height)} mm{fabPackage.outlineFile
							? ` (${fabPackage.outlineFile})`
							: ''}.
					</p>
					{#each warnings as warning (warning)}
						<p class="text-xs text-amber-700">{warning}</p>
					{/each}
				</div>
			</div>
			<div class="text-center mt-4 space-y-6">
				<Button class="me-2" color="green" disabled={isEmpty} type="submit">Import</Button>
				<Button class="me-2" color="alternative" onclick={() => resolve(false)}>Cancel</Button>
			</div>
		</form>
	</Modal>
</EscapeClose>
