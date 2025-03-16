<script lang="ts">
	import { onMount } from "svelte";
	import { insertCoin, me } from "playroomkit";
	import { PUBLIC_PLAYROOM_ID } from "$env/static/public";
	
	let initialized = false;
	let error = "";
	
	async function initDiscord() {
		try {
			const result = await insertCoin({
				gameId: PUBLIC_PLAYROOM_ID, // Your Discord App ID 
				discord: true,
				debug: true,
				publishStateFrequency: 100
			});
			console.log("PlayroomKit initialized:", result);
			initialized = true;
		} catch (error) {
			console.error("PlayroomKit init error:", error);
			error = error.message || "Failed to initialize";
		}
	}
	
	onMount(() => {
		// Only auto-initialize in Discord environment
		if (window.location.href.includes("discord.com")) {
			initDiscord();
		}
	});
</script>

<div class="h-screen w-screen overflow-hidden flex items-center justify-center bg-black">
	{#if initialized}
		<div class="text-white text-center">
			<h1 class="text-2xl font-bold mb-4">Connected!</h1>
			<p>Activity is working properly.</p>
		</div>
	{:else if window.location.href.includes("discord.com")}
		<div class="text-white text-center">
			<div class="animate-spin rounded-full h-16 w-16 border-b-2 border-white mx-auto mb-4"></div>
			<p class="text-xl">Connecting to Discord...</p>
			{#if error}
				<p class="text-red-500 mt-4">{error}</p>
			{/if}
		</div>
	{:else}
		<div class="text-white text-center">
			<button 
				class="bg-indigo-600 hover:bg-indigo-700 px-4 py-2 rounded-md"
				on:click={initDiscord}
			>
				Initialize Discord Activity
			</button>
		</div>
	{/if}
</div>