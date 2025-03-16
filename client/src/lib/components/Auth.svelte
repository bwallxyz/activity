<script lang="ts">
	import { onMount } from "svelte";
	import { joinSoloRoom, insertCoin } from "playroomkit";
	import { PUBLIC_PLAYROOM_ID } from "$env/static/public";

	export let onAuthComplete: () => void;
	
	let username = "";
	let isJoining = false;
	let error = "";
	let isLoading = true;

	onMount(async () => {
		// Try to auto-join with any existing session
		try {
			await insertCoin({
				gameId: PUBLIC_PLAYROOM_ID,
				createFallbackPlayers: true
			});
			onAuthComplete();
		} catch (err) {
			// If auto-join fails, show login form
			isLoading = false;
		}
	});

	async function handleSubmit() {
		if (!username.trim()) {
			error = "Please enter a username";
			return;
		}

		isJoining = true;
		error = "";

		try {
			// Join with custom username
			await insertCoin({
				gameId: PUBLIC_PLAYROOM_ID,
				createFallbackPlayers: true,
				// Use provided username
				playerName: username
			});
			onAuthComplete();
		} catch (err) {
			console.error("Error joining game:", err);
			error = "Failed to join. Please try again.";
			isJoining = false;
		}
	}
</script>

<div class="fixed inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-50">
	{#if isLoading}
		<div class="text-white text-center">
			<div class="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
			<p class="text-xl">Connecting...</p>
		</div>
	{:else}
		<div class="bg-gray-900 p-8 rounded-lg shadow-lg max-w-md w-full">
			<h2 class="text-white text-2xl font-bold mb-6 text-center">Join Activity</h2>
			
			<form on:submit|preventDefault={handleSubmit} class="space-y-4">
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
	{/if}
</div>