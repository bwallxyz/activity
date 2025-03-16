<script lang="ts">
	// Svelte
	import { onMount } from "svelte";
	
	// Components
	import Scene from "$lib/components/Scene.svelte";
	import UI from "$lib/components/UI.svelte";
	import Auth from "$lib/components/Auth.svelte";
	
	let isAuthenticated = false;
	
	function handleAuthComplete() {
		isAuthenticated = true;
	}
</script>

<!-- Main container -->
<div class="h-screen w-screen overflow-hidden">
	{#if isAuthenticated}
		<Scene />
		<UI />
	{:else}
		<Auth onAuthComplete={handleAuthComplete} />
	{/if}
</div>