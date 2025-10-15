<script lang="ts">
	let visible = $state(false);
	let posX = $state(0);
	let posY = $state(0);
	let header = $state('');
	let content = $state('');
	let showTimeout: ReturnType<typeof setTimeout> | undefined;

	/**
	 * Shows hover info after 500ms delay (standard tooltip behavior)
	 * Stays visible until manually hidden (no auto-hide)
	 * @param x - X position in pixels
	 * @param y - Y position in pixels
	 * @param headerText - Header text
	 * @param contentText - Content text
	 */
	export const show = (x: number, y: number, headerText: string, contentText: string) => {
		// Clear any existing timeout
		if (showTimeout !== undefined) {
			clearTimeout(showTimeout);
			showTimeout = undefined;
		}

		// Store data for delayed show
		posX = x;
		posY = y;
		header = headerText;
		content = contentText;

		// Delay showing by 500ms (standard tooltip delay)
		showTimeout = setTimeout(() => {
			visible = true;
			showTimeout = undefined;
		}, 500);
	};

	/**
	 * Hides hover info immediately and cancels show timer
	 */
	export const hide = () => {
		// Clear show timeout if pending
		if (showTimeout !== undefined) {
			clearTimeout(showTimeout);
			showTimeout = undefined;
		}
		visible = false;
	};
</script>

{#if visible}
	<div style="position: absolute; top:{posY}px; left:{posX}px" class="hover-info">
		<div class="header">{header}</div>
		<div class="content">{content}</div>
	</div>
{/if}

<style>
	.hover-info {
		display: inline-flex;
		border: 1px #999 solid;
		width: auto;
		min-width: 200px;
		background-color: #fff;
		border-radius: 8px;
		overflow: hidden;
		flex-direction: column;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
		z-index: 1000;
		pointer-events: none;
	}
	.header {
		font-size: 0.9rem;
		font-weight: 600;
		padding: 8px 12px;
		background-color: #f8f9fa;
		border-bottom: 1px solid #e0e0e0;
	}
	.content {
		font-size: 0.85rem;
		padding: 8px 12px;
		line-height: 1.6;
		color: #555;
		white-space: pre-line;
	}
</style>
