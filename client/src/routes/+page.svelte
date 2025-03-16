<script lang="ts">
	import { onMount } from "svelte";
	import { PUBLIC_PLAYROOM_ID } from "$env/static/public";
	import Scene from "$lib/components/Scene.svelte";
	import UI from "$lib/components/UI.svelte";
	
	let initialized = false;
	let error = "";
	let isDiscord = false;
	
	// Create a direct approach that bypasses PlayroomKit's Discord auth
	function setupDiscordCommunication() {
		// Create a message handler
		window.addEventListener("message", (event) => {
			// Verify origin for security
			if (event.origin.includes("discord.com")) {
				console.log("Received message from Discord:", event.data);
				
				// Process Discord messages directly
				if (event.data && event.data.type === "READY") {
					initialized = true;
				}
			}
		});
		
		// Let Discord know we're ready
		window.parent.postMessage({ type: "ACTIVITY_READY" }, "*");
		console.log("Sent ACTIVITY_READY to parent");
		
		// For testing purposes - initialize after a delay
		setTimeout(() => {
			initialized = true;
		}, 3000);
	}
	
	onMount(() => {
		// Detect Discord environment
		isDiscord = window.location.href.includes("discord.com") || 
			         window !== window.parent;
		
		if (isDiscord) {
			setupDiscordCommunication();
		}
	});
</script>

<div class="h-screen w-screen overflow-hidden">
	{#if initialized}
		<Scene />
		<UI />
	{:else if isDiscord}
		<div class="h-full w-full flex items-center justify-center bg-black">
			<div class="text-white text-center">
				<div class="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
				<p class="text-xl">Initializing Discord Activity...</p>
				{#if error}
					<p class="text-red-500 mt-4">{error}</p>
				{/if}
			</div>
		</div>
	{:else}
		<div class="h-full w-full flex items-center justify-center bg-black">
			<div class="bg-gray-900 p-8 rounded-lg max-w-md w-full text-center">
				<h2 class="text-white text-2xl font-bold mb-6">3D Activity</h2>
				<p class="text-white mb-6">This activity is designed to run in Discord.</p>
				<button
					on:click={() => initialized = true}
					class="py-2 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md"
				>
					Preview Anyway
				</button>
			</div>
		</div>
	{/if}
</div>