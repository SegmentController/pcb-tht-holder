<script lang="ts">
	import '../app.postcss';

	import { Button, Dropdown, DropdownDivider, DropdownItem } from 'flowbite-svelte';
	import { Navbar, NavBrand, NavHamburger, NavLi, NavUl } from 'flowbite-svelte';
	import { ChevronDownOutline } from 'flowbite-svelte-icons';
	import { onMount } from 'svelte';
	import { Circle, Image, Layer, Stage } from 'svelte-konva';

	import ModalConfirm from '$components/ModalConfirm.svelte';
	import ModalPanelSettings, { type PanelSettings } from '$components/ModalPanelSettings.svelte';
	import PcbImageDropzone, { type ImageSize } from '$components/PcbImageDropzone.svelte';

	onMount(() => {
		const remoteImage = document.createElement('img');
		remoteImage.src = 'https://www.raypcb.com/wp-content/uploads/2023/08/image.avif';
		remoteImage.addEventListener('load', () =>
			onImageUpload(remoteImage, 'dummy.jpg', {
				width: remoteImage.width,
				height: remoteImage.height
			})
		);
	});

	let pcbImage: HTMLImageElement | undefined;
	let filename: string = '';
	let size: ImageSize | undefined;

	let modalConfirm: ModalConfirm;
	let modalPanelSettings: ModalPanelSettings;

	let panelSettings: PanelSettings = {
		width: 100,
		height: 80,
		pcbThickness: 1.6,
		smdHeight: 3
	};

	const reset = () => {
		modalConfirm.open('Are you sure to reset PCB panel?', () => {
			pcbImage = undefined;
			filename = '';
			size = undefined;
		});
	};

	const onImageUpload = (image: HTMLImageElement, name: string, imagesize: ImageSize) => {
		pcbImage = image;
		filename = name;
		size = imagesize;
		openPanelSettings();
	};

	const openPanelSettings = () =>
		modalPanelSettings.open(panelSettings, (recentSettings) => {
			panelSettings = recentSettings;
		});
</script>

<ModalConfirm bind:this={modalConfirm} />
<ModalPanelSettings bind:this={modalPanelSettings} />

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
			<NavLi href="/" on:click={openPanelSettings}>Panel settings</NavLi>
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
