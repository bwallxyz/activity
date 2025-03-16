<script lang="ts">
	// Stores
	import { guests } from "$lib/stores/guests";
	import { onMount } from "svelte";
	import { logDebug } from "$lib/utils/debugHelper";
	
	// Check if we're in Discord environment
	let isDiscord = false;
	
	onMount(() => {
		try {
			// Check for Discord environment
			isDiscord = window.location.href.includes('discord.com') || 
					   window.location.hostname.includes('discord') ||
					   document.referrer.includes('discord');
					   
			logDebug("UI component mounted. Environment: " + (isDiscord ? "Discord" : "Browser"));
		} catch (e) {
			logDebug("UI environment detection error: " + e, "error");
		}
	});
</script>

<!-- Main container -->
<div class="text-white font-semibold font-sans">
	<!-- User UI -->
	<div class="fixed bottom-8 left-6 flex flex-col space-y-6">
		{#each $guests as guest}
			<div class="flex flex-row justify-center items-center space-x-3">
				<img src="/images/sound.svg" alt="Sound icon" height="32" width="32" />
				<p class="px-4 py-2 rounded-full bg-black/50 backdrop-blur-xl">{guest.playerState.getProfile().name}</p>
			</div>
		{/each}
	</div>

	<!-- Controls - always visible -->
	<div class="fixed right-6 bottom-6 flex flex-row justify-center items-center space-x-3">
		<img src="/images/controls.svg" alt="Controls prompts" class="h-32" />
	</div>
	
	<!-- Discord-specific message if needed -->
	{#if isDiscord}
		<div class="fixed top-4 left-0 right-0 text-center">
			<p class="px-4 py-2 rounded-lg bg-black/70 inline-block">Discord Activity Running</p>
		</div>
	{/if}
</div>