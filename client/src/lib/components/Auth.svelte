<script lang="ts">
	// Svelte
	import { onMount } from "svelte";
	
	// Components
	import Scene from "$lib/components/Scene.svelte";
	import UI from "$lib/components/UI.svelte";
	import Auth from "$lib/components/Auth.svelte";
	
	let isAuthenticated = false;
	let sceneInitialized = false;
	
	function handleAuthComplete() {
		isAuthenticated = true;
	}
</script>

<!-- Main container -->
<div class="h-screen w-screen overflow-hidden">
	{#if isAuthenticated}
		<Scene bind:isInitialized={sceneInitialized} />
		{#if sceneInitialized}
			<UI />
		{:else}
			<div class="fixed inset-0 flex items-center justify-center text-white">
				<div class="text-center">
					<div class="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
					<p class="text-xl">Loading scene...</p>
				</div>
			</div>
		{/if}
	{:else}
		<Auth onAuthComplete={handleAuthComplete} />
	{/if}
</div>