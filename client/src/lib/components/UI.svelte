<script lang="ts">
	// Stores
	import { guests } from "$lib/stores/guests";
</script>

<!-- Main container -->
<div class="text-white font-semibold font-sans">
	<!-- User UI -->
	<div class="fixed bottom-8 left-6 flex flex-col space-y-6">
		{#each $guests as guest}
			<div class="flex flex-row justify-center items-center space-x-3">
				<img src="images/sound.svg" alt="Sound icon" height="32" width="32" />
				<div 
					class="px-4 py-2 rounded-full bg-black/50 backdrop-blur-xl flex items-center gap-2"
				>
					{#if guest.playerState.getProfile().photo}
						<img 
							src={guest.playerState.getProfile().photo} 
							alt="Avatar" 
							class="w-5 h-5 rounded-full"
						/>
					{:else}
						<div 
							class="w-5 h-5 rounded-full" 
							style="background-color: {guest.playerState.getColor() || '#FFFFFF'};"
						></div>
					{/if}
					<p>{guest.playerState.getProfile().name || `Player ${guest.playerState.id.substring(0, 4)}`}</p>
				</div>
			</div>
		{/each}
	</div>

	<!-- Controls -->
	<div class="fixed right-6 bottom-6 flex flex-row justify-center items-center space-x-3">
		<img src="images/controls.svg" alt="Controls prompts" class="h-32" />
	</div>
</div>