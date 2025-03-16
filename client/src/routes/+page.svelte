<script lang="ts">
	// Components
	import { onMount } from "svelte";
	import Scene from "$lib/components/Scene.svelte";
	import UI from "$lib/components/UI.svelte";
	import { insertCoin, me } from "playroomkit";
	import { PUBLIC_PLAYROOM_ID } from "$env/static/public";
	
	let authenticated = false;
	let error = "";
	let loading = true;
	
	onMount(() => {
		// Don't try to auto-join, just show the form
		loading = false;
	});
	
	async function handleJoin() {
		loading = true;
		error = "";
		
		try {
			// Try all possible options
			await insertCoin({
				gameId: PUBLIC_PLAYROOM_ID,
				createFallbackPlayers: true,
				playerName: "Player" + Math.floor(Math.random() * 1000)
			});
			
			authenticated = true;
		} catch (err) {
			console.error("Error joining:", err);
			error = "Failed to join. " + (err.message || "Unknown error");
		} finally {
			loading = false;
		}
	}
</script>

<div class="h-screen w-screen overflow-hidden">
	{#if loading}
		<!-- Loading spinner -->
		<div class="fixed inset-0 flex items-center justify-center bg-black">
			<div class="text-white text-center">
				<div class="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
				<p class="text-xl">Loading...</p>
				{#if error}
					<p class="text-red-400 mt-4">{error}</p>
					<button 
						class="mt-4 px-4 py-2 bg-blue-600 rounded-md text-white"
						on:click={() => loading = false}
					>
						Go back
					</button>
				{/if}
			</div>
		</div>
	{:else if authenticated}
		<!-- Game is loaded, show scene -->
		<Scene />
		<UI />
	{:else}
		<!-- Join button -->
		<div class="fixed inset-0 flex items-center justify-center bg-black">
			<div class="bg-gray-900 p-8 rounded-lg shadow-lg max-w-md w-full text-center">
				<h2 class="text-white text-2xl font-bold mb-6">3D Activity</h2>
				
				{#if error}
					<p class="text-red-400 mb-4">{error}</p>
				{/if}
				
				<button
					on:click={handleJoin}
					class="py-2 px-6 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
				>
					Join Now
				</button>
			</div>
		</div>
	{/if}
</div>