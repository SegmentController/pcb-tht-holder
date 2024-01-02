<script lang="ts">
	import '../app.postcss';

	import { Button, Dropdown, DropdownDivider, DropdownItem } from 'flowbite-svelte';
	import { Navbar, NavBrand, NavHamburger, NavLi, NavUl } from 'flowbite-svelte';
	import { ChevronDownOutline } from 'flowbite-svelte-icons';
	import { onMount } from 'svelte';
	import { Circle, Image, Layer, Stage } from 'svelte-konva';

	import ModalConfirm from '$components/ModalConfirm.svelte';
	import PcbImageDropzone from '$components/PcbImageDropzone.svelte';

	onMount(() => {});

	let pcbImage: HTMLImageElement | undefined;
	let filename: string = '';
	let size: { width: number; height: number } | undefined;
	let modalConfirm: ModalConfirm;

	const reset = () => {
		modalConfirm.open('Are you sure to reset PCB panel?', () => {
			pcbImage = undefined;
			filename = '';
			size = undefined;
		});
	};

	const onImageUpload = (
		_pcbImage: HTMLImageElement,
		_filename: string,
		_size: { width: number; height: number }
	) => {
		pcbImage = _pcbImage;
		filename = _filename;
		size = _size;
	};
</script>

<ModalConfirm bind:this={modalConfirm} />

<Navbar>
	<NavBrand href="/">
		<img src="/favicon.png" class="me-3 h-6 sm:h-9" alt="PCB THT Holder Logo" />
		<span class="self-center whitespace-nowrap text-xl font-semibold dark:text-white"
			>PCB THT Holder</span
		>
	</NavBrand>
	<div class="flex md:order-2">
		<Button size="sm" disabled={!pcbImage}>Download STL</Button>
		<NavHamburger />
	</div>
	<NavUl class="order-1">
		{#if !pcbImage}
			<NavLi href="/">Upload a file</NavLi>
		{/if}

		{#if pcbImage}
			<NavLi class="cursor-pointer">
				Add<ChevronDownOutline class="w-3 h-3 ms-2 text-primary-800 dark:text-white inline" />
			</NavLi>
			<Dropdown class="w-44 z-20">
				<DropdownItem href="/">Dashboard</DropdownItem>
				<DropdownItem href="/">Earnings</DropdownItem>
				<DropdownDivider />
				<DropdownItem href="/">Sign out</DropdownItem>
			</Dropdown>
			<NavLi href="/" on:click={reset}>Reset</NavLi>
		{/if}
	</NavUl>
</Navbar>

<div class="flex justify-center">
	<p class="text-sm">{filename}</p>
	{#if size}
		<p class="text-sm text-gray-500">({size.width}x{size.height})</p>
	{/if}
</div>
<div class="flex justify-center">
	{#if !pcbImage}
		<PcbImageDropzone onUpload={onImageUpload} />
	{:else if typeof window !== 'undefined' && size}
		<Stage config={{ width: size.width, height: size.height }}>
			<Layer>
				<Image config={{ image: pcbImage, scaleY: -1, offsetY: size.height, opacity: 0.25 }} />
				<Circle
					config={{
						radius: 30,
						fill: 'red',
						x: 20,
						y: 30,
						draggable: true,
						opacity: 0.75
					}}
				/>
			</Layer>
		</Stage>
	{/if}
</div>
