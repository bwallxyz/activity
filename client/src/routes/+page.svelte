<script lang="ts">
  import { onMount } from "svelte";
  import Scene from "$lib/components/Scene.svelte";
  import FallbackScene from "$lib/components/FallbackScene.svelte";
  import UI from "$lib/components/UI.svelte";
  import DebugOverlay from "$lib/components/DebugOverlay.svelte";
  import { debugLog } from "$lib/utils/debugHelper";
  
  let useMainScene = true;
  let isDiscord = false;
  
  onMount(() => {
    // Check if we're in Discord
    isDiscord = window.location.href.includes('discord.com') || 
               window.location.hostname.includes('discord') ||
               document.referrer.includes('discord');
    
    // Listen for errors and switch to fallback if needed
    debugLog.subscribe(logs => {
      const hasErrors = logs.some(log => log.includes('[ERROR]'));
      if (hasErrors && logs.length > 5 && isDiscord) {
        console.log("Multiple errors detected, switching to fallback scene");
        useMainScene = false;
      }
    });
  });
</script>

<div class="h-screen w-screen overflow-hidden">
  {#if useMainScene}
    <Scene />
  {:else}
    <FallbackScene />
  {/if}
  <UI />
  <DebugOverlay />
</div>