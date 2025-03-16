<script lang="ts">
	// Components
	import { onMount } from "svelte";
	import { insertCoin, me } from "playroomkit";
	import { PUBLIC_PLAYROOM_ID } from "$env/static/public";
	
	let username = "Player";
	let isJoining = false;
	let error = "";
	let authenticated = false;
	let loading = true;
	
	// After authentication, we'll load the game components
	let Scene;
	let UI;
	
	onMount(async () => {
		try {
			// Try to initialize PlayroomKit without requiring Discord
			await insertCoin({
				gameId: PUBLIC_PLAYROOM_ID,
				createFallbackPlayers: true,
				playerName: "Player" 
			});
			
			// If we get here, authentication worked
			authenticated = true;
			
			// Dynamically import game components
			const sceneModule = await import("$lib/components/Scene.svelte");
			const uiModule = await import("$lib/components/UI.svelte");
			
			Scene = sceneModule.default;
			UI = uiModule.default;
			
		} catch (err) {
			console.error("Failed to initialize:", err);
			error = "Failed to initialize game. Please try again.";
		} finally {
			loading = false;
		}
	});
	
	async function handleLogin() {
		if (!username.trim()) {
			error = "Please enter a username";
			return;
		}
		
		isJoining = true;
		error = "";
		
		try {
			await insertCoin({
				gameId: PUBLIC_PLAYROOM_ID,
				createFallbackPlayers: true,
				playerName: username
			});
			
			authenticated = true;
			
			// Dynamically import game components
			const sceneModule = await import("$lib/components/Scene.svelte");
			const uiModule = await import("$lib/components/UI.svelte");
			
			Scene = sceneModule.default;
			UI = uiModule.default;
			
		} catch (err) {
			console.error("Error joining game:", err);
			error = "Failed to join. Please try again.";
		} finally {
			isJoining = false;
		}
	}
</script>

<div class="h-screen w-screen overflow-hidden">
	{#if loading}
		<!-- Loading indicator -->
		<div class="fixed inset-0 flex items-center justify-center bg-black">
			<div class="text-white text-center">
				<div class="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
				<p class="text-xl">Loading...</p>
			</div>
		</div>
	{:else if authenticated}
		<!-- Game container - only render if components are loaded -->
		{#if Scene && UI}
			<svelte:component this={Scene} />
			<svelte:component this={UI} />
		{:else}
			<!-- Loading game components -->
			<div class="fixed inset-0 flex items-center justify-center bg-black">
				<div class="text-white text-center">
					<div class="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
					<p class="text-xl">Loading game...</p>
				</div>
			</div>
		{/if}
	{:else}
		<!-- Login form -->
		<div class="fixed inset-0 flex items-center justify-center bg-black/90 backdrop-blur-sm z-50">
			<div class="bg-gray-900 p-8 rounded-lg shadow-lg max-w-md w-full">
				<h2 class="text-white text-2xl font-bold mb-6 text-center">Join Activity</h2>
				
				<form on:submit|preventDefault={handleLogin} class="space-y-4">
					<div>
						<label for="username" class="block text-white mb-2">Username</label>
						<input
							type="text"
							id="username"
							bind:value={username}
							placeholder="Enter your username"
							class="w-full px-4 py-2 bg-gray-800 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
							disabled={isJoining}
						/>
					</div>
					
					{#if error}
						<p class="text-red-400 text-sm">{error}</p>
					{/if}
					
					<button
						type="submit"
						class="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
						disabled={isJoining}
					>
						{isJoining ? 'Joining...' : 'Join'}
					</button>
				</form>
			</div>
		</div>
	{/if}
</div>